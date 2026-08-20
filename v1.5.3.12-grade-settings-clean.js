/* v1.5.3.20 — FINAL settings/data-flow audit layer.
   This is the last-loaded compatibility layer. It does not add a new patch file.
   Responsibilities:
   - one clear Settings information architecture without duplicate data actions
   - grade manager without student counts
   - safe data-pack UPDATE / REPLACE preview
   - safer grouped data reset/restore UI
   - youth-pack privacy: minimal student-detail view on youth replacement devices
*/
(function(){
  'use strict';

  gradeManagerCard = function(){
    const gs = grades();
    return `<div class="card"><div class="row"><div><div class="label">등록 학년 정리</div><div class="muted">학생에게 이미 등록된 학년 이름을 바꾸거나 병합합니다. 위 ‘내 담당 학년’의 기본 시작 설정과는 다른 기능입니다.</div></div><button class="secondary nowrap" data-act="manageGrades">정리</button></div>${gs.length?`<div class="gradeSummary">${gs.map(g=>`<span class="pill">${esc(g)}</span>`).join('')}</div>`:''}</div>`;
  };

  // 팀 자체를 만드는 곳과 ‘내 담당 팀’ 기본 선택을 명확히 구분한다.
  teamManagerCard = function(){
    const teams=allTeams();
    return `<div class="card"><div class="row"><div><div class="label">등록 팀 관리</div><div class="muted">필요한 팀을 직접 만들고 학생 구성을 편집합니다. 위 ‘내 담당 팀’은 여기서 만든 팀의 기본 시작 선택일 뿐입니다.</div></div><button class="secondary nowrap" data-act="newTeam">+ 팀 만들기</button></div>${teams.map((t,i)=>`<div class="teamRow"><button class="teamMain" data-edit-team="${attr(t)}"><strong>${esc(t)}</strong><small>${active().filter(s=>(s.teams||[]).includes(t)).length}명 · 팀원 편집</small></button><button class="smallIcon" data-team-up="${attr(t)}" ${i===0?'disabled':''}>↑</button><button class="smallIcon" data-team-down="${attr(t)}" ${i===teams.length-1?'disabled':''}>↓</button><button class="smallIcon dangerIcon" data-team-delete="${attr(t)}">⌫</button></div>`).join('')||'<div class="muted">아직 만든 팀이 없습니다. 만들기 전에는 각 화면의 보기 메뉴에도 팀이 나타나지 않습니다.</div>'}</div>`;
  };

  function currentThemeMode(){
    const v=localStorage.getItem('churchschool_theme_mode');
    return ['system','light','dark'].includes(v)?v:'system';
  }
  function dataAccessLabel(){return state.settings.profileAccess==='youth'?'청년교사용 최소정보':'임원·양육교사용 상세정보';}
  function settingsSection(title,help,body,cls=''){
    return `<section class="settingsSection finalSettingsSection ${cls}"><div class="settingsSectionHead"><span>${title}</span><small>${help}</small></div>${body}</section>`;
  }
  function managedLabels(items,type){
    if(!items.length)return `<span class="muted">${type==='grade'?'학생 학년을 먼저 등록해 주세요.':'등록된 팀이 없습니다.'}</span>`;
    return items.map(v=>`<label><input type="checkbox" data-managed-${type}="${attr(v)}" ${(state.settings[type==='grade'?'managedGrades':'managedTeams']||[]).includes(v)?'checked':''}> ${esc(v)}</label>`).join('');
  }

  function homeroomTeacherBlock(gs){
    const teachers=activeTeachers().map(t=>t.name).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
    if(!gs.length)return '<div class="muted">학생 학년을 먼저 등록해 주세요.</div>';
    if(!teachers.length)return '<div class="muted">교사 명부에 교사를 먼저 등록하면 학년별 담임교사를 지정할 수 있습니다.</div>';
    const map=state.settings.gradeHomeroomTeachers||{};
    return `<div class="gradeHomeroomList">${gs.map(g=>{const selected=Array.isArray(map[g])?map[g]:[];return `<div class="gradeHomeroomRow"><strong>${esc(g)}</strong><div class="gradeHomeroomChoices">${teachers.map(n=>`<label><input type="checkbox" data-grade-homeroom="${attr(g)}" value="${attr(n)}" ${selected.includes(n)?'checked':''}><span>${esc(n)}</span></label>`).join('')}</div></div>`}).join('')}</div><div class="managedGradeHelp">한 학년당 최대 2명입니다. 저장하면 현재 그 학년 학생 전체에 공통 적용되고, 이후 새 학생도 자동으로 같은 담임교사를 받습니다. 공통 지정을 비워도 기존 학생별 담당교사 기록은 자동 삭제하지 않습니다.</div>`;
  }

  // Final Settings is intentionally composed once here, after all legacy wrappers.
  // Existing action names/functions are reused; only duplicate entrances are reorganized.
  settingsView=function(){
    const admin=!!state.settings.adminMode,mode=currentThemeMode(),gs=grades(),teams=allTeams();
    const access=dataAccessLabel();
    const basic=`<div class="card settingsCoreCard"><div class="label">기본 설정</div><div class="form" style="margin-top:10px">
      <label class="fieldLabel">부서 이름<input id="department" class="input" value="${attr(state.settings.department||'')}"></label>
      <div class="fieldLabel">사용 모드<div class="modeChoice"><label class="modeCard"><input type="radio" name="adminMode" value="teacher" ${!admin?'checked':''}><span>담당 선생님</span><small>담당 학년을 기본으로 시작 · 다른 학년도 보기에서 선택</small></label><label class="modeCard"><input type="radio" name="adminMode" value="admin" ${admin?'checked':''}><span>전체 관리자</span><small>모든 등록 학년을 전체로 시작 · 받은 데이터 병합</small></label></div><div class="modeHint">전체 관리자는 담당 학년을 선택하지 않아도 됩니다.</div></div>
      <div class="fieldLabel">내 담당 학년 · 복수 선택 가능<div class="managedGradeHelp">담당 선생님 모드의 기본 시작 학년입니다. 마지막으로 체크한 학년이 기본값이 되며, 데이터 접근을 제한하지 않습니다.</div><div class="managedGradeGrid">${managedLabels(gs,'grade')}</div></div>
      <div class="fieldLabel gradeHomeroomField"><strong>학년별 담임교사 · 공통 적용</strong><div class="managedGradeHelp">학생마다 반복 지정하지 않고 학년에서 한 번 정합니다.</div>${homeroomTeacherBlock(gs)}</div>
      <div class="fieldLabel">내 담당 팀 · 복수 선택 가능<div class="managedGradeHelp">실제로 만든 팀만 표시됩니다. 팀을 선택해도 다른 학년·팀 데이터가 사라지지 않습니다.</div><div class="managedGradeGrid">${managedLabels(teams,'team')}</div></div>
      <label class="fieldLabel">달란트 버튼<input id="amounts" class="input" value="${attr((state.settings.amounts||[]).join(', '))}" placeholder="10, 20, 50, 100"></label>
      <label class="fieldLabel">장기 미출석 기준<select id="longAbsenceDays" class="input">${[[30,'1개월'],[60,'2개월 · 기본'],[90,'3개월'],[180,'6개월']].map(([v,l])=>`<option value="${v}" ${Number(state.settings.longAbsenceDays||60)===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <button class="primary fullBtn" data-act="saveSettings">변경사항 저장</button>
    </div></div>`;

    const org=`${gradeManagerCard()}${teamManagerCard()}<div class="card"><div class="row"><div><div class="label">교사 출석</div><div class="muted">필요할 때만 출석 화면에 교사 탭을 표시합니다.</div></div><button class="toggle ${state.settings.teacherAttendanceEnabled?'on':''}" data-act="toggleTeacherAttendance"><span></span></button></div><div class="divider"></div><div class="row"><div><div class="label">교사 명부</div><div class="muted">교사 추가·수정·전화·문자·생일을 관리합니다.</div></div><button class="secondary nowrap" data-act="manageTeachers">교사 보기</button></div></div>`;

    const importSection=settingsSection('명단 가져오기','명단을 처음 넣거나 최신 정보로 갱신할 때',
      `<div class="settingsActionList"><button class="settingsAction" data-act="excelImport"><strong>학생/통합 Excel 가져오기</strong><small>분석 후 ‘기존 명단 업데이트’ 또는 ‘새 명단으로 교체’를 선택합니다.</small></button><button class="settingsAction" data-act="teacherExcelImport"><strong>교사 Excel 가져오기</strong><small>교사 명단만 추가·업데이트합니다. 학생 명단은 건드리지 않습니다.</small></button></div>`);

    const packs=settingsSection('데이터팩','다른 기기에 앱용 명단을 전달할 때',
      `<div class="dataScopeBadge">현재 기기 데이터 범위 <strong>${access}</strong></div><div class="packetActionCard"><div class="packetActionText"><strong>임원·양육교사용</strong><small>학생 상세정보·심방/연락 기록 포함 · 출석 기록은 내보낼 때 선택</small></div><button class="packetExportBtn" data-act="exportCarePack">내보내기</button></div><div class="packetActionCard"><div class="packetActionText"><strong>청년교사용</strong><small>학생 최소정보 · 학생 상세 개인정보·심방기록 제외 · 출석 기록은 선택</small></div><button class="packetExportBtn" data-act="exportYouthPack">내보내기</button></div><button class="secondary fullBtn settingsImportPack" data-act="importBaseData">데이터팩 가져오기</button><div class="settingsFootnote">가져올 때 <b>업데이트</b>와 <b>현재 명단 교체</b>를 선택합니다. 명단 교체도 과거 출석·달란트 기록은 삭제하지 않습니다.</div>`);

    const attendanceMove=settingsSection('출석 기록 이동','명단 전체를 바꾸지 않고 출석 기록만 주고받을 때',
      `<div class="settingsActionList"><button class="settingsAction" data-act="pasteRecord"><strong>카톡 기록 붙여넣기</strong><small>받은 학생·교사 출석 또는 달란트 텍스트를 기존 기록에 병합합니다.</small></button><button class="settingsAction" data-act="exportAttendanceBundle"><strong>출석 기록 파일 내보내기</strong><small>학생·교사 출석을 JSON 한 파일로 전달합니다.</small></button><button class="settingsAction" data-act="importAttendanceBundle"><strong>출석 기록 파일 가져오기</strong><small>같은 날짜·같은 사람은 새로 만들지 않고 기존 기록을 업데이트합니다.</small></button></div>`);

    const reports=settingsSection('Excel 내보내기','사람이 확인·보관하기 좋은 보고서',
      `<div class="grid2 settingsReportGrid"><button class="secondary" data-act="exportStudents">학생 명단 Excel</button><button class="secondary" data-act="exportTeachers">교사 명단 Excel</button><button class="secondary" data-act="exportAttendance">출석 Excel</button><button class="secondary" data-act="exportTalent">달란트 Excel</button></div><div class="settingsFootnote">학생·출석 자료에는 학년 정보가 포함됩니다. 출석 기록 화면에서는 현재 보기·연도·월 기준으로 Excel/TXT도 내보낼 수 있습니다.</div>`);

    const backupSection=settingsSection('백업 · 복구','기기 전체 상태를 사고 대비용으로 보관할 때',
      `<div class="grid2"><button class="secondary" data-act="backup">전체 백업</button><button class="secondary" data-act="backupImport">백업 복원</button></div><button class="secondary fullBtn backupFolderBtn" data-act="setBackupFolder">백업 폴더 지정 · 변경</button><div class="settingsFootnote">지원 기기에서는 처음 한 번 위치를 고르면 그 안의 <b>‘교회학교 출석달란트 백업’</b> 폴더에 이후 백업이 자동 저장됩니다. iPhone/Safari 등 폴더 자동 지정이 지원되지 않는 기기는 기기의 기본 다운로드 위치를 사용합니다. 데이터팩과 달리 학생·교사·출석·달란트·설정 등 앱 전체 상태를 복구합니다.</div>`);

    const display=settingsSection('화면 · 설치','앱 표시와 홈 화면 설치',
      `<div class="themeChoice" role="group" aria-label="화면 모드"><button class="themeChoiceBtn ${mode==='system'?'active':''}" data-act="themeSystem">시스템</button><button class="themeChoiceBtn ${mode==='light'?'active':''}" data-act="themeLight">밝게</button><button class="themeChoiceBtn ${mode==='dark'?'active':''}" data-act="themeDark">어둡게</button></div><button class="secondary fullBtn installGuideBtn" data-act="appInstallGuide">홈 화면에 추가하는 방법</button>`);

    const danger=settingsSection('고급 데이터 관리','삭제·초기화는 필요할 때만',
      `<div class="row"><div><div class="label">초기화 · 이전 상태 복원</div><div class="muted">실행 전 자동 상태 보관 후 선택한 데이터만 정리합니다.</div></div><button class="secondary nowrap" data-act="dataManager">관리 열기</button></div>`,'dangerSettingsSection');

    return basic+org+importSection+packs+attendanceMove+reports+backupSection+display+danger;
  };


  // 학년별 담임교사를 설정에서 한 번 지정해 학생 전체에 공통 적용한다.
  saveSettings=function(){
    const dep=document.getElementById('department')?.value.trim()||'';
    const nums=String(document.getElementById('amounts')?.value||'').split(',').map(v=>Number(v.trim())).filter(v=>Number.isFinite(v)&&v>0).slice(0,4);
    if(nums.length<1)return toast('달란트 금액을 하나 이상 입력해 주세요.');
    const adminMode=(document.querySelector('input[name="adminMode"]:checked')?.value||'admin')==='admin';
    const managedGrades=[...document.querySelectorAll('[data-managed-grade]:checked')].map(x=>x.dataset.managedGrade);
    const managedTeams=[...document.querySelectorAll('[data-managed-team]:checked')].map(x=>x.dataset.managedTeam);
    const oldDefault=state.settings.managementScope;
    const clicked=ui.settingsDefaultGrade;
    const preferred=(clicked&&managedGrades.includes(clicked))?clicked:(managedGrades.includes(oldDefault)?oldDefault:(managedGrades[0]||'전체'));
    const defaultScope=adminMode?'전체':preferred;
    const homeroom={};
    for(const g of grades()){
      const names=[...document.querySelectorAll('[data-grade-homeroom]:checked')].filter(x=>x.dataset.gradeHomeroom===g).map(x=>x.value).filter(Boolean).slice(0,2);
      if(names.length)homeroom[g]=names;
    }
    state.settings.department=dep||'교회학교';
    state.settings.adminMode=adminMode;
    state.settings.managementScope=defaultScope;
    state.settings.amounts=nums;
    state.settings.managedGrades=managedGrades;
    state.settings.managedTeams=managedTeams;
    state.settings.gradeHomeroomTeachers=homeroom;
    const la=document.getElementById('longAbsenceDays');if(la)state.settings.longAbsenceDays=Number(la.value)||60;
    for(const st of active()){
      const names=homeroom[st.grade];
      if(names?.length&&typeof v14SetAssignedTeachers==='function')v14SetAssignedTeachers(st,names);
    }
    ui.attendanceGrade=defaultScope;ui.analyticsScope=defaultScope;ui.studentGrade=defaultScope;ui.filterType='학년';ui.filterValue=defaultScope;ui.scopeMenu=null;ui.settingsDefaultGrade=null;
    save();
    toast(adminMode?'설정과 학년별 담임교사를 저장했습니다.':(defaultScope==='전체'?'담당 학년 제한 없이 저장했습니다.':`${defaultScope} 기본 시작 · 학년별 담임교사를 저장했습니다.`));
    render();
  };

  const priorModalHtml_v15312 = modalHtml;
  modalHtml = function(){
    const close = `<button class="icon" data-act="closeModal" aria-label="닫기">×</button>`;
    if(ui.modal?.type==='gradeManager'){
      const gs = grades();
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">학년 관리</div><div class="muted">겹친 분류는 병합하고 필요 없는 분류는 정리합니다.</div></div>${close}</div><div class="list">${gs.map(g=>`<div class="gradeRow"><div><strong>${esc(g)}</strong></div><button class="smallText" data-grade-rename="${attr(g)}">이름변경</button><button class="smallText" data-grade-merge="${attr(g)}">병합</button><button class="smallText dangerText" data-grade-delete="${attr(g)}">삭제</button></div>`).join('')||'<div class="empty">학년 분류가 없습니다.</div>'}</div><div class="notice">학년 분류를 삭제하면 해당 학생은 ‘학년 미지정’으로 남습니다. 학생 자체와 과거 출석·달란트 기록은 삭제되지 않습니다.</div>`);
    }
    if(ui.modal?.type==='dataPackImport'){
      const p=ui.dataPackImportPreview?.packet;if(!p)return '';
      const care=p.packetType==='care-admin',attendance=p.attendanceSync?.schema==='church-school-attendance-bundle-v1';
      const stN=(p.students||[]).length,tN=(p.teachers||[]).length,teamN=(p.teams||[]).length;
      const sSessions=attendance?(p.attendanceSync.studentSessions||[]).length:0,tSessions=attendance?(p.attendanceSync.teacherSessions||[]).length:0;
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">데이터팩 가져오기</div><div class="muted">${care?'임원·양육교사용':'청년교사용'} · ${esc(p.dataRevision||'버전 미표시')}</div></div>${close}</div>
        <div class="card packSummaryCard">${kv('학생',`${stN}명`)}${kv('교사',`${tN}명`)}${kv('팀',`${teamN}개`)}${attendance?kv('포함 출석',`학생 ${sSessions}회 · 교사 ${tSessions}회`):kv('포함 출석','없음')}</div>
        ${attendance?`<label class="packAttendanceChoice"><input id="importPackAttendance" type="checkbox" checked><span><strong>포함된 출석 기록도 업데이트</strong><small>기존 출석을 지우지 않고 같은 날짜·같은 사람만 업데이트합니다.</small></span></label>`:''}
        <div class="packImportModes"><button class="packImportMode" data-act="applyDataPackUpdate"><strong>기존 데이터 업데이트</strong><small>같은 ID는 최신 정보로 갱신하고 새 사람은 추가합니다. 파일에 없는 기존 명단은 그대로 둡니다.</small></button><button class="packImportMode replace" data-act="applyDataPackReplace"><strong>현재 명단 교체</strong><small>파일에 없는 활성 학생·교사는 명단에서 제외합니다. ID와 과거 출석·달란트 기록은 보존됩니다.${care?'':' 청년교사용은 활성 학생의 민감정보도 최소정보 기준으로 정리합니다.'}</small></button></div>
        <div class="notice">실행 직전에 현재 상태를 자동 보관합니다. 잘못 적용해도 ‘고급 데이터 관리 → 이전 상태 복원’에서 되돌릴 수 있습니다.</div>`);
    }
    if(ui.modal?.type==='dataManager'){
      const snaps=state.snapshots||[];
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">고급 데이터 관리</div><div class="muted">일상 작업이 아니라 잘못 가져온 데이터 정리·복구용입니다.</div></div>${close}</div>
        <details class="dangerGroup"><summary>명단 · 분류 초기화</summary><div class="dangerGroupBody"><button class="danger fullBtn" data-act="resetStudents">현재 학생 명단 비우기</button><small>학생을 비활성화합니다. 과거 출석·달란트 기록은 남습니다.</small><button class="danger fullBtn" data-act="resetTeams">팀만 초기화</button><small>팀 이름과 현재 팀 소속만 비웁니다.</small><button class="danger fullBtn" data-act="resetTeachers">교사 데이터 초기화</button><small>교사 명단과 교사 출석을 초기화합니다.</small></div></details>
        <details class="dangerGroup"><summary>기록 초기화</summary><div class="dangerGroupBody"><button class="danger fullBtn" data-act="resetAttendance">출석 기록 초기화</button><small>학생 출석 기록만 비웁니다. 달란트와 명단은 유지합니다.</small><button class="danger fullBtn" data-act="resetTalent">달란트 기록 초기화</button><small>달란트 거래만 비웁니다. 출석과 명단은 유지합니다.</small></div></details>
        <details class="dangerGroup allReset"><summary>전체 데이터 초기화</summary><div class="dangerGroupBody"><button class="danger fullBtn" data-act="resetAll">전체 데이터 초기화</button><small>학생·교사·출석·달란트·팀·설정을 새 상태로 만듭니다. 자동 보관 후 한 번 더 확인합니다.</small></div></details>
        <div class="card"><div class="sectionTitle">이전 상태 복원</div><div class="muted" style="margin-top:4px">Excel 가져오기·데이터팩 적용·대량 삭제·초기화 전에 자동 보관된 상태입니다.</div>${snaps.length?snaps.map(x=>`<button class="snapshotRow" data-snapshot="${x.id}"><span><strong>${esc(x.label)}</strong><small>${new Date(x.createdAt).toLocaleString('ko-KR')}</small></span><b>복원</b></button>`).join(''):'<div class="muted" style="margin-top:10px">아직 자동 보관된 상태가 없습니다.</div>'}</div>`);
    }
    if(ui.modal?.type==='detail'&&state.settings.profileAccess==='youth'){
      const st=studentById(ui.modal.id);if(!st)return '';
      const attendanceHistory=Object.keys(state.sessions||{}).sort().reverse().filter(k=>(typeof attendanceSessionRecorded!=='function'||attendanceSessionRecorded(k))&&state.sessions[k]?.attendance?.[st.id]).slice(0,10);
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${esc(st.name)}</div><div class="muted">청년교사용 최소정보</div></div>${close}</div><div class="card">${kv('학년',st.grade||'미지정')}${kv('성별',st.gender||'미지정')}${kv('팀',(st.teams||[]).join(', ')||'없음')}${kv('누적 달란트',`${fmt(totalAmt(st.id))}`)}</div><div class="notice">이 기기는 청년교사용 최소정보 데이터팩으로 설정되어 보호자 연락처·주소·내부 관리정보를 표시하지 않습니다.</div><div class="card"><div class="sectionTitle">최근 출석</div>${attendanceHistory.map(k=>`<div class="history"><span><strong>${displayDate(k)}</strong><small>${esc(att(st,k).memo||'')}</small></span><strong>${statusLabel(att(st,k).status)}</strong></div>`).join('')||'<div class="muted">출석 기록 없음</div>'}</div>`);
    }
    return priorModalHtml_v15312();
  };

  const priorHandleAct_v15320=handleAct;
  handleAct=function(act,b){
    if(act==='applyDataPackUpdate'){
      const include=!!document.getElementById('importPackAttendance')?.checked;
      return window.applyDataPackImport?.('update',include);
    }
    if(act==='applyDataPackReplace'){
      const include=!!document.getElementById('importPackAttendance')?.checked;
      return window.applyDataPackImport?.('replace',include);
    }
    return priorHandleAct_v15320(act,b);
  };


  const priorBind_v15323=bind;
  bind=function(){
    priorBind_v15323();
    document.querySelectorAll('[data-grade-homeroom]').forEach(box=>box.onchange=()=>{
      const g=box.dataset.gradeHomeroom;
      const checked=[...document.querySelectorAll('[data-grade-homeroom]:checked')].filter(x=>x.dataset.gradeHomeroom===g);
      if(checked.length>2){box.checked=false;toast('한 학년의 담임교사는 최대 2명까지 지정할 수 있습니다.');}
    });
  };
  const homeroomStyle=document.createElement('style');
  homeroomStyle.textContent=`.gradeHomeroomField{padding-top:4px}.gradeHomeroomList{display:grid;gap:10px;margin-top:8px}.gradeHomeroomRow{display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px;align-items:start;padding:10px;border:1.5px solid #dedbd3;border-radius:15px;background:#faf9f5}.gradeHomeroomRow>strong{padding-top:10px;font-size:13px}.gradeHomeroomChoices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.gradeHomeroomChoices label{position:relative}.gradeHomeroomChoices input{position:absolute;opacity:0;pointer-events:none}.gradeHomeroomChoices span{display:flex;align-items:center;justify-content:center;min-height:40px;padding:7px 9px;border:1.5px solid #d8d3c9;border-radius:12px;background:#fff;font-size:12px;font-weight:850;text-align:center}.gradeHomeroomChoices input:checked+span{background:#ffd21f;border-color:#171717;color:#171717}@media(max-width:430px){.gradeHomeroomRow{grid-template-columns:52px minmax(0,1fr)}.gradeHomeroomChoices{grid-template-columns:1fr 1fr}}`;
  document.head.appendChild(homeroomStyle);

  render();
})();
