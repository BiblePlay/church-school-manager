/* v1.5.1.8 — STUDENT ATTENDANCE HISTORY DISPLAY ONLY
   UI/DATA FREEZE: no other behavior is changed.
   - Student detail shows only the latest 5 recorded attendance sessions.
   - Full attendance history opens separately with range filters.
*/
(function(){
  ui.studentAttendanceRange = ui.studentAttendanceRange || 'month';

  function recorded(k){
    return typeof attendanceSessionRecorded === 'function' ? attendanceSessionRecorded(k) : !!state.sessions?.[k];
  }
  function datePart(k){ return String(k||'').slice(0,10); }
  function keyDate(k){
    const d=new Date(datePart(k)+'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function allStudentAttendanceKeys(st){
    return Object.keys(state.sessions||{})
      .filter(k=>recorded(k) && state.sessions?.[k]?.attendance && Object.prototype.hasOwnProperty.call(state.sessions[k].attendance,st.id))
      .sort((a,b)=>String(b).localeCompare(String(a)));
  }
  function rangeStart(range){
    const now=new Date();
    if(range==='all') return null;
    if(range==='year') return new Date(now.getFullYear(),0,1);
    if(range==='month') return new Date(now.getFullYear(),now.getMonth(),1);
    const months=range==='3m'?3:6;
    return new Date(now.getFullYear(),now.getMonth()-(months-1),1);
  }
  function keysForRange(st,range){
    const start=rangeStart(range);
    return allStudentAttendanceKeys(st).filter(k=>{
      if(!start) return true;
      const d=keyDate(k); return d && d>=start;
    });
  }
  function attendanceRows(st,keys){
    return keys.map(k=>{
      const a=att(st,k);
      const note=esc(a.memo||'');
      return `<div class="history"><span><strong>${displayDate(k)}</strong><small>${note}</small></span><strong>${statusLabel(a.status)}</strong></div>`;
    }).join('');
  }
  function recentBlock(st){
    const keys=allStudentAttendanceKeys(st).slice(0,5);
    if(!keys.length) return `<div class="card"><div class="sectionTitle">최근 출석</div><div class="muted">출석 기록 없음</div></div>`;
    const present=keys.filter(k=>att(st,k).present).length;
    const pct=Math.round((present/keys.length)*100);
    return `<div class="card studentRecentAttendance"><div class="sectionTitleRow"><div class="sectionTitle">최근 출석</div><span class="attendanceMiniSummary">최근 ${keys.length}회 ${present}회 출석 · ${pct}%</span></div>${attendanceRows(st,keys)}<button class="secondary fullBtn attendanceFullBtn" data-student-att-full="${st.id}">출석 기록 전체보기 ›</button></div>`;
  }

  const previousModalHtml=modalHtml;
  modalHtml=function(){
    if(ui.modal?.type==='studentAttendanceFull'){
      const st=studentById(ui.modal.id); if(!st) return '';
      const range=ui.studentAttendanceRange||'month';
      const keys=keysForRange(st,range);
      const present=keys.filter(k=>att(st,k).present).length;
      const pct=keys.length?Math.round((present/keys.length)*100):0;
      const tabs=[['month','이번 달'],['3m','최근 3개월'],['6m','최근 6개월'],['year','올해'],['all','전체']];
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${esc(st.name)} 출석 기록</div><div class="muted">${esc(st.grade||'학년 미지정')} · ${keys.length?`${present}/${keys.length}회 · ${pct}%`:'기록 없음'}</div></div><button class="icon" data-student-att-back="${st.id}" aria-label="학생 정보로 돌아가기">×</button></div><div class="chips attendanceHistoryRanges">${tabs.map(([v,label])=>`<button class="chip ${range===v?'active':''}" data-student-att-range="${v}">${label}</button>`).join('')}</div><div class="card studentAttendanceFullList">${attendanceRows(st,keys)||'<div class="muted">선택한 기간의 출석 기록이 없습니다.</div>'}</div>`);
    }

    const html=previousModalHtml();
    if(ui.modal?.type!=='detail') return html;
    const st=studentById(ui.modal.id); if(!st) return html;
    const start='<div class="card"><div class="sectionTitle">최근 출석</div>';
    const end='<div class="dangerZone studentDanger">';
    const si=html.indexOf(start), ei=html.indexOf(end,si);
    if(si<0 || ei<0) return html;
    return html.slice(0,si)+recentBlock(st)+html.slice(ei);
  };

  const previousBind=bind;
  bind=function(){
    previousBind();
    document.querySelectorAll('[data-student-att-full]').forEach(b=>b.onclick=()=>{
      ui.studentAttendanceRange='month';
      ui.modal={type:'studentAttendanceFull',id:b.dataset.studentAttFull};
      render();
    });
    document.querySelectorAll('[data-student-att-range]').forEach(b=>b.onclick=()=>{
      ui.studentAttendanceRange=b.dataset.studentAttRange;
      render();
    });
    document.querySelectorAll('[data-student-att-back]').forEach(b=>b.onclick=()=>{
      ui.modal={type:'detail',id:b.dataset.studentAttBack};
      render();
    });
  };

  const style=document.createElement('style');
  style.textContent=`
    .sectionTitleRow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px}
    .attendanceMiniSummary{font-size:11px;font-weight:800;color:#6f6a61;white-space:nowrap}
    .attendanceFullBtn{margin-top:10px}
    .attendanceHistoryRanges{margin:0 0 10px}
    .studentAttendanceFullList{margin-top:0}
    @media (max-width:380px){.sectionTitleRow{align-items:flex-start;flex-direction:column;gap:2px}.attendanceMiniSummary{white-space:normal}}
  `;
  document.head.appendChild(style);
})();
