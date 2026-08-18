/* v1.5.3.11 — default grade sync only.
   Scope: settings/default grade consistency across Talent, Attendance, Records, Students.
   Does NOT change attendance records, rate sorting, long-absence ordering, talent logic, Excel, or detail data.
*/
(function(){
  'use strict';

  function realGrades(){ return (typeof grades==='function'?grades():[]).filter(Boolean); }
  function savedDefaultGrade(){
    const gs=realGrades();
    const managed=(state.settings.managedGrades||[]).filter(g=>gs.includes(g));
    if(managed.length) return managed[0];
    const s=state.settings.managementScope;
    return gs.includes(s)?s:(gs[0]||'전체');
  }

  // Remove the ambiguous "내 담당" chip from ordinary grade filter rows.
  if(typeof scopeOptionsWithManaged==='function'){
    scopeOptionsWithManaged=function(){ return ['전체',...realGrades()]; };
  }

  // Keep existing settings UI, but hide the duplicate visible "기본 관리 범위" selector.
  // The selected 담당 학년 becomes the single source of the default grade.
  const priorSettingsView15311=settingsView;
  settingsView=function(){
    let html=priorSettingsView15311();
    html=html.replace(/<label class="fieldLabel">기본 관리 범위<select id="managementScope"[\s\S]*?<\/select><\/label>/,'<select id="managementScope" style="display:none" aria-hidden="true"><option>전체</option></select>');
    return html;
  };

  // Save settings without forcing the legacy "내 담당" pseudo-scope.
  saveSettings=function(){
    const dep=document.getElementById('department').value.trim();
    const nums=document.getElementById('amounts').value.split(',').map(v=>Number(v.trim())).filter(v=>Number.isFinite(v)&&v>0).slice(0,4);
    if(nums.length<1)return toast('달란트 금액을 하나 이상 입력해 주세요.');
    const adminMode=(document.querySelector('input[name="adminMode"]:checked')?.value||'admin')==='admin';
    const managedGrades=[...document.querySelectorAll('[data-managed-grade]:checked')].map(x=>x.dataset.managedGrade);
    const managedTeams=[...document.querySelectorAll('[data-managed-team]:checked')].map(x=>x.dataset.managedTeam);
    if(!managedGrades.length)return toast('기본으로 볼 학년을 하나 이상 선택해 주세요.');
    const grade=managedGrades[0];
    state.settings.department=dep||'교회학교';
    state.settings.adminMode=adminMode;
    state.settings.managementScope=grade;
    state.settings.amounts=nums;
    state.settings.managedGrades=managedGrades;
    state.settings.managedTeams=managedTeams;
    const la=document.getElementById('longAbsenceDays'); if(la)state.settings.longAbsenceDays=Number(la.value)||60;

    // The same default grade is applied once to the four student-facing tabs.
    ui.attendanceGrade=grade;
    ui.analyticsScope=grade;
    ui.studentGrade=grade;
    ui.filterType='학년';
    ui.filterValue=grade;
    save();
    toast(`${grade}을 기본 학년으로 저장했습니다.`);
    render();
  };

  // Make checked grade cards visually obvious in Settings without changing global CSS.
  const priorBind15311=bind;
  bind=function(){
    priorBind15311();
    document.querySelectorAll('[data-managed-grade]').forEach(cb=>{
      const paint=()=>{
        const label=cb.closest('label'); if(!label)return;
        label.style.background=cb.checked?'#ffd326':'';
        label.style.borderColor=cb.checked?'#171717':'';
        label.style.color=cb.checked?'#171717':'';
        label.style.fontWeight=cb.checked?'800':'';
      };
      paint();
      cb.addEventListener('change',paint);
    });
  };
})();
