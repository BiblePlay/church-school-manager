/* v1.5.3.1 — teacher monthly birthdays only */
(function(){
  ui.teacherBirthdayMonth = Number(ui.teacherBirthdayMonth || (new Date().getMonth()+1));

  function birthdayMonthOf(value){
    const s=String(value||'').trim();
    let m=s.match(/^\d{4}[-./](\d{1,2})[-./](\d{1,2})$/);
    if(m)return Number(m[1]);
    m=s.match(/^(\d{1,2})[-./](\d{1,2})$/);
    if(m)return Number(m[1]);
    m=s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    return m?Number(m[1]):0;
  }
  function birthdayDayOf(value){
    const s=String(value||'').trim();
    let m=s.match(/^\d{4}[-./](\d{1,2})[-./](\d{1,2})$/);
    if(m)return Number(m[2]);
    m=s.match(/^(\d{1,2})[-./](\d{1,2})$/);
    if(m)return Number(m[2]);
    m=s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    return m?Number(m[2]):0;
  }
  function teacherBirthdays(month){
    return activeTeachers().filter(t=>birthdayMonthOf(t.birthday)===Number(month)).sort((a,b)=>birthdayDayOf(a.birthday)-birthdayDayOf(b.birthday)||String(a.name||'').localeCompare(String(b.name||''),'ko'));
  }

  // Teacher tab: append the same simple monthly-birthday access card used by students.
  const priorStudentsView_v1531 = studentsView;
  studentsView = function(){
    let html=priorStudentsView_v1531();
    if(ui.peopleMode==='teacher' && !html.includes('data-act="teacherBirthdayList"')){
      html += `<div class="divider"></div><div class="card birthdayAccess teacherBirthdayAccess"><div class="row"><div><div class="label">월별 생일자</div><div class="muted">교사 생일 정보에서 자동으로 월별 명단을 만듭니다.</div></div><button class="secondary nowrap" data-act="teacherBirthdayList">생일자 보기</button></div></div>`;
    }
    return html;
  };

  const priorModalHtml_v1531 = modalHtml;
  modalHtml = function(){
    if(ui.modal?.type==='teacherBirthdays'){
      const close='<button class="icon" data-act="closeModal">×</button>';
      const list=teacherBirthdays(ui.teacherBirthdayMonth);
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">교사 월별 생일자</div><div class="muted">교사 명부의 생일을 기준으로 자동 표시합니다.</div></div>${close}</div><div class="chips birthdayMonths">${Array.from({length:12},(_,i)=>i+1).map(m=>`<button class="chip ${ui.teacherBirthdayMonth===m?'active':''}" data-teacher-birthday-month="${m}">${m}월</button>`).join('')}</div><div class="birthdayList">${list.map(t=>`<button class="birthdayRow noPhoto" data-teacher-detail="${t.id}"><span><strong>${esc(t.name)}</strong><small>${birthdayDayOf(t.birthday)}일${t.role?' · '+esc(t.role):''}</small></span></button>`).join('')||'<div class="empty">이 달에 등록된 교사 생일자가 없습니다.</div>'}</div>`);
    }
    return priorModalHtml_v1531();
  };

  const priorHandleAct_v1531 = handleAct;
  handleAct = function(act,b){
    if(act==='teacherBirthdayList'){
      ui.teacherBirthdayMonth=new Date().getMonth()+1;
      ui.modal={type:'teacherBirthdays'};
      return render();
    }
    return priorHandleAct_v1531(act,b);
  };

  const priorBind_v1531 = bind;
  bind = function(){
    priorBind_v1531();
    document.querySelectorAll('[data-teacher-birthday-month]').forEach(b=>b.onclick=()=>{
      ui.teacherBirthdayMonth=Number(b.dataset.teacherBirthdayMonth);
      render();
    });
  };

  render();
})();
