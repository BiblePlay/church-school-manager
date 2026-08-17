/* v1.5.1.9 — STUDENT SAVED INFO VISIBILITY ONLY
   FREEZE: no data/import/attendance/talent/teacher behavior changes.
   Ensures saved additional student information is visible in the detail screen
   without opening the editable "추가 정보" section.
*/
(function(){
  const previousModalHtml = modalHtml;

  function has(v){
    return v !== undefined && v !== null && String(v).trim() !== '';
  }
  function row(label,value){
    if(!has(value)) return '';
    return `<div class="studentInfoViewRow"><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`;
  }

  modalHtml = function(){
    const html = previousModalHtml();
    if(ui.modal?.type !== 'detail') return html;
    if(html.includes('data-student-saved-info="1"')) return html;
    const st = studentById(ui.modal.id);
    if(!st) return html;

    const tags = Array.isArray(st.tags) ? st.tags.filter(Boolean).join(', ') : (st.tags || '');
    const values = [
      row('학교', st.school),
      row('주소', st.address),
      row('형제관계', st.siblings),
      row('부모 신앙', st.parentFaith && st.parentFaith !== '미기재' ? st.parentFaith : ''),
      st.multicultural ? row('다문화', '해당') : '',
      row('기타 분류', tags),
      row('메모', st.memo)
    ].filter(Boolean).join('');

    if(!values) return html;

    const summary = `<section class="manageCard studentInfoViewCard" data-student-saved-info="1">
      <div class="manageCardTitle"><strong>추가 정보</strong><small>저장된 내용을 바로 확인합니다.</small></div>
      <div class="studentInfoViewGrid">${values}</div>
    </section>`;

    const markers = [
      '<section class="manageCard strongCard">',
      '<button class="primary fullBtn studentSaveBar"',
      '<div class="visitBox recoveryVisit">'
    ];
    for(const marker of markers){
      const idx = html.indexOf(marker);
      if(idx >= 0) return html.slice(0,idx) + summary + html.slice(idx);
    }
    return html;
  };

  const style = document.createElement('style');
  style.textContent = `
    .studentInfoViewCard{background:#fff;border:1.5px solid #222}
    .studentInfoViewGrid{display:grid;gap:0;margin-top:8px;border-top:1px solid #dedbd3}
    .studentInfoViewRow{display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;align-items:start;padding:10px 2px;border-bottom:1px solid #ece9e2}
    .studentInfoViewRow:last-child{border-bottom:0}
    .studentInfoViewRow span{font-size:12px;font-weight:800;color:#777269}
    .studentInfoViewRow strong{font-size:14px;line-height:1.45;color:#191919;word-break:keep-all;overflow-wrap:anywhere}
  `;
  document.head.appendChild(style);
})();
