/* v1.4.2.6 FOCUS — teacher detail without attendance + talent-first visual emphasis */
(function(){
  const phoneIcon=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8c1.6 3.1 3.5 5 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.7 21 3 13.3 3 3.8c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.1Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const smsIcon=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`;

  const priorModal = modalHtml;
  modalHtml = function(){
    if(ui.modal?.type==='teacherDetail'){
      const t=teacherById(ui.modal.id); if(!t)return '';
      v14EnsureTeacher(t);
      const back=`<button class="icon" data-act="backTeachers" aria-label="교사 명부로 돌아가기">‹</button>`;
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${esc(t.name)}</div><div class="muted">${esc(t.role||'담당·직함 미지정')} · ${esc(t.teacherType||'정교사')}</div></div>${back}</div>
        ${t.phone?`<div class="teacherIconBar"><a class="teacherIconBtn yellow" href="tel:${phoneUri(t.phone)}" aria-label="${esc(t.name)}에게 전화">${phoneIcon}<span>전화</span></a><a class="teacherIconBtn message" href="sms:${phoneUri(t.phone)}" aria-label="${esc(t.name)}에게 문자">${smsIcon}<span>문자</span></a></div>`:''}
        <button class="primary fullBtn" data-act="editTeacherFromDetail" data-id="${t.id}">정보 수정</button>
        <div class="card kvCard">${kv('생일',t.birthday||'미기재')}${kv('전화번호',t.phone||'미기재')}${kv('담당·직함',t.role||'미지정')}${kv('교사 분류',t.teacherType||'정교사')}${kv('공식 명단',t.officialIncluded===false?'제외':'포함')}${kv('비고',t.memo||'')}</div>
        <div class="teacherDetailHint">교사 출석은 <strong>출석 → 교사</strong>에서 임원단이 관리합니다.</div>`);
    }
    return priorModal();
  };
  render();
})();
