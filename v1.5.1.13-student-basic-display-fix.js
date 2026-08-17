/* v1.5.1.13 — STUDENT BASIC DISPLAY FIX ONLY
   FREEZE: no attendance/talent/teacher/import/datapack behavior changes.
   - Removes awkward "다문화: 해당" wording in student detail.
   - Moves the student's own phone field into 기본 정보 so it is immediately visible/editable.
   - Keeps family/guardian contacts in the existing 연락처 section.
*/
(function(){
  const previousModalHtml = modalHtml;

  function studentPhoneButtons(phone, label){
    if(!phone) return '';
    const clean = String(phone).replace(/[^0-9+]/g,'');
    const phoneSvg = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.62 10.79a15.46 15.46 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z"/></svg>';
    const smsSvg = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 3v-4.5A2 2 0 0 1 2 16V6a2 2 0 0 1 2-2Zm2 5v2h12V9H6Zm0 4v2h8v-2H6Z"/></svg>';
    return `<div class="inlineContactIcons basicPhoneIcons"><a class="miniIconBtn yellow" href="tel:${clean}" aria-label="${esc(label||'학생')} 전화">${phoneSvg}</a><a class="miniIconBtn" href="sms:${clean}" aria-label="${esc(label||'학생')} 문자">${smsSvg}</a></div>`;
  }

  modalHtml = function(){
    let html = previousModalHtml();
    if(ui.modal?.type !== 'detail') return html;
    const st = studentById(ui.modal.id);
    if(!st) return html;

    // If an older summary card is still present, never render "다문화: 해당".
    html = html.replace(
      /<div class="studentInfoViewRow"><span>다문화<\/span><strong>해당<\/strong><\/div>/g,
      '<div class="studentInfoViewRow multiculturalBadgeRow"><span></span><strong>다문화</strong></div>'
    );

    // Existing own-phone editor lives in 연락처. Move that exact field up into 기본 정보.
    const ownPhonePattern = /<div class="contactEditRow"><label class="fieldLabel grow">학생 본인<input id="dPhone" class="input" inputmode="tel" placeholder="학생 전화번호" value="[^"]*"><\/label><\/div>/;
    const ownPhonePatternLegacy = /<div class="contactEditRow"><label class="fieldLabel grow">학생 전화<input id="dPhone" class="input"[^>]* value="[^"]*"><\/label>[\s\S]*?<\/div>/;
    html = html.replace(ownPhonePattern, '');
    html = html.replace(ownPhonePatternLegacy, '');

    // Add one canonical dPhone field to 기본 정보, immediately below birthday/gender.
    if(!html.includes('data-basic-student-phone="1"')){
      const phoneRow = `<div class="contactEditRow basicStudentPhone" data-basic-student-phone="1"><label class="fieldLabel grow">학생 전화번호<input id="dPhone" class="input" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" value="${attr(st.phone||'')}"></label>${studentPhoneButtons(st.phone, st.name)}</div>`;
      const birthdayInput = /(<label class="fieldLabel">생년월일<input id="dBirthday"[\s\S]*?<\/label>)/;
      if(birthdayInput.test(html)) html = html.replace(birthdayInput, `$1${phoneRow}`);
      else {
        const assigned = '<label class="fieldLabel">담당교사';
        const idx = html.indexOf(assigned);
        if(idx >= 0) html = html.slice(0,idx) + phoneRow + html.slice(idx);
      }
    }

    // Keep the editable multicultural control wording direct and neutral.
    html = html.replace(/<option value="no"([^>]*)>미체크<\/option>/g, '<option value="no"$1>아니오</option>');
    html = html.replace(/<option value="yes"([^>]*)>다문화<\/option>/g, '<option value="yes"$1>다문화</option>');

    return html;
  };

  const style=document.createElement('style');
  style.textContent=`
    .basicStudentPhone{margin-top:10px;align-items:end}
    .basicPhoneIcons{padding-bottom:2px}
    .multiculturalBadgeRow strong{display:inline-flex;width:max-content;padding:4px 9px;border:1.5px solid #1d1d1d;border-radius:999px;background:#ffd21f;color:#111;font-weight:900}
  `;
  document.head.appendChild(style);
})();
