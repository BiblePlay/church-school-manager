/* v1.5.3.2 — attendance history / correction / sync
   Safe-scope patch only:
   - compact teacher attendance history under teacher birthdays
   - edit saved student/teacher attendance by date
   - parse teacher-attendance Kakao text
   - export/import all attendance in one JSON bundle
   - distribution packs can optionally include student/teacher attendance
   No talent/student-profile/Excel layout redesign.
*/
(function(){
  ui.teacherHistoryRange = ui.teacherHistoryRange || '최근 5회';
  ui.attendanceEditDraft = ui.attendanceEditDraft || null;
  ui.teacherAttendanceEditDraft = ui.teacherAttendanceEditDraft || null;
  ui.attendanceBundlePreview = ui.attendanceBundlePreview || null;

  const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k);
  const hasStudentRecord=k=>typeof attendanceSessionRecorded==='function'?attendanceSessionRecorded(k):(!!state.sessions?.[k]&&Object.keys(state.sessions[k].attendance||{}).length>0);

  // Teacher attendance follows the same rule as student attendance:
  // simply opening a date must never create a real attendance session.
  // Old auto-generated rows where everyone is absent are ignored unless
  // that date was explicitly started by a teacher-attendance action.
  function teacherRecordMeaningful(raw){
    if(!raw)return false;
    const present=(typeof raw.present==='boolean')?raw.present:['present','late'].includes(raw.status);
    return present || !!raw.late || !!String(raw.reason||'').trim();
  }
  function teacherAttendanceSessionRecorded(k){
    const sess=state.teacherSessions?.[k];
    if(!sess)return false;
    // A teacher date is a real attendance record only when at least one
    // meaningful teacher entry exists. Merely opening/initializing a date,
    // or stale legacy attendanceStarted=true with everyone absent, is ignored.
    return Object.values(sess.attendance||{}).some(teacherRecordMeaningful);
  }
  window.teacherAttendanceSessionRecorded=teacherAttendanceSessionRecorded;
  const hasTeacherRecord=k=>teacherAttendanceSessionRecorded(k);

  // 실제 체크 동작은 app.js의 출석 저장 함수가 담당한다.
  // 이 파일에서는 화면 열기/전체 해제로 attendanceStarted 같은 가짜 기록 표식을 만들지 않는다.
  const teacherHistoryDates=()=>Object.keys(state.teacherSessions||{}).filter(hasTeacherRecord).sort().reverse();
  const studentHistoryDates=()=>Object.keys(state.sessions||{}).filter(hasStudentRecord).sort();
  const teacherRecordedDates=()=>Object.keys(state.teacherSessions||{}).filter(hasTeacherRecord).sort();

  function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
  function rangeDates(keys,range){
    if(range==='최근 5회')return keys.slice(0,5);
    if(range==='전체')return keys;
    const now=new Date(`${ui.date||todayKey()}T12:00:00`);let start;
    if(range==='이번 달')start=new Date(now.getFullYear(),now.getMonth(),1);
    else if(range==='3개월')start=new Date(now.getFullYear(),now.getMonth()-2,1);
    else if(range==='6개월')start=new Date(now.getFullYear(),now.getMonth()-5,1);
    else if(range==='올해')start=new Date(now.getFullYear(),0,1);
    else return keys.slice(0,5);
    return keys.filter(k=>{const d=new Date(`${k}T12:00:00`);return d>=start&&d<=now;});
  }
  function teacherSummary(k){
    const records=state.teacherSessions?.[k]?.attendance||{};
    const rows=Object.values(records);let present=0,late=0;
    rows.forEach(r=>{const p=typeof r.present==='boolean'?r.present:['present','late'].includes(r.status);if(p)present++;if(r.late||r.status==='late')late++;});
    return {present,late,absent:Math.max(0,rows.length-present),total:rows.length};
  }

  // ---------- compact teacher attendance-history entry ----------
  const priorStudentsView_v1532=studentsView;
  studentsView=function(){
    let html=priorStudentsView_v1532();
    if(ui.peopleMode==='teacher'&&!html.includes('data-act="teacherAttendanceHistory"')){
      html += `<div class="card teacherAttendanceHistoryAccess"><div class="row"><div><div class="label">출석 기록</div><div class="muted">지난 교사 출석은 필요할 때만 열어 확인합니다.</div></div><button class="secondary nowrap" data-act="teacherAttendanceHistory">기록 보기</button></div></div>`;
    }
    return html;
  };

  // ---------- student date-record correction button ----------
  const priorRecordsView_v1532=recordsView;
  recordsView=function(){
    let html=priorRecordsView_v1532();
    return html.replace(/<button class="recordDelete" data-delete-session="([^"]+)">기록 삭제<\/button>/g,
      `<span class="recordEditActions"><button class="secondary nowrap" data-edit-student-session="$1">수정</button><button class="recordDelete" data-delete-session="$1">기록 삭제</button></span>`);
  };

  function openStudentAttendanceEdit(k){
    if(!hasStudentRecord(k))return toast('수정할 학생 출석 기록이 없습니다.');
    ui.attendanceEditDraft={date:k,attendance:clone(state.sessions[k].attendance||{})};ui.modal={type:'studentAttendanceEdit',date:k};render();
  }
  function openTeacherAttendanceEdit(k){
    if(!hasTeacherRecord(k))return toast('수정할 교사 출석 기록이 없습니다.');
    ui.teacherAttendanceEditDraft={date:k,attendance:clone(state.teacherSessions[k].attendance||{})};ui.modal={type:'teacherAttendanceEdit',date:k};render();
  }
  function draftStudent(id){const d=ui.attendanceEditDraft;return d?.attendance?.[id]||{present:false,late:false,newcomer:false,status:'absent',memo:''};}
  function draftTeacher(id){const d=ui.teacherAttendanceEditDraft;return d?.attendance?.[id]||{present:false,late:false,status:'absent',reason:''};}
  function setDraftStudent(id,status){const d=ui.attendanceEditDraft;if(!d)return;const old=draftStudent(id),p=status!=='absent';d.attendance[id]={...old,present:p,late:status==='late',status:p?'present':'absent',memo:old.memo||'',newcomer:!!old.newcomer};render();}
  function setDraftTeacher(id,status){const d=ui.teacherAttendanceEditDraft;if(!d)return;const old=draftTeacher(id),p=status!=='absent';d.attendance[id]={...old,present:p,late:status==='late',status:p?'present':'absent',reason:old.reason||''};render();}
  function toggleDraftNewcomer(id){const d=ui.attendanceEditDraft;if(!d)return;const a=draftStudent(id);d.attendance[id]={...a,newcomer:!a.newcomer};render();}
  function saveStudentAttendanceEdit(){
    const d=ui.attendanceEditDraft;if(!d)return;
    document.querySelectorAll('[data-edit-student-memo]').forEach(el=>{const id=el.dataset.editStudentMemo,a=d.attendance[id]||draftStudent(id);d.attendance[id]={...a,memo:el.value||''};});
    const real=Object.values(d.attendance||{}).some(a=>!!a&&(!!a.present||!!a.late||!!a.newcomer));
    pushUndo();
    if(real){
      state.sessions[d.date] ||= {attendance:{},transactions:[]};
      state.sessions[d.date].attendance=clone(d.attendance);
      delete state.sessions[d.date].attendanceStarted;
    }else if(state.sessions?.[d.date]){
      state.sessions[d.date].attendance={};delete state.sessions[d.date].attendanceStarted;
      if(!(state.sessions[d.date].transactions||[]).length)delete state.sessions[d.date];
    }
    save();
    ui.attendanceEditDraft=null;ui.modal=null;toast(real?`${displayDate(d.date)} 학생 출석 기록을 수정했습니다.`:'출석 체크가 없어 해당 날짜 기록을 제거했습니다.');render();
  }
  function saveTeacherAttendanceEdit(){
    const d=ui.teacherAttendanceEditDraft;if(!d)return;
    document.querySelectorAll('[data-edit-teacher-reason]').forEach(el=>{const id=el.dataset.editTeacherReason,a=d.attendance[id]||draftTeacher(id);d.attendance[id]={...a,reason:el.value||''};});
    const real=Object.values(d.attendance||{}).some(a=>!!a&&(!!a.present||!!a.late||!!String(a.reason||'').trim()));
    pushUndo();
    if(real){state.teacherSessions[d.date]={attendance:clone(d.attendance)};}
    else delete state.teacherSessions[d.date];
    save();
    ui.teacherAttendanceEditDraft=null;ui.modal={type:'teacherAttendanceHistory'};toast(real?`${displayDate(d.date)} 교사 출석 기록을 수정했습니다.`:'출석 체크가 없어 해당 날짜 기록을 제거했습니다.');render();
  }

  // ---------- one-file attendance bundle ----------
  function minimalStudents(){return active().map(s=>({id:s.id,name:s.name,grade:s.grade||'',birthday:s.birthday||''}));}
  function minimalTeachers(){return activeTeachers().map(t=>({id:t.id,name:t.name,role:t.role||''}));}
  function makeAttendanceBundle(includeStudent=true,includeTeacher=true){
    const studentSessions=includeStudent?studentHistoryDates().map(date=>({date,records:Object.entries(state.sessions[date].attendance||{}).map(([studentId,r])=>({studentId,present:typeof r.present==='boolean'?r.present:['present','late','new'].includes(r.status),late:!!r.late||r.status==='late',newcomer:!!r.newcomer||r.status==='new',status:(typeof r.present==='boolean'?r.present:['present','late','new'].includes(r.status))?'present':'absent',memo:r.memo||''}))})):[];
    const teacherSessions=includeTeacher?teacherRecordedDates().map(date=>({date,records:Object.entries(state.teacherSessions[date].attendance||{}).map(([teacherId,r])=>({teacherId,present:typeof r.present==='boolean'?r.present:['present','late'].includes(r.status),late:!!r.late||r.status==='late',status:(typeof r.present==='boolean'?r.present:['present','late'].includes(r.status))?'present':'absent',reason:r.reason||''}))})):[];
    const core={studentSessions,teacherSessions};
    return {schema:'church-school-attendance-bundle-v1',bundleId:`attendance-${hashText(JSON.stringify(core))}`,createdAt:new Date().toISOString(),department:state.settings.department||'',students:minimalStudents(),teachers:minimalTeachers(),studentSessions,teacherSessions};
  }
  function exportAttendanceBundle(){
    const b=makeAttendanceBundle(true,true);
    download(`${state.settings.department||'교회학교'}_출석기록_${todayKey()}.json`,JSON.stringify(b,null,2),'application/json');
    toast(`출석 기록 파일을 만들었습니다. · 학생 ${b.studentSessions.length}회 · 교사 ${b.teacherSessions.length}회`);
  }
  function resolveBundleStudent(inc){return studentById(inc?.id)||resolveStudent(inc||{})||null;}
  function resolveBundleTeacher(inc){return teacherById(inc?.id)||resolveTeacher(inc||{})||null;}
  function analyzeAttendanceBundle(b){
    const sm=new Map((b.students||[]).map(x=>[x.id,x])),tm=new Map((b.teachers||[]).map(x=>[x.id,x]));
    let studentRows=0,teacherRows=0;const unknownStudents=new Set(),unknownTeachers=new Set();
    for(const sess of b.studentSessions||[])for(const r of sess.records||[]){studentRows++;const inc=sm.get(r.studentId)||{id:r.studentId,name:r.studentName||'',grade:r.grade||''};if(!resolveBundleStudent(inc))unknownStudents.add(inc.name||r.studentId);}
    for(const sess of b.teacherSessions||[])for(const r of sess.records||[]){teacherRows++;const inc=tm.get(r.teacherId)||{id:r.teacherId,name:r.teacherName||'',role:r.role||''};if(!resolveBundleTeacher(inc))unknownTeachers.add(inc.name||r.teacherId);}
    return {studentSessions:(b.studentSessions||[]).length,teacherSessions:(b.teacherSessions||[]).length,studentRows,teacherRows,unknownStudents:[...unknownStudents],unknownTeachers:[...unknownTeachers]};
  }
  function applyAttendanceBundle(b,{silent=false,skipSnapshot=false}={}){
    if(!b||b.schema!=='church-school-attendance-bundle-v1')throw new Error('지원하지 않는 출석 기록 파일입니다.');
    const sm=new Map((b.students||[]).map(x=>[x.id,x])),tm=new Map((b.teachers||[]).map(x=>[x.id,x]));
    let studentN=0,teacherN=0,skipped=0;
    if(!skipSnapshot){createSnapshot('출석 기록 일괄 업데이트 전');pushUndo();}
    for(const sess of b.studentSessions||[]){
      if(!sess?.date)continue;state.sessions[sess.date] ||= {attendance:{},transactions:[]};state.sessions[sess.date].attendance ||= {};
      for(const r of sess.records||[]){const inc=sm.get(r.studentId)||{id:r.studentId,name:r.studentName||'',grade:r.grade||''},st=resolveBundleStudent(inc);if(!st){skipped++;continue;}state.sessions[sess.date].attendance[st.id]={present:!!r.present,late:!!r.late,newcomer:!!r.newcomer,status:r.present?'present':'absent',memo:r.memo||''};studentN++;}
    }
    for(const sess of b.teacherSessions||[]){
      if(!sess?.date)continue;state.teacherSessions[sess.date] ||= {attendance:{}};state.teacherSessions[sess.date].attendance ||= {};
      for(const r of sess.records||[]){const inc=tm.get(r.teacherId)||{id:r.teacherId,name:r.teacherName||'',role:r.role||''},t=resolveBundleTeacher(inc);if(!t){skipped++;continue;}state.teacherSessions[sess.date].attendance[t.id]={present:!!r.present,late:!!r.late,status:r.present?'present':'absent',reason:r.reason||''};teacherN++;}
    }
    // 외부 파일에도 '전원 미체크' 날짜가 들어올 수 있으므로, 가져온 뒤에도
    // 앱의 동일한 실기록 기준을 적용한다. 달란트 거래가 있는 학생 날짜는 거래만 보존한다.
    for(const sess of b.studentSessions||[])if(sess?.date)cleanupStudentAttendanceSession(sess.date);
    for(const sess of b.teacherSessions||[])if(sess?.date)cleanupTeacherAttendanceSession(sess.date);
    state.importedAttendanceBundleIds ||= [];
    if(b.bundleId&&!state.importedAttendanceBundleIds.includes(b.bundleId))state.importedAttendanceBundleIds.push(b.bundleId);
    save();if(!silent){ui.modal=null;toast(`출석 업데이트 완료 · 학생 ${studentN} · 교사 ${teacherN}${skipped?` · 확인 필요 ${skipped}`:''}`);render();}
    return {studentN,teacherN,skipped};
  }
  window.applyAttendanceBundle=applyAttendanceBundle;
  window.analyzeAttendanceBundle=analyzeAttendanceBundle;
  function chooseAttendanceBundleFile(){
    const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.style.display='none';document.body.appendChild(input);
    input.onchange=async()=>{const f=input.files?.[0];input.remove();if(!f)return;try{const b=JSON.parse(await f.text());if(b.schema!=='church-school-attendance-bundle-v1')throw new Error('출석 기록 내보내기 파일이 아닙니다.');ui.attendanceBundlePreview={bundle:b,summary:analyzeAttendanceBundle(b)};ui.modal={type:'attendanceBundlePreview'};render();}catch(e){alert(`출석 기록 가져오기에 실패했습니다.\n${e.message||e}`);}};
    input.click();
  }

  // ---------- distribution pack attendance options ----------
  const priorV14ExportPack_v1532=v14ExportPack;
  v14ExportPack=function(kind){ui.modal={type:'distributionAttendanceOptions',kind};render();};
  function exportDistributionPackWithAttendance(){
    const kind=ui.modal?.kind||'care',p=v14DistributionPacket(kind),label=kind==='care'?'임원_양육교사용':'청년교사용';
    const student=!!document.getElementById('packStudentAttendance')?.checked,teacher=!!document.getElementById('packTeacherAttendance')?.checked;
    if(student||teacher)p.attendanceSync=makeAttendanceBundle(student,teacher);
    p.privacy=(p.privacy||'')+(student||teacher?` · 출석 포함(${student?'학생':''}${student&&teacher?' + ':''}${teacher?'교사':''})`:' · 출석 미포함');
    download(`${state.settings.department||'교회학교'}_${label}_데이터팩_${p.dataRevision||todayKey()}_${todayKey()}.json`,JSON.stringify(p,null,2),'application/json');
    ui.modal=null;toast(`${label} 데이터팩을 만들었습니다.${student||teacher?' 출석 기록도 포함했습니다.':''}`);render();
  }

  const priorBaseImport_v1532=importBaseDataFile;
  importBaseDataFile=async function(file){
    // v3 데이터팩의 출석 포함 여부까지 v1.5.1-data-sync의 미리보기에서 함께 처리한다.
    // 여기서 confirm을 가로채지 않아 업데이트/명단 교체 선택 흐름이 한 곳에서만 동작한다.
    return priorBaseImport_v1532(file);
  };

  // ---------- teacher Kakao paste ----------
  function findTeacherByName(name){const a=activeTeachers().filter(t=>normalize(t.name)===normalize(name));return a.length===1?a[0]:null;}
  function parsedDate(first){let m=first.match(/(20\d{2}-\d{2}-\d{2})/);if(m)return m[1];m=first.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);if(m){const y=Number((ui.date||todayKey()).slice(0,4));return `${y}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;}return ui.date||todayKey();}
  const priorParsePasted_v1532=v14ParsePasted;
  v14ParsePasted=function(text){
    const raw=String(text||'').trim();if(!raw)throw new Error('붙여넣은 내용이 없습니다.');const lines=raw.split(/\r?\n/).map(x=>x.trim()),first=lines.find(Boolean)||'';
    if(/교사\s*출석/.test(first)){
      const date=parsedDate(first),hash=v14Hash(raw),idxP=lines.indexOf('출석'),idxA=lines.indexOf('결석'),idxN=lines.indexOf('비고');
      const namesP=idxP>=0&&lines[idxP+1]?lines[idxP+1].split(',').map(x=>x.trim()).filter(x=>x&&x!=='없음'):[],namesA=idxA>=0&&lines[idxA+1]?lines[idxA+1].split(',').map(x=>x.trim()).filter(x=>x&&x!=='없음'):[];
      const notes={};if(idxN>=0)for(const line of lines.slice(idxN+1)){const m=line.match(/^(.+?)\s*[—-]\s*(.+)$/);if(m)notes[m[1].trim()]=m[2].trim();}
      const rows=[],unknown=[];for(const [names,present] of [[namesP,true],[namesA,false]])for(const n of names){const t=findTeacherByName(n);if(t)rows.push({id:t.id,present,note:notes[n]||''});else unknown.push(n);}
      return {type:'teacher-attendance',date,scope:'교사',rows,matched:rows.length,unknown,hash,duplicate:(state.importedTextIds||[]).includes(hash),existing:hasTeacherRecord(date),raw};
    }
    return priorParsePasted_v1532(text);
  };
  const priorApplyPasted_v1532=v14ApplyPasted;
  v14ApplyPasted=function(p){
    if(p?.type!=='teacher-attendance')return priorApplyPasted_v1532(p);if(p.duplicate)return;if(!p.rows.length)return toast('합칠 교사 출석 기록이 없습니다.');
    createSnapshot('교사 카톡 출석 병합 전');pushUndo();state.teacherSessions[p.date] ||= {attendance:{}};state.teacherSessions[p.date].attendance ||= {};
    for(const r of p.rows){const old=state.teacherSessions[p.date].attendance[r.id]||{},late=/지각/.test(r.note);state.teacherSessions[p.date].attendance[r.id]={...old,present:!!r.present,late,status:r.present?'present':'absent',reason:String(r.note||'').replace(/지각(?:\s*·\s*)?/g,'').trim()};}
    state.importedTextIds ||= [];state.importedTextIds.push(p.hash);save();ui.modal=null;toast(p.existing?'기존 교사 출석 기록을 업데이트했습니다.':'교사 출석 기록을 합쳤습니다.');render();
  };

  // Keep future teacher Kakao messages date-readable and leave all other sharing unchanged.
  shareCurrentTeacherAttendance=async function(){
    if(!teacherAttendanceSessionRecorded(ui.date))return toast('이 날짜에는 아직 교사 출석 기록이 없습니다.');
    const all=activeTeachers(),list=(typeof v14TeacherOnLeave==='function'?all.filter(t=>!v14TeacherOnLeave(t,ui.date)):all),present=list.filter(t=>teacherAtt(t).present),absent=list.filter(t=>!teacherAtt(t).present),notes=[];
    list.forEach(t=>{const a=teacherAtt(t),bits=[];if(a.late)bits.push('지각');if(a.reason)bits.push(a.reason);if(bits.length)notes.push(`${t.name} — ${bits.join(' · ')}`);});
    const lines=[`${displayDate()} · 교사 출석`,`오늘 출석 ${present.length} / 전체 ${list.length}명`,'','출석',present.map(t=>t.name).join(', ')||'없음','','결석',absent.map(t=>t.name).join(', ')||'없음',...(notes.length?['','비고',...notes]:[])];
    await nativeShare({title:'교사 출석',text:lines.join('\n')});
  };

  const priorShareTeacherAttendance_v1533=shareTeacherAttendance;
  shareTeacherAttendance=async function(){
    if(!teacherAttendanceSessionRecorded(ui.date))return toast('이 날짜에는 아직 교사 출석 기록이 없습니다.');
    return priorShareTeacherAttendance_v1533();
  };

  // ---------- settings: only add compact attendance sync actions ----------
  const priorSettingsView_v1532=settingsView;
  settingsView=function(){
    let html=priorSettingsView_v1532();
    html=html.replace('다른 선생님이 카톡으로 보내준 출석·달란트 기록을 전체 기록에 합칩니다.','다른 선생님이 카톡으로 보내준 학생 출석·교사 출석·달란트 기록을 합칩니다.');
    if(!html.includes('data-act="exportAttendanceBundle"')){
      const anchor='<button class="secondary nowrap" data-act="mergeImport">받은 기록 업데이트</button>';
      html=html.replace(anchor,`${anchor}<button class="secondary nowrap" data-act="exportAttendanceBundle">출석 기록 내보내기</button><button class="secondary nowrap" data-act="importAttendanceBundle">출석 기록 가져오기</button>`);
    }
    return html;
  };

  // ---------- modals ----------
  const priorModalHtml_v1532=modalHtml;
  modalHtml=function(){
    const close='<button class="icon" data-act="closeModal">×</button>';
    if(ui.modal?.type==='teacherAttendanceHistory'){
      const dates=rangeDates(teacherHistoryDates(),ui.teacherHistoryRange),tabs=['최근 5회','이번 달','3개월','6개월','올해','전체'];
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">교사 출석 기록</div><div class="muted">날짜를 누르면 그날 기록만 확인·수정합니다.</div></div>${close}</div><div class="chips">${tabs.map(v=>`<button class="chip ${ui.teacherHistoryRange===v?'active':''}" data-teacher-history-range="${v}">${v}</button>`).join('')}</div><div class="card">${dates.map(k=>{const c=teacherSummary(k);return `<div class="history historyManage"><span><strong>${esc(displayDate(k))}</strong><small>출석 ${c.present}/${c.total} · 결석 ${c.absent}${c.late?` · 지각 ${c.late}`:''}</small></span><button class="secondary nowrap" data-edit-teacher-session="${k}">보기 · 수정</button></div>`;}).join('')||'<div class="muted">선택한 기간의 교사 출석 기록이 없습니다.</div>'}</div>`);
    }
    if(ui.modal?.type==='studentAttendanceEdit'){
      const d=ui.attendanceEditDraft;if(!d)return '';const ids=Object.keys(d.attendance||{}),list=state.students.filter(s=>ids.includes(s.id)).sort((a,b)=>String(a.grade||'').localeCompare(String(b.grade||''),'ko')||koName(a,b));
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">학생 출석 수정</div><div class="muted">${esc(displayDate(d.date))} · 이 날짜의 기록만 수정합니다.</div></div>${close}</div><div class="notice">달란트와 학생 기본정보는 변경되지 않습니다.</div><div class="list">${list.map(st=>{const a=draftStudent(st.id),stat=a.present?(a.late?'late':'present'):'absent';return `<div class="attendanceRow"><div class="attendanceTop noPhoto editAttendanceTop"><div class="studentIdentity"><span class="studentName">${esc(st.name)}</span><span class="studentMeta">${esc(st.grade||'학년 미지정')}</span></div></div><div class="attendanceFlags"><button class="flagBtn ${stat==='present'?'active':''}" data-edit-student-status="present" data-id="${st.id}">출석</button><button class="flagBtn ${stat==='late'?'active':''}" data-edit-student-status="late" data-id="${st.id}">지각</button><button class="flagBtn ${stat==='absent'?'active':''}" data-edit-student-status="absent" data-id="${st.id}">결석</button><button class="flagBtn ${a.newcomer?'active':''}" data-edit-student-newcomer="${st.id}">새친구</button></div><div class="memoLine"><input class="memo" data-edit-student-memo="${st.id}" value="${attr(a.memo||'')}" placeholder="비고"></div></div>`;}).join('')}</div><button class="primary fullBtn" data-act="saveStudentAttendanceEdit">수정 저장</button>`);
    }
    if(ui.modal?.type==='teacherAttendanceEdit'){
      const d=ui.teacherAttendanceEditDraft;if(!d)return '';const ids=Object.keys(d.attendance||{}),list=state.teachers.filter(t=>ids.includes(t.id)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ko'));
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">교사 출석 수정</div><div class="muted">${esc(displayDate(d.date))} · 이 날짜의 기록만 수정합니다.</div></div>${close}</div><div class="list">${list.map(t=>{const a=draftTeacher(t.id),stat=a.present?(a.late?'late':'present'):'absent';return `<div class="attendanceRow"><div class="attendanceTop noPhoto editAttendanceTop"><div class="studentIdentity"><span class="studentName">${esc(t.name)}</span><span class="studentMeta">${esc(t.role||'담당 미지정')}</span></div></div><div class="attendanceFlags"><button class="flagBtn ${stat==='present'?'active':''}" data-edit-teacher-status="present" data-id="${t.id}">출석</button><button class="flagBtn ${stat==='late'?'active':''}" data-edit-teacher-status="late" data-id="${t.id}">지각</button><button class="flagBtn ${stat==='absent'?'active':''}" data-edit-teacher-status="absent" data-id="${t.id}">결석</button></div><div class="memoLine"><input class="memo" data-edit-teacher-reason="${t.id}" value="${attr(a.reason||'')}" placeholder="비고 · 사유"></div></div>`;}).join('')||'<div class="empty">표시할 교사가 없습니다.</div>'}</div><button class="primary fullBtn" data-act="saveTeacherAttendanceEdit">수정 저장</button>`);
    }
    if(ui.modal?.type==='attendanceBundlePreview'){
      const s=ui.attendanceBundlePreview?.summary||{};const unknown=[...(s.unknownStudents||[]),...(s.unknownTeachers||[])];
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">출석 기록 가져오기</div><div class="muted">기존 기록을 지우지 않고 같은 날짜·같은 사람의 출석만 업데이트합니다.</div></div>${close}</div><div class="card">${kv('학생 출석',`${s.studentSessions||0}회 · ${s.studentRows||0}건`)}${kv('교사 출석',`${s.teacherSessions||0}회 · ${s.teacherRows||0}건`)}${kv('일치하지 않음',`${unknown.length}건`)}</div>${unknown.length?`<div class="notice">확인 필요: ${esc(unknown.slice(0,12).join(', '))}${unknown.length>12?' 외':''}</div>`:''}<button class="primary fullBtn" data-act="confirmAttendanceBundleImport">출석 기록 업데이트</button>`);
    }
    if(ui.modal?.type==='distributionAttendanceOptions'){
      const care=ui.modal.kind==='care';
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${care?'임원·양육교사용':'청년교사용'} 데이터팩</div><div class="muted">기본 명단은 항상 포함됩니다. 출석 기록만 선택해서 함께 보낼 수 있습니다.</div></div>${close}</div><div class="card"><label class="fieldLabel"><input id="packStudentAttendance" type="checkbox" ${care?'checked':''}> 학생 출석 기록 포함</label><div class="divider"></div><label class="fieldLabel"><input id="packTeacherAttendance" type="checkbox" ${care?'checked':''}> 교사 출석 기록 포함</label></div><div class="notice">출석을 포함해도 달란트 기록과 심방 기록은 자동으로 포함되지 않습니다. 받는 기기의 기존 출석은 삭제하지 않고 같은 날짜만 업데이트합니다.</div><button class="primary fullBtn" data-act="exportDistributionWithAttendance">내보내기</button>`);
    }
    if(ui.modal?.type==='pastePreview'&&ui.modal.preview?.type==='teacher-attendance'){
      const p=ui.modal.preview;return modal(`<div class="modalTitleRow"><div><div class="titleSmall">받은 교사 출석 확인</div><div class="muted">같은 날짜 기록이 있으면 새로 만들지 않고 업데이트합니다.</div></div>${close}</div><div class="card">${kv('종류','교사 출석')}${kv('날짜',p.date)}${kv('찾은 교사',`${p.matched}명`)}${kv('찾지 못한 이름',`${p.unknown.length}명`)}${p.existing?kv('기존 기록','있음 · 업데이트 예정'):''}${p.duplicate?kv('중복','이미 반영된 동일 메시지'):''}</div>${p.unknown.length?`<div class="notice">찾지 못함: ${esc(p.unknown.join(', '))}</div>`:''}<button class="primary fullBtn" data-act="confirmPastedRecord" ${p.duplicate?'disabled':''}>${p.duplicate?'이미 반영됨':p.existing?'기존 기록 업데이트':'기록 합치기'}</button>`);
    }
    return priorModalHtml_v1532();
  };

  const priorHandleAct_v1532=handleAct;
  handleAct=function(act,b){
    if(act==='teacherAttendanceHistory'){ui.teacherHistoryRange='최근 5회';ui.modal={type:'teacherAttendanceHistory'};return render();}
    if(act==='saveStudentAttendanceEdit')return saveStudentAttendanceEdit();
    if(act==='saveTeacherAttendanceEdit')return saveTeacherAttendanceEdit();
    if(act==='exportAttendanceBundle')return exportAttendanceBundle();
    if(act==='importAttendanceBundle')return chooseAttendanceBundleFile();
    if(act==='confirmAttendanceBundleImport'){const b=ui.attendanceBundlePreview?.bundle;if(!b)return;return applyAttendanceBundle(b);}
    if(act==='exportDistributionWithAttendance')return exportDistributionPackWithAttendance();
    return priorHandleAct_v1532(act,b);
  };

  const priorBind_v1532=bind;
  bind=function(){
    priorBind_v1532();
    document.querySelectorAll('[data-teacher-history-range]').forEach(b=>b.onclick=()=>{ui.teacherHistoryRange=b.dataset.teacherHistoryRange;render();});
    document.querySelectorAll('[data-edit-student-session]').forEach(b=>b.onclick=()=>openStudentAttendanceEdit(b.dataset.editStudentSession));
    document.querySelectorAll('[data-edit-teacher-session]').forEach(b=>b.onclick=()=>openTeacherAttendanceEdit(b.dataset.editTeacherSession));
    document.querySelectorAll('[data-edit-student-status]').forEach(b=>b.onclick=()=>setDraftStudent(b.dataset.id,b.dataset.editStudentStatus));
    document.querySelectorAll('[data-edit-student-newcomer]').forEach(b=>b.onclick=()=>toggleDraftNewcomer(b.dataset.editStudentNewcomer));
    document.querySelectorAll('[data-edit-teacher-status]').forEach(b=>b.onclick=()=>setDraftTeacher(b.dataset.id,b.dataset.editTeacherStatus));
  };

  render();
})();
