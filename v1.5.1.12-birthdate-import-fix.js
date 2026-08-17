/* v1.5.1.12 — BIRTHDATE IMPORT/LINK FIX ONLY
   FREEZE: no attendance/talent/teacher/datapack/layout behavior changes.
   - Normalizes Excel birthdate values before preview/update.
   - Existing-student UPDATE writes the imported birthdate into the canonical student.birthday field.
   - The student detail shows that same field directly as "생년월일"; no date-picker-only workflow.
*/
(function(){
  function pad2(n){ return String(n).padStart(2,'0'); }
  function validYMD(y,m,d){
    y=Number(y);m=Number(m);d=Number(d);
    if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d)||y<1900||y>2100||m<1||m>12||d<1||d>31)return false;
    const dt=new Date(y,m-1,d);
    return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d;
  }
  function excelSerialToISO(n){
    n=Number(n);
    if(!Number.isFinite(n)||n<20000||n>80000)return '';
    try{
      if(window.XLSX?.SSF?.parse_date_code){
        const x=XLSX.SSF.parse_date_code(n);
        if(x&&validYMD(x.y,x.m,x.d))return `${x.y}-${pad2(x.m)}-${pad2(x.d)}`;
      }
    }catch(e){}
    return '';
  }
  function normalizeBirthdate(v){
    if(v===undefined||v===null)return '';
    if(v instanceof Date && !isNaN(v))return `${v.getFullYear()}-${pad2(v.getMonth()+1)}-${pad2(v.getDate())}`;
    let s=String(v).trim();
    if(!s)return '';

    // Excel serial that survived as text.
    if(/^\d{5}(?:\.\d+)?$/.test(s)){
      const iso=excelSerialToISO(s); if(iso)return iso;
    }

    // Full dates: 2015-3-15 / 2015. 3. 15 / 2015년 3월 15일 / 2015/03/15
    let m=s.match(/(?:^|\D)(19\d{2}|20\d{2})\s*(?:년|[.\/-])\s*(\d{1,2})\s*(?:월|[.\/-])\s*(\d{1,2})\s*(?:일)?(?:\D|$)/);
    if(m&&validYMD(m[1],m[2],m[3]))return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;

    // Compact full date: 20150315
    m=s.match(/^(19\d{2}|20\d{2})(\d{2})(\d{2})$/);
    if(m&&validYMD(m[1],m[2],m[3]))return `${m[1]}-${m[2]}-${m[3]}`;

    // Month/day only is still useful for birthday lists; preserve without inventing a year.
    m=s.match(/^(\d{1,2})\s*(?:월|[.\/-])\s*(\d{1,2})\s*(?:일)?$/);
    if(m){const mm=Number(m[1]),dd=Number(m[2]);if(mm>=1&&mm<=12&&dd>=1&&dd<=31)return `${pad2(mm)}-${pad2(dd)}`;}

    // Keep nonempty source text rather than dropping data.
    return s;
  }
  window.normalizeStudentBirthdate=normalizeBirthdate;

  // Normalize every student row as it comes out of Excel parsing.
  if(typeof parseMatrix==='function'){
    const priorParseMatrix=parseMatrix;
    parseMatrix=function(matrix,sheetName){
      const rows=priorParseMatrix(matrix,sheetName)||[];
      for(const row of rows) if(row&&row.birthday) row.birthday=normalizeBirthdate(row.birthday);
      return rows;
    };
  }
  if(typeof parseTeacherMatrix==='function'){
    const priorParseTeacherMatrix=parseTeacherMatrix;
    parseTeacherMatrix=function(matrix){
      const rows=priorParseTeacherMatrix(matrix)||[];
      for(const row of rows) if(row&&row.birthday) row.birthday=normalizeBirthdate(row.birthday);
      return rows;
    };
  }

  // Normalize imported preview data again immediately before applying, so UPDATE cannot miss it.
  if(typeof confirmImport==='function'){
    const priorConfirmImport=confirmImport;
    confirmImport=function(){
      const p=ui?.importPreview;
      if(p){
        for(const s of (p.students||[])) if(s&&s.birthday) s.birthday=normalizeBirthdate(s.birthday);
        for(const t of (p.teachers||[])) if(t&&t.birthday) t.birthday=normalizeBirthdate(t.birthday);
      }
      return priorConfirmImport();
    };
  }

  // Normalize already-saved nonempty values without deleting anything.
  try{
    let changed=false;
    for(const st of (state?.students||[])){
      if(!st?.birthday)continue;
      const n=normalizeBirthdate(st.birthday);
      if(n&&n!==st.birthday){st.birthday=n;changed=true;}
    }
    if(changed&&typeof save==='function')save();
  }catch(e){}

  // Keep one field only: the saved canonical birthday is visible and editable in-place.
  if(typeof modalHtml==='function'){
    const priorModalHtml=modalHtml;
    modalHtml=function(){
      let html=priorModalHtml();
      if(ui?.modal?.type!=='detail')return html;
      const st=studentById(ui.modal.id); if(!st)return html;
      const value=normalizeBirthdate(st.birthday||'');

      // Replace any existing dBirthday input regardless of previous input type.
      html=html.replace(
        /<label class="fieldLabel">(?:생일|생년월일)<input id="dBirthday"[^>]*><\/label>/,
        `<label class="fieldLabel">생년월일<input id="dBirthday" class="input" inputmode="numeric" autocomplete="bday" placeholder="예: 2015-03-15" value="${attr(value)}"></label>`
      );

      // Safety: if an older patch removed the field, insert it beside gender rather than losing it.
      if(!html.includes('id="dBirthday"')){
        const genderEnd=/<label class="fieldLabel">성별[\s\S]*?<\/label>/;
        html=html.replace(genderEnd, m=>`${m}<label class="fieldLabel">생년월일<input id="dBirthday" class="input" inputmode="numeric" autocomplete="bday" placeholder="예: 2015-03-15" value="${attr(value)}"></label>`);
      }
      return html;
    };
  }
})();
