/* v1.5.3.6 — managed scope default selection fix
   Only affects which scope is selected by default after Settings save / app reload.
   Admin permissions remain unchanged: 전체 관리자 can still tap 전체 at any time.
*/
(function(){
  'use strict';

  function uniq(arr){ return [...new Set((arr||[]).filter(Boolean))]; }
  function managedGrades(){ return uniq(state.settings.managedGrades||[]); }
  function managedTeams(){ return uniq(state.settings.managedTeams||[]); }

  // One grade only -> show that actual grade as the yellow default.
  // Multiple grades and/or combined grade+team -> "내 담당" represents the union.
  // Team only: one team can be shown directly in Talent; other student screens use "내 담당".
  function preferredStudentScope(){
    const gs=managedGrades(), ts=managedTeams();
    if(gs.length===1 && ts.length===0) return gs[0];
    if(gs.length || ts.length) return '내 담당';
    return '전체';
  }
  function applyManagedDefaults(){
    const gs=managedGrades(), ts=managedTeams();
    const scope=preferredStudentScope();

    ui.attendanceGrade=scope;
    ui.analyticsScope=scope;
    ui.studentGrade=scope;
    ui.studentQuickGrade=scope;

    if(gs.length===0 && ts.length===1){
      ui.filterType='팀';
      ui.filterValue=ts[0];
    }else if(gs.length===0 && ts.length>1){
      ui.filterType='팀';
      ui.filterValue='내 담당';
    }else{
      ui.filterType='학년';
      ui.filterValue=scope;
    }
  }

  // Talent team filter also understands "내 담당" when several managed teams are selected.
  const priorFilterOptions_v1536=filterOptions;
  filterOptions=function(){
    if(ui.filterType!=='팀') return priorFilterOptions_v1536();
    const teams=state.settings.adminMode?allTeams():managedTeams();
    const hasManaged=managedTeams().length || managedGrades().length;
    return ['전체',...(hasManaged?['내 담당']:[]),...teams.filter(t=>t!=='내 담당')];
  };
  const priorFilterStudents_v1536=filterStudents;
  filterStudents=function(){
    if(ui.filterType==='팀' && ui.filterValue==='내 담당'){
      return sortStudents(scopedStudents('내 담당'),state.settings.talentSort||'name');
    }
    return priorFilterStudents_v1536();
  };

  // Student list's old quick-grade patch was independent from Settings and hard-coded.
  // Make it understand 내 담당 and actual grade labels without touching list layout.
  const priorV14Filtered_v1536=v14FilteredStudents;
  v14FilteredStudents=function(){
    const q=ui.studentQuickGrade||'전체';
    if(q!=='내 담당') return priorV14Filtered_v1536();
    ui.studentQuickGrade='전체';
    let arr;
    try{ arr=priorV14Filtered_v1536(); }
    finally{ ui.studentQuickGrade=q; }
    const allowed=new Set(scopedStudents('내 담당').map(s=>s.id));
    return arr.filter(s=>allowed.has(s.id));
  };

  const priorStudentsView_v1536=studentsView;
  studentsView=function(){
    let html=priorStudentsView_v1536();
    if(ui.peopleMode==='teacher') return html;
    const gs=grades();
    const hasManaged=managedGrades().length || managedTeams().length;
    const opts=['전체',...(hasManaged?['내 담당']:[]),...gs,'미지정'];
    const mineCount=scopedStudents('내 담당').length;
    const countOf=(g)=>g==='전체'?active().length:g==='내 담당'?mineCount:g==='미지정'?active().filter(s=>!s.grade).length:active().filter(s=>s.grade===g).length;
    const strip=`<div class="chips gradeQuickStrip">${opts.map(g=>`<button class="chip ${ui.studentQuickGrade===g?'active':''}" data-student-quick-grade="${attr(g)}">${esc(g)} ${countOf(g)}</button>`).join('')}</div>`;
    return html.replace(/<div class="chips gradeQuickStrip">[\s\S]*?<\/div>/,strip);
  };

  // Preserve all existing settings behavior, but use managed grades/teams as the UI default
  // even when the user has 전체 관리자 permissions.
  saveSettings=function(){
    const dep=document.getElementById('department')?.value.trim()||'';
    const nums=(document.getElementById('amounts')?.value||'').split(',').map(v=>Number(v.trim())).filter(v=>Number.isFinite(v)&&v>0).slice(0,4);
    if(nums.length<1)return toast('달란트 금액을 하나 이상 입력해 주세요.');
    const adminMode=(document.querySelector('input[name="adminMode"]:checked')?.value||'admin')==='admin';
    const gs=[...document.querySelectorAll('[data-managed-grade]:checked')].map(x=>x.dataset.managedGrade);
    const ts=[...document.querySelectorAll('[data-managed-team]:checked')].map(x=>x.dataset.managedTeam);
    if(!adminMode && !gs.length && !ts.length){
      return toast('담당 선생님 모드에서는 담당 학년 또는 담당 팀을 하나 이상 선택해 주세요.');
    }
    state.settings.department=dep||'교회학교';
    state.settings.adminMode=adminMode;
    // Keep legacy compatibility: this is permission scope, not the visible default chip.
    state.settings.managementScope=adminMode?'전체':'내 담당';
    state.settings.amounts=nums;
    state.settings.managedGrades=uniq(gs);
    state.settings.managedTeams=uniq(ts);
    const la=document.getElementById('longAbsenceDays');
    if(la)state.settings.longAbsenceDays=Number(la.value)||60;
    applyManagedDefaults();
    save();toast('설정을 저장했습니다. 담당 범위를 기본 화면에 적용했습니다.');render();
  };

  // On each fresh app load, start from the saved managed scope.
  // Manual taps after loading are not overridden.
  applyManagedDefaults();
})();
