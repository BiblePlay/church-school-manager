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
      html=html.slice(0,insertAt)+shareBar(act,label,'')+html.slice(insertAt);
    }else{
      const firstCardEnd=html.indexOf('</div></div></div>');
      const insertAt=firstCardEnd>=0?firstCardEnd+18:0;
      html=html.slice(0,insertAt)+shareBar(act,label,'')+html.slice(insertAt);
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
  const INSTALL_SEEN='churchschool_install_guide_seen';
  const THEME_KEY='churchschool_theme_mode';
  const darkMedia=window.matchMedia?.('(prefers-color-scheme: dark)');

  function isStandalone(){return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;}
  function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent);}
  function isAndroid(){return /android/i.test(navigator.userAgent);}
  function isMobile(){return isIOS() || isAndroid();}
  function isSamsungBrowser(){return /SamsungBrowser/i.test(navigator.userAgent);}
  function isChromeAndroid(){return isAndroid() && /Chrome|CriOS/i.test(navigator.userAgent) && !/EdgA|OPR|SamsungBrowser/i.test(navigator.userAgent);}
  function looksLikeInAppBrowser(){
    const ua=navigator.userAgent||'';
    return isAndroid() && /(KAKAOTALK|NAVER|FBAN|FBAV|Instagram|Line\/|wv\))/i.test(ua);
  }

  function themeMode(){
    const v=localStorage.getItem(THEME_KEY);
    return ['system','light','dark'].includes(v)?v:'system';
  }
  function resolvedTheme(mode=themeMode()){
    return mode==='dark' || (mode==='system' && !!darkMedia?.matches) ? 'dark' : 'light';
  }
  function applyTheme(mode=themeMode(),persist=false){
    if(!['system','light','dark'].includes(mode))mode='system';
    if(persist)localStorage.setItem(THEME_KEY,mode);
    const resolved=resolvedTheme(mode);
    document.documentElement.dataset.themeMode=mode;
    document.documentElement.dataset.theme=resolved;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',resolved==='dark'?'#171717':'#ffd21f');
  }
  applyTheme();
  if(darkMedia){
    const onSystemThemeChange=()=>{if(themeMode()==='system')applyTheme('system',false);};
    try{darkMedia.addEventListener('change',onSystemThemeChange);}catch(e){try{darkMedia.addListener(onSystemThemeChange);}catch(_){} }
  }

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredInstallPrompt=e;
    const btn=document.querySelector('[data-final-install-now]');
    if(btn){btn.textContent='앱 설치';btn.disabled=false;btn.classList.remove('waiting');}
  });
  window.addEventListener('appinstalled',()=>{
    localStorage.setItem('churchschool_pwa_installed','1');
    localStorage.setItem(INSTALL_SEEN,'1');
    hideInstallOverlay();
    setTimeout(()=>maybeShowDataStart(),180);
  });

  function androidFallbackHtml(){
    if(looksLikeInAppBrowser()){
      return `<div class="androidInstallHelp" data-install-help><strong>이 브라우저에서는 바로 설치할 수 없습니다.</strong><div class="installStep"><span>1</span><b>오른쪽 위 ⋮ 메뉴</b></div><div class="installStep"><span>2</span><b>다른 브라우저로 열기</b></div><div class="installStep"><span>3</span><b>Chrome 또는 삼성 인터넷에서 ‘앱 설치’ / ‘홈 화면에 추가’</b></div></div>`;
    }
    return `<div class="androidInstallHelp" data-install-help><strong>설치창이 자동으로 열리지 않는 경우</strong><div class="installStep"><span>1</span><b>브라우저 오른쪽 위 ⋮ 메뉴</b></div><div class="installStep"><span>2</span><b>‘앱 설치’ 또는 ‘홈 화면에 추가’</b></div></div>`;
  }

  function installOverlayHtml(force=false){
    const installed=isStandalone();
    if(installed){
      return `<div id="finalInstallOverlay" class="finalOverlay" role="dialog" aria-modal="true"><div class="finalInstallCard"><div class="finalInstallIcon"><img src="icons/icon-192.png" alt=""></div><div class="finalInstallText"><small>초등2부 출석 · 달란트</small><strong>홈 화면에 설치되어 있습니다</strong><p>앱 아이콘으로 바로 실행할 수 있습니다.</p></div><button class="finalPrimary" data-final-install-close>확인</button></div></div>`;
    }
    if(isIOS()){
      return `<div id="finalInstallOverlay" class="finalOverlay" role="dialog" aria-modal="true"><div class="finalInstallCard"><div class="finalInstallIcon"><img src="icons/icon-192.png" alt=""></div><div class="finalInstallText"><small>초등2부 출석 · 달란트</small><strong>홈 화면에 추가하세요</strong><p>아래 순서대로 하면 앱처럼 바로 실행할 수 있습니다.</p></div><div class="iosInstallSteps"><span>1</span><b>브라우저의 공유 ↑ 버튼</b><span>2</span><b>홈 화면에 추가</b><span>3</span><b>오른쪽 위 ‘추가’</b></div><button class="finalPrimary" data-final-install-iosdone>설명 확인</button><button class="finalGhost" data-final-install-close>지금은 닫기</button></div></div>`;
    }
    if(isAndroid()){
      const ready=!!deferredInstallPrompt;
      return `<div id="finalInstallOverlay" class="finalOverlay" role="dialog" aria-modal="true"><div class="finalInstallCard"><div class="finalInstallIcon"><img src="icons/icon-192.png" alt=""></div><div class="finalInstallText"><small>초등2부 출석 · 달란트</small><strong>앱으로 설치하세요</strong><p>${ready?'아래 버튼을 누르면 설치창이 바로 열립니다.':'설치가 바로 안 되면 아래 버튼에서 설치 방법을 안내합니다.'}</p></div><button class="finalPrimary ${ready?'':'waiting'}" data-final-install-now>${ready?'앱 설치':'홈 화면에 추가'}</button><div data-install-help-wrap></div><button class="finalGhost" data-final-install-close>지금은 닫기</button></div></div>`;
    }
    return `<div id="finalInstallOverlay" class="finalOverlay" role="dialog" aria-modal="true"><div class="finalInstallCard"><div class="finalInstallIcon"><img src="icons/icon-192.png" alt=""></div><div class="finalInstallText"><small>초등2부 출석 · 달란트</small><strong>모바일에서 앱처럼 사용할 수 있습니다</strong><p>아이폰이나 갤럭시에서 이 주소를 열면 홈 화면 설치 안내가 표시됩니다.</p></div><button class="finalPrimary" data-final-install-close>확인</button></div></div>`;
  }
  function showInstallOverlay(force=false){
    if(document.getElementById('finalInstallOverlay'))return;
    document.getElementById('finalDataStart')?.remove();
    if(!force && (!isMobile() || isStandalone() || localStorage.getItem(INSTALL_SEEN)==='1'))return;
    document.body.insertAdjacentHTML('beforeend',installOverlayHtml(force));
    bindInstallOverlay();
  }
  function hideInstallOverlay(){document.getElementById('finalInstallOverlay')?.remove();}
  function showAndroidInstallHelp(){
    const wrap=document.querySelector('[data-install-help-wrap]');
    if(!wrap)return;
    wrap.innerHTML=androidFallbackHtml();
    wrap.querySelector('[data-install-help]')?.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function bindInstallOverlay(){
    document.querySelector('[data-final-install-now]')?.addEventListener('click',async()=>{
      if(deferredInstallPrompt){
        const promptEvent=deferredInstallPrompt;
        deferredInstallPrompt=null;
        try{
          await promptEvent.prompt();
          const choice=await promptEvent.userChoice;
          if(choice?.outcome==='accepted'){
            localStorage.setItem(INSTALL_SEEN,'1');
            hideInstallOverlay();
            setTimeout(()=>maybeShowDataStart(),180);
          }else{
            showAndroidInstallHelp();
          }
        }catch(e){showAndroidInstallHelp();}
      }else{
        showAndroidInstallHelp();
      }
    });
    document.querySelector('[data-final-install-iosdone]')?.addEventListener('click',()=>{
      localStorage.setItem(INSTALL_SEEN,'1');hideInstallOverlay();setTimeout(()=>maybeShowDataStart(),180);
    });
    document.querySelector('[data-final-install-close]')?.addEventListener('click',()=>{
      localStorage.setItem(INSTALL_SEEN,'1');hideInstallOverlay();setTimeout(()=>maybeShowDataStart(),180);
    });
  }
  function noBaseData(){return active().length===0 && activeTeachers().length===0;}
  function maybeShowDataStart(force=false){
    if(document.getElementById('finalInstallOverlay'))return;
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

  // ---------- Settings: display mode + permanent install guide ----------
  const priorSettingsView=settingsView;
  settingsView=function(){
    const html=priorSettingsView();
    const mode=themeMode();
    const displayCard=`<section class="settingsSection displayModeSettings"><div class="settingsSectionHead"><span>화면 모드</span><small>이 앱 화면에만 적용됩니다.</small></div><div class="themeChoice" role="group" aria-label="화면 모드"><button class="themeChoiceBtn ${mode==='system'?'active':''}" data-act="themeSystem">시스템</button><button class="themeChoiceBtn ${mode==='light'?'active':''}" data-act="themeLight">밝게</button><button class="themeChoiceBtn ${mode==='dark'?'active':''}" data-act="themeDark">어둡게</button></div><div class="themeModeHint">휴대폰 전체 설정은 바뀌지 않습니다. 앱을 나가면 원래 화면 설정 그대로입니다.</div></section>`;
    const installCard=`<section class="settingsSection finalInstallSettings"><div class="settingsSectionHead"><span>앱 설치</span><small>처음 안내를 닫았어도 여기에서 다시 확인할 수 있습니다.</small></div><button class="secondary fullBtn" data-act="appInstallGuide">홈 화면에 추가하는 방법</button></section>`;
    return html+displayCard+installCard;
  };

  const priorHandleAct=handleAct;
  handleAct=function(act,b){
    if(act==='appInstallGuide'){showInstallOverlay(true);return;}
    if(act==='themeSystem'){applyTheme('system',true);render();return;}
    if(act==='themeLight'){applyTheme('light',true);render();return;}
    if(act==='themeDark'){applyTheme('dark',true);render();return;}
    return priorHandleAct(act,b);
  };

  // Version label and install trigger after all DOM is ready.
  window.addEventListener('load',()=>{
    setTimeout(()=>{
      applyTheme(themeMode(),false);
      if(isMobile() && !isStandalone() && localStorage.getItem(INSTALL_SEEN)!=='1'){
        showInstallOverlay(false);
      }else if(noBaseData()){
        setTimeout(()=>maybeShowDataStart(false),220);
      }
    },260);
  });

  // Ensure final rendering uses the overrides above.
  render();
})();
