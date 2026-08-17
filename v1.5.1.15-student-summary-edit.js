/* v1.5.1.15 — STUDENT DETAIL SUMMARY + COLLAPSED EDIT ONLY
   FREEZE: no attendance/talent/teacher/import/datapack behavior changes.
   - Top "등록된 학생정보" shows every saved student field that has a value.
   - Student / guardian / relative contacts show relation + name + phone + call/SMS.
   - Existing Basic Info / Contacts / Additional Info editors remain the same data fields,
     but are collapsed under one "정보 수정" disclosure by default.
*/
(function(){
  const previousModalHtml = modalHtml;

  function has(v){ return v !== undefined && v !== null && String(v).trim() !== ''; }
  function cleanPhone(v){ return String(v||'').replace(/[^0-9+]/g,''); }
  function row(label, value, cls=''){
    if(!has(value)) return '';
    return `<div class="studentSummaryRow ${cls}"><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`;
  }
  const phoneSvg='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.62 10.79a15.46 15.46 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z"/></svg>';
  const smsSvg='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 3v-4.5A2 2 0 0 1 2 16V6a2 2 0 0 1 2-2Zm2 5v2h12V9H6Zm0 4v2h8v-2H6Z"/></svg>';
  function contactRow(label, name, phone){
    if(!has(name) && !has(phone)) return '';
    const p=cleanPhone(phone);
    const who=[label, name].filter(has).join(' · ');
    return `<div class="studentSummaryContact"><div><span>${esc(who||'연락처')}</span>${has(phone)?`<strong>${esc(phone)}</strong>`:''}</div>${p?`<div class="studentSummaryContactBtns"><a class="miniIconBtn yellow" href="tel:${p}" aria-label="${esc(who||'연락처')} 전화">${phoneSvg}</a><a class="miniIconBtn" href="sms:${p}" aria-label="${esc(who||'연락처')} 문자">${smsSvg}</a></div>`:''}</div>`;
  }
  function familyContacts(st){
    const out=[];
    if(has(st.parentName)||has(st.parentRelation)||has(st.parentPhone)) out.push({name:st.parentName||'', relation:st.parentRelation||'보호자', phone:st.parentPhone||''});
    if(has(st.parent2Name)||has(st.parent2Relation)||has(st.parent2Phone)) out.push({name:st.parent2Name||'', relation:st.parent2Relation||'보호자', phone:st.parent2Phone||''});
    for(const c of (st.extraContacts||[])) if(c && (has(c.name)||has(c.relation)||has(c.phone))) out.push({name:c.name||'', relation:c.relation||'가족·친척', phone:c.phone||''});
    return out;
  }
  function removeOldReadOnlyCards(html){
    return html.replace(/<section class="manageCard studentInfoViewCard"[\s\S]*?<\/section>/g,'');
  }

  modalHtml = function(){
    let html = previousModalHtml();
    if(ui.modal?.type !== 'detail') return html;
    const st = studentById(ui.modal.id);
    if(!st) return html;

    html = removeOldReadOnlyCards(html);

    const tags = Array.isArray(st.tags) ? st.tags.filter(Boolean).join(', ') : (st.tags||'');
    const infoRows = [
      row('이름', st.name),
      row('학년', st.grade && st.grade !== '미지정' ? st.grade : '미지정'),
      row('성별', st.gender && st.gender !== '미지정' ? st.gender : ''),
      row('생년월일', st.birthday),
      row('담당교사', st.assignedTeacher),
      row('학교', st.school),
      row('주소', st.address),
      row('형제관계', st.siblings),
      row('부모 신앙', st.parentFaith && st.parentFaith !== '미기재' ? st.parentFaith : ''),
      st.multicultural ? row('다문화', '✓ 다문화', 'multiculturalSummary') : '',
      row('기타 분류', tags),
      row('메모', st.memo, 'memoSummary')
    ].filter(Boolean).join('');

    const contacts = [
      contactRow('학생', st.name, st.phone),
      ...familyContacts(st).map(c=>contactRow(c.relation, c.name, c.phone))
    ].filter(Boolean).join('');

    const summary = `<section class="manageCard studentUnifiedSummary" data-student-unified-summary="1">
      <div class="manageCardTitle"><strong>등록된 학생정보</strong><small>입력·Excel로 저장된 정보를 한눈에 확인합니다.</small></div>
      <div class="studentUnifiedGrid">${infoRows}</div>
      ${contacts?`<div class="studentSummaryContactTitle">전화 · 문자</div><div class="studentSummaryContacts">${contacts}</div>`:''}
    </section>`;

    const basicMarker = '<section class="manageCard strongCard">';
    const basicStart = html.indexOf(basicMarker);
    if(basicStart < 0) return html;

    // Insert the single canonical read view above the existing edit controls.
    html = html.slice(0,basicStart) + summary + html.slice(basicStart);

    // Collapse the EXISTING editors under one disclosure. No duplicate inputs are created.
    const shiftedBasicStart = html.indexOf(basicMarker, basicStart + summary.length);
    const saveMarker = '<button class="primary fullBtn studentSaveBar"';
    const saveStart = html.indexOf(saveMarker, shiftedBasicStart);
    if(shiftedBasicStart >= 0 && saveStart >= 0){
      const saveEnd = html.indexOf('</button>', saveStart);
      if(saveEnd >= 0){
        const end = saveEnd + 9;
        const editable = html.slice(shiftedBasicStart, end);
        const wrapped = `<details class="studentEditDetails"><summary><strong>정보 수정</strong><span>기본정보 · 연락처 · 추가정보</span></summary><div class="studentEditBody">${editable}</div></details>`;
        html = html.slice(0, shiftedBasicStart) + wrapped + html.slice(end);
      }
    }
    return html;
  };

  const style=document.createElement('style');
  style.textContent=`
    .studentUnifiedSummary{background:#fff;border:1.5px solid #1d1d1d}
    .studentUnifiedGrid{margin-top:8px;border-top:1px solid #dedbd3}
    .studentSummaryRow{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:start;padding:10px 2px;border-bottom:1px solid #ece9e2}
    .studentSummaryRow span{font-size:12px;font-weight:850;color:#777269}
    .studentSummaryRow strong{font-size:14px;line-height:1.5;color:#171717;overflow-wrap:anywhere;word-break:keep-all}
    .studentSummaryRow.multiculturalSummary strong{display:inline-flex;width:max-content;padding:4px 9px;border:1.5px solid #111;border-radius:999px;background:#ffd21f;font-weight:950}
    .studentSummaryRow.memoSummary strong{white-space:pre-wrap}
    .studentSummaryContactTitle{font-size:13px;font-weight:950;margin-top:16px;padding-top:14px;border-top:2px solid #1d1d1d}
    .studentSummaryContacts{display:grid;gap:8px;margin-top:8px}
    .studentSummaryContact{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #ece9e2}
    .studentSummaryContact:last-child{border-bottom:0}
    .studentSummaryContact>div:first-child{display:grid;gap:3px;min-width:0}
    .studentSummaryContact span{font-size:12px;font-weight:850;color:#777269}
    .studentSummaryContact strong{font-size:15px;color:#171717;overflow-wrap:anywhere}
    .studentSummaryContactBtns{display:flex;gap:7px;flex:0 0 auto}
    .studentEditDetails{margin-top:14px;border:1.5px solid #d5d0c6;border-radius:22px;background:#fff;overflow:hidden}
    .studentEditDetails>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;cursor:pointer}
    .studentEditDetails>summary::-webkit-details-marker{display:none}
    .studentEditDetails>summary strong{font-size:18px;font-weight:950}
    .studentEditDetails>summary span{font-size:12px;font-weight:750;color:#777269}
    .studentEditDetails>summary:after{content:'+';font-size:24px;font-weight:700;line-height:1}
    .studentEditDetails[open]>summary:after{content:'−'}
    .studentEditBody{padding:0 12px 12px}
    .studentEditBody>.manageCard{margin-top:10px}
    @media(max-width:430px){
      .studentSummaryRow{grid-template-columns:78px minmax(0,1fr)}
      .studentEditDetails>summary{padding:16px}
      .studentEditDetails>summary span{display:none}
    }
  `;
  document.head.appendChild(style);
})();
