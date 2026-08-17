/* v1.5.1.11 — STUDENT DETAIL LINK FIX ONLY
   FREEZE: no attendance/talent/teacher/import/datapack logic changes.
   - Uses the existing edit fields as the visible student information screen.
   - Keeps additional information expanded so saved values are visible immediately.
   - Makes birthday values from Excel visible/editable even when not ISO yyyy-mm-dd.
   - Removes the duplicated read-only summary cards added by v1.5.1.5/v1.5.1.9.
*/
(function(){
  const previousModalHtml = modalHtml;

  function stripSummaryCard(html, markerText){
    const startNeedle = '<section class="manageCard studentInfoViewCard"';
    let pos = 0;
    while((pos = html.indexOf(startNeedle, pos)) >= 0){
      const end = html.indexOf('</section>', pos);
      if(end < 0) break;
      const block = html.slice(pos, end + 10);
      if(block.includes(markerText)){
        html = html.slice(0, pos) + html.slice(end + 10);
        continue;
      }
      pos = end + 10;
    }
    return html;
  }

  modalHtml = function(){
    let html = previousModalHtml();
    if(ui.modal?.type !== 'detail') return html;
    const st = studentById(ui.modal.id);
    if(!st) return html;

    // Do not show duplicate read-only copies of fields that are already editable below.
    html = stripSummaryCard(html, '등록된 학생 정보');
    html = stripSummaryCard(html, '저장된 내용을 바로 확인합니다.');

    // Birthday imported as "3월 15일", "03/15" etc. is blank in <input type=date>.
    // Keep exactly the stored value visible/editable instead of forcing ISO format.
    html = html.replace(
      /<input id="dBirthday" class="input" type="date" value="[^"]*">/,
      `<input id="dBirthday" class="input" inputmode="text" placeholder="예: 3월 15일 또는 2016-03-15" value="${attr(st.birthday||'')}">`
    );

    // The existing additional-information editor remains the single source of truth,
    // but is open by default so users can both SEE and EDIT saved values immediately.
    html = html.replace(
      '<details class="manageCard extraDetails">',
      '<details class="manageCard extraDetails" open>'
    );

    return html;
  };
})();
