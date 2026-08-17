/* v1.5.2.1 — SINGLE STUDENT DETAIL RENDERER
   Purpose: restore the saved-information summary and keep the three edit sections collapsed.
   This file only overrides the student-detail modal presentation.
   Attendance/talent/teacher/import/datapack logic is untouched.
*/
(function(){
  const fallbackModalHtml = modalHtml;
  const has=v=>v!==undefined&&v!==null&&String(v).trim()!=='';
  const phoneOnly=v=>String(v||'').replace(/[^0-9+]/g,'');
  const phoneSvg='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.62 10.79a15.46 15.46 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z"/></svg>';
  const smsSvg='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 3v-4.5A2 2 0 0 1 2 16V6a2 2 0 0 1 2-2Zm2 5v2h12V9H6Zm0 4v2h8v-2H6Z"/></svg>';

  function infoRow(label,value,cls=''){
    if(!has(value))return '';
    return `<div class="sdInfoRow ${cls}"><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`;
  }
  function contactList(st){
    let list=[];
    try{ if(typeof v14StudentContacts==='function') list=v14StudentContacts(st)||[]; }catch(_){ }
    if(!list.length){
      if(st.phone) list.push({name:st.name||'',relation:'학생',phone:st.phone});
      if(st.parentPhone) list.push({name:st.parentName||'',relation:st.parentRelation||'보호자',phone:st.parentPhone});
      if(st.parent2Phone) list.push({name:st.parent2Name||'',relation:st.parent2Relation||'보호자',phone:st.parent2Phone});
      (st.extraContacts||[]).forEach(c=>{if(c?.phone)list.push({name:c.name||'',relation:c.relation||'가족·친척',phone:c.phone})});
    }
    const seen=new Set();
    return list.filter(c=>{
      const p=phoneOnly(c.phone); if(!p)return false;
      const k=[p,c.relation||'',c.name||''].join('|'); if(seen.has(k))return false; seen.add(k); return true;
    });
  }
  function contactRow(c){
    const p=phoneOnly(c.phone); if(!p)return '';
    const title=[c.relation||'연락처',c.name||''].filter(Boolean).join(' · ');
    return `<div class="sdContactRow"><div><span>${esc(title)}</span><strong>${esc(c.phone)}</strong></div><div class="sdContactBtns"><a class="miniIconBtn yellow" href="tel:${p}" aria-label="${esc(title)} 전화">${phoneSvg}</a><a class="miniIconBtn" href="sms:${p}" aria-label="${esc(title)} 문자">${smsSvg}</a></div></div>`;
  }
  function summary(st){
    const tags=Array.isArray(st.tags)?st.tags.filter(Boolean).join(', '):(st.tags||'');
    const rows=[
      infoRow('이름',st.name),
      infoRow('학년',st.grade||'미지정'),
      infoRow('성별',st.gender&&st.gender!=='미지정'?st.gender:''),
      infoRow('생년월일',st.birthday),
      infoRow('담당교사',st.assignedTeacher),
      infoRow('학교',st.school),
      infoRow('주소',st.address),
      infoRow('형제관계',st.siblings),
      infoRow('부모 신앙',st.parentFaith&&st.parentFaith!=='미기재'?st.parentFaith:''),
      st.multicultural?infoRow('다문화','✓ 다문화','multi'):'',
      infoRow('기타 분류',tags),
      infoRow('메모',st.memo,'memo')
    ].filter(Boolean).join('');
    const cs=contactList(st).map(contactRow).join('');
    return `<section class="manageCard sdSummary"><div class="manageCardTitle"><strong>등록된 학생정보</strong><small>현재 저장된 내용을 한눈에 확인합니다.</small></div><div class="sdInfoGrid">${rows}</div>${cs?`<div class="sdContactsTitle">전화 · 문자</div><div class="sdContacts">${cs}</div>`:''}</section>`;
  }
  function gradeButtons(st){
    const current=st.grade||'미지정';
    return ['미지정','4학년','5학년','6학년'].map(g=>`<button class="${current===g?'active':''}" data-quick-grade="${g}" data-id="${st.id}">${g}</button>`).join('');
  }
  function familyRows(st){
    const arr=[];
    if(st.parentName||st.parentRelation||st.parentPhone)arr.push({name:st.parentName||'',relation:st.parentRelation||'',phone:st.parentPhone||''});
    if(st.parent2Name||st.parent2Relation||st.parent2Phone)arr.push({name:st.parent2Name||'',relation:st.parent2Relation||'',phone:st.parent2Phone||''});
    (st.extraContacts||[]).forEach(c=>{if(c&&(c.name||c.relation||c.phone))arr.push(c)});
    return arr.map(c=>`<div class="familyContactRow" data-family-contact><div class="familyContactFields"><input class="input familyName" placeholder="이름" value="${attr(c.name||'')}"><input class="input familyRelation" list="relationPresets" placeholder="관계 (부/모/고모 등)" value="${attr(c.relation||'')}"><input class="input familyPhone" inputmode="tel" placeholder="전화번호" value="${attr(c.phone||'')}"></div><div class="familyContactTools"><button type="button" class="contactOrderBtn" data-contact-move="up" aria-label="위로">↑</button><button type="button" class="contactOrderBtn" data-contact-move="down" aria-label="아래로">↓</button><button type="button" class="contactDeleteBtn" data-contact-delete aria-label="삭제">삭제</button></div></div>`).join('');
  }
  function recentAttendance(st){
    const keys=Object.keys(state.sessions||{}).filter(k=>{
      const sess=state.sessions?.[k];
      const recorded=typeof attendanceSessionRecorded==='function'?attendanceSessionRecorded(k):!!sess;
      return recorded && sess?.attendance && Object.prototype.hasOwnProperty.call(sess.attendance,st.id);
    }).sort((a,b)=>String(b).localeCompare(String(a))).slice(0,5);
    if(!keys.length)return `<div class="card"><div class="sectionTitle">최근 출석</div><div class="muted">출석 기록 없음</div></div>`;
    const present=keys.filter(k=>att(st,k).present).length;
    const rows=keys.map(k=>{const a=att(st,k);return `<div class="history"><span><strong>${displayDate(k)}</strong><small>${esc(a.memo||'')}</small></span><strong>${statusLabel(a.status)}</strong></div>`}).join('');
    return `<div class="card"><div class="sectionTitleRow"><div class="sectionTitle">최근 출석</div><span class="attendanceMiniSummary">최근 ${keys.length}회 ${present}회 출석</span></div>${rows}<button class="secondary fullBtn" data-student-att-full="${st.id}">출석 기록 전체보기 ›</button></div>`;
  }

  modalHtml=function(){
    if(ui.modal?.type!=='detail')return fallbackModalHtml();
    const st=studentById(ui.modal.id); if(!st)return '';
    try{if(typeof v14EnsureStudent==='function')v14EnsureStudent(st);}catch(_){ }
    const close='<button class="icon" data-act="closeModal">×</button>';
    const logs=[...(st.visitLogs||[])].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    return modal(`<div class="modalTitleRow studentManageHead"><div class="detailHead">${st.photo?avatar(st,'detailPhoto'):'<div class="detailPhoto photoPlaceholder">사진</div>'}<div><div class="titleSmall">${esc(st.name)}</div><div class="muted">${esc(st.grade||'학년 미지정')}${st.assignedTeacher?' · '+esc(st.assignedTeacher):''}</div></div></div>${close}</div>
      <div class="detailActions"><button class="secondary" data-act="photo" data-id="${st.id}">${st.photo?'사진 변경':'사진 추가'}</button></div>
      ${summary(st)}
      <details class="sdEdit"><summary><span><strong>기본정보</strong><small>이름 · 학년 · 생년월일 · 담당교사</small></span><b></b></summary><div class="sdEditBody"><label class="fieldLabel">이름<input id="dName" class="input" value="${attr(st.name||'')}"></label><div class="quickGradeCard inlineGrade"><div><strong>학년</strong></div><div class="quickGradeButtons">${gradeButtons(st)}</div></div><div class="formGrid"><label class="fieldLabel">성별<select id="dGender" class="input"><option ${!st.gender||st.gender==='미지정'?'selected':''}>미지정</option><option ${st.gender==='남'?'selected':''}>남</option><option ${st.gender==='여'?'selected':''}>여</option></select></label><label class="fieldLabel">생년월일<input id="dBirthday" class="input" inputmode="text" placeholder="예: 2016-07-22" value="${attr(st.birthday||'')}"></label></div><label class="fieldLabel">담당교사<input id="dAssignedTeacher" class="input" value="${attr(st.assignedTeacher||'')}"></label><div class="formGrid"><label class="fieldLabel">부모 신앙<select id="dParentFaith" class="input"><option ${!st.parentFaith||st.parentFaith==='미기재'?'selected':''}>미기재</option><option ${st.parentFaith==='신자'?'selected':''}>신자</option><option ${st.parentFaith==='비신자'?'selected':''}>비신자</option></select></label><label class="fieldLabel">다문화<select id="dMulticultural" class="input"><option value="no" ${!st.multicultural?'selected':''}>해당 없음</option><option value="yes" ${st.multicultural?'selected':''}>✓ 다문화</option></select></label></div></div></details>
      <details class="sdEdit"><summary><span><strong>연락처</strong><small>학생 · 부모 · 보호자 · 친척</small></span><b></b></summary><div class="sdEditBody"><label class="fieldLabel">학생 전화<input id="dPhone" class="input" inputmode="tel" value="${attr(st.phone||'')}"></label><datalist id="relationPresets"><option value="부"><option value="모"><option value="할머니"><option value="할아버지"><option value="외할머니"><option value="외할아버지"><option value="고모"><option value="이모"><option value="삼촌"><option value="기타"></datalist><div id="familyContactRows">${familyRows(st)}</div><button type="button" class="secondary fullBtn" data-contact-add>+ 가족·친척 연락처 추가</button></div></details>
      <details class="sdEdit"><summary><span><strong>추가정보</strong><small>학교 · 주소 · 형제관계 · 분류 · 메모</small></span><b></b></summary><div class="sdEditBody"><input id="dSchool" class="input" placeholder="학교" value="${attr(st.school||'')}"><input id="dSiblings" class="input" placeholder="형제관계" value="${attr(st.siblings||'')}"><input id="dAddress" class="input" placeholder="주소" value="${attr(st.address||'')}"><input id="dTags" class="input" placeholder="기타 분류 · 쉼표로 구분" value="${attr((st.tags||[]).join(', '))}"><textarea id="dMemo" class="input textarea" placeholder="학생 기본 메모">${esc(st.memo||'')}</textarea></div></details>
      <button class="primary fullBtn studentSaveBar" data-act="saveStudentInline" data-id="${st.id}">학생 정보 저장</button>
      <div class="visitBox recoveryVisit"><div class="visitBoxHead"><div><strong>심방 · 연락 기록</strong><small>작성일이 자동으로 쌓입니다.</small></div><button class="quickVisit" data-act="quickVisit" data-id="${st.id}">오늘 심방</button></div><div class="visitEntry"><input id="visitDate" class="input" type="date" value="${todayKey()}"><textarea id="visitMemo" class="input textarea" placeholder="통화, 문자, 심방 내용"></textarea><button class="primary" data-act="addVisit" data-id="${st.id}">기록 추가</button></div>${logs.map(x=>`<div class="visitLog"><div><strong>${esc(x.date)}</strong><p>${esc(x.note||'')}</p></div><button data-act="deleteVisit" data-id="${st.id}" data-visit="${x.id}">삭제</button></div>`).join('')||'<div class="visitEmpty">아직 심방/연락 기록이 없습니다.</div>'}</div>
      ${recentAttendance(st)}
      <div class="dangerZone studentDanger"><strong>명단 관리</strong><small>잘못 등록한 학생은 여기서 정리합니다.</small><button class="secondary fullBtn" data-act="deactivateStudent" data-id="${st.id}">명단에서 제외</button><button class="danger fullBtn" data-act="deleteStudentHard" data-id="${st.id}">학생 완전 삭제</button></div>`);
  };

  const style=document.createElement('style');
  style.textContent=`
    .sdSummary{background:#fff;border:1.5px solid #1b1b1b}.sdInfoGrid{margin-top:6px;border-top:1px solid #dedbd3}.sdInfoRow{display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;padding:9px 0;border-bottom:1px solid #ece9e2}.sdInfoRow span{font-size:12px;font-weight:850;color:#777269}.sdInfoRow strong{font-size:14px;line-height:1.45;color:#171717;overflow-wrap:anywhere}.sdInfoRow.multi strong{display:inline-flex;width:max-content;padding:3px 9px;border:1.5px solid #111;border-radius:999px;background:#ffd21f}.sdInfoRow.memo strong{white-space:pre-wrap}.sdContactsTitle{font-size:13px;font-weight:950;margin-top:14px;padding-top:12px;border-top:2px solid #1b1b1b}.sdContactRow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #ece9e2}.sdContactRow>div:first-child{display:grid;gap:2px}.sdContactRow span{font-size:12px;font-weight:850;color:#777269}.sdContactRow strong{font-size:14px}.sdContactBtns{display:flex;gap:6px}.sdEdit{margin-top:12px;border:1.5px solid #d8d3c9;border-radius:20px;background:#fff;overflow:hidden}.sdEdit>summary{list-style:none;display:flex;justify-content:space-between;align-items:center;padding:16px 18px;cursor:pointer}.sdEdit>summary::-webkit-details-marker{display:none}.sdEdit>summary span{display:grid;gap:3px}.sdEdit>summary strong{font-size:17px;font-weight:950}.sdEdit>summary small{font-size:11px;color:#777269}.sdEdit>summary b:before{content:'+';font-size:24px}.sdEdit[open]>summary b:before{content:'−'}.sdEditBody{display:grid;gap:10px;padding:0 14px 14px}@media(max-width:430px){.sdInfoRow{grid-template-columns:76px minmax(0,1fr)}.sdEdit>summary{padding:15px 16px}}
  `;
  document.head.appendChild(style);
})();
