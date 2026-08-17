/* v1.4.2.5 PEOPLE — student/teacher hub + one-screen student management */
(function(){
  ui.peopleMode = ui.peopleMode || 'student';

  const phoneIcon=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8c1.6 3.1 3.5 5 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.7 21 3 13.3 3 3.8c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.1Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const smsIcon=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`;

  // Top title reflects that students and teachers live in one people hub.
  const priorTopbar = topbar;
  topbar = function(){
    if(ui.tab!=='students') return priorTopbar();
    return `<div class="top recoveryTop"><div><div class="eyebrow">${displayDate()} · ${esc(state.settings.department||'교회학교')}</div><div class="title">학생 · 교사</div></div><div class="icons"><button class="icon" data-act="shareMenu" aria-label="공유">↗</button></div></div>`;
  };

  function teacherPeopleView(){
    const list=activeTeachers();
    return `<section class="peopleHeader teacherPeopleHeader"><div><small>교사 명부</small><strong>${list.length}<span>명</span></strong></div><div class="peopleHeaderMeta"><span>연락처·직함을 간단히 확인</span></div></section>
      <div class="peopleActions"><button class="primary" data-act="addTeacher">+ 교사 추가</button><button class="secondary" data-act="teacherExcelImport">Excel 가져오기</button></div>
      <div class="list peopleList teacherHubList">${list.map(t=>`<div class="teacherHubRow"><button class="teacherHubMain" data-teacher-detail="${t.id}"><span><strong>${esc(t.name)}</strong><small>${esc(t.role||'담당·직함 미지정')}${t.birthday?' · '+esc(t.birthday):''}</small></span><b>›</b></button><div class="teacherHubContact">${t.phone?`<a class="miniIconBtn yellow" href="tel:${phoneUri(t.phone)}" aria-label="${esc(t.name)} 전화">${phoneIcon}</a><a class="miniIconBtn" href="sms:${phoneUri(t.phone)}" aria-label="${esc(t.name)} 문자">${smsIcon}</a>`:'<span class="noContact">연락처 없음</span>'}</div></div>`).join('')||'<div class="empty">교사가 없습니다. 교사를 추가하거나 Excel을 가져오세요.</div>'}</div>`;
  }

  const previousStudentsView = studentsView;
  studentsView = function(){
    const tabs=`<div class="peopleSeg" role="tablist"><button class="${ui.peopleMode==='student'?'active':''}" data-people-mode="student">학생</button><button class="${ui.peopleMode==='teacher'?'active':''}" data-people-mode="teacher">교사</button></div>`;
    return tabs + (ui.peopleMode==='teacher' ? teacherPeopleView() : previousStudentsView());
  };

  function extrasText(st){return (st.extraContacts||[]).map(c=>`${c.name||''}|${c.relation||''}|${c.phone||''}`).join('\n');}
  function gradeButtons(st){
    const current=st.grade||'미지정';
    return ['미지정','4학년','5학년','6학년'].map(g=>`<button class="${current===g?'active':''}" data-quick-grade="${g}" data-id="${st.id}">${g}</button>`).join('');
  }
  function contactButtons(phone,label){
    if(!phone)return '';
    return `<div class="inlineContactIcons"><a class="miniIconBtn yellow" href="tel:${phoneUri(phone)}" aria-label="${esc(label)} 전화">${phoneIcon}</a><a class="miniIconBtn" href="sms:${phoneUri(phone)}" aria-label="${esc(label)} 문자">${smsIcon}</a></div>`;
  }

  // Existing students are managed in ONE screen. No duplicate detail -> edit screen.
  const priorModal = modalHtml;
  modalHtml = function(){
    if(ui.modal?.type==='detail'){
      const st=studentById(ui.modal.id); if(!st)return '';
      v14EnsureStudent(st);
      const close=`<button class="icon" data-act="closeModal">×</button>`;
      const logs=[...(st.visitLogs||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      const attendanceHistory=Object.keys(state.sessions||{}).sort().reverse().filter(k=>state.sessions[k]?.attendance?.[st.id]).slice(0,10);
      return modal(`<div class="modalTitleRow studentManageHead"><div class="detailHead">${st.photo?avatar(st,'detailPhoto'):'<div class="detailPhoto photoPlaceholder">사진</div>'}<div><div class="titleSmall">${esc(st.name)}</div><div class="muted">${esc(st.grade||'학년 미지정')}${st.assignedTeacher?' · '+esc(st.assignedTeacher):''}</div></div></div>${close}</div>
        <div class="detailActions"><button class="secondary" data-act="photo" data-id="${st.id}">${st.photo?'사진 변경':'사진 추가'}</button></div>

        <section class="manageCard strongCard"><div class="manageCardTitle"><strong>기본 정보</strong><small>이 화면에서 바로 수정하고 저장합니다.</small></div>
          <label class="fieldLabel compactLabel">이름<input id="dName" class="input" value="${attr(st.name||'')}"></label>
          <div class="quickGradeCard inlineGrade"><div><strong>학년</strong></div><div class="quickGradeButtons">${gradeButtons(st)}</div></div>
          <div class="formGrid"><label class="fieldLabel">성별<select id="dGender" class="input"><option ${st.gender==='미지정'||!st.gender?'selected':''}>미지정</option><option ${st.gender==='남'?'selected':''}>남</option><option ${st.gender==='여'?'selected':''}>여</option></select></label><label class="fieldLabel">생일<input id="dBirthday" class="input" type="date" value="${attr(st.birthday||'')}"></label></div>
          <label class="fieldLabel">담당교사<input id="dAssignedTeacher" class="input" placeholder="예: 김선생" value="${attr(st.assignedTeacher||'')}"></label>
          <div class="formGrid"><label class="fieldLabel">부모 신앙<select id="dParentFaith" class="input"><option ${st.parentFaith==='미기재'||!st.parentFaith?'selected':''}>미기재</option><option ${st.parentFaith==='신자'?'selected':''}>신자</option><option ${st.parentFaith==='비신자'?'selected':''}>비신자</option></select></label><label class="fieldLabel">다문화<select id="dMulticultural" class="input"><option value="no" ${!st.multicultural?'selected':''}>미체크</option><option value="yes" ${st.multicultural?'selected':''}>다문화</option></select></label></div>
        </section>

        <section class="manageCard"><div class="manageCardTitle"><strong>연락처</strong><small>학생·부모·친척 연락처를 여기서 관리합니다.</small></div>
          <div class="contactEditRow"><label class="fieldLabel grow">학생 전화<input id="dPhone" class="input" placeholder="010-0000-0000" value="${attr(st.phone||'')}"></label>${contactButtons(st.phone,st.name)}</div>
          <div class="contactGroup"><div class="formGrid"><input id="dParentName" class="input" placeholder="보호자 1 이름" value="${attr(st.parentName||'')}"><input id="dParentRelation" class="input" placeholder="관계" value="${attr(st.parentRelation||'')}"></div><div class="contactEditRow"><input id="dParentPhone" class="input grow" placeholder="보호자 1 전화번호" value="${attr(st.parentPhone||'')}">${contactButtons(st.parentPhone,st.parentName||'보호자 1')}</div></div>
          <div class="contactGroup"><div class="formGrid"><input id="dParent2Name" class="input" placeholder="보호자 2 이름" value="${attr(st.parent2Name||'')}"><input id="dParent2Relation" class="input" placeholder="관계" value="${attr(st.parent2Relation||'')}"></div><div class="contactEditRow"><input id="dParent2Phone" class="input grow" placeholder="보호자 2 전화번호" value="${attr(st.parent2Phone||'')}">${contactButtons(st.parent2Phone,st.parent2Name||'보호자 2')}</div></div>
          <label class="fieldLabel">기타 가족·친척 연락처<textarea id="dExtraContacts" class="input textarea" placeholder="한 줄에 이름|관계|전화번호\n예: 김OO|외할머니|010-1234-5678">${esc(extrasText(st))}</textarea></label>
        </section>

        <details class="manageCard extraDetails"><summary>추가 정보 <span>학교 · 주소 · 형제관계 · 분류 · 메모</span></summary><div class="detailsBody"><input id="dSchool" class="input" placeholder="학교" value="${attr(st.school||'')}"><input id="dSiblings" class="input" placeholder="형제관계" value="${attr(st.siblings||'')}"><input id="dAddress" class="input" placeholder="주소" value="${attr(st.address||'')}"><input id="dTags" class="input" placeholder="기타 분류 · 쉼표로 구분" value="${attr((st.tags||[]).join(', '))}"><textarea id="dMemo" class="input textarea" placeholder="학생 기본 메모">${esc(st.memo||'')}</textarea></div></details>

        <button class="primary fullBtn studentSaveBar" data-act="saveStudentInline" data-id="${st.id}">학생 정보 저장</button>

        <div class="visitBox recoveryVisit"><div class="visitBoxHead"><div><strong>심방 · 연락 기록</strong><small>작성일이 자동으로 쌓입니다.</small></div><button class="quickVisit" data-act="quickVisit" data-id="${st.id}">오늘 심방</button></div><div class="visitEntry"><input id="visitDate" class="input" type="date" value="${todayKey()}"><textarea id="visitMemo" class="input textarea" placeholder="통화, 문자, 심방 내용"></textarea><button class="primary" data-act="addVisit" data-id="${st.id}">기록 추가</button></div>${logs.map(x=>`<div class="visitLog"><div><strong>${esc(x.date)}</strong><p>${esc(x.note||'')}</p></div><button data-act="deleteVisit" data-id="${st.id}" data-visit="${x.id}">삭제</button></div>`).join('')||'<div class="visitEmpty">아직 심방/연락 기록이 없습니다.</div>'}</div>
        <div class="card"><div class="sectionTitle">최근 출석</div>${attendanceHistory.map(k=>`<div class="history"><span><strong>${displayDate(k)}</strong><small>${esc(att(st,k).memo||'')}</small></span><strong>${statusLabel(att(st,k).status)}</strong></div>`).join('')||'<div class="muted">출석 기록 없음</div>'}</div>
        <div class="dangerZone studentDanger"><strong>명단 관리</strong><small>잘못 등록한 학생은 여기서 정리합니다.</small><button class="secondary fullBtn" data-act="deactivateStudent" data-id="${st.id}">명단에서 제외</button><button class="danger fullBtn" data-act="deleteStudentHard" data-id="${st.id}">학생 완전 삭제</button></div>`);
    }
    return priorModal();
  };

  function saveStudentInline(id){
    const st=studentById(id); if(!st)return toast('학생을 찾지 못했습니다.');
    const name=document.getElementById('dName')?.value.trim(); if(!name)return toast('학생 이름을 입력해 주세요.');
    pushUndo();
    const extras=String(document.getElementById('dExtraContacts')?.value||'').split(/\n+/).map(line=>{const [name,relation,phone]=line.split('|').map(x=>(x||'').trim());return {name,relation,phone};}).filter(x=>x.phone);
    Object.assign(st,{
      name,
      gender:document.getElementById('dGender')?.value||'미지정',
      birthday:document.getElementById('dBirthday')?.value||'',
      assignedTeacher:document.getElementById('dAssignedTeacher')?.value.trim()||'',
      parentFaith:document.getElementById('dParentFaith')?.value||'미기재',
      multicultural:document.getElementById('dMulticultural')?.value==='yes',
      phone:document.getElementById('dPhone')?.value.trim()||'',
      parentName:document.getElementById('dParentName')?.value.trim()||'',
      parentRelation:document.getElementById('dParentRelation')?.value.trim()||'',
      parentPhone:document.getElementById('dParentPhone')?.value.trim()||'',
      parent2Name:document.getElementById('dParent2Name')?.value.trim()||'',
      parent2Relation:document.getElementById('dParent2Relation')?.value.trim()||'',
      parent2Phone:document.getElementById('dParent2Phone')?.value.trim()||'',
      extraContacts:extras,
      school:document.getElementById('dSchool')?.value.trim()||'',
      siblings:document.getElementById('dSiblings')?.value.trim()||'',
      address:document.getElementById('dAddress')?.value.trim()||'',
      tags:String(document.getElementById('dTags')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),
      memo:document.getElementById('dMemo')?.value.trim()||'',
      active:true
    });
    save(); toast(`${st.name} 학생 정보를 저장했습니다.`); render();
  }

  const previousHandleAct = handleAct;
  handleAct = function(act,b){
    if(act==='saveStudentInline') return saveStudentInline(b.dataset.id);
    return previousHandleAct(act,b);
  };

  const previousBind = bind;
  bind = function(){
    previousBind();
    document.querySelectorAll('[data-people-mode]').forEach(b=>b.onclick=()=>{ui.peopleMode=b.dataset.peopleMode;render();});
  };

  render();
})();
