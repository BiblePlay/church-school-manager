/* v1.5.3.7 — student attendance-flow rate sorting only
   Adds low/high attendance-rate sorting to the existing Records > 학생별 출석 흐름 list.
   Does not change attendance storage, detail navigation, filters, or other screens.
*/
(function(){
  'use strict';

  if(!ui.attendanceRateSort) ui.attendanceRateSort='low';

  function rateFor(a){ return a.checked ? Math.round(a.attended / a.checked * 100) : null; }
  function sortAttendanceFlow(list, dates){
    const dir = ui.attendanceRateSort === 'high' ? -1 : 1;
    return [...list].sort((a,b)=>{
      const aa=studentAnalytics(a,dates), bb=studentAnalytics(b,dates);
      const ar=rateFor(aa), br=rateFor(bb);
      // Students with no attendance records stay at the bottom in either direction.
      if(ar===null && br===null) return String(a.name||'').localeCompare(String(b.name||''),'ko');
      if(ar===null) return 1;
      if(br===null) return -1;
      if(ar!==br) return (ar-br)*dir;
      return String(a.name||'').localeCompare(String(b.name||''),'ko');
    });
  }

  recordsView = function(){
    const dates=analyticsDates(ui.analyticsRange);
    const scope=ui.analyticsScope||'전체';
    const baseList=(scope==='내 담당'?scopedStudents('내 담당'):scope==='전체'?scopedStudents('전체'):scopedStudents(scope));
    const list=sortAttendanceFlow(baseList,dates);
    const totalMarked=baseList.reduce((n,st)=>n+studentAnalytics(st,dates).checked,0);
    const totalAtt=baseList.reduce((n,st)=>n+studentAnalytics(st,dates).attended,0);
    const focus=baseList.filter(st=>{const a=studentAnalytics(st,dates);return a.currentAbs>=2 || (a.checked>=3 && a.attended/a.checked<=0.5);});
    const sessionDates=Object.keys(state.sessions).filter(k=>Object.keys(state.sessions[k]?.attendance||{}).length>0).sort().reverse();
    const scopeButtons=scopeOptionsWithManaged();

    return `${state.settings.adminMode?'<div class="recordsModeRow"><button class="dashLaunch" data-act="openDashboard">▣ 부서 현황</button></div>':''}
      <div class="chips recordRangeChips">${['이번 달','지난 달','최근 3개월','최근 6개월','전체'].map(v=>`<button class="chip ${ui.analyticsRange===v?'active':''}" data-record-range="${v}">${v}</button>`).join('')}</div>
      <div class="chips recordGradeChips">${scopeButtons.map(v=>`<button class="chip ${scope===v?'active':''}" data-record-scope="${attr(v)}">${esc(v)}</button>`).join('')}</div>
      <section class="hero"><div class="heroGrid"><div><div class="big">${totalMarked?Math.round(totalAtt/totalMarked*100):0}<span>%</span></div><div class="heroLabel">기록된 출석 기준</div></div><div class="heroRight"><strong>${focus.length}명</strong><div class="heroLabel">최근 집중 확인</div></div></div></section>
      <div class="sectionHead"><div><div class="sectionTitle">학생별 출석 흐름</div><div class="muted">${scope==='전체'?'전체 학생':scope==='내 담당'?'내 담당 학생':'선택한 학년'}의 기록을 봅니다.</div></div></div>
      <div class="sortBar attendanceRateSort"><span>출석률 정렬</span><button class="sortBtn ${ui.attendanceRateSort==='low'?'active':''}" data-attendance-rate-sort="low">낮은 순</button><button class="sortBtn ${ui.attendanceRateSort==='high'?'active':''}" data-attendance-rate-sort="high">높은 순</button></div>
      <div class="list">${list.map(st=>{const a=studentAnalytics(st,dates);const detail=dates.slice(-8).map(k=>{const raw=state.sessions[k]?.attendance?.[st.id];if(!raw)return `${k.slice(5).replace('-','/')} ·`;const aa=att(st,k);return `${k.slice(5).replace('-','/')} ${aa.present?(aa.late?'△':'✓'):'—'}`}).join('  ');return `<button class="recordCard" data-record-student="${st.id}"><span><strong>${esc(st.name)}</strong><small>${esc(st.grade||'학년 미지정')} · ${a.attended}/${a.checked||0}회</small></span><span class="recordRate">${a.checked?Math.round(a.attended/a.checked*100):0}%</span><span class="recordDates">${detail||'기록 없음'}</span>${a.currentAbs>=2?`<span class="warning">최근 ${a.currentAbs}회 연속 결석</span>`:''}</button>`}).join('')||'<div class="empty">표시할 학생이 없습니다.</div>'}</div>
      <div class="card"><div class="sectionTitle">날짜별 출석 기록</div>${sessionDates.slice(0,30).map(k=>{const ss=scope==='전체'?active():scope==='내 담당'?scopedStudents('내 담당'):active().filter(s=>s.grade===scope);const c=attendanceCounts(ss,k);return `<div class="history historyManage"><span><strong>${esc(displayDate(k))}</strong><small>${c.present}/${ss.length} 출석</small></span><button class="recordDelete" data-delete-session="${k}">기록 삭제</button></div>`}).join('')||'<div class="muted">출석 기록이 없습니다.</div>'}</div>`;
  };

  const priorBind_v1537=bind;
  bind=function(){
    priorBind_v1537();
    document.querySelectorAll('[data-attendance-rate-sort]').forEach(b=>b.onclick=()=>{
      ui.attendanceRateSort=b.dataset.attendanceRateSort;
      render();
    });
    // Keep the already-working direct jump to student information.
    document.querySelectorAll('[data-record-student]').forEach(b=>b.onclick=()=>{
      ui.modal={type:'detail',id:b.dataset.recordStudent};
      render();
    });
  };
})();
