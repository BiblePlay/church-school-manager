/* v1.5.1.3 EXCEL PROFILE MERGE FIX
   UI FREEZE: only student Excel parsing/merge detection is strengthened.
   - Supports multiple student registry blocks placed side-by-side in one grade sheet.
   - Pulls detailed fields (birthday/phones/parents/address/etc.) into the existing student.
   - Blank Excel cells never erase existing app data.
*/
(function(){
  function isFieldLabel(v){ return !!labelField(v); }
  function txt(v){ return cellText(v); }

  function rightValueInRegion(matrix,row,col,right){
    const rr=matrix[row]||[];
    for(let c=col+1;c<=right;c++){
      const v=txt(rr[c]);
      if(!v) continue;
      if(isFieldLabel(v)) break;
      return v;
    }
    return '';
  }

  function blockStudent(matrix,anchor,sheetGradeValue,anchors){
    const {r,c}=anchor;
    const sameRow=anchors.filter(a=>a.r===r && a.c>c).sort((a,b)=>a.c-b.c);
    const right=sameRow.length ? sameRow[0].c-1 : Math.max(c+5,(matrix[r]||[]).length-1);

    let bottom=matrix.length-1;
    const below=anchors.filter(a=>a.r>r && a.c===c).sort((a,b)=>a.r-b.r);
    if(below.length) bottom=below[0].r-1;
    else bottom=Math.min(matrix.length-1,r+24);

    const s=blankStudent();
    s.grade=sheetGradeValue||'';

    // Name lives next to the 이름 label in this block.
    const name=rightValueInRegion(matrix,r,c,right);
    if(!validIncomingName(name)) return null;
    s.name=name;

    for(let rr=r;rr<=bottom;rr++){
      const row=matrix[rr]||[];
      for(let cc=c;cc<=Math.min(right,row.length-1);cc++){
        const f=labelField(row[cc]);
        if(!f || f==='name') continue;
        const value=rightValueInRegion(matrix,rr,cc,right);
        if(value && !isFieldLabel(value)) s[f]=value;
      }
    }
    return s;
  }

  const previousParseMatrix=parseMatrix;
  parseMatrix=function(matrix,sheetName){
    const sg=sheetGrade(sheetName);

    // Grade sheets in the user's workbook are block-style registries.
    // Find every visible "이름" label and parse each block independently,
    // including blocks placed side-by-side on the same row.
    if(sg){
      const anchors=[];
      for(let r=0;r<matrix.length;r++){
        const row=matrix[r]||[];
        for(let c=0;c<row.length;c++) if(labelField(row[c])==='name') anchors.push({r,c});
      }
      if(anchors.length){
        const out=[];
        for(const a of anchors){
          const s=blockStudent(matrix,a,sg,anchors);
          if(s && validIncomingName(s.name)) out.push(s);
        }
        if(out.length) return out;
      }
    }
    return previousParseMatrix(matrix,sheetName);
  };

  // Merge duplicate fragments belonging to the same student. This matters when
  // a sheet visually repeats a student block or splits details across regions.
  mergeIncomingStudents=function(rows){
    const map=new Map();
    for(const raw of rows){
      if(!raw?.name || !validIncomingName(raw.name)) continue;
      const n={...blankStudent(),...raw,teams:Array.isArray(raw.teams)?raw.teams:[]};
      n.grade=normalizeGrade(n.grade);
      const key=[normalize(n.name),normalize(n.grade),normalize(n.birthday)].join('|');
      const fallback=[normalize(n.name),normalize(n.grade)].join('|');
      const k=(n.birthday?key:fallback);
      if(!map.has(k)) map.set(k,n);
      else{
        const cur=map.get(k);
        for(const f of Object.keys(n)){
          if(f==='name'||f==='teams') continue;
          if((cur[f]===undefined||cur[f]===null||String(cur[f]).trim()==='') && n[f]!==undefined && n[f]!==null && String(n[f]).trim()!=='') cur[f]=n[f];
        }
      }
    }
    return [...map.values()];
  };

  // Expose only for troubleshooting if needed; no UI changes.
  window.__v1513ParseMatrix=parseMatrix;
})();
