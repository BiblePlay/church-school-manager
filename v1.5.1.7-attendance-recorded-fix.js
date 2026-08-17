/* v1.5.1.7 attendance recorded-session fix
   UI FREEZE: no layout/style changes.
   Only real attendance sessions count in history/statistics.
*/
(function(){
  function own(obj,key){ return !!obj && Object.prototype.hasOwnProperty.call(obj,key); }
  function rawPresent(raw){
    if(!raw) return false;
    if(typeof raw.present==='boolean') return raw.present;
    return ['present','late','new'].includes(raw.status);
  }
  function meaningful(raw){
    if(!raw) return false;
    return rawPresent(raw) || !!raw.late || !!raw.newcomer || !!String(raw.memo||'').trim();
  }
  window.attendanceSessionRecorded=function(k){
    const sess=state.sessions?.[k];
    if(!sess) return false;
    if(sess.attendanceStarted===true) return true;
    const records=sess.attendance||{};
    // Legacy sessions are considered real only when there is positive/meaningful evidence.
    // This filters old auto-generated "everyone absent" sessions.
    return Object.values(records).some(meaningful);
  };

  function markStarted(k=ui.date){
    const sess=ensureSession(k);
    sess.attendanceStarted=true;
    return sess;
  }

  const oldToggleStudentAttendance=toggleStudentAttendance;
  toggleStudentAttendance=function(id){ markStarted(); return oldToggleStudentAttendance(id); };
  const oldToggleStudentAttendanceFlag=toggleStudentAttendanceFlag;
  toggleStudentAttendanceFlag=function(id,flag){ markStarted(); return oldToggleStudentAttendanceFlag(id,flag); };
  const oldSetAllStudentAttendance=setAllStudentAttendance;
  setAllStudentAttendance=function(v){ markStarted(); return oldSetAllStudentAttendance(v); };
  const oldSaveStudentMemoAuto=saveStudentMemoAuto;
  saveStudentMemoAuto=function(id,el){
    if(el && String(el.value||'').trim()) markStarted();
    return oldSaveStudentMemoAuto(id,el);
  };

  // Individual recent-history helper used by student detail.
  if(typeof recentAttendanceKeys==='function'){
    const oldRecentAttendanceKeys=recentAttendanceKeys;
    recentAttendanceKeys=function(){
      return oldRecentAttendanceKeys.apply(this,arguments).filter(k=>attendanceSessionRecorded(k));
    };
  }

  // Replace latest-attendance lookup so ghost sessions never affect ordering/status.
  if(typeof lastPresentKey==='function'){
    lastPresentKey=function(st){
      const keys=Object.keys(state.sessions||{}).filter(attendanceSessionRecorded).sort().reverse();
      for(const k of keys){ const raw=state.sessions[k]?.attendance?.[st.id]; if(raw && att(st,k).present) return k; }
      return '';
    };
  }

  // Monthly summary: only real attendance sessions.
  if(typeof monthlyStats==='function'){
    const prevMonthlyStats=monthlyStats;
    monthlyStats=function(month,scope){
      // Temporarily shadow sessions through a filtered clone only for calculation.
      const original=state.sessions;
      const filtered={};
      for(const [k,v] of Object.entries(original||{})) if(attendanceSessionRecorded(k)) filtered[k]=v;
      state.sessions=filtered;
      try{return prevMonthlyStats(month,scope);}finally{state.sessions=original;}
    };
  }

  // Student detail modal in v1.4 patch builds history directly from state.sessions.
  if(typeof detailModal==='function'){
    const oldDetailModal=detailModal;
    detailModal=function(st){
      // oldDetailModal may not accept a student object in every patch version; filter via temporary sessions.
      const original=state.sessions;
      const filtered={};
      for(const [k,v] of Object.entries(original||{})) if(attendanceSessionRecorded(k)) filtered[k]=v;
      state.sessions=filtered;
      try{return oldDetailModal.apply(this,arguments);}finally{state.sessions=original;}
    };
  }

  // Analytics functions introduced by data-sync patch use all session keys.
  if(typeof attendanceTrend==='function'){
    const oldAttendanceTrend=attendanceTrend;
    attendanceTrend=function(){
      const original=state.sessions, filtered={};
      for(const [k,v] of Object.entries(original||{})) if(attendanceSessionRecorded(k)) filtered[k]=v;
      state.sessions=filtered;
      try{return oldAttendanceTrend.apply(this,arguments);}finally{state.sessions=original;}
    };
  }
  if(typeof studentAttendanceStats==='function'){
    const oldStudentAttendanceStats=studentAttendanceStats;
    studentAttendanceStats=function(){
      const original=state.sessions, filtered={};
      for(const [k,v] of Object.entries(original||{})) if(attendanceSessionRecorded(k)) filtered[k]=v;
      state.sessions=filtered;
      try{return oldStudentAttendanceStats.apply(this,arguments);}finally{state.sessions=original;}
    };
  }

  // Sharing requires a real session, not merely legacy absent rows.
  const oldShareCurrentAttendance2=shareCurrentAttendance;
  shareCurrentAttendance=async function(){
    if(!attendanceSessionRecorded(ui.date)) return toast('이 날짜에는 아직 출석 기록이 없습니다.');
    return oldShareCurrentAttendance2();
  };
  const oldShareAttendancePacket2=shareAttendancePacket;
  shareAttendancePacket=async function(){
    if(!attendanceSessionRecorded(ui.date)) return toast('이 날짜에는 아직 출석 기록이 없습니다.');
    return oldShareAttendancePacket2();
  };
})();
