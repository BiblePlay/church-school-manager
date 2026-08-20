/* v1.5.3.18 — records screen stabilization.
   Scope:
   - keep attendance-rate high/low sorting
   - use only real attendance sessions
   - keep date history closed behind one "출석 기록 보기" button
   - view/edit/delete each saved date
   - year/month browsing without an endlessly expanded main screen
   - filtered Excel/TXT export
   - grade/team view selector uses registered values only
   Does not change talent transactions, student profile data, or attendance checklist ordering.
*/
(function(){
  'use strict';
  if(!ui.attendanceRateSort) ui.attendanceRateSort='high';
  if(typeof ui.recordsHistoryOpen!=='boolean')ui.recordsHistoryOpen=false;
  ui.recordsHistoryYear=ui.recordsHistoryYear||String((ui.date||todayKey()).slice(0,4));
  ui.recordsHistoryMonth=ui.recordsHistoryMonth||String(Number((ui.date||todayKey()).slice(5,7)));

  function realSession(k){
    return typeof attendanceSessionRecorded==='function'
      ? attendanceSessionRecorded(k)
      : !!state.sessions?.[k] && Object.values(state.sessions[k].attendance||{}).some(a=>{
          const p=typeof a?.present==='boolean'?a.present:['present','late','new'].includes(a?.status);
          return p||!!a?.late||!!a?.newcomer;
        });
  }
  function rateFor(st, dates){
    const a=studentAnalytics(st,dates);
    return a.checked ? Math.round(a.attended / a.checked * 100) : null;
  }
  function matchesScope(st,scope){
    if(!st)return false;
    if(scope==='전체')return true;
    if(scope==='내 담당')return (state.settings.managedGrades||[]).includes(st.grade);
    if(String(scope).startsWith('팀:'))return (st.teams||[]).includes(String(scope).slice(2));
    return st.grade===scope;
  }
  function storedRows(k,scope){
    const rows=[];
    for(const [id,a] of Object.entries(state.sessions?.[k]?.attendance||{})){
      const st=studentById(id);
      if(st && matchesScope(st,scope))rows.push({id,st,a});
    }
    return rows;
  }
  function dateSummary(k,scope){
    const rows=storedRows(k,scope);
    let present=0,late=0,newcomer=0;
    rows.forEach(({a})=>{
      const p=typeof a.present==='boolean'?a.present:['present','late','new'].includes(a.status);
      if(p)present++;
      if(a.late||a.status==='late')late++;
      if(a.newcomer||a.status==='new')newcomer++;
    });
    return {rows,total:rows.length,present,absent:Math.max(0,rows.length-present),late,newcomer};
  }
  function allRecordDates(scope){
    return Object.keys(state.sessions||{})
      .filter(realSession)
      .filter(k=>storedRows(k,scope).length>0)
      .sort()
      .reverse();
  }
  function availableYears(scope){
    return [...new Set(allRecordDates(scope).map(k=>k.slice(0,4)))].sort().reverse();
  }
  function selectedRecordDates(scope){
    const y=String(ui.recordsHistoryYear||'전체'),m=String(ui.recordsHistoryMonth||'전체');
    return allRecordDates(scope).filter(k=>{
      if(y!=='전체'&&k.slice(0,4)!==y)return false;
      if(m!=='전체'&&Number(k.slice(5,7))!==Number(m))return false;
      return true;
    });
  }
  function recordRow(k,scope){
    const c=dateSummary(k,scope);
    return `<div class="history historyManage"><span><strong>${esc(displayDate(k))}</strong><small>${c.present}/${c.total} 출석${c.late?` · 지각 ${c.late}`:''}${c.newcomer?` · 새친구 ${c.newcomer}`:''}</small></span><span class="recordEditActions"><button class="secondary nowrap" data-edit-student-session="${k}">보기 · 수정</button><button class="recordDelete" data-delete-session="${k}">삭제</button></span></div>`;
  }
  function recordRowsHtml(scope){
    const dates=selectedRecordDates(scope);
    if(!dates.length)return '<div class="muted">선택한 기간의 출석 기록이 없습니다.</div>';
    const broad=ui.recordsHistoryMonth==='전체';
    if(!broad)return dates.map(k=>recordRow(k,scope)).join('');
    const groups={};
    dates.forEach(k=>{const ym=k.slice(0,7);(groups[ym] ||= []).push(k);});
    return Object.keys(groups).sort().reverse().map(ym=>{
      const [y,m]=ym.split('-');
      return `<details class="recordMonthGroup"><summary><strong>${Number(y)}년 ${Number(m)}월</strong><span>${groups[ym].length}회</span></summary><div class="recordMonthRows">${groups[ym].map(k=>recordRow(k,scope)).join('')}</div></details>`;
    }).join('');
  }
  function historyPanel(scope){
    const years=availableYears(scope);
    const currentYear=String((ui.date||todayKey()).slice(0,4));
    if(ui.recordsHistoryYear!=='전체'&&!years.includes(String(ui.recordsHistoryYear))){
      ui.recordsHistoryYear=years.includes(currentYear)?currentYear:(years[0]||currentYear);
    }
    return `<div class="card attendanceRecordCard"><div class="row"><div><div class="sectionTitle">출석 기록</div><div class="muted">필요할 때 열어 날짜별 기록을 보고 수정·삭제합니다.</div></div><button class="secondary nowrap" data-record-history-toggle>${ui.recordsHistoryOpen?'기록 닫기':'출석 기록 보기'}</button></div>${ui.recordsHistoryOpen?`<div class="recordHistoryTools"><label>연도<select class="input compactSelect" data-record-year><option value="전체" ${ui.recordsHistoryYear==='전체'?'selected':''}>전체</option>${years.map(y=>`<option value="${y}" ${String(ui.recordsHistoryYear)===y?'selected':''}>${y}년</option>`).join('')}</select></label><label>월<select class="input compactSelect" data-record-month><option value="전체" ${ui.recordsHistoryMonth==='전체'?'selected':''}>전체</option>${Array.from({length:12},(_,i)=>String(i+1)).map(m=>`<option value="${m}" ${String(ui.recordsHistoryMonth)===m?'selected':''}>${m}월</option>`).join('')}</select></label></div><div class="recordExportRow"><button class="secondary nowrap" data-record-export="xlsx">Excel 내보내기</button><button class="secondary nowrap" data-record-export="txt">TXT 내보내기</button></div><div class="recordHistoryList">${recordRowsHtml(scope)}</div>`:''}</div>`;
  }
  function exportRows(scope){
    const rows=[['날짜','학생ID','이름','학년','상태','지각','새친구','비고']];
    selectedRecordDates(scope).slice().sort().forEach(k=>{
      storedRows(k,scope).forEach(({id,st,a})=>{
        const present=typeof a.present==='boolean'?a.present:['present','late','new'].includes(a.status);
        rows.push([k,id,st.name||'',st.grade||'',present?'출석':'결석',(a.late||a.status==='late')?'지각':'',(a.newcomer||a.status==='new')?'새친구':'',a.memo||'']);
      });
    });
    return rows;
  }
  function safeFilePart(v){return String(v||'전체').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,'_');}
  function exportFiltered(scope,kind){
    const rows=exportRows(scope);
    if(rows.length===1)return toast('선택한 기간에 내보낼 출석 기록이 없습니다.');
    const period=`${ui.recordsHistoryYear||'전체'}-${ui.recordsHistoryMonth||'전체'}`;
    const base=`출석기록_${safeFilePart(scopeLabel(scope))}_${safeFilePart(period)}`;
    if(kind==='xlsx'){
      if(typeof XLSX==='undefined')return toast('Excel 모듈을 불러오지 못했습니다.');
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'학생 출석');
      XLSX.writeFile(wb,`${base}.xlsx`);
      toast(`출석 Excel을 만들었습니다. · ${rows.length-1}건`);
      return;
    }
    const text='\uFEFF'+rows.map(r=>r.map(v=>String(v??'').replace(/\t/g,' ')).join('\t')).join('\n');
    download(`${base}.txt`,text,'text/plain;charset=utf-8');
    toast(`출석 TXT를 만들었습니다. · ${rows.length-1}건`);
  }

  recordsView = function(){
    const dates=analyticsDates(ui.analyticsRange);
    const choices=scopeChoices(true);
    let scope=ui.analyticsScope||'전체';
    if(!choices.includes(scope)){scope=state.settings.managementScope||'전체';if(!choices.includes(scope))scope='전체';ui.analyticsScope=scope;}
    const baseList=scopeStudents(scope);
    const dir=ui.attendanceRateSort==='high'?-1:1;
    const list=[...baseList].sort((a,b)=>{
      const ar=rateFor(a,dates),br=rateFor(b,dates);
      if(ar===null&&br===null)return koName(a,b);
      if(ar===null)return 1;
      if(br===null)return -1;
      if(ar!==br)return (ar-br)*dir;
      return koName(a,b);
    });
    const totalMarked=baseList.reduce((n,st)=>n+studentAnalytics(st,dates).checked,0);
    const totalAtt=baseList.reduce((n,st)=>n+studentAnalytics(st,dates).attended,0);
    const focus=baseList.filter(st=>{const a=studentAnalytics(st,dates);return a.currentAbs>=2||(a.checked>=3&&a.attended/a.checked<=0.5);});
    return `${state.settings.adminMode?`<div class="recordsModeRow ${state.settings.profileAccess==='youth'?'single':''}"><button class="dashLaunch" data-act="openDashboard">▣ 부서 현황</button>${state.settings.profileAccess!=='youth'?'<button class="studentAnalysisLaunch" data-act="openStudentAnalysis">◉ 학생 분석</button>':''}</div>`:''}
      <div class="chips recordRangeChips">${['이번 달','지난 달','최근 3개월','최근 6개월','전체'].map(v=>`<button class="chip ${ui.analyticsRange===v?'active':''}" data-record-range="${v}">${v}</button>`).join('')}</div>
      ${scopeChoiceHtml('records',scope,true)}
      <section class="hero"><div class="heroGrid"><div><div class="big">${totalMarked?Math.round(totalAtt/totalMarked*100):0}<span>%</span></div><div class="heroLabel">기록된 출석 기준</div></div><div class="heroRight"><strong>${focus.length}명</strong><div class="heroLabel">최근 집중 확인</div></div></div></section>
      <div class="sectionHead"><div><div class="sectionTitle">학생별 출석 흐름</div><div class="muted">${scopeLabel(scope)}의 출석 흐름을 봅니다.</div></div></div>
      <div class="sortBar attendanceRateSort"><span>출석률 정렬</span><button class="sortBtn ${ui.attendanceRateSort==='high'?'active':''}" data-attendance-rate-sort="high">↓ 높은 순</button><button class="sortBtn ${ui.attendanceRateSort==='low'?'active':''}" data-attendance-rate-sort="low">↑ 낮은 순</button></div>
      <div class="list">${list.map(st=>{const a=studentAnalytics(st,dates);const detail=dates.slice(-8).map(k=>{const raw=state.sessions[k]?.attendance?.[st.id];if(!raw)return `${k.slice(5).replace('-','/')} ·`;const aa=att(st,k);return `${k.slice(5).replace('-','/')} ${aa.present?(aa.late?'△':'✓'):'—'}`}).join('  ');return `<button class="recordCard" data-detail="${st.id}"><span><strong>${esc(st.name)}</strong><small>${esc(st.grade||'학년 미지정')} · ${a.attended}/${a.checked||0}회</small></span><span class="recordRate">${a.checked?Math.round(a.attended/a.checked*100):0}%</span><span class="recordDates">${detail||'기록 없음'}</span>${a.currentAbs>=2?`<span class="warning">최근 ${a.currentAbs}회 연속 결석</span>`:''}</button>`}).join('')||'<div class="empty">표시할 학생이 없습니다.</div>'}</div>
      ${historyPanel(scope)}`;
  };

  const priorBind_v1539=bind;
  bind=function(){
    priorBind_v1539();
    document.querySelectorAll('[data-attendance-rate-sort]').forEach(b=>b.onclick=()=>{ui.attendanceRateSort=b.dataset.attendanceRateSort;render();});
    document.querySelectorAll('[data-record-range]').forEach(b=>b.onclick=()=>{ui.analyticsRange=b.dataset.recordRange;render();});
    document.querySelectorAll('[data-record-history-toggle]').forEach(b=>b.onclick=()=>{ui.recordsHistoryOpen=!ui.recordsHistoryOpen;render();});
    document.querySelectorAll('[data-record-year]').forEach(el=>el.onchange=()=>{ui.recordsHistoryYear=el.value;render();});
    document.querySelectorAll('[data-record-month]').forEach(el=>el.onchange=()=>{ui.recordsHistoryMonth=el.value;render();});
    document.querySelectorAll('[data-record-export]').forEach(b=>b.onclick=()=>exportFiltered(ui.analyticsScope||'전체',b.dataset.recordExport));
  };
})();
