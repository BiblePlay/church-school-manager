/* v1.5.3.5 — attendance final usability patch
   Scope only:
   - student + teacher attendance date moved below the dark summary card
   - explicit auto-save status: no record / saved / update saved
   - same selected date keeps updating one session; opening a date alone creates nothing
   - teacher attendance history: edit + delete
   - attendance Excel export: student + teacher attendance in one workbook
   - natural day rollover only when the user was following today's date
   No talent, people, Excel-import, datapack schema, or profile redesign.
*/
(function(){
  ui.attendanceSaveFlash = ui.attendanceSaveFlash || null;
  let lastSeenToday = todayKey();

  function studentRecorded(k=ui.date){
    return typeof attendanceSessionRecorded==='function'
      ? !!attendanceSessionRecorded(k)
      : !!state.sessions?.[k] && Object.keys(state.sessions[k].attendance||{}).length>0;
  }
  function teacherRecorded(k=ui.date){
    return typeof teacherAttendanceSessionRecorded==='function'
      ? !!teacherAttendanceSessionRecorded(k)
      : !!state.teacherSessions?.[k] && Object.keys(state.teacherSessions[k].attendance||{}).length>0;
  }
  function isCurrentAttendanceMode(mode){
    return ui.tab==='attendance' && ((mode==='teacher' && ui.attendanceMode==='teacher') || (mode==='student' && ui.attendanceMode!=='teacher'));
  }
  function flashAutoSaved(mode,wasRecorded,date=ui.date){
    const stamp=Date.now();
    ui.attendanceSaveFlash={mode,date,text:wasRecorded?'✓ 수정 저장됨':'✓ 저장됨',stamp};
    setTimeout(()=>{
      if(ui.attendanceSaveFlash?.stamp!==stamp)return;
      ui.attendanceSaveFlash=null;
      if(isCurrentAttendanceMode(mode) && ui.date===date)render();
    },1400);
  }
  function dateStatus(mode){
    const flash=ui.attendanceSaveFlash;
    if(flash && flash.mode===mode && flash.date===ui.date)return flash.text;
    const recorded=mode==='teacher'?teacherRecorded(ui.date):studentRecorded(ui.date);
    return recorded?'✓ 저장됨':'기록 없음';
  }
  function attendanceDateControl(mode){
    const saved=(mode==='teacher'?teacherRecorded(ui.date):studentRecorded(ui.date));
    const status=dateStatus(mode);
    return `<div class="card attendanceDateCard"><div class="row"><div><div class="label">기록 날짜</div><div class="muted">선택한 날짜의 기록만 저장·수정됩니다.</div></div><div class="datePick"><input id="mainDate" class="input" type="date" value="${ui.date}"><div class="badge ${saved?'':'muted'}">${esc(status)}</div></div></div></div>`;
  }
  function moveDateBelowSummary(html,mode){
    const old=dateControl();
    if(html.startsWith(old))html=html.slice(old.length);
    else html=html.replace(old,'');
    const date=attendanceDateControl(mode);
    if(mode==='teacher'){
      const marker='<div class="list">';
      const pos=html.indexOf(marker);
      return pos>=0?html.slice(0,pos)+date+html.slice(pos):date+html;
    }
    // 학생 출석은 검은 요약 박스 다음, 범위 선택(보기) 바로 앞에 날짜를 둔다.
    // 현재 화면은 scopeChooser를 사용하므로 예전 gradeOverview/chips 표식을 찾지 않는다.
    let pos=html.indexOf('<div class="scopeChooser">');
    return pos>=0?html.slice(0,pos)+date+html.slice(pos):date+html;
  }

  const priorAttendanceView_v1535=attendanceView;
  attendanceView=function(){
    const html=priorAttendanceView_v1535();
    // In teacher mode the original attendanceView delegates to the wrapped
    // teacherAttendanceView below, so do not move the date twice.
    if(ui.attendanceMode==='teacher')return html;
    return moveDateBelowSummary(html,'student');
  };
  // attendanceView delegates to teacherAttendanceView in some versions; this wrapper
  // also keeps direct teacherAttendanceView calls consistent without changing its internals.
  const priorTeacherAttendanceView_v1535=teacherAttendanceView;
  teacherAttendanceView=function(){
    return moveDateBelowSummary(priorTeacherAttendanceView_v1535(),'teacher');
  };

  // Auto-save feedback is decided AFTER the real save.
  // Clearing the last check must show "기록 없음", never a false "저장됨".
  function finishFeedback(mode,was,date,result){
    const now=mode==='teacher'?teacherRecorded(date):studentRecorded(date);
    ui.attendanceSaveFlash=null;
    if(now)flashAutoSaved(mode,was,date);
    if(isCurrentAttendanceMode(mode)&&ui.date===date)render();
    return result;
  }
  const priorToggleStudentAttendance_v1535=toggleStudentAttendance;
  toggleStudentAttendance=function(id){const d=ui.date,was=studentRecorded(d);const r=priorToggleStudentAttendance_v1535(id);return finishFeedback('student',was,d,r);};
  const priorToggleStudentAttendanceFlag_v1535=toggleStudentAttendanceFlag;
  toggleStudentAttendanceFlag=function(id,flag){const d=ui.date,was=studentRecorded(d);const r=priorToggleStudentAttendanceFlag_v1535(id,flag);return finishFeedback('student',was,d,r);};
  const priorSetAllStudentAttendance_v1535=setAllStudentAttendance;
  setAllStudentAttendance=function(v){const d=ui.date,was=studentRecorded(d);const r=priorSetAllStudentAttendance_v1535(v);return finishFeedback('student',was,d,r);};
  const priorSaveStudentMemoAuto_v1535=saveStudentMemoAuto;
  saveStudentMemoAuto=function(id,el){
    const d=ui.date,was=studentRecorded(d),st=studentById(id),before=st?(att(st,d).memo||''):'';
    const r=priorSaveStudentMemoAuto_v1535(id,el);
    const after=st?(att(st,d).memo||''):'';
    if(after!==before)return finishFeedback('student',was,d,r);
    return r;
  };

  const priorToggleTeacherAttendance_v1535=toggleTeacherAttendance;
  toggleTeacherAttendance=function(id){const d=ui.date,was=teacherRecorded(d);const r=priorToggleTeacherAttendance_v1535(id);return finishFeedback('teacher',was,d,r);};
  const priorToggleTeacherAttendanceFlag_v1535=toggleTeacherAttendanceFlag;
  toggleTeacherAttendanceFlag=function(id,flag){const d=ui.date,was=teacherRecorded(d);const r=priorToggleTeacherAttendanceFlag_v1535(id,flag);return finishFeedback('teacher',was,d,r);};
  const priorSetAllTeacherAttendance_v1535=setAllTeacherAttendance;
  setAllTeacherAttendance=function(v){const d=ui.date,was=teacherRecorded(d);const r=priorSetAllTeacherAttendance_v1535(v);return finishFeedback('teacher',was,d,r);};
  const priorSaveTeacherReasonAuto_v1535=saveTeacherReasonAuto;
  saveTeacherReasonAuto=function(id,el){
    const d=ui.date,was=teacherRecorded(d),t=teacherById(id),before=t?(teacherAtt(t,d).reason||''):'';
    const r=priorSaveTeacherReasonAuto_v1535(id,el);
    const after=t?(teacherAtt(t,d).reason||''):'';
    if(after!==before)return finishFeedback('teacher',was,d,r);
    return r;
  };

  function deleteTeacherAttendanceRecord(k){
    if(!teacherRecorded(k))return toast('삭제할 교사 출석 기록이 없습니다.');
    if(!confirm(`${displayDate(k)} 교사 출석 기록을 삭제할까요?\n교사 명단과 학생/달란트 기록은 삭제되지 않습니다.`))return;
    pushUndo();
    delete state.teacherSessions[k];
    save();
    ui.attendanceSaveFlash=null;
    ui.modal={type:'teacherAttendanceHistory'};
    toast(`${displayDate(k)} 교사 출석 기록을 삭제했습니다. · 되돌리기 가능`);
    render();
  }

  // Add teacher delete beside the existing edit action without redesigning the history modal.
  const priorModalHtml_v1535=modalHtml;
  modalHtml=function(){
    let html=priorModalHtml_v1535();
    if(ui.modal?.type==='teacherAttendanceHistory'){
      html=html.replace(/<button class="secondary nowrap" data-edit-teacher-session="([^"]+)">보기 · 수정<\/button>/g,
        `<span class="recordEditActions"><button class="secondary nowrap" data-edit-teacher-session="$1">보기 · 수정</button><button class="recordDelete" data-delete-teacher-session="$1">삭제</button></span>`);
    }
    return html;
  };

  // Past-record edit follows the same rule: a date remains a record only
  // when at least one real attendance check exists.
  const priorHandleAct_v1535=handleAct;
  handleAct=function(act,b){ return priorHandleAct_v1535(act,b); };

  const priorBind_v1535=bind;
  bind=function(){
    priorBind_v1535();
    document.querySelectorAll('[data-delete-teacher-session]').forEach(b=>b.onclick=()=>deleteTeacherAttendanceRecord(b.dataset.deleteTeacherSession));
  };

  // One attendance Excel file with separate student/teacher sheets.
  const priorExportWorkbook_v1535=exportWorkbook;
  exportWorkbook=function(kind){
    if(kind!=='attendance')return priorExportWorkbook_v1535(kind);
    const studentRows=[['날짜','학생ID','이름','학년','상태','지각','새친구','메모']];
    Object.keys(state.sessions||{}).filter(studentRecorded).sort().forEach(k=>{
      Object.entries(state.sessions[k].attendance||{}).forEach(([id,a])=>{
        const s=studentById(id);if(!s)return;
        const present=typeof a.present==='boolean'?a.present:['present','late','new'].includes(a.status);
        studentRows.push([k,id,s.name,s.grade||'',present?'출석':'결석',(a.late||a.status==='late')?'지각':'',(a.newcomer||a.status==='new')?'새친구':'',a.memo||'']);
      });
    });
    const teacherRows=[['날짜','교사ID','이름','담당','상태','지각','사유']];
    Object.keys(state.teacherSessions||{}).filter(teacherRecorded).sort().forEach(k=>{
      Object.entries(state.teacherSessions[k].attendance||{}).forEach(([id,a])=>{
        const t=teacherById(id);if(!t)return;
        const present=typeof a.present==='boolean'?a.present:['present','late'].includes(a.status);
        teacherRows.push([k,id,t.name,t.role||'',present?'출석':'결석',(a.late||a.status==='late')?'지각':'',a.reason||'']);
      });
    });
    if(typeof XLSX!=='undefined'){
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(studentRows),'학생 출석');
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(teacherRows),'교사 출석');
      XLSX.writeFile(wb,`출석기록_${todayKey()}.xlsx`);
    }else{
      const rows=[['[학생 출석]'],...studentRows,[],['[교사 출석]'],...teacherRows];
      const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
      download(`출석기록_${todayKey()}.csv`,csv,'text/csv;charset=utf-8');
    }
    toast(`출석 Excel을 만들었습니다. · 학생 ${studentRows.length-1}건 · 교사 ${teacherRows.length-1}건`);
  };

  // If the app remains open across midnight, follow the new day only when it was
  // already following today's date. A manually selected past date is never changed.
  function checkDayRollover(){
    const now=todayKey();
    if(now===lastSeenToday)return;
    const wasFollowingToday=(ui.date===lastSeenToday);
    lastSeenToday=now;
    if(!wasFollowingToday)return;
    ui.date=now;ui.lastTxId=null;ui.attendanceDraft=null;ui.attendanceDraftKey='';ui.teacherAttendanceDraft=null;ui.teacherAttendanceDraftKey='';ui.attendanceSaveFlash=null;
    if(document.visibilityState==='visible')render();
  }
  window.addEventListener('focus',checkDayRollover);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkDayRollover();});
  setInterval(checkDayRollover,60000);

  render();
})();
