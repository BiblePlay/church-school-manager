/* v1.5.3.18 — default grade / visible-scope stabilization.
   - 담당 선생님 모드는 접근 제한이 아니다.
   - 등록된 모든 학년은 각 화면의 "보기" 메뉴에서 선택할 수 있다.
   - 설정의 담당 학년/팀은 복수 체크 가능하다.
   - 담당 선생님은 저장된 기본 학년으로 시작한다.
   - 전체 관리자는 담당 학년 선택을 요구하지 않고 전체로 시작한다.
*/
(function(){
  'use strict';

  function realGrades(){return (typeof grades==='function'?grades():[]).filter(Boolean);}
  function validDefaultGrade(){
    const gs=realGrades(),managed=(state.settings.managedGrades||[]).filter(g=>gs.includes(g));
    const old=state.settings.managementScope;
    if(managed.includes(old))return old;
    return managed[0]||'전체';
  }

  if(typeof scopeOptionsWithManaged==='function'){
    scopeOptionsWithManaged=function(){return ['전체',...realGrades()];};
  }

  // 앱을 다시 열었을 때 기본 시작 범위를 네 화면에 동일하게 맞춘다.
  // 전체 관리자는 항상 '전체', 담당 선생님은 저장한 기본 학년으로 시작한다.
  if(state.settings.adminMode){
    state.settings.managementScope='전체';
    ui.attendanceGrade='전체';
    ui.analyticsScope='전체';
    ui.studentGrade='전체';
    ui.filterType='학년';
    ui.filterValue='전체';
  }else{
    const start=validDefaultGrade();
    state.settings.managementScope=start;
    ui.attendanceGrade=start;
    ui.analyticsScope=start;
    ui.studentGrade=start;
    ui.filterType='학년';
    ui.filterValue=start;
  }

  const priorSettingsView15311=settingsView;
  settingsView=function(){
    let html=priorSettingsView15311();
    html=html.replace(/<label class="fieldLabel">기본 관리 범위<select id="managementScope"[\s\S]*?<\/select><\/label>/,
      '<select id="managementScope" style="display:none" aria-hidden="true"><option>전체</option></select>');
    html=html.replace('내 담당 학년 <div class="managedGradeGrid">',
      '내 담당 학년 · 복수 선택 가능 <div class="managedGradeHelp">담당 선생님은 기본으로 시작할 학년을 체크합니다. 여러 학년을 체크하면 마지막으로 체크한 학년을 기본으로 시작하며, 다른 학년은 각 화면의 ‘보기’에서 언제든 선택할 수 있습니다.</div><div class="managedGradeGrid">');
    html=html.replace('내 담당 팀 · 선택 <div class="managedGradeGrid">',
      '내 담당 팀 · 복수 선택 가능 <div class="managedGradeGrid">');
    html=html.replace('내 담당 학년·팀만 기본 표시','내 담당 학년으로 기본 시작 · 전체 학년 선택 가능');
    return html;
  };

  saveSettings=function(){
    const dep=document.getElementById('department').value.trim();
    const nums=document.getElementById('amounts').value.split(',').map(v=>Number(v.trim())).filter(v=>Number.isFinite(v)&&v>0).slice(0,4);
    if(nums.length<1)return toast('달란트 금액을 하나 이상 입력해 주세요.');
    const adminMode=(document.querySelector('input[name="adminMode"]:checked')?.value||'admin')==='admin';
    const managedGrades=[...document.querySelectorAll('[data-managed-grade]:checked')].map(x=>x.dataset.managedGrade);
    const managedTeams=[...document.querySelectorAll('[data-managed-team]:checked')].map(x=>x.dataset.managedTeam);
    const oldDefault=state.settings.managementScope;
    const clicked=ui.settingsDefaultGrade;
    const preferred=(clicked&&managedGrades.includes(clicked))
      ? clicked
      : (managedGrades.includes(oldDefault)?oldDefault:(managedGrades[0]||'전체'));
    const defaultScope=adminMode?'전체':preferred;

    state.settings.department=dep||'교회학교';
    state.settings.adminMode=adminMode;
    state.settings.managementScope=defaultScope;
    state.settings.amounts=nums;
    state.settings.managedGrades=managedGrades;
    state.settings.managedTeams=managedTeams;
    const la=document.getElementById('longAbsenceDays');if(la)state.settings.longAbsenceDays=Number(la.value)||60;

    ui.attendanceGrade=defaultScope;
    ui.analyticsScope=defaultScope;
    ui.studentGrade=defaultScope;
    ui.filterType='학년';
    ui.filterValue=defaultScope;
    ui.scopeMenu=null;
    ui.settingsDefaultGrade=null;
    save();
    toast(adminMode?'전체 관리자 모드로 저장했습니다.':(defaultScope==='전체'?'담당 학년 제한 없이 저장했습니다.':`${defaultScope}을 기본 시작 학년으로 저장했습니다.`));
    render();
  };

  const priorBind15311=bind;
  bind=function(){
    priorBind15311();
    document.querySelectorAll('[data-managed-grade]').forEach(cb=>{
      const paint=()=>{
        const label=cb.closest('label');if(!label)return;
        label.style.background=cb.checked?'#ffd326':'';
        label.style.borderColor=cb.checked?'#171717':'';
        label.style.color=cb.checked?'#171717':'';
        label.style.fontWeight=cb.checked?'800':'';
      };
      paint();
      cb.addEventListener('change',()=>{if(cb.checked)ui.settingsDefaultGrade=cb.dataset.managedGrade;paint();});
    });
    document.querySelectorAll('[data-managed-team]').forEach(cb=>{
      const paint=()=>{
        const label=cb.closest('label');if(!label)return;
        label.style.background=cb.checked?'#ffd326':'';
        label.style.borderColor=cb.checked?'#171717':'';
        label.style.color=cb.checked?'#171717':'';
        label.style.fontWeight=cb.checked?'800':'';
      };
      paint();cb.addEventListener('change',paint);
    });
  };
})();
