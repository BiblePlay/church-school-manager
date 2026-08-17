/* v1.5.1.5 — READ-ONLY STUDENT INFO SUMMARY ONLY
   Keeps every existing screen/logic intact.
   Adds a visible summary of already-saved student profile values above the edit fields.
*/
(function(){
  const previousModalHtml = modalHtml;

  function hasValue(v){
    return v !== undefined && v !== null && String(v).trim() !== '';
  }
  function row(label, value){
    if(!hasValue(value)) return '';
    return `<div class="studentInfoViewRow"><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`;
  }
  function boolText(v, yes='해당', no='해당 없음'){
    return v ? yes : no;
  }

  modalHtml = function(){
    const html = previousModalHtml();
    if(ui.modal?.type !== 'detail') return html;
    const st = studentById(ui.modal.id);
    if(!st) return html;

    const tags = Array.isArray(st.tags) ? st.tags.filter(Boolean).join(', ') : (st.tags || '');
    const values = [
      row('생일', st.birthday),
      row('성별', st.gender && st.gender !== '미지정' ? st.gender : ''),
      row('담당교사', st.assignedTeacher),
      row('학교', st.school),
      row('주소', st.address),
      row('형제관계', st.siblings),
      row('부모 신앙', st.parentFaith && st.parentFaith !== '미기재' ? st.parentFaith : ''),
      st.multicultural ? row('다문화', boolText(true)) : '',
      row('기타 분류', tags),
      row('메모', st.memo)
    ].filter(Boolean).join('');

    if(!values) return html;

    const summary = `<section class="manageCard studentInfoViewCard">
      <div class="manageCardTitle"><strong>등록된 학생 정보</strong><small>저장된 내용을 한눈에 확인합니다.</small></div>
      <div class="studentInfoViewGrid">${values}</div>
    </section>`;

    // Insert only a read-only summary; existing editable fields remain untouched below.
    const marker = '<section class="manageCard strongCard">';
    return html.includes(marker) ? html.replace(marker, summary + marker) : html;
  };

  const style = document.createElement('style');
  style.textContent = `
    .studentInfoViewCard{background:#fff;border:1.5px solid #1f1f1f}
    .studentInfoViewGrid{display:grid;gap:0;margin-top:8px;border-top:1px solid #dedbd3}
    .studentInfoViewRow{display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;align-items:start;padding:10px 2px;border-bottom:1px solid #ece9e2}
    .studentInfoViewRow:last-child{border-bottom:0}
    .studentInfoViewRow span{font-size:12px;font-weight:800;color:#777269}
    .studentInfoViewRow strong{font-size:14px;line-height:1.45;color:#191919;word-break:keep-all;overflow-wrap:anywhere}
  `;
  document.head.appendChild(style);
})();
