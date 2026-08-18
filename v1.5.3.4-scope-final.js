/* v1.5.3.4 — managed grade/team scope cleanup
   - removes duplicate "기본 관리 범위" setting
   - uses managed grades/teams as the single teacher-mode scope
   - teacher mode defaults talent/attendance/student list to 내 담당
   - grade/team option labels remain data-driven and rename-safe
   - admin mode always defaults to 전체
*/
(function(){
  'use strict';

  function uniq(arr){ return [...new Set((arr||[]).filter(Boolean))]; }
  function teamNamesOf(st){ return Array.isArray(st?.teams)?st.teams:[]; }

  // Single definition of "내 담당": selected grade OR selected team.
  // If only one type is selected, that type alone defines the scope.
  scopedStudents=function(scope=state.settings.managementScope||'전체'){
    const admin=!!state.settings.adminMode;
    const managedGrades=uniq(state.settings.managedGrades||[]);
    const managedTeams=uniq(state.settings.managedTeams||[]);
    const base=active();
    const inManaged=(s)=>{
      const byGrade=managedGrades.length>0 && managedGrades.includes(s.grade);
      const byTeam=managedTeams.length>0 && teamNamesOf(s).some(t=>managedTeams.includes(t));
      if(managedGrades.length && managedTeams.length) return byGrade || byTeam;
      if(managedGrades.length) return byGrade;
      if(managedTeams.length) return byTeam;
      return false;
    };
    if(!admin){
      const mine=base.filter(inManaged);
      if(scope==='전체'||scope==='내 담당') return mine;
      return mine.filter(s=>s.grade===scope);
    }
    if(scope==='내 담당') return base.filter(inManaged);
    return scope==='전체' ? base : base.filter(s=>s.grade===scope);
  };

  scopeOptionsWithManaged=function(){
    const admin=!!state.settings.adminMode;
    const managed=uniq(state.settings.managedGrades||[]);
    const hasManaged=managed.length || (state.settings.managedTeams||[]).length;
    if(!admin) return ['내 담당',...managed];
    return ['전체',...(hasManaged?['내 담당']:[]),...grades()];
  };

  // Keep existing settings sections, only remove duplicated managementScope selector
  // and make the real managed selectors visually obvious.
  const priorSettingsView_v1534=settingsView;
  settingsView=function(){
    let html=priorSettingsView_v1534();
    html=html.replace(/<label class="fieldLabel">기본 관리 범위<select id="managementScope" class="input">[\s\S]*?<\/select><\/label>/,'');
    html=html.replace('<div class="fieldLabel">내 담당 학년 <div class="managedGradeGrid">',
      '<div class="fieldLabel managedScopeTitle">내 담당 학년 <small>선택한 학년이 담당 선생님 모드의 기본 범위가 됩니다.</small><div class="managedGradeGrid managedScopeGrid">');
    html=html.replace('<div class="fieldLabel">내 담당 팀 · 선택 <div class="managedGradeGrid">',
      '<div class="fieldLabel managedScopeTitle">내 담당 팀 · 선택 <small>팀이 있으면 실제 팀 이름이 자동으로 표시됩니다.</small><div class="managedGradeGrid managedScopeGrid">');
    return html;
  };

  // No second scope selector: mode decides 전체/내 담당.
  saveSettings=function(){
    const dep=document.getElementById('department')?.value.trim()||'';
    const nums=(document.getElementById('amounts')?.value||'').split(',').map(v=>Number(v.trim())).filter(v=>Number.isFinite(v)&&v>0).slice(0,4);
    if(nums.length<1)return toast('달란트 금액을 하나 이상 입력해 주세요.');
    const adminMode=(document.querySelector('input[name="adminMode"]:checked')?.value||'admin')==='admin';
    const managedGrades=[...document.querySelectorAll('[data-managed-grade]:checked')].map(x=>x.dataset.managedGrade);
    const managedTeams=[...document.querySelectorAll('[data-managed-team]:checked')].map(x=>x.dataset.managedTeam);
    if(!adminMode && !managedGrades.length && !managedTeams.length){
      return toast('담당 선생님 모드에서는 담당 학년 또는 담당 팀을 하나 이상 선택해 주세요.');
    }
    const scope=adminMode?'전체':'내 담당';
    state.settings.department=dep||'교회학교';
    state.settings.adminMode=adminMode;
    state.settings.managementScope=scope; // compatibility with existing saved data/export packs
    state.settings.amounts=nums;
    state.settings.managedGrades=uniq(managedGrades);
    state.settings.managedTeams=uniq(managedTeams);
    const la=document.getElementById('longAbsenceDays');
    if(la)state.settings.longAbsenceDays=Number(la.value)||60;
    ui.attendanceGrade=scope;
    ui.analyticsScope=scope;
    ui.studentGrade=scope;
    ui.filterType='학년';
    ui.filterValue=scope;
    save();toast('설정을 저장했습니다.');render();
  };

  // Preserve selected scope when a grade label itself is renamed/merged/deleted.
  renameGrade=function(old){
    const n=prompt(`${old}의 새 이름을 입력하세요.`,old); if(!n?.trim())return;
    const next=normalizeGrade(n.trim()); if(next===old)return;
    if(grades().includes(next)) return mergeGrade(old,next);
    createSnapshot('학년 이름 변경 전'); pushUndo();
    state.students.forEach(st=>{if(st.active!==false&&st.grade===old)st.grade=next;});
    state.settings.managedGrades=uniq((state.settings.managedGrades||[]).map(g=>g===old?next:g));
    if(state.settings.managementScope===old)state.settings.managementScope=next;
    if(ui.studentGrade===old)ui.studentGrade=next;
    if(ui.attendanceGrade===old)ui.attendanceGrade=next;
    if(ui.analyticsScope===old)ui.analyticsScope=next;
    save();toast('학년 이름을 변경했습니다.');ui.modal={type:'gradeManager'};render();
  };

  mergeGrade=function(old,targetArg){
    const options=grades().filter(g=>g!==old); if(!options.length)return toast('병합할 다른 학년이 없습니다.');
    const target=targetArg||prompt(`${old}을 어느 학년으로 병합할까요?\n${options.join(' / ')}`,options[0]); if(!target)return;
    const next=options.find(x=>x===target.trim())||options.find(x=>normalizeGrade(x)===normalizeGrade(target)); if(!next)return toast('목록에 있는 학년 이름을 입력해 주세요.');
    if(!confirm(`${old} 학생을 모두 ${next}으로 이동할까요?\n과거 기록은 그대로 유지됩니다.`))return;
    createSnapshot('학년 병합 전');pushUndo();
    state.students.forEach(st=>{if(st.active!==false&&st.grade===old)st.grade=next;});
    const mg=(state.settings.managedGrades||[]).map(g=>g===old?next:g);
    state.settings.managedGrades=uniq(mg);
    if(state.settings.managementScope===old)state.settings.managementScope=next;
    if(ui.studentGrade===old)ui.studentGrade=next;
    if(ui.attendanceGrade===old)ui.attendanceGrade=next;
    if(ui.analyticsScope===old)ui.analyticsScope=next;
    save();toast(`${old} → ${next} 병합 완료`);ui.modal={type:'gradeManager'};render();
  };

  deleteGrade=function(g){
    const n=active().filter(st=>st.grade===g).length;
    if(!confirm(`${g} 분류를 삭제할까요?\n${n}명의 학생은 '학년 미지정'으로 남고 과거 기록은 유지됩니다.`))return;
    createSnapshot('학년 분류 삭제 전');pushUndo();
    state.students.forEach(st=>{if(st.active!==false&&st.grade===g)st.grade='';});
    state.settings.managedGrades=(state.settings.managedGrades||[]).filter(x=>x!==g);
    if(state.settings.managementScope===g)state.settings.managementScope=state.settings.adminMode?'전체':'내 담당';
    if(ui.studentGrade===g)ui.studentGrade=state.settings.adminMode?'전체':'내 담당';
    if(ui.attendanceGrade===g)ui.attendanceGrade=state.settings.adminMode?'전체':'내 담당';
    if(ui.analyticsScope===g)ui.analyticsScope=state.settings.adminMode?'전체':'내 담당';
    save();toast('학년 분류를 정리했습니다.');ui.modal={type:'gradeManager'};render();
  };

  // Preserve selected scope when a team label is renamed/deleted.
  renameTeam=function(old){
    const el=document.getElementById('teamRename'); const n=el?.value.trim();
    if(!n||n===old)return; if(allTeams().includes(n))return toast('이미 있는 팀 이름입니다.');
    pushUndo();
    const i=state.teams.indexOf(old); if(i>=0)state.teams[i]=n;
    active().forEach(s=>{s.teams=(s.teams||[]).map(t=>t===old?n:t)});
    state.settings.managedTeams=uniq((state.settings.managedTeams||[]).map(t=>t===old?n:t));
    save(); ui.modal={type:'teamEdit',team:n}; toast('팀 이름을 바꿨습니다.'); render();
  };

  deleteTeam=function(team){
    if(!confirm(`${team}을 삭제할까요? 과거 기록은 유지됩니다.`))return;
    pushUndo();
    state.teams=state.teams.filter(t=>t!==team);
    active().forEach(s=>s.teams=(s.teams||[]).filter(t=>t!==team));
    state.settings.managedTeams=(state.settings.managedTeams||[]).filter(t=>t!==team);
    save();render();
  };

  // Card-style click targets without altering the app layout.
  const style=document.createElement('style');
  style.textContent=`
    .managedScopeTitle>small{display:block;margin-top:4px;color:var(--muted,#737373);font-size:12px;font-weight:600}
    .managedScopeGrid{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px}
    .managedScopeGrid label{display:flex;align-items:center;gap:7px;min-height:44px;padding:9px 13px;border:1.5px solid #d8d5cb;border-radius:14px;background:#fff;font-weight:800;cursor:pointer}
    .managedScopeGrid label:has(input:checked){background:#ffd21f;border-color:#1f1f1f;box-shadow:0 0 0 1px #1f1f1f inset}
    .managedScopeGrid input{width:20px;height:20px;accent-color:#1f1f1f}
    html[data-theme="dark"] .managedScopeGrid label{background:var(--card,#242424);border-color:#555}
    html[data-theme="dark"] .managedScopeGrid label:has(input:checked){background:#ffd21f;color:#111;border-color:#111}
  `;
  document.head.appendChild(style);

  // Normalize old saved state without destroying selections.
  if(!state.settings.adminMode){
    state.settings.managementScope='내 담당';
    if(ui.studentGrade==='전체')ui.studentGrade='내 담당';
    if(ui.attendanceGrade==='전체')ui.attendanceGrade='내 담당';
    if(ui.analyticsScope==='전체')ui.analyticsScope='내 담당';
    if(ui.filterType==='학년'&&ui.filterValue==='전체')ui.filterValue='내 담당';
  }else if(!state.settings.managementScope || state.settings.managementScope==='내 담당'){
    state.settings.managementScope='전체';
  }
  save();
})();
