/* v1.5.1.6 attendance-session fix
   UI FREEZE: no layout/style changes.
   An unrecorded date is UNSET, never ABSENT.
*/
(function(){
  function own(obj,key){ return !!obj && Object.prototype.hasOwnProperty.call(obj,key); }

  att=function(st,k=ui.date){
    const records=state.sessions?.[k]?.attendance || {};
    if(!own(records,st.id)) return {present:false,late:false,newcomer:false,memo:'',status:'unset'};
    const raw=records[st.id] || {};
    const legacy=raw.status || 'unset';
    const present=(typeof raw.present==='boolean') ? raw.present : ['present','late','new'].includes(legacy);
    const status=legacy==='unset' ? 'unset' : (present ? 'present' : 'absent');
    return {...raw,present,late:(typeof raw.late==='boolean'?raw.late:legacy==='late'),newcomer:(typeof raw.newcomer==='boolean'?raw.newcomer:legacy==='new'),memo:raw.memo||'',status};
  };

  teacherAtt=function(t,k=ui.date){
    const records=state.teacherSessions?.[k]?.attendance || {};
    if(!own(records,t.id)) return {present:false,late:false,reason:'',status:'unset'};
    const raw=records[t.id] || {};
    const legacy=raw.status || 'unset';
    const present=(typeof raw.present==='boolean') ? raw.present : ['present','late'].includes(legacy);
    const status=legacy==='unset' ? 'unset' : (present ? 'present' : 'absent');
    return {...raw,present,late:(typeof raw.late==='boolean'?raw.late:legacy==='late'),reason:raw.reason||'',status};
  };

  attendanceCounts=function(list=active(),k=ui.date){
    const c={present:0,absent:0,late:0,new:0,unset:0};
    list.forEach(st=>{
      const a=att(st,k);
      if(a.status==='unset'){ c.unset++; return; }
      if(a.present)c.present++; else c.absent++;
      if(a.late)c.late++;
      if(a.newcomer)c.new++;
    });
    return c;
  };

  teacherAttendanceCounts=function(list=activeTeachers(),k=ui.date){
    const c={present:0,absent:0,late:0,unset:0};
    list.forEach(t=>{
      const a=teacherAtt(t,k);
      if(a.status==='unset'){ c.unset++; return; }
      if(a.present)c.present++; else c.absent++;
      if(a.late)c.late++;
    });
    return c;
  };

  const oldShareCurrentAttendance=shareCurrentAttendance;
  shareCurrentAttendance=async function(){
    const list=attendanceScopeList();
    const records=state.sessions?.[ui.date]?.attendance || {};
    if(!list.some(st=>own(records,st.id))) return toast('이 날짜에는 아직 출석 기록이 없습니다.');
    return oldShareCurrentAttendance();
  };

  const oldShareAttendancePacket=shareAttendancePacket;
  shareAttendancePacket=async function(){
    const list=attendanceScopeList();
    const records=state.sessions?.[ui.date]?.attendance || {};
    if(!list.some(st=>own(records,st.id))) return toast('이 날짜에는 아직 출석 기록이 없습니다.');
    return oldShareAttendancePacket();
  };
})();
