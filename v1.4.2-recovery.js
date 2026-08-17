/* v1.4.2 RECOVERY — UI freeze + intuitive CRUD */
(function(){
  // Keep data model compatible, enrich teacher fields only when missing.
  state.students.forEach(st=>{ if(st.active===undefined)st.active=true; });
  state.teachers.forEach(t=>{
    if(t.active===undefined)t.active=true;
    if(!t.teacherType)t.teacherType='정교사';
    if(t.officialIncluded===undefined)t.officialIncluded=true;
    if(!t.leave)t.leave={enabled:false,reason:'',start:'',end:''};
  });
  save();

  // Simple, stable top bar. No large black/yellow slab.
  topbar=function(){
    const title={talent:'달란트',attendance:'출석',records:'기록',students:'학생',settings:'설정'}[ui.tab];
    return `<div class="top recoveryTop"><div><div class="eyebrow">${displayDate()} · ${esc(state.settings.department||'교회학교')}</div><div class="title">${title}</div></div><div class="icons">${['talent','attendance'].includes(ui.tab)?`<button class="icon historyIcon" data-act="undo" ${ui.undo.length?'':'disabled'} aria-label="실행 취소">${historyArrow('left')}</button><button class="icon historyIcon" data-act="redo" ${ui.redo.length?'':'disabled'} aria-label="다시 실행">${historyArrow('right')}</button>`:''}<button class="icon" data-act="shareMenu" aria-label="공유">↗</button></div></div>`;
  };

  // Student list: clean list + clear actions, keep strong contrast only in small accents.
  const _oldStudentsView=studentsView;
  studentsView=function(){
    let list=v14FilteredStudents();
    const total=active().length;
    const unknown=active().filter(s=>!s.grade).length;
    const filterCount=v14AppliedFilterCount();
    return `<section class="peopleHeader"><div><small>학생 명부</small><strong>${total}<span>명</span></strong></div><div class="peopleHeaderMeta"><span>학년 미지정 <b>${unknown}</b></span><span>필터 적용 <b>${filterCount}</b></span></div></section>
      <div class="peopleActions"><button class="primary" data-act="addStudent">+ 학생 추가</button><button class="secondary" data-act="studentFilter">필터</button><button class="secondary" data-act="manageStudentList">명단 정리</button></div>
      <div class="sortBar recoverySort"><span>정렬</span>${[['name','가나다'],['grade','학년'],['custom','사용자']].map(([v,l])=>`<button class="sortBtn ${state.settings.studentSort===v?'active':''}" data-stu-sort="${v}">${l}</button>`).join('')}</div>
      ${filterCount?`<div class="filterSummary recoveryFilter"><strong>${filterCount}개 조건 적용</strong><span>필요한 학생만 표시 중</span><button data-act="clearStudentFilters">해제</button></div>`:''}
      <div class="list peopleList">${list.map(st=>{const lv=v14LastVisit(st);return `<button class="studentRow ${st.photo?'hasPhoto':'noPhoto'}" data-detail="${st.id}">${avatarCell(st)}<span><span class="studentName">${esc(st.name)}</span><span class="studentMeta">${esc(st.grade||'학년 미지정')}${st.assignedTeacher?' · '+esc(st.assignedTeacher):''}</span>${lv?`<span class="visitMini">최근 연락 ${esc(lv.date.slice(5).replace('-','/'))}</span>`:''}</span><span class="chevron">›</span></button>`}).join('')||'<div class="empty">학생이 없습니다. 학생 추가 또는 Excel 가져오기로 시작하세요.</div>'}</div>
      <div class="quickAccessRow"><button class="secondary" data-act="birthdayList">월별 생일자</button><button class="secondary" data-act="manageTeachers">교사 명부</button></div>`;
  };

  // Teacher list/detail/form are intentionally separated: list -> brief detail -> edit.
  const prevModalHtml=modalHtml;
  modalHtml=function(){
    if(!ui.modal)return '';
    const closeDefault=`<button class="icon" data-act="closeModal">×</button>`;

    if(ui.modal.type==='teachers'){
      const list=activeTeachers();
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">교사 명부</div><div class="muted">이름을 누르면 연락처와 기본정보를 확인합니다.</div></div>${closeDefault}</div>
        <div class="peopleActions modalPeopleActions"><button class="primary" data-act="addTeacher">+ 교사 추가</button><button class="secondary" data-act="teacherExcelImport">Excel 가져오기</button></div>
        <div class="list teacherCleanList">${list.map(t=>`<button class="teacherCleanRow" data-teacher-detail="${t.id}"><span><strong>${esc(t.name)}</strong><small>${esc(t.role||'담당·직함 미지정')}${t.birthday?' · '+esc(t.birthday):''}</small></span><span class="teacherRight">${esc(t.phone||'연락처 없음')}<b>›</b></span></button>`).join('')||'<div class="empty">교사가 없습니다. 교사 추가 또는 Excel 가져오기로 시작하세요.</div>'}</div>`);
    }

    if(ui.modal.type==='teacherDetail'){
      const t=teacherById(ui.modal.id); if(!t)return '';
      v14EnsureTeacher(t);
      const history=Object.keys(state.teacherSessions||{}).sort().reverse().filter(k=>teacherAtt(t,k).status!=='unset').slice(0,12);
      const back=`<button class="icon" data-act="backTeachers" aria-label="교사 명부로 돌아가기">‹</button>`;
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${esc(t.name)}</div><div class="muted">${esc(t.role||'담당·직함 미지정')} · ${esc(t.teacherType||'정교사')}</div></div>${back}</div>
        ${t.phone?`<div class="contactBar"><a class="primary linkBtn" href="tel:${phoneUri(t.phone)}">전화</a><a class="secondary linkBtn" href="sms:${phoneUri(t.phone)}">문자</a></div>`:''}
        <div class="detailActions"><button class="primary fullBtn" data-act="editTeacherFromDetail" data-id="${t.id}">정보 수정</button></div>
        <div class="card kvCard">${kv('생일',t.birthday||'미기재')}${kv('전화번호',t.phone||'미기재')}${kv('담당·직함',t.role||'미지정')}${kv('교사 분류',t.teacherType||'정교사')}${kv('공식 명단',t.officialIncluded===false?'제외':'포함')}${kv('비고',t.memo||'')}</div>
        ${t.leave?.enabled?`<div class="notice">장기 부재 · ${esc(t.leave.reason||'사유 미기재')}${t.leave.start?' · '+esc(t.leave.start):''}${t.leave.end?' ~ '+esc(t.leave.end):''}</div>`:''}
        <div class="card"><div class="sectionTitle">최근 교사 출석</div>${history.map(k=>`<div class="history"><span><strong>${displayDate(k)}</strong><small>${esc(teacherAtt(t,k).reason||'')}</small></span><strong>${teacherStatusLabel(teacherAtt(t,k).status)}</strong></div>`).join('')||'<div class="muted">출석 기록 없음</div>'}</div>`);
    }

    if(ui.modal.type==='teacherForm'){
      const t=ui.modal.id?teacherById(ui.modal.id):{name:'',role:'',birthday:'',phone:'',emergencyPhone:'',memo:'',teacherType:'정교사',officialIncluded:true,leave:{enabled:false,reason:'',start:'',end:''}};
      v14EnsureTeacher(t);
      const backAct=ui.modal.id?'backTeacherDetail':'backTeachers';
      const back=`<button class="icon" data-act="${backAct}" data-id="${t.id||''}" aria-label="뒤로">‹</button>`;
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${ui.modal.id?'교사 정보 수정':'교사 추가'}</div><div class="muted">목록에 보이는 정보도 여기에서 직접 바꿀 수 있습니다.</div></div>${back}</div>
        <div class="form recoveryForm">
          <label class="fieldLabel">이름 *<input id="tName" class="input" placeholder="이름" value="${attr(t.name||'')}"></label>
          <label class="fieldLabel">담당 · 직함<input id="tRole" class="input" placeholder="예: 총무, 서기, 찬양팀(피아노)" value="${attr(t.role||'')}"></label>
          <label class="fieldLabel">교사 분류<select id="tType" class="input">${['정교사','청년교사','양육교사','임원','보조교사','교역자','스태프','기타'].map(v=>`<option ${t.teacherType===v?'selected':''}>${v}</option>`).join('')}</select></label>
          <label class="fieldLabel">생일<input id="tBirthday" class="input" type="text" placeholder="예: 3월 15일 또는 1985-03-15" value="${attr(t.birthday||'')}"></label>
          <label class="fieldLabel">전화번호<input id="tPhone" class="input" placeholder="010-0000-0000" value="${attr(t.phone||'')}"></label>
          <label class="fieldLabel">비상 연락처 · 선택<input id="tEmergencyPhone" class="input" value="${attr(t.emergencyPhone||'')}"></label>
          <label class="checkLine"><input id="tOfficial" type="checkbox" ${t.officialIncluded!==false?'checked':''}> 공식 명단에 포함</label>
          <label class="fieldLabel">비고<textarea id="tMemo" class="input textarea" placeholder="추가 메모">${esc(t.memo||'')}</textarea></label>
          <div class="sectionMiniTitle">장기 부재</div>
          <label class="checkLine"><input id="tLeaveEnabled" type="checkbox" ${t.leave?.enabled?'checked':''}> 출석 대상에서 제외</label>
          <input id="tLeaveReason" class="input" placeholder="군복무 / 장기출장 / 휴직 / 해외체류 / 기타" value="${attr(t.leave?.reason||'')}">
          <div class="formGrid"><label class="fieldLabel">시작<input id="tLeaveStart" class="input" type="date" value="${attr(t.leave?.start||'')}"></label><label class="fieldLabel">종료 · 선택<input id="tLeaveEnd" class="input" type="date" value="${attr(t.leave?.end||'')}"></label></div>
          <button class="primary fullBtn" data-act="saveTeacher" data-id="${t.id||''}">${ui.modal.id?'변경사항 저장':'교사 추가'}</button>
          ${ui.modal.id?`<div class="dangerZone"><strong>명단 관리</strong><button class="secondary fullBtn" data-act="deactivateTeacher" data-id="${t.id}">명단에서 제외</button><button class="danger fullBtn" data-act="deleteTeacher" data-id="${t.id}">교사 완전 삭제</button></div>`:''}
        </div>`);
    }

    // Student form: keep all existing fields, add permanent delete in same management screen.
    if(ui.modal.type==='studentForm'){
      const st=ui.modal.id?studentById(ui.modal.id):{name:'',grade:'',gender:'미지정',birthday:'',phone:'',parentName:'',parentRelation:'',parentPhone:'',parent2Name:'',parent2Relation:'',parent2Phone:'',school:'',siblings:'',address:'',memo:'',assignedTeacher:'',parentFaith:'미기재',multicultural:false,tags:[],extraContacts:[]};
      v14EnsureStudent(st);
      const extras=(st.extraContacts||[]).map(c=>`${c.name||''}|${c.relation||''}|${c.phone||''}`).join('\n');
      const back=`<button class="icon" data-act="${ui.modal.id?'backStudentDetail':'closeModal'}" data-id="${st.id||''}" aria-label="뒤로">‹</button>`;
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${ui.modal.id?'학생 정보 수정':'학생 추가'}</div><div class="muted">처음에는 이름과 학년만 입력해도 됩니다.</div></div>${back}</div>
        <div class="form recoveryForm"><div class="studentPhotoEdit">${st.photo?avatar(st,'detailPhoto'):'<div class="photoPlaceholder">사진</div>'}<button class="secondary" data-act="photo" data-id="${st.id||''}" ${st.id?'':'disabled'}>${st.photo?'사진 변경':'사진 추가'}</button></div>
        <div class="formGrid"><label class="fieldLabel">이름 *<input id="fName" class="input" value="${attr(st.name||'')}"></label><label class="fieldLabel">학년<input id="fGrade" class="input" placeholder="예: 4학년" value="${attr(st.grade||'')}"></label></div>
        <div class="formGrid"><label class="fieldLabel">성별<select id="fGender" class="input"><option ${!st.gender||st.gender==='미지정'?'selected':''}>미지정</option><option ${st.gender==='남'?'selected':''}>남</option><option ${st.gender==='여'?'selected':''}>여</option></select></label><label class="fieldLabel">생일<input id="fBirthday" class="input" type="date" value="${attr(st.birthday||'')}"></label></div>
        <label class="fieldLabel">담당교사<input id="fAssignedTeacher" class="input" value="${attr(st.assignedTeacher||'')}"></label>
        <div class="formGrid"><label class="fieldLabel">부모 신앙<select id="fParentFaith" class="input"><option ${st.parentFaith==='미기재'?'selected':''}>미기재</option><option ${st.parentFaith==='신자'?'selected':''}>신자</option><option ${st.parentFaith==='비신자'?'selected':''}>비신자</option></select></label><label class="fieldLabel">다문화<select id="fMulticultural" class="input"><option value="no" ${!st.multicultural?'selected':''}>미체크</option><option value="yes" ${st.multicultural?'selected':''}>다문화</option></select></label></div>
        <label class="fieldLabel">기타 분류<input id="fTags" class="input" placeholder="쉼표로 구분" value="${attr((st.tags||[]).join(', '))}"></label>
        <div class="sectionMiniTitle">연락처</div><label class="fieldLabel">학생 전화<input id="fPhone" class="input" value="${attr(st.phone||'')}"></label>
        <div class="formGrid"><input id="fParentName" class="input" placeholder="보호자 1 이름" value="${attr(st.parentName||'')}"><input id="fParentRelation" class="input" placeholder="관계" value="${attr(st.parentRelation||'')}"></div><input id="fParentPhone" class="input" placeholder="보호자 1 전화" value="${attr(st.parentPhone||'')}">
        <div class="formGrid"><input id="fParent2Name" class="input" placeholder="보호자 2 이름" value="${attr(st.parent2Name||'')}"><input id="fParent2Relation" class="input" placeholder="관계" value="${attr(st.parent2Relation||'')}"></div><input id="fParent2Phone" class="input" placeholder="보호자 2 전화" value="${attr(st.parent2Phone||'')}">
        <label class="fieldLabel">기타 가족·친척 연락처<textarea id="fExtraContacts" class="input textarea" placeholder="이름|관계|전화번호">${esc(extras)}</textarea></label>
        <div class="sectionMiniTitle">추가 정보</div><input id="fSchool" class="input" placeholder="학교" value="${attr(st.school||'')}"><input id="fSiblings" class="input" placeholder="형제관계" value="${attr(st.siblings||'')}"><input id="fAddress" class="input" placeholder="주소" value="${attr(st.address||'')}"><textarea id="fMemo" class="input textarea" placeholder="학생 기본 메모">${esc(st.memo||'')}</textarea>
        <button class="primary fullBtn" data-act="saveStudent" data-id="${st.id||''}">${ui.modal.id?'변경사항 저장':'학생 추가'}</button>
        ${ui.modal.id?`<div class="dangerZone"><strong>명단 관리</strong><button class="secondary fullBtn" data-act="deactivateStudent" data-id="${st.id}">명단에서 제외</button><button class="danger fullBtn" data-act="deleteStudentHard" data-id="${st.id}">학생 완전 삭제</button></div>`:''}</div>`);
    }

    // Student detail: management starts here; photo and edit are obvious.
    if(ui.modal.type==='detail'){
      const st=studentById(ui.modal.id); if(!st)return '';
      v14EnsureStudent(st); const contacts=v14StudentContacts(st); const logs=[...(st.visitLogs||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      const attendanceHistory=Object.keys(state.sessions).sort().reverse().filter(k=>state.sessions[k]?.attendance?.[st.id]).slice(0,10);
      return modal(`<div class="modalTitleRow"><div class="detailHead">${st.photo?avatar(st,'detailPhoto'):'<div class="detailPhoto photoPlaceholder">사진</div>'}<div><div class="titleSmall">${esc(st.name)}</div><div class="muted">${esc(st.grade||'학년 미지정')}${st.assignedTeacher?' · '+esc(st.assignedTeacher):''}</div></div></div>${closeDefault}</div>
        <div class="detailActions"><button class="primary" data-act="editStudent" data-id="${st.id}">정보 수정</button><button class="secondary" data-act="photo" data-id="${st.id}">${st.photo?'사진 변경':'사진 추가'}</button></div>
        <div class="card kvCard">${kv('생일',st.birthday||'미기재')}${kv('성별',st.gender||'미지정')}${kv('부모 신앙',st.parentFaith||'미기재')}${kv('학교',st.school||'')}${kv('주소',st.address||'')}${kv('메모',st.memo||'')}</div>
        <div class="card"><div class="sectionTitle">전화 · 문자</div>${contacts.map(c=>`<div class="contactPerson recoveryContact"><span><strong>${esc(c.name)}</strong><small>${esc(c.relation)}</small></span><b>${esc(c.phone)}</b><a href="tel:${phoneUri(c.phone)}">전화</a><a href="sms:${phoneUri(c.phone)}">문자</a></div>`).join('')||'<div class="muted">등록된 연락처가 없습니다.</div>'}</div>
        <div class="visitBox recoveryVisit"><div class="visitBoxHead"><div><strong>심방 · 연락 기록</strong><small>작성일이 자동으로 쌓입니다.</small></div><button class="quickVisit" data-act="quickVisit" data-id="${st.id}">오늘 심방</button></div><div class="visitEntry"><input id="visitDate" class="input" type="date" value="${todayKey()}"><textarea id="visitMemo" class="input textarea" placeholder="통화, 문자, 심방 내용"></textarea><button class="primary" data-act="addVisit" data-id="${st.id}">기록 추가</button></div>${logs.map(x=>`<div class="visitLog"><div><strong>${esc(x.date)}</strong><p>${esc(x.note||'')}</p></div><button data-act="deleteVisit" data-id="${st.id}" data-visit="${x.id}">삭제</button></div>`).join('')||'<div class="visitEmpty">아직 심방/연락 기록이 없습니다.</div>'}</div>
        <div class="card"><div class="sectionTitle">최근 출석</div>${attendanceHistory.map(k=>`<div class="history"><span><strong>${displayDate(k)}</strong><small>${esc(att(st,k).memo||'')}</small></span><strong>${statusLabel(att(st,k).status)}</strong></div>`).join('')||'<div class="muted">출석 기록 없음</div>'}</div>`);
    }

    return prevModalHtml();
  };

  function hardDeleteStudent(id){
    const st=studentById(id); if(!st)return toast('삭제할 학생을 찾지 못했습니다.');
    if(!confirm(`${st.name} 학생을 완전히 삭제할까요?\n학생 기본정보와 출석·달란트 기록에서 모두 제거됩니다.`))return;
    createSnapshot('학생 완전 삭제 전'); pushUndo();
    state.students=state.students.filter(x=>x.id!==id);
    Object.values(state.sessions||{}).forEach(sess=>{
      if(sess?.attendance) delete sess.attendance[id];
      if(Array.isArray(sess?.transactions)) sess.transactions=sess.transactions.map(tx=>({...tx,studentIds:(tx.studentIds||[]).filter(sid=>sid!==id)})).filter(tx=>(tx.studentIds||[]).length);
    });
    ui.selected.delete(id); save(); ui.modal=null; toast(`${st.name} 학생을 완전히 삭제했습니다.`); render();
  }

  const priorHandleAct=handleAct;
  handleAct=function(act,b){
    if(act==='backTeachers'){ui.modal={type:'teachers'};return render();}
    if(act==='editTeacherFromDetail'){ui.modal={type:'teacherForm',id:b.dataset.id};return render();}
    if(act==='backTeacherDetail'){ui.modal=b.dataset.id?{type:'teacherDetail',id:b.dataset.id}:{type:'teachers'};return render();}
    if(act==='backStudentDetail'){ui.modal=b.dataset.id?{type:'detail',id:b.dataset.id}:null;return render();}
    if(act==='deleteStudentHard')return hardDeleteStudent(b.dataset.id);
    return priorHandleAct(act,b);
  };

  // Teacher save: always save the same fields that appear in list/detail.
  saveTeacherForm=function(id){
    const name=document.getElementById('tName')?.value.trim(); if(!name)return toast('교사 이름을 입력해 주세요.');
    pushUndo(); let t=id?teacherById(id):null; if(!t){t={id:uid('tea'),active:true};state.teachers.push(t);} v14EnsureTeacher(t);
    Object.assign(t,{
      name,
      role:document.getElementById('tRole')?.value.trim()||'',
      teacherType:document.getElementById('tType')?.value||'정교사',
      officialIncluded:!!document.getElementById('tOfficial')?.checked,
      birthday:document.getElementById('tBirthday')?.value||'',
      phone:document.getElementById('tPhone')?.value.trim()||'',
      emergencyPhone:document.getElementById('tEmergencyPhone')?.value.trim()||'',
      memo:document.getElementById('tMemo')?.value.trim()||'',
      leave:{enabled:!!document.getElementById('tLeaveEnabled')?.checked,reason:document.getElementById('tLeaveReason')?.value.trim()||'',start:document.getElementById('tLeaveStart')?.value||'',end:document.getElementById('tLeaveEnd')?.value||''},
      active:true
    });
    save(); ui.modal={type:'teacherDetail',id:t.id}; toast(id?'교사 정보를 수정했습니다.':'교사를 추가했습니다.'); render();
  };

  render();
})();
