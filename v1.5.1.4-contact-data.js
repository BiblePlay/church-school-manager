/* v1.5.1.4 CONTACT DATA MERGE
   UI FREEZE: only contact import/merge and contact editing are enhanced.
   - Relation-aware Excel contacts (부/모/고모/이모/조부모/친척...)
   - Existing contacts are preserved; incoming nonblank data updates/adds only.
   - Student contact editor supports add/delete/reorder without leaving detail screen.
*/
(function(){
  const SCALAR_FIELDS=['name','grade','gender','birthday','phone','address','school','siblings','memo','assignedTeacher','parentFaith','multicultural'];
  const RELATIONS=[
    ['외할아버지','외할아버지'],['외할머니','외할머니'],['친할아버지','할아버지'],['친할머니','할머니'],
    ['할아버지','할아버지'],['할머니','할머니'],['아버지','부'],['어머니','모'],['부친','부'],['모친','모'],
    ['고모','고모'],['이모','이모'],['삼촌','삼촌'],['외삼촌','외삼촌'],['숙모','숙모'],['고모부','고모부'],['이모부','이모부'],
    ['형','형'],['누나','누나'],['언니','언니'],['오빠','오빠'],['할아버님','할아버지'],['할머님','할머니'],['부','부'],['모','모']
  ];
  function nb(v){return v!==undefined&&v!==null&&String(v).trim()!=='';}
  function pnorm(v){return String(v||'').replace(/[^0-9+]/g,'');}
  function looksPhone(v){const p=pnorm(v);return p.length>=8;}
  function relFromLabel(v){
    const raw=String(v||'').trim(); if(!raw)return '';
    const compact=raw.replace(/[\s·ㆍ._-]/g,'');
    const bracket=compact.match(/[\(\[（]([^\)\]）]+)[\)\]）]/); if(bracket){const x=relFromLabel(bracket[1]);if(x)return x;}
    if(/학부모|부모님?|보호자/.test(compact) && !/[\(\[（]/.test(compact))return '';
    for(const [token,rel] of RELATIONS){
      if(compact===token || compact.startsWith(token+'전화') || compact.startsWith(token+'연락') || compact.startsWith(token+'휴대') || compact.startsWith(token+'핸드폰') || compact.startsWith(token+'성함') || compact.startsWith(token+'이름')) return rel;
    }
    return '';
  }
  function contactKind(label,value){
    const l=String(label||'');
    if(/전화|연락|휴대|핸드폰|phone/i.test(l))return 'phone';
    if(/성함|이름|name/i.test(l))return 'name';
    return looksPhone(value)?'phone':'name';
  }
  function nextValue(matrix,r,c,right){
    const row=matrix[r]||[];
    for(let j=c+1;j<=Math.min(right,row.length-1);j++){
      const v=cellText(row[j]); if(!v)continue;
      if(labelField(v))break;
      return v;
    }
    const row2=matrix[r+1]||[];
    for(let j=c;j<=Math.min(right,row2.length-1);j++){
      const v=cellText(row2[j]);if(!v||labelField(v))continue;return v;
    }
    return '';
  }
  function familyList(st){
    const out=[];
    if(st.parentName||st.parentRelation||st.parentPhone)out.push({name:st.parentName||'',relation:st.parentRelation||'',phone:st.parentPhone||''});
    if(st.parent2Name||st.parent2Relation||st.parent2Phone)out.push({name:st.parent2Name||'',relation:st.parent2Relation||'',phone:st.parent2Phone||''});
    for(const c of (st.extraContacts||[]))if(c&&(c.name||c.relation||c.phone))out.push({name:c.name||'',relation:c.relation||'',phone:c.phone||''});
    return out;
  }
  function dedupeContacts(list){
    const out=[];
    for(const raw of list||[]){
      const c={name:String(raw?.name||'').trim(),relation:String(raw?.relation||'').trim(),phone:String(raw?.phone||'').trim()};
      if(!c.name&&!c.relation&&!c.phone)continue;
      const pp=pnorm(c.phone);
      let hit=pp?out.find(x=>pnorm(x.phone)===pp):null;
      if(!hit&&c.name&&c.relation)hit=out.find(x=>normalize(x.name)===normalize(c.name)&&normalize(x.relation)===normalize(c.relation));
      if(hit){if(c.name)hit.name=c.name;if(c.relation)hit.relation=c.relation;if(c.phone)hit.phone=c.phone;}
      else out.push(c);
    }
    return out;
  }
  function writeFamily(st,list){
    const arr=dedupeContacts(list);
    const a=arr[0]||{},b=arr[1]||{};
    st.parentName=a.name||'';st.parentRelation=a.relation||'';st.parentPhone=a.phone||'';
    st.parent2Name=b.name||'';st.parent2Relation=b.relation||'';st.parent2Phone=b.phone||'';
    st.extraContacts=arr.slice(2);
  }
  function mergeFamily(target,incoming){
    const cur=familyList(target); const inc=familyList(incoming); let changed=false;
    for(const c of inc){
      const pp=pnorm(c.phone);
      let hit=pp?cur.find(x=>pnorm(x.phone)===pp):null;
      if(!hit&&c.relation){const sameRel=cur.filter(x=>normalize(x.relation)===normalize(c.relation));if(sameRel.length===1)hit=sameRel[0];}
      if(!hit&&c.name){const sameName=cur.filter(x=>normalize(x.name)===normalize(c.name));if(sameName.length===1)hit=sameName[0];}
      if(hit){for(const k of ['name','relation','phone'])if(nb(c[k])&&normalize(hit[k])!==normalize(c[k])){hit[k]=c[k];changed=true;}}
      else{cur.push({...c});changed=true;}
    }
    const before=JSON.stringify(familyList(target));writeFamily(target,cur);if(before!==JSON.stringify(familyList(target)))changed=true;return changed;
  }
  function mergeProfile(target,inc){
    let changes=0;
    for(const k of SCALAR_FIELDS){
      let v=inc[k]; if(k==='grade')v=normalizeGrade(v); if(!nb(v))continue;
      if(k==='multicultural'){const q=String(v).toLowerCase();v=(v===true||['1','true','yes','y','예','네','다문화','해당'].includes(q));}
      if(normalize(target[k])!==normalize(v)){target[k]=clone(v);changes++;}
    }
    if(mergeFamily(target,inc))changes++;
    if(Array.isArray(inc.tags)&&inc.tags.length&&JSON.stringify(target.tags||[])!==JSON.stringify(inc.tags)){target.tags=clone(inc.tags);changes++;}
    if(Array.isArray(inc.teams)&&inc.teams.length&&JSON.stringify(target.teams||[])!==JSON.stringify(inc.teams)){target.teams=clone(inc.teams);changes++;}
    target.active=true;v14EnsureStudent(target);return changes;
  }

  // Enrich grade-sheet block parsing with relationship-specific contact labels.
  const oldParseMatrix=parseMatrix;
  parseMatrix=function(matrix,sheetName){
    const students=oldParseMatrix(matrix,sheetName)||[]; const sg=sheetGrade(sheetName); if(!sg||!students.length)return students;
    const anchors=[];
    for(let r=0;r<matrix.length;r++)for(let c=0;c<(matrix[r]||[]).length;c++)if(labelField((matrix[r]||[])[c])==='name')anchors.push({r,c});
    for(const a of anchors){
      const rowAnchors=anchors.filter(x=>x.r===a.r&&x.c>a.c).sort((x,y)=>x.c-y.c);const right=rowAnchors.length?rowAnchors[0].c-1:Math.max(a.c+6,(matrix[a.r]||[]).length-1);
      const below=anchors.filter(x=>x.r>a.r&&x.c===a.c).sort((x,y)=>x.r-y.r);const bottom=below.length?below[0].r-1:Math.min(matrix.length-1,a.r+28);
      const name=nextValue(matrix,a.r,a.c,right);if(!validIncomingName(name))continue;
      const s=students.find(x=>normalize(x.name)===normalize(name)&&normalizeGrade(x.grade)===sg);if(!s)continue;
      const contacts=[];
      for(let r=a.r;r<=bottom;r++){
        const row=matrix[r]||[];
        for(let c=a.c;c<=Math.min(right,row.length-1);c++){
          const label=cellText(row[c]);const rel=relFromLabel(label);if(!rel)continue;
          const value=nextValue(matrix,r,c,right);if(!value)continue;
          let item=contacts.find(x=>x.relation===rel);if(!item){item={name:'',relation:rel,phone:''};contacts.push(item);}
          const kind=contactKind(label,value);if(kind==='phone')item.phone=value;else item.name=value;
        }
      }
      // Also parse compact values such as "김OO(모) 010-..." when they appear near contact labels.
      for(let r=a.r;r<=bottom;r++)for(let c=a.c;c<=Math.min(right,(matrix[r]||[]).length-1);c++){
        const v=cellText((matrix[r]||[])[c]);if(!v||!looksPhone(v))continue;
        const m=v.match(/^(.+?)[\s·]*[\(\[（]([^\)\]）]+)[\)\]）][\s·]*(0\d[0-9\-\s]{7,})$/);if(!m)continue;
        contacts.push({name:m[1].trim(),relation:relFromLabel(m[2])||m[2].trim(),phone:m[3].trim()});
      }
      const existing=familyList(s); writeFamily(s,existing.concat(contacts));
    }
    return students;
  };

  // Preview counts true contact/profile changes too.
  analyzeIncoming=function(students){
    let newCount=0,updateCount=0,unchangedCount=0,missingCount=0,changeFields=0,ambiguousCount=0;const matched=new Set();
    for(const n of students||[]){
      const st=resolveStudent({id:n.id||'',name:n.name,grade:n.grade,birthday:n.birthday});
      if(!st){const same=active().filter(s=>normalize(s.name)===normalize(n.name));if(same.length>1){ambiguousCount++;continue;}newCount++;continue;}
      matched.add(st.id);const copy=clone(st);const ch=mergeProfile(copy,n);if(ch){updateCount++;changeFields+=ch;}else unchangedCount++;
    }
    missingCount=active().filter(s=>!matched.has(s.id)).length;return {newCount,updateCount,unchangedCount,missingCount,changeFields,ambiguousCount};
  };

  // Safe UPDATE/REPLACE: blank Excel cells never erase, contacts merge by relation/name/phone.
  confirmImport=function(){
    const incoming=ui.importPreview?.students||[], incomingTeachers=ui.importPreview?.teachers||[];if(!incoming.length&&!incomingTeachers.length)return;
    const teacherOnly=!!ui.importPreview?.teacherOnly;const mode=teacherOnly?'update':(ui.importMode==='replace'?'replace':'update');
    createSnapshot(`${teacherOnly?'교사 Excel 가져오기':mode==='replace'?'새 명단으로 교체':'기존 명단 업데이트'} 전`);pushUndo();
    let added=0,updated=0,unchanged=0,deactivated=0,ambiguous=0,teacherAdded=0,teacherUpdated=0;const matched=new Set();
    if(!teacherOnly){for(const raw of incoming){
      const n={...blankStudent(),...raw};n.grade=normalizeGrade(n.grade);let st=resolveStudent({id:n.id||'',name:n.name,grade:n.grade,birthday:n.birthday});
      if(!st){const same=active().filter(s=>normalize(s.name)===normalize(n.name));if(same.length>1){ambiguous++;continue;}let id=n.id||stableStudentId(n);if(studentById(id))id=uid('stu');st={id,teams:[],photo:null,extraContacts:[],active:true};state.students.push(st);mergeProfile(st,n);added++;}
      else{const ch=mergeProfile(st,n);ch?updated++:unchanged++;}matched.add(st.id);
    }
    if(mode==='replace')for(const st of active())if(!matched.has(st.id)){st.active=false;deactivated++;}}
    for(const n of incomingTeachers){let t=resolveIncomingTeacher(n);if(t){for(const f of ['role','birthday','phone','emergencyPhone','memo'])if(nb(n[f]))t[f]=n[f];t.active=true;teacherUpdated++;}else{state.teachers.push({id:uid('tea'),...blankTeacher(),...n,active:true});teacherAdded++;}}
    save();ui.importPreview=null;ui.modal=null;toast(`학생 신규 ${added} · 업데이트 ${updated}${unchanged?` · 동일 ${unchanged}`:''}${ambiguous?` · 확인필요 ${ambiguous}`:''}${deactivated?` · 명단제외 ${deactivated}`:''}${teacherAdded||teacherUpdated?` · 교사 ${teacherAdded+teacherUpdated}`:''}`);render();
  };

  function rowHtml(c={}){return `<div class="familyContactRow" data-family-contact><div class="familyContactFields"><input class="input familyName" placeholder="이름" value="${attr(c.name||'')}"><input class="input familyRelation" list="relationPresets" placeholder="관계 (부/모/고모 등)" value="${attr(c.relation||'')}"><input class="input familyPhone" inputmode="tel" placeholder="전화번호" value="${attr(c.phone||'')}"></div><div class="familyContactTools"><button type="button" class="contactOrderBtn" data-contact-move="up" aria-label="위로">↑</button><button type="button" class="contactOrderBtn" data-contact-move="down" aria-label="아래로">↓</button><button type="button" class="contactDeleteBtn" data-contact-delete aria-label="삭제">삭제</button></div></div>`;}
  const oldModalHtml=modalHtml;
  modalHtml=function(){
    const html=oldModalHtml();if(ui.modal?.type!=='detail')return html;const st=studentById(ui.modal.id);if(!st)return html;
    const contacts=familyList(st);const block=`<section class="manageCard contactManagerCard"><div class="manageCardTitle"><strong>연락처</strong><small>누구의 번호인지 구분하고 순서를 바꿀 수 있습니다.</small></div><div class="contactEditRow"><label class="fieldLabel grow">학생 본인<input id="dPhone" class="input" inputmode="tel" placeholder="학생 전화번호" value="${attr(st.phone||'')}"></label></div><datalist id="relationPresets"><option value="부"><option value="모"><option value="할머니"><option value="할아버지"><option value="외할머니"><option value="외할아버지"><option value="고모"><option value="이모"><option value="삼촌"><option value="기타"></datalist><div id="familyContactRows">${contacts.map(rowHtml).join('')}</div><button type="button" class="secondary fullBtn addFamilyContact" data-contact-add>+ 가족·친척 연락처 추가</button><div class="muted contactHelp">위·아래 버튼으로 표시 순서를 바꿀 수 있습니다. 저장 후 출석/학생 명부의 연락창에도 같은 순서로 표시됩니다.</div></section>`;
    return html.replace(/<section class="manageCard"><div class="manageCardTitle"><strong>연락처<\/strong>[\s\S]*?<\/section>/,block);
  };

  function saveFromDetail(id){
    const st=studentById(id);if(!st)return toast('학생을 찾지 못했습니다.');const name=document.getElementById('dName')?.value.trim();if(!name)return toast('학생 이름을 입력해 주세요.');pushUndo();
    const fam=[...document.querySelectorAll('[data-family-contact]')].map(r=>({name:r.querySelector('.familyName')?.value.trim()||'',relation:r.querySelector('.familyRelation')?.value.trim()||'',phone:r.querySelector('.familyPhone')?.value.trim()||''})).filter(c=>c.name||c.relation||c.phone);
    const faith=document.querySelector('input[name="dParentFaithChoice"]:checked')?.value||st.parentFaith||'미기재';const other=!!document.getElementById('dOtherDeptSibling')?.checked;st.name=name;st.gender=document.getElementById('dGender')?.value||'미지정';st.birthday=document.getElementById('dBirthday')?.value||'';st.assignedTeacher=document.getElementById('dAssignedTeacher')?.value||'';st.parentFaith=faith;st.multicultural=!!document.getElementById('dMulticultural')?.checked;st.otherDeptSibling=other;st.otherDeptSiblingNote=other?(document.getElementById('dOtherDeptSiblingNote')?.value.trim()||''):'';st.phone=document.getElementById('dPhone')?.value.trim()||'';writeFamily(st,fam);st.school=document.getElementById('dSchool')?.value.trim()||'';st.siblings=document.getElementById('dSiblings')?.value.trim()||'';st.address=document.getElementById('dAddress')?.value.trim()||'';st.tags=String(document.getElementById('dTags')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);st.memo=document.getElementById('dMemo')?.value.trim()||'';st.active=true;save();toast(`${st.name} 학생 정보를 저장했습니다.`);render();
  }
  const oldHandleAct=handleAct;
  handleAct=function(act,b){if(act==='saveStudentInline'&&ui.modal?.type==='detail')return saveFromDetail(b.dataset.id);return oldHandleAct(act,b);};
  const oldBind=bind;
  bind=function(){oldBind();
    document.querySelectorAll('[data-contact-add]').forEach(b=>b.onclick=()=>document.getElementById('familyContactRows')?.insertAdjacentHTML('beforeend',rowHtml()));
    document.querySelectorAll('[data-contact-delete]').forEach(b=>b.onclick=()=>b.closest('[data-family-contact]')?.remove());
    document.querySelectorAll('[data-contact-move]').forEach(b=>b.onclick=()=>{const row=b.closest('[data-family-contact]'),box=row?.parentElement;if(!row||!box)return;if(b.dataset.contactMove==='up'&&row.previousElementSibling)box.insertBefore(row,row.previousElementSibling);if(b.dataset.contactMove==='down'&&row.nextElementSibling)box.insertBefore(row.nextElementSibling,row);});
  };

  const style=document.createElement('style');style.textContent=`.familyContactRow{padding:12px 0;border-bottom:1px solid #dedbd3}.familyContactFields{display:grid;grid-template-columns:1.1fr .9fr 1.35fr;gap:8px}.familyContactTools{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}.contactOrderBtn,.contactDeleteBtn{min-height:38px;padding:0 13px;border:1.5px solid #222;border-radius:12px;background:#fff;font-weight:800}.contactDeleteBtn{border-color:#d8d3c9;color:#8b302b}.addFamilyContact{margin-top:12px}.contactHelp{margin-top:10px}@media(max-width:430px){.familyContactFields{grid-template-columns:1fr 1fr}.familyPhone{grid-column:1/-1}}`;document.head.appendChild(style);
})();
