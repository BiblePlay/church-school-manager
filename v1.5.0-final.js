/* v1.5.0 FINAL — UI freeze / PWA onboarding / prominent share / concise last-share */
(function(){
  const FINAL_VERSION='1.5.0';
  const bubbleSvg=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.8A3.8 3.8 0 0 1 7.8 2h8.4A3.8 3.8 0 0 1 20 5.8v6.4a3.8 3.8 0 0 1-3.8 3.8H11l-5.4 4.1.8-4.1A3.8 3.8 0 0 1 4 12.2V5.8Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`;

  // ---------- shared top-level action: same visual language in Talent / Attendance ----------
  function shareBar(act,label,sub){
    return `<div class="finalShareBar"><button class="finalShareBtn" data-act="${act}">${bubbleSvg}<span>${esc(label)}</span></button><small>${esc(sub)}</small></div>`;
  }

  const priorTalentView=talentView;
  talentView=function(){
    let html=priorTalentView();
    html=html.replace(/<div class="viewActionRow"><button class="shareAction" data-act="shareCurrentTalent">공유<\/button><span>.*?<\/span><\/div>/,
      shareBar('shareCurrentTalent','달란트 공유','현재 날짜 · 현재 학년/팀만 공유'));
    return html;
  };

  const priorAttendanceView=attendanceView;
  attendanceView=function(){
    let html=priorAttendanceView();
    const act=(state.settings.teacherAttendanceEnabled && ui.attendanceMode==='teacher')?'shareCurrentTeacherAttendance':'shareCurrentAttendance';
    const label=(act==='shareCurrentTeacherAttendance')?'교사 출석 공유':'출석 공유';
    html=html.replace(/<button class="shareAction" data-act="shareCurrentAttendance">공유<\/button>/g,'');
    html=html.replace(/<button class="shareAction" data-act="shareCurrentTeacherAttendance">공유<\/button>/g,'');
    const segEnd=html.indexOf('</div>', html.indexOf('class="seg"'));
    if(segEnd>=0){
      const insertAt=segEnd+6;
      html=html.slice(0,insertAt)+shareBar(act,label,'현재 날짜 · 현재 범위 기준')+html.slice(insertAt);
    }else{
      const firstCardEnd=html.indexOf('</div></div></div>');
      const insertAt=firstCardEnd>=0?firstCardEnd+18:0;
      html=html.slice(0,insertAt)+shareBar(act,label,'현재 날짜 · 현재 범위 기준')+html.slice(insertAt);
    }
    return html;
  };

  // ---------- concise "last transaction" share ----------
  shareLast=async function(){
    const tx=ensureSession().transactions.find(t=>t.id===ui.lastTxId); if(!tx)return;
    const names=tx.studentIds.map(id=>studentById(id)?.name).filter(Boolean);
    const scope=ui.filterValue||'전체';
    if(tx.kind==='reset'){
      const text=[`${displayDate()} · ${scope} 달란트`,`리셋 ${names.length}명`,names.join(', ')].filter(Boolean).join('\n');
      return nativeShare({title:'달란트 리셋',text});
    }
    const amount=`${tx.amount>0?'+':''}${fmt(tx.amount)}`;
    const first=`${displayDate()} · ${scope} 달란트`;
    const second=names.length>1?`${amount} × ${names.length}명 = ${fmt(tx.amount*names.length)}`:`${names[0]||''} ${amount}`;
    const third=names.length>1?names.join(', '):'';
    await nativeShare({title:'달란트 기록',text:[first,second,third].filter(Boolean).join('\n')});
  };

  // ---------- install / first-data onboarding ----------
  let deferredInstallPrompt=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;});
  window.addEventListener('appinstalled',()=>{
    localStorage.setItem('churchschool_pwa_installed','1');
    hideInstallOverlay();
    setTimeout(()=>maybeShowDataStart(),180);
  });
  function isStandalone(){return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;}
  function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent);}
  function installOverlayHtml(force=false){
    const installed=isStandalone();
    return `<div id="finalInstallOverlay" class="finalOverlay" role="dialog" aria-modal="true"><div class="finalInstallCard"><div class="finalInstallIcon"><img src="icons/icon-192.png" alt=""></div><div class="finalInstallText"><small>초등2부 출석 · 달란트</small><strong>${installed?'홈 화면에 설치되어 있습니다':'홈 화면에 추가하세요'}</strong><p>${installed?'앱 아이콘으로 바로 실행할 수 있습니다.':'한 번 추가해 두면 다음부터 앱처럼 바로 열 수 있습니다.'}</p></div>${installed?`<button class="finalPrimary" data-final-install-close>확인</button>`:isIOS()?`<div class="iosInstallSteps"><span>1</span><b>Safari의 공유 ↑</b><span>2</span><b>홈 화면에 추가</b></div><button class="finalPrimary" data-final-install-iosdone>확인했어요</button><button class="finalGhost" data-final-install-close>지금은 닫기</button>`:`<button class="finalPrimary" data-final-install-now>홈 화면에 추가</button><button class="finalGhost" data-final-install-close>지금은 닫기</button>`}</div></div>`;
  }
  function showInstallOverlay(force=false){
    if(document.getElementById('finalInstallOverlay'))return;
    if(!force && (isStandalone() || localStorage.getItem('churchschool_install_guide_seen')==='1'))return;
    document.body.insertAdjacentHTML('beforeend',installOverlayHtml(force));
    bindInstallOverlay();
  }
  function hideInstallOverlay(){document.getElementById('finalInstallOverlay')?.remove();}
  function bindInstallOverlay(){
    document.querySelector('[data-final-install-now]')?.addEventListener('click',async()=>{
      if(deferredInstallPrompt){
        deferredInstallPrompt.prompt();
        try{await deferredInstallPrompt.userChoice;}catch(e){}
        deferredInstallPrompt=null;
        localStorage.setItem('churchschool_install_guide_seen','1');
        hideInstallOverlay(); setTimeout(()=>maybeShowDataStart(),180);
      }else{
        alert('브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해 주세요.');
      }
    });
    document.querySelector('[data-final-install-iosdone]')?.addEventListener('click',()=>{localStorage.setItem('churchschool_install_guide_seen','1');hideInstallOverlay();setTimeout(()=>maybeShowDataStart(),180);});
    document.querySelector('[data-final-install-close]')?.addEventListener('click',()=>{localStorage.setItem('churchschool_install_guide_seen','1');hideInstallOverlay();setTimeout(()=>maybeShowDataStart(),180);});
  }
  function noBaseData(){return active().length===0 && activeTeachers().length===0;}
  function maybeShowDataStart(force=false){
    if(!noBaseData() && !force)return;
    if(document.getElementById('finalDataStart'))return;
    if(!force && localStorage.getItem('churchschool_data_start_seen')==='1')return;
    const html=`<div id="finalDataStart" class="finalOverlay" role="dialog" aria-modal="true"><div class="finalInstallCard dataStartCard"><div class="finalInstallText"><small>처음 시작</small><strong>사용할 데이터를 가져오세요</strong><p>받은 데이터팩이 있으면 한 번만 가져오면 학생·교사 명단이 바로 준비됩니다.</p></div><button class="finalPrimary" data-start-base>데이터팩 가져오기</button><div class="finalStartGrid"><button data-start-student>학생 Excel</button><button data-start-teacher>교사 Excel</button></div><button class="finalGhost" data-start-later>나중에 하기</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
    document.querySelector('[data-start-base]')?.addEventListener('click',()=>{document.getElementById('finalDataStart')?.remove();document.getElementById('baseDataImport')?.click();});
    document.querySelector('[data-start-student]')?.addEventListener('click',()=>{document.getElementById('finalDataStart')?.remove();document.getElementById('excelImport')?.click();});
    document.querySelector('[data-start-teacher]')?.addEventListener('click',()=>{document.getElementById('finalDataStart')?.remove();document.getElementById('teacherExcelImport')?.click();});
    document.querySelector('[data-start-later]')?.addEventListener('click',()=>{localStorage.setItem('churchschool_data_start_seen','1');document.getElementById('finalDataStart')?.remove();});
  }

  // ---------- Settings: permanent re-entry to installation guide ----------
  const priorSettingsView=settingsView;
  settingsView=function(){
    const html=priorSettingsView();
    const installCard=`<section class="settingsSection finalInstallSettings"><div class="settingsSectionHead"><span>앱 설치</span><small>처음 안내를 닫았어도 여기에서 다시 확인할 수 있습니다.</small></div><button class="secondary fullBtn" data-act="appInstallGuide">홈 화면에 추가하는 방법</button></section>`;
    return html+installCard;
  };

  const priorHandleAct=handleAct;
  handleAct=function(act,b){
    if(act==='appInstallGuide'){showInstallOverlay(true);return;}
    return priorHandleAct(act,b);
  };

  // Version label and install trigger after all DOM is ready.
  window.addEventListener('load',()=>{
    setTimeout(()=>{
      showInstallOverlay(false);
      if((isStandalone() || localStorage.getItem('churchschool_install_guide_seen')==='1') && noBaseData()) setTimeout(()=>maybeShowDataStart(false),220);
    },260);
  });

  // Ensure final rendering uses the overrides above.
  render();
})();
