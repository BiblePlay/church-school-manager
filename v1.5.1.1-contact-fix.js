/* v1.5.1.1 CONTACT FIX — ONLY: grade chip labels + quick contact popup */
(function(){
  const phoneIcon=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8c1.6 3.1 3.5 5 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.7 21 3 13.3 3 3.8c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.1Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const smsIcon=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`;

  const previousStudentsView=studentsView;
  studentsView=function(){
    const html=previousStudentsView();
    if(ui.peopleMode==='teacher') return html;
    return html.replace(/(<button[^>]*data-student-quick-grade="([^"]+)"[^>]*>)[^<]*(<\/button>)/g,function(_,open,label,close){return open+label+close;});
  };

  function contactsFor(st){
    const rows=[];
    if(st.phone) rows.push({who:'학생',name:st.name||'학생',phone:st.phone});
    if(st.parentPhone) rows.push({who:st.parentRelation||'보호자',name:st.parentName||'보호자 1',phone:st.parentPhone});
    if(st.parent2Phone) rows.push({who:st.parent2Relation||'보호자',name:st.parent2Name||'보호자 2',phone:st.parent2Phone});
    (st.extraContacts||[]).forEach(c=>{if(c&&c.phone)rows.push({who:c.relation||'기타',name:c.name||'가족·친척',phone:c.phone});});
    return rows;
  }

  const previousModalHtml=modalHtml;
  modalHtml=function(){
    if(ui.modal?.type==='quickContact'){
      const st=studentById(ui.modal.id); if(!st) return '';
      const rows=contactsFor(st);
      const close=`<button class="icon" data-act="closeModal">×</button>`;
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${esc(st.name)}</div><div class="muted">${esc(st.grade||'학년 미지정')} · 연락처</div></div>${close}</div>
        <div class="quickContactList">${rows.map(c=>`<div class="quickContactRow"><div class="quickContactWho"><strong>${esc(c.name)}</strong><small>${esc(c.who)} · ${esc(c.phone)}</small></div><div class="quickContactActs"><a class="miniIconBtn yellow" href="tel:${phoneUri(c.phone)}" aria-label="${esc(c.name)} 전화">${phoneIcon}</a><a class="miniIconBtn" href="sms:${phoneUri(c.phone)}" aria-label="${esc(c.name)} 문자">${smsIcon}</a></div></div>`).join('')||'<div class="empty">등록된 연락처가 없습니다.<br><small>학생 상세에서 연락처를 추가할 수 있습니다.</small></div>'}</div>
        <button class="primary fullBtn" data-open-full-detail="${st.id}">학생 상세보기</button>`);
    }
    return previousModalHtml();
  };

  const previousBind=bind;
  bind=function(){
    previousBind();
    document.querySelectorAll('[data-detail]').forEach(b=>{
      if(ui.tab==='students' || ui.tab==='attendance'){
        b.onclick=()=>{ui.modal={type:'quickContact',id:b.dataset.detail};render();};
      }
    });
    document.querySelectorAll('[data-open-full-detail]').forEach(b=>b.onclick=()=>{ui.modal={type:'detail',id:b.dataset.openFullDetail};render();});
  };

  render();
})();
