/* v1.4.2.3 — teacher contact icons + high-contrast switch + readable officer dashboard */
(function(){
  const phoneSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.9z"/></svg>`;
  const msgSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg>`;
  const chartSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/></svg>`;
  const calSvg = `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>`;
  const peopleSvg = `<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const coinSvg = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 9.5c0-1 1.1-1.8 2.7-1.8 1.5 0 2.6.6 3.1 1.3M15 14.4c-.4 1.1-1.6 1.9-3.2 1.9-1.6 0-2.8-.7-3.3-1.7M12 6v12"/></svg>`;
  const warnSvg = `<svg viewBox="0 0 24 24"><path d="M12 3 2.8 20h18.4L12 3z"/><path d="M12 9v5M12 17h.01"/></svg>`;

  const previousModal = modalHtml;
  modalHtml = function(){
    if(ui.modal?.type==='teacherDetail'){
      const t=teacherById(ui.modal.id); if(!t)return '';
      v14EnsureTeacher(t);
      const history=Object.keys(state.teacherSessions||{}).sort().reverse().filter(k=>teacherAtt(t,k).status!=='unset').slice(0,12);
      const back=`<button class="icon" data-act="backTeachers" aria-label="교사 명부로 돌아가기">‹</button>`;
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${esc(t.name)}</div><div class="muted">${esc(t.role||'담당·직함 미지정')} · ${esc(t.teacherType||'정교사')}</div></div>${back}</div>
        ${t.phone?`<div class="teacherIconBar"><a class="teacherIconBtn" href="tel:${phoneUri(t.phone)}" aria-label="${esc(t.name)}에게 전화">${phoneSvg}<span>전화</span></a><a class="teacherIconBtn message" href="sms:${phoneUri(t.phone)}" aria-label="${esc(t.name)}에게 문자">${msgSvg}<span>문자</span></a></div>`:''}
        <button class="primary fullBtn" data-act="editTeacherFromDetail" data-id="${t.id}">정보 수정</button>
        <div class="card kvCard">${kv('생일',t.birthday||'미기재')}${kv('전화번호',t.phone||'미기재')}${kv('담당·직함',t.role||'미지정')}${kv('교사 분류',t.teacherType||'정교사')}${kv('공식 명단',t.officialIncluded===false?'제외':'포함')}${kv('비고',t.memo||'')}</div>
        <div class="card"><div class="sectionTitle">최근 교사 출석</div>${history.map(k=>`<div class="history"><span><strong>${displayDate(k)}</strong><small>${esc(teacherAtt(t,k).reason||'')}</small></span><strong>${teacherStatusLabel(teacherAtt(t,k).status)}</strong></div>`).join('')||'<div class="muted">출석 기록 없음</div>'}</div>`);
    }
    if(ui.modal?.type==='dashboard'){
      const close=`<button class="icon" data-act="closeModal">×</button>`;
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">부서 현황</div><div class="muted">숫자 → 흐름 → 학년 순서로 확인합니다.</div></div>${close}</div><div class="chips">${scopeOptionsWithManaged().map(v=>`<button class="chip ${ui.analyticsScope===v?'active':''}" data-analytics-scope="${attr(v)}">${esc(v)}</button>`).join('')}</div>${v1423DashboardHtml()}`);
    }
    return previousModal();
  };

  function v1423DashboardHtml(){
    const scope=ui.analyticsScope||'전체';
    const stats=v14MonthStats(scope,ui.dashboardRange||6);
    const recent=stats[stats.length-1]||{rate:0,talent:0,services:0};
    const scopeStudents=scope==='전체'?active():scope==='내 담당'?scopedStudents('내 담당'):active().filter(s=>s.grade===scope);
    const focus=scopeStudents.filter(st=>{const a=studentAnalytics(st,analyticsDates('최근 3개월'));return a.currentAbs>=2;}).length;
    const totalSessions=Object.keys(state.sessions||{}).filter(k=>Object.keys(state.sessions[k]?.attendance||{}).some(id=>scopeStudents.some(s=>s.id===id))).length;
    const hasData=stats.some(x=>x.services>0);
    const gs=(state.settings.adminMode?grades():state.settings.managedGrades||[]);
    return `<div class="dashboardIntro"><span class="dashboardIntroIcon">${chartSvg}</span><div><strong>${esc(scope)} 데이터 현황</strong><small>출석 기록이 쌓이면 아래 숫자와 월별 곡선이 자동으로 계산됩니다.</small></div></div>
      <div class="dashboardMetrics">
        <div class="metricCard"><span class="metricIcon">${chartSvg}</span><label>이번 달 출석률</label><strong>${recent.rate}<small>%</small></strong><small>${recent.services?`${recent.services}회 출석 기록 기준`:'이번 달 기록 없음'}</small></div>
        <div class="metricCard"><span class="metricIcon">${calSvg}</span><label>누적 출석일</label><strong>${totalSessions}<small>회</small></strong><small>현재 범위에 저장된 출석 날짜</small></div>
        <div class="metricCard"><span class="metricIcon">${warnSvg}</span><label>확인 필요</label><strong>${focus}<small>명</small></strong><small>최근 기록에서 2회 이상 연속 결석</small></div>
        <div class="metricCard"><span class="metricIcon">${coinSvg}</span><label>이번 달 달란트</label><strong>${fmt(recent.talent)}</strong><small>현재 범위 지급·차감 합계</small></div>
      </div>
      ${hasData?`<div class="dashboardCard"><div class="dashboardHead"><strong>월별 출석률 흐름</strong><span>최근 ${ui.dashboardRange||6}개월</span></div>${v14LineChart(stats)}</div>`:`<div class="noDataDash"><strong>아직 그래프로 만들 출석 기록이 없습니다.</strong><small>출석 체크를 시작하면 월별 출석률 곡선이 이 자리에 자동으로 나타납니다.</small></div>`}
      <div class="dashboardSectionTitle"><strong>학년별 현황</strong><small>학년 카드를 누르면 해당 학년으로 전환</small></div>
      <div class="gradeDash">${gs.map(g=>{const d=v14MonthStats(g,1)[0];const ss=active().filter(s=>s.grade===g);const long=ss.filter(s=>longAbsenceInfo(s).long).length;return `<button data-analytics-scope="${attr(g)}"><span>${esc(g)}</span><strong>${d?.rate||0}%</strong><small>${ss.length}명 · 장기 ${long}명</small></button>`}).join('')||'<div class="empty">학년이 아직 지정되지 않았습니다.</div>'}</div>`;
  }

  // Replace text/square dashboard launcher with a simple chart icon without changing its action.
  const previousBind=bind;
  bind=function(){
    previousBind();
    document.querySelectorAll('.dashLaunch').forEach(b=>{
      if(!b.querySelector('svg')) b.innerHTML=`${chartSvg}<span>부서 현황</span>`;
    });
  };
  render();
})();
