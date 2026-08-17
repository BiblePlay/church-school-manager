/* v1.5.1.14 — STUDENT DETAIL VISIBILITY FIX ONLY
   FREEZE: no attendance/talent/teacher/import/datapack behavior changes.
   - Basic information remains immediately visible.
   - Additional information is always expanded when student detail opens.
   - Student phone is guaranteed to appear inside Basic Info with call/SMS buttons.
   - Multicultural status is shown as a clear, visible "✓ 다문화" choice, not vague "해당" wording.
*/
(function(){
  const previousModalHtml = modalHtml;

  function phoneUri(v){ return String(v||'').replace(/[^0-9+]/g,''); }
  const phoneSvg='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.62 10.79a15.46 15.46 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z"/></svg>';
  const smsSvg='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 3v-4.5A2 2 0 0 1 2 16V6a2 2 0 0 1 2-2Zm2 5v2h12V9H6Zm0 4v2h8v-2H6Z"/></svg>';

  function contactIcons(phone,name){
    if(!phone) return '';
    const p=phoneUri(phone);
    return `<div class="inlineContactIcons basicStudentContactIcons"><a class="miniIconBtn yellow" href="tel:${p}" aria-label="${esc(name||'학생')} 전화">${phoneSvg}</a><a class="miniIconBtn" href="sms:${p}" aria-label="${esc(name||'학생')} 문자">${smsSvg}</a></div>`;
  }

  function removeAllDPhoneRows(html){
    // Remove any previous student-own-phone row so only one canonical dPhone remains.
    html = html.replace(/<div[^>]*data-basic-student-phone="1"[^>]*>[\s\S]*?<\/div>/g, '');
    html = html.replace(/<div class="contactEditRow basicStudentPhone"[^>]*>[\s\S]*?<\/div>/g, '');
    html = html.replace(/<div class="contactEditRow"><label class="fieldLabel grow">학생(?: 본인| 전화| 전화번호)?<input id="dPhone"[\s\S]*?<\/div>/g, '');
    return html;
  }

  modalHtml = function(){
    let html = previousModalHtml();
    if(ui.modal?.type !== 'detail') return html;
    const st = studentById(ui.modal.id);
    if(!st) return html;

    // Additional info should be visible immediately, never hidden behind a disclosure click.
    html = html.replace(/<details class="manageCard extraDetails"(?![^>]*\bopen\b)>/g, '<details class="manageCard extraDetails" open>');

    // Remove vague multicultural wording in any legacy read-only row.
    html = html.replace(/<div class="studentInfoViewRow"><span>다문화<\/span><strong>해당<\/strong><\/div>/g,
      '<div class="studentInfoViewRow multiculturalVisible"><span>다문화</span><strong>✓ 다문화</strong></div>');

    // Make the editable multicultural field itself unambiguous and visually obvious.
    html = html.replace(
      /<label class="fieldLabel">다문화<select id="dMulticultural" class="input">[\s\S]*?<\/select><\/label>/,
      `<label class="fieldLabel multiculturalField">다문화 여부<select id="dMulticultural" class="input ${st.multicultural?'multiculturalOn':''}"><option value="no" ${!st.multicultural?'selected':''}>해당 없음</option><option value="yes" ${st.multicultural?'selected':''}>✓ 다문화</option></select></label>`
    );

    // Guarantee one visible/editable student phone field INSIDE Basic Info.
    html = removeAllDPhoneRows(html);
    const phoneRow = `<div class="contactEditRow basicStudentPhone" data-basic-student-phone="1"><label class="fieldLabel grow">학생 전화번호<input id="dPhone" class="input" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" value="${attr(st.phone||'')}"></label>${contactIcons(st.phone,st.name)}</div>`;

    const basicStart = html.indexOf('<section class="manageCard strongCard">');
    if(basicStart >= 0){
      const basicEnd = html.indexOf('</section>', basicStart);
      if(basicEnd >= 0){
        // Put phone just before Basic Info closes, so it is impossible to land in the Contact card.
        html = html.slice(0,basicEnd) + phoneRow + html.slice(basicEnd);
      }
    }

    return html;
  };

  const style=document.createElement('style');
  style.textContent=`
    .extraDetails[open]>.detailsBody{display:block}
    .basicStudentPhone{margin-top:12px;align-items:end}
    .basicStudentContactIcons{padding-bottom:2px;flex:0 0 auto}
    .multiculturalField .input{font-weight:850;border:1.5px solid #b8b2a7;background:#fff;color:#111}
    .multiculturalField .input.multiculturalOn{background:#ffd21f;border-color:#111;color:#111;font-weight:950}
    .multiculturalVisible strong{display:inline-flex;width:max-content;padding:4px 9px;border:1.5px solid #111;border-radius:999px;background:#ffd21f;color:#111;font-weight:950}
  `;
  document.head.appendChild(style);
})();
