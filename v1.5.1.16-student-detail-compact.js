/* v1.5.1.16 — STUDENT DETAIL COMPACT VIEW FIX
   FREEZE: attendance/talent/teacher/import/datapack behavior is untouched.
   Fixes only student-detail presentation:
   1) '등록된 학생정보' shows all saved values, including student/guardian/relative phones.
   2) Basic info / Contacts / Additional info editors are collapsed separately on mobile.
   3) The same stored fields are edited; no duplicate storage is introduced.
*/
(function(){
  const previousModalHtml = modalHtml;
  const phoneSvg='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.62 10.79a15.46 15.46 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z"/></svg>';
  const smsSvg='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 3v-4.5A2 2 0 0 1 2 16V6a2 2 0 0 1 2-2Zm2 5v2h12V9H6Zm0 4v2h8v-2H6Z"/></svg>';

  const has=v=>v!==undefined&&v!==null&&String(v).trim()!=='';
  const cleanPhone=v=>String(v||'').replace(/[^0-9+]/g,'');
  function infoRow(label,value,extra=''){
    if(!has(value)) return '';
    return `<div class="compactStudentInfoRow ${extra}"><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`;
  }
  function contactRow(c){
    if(!c || !has(c.phone)) return '';
    const p=cleanPhone(c.phone);
    const rel=has(c.relation)?c.relation:'연락처';
    const name=has(c.name)?c.name:'';
    const title=[rel,name].filter(Boolean).join(' · ');
    return `<div class="compactStudentContactRow"><div class="compactStudentContactText"><span>${esc(title)}</span><strong>${esc(c.phone)}</strong></div><div class="compactStudentContactActions"><a class="miniIconBtn yellow" href="tel:${p}" aria-label="${esc(title)} 전화">${phoneSvg}</a><a class="miniIconBtn" href="sms:${p}" aria-label="${esc(title)} 문자">${smsSvg}</a></div></div>`;
  }
  function canonicalContacts(st){
    // Use the app's canonical contact adapter first so legacy/imported fields also appear.
    let list=[];
    try{ if(typeof v14StudentContacts==='function') list=v14StudentContacts(st)||[]; }catch(_){ }
    if(!list.length){
      if(st.phone) list.push({name:st.name||'',relation:'학생',phone:st.phone});
      if(st.parentPhone) list.push({name:st.parentName||'',relation:st.parentRelation||'보호자',phone:st.parentPhone});
      if(st.parent2Phone) list.push({name:st.parent2Name||'',relation:st.parent2Relation||'보호자',phone:st.parent2Phone});
      for(const c of (st.extraContacts||[])) if(c?.phone) list.push({name:c.name||'',relation:c.relation||'가족·친척',phone:c.phone});
    }
    const seen=new Set();
    return list.filter(c=>{
      const key=cleanPhone(c.phone)+'|'+String(c.relation||'')+'|'+String(c.name||'');
      if(!cleanPhone(c.phone)||seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  function buildSummary(st){
    const tags=Array.isArray(st.tags)?st.tags.filter(Boolean).join(', '):(st.tags||'');
    const rows=[
      infoRow('이름',st.name),
      infoRow('학년',st.grade||'미지정'),
      infoRow('성별',st.gender && st.gender!=='미지정'?st.gender:''),
      infoRow('생년월일',st.birthday),
      infoRow('담당교사',st.assignedTeacher),
      infoRow('학교',st.school),
      infoRow('주소',st.address),
      infoRow('형제관계',st.siblings),
      infoRow('부모 신앙',st.parentFaith && st.parentFaith!=='미기재'?st.parentFaith:''),
      st.multicultural?infoRow('다문화','✓ 다문화','isMulticultural'):'',
      infoRow('기타 분류',tags),
      infoRow('메모',st.memo,'isMemo')
    ].filter(Boolean).join('');
    const contacts=canonicalContacts(st).map(contactRow).join('');
    return `<section class="manageCard compactStudentSummary" data-student-unified-summary="1"><div class="manageCardTitle"><strong>등록된 학생정보</strong><small>저장된 내용을 바로 확인합니다.</small></div><div class="compactStudentInfoGrid">${rows}</div>${contacts?`<div class="compactStudentContactsTitle">전화 · 문자</div><div class="compactStudentContacts">${contacts}</div>`:''}</section>`;
  }
  function makeDisclosure(title,subtitle,node,open=false){
    const d=document.createElement('details');
    d.className='studentSectionDisclosure';
    if(open) d.open=true;
    const s=document.createElement('summary');
    s.innerHTML=`<span><strong>${title}</strong><small>${subtitle}</small></span><b aria-hidden="true"></b>`;
    const body=document.createElement('div'); body.className='studentSectionDisclosureBody';
    if(node){
      if(node.tagName==='DETAILS'){
        const inner=node.querySelector('.detailsBody');
        if(inner){ while(inner.firstChild) body.appendChild(inner.firstChild); }
        else while(node.firstChild) body.appendChild(node.firstChild);
      }else body.appendChild(node);
    }
    d.append(s,body); return d;
  }

  modalHtml=function(){
    let html=previousModalHtml();
    if(ui.modal?.type!=='detail') return html;
    const st=studentById(ui.modal.id); if(!st) return html;

    const root=document.createElement('div'); root.innerHTML=html;

    // Replace whatever previous summary exists with one canonical compact summary.
    const oldSummary=root.querySelector('[data-student-unified-summary], .studentUnifiedSummary, .studentInfoViewCard');
    const summaryHolder=document.createElement('div'); summaryHolder.innerHTML=buildSummary(st);
    const summaryNode=summaryHolder.firstElementChild;
    if(oldSummary) oldSummary.replaceWith(summaryNode);
    else{
      const firstManage=root.querySelector('.manageCard.strongCard, .contactManagerCard, .extraDetails');
      if(firstManage) firstManage.before(summaryNode);
    }

    // Unwrap the previous all-in-one edit disclosure if present.
    const allEdit=root.querySelector('.studentEditDetails');
    if(allEdit){
      const body=allEdit.querySelector('.studentEditBody');
      if(body){ while(body.firstChild) allEdit.parentNode.insertBefore(body.firstChild,allEdit); }
      allEdit.remove();
    }

    // Find the three existing editor sections. They still edit the original fields.
    const basic=root.querySelector('.manageCard.strongCard');
    const contact=root.querySelector('.manageCard.contactManagerCard') || [...root.querySelectorAll('.manageCard')].find(x=>x.querySelector('.manageCardTitle strong')?.textContent.trim()==='연락처');
    const extra=root.querySelector('details.manageCard.extraDetails') || [...root.querySelectorAll('.manageCard')].find(x=>x.querySelector('.manageCardTitle strong')?.textContent.trim()==='추가 정보');
    const save=root.querySelector('.studentSaveBar');

    // If already wrapped by an earlier run, don't wrap twice.
    if(basic && !basic.closest('.studentSectionDisclosure')) basic.replaceWith(makeDisclosure('기본정보','이름 · 학년 · 생년월일 · 담당교사',basic));
    if(contact && !contact.closest('.studentSectionDisclosure')) contact.replaceWith(makeDisclosure('연락처','학생 · 부모 · 보호자 · 친척',contact));
    if(extra && !extra.closest('.studentSectionDisclosure')) extra.replaceWith(makeDisclosure('추가정보','학교 · 주소 · 형제관계 · 분류 · 메모',extra));

    // Keep the save button after the edit sections; editing is opt-in by tapping a section.
    if(save) save.classList.add('compactStudentSave');

    return root.innerHTML;
  };

  const style=document.createElement('style');
  style.textContent=`
    .compactStudentSummary{background:#fff;border:1.5px solid #1b1b1b}
    .compactStudentInfoGrid{margin-top:6px;border-top:1px solid #dedbd3}
    .compactStudentInfoRow{display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;align-items:start;padding:9px 0;border-bottom:1px solid #ece9e2}
    .compactStudentInfoRow span{font-size:12px;font-weight:850;color:#777269}
    .compactStudentInfoRow strong{font-size:14px;line-height:1.45;color:#171717;overflow-wrap:anywhere;word-break:keep-all}
    .compactStudentInfoRow.isMulticultural strong{display:inline-flex;width:max-content;padding:3px 9px;border:1.5px solid #111;border-radius:999px;background:#ffd21f;font-weight:950}
    .compactStudentInfoRow.isMemo strong{white-space:pre-wrap}
    .compactStudentContactsTitle{font-size:13px;font-weight:950;margin-top:14px;padding-top:12px;border-top:2px solid #1b1b1b}
    .compactStudentContacts{display:grid;margin-top:4px}
    .compactStudentContactRow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #ece9e2}
    .compactStudentContactRow:last-child{border-bottom:0}
    .compactStudentContactText{display:grid;gap:2px;min-width:0}
    .compactStudentContactText span{font-size:12px;font-weight:850;color:#777269}
    .compactStudentContactText strong{font-size:14px;color:#171717;overflow-wrap:anywhere}
    .compactStudentContactActions{display:flex;gap:6px;flex:0 0 auto}
    .studentSectionDisclosure{margin-top:12px;border:1.5px solid #d8d3c9;border-radius:20px;background:#fff;overflow:hidden}
    .studentSectionDisclosure>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .studentSectionDisclosure>summary::-webkit-details-marker{display:none}
    .studentSectionDisclosure>summary span{display:grid;gap:3px}
    .studentSectionDisclosure>summary strong{font-size:17px;font-weight:950;color:#171717}
    .studentSectionDisclosure>summary small{font-size:11px;font-weight:700;color:#777269}
    .studentSectionDisclosure>summary b:before{content:'+';font-size:24px;line-height:1;font-weight:700}
    .studentSectionDisclosure[open]>summary b:before{content:'−'}
    .studentSectionDisclosureBody{padding:0 10px 10px}
    .studentSectionDisclosureBody>.manageCard{margin:0;border:0;box-shadow:none;padding:8px 4px 4px}
    .studentSectionDisclosureBody>.manageCard>.manageCardTitle{display:none}
    .studentSectionDisclosureBody>.detailsBody{padding:0}
    .compactStudentSave{margin-top:12px}
    @media(max-width:430px){
      .compactStudentInfoRow{grid-template-columns:78px minmax(0,1fr)}
      .studentSectionDisclosure>summary{padding:15px 16px}
      .studentSectionDisclosure>summary small{font-size:10px}
    }
  `;
  document.head.appendChild(style);
})();
