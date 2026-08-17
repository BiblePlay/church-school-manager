/* v1.5.3.0 — teacher roster bulk management only */
(function(){
  ui.teacherBulkSelected = ui.teacherBulkSelected instanceof Set ? ui.teacherBulkSelected : new Set();

  // Add one roster-management action to the existing teacher hub without changing its layout.
  const priorStudentsView_v1530 = studentsView;
  studentsView = function(){
    let html = priorStudentsView_v1530();
    if(ui.peopleMode==='teacher' && !html.includes('data-act="manageTeacherList"')){
      html = html.replace(
        '<div class="peopleActions"><button class="primary" data-act="addTeacher">+ 교사 추가</button><button class="secondary" data-act="teacherExcelImport">Excel 가져오기</button></div>',
        '<div class="peopleActions"><button class="primary" data-act="addTeacher">+ 교사 추가</button><button class="secondary" data-act="teacherExcelImport">Excel 가져오기</button><button class="secondary" data-act="manageTeacherList">명단 정리</button></div>'
      );
    }
    return html;
  };

  const priorModalHtml_v1530 = modalHtml;
  modalHtml = function(){
    if(ui.modal?.type==='teacherBulk'){
      const close='<button class="icon" data-act="closeModal">×</button>';
      const list=activeTeachers();
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">교사 명단 정리</div><div class="muted">잘못 가져온 교사를 여러 명 선택해 한 번에 정리합니다.</div></div>${close}</div>
        <div class="row compactBar"><span class="badge">선택 ${ui.teacherBulkSelected.size}명</span><div class="headActions"><button class="secondary nowrap" data-act="teacherBulkSelectAll">현재 목록 전체</button><button class="secondary nowrap" data-act="teacherBulkClear">해제</button></div></div>
        <div class="checkList bulkCheckList">${list.map(t=>`<button class="checkPerson ${ui.teacherBulkSelected.has(t.id)?'active':''}" data-act="teacherBulkToggle" data-id="${t.id}"><span>${esc(t.name)}</span><small>${esc(t.role||'담당·직함 미지정')}${t.birthday?' · '+esc(t.birthday):''}</small><b>${ui.teacherBulkSelected.has(t.id)?'✓':'+'}</b></button>`).join('')||'<div class="empty">교사가 없습니다.</div>'}</div>
        <div class="notice">명단 제외는 과거 교사 출석을 보존합니다. 완전 삭제는 잘못 가져온 가짜·중복 교사 정리용이며 교사 출석 연결 기록도 함께 제거됩니다.</div>
        <div class="bulkActionBar"><div class="undoInline"><button class="roundHistory" data-act="undo" ${ui.undo.length?'':'disabled'} aria-label="되돌리기">${historyArrow('left')}</button><button class="roundHistory" data-act="redo" ${ui.redo.length?'':'disabled'} aria-label="다시 실행">${historyArrow('right')}</button></div><div class="grid2"><button class="secondary nowrap" data-act="teacherBulkDeactivate">명단 제외</button><button class="danger nowrap" data-act="teacherBulkDelete">완전 삭제</button></div></div>`);
    }
    return priorModalHtml_v1530();
  };

  function selectedTeacherIds(){
    return [...ui.teacherBulkSelected].filter(id=>!!teacherById(id));
  }

  function teacherBulkDeactivate(){
    const ids=selectedTeacherIds();
    if(!ids.length)return toast('정리할 교사를 선택해 주세요.');
    if(!confirm(`선택한 ${ids.length}명을 교사 명단에서 제외할까요?\n과거 교사 출석 기록은 유지됩니다.`))return;
    createSnapshot('교사 일괄 명단 제외 전'); pushUndo();
    ids.forEach(id=>{const t=teacherById(id);if(t)t.active=false;});
    save(); ui.teacherBulkSelected.clear(); toast(`${ids.length}명을 교사 명단에서 제외했습니다.`); ui.modal={type:'teacherBulk'}; render();
  }

  function teacherBulkDelete(){
    const ids=selectedTeacherIds();
    if(!ids.length)return toast('삭제할 교사를 선택해 주세요.');
    if(!confirm(`선택한 ${ids.length}명을 완전히 삭제할까요?\n잘못 가져온 가짜·중복 교사 정리용입니다. 교사 출석 연결 기록도 함께 제거됩니다.\n실행 직후 되돌리기는 가능합니다.`))return;
    createSnapshot('교사 일괄 완전 삭제 전'); pushUndo();
    const set=new Set(ids);
    state.teachers=state.teachers.filter(t=>!set.has(t.id));
    for(const k of Object.keys(state.teacherSessions||{})){
      const attendance=state.teacherSessions[k]?.attendance;
      if(attendance) ids.forEach(id=>delete attendance[id]);
    }
    // Student assignedTeacher strings are intentionally preserved, matching existing single-teacher delete behavior.
    save(); ui.teacherBulkSelected.clear(); toast(`${ids.length}명을 완전히 삭제했습니다. 되돌리기 가능`); ui.modal={type:'teacherBulk'}; render();
  }

  const priorHandleAct_v1530 = handleAct;
  handleAct = function(act,b){
    if(act==='manageTeacherList'){ui.teacherBulkSelected.clear();ui.modal={type:'teacherBulk'};return render();}
    if(act==='teacherBulkSelectAll'){activeTeachers().forEach(t=>ui.teacherBulkSelected.add(t.id));return renderKeepModalScroll();}
    if(act==='teacherBulkClear'){ui.teacherBulkSelected.clear();return renderKeepModalScroll();}
    if(act==='teacherBulkToggle'){
      const id=b.dataset.id;
      ui.teacherBulkSelected.has(id)?ui.teacherBulkSelected.delete(id):ui.teacherBulkSelected.add(id);
      return renderKeepModalScroll();
    }
    if(act==='teacherBulkDeactivate')return teacherBulkDeactivate();
    if(act==='teacherBulkDelete')return teacherBulkDelete();
    return priorHandleAct_v1530(act,b);
  };

  render();
})();
