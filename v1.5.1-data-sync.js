/* v1.5.1 DATA-SYNC FINAL
   UI FREEZE: no existing layout/style rewritten.
   Only: safe student profile merge, 2 distribution packs, pack re-import,
   monthly attendance aggregation, long-absence ordering/auto-clear,
   student grade shortcuts.
*/
(function(){
  const PROFILE_FIELDS=[
    'name','grade','gender','birthday','phone',
    'parentName','parentRelation','parentPhone',
    'parent2Name','parent2Relation','parent2Phone',
    'address','school','siblings','memo','assignedTeacher','parentFaith','multicultural','otherDeptSibling','otherDeptSiblingNote','photo'
  ];

  function nonBlank(v){
    if(Array.isArray(v)) return v.length>0;
    if(typeof v==='boolean') return true;
    return v!==undefined && v!==null && String(v).trim()!=='';
  }
  function eqVal(a,b){
    if(Array.isArray(a)||Array.isArray(b)) return JSON.stringify(a||[])===JSON.stringify(b||[]);
    if(typeof a==='boolean'||typeof b==='boolean') return !!a===!!b;
    return normalize(a)===normalize(b);
  }
  function safeArray(v){ return Array.isArray(v)?clone(v):[]; }

  // ---------- richer Excel field recognition ----------
  const fieldMap={
    id:['학생id','학생아이디','studentid','id'],
    name:['이름','성명','학생이름','name'],
    grade:['학년','grade'],
    gender:['성별','남여','성별남여'],
    birthday:['생일','생년월일','생년','birthday'],
    phone:['전화번호','학생전화번호','학생연락처','학생휴대폰','휴대폰','핸드폰'],
    parentName:['학부모성함','보호자성함','부모님성함','학부모','보호자','보호자1','보호자1이름'],
    parentRelation:['보호자관계','학부모관계','관계','관계1','보호자1관계'],
    parentPhone:['학부모연락처','보호자연락처','부모님연락처','학부모전화번호','보호자1연락처','보호자1전화번호'],
    parent2Name:['보호자2','보호자2이름','부모2','학부모2'],
    parent2Relation:['관계2','보호자2관계'],
    parent2Phone:['보호자2연락처','보호자2전화번호','부모2연락처'],
    address:['주소','집주소'],
    school:['학교','학교명'],
    siblings:['형제관계','형제','자매관계'],
    assignedTeacher:['담당교사','담임교사','담당선생님','담임선생님'],
    parentFaith:['부모신앙','부모신앙여부','학부모신앙','신자비신자'],
    multicultural:['다문화','다문화가정','다문화여부'],
    otherDeptSibling:['타부서형제자매','다른부서형제자매','타부서형제','다른부서형제','교회타부서형제자매'],
    otherDeptSiblingNote:['타부서형제자매비고','다른부서형제자매비고','타부서형제비고','형제자매부서','타부서형제자매상세'],
    memo:['기타','기재사항','비고','메모','특이사항']
  };
  labelField=function(v){
    const n=normalize(v);
    for(const [k,arr] of Object.entries(fieldMap)) if(arr.some(a=>normalize(a)===n)) return k;
    return null;
  };
  blankStudent=function(){return {id:'',name:'',grade:'',gender:'',birthday:'',phone:'',parentName:'',parentRelation:'',parentPhone:'',parent2Name:'',parent2Relation:'',parent2Phone:'',address:'',school:'',siblings:'',memo:'',assignedTeacher:'',parentFaith:'',multicultural:'',otherDeptSibling:'',otherDeptSiblingNote:'',teams:[]};};
  comparableFields=function(){return PROFILE_FIELDS.filter(x=>x!=='name');};

  function normalizeIncomingStudent(n){
    const x={...blankStudent(),...n};
    x.name=String(x.name||'').trim();
    x.grade=normalizeGrade(x.grade);
    if(nonBlank(x.multicultural)){
      const v=String(x.multicultural).trim().toLowerCase();
      x.multicultural=['1','true','yes','y','예','네','다문화','해당','다문화 가정'].includes(v) || x.multicultural===true;
    }else x.multicultural='';
    if(nonBlank(x.otherDeptSibling)){
      const v=String(x.otherDeptSibling).trim().toLowerCase();
      x.otherDeptSibling=['1','true','yes','y','예','네','있음','해당','체크'].includes(v) || x.otherDeptSibling===true;
    }else x.otherDeptSibling='';
    if(x.parentFaith){
      const v=String(x.parentFaith).trim();
      if(/부모.*모두|모두.*신앙/.test(v))x.parentFaith='부모 모두 신앙';
      else if(/한\s*분|한쪽|한\s*명/.test(v))x.parentFaith='한 분 신앙';
      else if(/비신자/.test(v))x.parentFaith='비신자 가정';
      else if(/^신자$/.test(v))x.parentFaith='신앙 가정(기존)';
    }
    return x;
  }

  function matchingStudents(inc){
    if(inc.id){ const byId=studentById(inc.id); if(byId)return [byId]; }
    const candidates=active().filter(s=>normalize(s.name)===normalize(inc.name));
    if(!candidates.length)return [];
    if(inc.grade&&inc.birthday){
      const exact=candidates.filter(s=>normalize(s.grade)===normalize(inc.grade)&&normalize(s.birthday)===normalize(inc.birthday));
      if(exact.length)return exact;
    }
    if(inc.grade){ const g=candidates.filter(s=>normalize(s.grade)===normalize(inc.grade)); if(g.length===1)return g; }
    if(inc.birthday){ const b=candidates.filter(s=>normalize(s.birthday)===normalize(inc.birthday)); if(b.length===1)return b; }
    return candidates.length===1?candidates:[];
  }
  resolveStudent=function(inc){return matchingStudents(inc)[0]||null;};

  function mergeStudentProfile(target,inc,{overwrite=true}={}){
    let changed=0;
    const normalized=normalizeIncomingStudent(inc);
    for(const k of PROFILE_FIELDS){
      if(k==='name' && !normalized.name)continue;
      if(!nonBlank(normalized[k]))continue; // Excel blank never erases existing data
      if(!overwrite && nonBlank(target[k]))continue;
      if(!eqVal(target[k],normalized[k])){target[k]=clone(normalized[k]);changed++;}
    }
    if(Array.isArray(inc.tags)&&inc.tags.length && JSON.stringify(target.tags||[])!==JSON.stringify(inc.tags)){target.tags=clone(inc.tags);changed++;}
    if(Array.isArray(inc.extraContacts)&&inc.extraContacts.length && JSON.stringify(target.extraContacts||[])!==JSON.stringify(inc.extraContacts)){target.extraContacts=clone(inc.extraContacts);changed++;}
    if(Array.isArray(inc.teams)&&inc.teams.length && JSON.stringify(target.teams||[])!==JSON.stringify(inc.teams)){target.teams=clone(inc.teams);changed++;}
    target.active=true; v14EnsureStudent(target); return changed;
  }

  // Replace old preview analyzer so it counts actual profile changes.
  analyzeIncoming=function(students){
    let newCount=0,updateCount=0,unchangedCount=0,changeFields=0,ambiguousCount=0;
    const matched=new Set();
    for(const raw of students){
      const n=normalizeIncomingStudent(raw); const matches=matchingStudents(n);
      if(matches.length===0){
        const sameName=active().filter(s=>normalize(s.name)===normalize(n.name));
        if(sameName.length>1){ambiguousCount++;continue;}
        newCount++;continue;
      }
      const st=matches[0]; matched.add(st.id); let changes=0;
      for(const k of PROFILE_FIELDS){if(nonBlank(n[k])&&!eqVal(st[k],n[k]))changes++;}
      if(changes){updateCount++;changeFields+=changes;} else unchangedCount++;
    }
    const missingCount=active().filter(s=>!matched.has(s.id)).length;
    return {newCount,updateCount,unchangedCount,missingCount,changeFields,ambiguousCount};
  };

  // Student Excel: UPDATE / REPLACE are authoritative modes. Existing history never touched.
  confirmImport=function(){
    const incoming=(ui.importPreview?.students||[]).map(normalizeIncomingStudent);
    const incomingTeachers=ui.importPreview?.teachers||[];
    if(!incoming.length&&!incomingTeachers.length)return;
    const teacherOnly=!!ui.importPreview?.teacherOnly;
    const mode=teacherOnly?'update':(ui.importMode==='replace'?'replace':'update');
    const modeLabel=teacherOnly?'교사 Excel 가져오기':(mode==='replace'?'새 명단으로 교체':'기존 명단 업데이트');
    createSnapshot(`${modeLabel} 전`); pushUndo();
    let added=0,updated=0,unchanged=0,deactivated=0,ambiguous=0,teacherAdded=0,teacherUpdated=0;
    const matched=new Set();
    for(const n of incoming){
      const matches=matchingStudents(n);
      let st=matches[0]||null;
      if(!st){
        const sameName=active().filter(s=>normalize(s.name)===normalize(n.name));
        if(sameName.length>1){ambiguous++;continue;}
        let id=n.id||stableStudentId(n); if(studentById(id))id=uid('stu');
        st={id,teams:[],photo:null,active:true}; state.students.push(st); mergeStudentProfile(st,n); added++;
      }else{
        const changes=mergeStudentProfile(st,n); changes?updated++:unchanged++;
      }
      matched.add(st.id);
    }
    if(mode==='replace') for(const st of active()) if(!matched.has(st.id)){st.active=false;deactivated++;}

    // Teacher-only or integrated teacher table updates teachers only; never students.
    for(const n of incomingTeachers){
      let t=resolveIncomingTeacher(n);
      if(t){for(const f of ['role','birthday','phone','emergencyPhone','memo'])if(nonBlank(n[f]))t[f]=n[f];t.active=true;teacherUpdated++;}
      else{state.teachers.push({id:uid('tea'),...blankTeacher(),...n,active:true});teacherAdded++;}
    }
    save(); ui.importPreview=null; ui.modal=null;
    toast(`학생 신규 ${added} · 업데이트 ${updated}${ambiguous?` · 확인필요 ${ambiguous}`:''}${deactivated?` · 명단제외 ${deactivated}`:''}${teacherAdded||teacherUpdated?` · 교사 ${teacherAdded+teacherUpdated}`:''}`); render();
  };

  // ---------- deterministic two-pack export ----------
  function fnv1a(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
  function baseStudentForCare(st){
    // 임원·양육교사용은 학생 상세정보와 심방/연락 기록까지 이동할 수 있다.
    // 출석·달란트는 별도 기록 구조이므로 여기에는 섞지 않는다.
    return clone(st);
  }
  function baseStudentForYouth(st){return {id:st.id,name:st.name,grade:st.grade||'',gender:st.gender||'',teams:safeArray(st.teams),assignedTeacher:st.assignedTeacher||'',active:true};}
  function distributionRevision(){
    const core={students:active().map(s=>({id:s.id,name:s.name,grade:s.grade,birthday:s.birthday,phone:s.phone,parentPhone:s.parentPhone,parent2Phone:s.parent2Phone,address:s.address,teams:s.teams,assignedTeacher:s.assignedTeacher,parentFaith:s.parentFaith,multicultural:!!s.multicultural,otherDeptSibling:!!s.otherDeptSibling,otherDeptSiblingNote:s.otherDeptSiblingNote||'',siblings:s.siblings||''})),teachers:activeTeachers().map(t=>({id:t.id,name:t.name,role:t.role,phone:t.phone,birthday:t.birthday})),teams:state.teams};
    return fnv1a(JSON.stringify(core));
  }
  v14DistributionPacket=function(kind){
    ensureCustomOrder(); const care=kind==='care'; const revision=distributionRevision();
    return {schema:'church-school-base-v3',packetType:care?'care-admin':'youth-basic',dataRevision:revision,createdAt:new Date().toISOString(),department:state.settings.department||'',students:active().map(st=>care?baseStudentForCare(st):baseStudentForYouth(st)),teachers:activeTeachers().map(t=>{const x=clone(t);delete x.leaveHistory;return x;}),teams:clone(state.teams||[]),settings:{amounts:clone(state.settings.amounts||[]),longAbsenceDays:Number(state.settings.longAbsenceDays||60),customStudentOrder:clone(state.settings.customStudentOrder||[])},privacy:care?'학생 상세정보·심방/연락 기록 포함 · 출석/달란트 이력 제외':'학생 상세 개인정보·심방/내부 메모 제외 · 교사 연락처 포함'};
  };
  v14ExportPack=function(kind){
    const p=v14DistributionPacket(kind), label=kind==='care'?'임원_양육교사용':'청년교사용';
    download(`${state.settings.department||'교회학교'}_${label}_데이터팩_${p.dataRevision}_${todayKey()}.json`,JSON.stringify(p,null,2),'application/json');
    toast(`${label} 데이터팩을 만들었습니다.`);
  };

  // ---------- v3 data-pack import: explicit UPDATE / REPLACE preview ----------
  ui.dataPackImportPreview = ui.dataPackImportPreview || null;
  const previousBaseImport=importBaseDataFile;
  importBaseDataFile=async function(file){
    try{
      const p=JSON.parse(await file.text());
      if(p.schema!=='church-school-base-v3') return previousBaseImport(file);
      if(!Array.isArray(p.students))throw new Error('학생 명단이 없는 데이터팩입니다.');
      ui.dataPackImportPreview={packet:p,filename:file.name||'데이터팩.json'};
      ui.modal={type:'dataPackImport'};
      render();
    }catch(e){alert(`데이터팩 가져오기에 실패했습니다.\n${e.message||e}`);}
  };

  const YOUTH_SENSITIVE_FIELDS=[
    'birthday','phone','parentName','parentRelation','parentPhone','parent2Name','parent2Relation','parent2Phone',
    'address','school','siblings','memo','parentFaith','multicultural','otherDeptSibling','otherDeptSiblingNote','tags','extraContacts','visitLogs','photo'
  ];
  function clearYouthSensitive(st){
    for(const k of YOUTH_SENSITIVE_FIELDS){
      if(['tags','extraContacts','visitLogs'].includes(k))st[k]=[];
      else if(k==='multicultural'||k==='otherDeptSibling')st[k]=false;
      else st[k]=null;
    }
  }
  function mergeVisitLogs(existing,incoming){
    const out=[],seen=new Set();
    for(const item of [...safeArray(incoming),...safeArray(existing)]){
      if(!item||typeof item!=='object')continue;
      const key=item.id?`id:${item.id}`:`content:${item.date||''}|${item.note||''}|${item.createdAt||''}`;
      if(seen.has(key))continue;seen.add(key);out.push(clone(item));
    }
    return out.sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')));
  }
  window.applyDataPackImport=function(mode='update',includeAttendance=false){
    const preview=ui.dataPackImportPreview,p=preview?.packet;
    if(!p||p.schema!=='church-school-base-v3')return toast('적용할 데이터팩이 없습니다.');
    const replace=mode==='replace',care=p.packetType==='care-admin';
    const typeLabel=care?'임원·양육교사용':'청년교사용';
    if(replace){
      const warning=care
        ? `${typeLabel} 데이터팩 기준으로 현재 활성 명단을 교체할까요?\n파일에 없는 학생·교사는 명단에서 제외되지만 과거 출석·달란트 기록은 보존됩니다.`
        : `${typeLabel} 데이터팩 기준으로 현재 활성 명단을 교체할까요?\n파일에 없는 학생·교사는 명단에서 제외되고, 활성 학생의 민감 학생정보는 최소정보 기준으로 정리됩니다. 과거 출석·달란트 기록은 보존됩니다.`;
      if(!confirm(warning))return;
    }
    createSnapshot(`데이터팩 ${replace?'명단 교체':'업데이트'} 전`);pushUndo();
    let added=0,updated=0,deactivated=0,teacherAdded=0,teacherUpdated=0,teacherDeactivated=0;
    const matchedStudents=new Set(), matchedTeachers=new Set();
    for(const raw of p.students){
      const n=normalizeIncomingStudent(raw); let st=resolveStudent(n);
      if(!st){let id=n.id&&!studentById(n.id)?n.id:uid('stu');st={id,teams:[],photo:null,active:true};state.students.push(st);added++;}
      let changed=0;
      if(care){
        if(replace){
          // '현재 명단 교체'는 활성 프로필을 데이터팩 기준으로 맞추되 Student ID와 과거 로컬 기록은 보존한다.
          // 심방/연락 기록은 파일과 로컬 기록을 ID/내용 기준으로 안전하게 합친다.
          const before=JSON.stringify(st);
          const keepId=st.id,mergedVisits=mergeVisitLogs(st.visitLogs,raw.visitLogs);
          const incoming=clone(raw);delete incoming.id;delete incoming.visitLogs;delete incoming.active;
          Object.assign(st,incoming,{id:keepId,visitLogs:mergedVisits,active:true});
          st.grade=normalizeGrade(st.grade);st.teams=Array.isArray(st.teams)?st.teams:[];v14EnsureStudent(st);
          changed=before===JSON.stringify(st)?0:1;
        }else{
          changed=mergeStudentProfile(st,n);
          const mergedVisits=mergeVisitLogs(st.visitLogs,raw.visitLogs);
          if(JSON.stringify(st.visitLogs||[])!==JSON.stringify(mergedVisits)){st.visitLogs=mergedVisits;changed++;}
        }
      }else{
        const minimal=['name','grade','gender','assignedTeacher'];
        for(const k of minimal)if(nonBlank(n[k])&&!eqVal(st[k],n[k])){st[k]=clone(n[k]);changed++;}
        if(Array.isArray(raw.teams)&&JSON.stringify(st.teams||[])!==JSON.stringify(raw.teams)){st.teams=clone(raw.teams);changed++;}
        st.active=true;v14EnsureStudent(st);
        if(replace)clearYouthSensitive(st);
      }
      st.active=true;matchedStudents.add(st.id);if(changed)updated++;
    }
    if(replace){
      for(const st of active())if(!matchedStudents.has(st.id)){st.active=false;deactivated++;}
    }
    for(const inc of p.teachers||[]){
      let t=resolveTeacher(inc);
      if(!t){t={id:inc.id&&!teacherById(inc.id)?inc.id:uid('tea'),active:true};state.teachers.push(t);teacherAdded++;}
      let changed=0;
      if(replace){
        const before=JSON.stringify(t),keepId=t.id,keepLeaveHistory=clone(t.leaveHistory||[]);
        const incoming=clone(inc);delete incoming.id;delete incoming.active;delete incoming.leaveHistory;
        Object.assign(t,incoming,{id:keepId,leaveHistory:keepLeaveHistory,active:true});v14EnsureTeacher(t);
        changed=before===JSON.stringify(t)?0:1;
      }else{
        for(const [k,v] of Object.entries(inc)){if(['id','active'].includes(k)||!nonBlank(v))continue;if(!eqVal(t[k],v)){t[k]=clone(v);changed++;}}
        t.active=true;v14EnsureTeacher(t);
      }
      matchedTeachers.add(t.id);if(changed)teacherUpdated++;
    }
    if(replace){
      for(const t of activeTeachers())if(!matchedTeachers.has(t.id)){t.active=false;teacherDeactivated++;}
    }
    if(Array.isArray(p.teams)){
      state.teams=replace?clone(p.teams):[...new Set([...(state.teams||[]),...p.teams])];
    }
    if(p.settings?.amounts)state.settings.amounts=clone(p.settings.amounts);
    if(p.settings?.longAbsenceDays)state.settings.longAbsenceDays=Number(p.settings.longAbsenceDays);
    state.settings.lastBaseDataRevision=p.dataRevision||'';
    if(replace)state.settings.profileAccess=care?'care':'youth';
    save();
    let attendanceText='';
    if(includeAttendance&&p.attendanceSync?.schema==='church-school-attendance-bundle-v1'&&typeof window.applyAttendanceBundle==='function'){
      const r=window.applyAttendanceBundle(p.attendanceSync,{silent:true,skipSnapshot:true});
      attendanceText=` · 출석 학생 ${r.studentN} · 교사 ${r.teacherN}${r.skipped?` · 확인필요 ${r.skipped}`:''}`;
    }
    ui.dataPackImportPreview=null;ui.modal=null;
    toast(`데이터팩 ${replace?'명단 교체':'업데이트'} 완료 · 학생 신규 ${added} · 변경 ${updated}${deactivated?` · 제외 ${deactivated}`:''}${teacherAdded||teacherUpdated||teacherDeactivated?` · 교사 신규 ${teacherAdded}/변경 ${teacherUpdated}${teacherDeactivated?`/제외 ${teacherDeactivated}`:''}`:''}${attendanceText}`);
    render();
  };

  // ---------- monthly attendance = every attendance session in that month ----------
  v14MonthStats=function(scope='전체',count=6){
    const months=v14MonthKeys(count); const list=scope==='전체'?active():scope==='내 담당'?scopedStudents('내 담당'):active().filter(s=>s.grade===scope); const allowed=new Set(list.map(s=>s.id));
    return months.map(m=>{
      const sessionKeys=Object.keys(state.sessions||{}).filter(k=>k.startsWith(m)&&(typeof attendanceSessionRecorded==='function'?attendanceSessionRecorded(k):Object.keys(state.sessions[k]?.attendance||{}).length>0)).sort();
      let denom=0,present=0,talent=0;
      for(const k of sessionKeys){
        const records=state.sessions[k]?.attendance||{};
        for(const [id,raw] of Object.entries(records)){
          if(!allowed.has(id))continue; denom++; const isPresent=typeof raw.present==='boolean'?raw.present:['present','late','new'].includes(raw.status); if(isPresent)present++;
        }
        for(const tx of state.sessions[k]?.transactions||[]){const n=(tx.studentIds||[]).filter(id=>allowed.has(id)).length;if(tx.kind!=='reset')talent+=Number(tx.amount||0)*n;}
      }
      return {month:Number(m.slice(5)),label:`${Number(m.slice(5))}월`,rate:denom?Math.round(present/denom*100):0,talent,services:sessionKeys.length,denom,present};
    });
  };
  studentAnalytics=function(st,dates){
    const ordered=[...dates].sort();let attended=0,absent=0,checked=0,streak=0,maxRecentAbsent=0;
    for(const k of ordered){const raw=state.sessions[k]?.attendance?.[st.id];if(!raw)continue;const present=typeof raw.present==='boolean'?raw.present:['present','late','new'].includes(raw.status);checked++;if(present){attended++;streak=0;}else{absent++;streak++;maxRecentAbsent=Math.max(maxRecentAbsent,streak);}}
    let currentAbs=0;for(const k of [...ordered].reverse()){const raw=state.sessions[k]?.attendance?.[st.id];if(!raw)continue;const present=typeof raw.present==='boolean'?raw.present:['present','late','new'].includes(raw.status);if(present)break;currentAbs++;}
    return {attended,absent,checked,currentAbs,maxRecentAbsent};
  };

  // ---------- long absence always at bottom, regardless of alphabetical/custom sort ----------
  const baseSortStudents=sortStudents;
  sortStudents=function(arr,mode){
    const sorted=baseSortStudents(arr,mode);
    const regular=[],long=[];for(const st of sorted)(longAbsenceInfo(st).long?long:regular).push(st);
    return regular.concat(long);
  };
  const oldToggleAttendance=toggleStudentAttendance;
  toggleStudentAttendance=function(id){
    const st=studentById(id);if(!st)return;const wasPresent=att(st).present;oldToggleAttendance(id);
    const current=studentById(id);if(current && !wasPresent && att(current).present && current.longTermManual){current.longTermManual=false;save();render();toast('출석 처리되어 장기 미출석이 자동 해제되었습니다.');}
  };
  const oldToggleFlag=toggleStudentAttendanceFlag;
  toggleStudentAttendanceFlag=function(id,flag){
    const st=studentById(id);if(!st)return;const wasPresent=att(st).present;oldToggleFlag(id,flag);
    const current=studentById(id);if(current && !wasPresent && att(current).present && current.longTermManual){current.longTermManual=false;save();render();toast('출석 처리되어 장기 미출석이 자동 해제되었습니다.');}
  };

  // ---------- student page: compact scope chooser, same rule as talent/attendance/records ----------
  // 등록된 전체 학생은 항상 접근 가능하고, 담당 학년은 ui.studentGrade의 기본값으로만 사용한다.
  const oldFilteredStudents=v14FilteredStudents;
  v14FilteredStudents=function(){
    let arr=oldFilteredStudents();
    const scope=ui.studentGrade||'전체';
    if(scope==='전체')return arr;
    if(String(scope).startsWith('팀:')){
      const team=String(scope).slice(2);
      return arr.filter(s=>(s.teams||[]).includes(team));
    }
    return arr.filter(s=>s.grade===scope);
  };
  const oldStudentsView=studentsView;
  studentsView=function(){
    let html=oldStudentsView();
    if(ui.peopleMode==='teacher')return html;
    const chooser=scopeChoiceHtml('students',ui.studentGrade||'전체',true);
    const pos=html.indexOf('<div class="sortBar');
    return pos>=0?html.slice(0,pos)+chooser+html.slice(pos):chooser+html;
  };

  save();render();
})();
