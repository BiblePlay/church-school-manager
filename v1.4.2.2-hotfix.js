/* v1.4.2.2 HOTFIX — record controls + quick student grade assignment */
(function(){
  // Student detail: expose grade assignment in the detail screen itself.
  const _modalHtml1422 = modalHtml;
  modalHtml = function(){
    if(ui.modal?.type === 'detail'){
      const st = studentById(ui.modal.id);
      if(!st) return '';
      v14EnsureStudent(st);
      const closeDefault = `<button class="icon" data-act="closeModal">×</button>`;
      const contacts = v14StudentContacts(st);
      const logs = [...(st.visitLogs||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      const attendanceHistory = Object.keys(state.sessions).sort().reverse().filter(k=>state.sessions[k]?.attendance?.[st.id]).slice(0,10);
      const gradeChoices = ['미지정','4학년','5학년','6학년'];
      const currentGrade = st.grade || '미지정';
      return modal(`<div class="modalTitleRow"><div class="detailHead">${st.photo?avatar(st,'detailPhoto'):'<div class="detailPhoto photoPlaceholder">사진</div>'}<div><div class="titleSmall">${esc(st.name)}</div><div class="muted">${esc(st.grade||'학년 미지정')}${st.assignedTeacher?' · '+esc(st.assignedTeacher):''}</div></div></div>${closeDefault}</div>
        <div class="detailActions"><button class="primary" data-act="editStudent" data-id="${st.id}">정보 수정</button><button class="secondary" data-act="photo" data-id="${st.id}">${st.photo?'사진 변경':'사진 추가'}</button></div>
        <div class="quickGradeCard"><div><strong>학년</strong><small>여기서 바로 지정할 수 있습니다.</small></div><div class="quickGradeButtons">${gradeChoices.map(g=>`<button class="${currentGrade===g?'active':''}" data-quick-grade="${g}" data-id="${st.id}">${g}</button>`).join('')}</div></div>
        <div class="card kvCard">${kv('생일',st.birthday||'미기재')}${kv('성별',st.gender||'미지정')}${kv('부모 신앙',st.parentFaith||'미기재')}${kv('학교',st.school||'')}${kv('주소',st.address||'')}${kv('메모',st.memo||'')}</div>
        <div class="card"><div class="sectionTitle">전화 · 문자</div>${contacts.map(c=>`<div class="contactPerson recoveryContact"><span><strong>${esc(c.name)}</strong><small>${esc(c.relation)}</small></span><b>${esc(c.phone)}</b><a href="tel:${phoneUri(c.phone)}">전화</a><a href="sms:${phoneUri(c.phone)}">문자</a></div>`).join('')||'<div class="muted">등록된 연락처가 없습니다.</div>'}</div>
        <div class="visitBox recoveryVisit"><div class="visitBoxHead"><div><strong>심방 · 연락 기록</strong><small>작성일이 자동으로 쌓입니다.</small></div><button class="quickVisit" data-act="quickVisit" data-id="${st.id}">오늘 심방</button></div><div class="visitEntry"><input id="visitDate" class="input" type="date" value="${todayKey()}"><textarea id="visitMemo" class="input textarea" placeholder="통화, 문자, 심방 내용"></textarea><button class="primary" data-act="addVisit" data-id="${st.id}">기록 추가</button></div>${logs.map(x=>`<div class="visitLog"><div><strong>${esc(x.date)}</strong><p>${esc(x.note||'')}</p></div><button data-act="deleteVisit" data-id="${st.id}" data-visit="${x.id}">삭제</button></div>`).join('')||'<div class="visitEmpty">아직 심방/연락 기록이 없습니다.</div>'}</div>
        <div class="card"><div class="sectionTitle">최근 출석</div>${attendanceHistory.map(k=>`<div class="history"><span><strong>${displayDate(k)}</strong><small>${esc(att(st,k).memo||'')}</small></span><strong>${statusLabel(att(st,k).status)}</strong></div>`).join('')||'<div class="muted">출석 기록 없음</div>'}</div>`);
    }
    return _modalHtml1422();
  };

  // Record screen: student data is viewed by whole department or by grade.
  recordsView = function(){
    const dates = analyticsDates(ui.analyticsRange);
    const scope = ui.analyticsScope || '전체';
    const list = scope==='전체' ? active() : active().filter(s=>s.grade===scope);
    const totalMarked = list.reduce((n,st)=>n+studentAnalytics(st,dates).checked,0);
    const totalAtt = list.reduce((n,st)=>n+studentAnalytics(st,dates).attended,0);
    const focus = list.filter(st=>{const a=studentAnalytics(st,dates);return a.currentAbs>=2 || (a.checked>=3 && a.attended/a.checked<=0.5);});
    const sessionDates = Object.keys(state.sessions).filter(k=>Object.keys(state.sessions[k]?.attendance||{}).length>0).sort().reverse();
    const scopeButtons = ['전체',...grades()];
    return `${state.settings.adminMode?'<div class="recordsModeRow"><button class="dashLaunch" data-act="openDashboard">▣ 부서 현황</button></div>':''}
      <div class="chips recordRangeChips">${['이번 달','지난 달','최근 3개월','최근 6개월','전체'].map(v=>`<button class="chip ${ui.analyticsRange===v?'active':''}" data-record-range="${v}">${v}</button>`).join('')}</div>
      <div class="chips recordGradeChips">${scopeButtons.map(v=>`<button class="chip ${scope===v?'active':''}" data-record-scope="${attr(v)}">${esc(v)}</button>`).join('')}</div>
      <section class="hero"><div class="heroGrid"><div><div class="big">${totalMarked?Math.round(totalAtt/totalMarked*100):0}<span>%</span></div><div class="heroLabel">기록된 출석 기준</div></div><div class="heroRight"><strong>${focus.length}명</strong><div class="heroLabel">최근 집중 확인</div></div></div></section>
      <div class="sectionHead"><div><div class="sectionTitle">학생별 출석 흐름</div><div class="muted">${scope==='전체'?'전체 학생':'선택한 학년'}의 기록을 봅니다.</div></div></div>
      <div class="list">${list.map(st=>{const a=studentAnalytics(st,dates);const detail=dates.slice(-8).map(k=>{const raw=state.sessions[k]?.attendance?.[st.id];if(!raw)return `${k.slice(5).replace('-','/')} ·`;const aa=att(st,k);return `${k.slice(5).replace('-','/')} ${aa.present?(aa.late?'△':'✓'):'—'}`}).join('  ');return `<button class="recordCard" data-record-student="${st.id}"><span><strong>${esc(st.name)}</strong><small>${esc(st.grade||'학년 미지정')} · ${a.attended}/${a.checked||0}회</small></span><span class="recordRate">${a.checked?Math.round(a.attended/a.checked*100):0}%</span><span class="recordDates">${detail||'기록 없음'}</span>${a.currentAbs>=2?`<span class="warning">최근 ${a.currentAbs}회 연속 결석</span>`:''}</button>`}).join('')||'<div class="empty">표시할 학생이 없습니다.</div>'}</div>
      <div class="card"><div class="sectionTitle">날짜별 출석 기록</div>${sessionDates.slice(0,30).map(k=>{const ss=scope==='전체'?active():active().filter(s=>s.grade===scope);const c=attendanceCounts(ss,k);return `<div class="history historyManage"><span><strong>${esc(displayDate(k))}</strong><small>${c.present}/${ss.length} 출석</small></span><button class="recordDelete" data-delete-session="${k}">기록 삭제</button></div>`}).join('')||'<div class="muted">출석 기록이 없습니다.</div>'}</div>`;
  };

  // Bind after every render, independently of the older handlers.
  const _bind1422 = bind;
  bind = function(){
    _bind1422();
    document.querySelectorAll('[data-quick-grade]').forEach(b=>b.onclick=()=>{
      const st=studentById(b.dataset.id); if(!st)return;
      pushUndo();
      st.grade = b.dataset.quickGrade==='미지정' ? '' : normalizeGrade(b.dataset.quickGrade);
      save(); toast(`${st.name} 학생 학년을 ${st.grade||'미지정'}으로 변경했습니다.`); render();
    });
    document.querySelectorAll('[data-record-range]').forEach(b=>b.onclick=()=>{ui.analyticsRange=b.dataset.recordRange;render();});
    document.querySelectorAll('[data-record-scope]').forEach(b=>b.onclick=()=>{ui.analyticsScope=b.dataset.recordScope;render();});
    document.querySelectorAll('[data-record-student]').forEach(b=>b.onclick=()=>{ui.modal={type:'detail',id:b.dataset.recordStudent};render();});
  };

  // If an old scope no longer exists, safely fall back to whole department.
  if(ui.analyticsScope!=='전체' && !grades().includes(ui.analyticsScope)) ui.analyticsScope='전체';
  render();
})();
