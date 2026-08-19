const APP_VERSION = '1.5.3.18';
const STORAGE_KEY = 'church-school-mobile-v4'; // v0.4 데이터 그대로 이어서 사용

const sampleStudents = [];

const sampleTeachers = [];

const defaultState = {
  version:5,
  students:sampleStudents,
  teachers:sampleTeachers,
  sessions:{},
  teacherSessions:{},
  teams:[],
  settings:{
    amounts:[10,20,50,100],
    department:'초등부',
    managementScope:'전체',
    teacherAttendanceEnabled:false,
    attendanceSort:'attendance',
    talentSort:'name',
    studentSort:'name',
    longAbsenceDays:60,
    customStudentOrder:[],
    managedGrades:[],
    managedTeams:[],
    adminMode:true
  },
  importedPacketIds:[],
  snapshots:[]
};

let state = loadState();
let pendingMerge = null;
let ui = {
  tab:'talent',
  date:todayKey(),
  filterType:'학년', filterValue:state.settings.adminMode?'전체':(state.settings.managementScope||state.settings.managedGrades?.[0]||'전체'),
  attendanceGrade:state.settings.managementScope || '전체',
  studentGrade:state.settings.adminMode?'전체':(state.settings.managementScope||state.settings.managedGrades?.[0]||'전체'),
  attendanceMode:'student',
  selected:new Set(), multiplier:1, sign:1,
  undo:[], redo:[], modal:null,
  importPreview:null, importMode:'update', photoStudentId:null, lastTxId:null,
  analyticsRange:'이번 달', analyticsScope:state.settings.managementScope || '전체',
  teamEditId:null, teamGrade:'전체', gradeSelected:new Set(), bulkGrade:'전체', bulkSelected:new Set(), orderGrade:'전체', birthdayMonth:new Date().getMonth()+1,
  attendanceDraft:null, attendanceDraftKey:'', teacherAttendanceDraft:null, teacherAttendanceDraftKey:'',
  scopeMenu:null, settingsDefaultGrade:null
};

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function uid(prefix='id'){ return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`; }
function todayKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function displayDate(k=ui.date){ const d=new Date(`${k}T12:00:00`); return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(d); }
function fmt(n){ return Number(n||0).toLocaleString('ko-KR'); }
function esc(s=''){ return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function attr(s=''){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function normalize(v){ return String(v||'').replace(/\s+/g,'').replace(/[()\[\]-]/g,'').toLowerCase(); }
function normalizeGrade(v){ const raw=String(v||'').trim(); if(!raw)return ''; const compact=raw.replace(/\s+/g,''); const m=compact.match(/^(?:초등?|초)?([1-6])(?:학년|학년부)?$/); if(m)return `${m[1]}학년`; const m2=compact.match(/^([1-6])$/); if(m2)return `${m2[1]}학년`; return raw; }
function phoneUri(v){ return String(v||'').replace(/[^0-9+]/g,''); }

function migrate(x){
  const s = Object.assign(clone(defaultState), x || {});
  s.settings = Object.assign(clone(defaultState.settings), x?.settings || {});
  s.students = Array.isArray(x?.students) ? x.students : clone(sampleStudents);
  s.teachers = Array.isArray(x?.teachers) ? x.teachers : clone(sampleTeachers);
  s.sessions = x?.sessions || {};
  s.teacherSessions = x?.teacherSessions || {};
  s.teams = Array.isArray(x?.teams) ? x.teams : [];
  s.importedPacketIds = Array.isArray(x?.importedPacketIds) ? x.importedPacketIds : [];
  s.snapshots = Array.isArray(x?.snapshots) ? x.snapshots : [];
  s.version = 8;
  s.settings.attendanceSort ||= 'attendance';
  s.settings.talentSort ||= 'name';
  s.settings.studentSort ||= 'name';
  s.settings.longAbsenceDays = Number(s.settings.longAbsenceDays||60);
  s.settings.customStudentOrder = Array.isArray(s.settings.customStudentOrder)?s.settings.customStudentOrder:[];
  s.settings.managedGrades = Array.isArray(s.settings.managedGrades)?s.settings.managedGrades:[];
  s.settings.managedTeams = Array.isArray(s.settings.managedTeams)?s.settings.managedTeams:[];
  if(typeof s.settings.adminMode!=='boolean') s.settings.adminMode=true;
  s.students.forEach(st=>{ st.teams=Array.isArray(st.teams)?st.teams:[]; st.grade=st.grade||''; st.parentRelation=st.parentRelation||''; st.parent2Name=st.parent2Name||''; st.parent2Relation=st.parent2Relation||''; st.parent2Phone=st.parent2Phone||''; st.longTermManual=!!st.longTermManual; if(st.active===undefined)st.active=true; });
  s.teachers.forEach(t=>{ t.birthday=t.birthday||''; t.emergencyPhone=t.emergencyPhone||''; if(t.active===undefined)t.active=true; });
  return s;
}
function loadState(){ try{ const raw=localStorage.getItem(STORAGE_KEY); if(raw) return migrate(JSON.parse(raw)); }catch(e){} return clone(defaultState); }
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function snapshotPayload(){
  const x=clone(state);
  x.snapshots=[];
  return x;
}
function createSnapshot(label){
  state.snapshots ||= [];
  state.snapshots.unshift({id:uid('snap'),label,createdAt:new Date().toISOString(),data:snapshotPayload()});
  state.snapshots=state.snapshots.slice(0,5);
  save();
}
function restoreSnapshot(id){
  const snap=(state.snapshots||[]).find(x=>x.id===id);
  if(!snap)return toast('복원할 이전 상태를 찾지 못했습니다.');
  if(!confirm(`${snap.label} 이전 상태로 복원할까요?\n현재 상태는 자동으로 한 번 보관합니다.`))return;
  const keep=clone(state.snapshots||[]);
  const current={id:uid('snap'),label:'복원 직전 상태',createdAt:new Date().toISOString(),data:snapshotPayload()};
  state=migrate(clone(snap.data));
  state.snapshots=[current,...keep.filter(x=>x.id!==id)].slice(0,5);
  save();toast('이전 상태로 복원했습니다.');ui.modal=null;render();
}
function pushUndo(){ ui.undo.push(clone(state)); if(ui.undo.length>80)ui.undo.shift(); ui.redo=[]; }
function undo(){ if(!ui.undo.length)return; ui.redo.push(clone(state)); state=ui.undo.pop(); save(); toast('이전 작업을 취소했습니다.'); render(); }
function redo(){ if(!ui.redo.length)return; ui.undo.push(clone(state)); state=ui.redo.pop(); save(); toast('다시 적용했습니다.'); render(); }

function ensureSession(k=ui.date){
  if(!state.sessions[k]) state.sessions[k]={attendance:{},transactions:[]};
  state.sessions[k].attendance ||= {};
  state.sessions[k].transactions ||= [];
  return state.sessions[k];
}
function ensureTeacherSession(k=ui.date){
  if(!state.teacherSessions[k]) state.teacherSessions[k]={attendance:{}};
  state.teacherSessions[k].attendance ||= {};
  return state.teacherSessions[k];
}
function obviousNonPersonName(v){ const t=String(v||'').trim(); if(!t)return true; if(/[：:]/.test(t))return true; if(/(?:\d{1,2}월)?\s*생일자|전화번호|연락처|주소|학부모|보호자|학교명?|형제관계|기재사항|특이사항|비고|메모/.test(t))return true; if(/^[-+()0-9\s]{7,}$/.test(t))return true; return false; }
function cleanupStudents(){ return state.students.filter(s=>s.active!==false); }
function active(){ return cleanupStudents().filter(s=>!obviousNonPersonName(s.name)); }
function activeTeachers(){ return state.teachers.filter(t=>t.active!==false); }
function studentById(id){ return state.students.find(s=>s.id===id); }
function teacherById(id){ return state.teachers.find(t=>t.id===id); }
function grades(){ return [...new Set(active().map(s=>String(s.grade||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko')); }
function allTeams(){ return [...new Set([...(state.teams||[]),...active().flatMap(s=>s.teams||[])].filter(Boolean))]; }
function att(st,k=ui.date){
  const raw=state.sessions?.[k]?.attendance?.[st.id] || {};
  const legacy=raw.status||'unset';
  const present=(typeof raw.present==='boolean')?raw.present:['present','late','new'].includes(legacy);
  return {...raw,present,late:(typeof raw.late==='boolean'?raw.late:legacy==='late'),newcomer:(typeof raw.newcomer==='boolean'?raw.newcomer:legacy==='new'),memo:raw.memo||'',status:present?'present':'absent'};
}
function teacherAtt(t,k=ui.date){
  const raw=state.teacherSessions?.[k]?.attendance?.[t.id] || {};
  const legacy=raw.status||'unset';
  const present=(typeof raw.present==='boolean')?raw.present:['present','late'].includes(legacy);
  return {...raw,present,late:(typeof raw.late==='boolean'?raw.late:legacy==='late'),reason:raw.reason||'',status:present?'present':'absent'};
}
function statusLabel(s){ return ({present:'출석',absent:'결석',late:'지각',new:'새친구',unset:'미체크'})[s] || s; }
function teacherStatusLabel(s){ return ({present:'출석',absent:'결석',late:'지각',unset:'미체크'})[s] || s; }
function presentStatus(s){ return ['present','late','new'].includes(s); }
function isPresent(st,k=ui.date){ return !!att(st,k).present; }
function attendanceCounts(list=active(),k=ui.date){
  const c={present:0,absent:0,late:0,new:0,unset:0};
  list.forEach(st=>{const a=att(st,k); if(a.present)c.present++; else c.absent++; if(a.late)c.late++; if(a.newcomer)c.new++;});
  return c;
}
function teacherAttendanceCounts(list=activeTeachers(),k=ui.date){
  const c={present:0,absent:0,late:0,unset:0};
  list.forEach(t=>{const a=teacherAtt(t,k); if(a.present)c.present++; else c.absent++; if(a.late)c.late++;});
  return c;
}
function todayAmt(id,k=ui.date){
  let bal=0;
  for(const t of (state.sessions?.[k]?.transactions||[])){
    if(!(t.studentIds||[]).includes(id))continue;
    if(t.kind==='reset') bal=0; else bal+=Number(t.amount||0);
  }
  return bal;
}
function totalAmt(id){
  let bal=0;
  for(const k of Object.keys(state.sessions).sort()){
    for(const t of state.sessions[k].transactions||[]){
      if(!(t.studentIds||[]).includes(id))continue;
      if(t.kind==='reset') bal=0; else bal+=Number(t.amount||0);
    }
  }
  return bal;
}
function sessionTotal(k=ui.date){ return (state.sessions?.[k]?.transactions||[]).reduce((sum,t)=>t.kind==='reset'?sum:sum+Number(t.amount||0)*(t.studentIds||[]).length,0); }
function initials(n){ return (n||'?').slice(-2); }
function avatar(st,cls='avatar'){ return st.photo?`<span class="${cls}"><img src="${st.photo}" alt="${attr(st.name||'학생')} 사진"></span>`:''; }
function avatarCell(st){ return st.photo?avatar(st):'<span class="avatarSpacer"></span>'; }

function scopeStudents(scope='전체'){
  const key=String(scope||'전체');
  if(key==='전체')return active();
  if(key==='내 담당'){
    const managed=state.settings.managedGrades||[];
    return managed.length?active().filter(s=>managed.includes(s.grade)):active();
  }
  if(key.startsWith('팀:')){
    const team=key.slice(2);
    return active().filter(s=>(s.teams||[]).includes(team));
  }
  return active().filter(s=>s.grade===key);
}
function scopedStudents(scope=state.settings.managementScope||'전체'){ return scopeStudents(scope); }
function scopeOptionsWithManaged(){ return ['전체',...grades()]; }
function scopeChoices(includeTeams=true){
  const out=['전체',...grades()];
  if(includeTeams) allTeams().forEach(t=>out.push(`팀:${t}`));
  return out;
}
function scopeLabel(scope){
  const key=String(scope||'전체');
  return key.startsWith('팀:')?key.slice(2):key;
}
function scopeChoiceHtml(view,current,includeTeams=true){
  const open=ui.scopeMenu===view;
  const choices=scopeChoices(includeTeams);
  return `<div class="scopeChooser"><button class="scopeChooserBtn ${open?'active':''}" data-scope-toggle="${view}"><span>보기</span><strong>${esc(scopeLabel(current))}</strong><b>${open?'▲':'▼'}</b></button>${open?`<div class="scopeChooserPanel">${choices.map(v=>`<button class="chip ${current===v?'active':''}" data-scope-pick="${attr(v)}" data-scope-view="${view}">${v.startsWith('팀:')?'팀 · ':''}${esc(scopeLabel(v))}</button>`).join('')}</div>`:''}</div>`;
}
function koName(a,b){ return String(a.name||'').localeCompare(String(b.name||''),'ko'); }
function lastPresentDate(st){
  const keys=Object.keys(state.sessions).sort().reverse();
  for(const k of keys){ const raw=state.sessions[k]?.attendance?.[st.id]; if(raw && att(st,k).present) return k; }
  return '';
}
function longAbsenceInfo(st){
  if(st.longTermManual) return {long:true,label:'수동 장기 미출석',days:99999,last:lastPresentDate(st)};
  const last=lastPresentDate(st);
  if(!last) return {long:false,label:'출석 기록 없음',days:0,last:''};
  const days=Math.max(0,Math.floor((new Date(`${ui.date}T12:00:00`)-new Date(`${last}T12:00:00`))/86400000));
  const months=Math.floor(days/30);
  const label=months>=1?`${months}개월 미출석`:`${Math.floor(days/7)}주 미출석`;
  return {long:days >= Number(state.settings.longAbsenceDays||60),label:days>6?label:'최근 출석',days,last};
}
function customRank(st){ const a=state.settings.customStudentOrder||[]; const i=a.indexOf(st.id); return i<0?999999:i; }
function sortStudents(arr,mode){
  const out=[...arr];
  if(mode==='name') return out.sort(koName);
  if(mode==='grade') return out.sort((a,b)=>String(a.grade||'').localeCompare(String(b.grade||''),'ko')||koName(a,b));
  if(mode==='custom') return out.sort((a,b)=>customRank(a)-customRank(b)||koName(a,b));
  if(mode==='attendance') return out.sort((a,b)=>{
    const A=longAbsenceInfo(a),B=longAbsenceInfo(b);
    if(A.long!==B.long)return A.long?1:-1;
    if(A.days!==B.days)return A.days-B.days;
    return koName(a,b);
  });
  return out;
}
function filterStudents(){
  let arr=active();
  if(ui.filterType==='학년'){
    if(ui.filterValue!=='전체') arr=arr.filter(s=>s.grade===ui.filterValue);
  }
  if(ui.filterType==='성별' && ui.filterValue!=='전체') arr=arr.filter(s=>s.gender===ui.filterValue);
  if(ui.filterType==='팀' && ui.filterValue!=='전체') arr=arr.filter(s=>(s.teams||[]).includes(ui.filterValue));
  return sortStudents(arr,state.settings.talentSort||'name');
}
function filterOptions(){
  if(ui.filterType==='학년') return scopeOptionsWithManaged();
  if(ui.filterType==='성별') return ['전체','남','여'];
  if(ui.filterType==='팀'){
    const teams=state.settings.adminMode?allTeams():(state.settings.managedTeams||[]);
    return ['전체',...teams];
  }
  return ['전체'];
}
function targetIds(){ return [...ui.selected].filter(id=>studentById(id)?.active!==false && !obviousNonPersonName(studentById(id)?.name)); }

function addTalent(base){
  const ids=targetIds();
  if(!ids.length) return toast('지급할 학생을 먼저 선택해 주세요.');
  pushUndo();
  const amount=Number(base)*ui.sign;
  const tx={id:uid('tx'),date:ui.date,studentIds:ids,base:Number(base),multiplier:1,sign:ui.sign,amount,time:new Date().toISOString(),filterType:ui.filterType,filterValue:ui.filterValue,reason:'',x2Applied:false};
  ensureSession().transactions.push(tx);
  ui.lastTxId=tx.id; ui.selected.clear(); ui.multiplier=1; ui.sign=1;
  save(); toast(`${ids.length}명 · ${amount>0?'+':''}${fmt(amount)} 달란트`); render();
}

function resetTalentFor(ids,label='선택 학생'){
  ids=[...new Set(ids)].filter(id=>studentById(id)?.active!==false);
  if(!ids.length)return toast('리셋할 학생이 없습니다.');
  const targets=ids.filter(id=>totalAmt(id)!==0 || Object.values(state.sessions).some(sess=>(sess.transactions||[]).some(t=>(t.studentIds||[]).includes(id))));
  if(!targets.length)return toast('리셋할 달란트 기록이 없습니다.');
  if(!confirm(`${label} ${targets.length}명의 달란트를 새로 시작할까요?\n이 학생들의 이전 지급·차감 내역은 현재 기록에서 지워지고 잔액은 0이 됩니다.\n실수했다면 바로 되돌리기로 복구할 수 있습니다.`))return;
  pushUndo();
  const set=new Set(targets);
  for(const sess of Object.values(state.sessions)){
    sess.transactions=(sess.transactions||[]).map(t=>{
      const kept=(t.studentIds||[]).filter(id=>!set.has(id));
      if(!kept.length)return null;
      const nt={...t,studentIds:kept};
      if(t.resetFrom){nt.resetFrom={};for(const id of kept)if(Object.prototype.hasOwnProperty.call(t.resetFrom,id))nt.resetFrom[id]=t.resetFrom[id];}
      return nt;
    }).filter(Boolean);
  }
  ui.lastTxId=null; ui.selected.clear(); ui.modal=null; save(); toast(`${targets.length}명 달란트 새 회차 시작 · 되돌리기 가능`); render();
}
function visibleIds(){return filterStudents().map(s=>s.id);}
function toggleLongTerm(id){ const st=studentById(id); if(!st)return; pushUndo(); st.longTermManual=!st.longTermManual; save(); ui.modal={type:'detail',id}; toast(st.longTermManual?'장기 미출석으로 지정했습니다.':'수동 장기 미출석 지정을 해제했습니다.'); render(); }
function birthdayStudents(month){ return sortStudents(scopedStudents().filter(st=>{const m=Number(String(st.birthday||'').slice(5,7));return m===Number(month);}), 'name'); }
function renderKeepModalScroll(){ const old=document.querySelector('.modal'); const y=old?old.scrollTop:0; render(); requestAnimationFrame(()=>{const m=document.querySelector('.modal');if(m)m.scrollTop=y;}); }

function historyArrow(dir='left'){ const flip=dir==='right'?'transform=\"scale(-1,1) translate(-24,0)\"':''; return `<svg viewBox="0 0 24 24" aria-hidden="true"><g ${flip}><path d="M9 7H5v-4M5.4 7.2A8 8 0 1 1 4 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`; }
function topbar(){
  const title={talent:'달란트',attendance:'출석부',records:'기록',students:'학생',settings:'설정'}[ui.tab];
  return `<div class="top"><div><div class="eyebrow">${displayDate()} · ${esc(state.settings.department||'교회학교')}</div><div class="title">${title}</div></div><div class="icons">${['talent','attendance'].includes(ui.tab)?`<button class="icon historyIcon" data-act="undo" ${ui.undo.length?'':'disabled'} aria-label="실행 취소">${historyArrow('left')}</button><button class="icon historyIcon" data-act="redo" ${ui.redo.length?'':'disabled'} aria-label="다시 실행">${historyArrow('right')}</button>`:''}<button class="icon" data-act="shareMenu" aria-label="공유">↗</button></div></div>`;
}
function dateControl(){ return `<div class="card"><div class="row"><div><div class="label">기록 날짜</div><div class="muted">날짜를 바꾸면 그날 기록이 열립니다.</div></div><div class="datePick"><input id="mainDate" class="input" type="date" value="${ui.date}"></div></div></div>`; }
function hero(){ const list=filterStudents(); const c=attendanceCounts(list); const present=c.present; return `<section class="hero"><div class="heroGrid"><div><div class="big">${present}<span>/${list.length}</span></div><div class="heroLabel">현재 범위 출석</div></div><div class="heroRight"><strong>${fmt(sessionTotal())}</strong><div class="heroLabel">이날 총 달란트</div></div></div></section>`; }

function talentView(){
  const list=filterStudents();
  const last=(state.sessions?.[ui.date]?.transactions||[]).find(t=>t.id===ui.lastTxId);
  const selectedLabel=ui.selected.size?`선택 ${ui.selected.size}명`:'학생을 선택해 주세요';
  const talentScope=ui.filterType==='팀'?`팀:${ui.filterValue}`:ui.filterValue;
  return `${dateControl()}${hero()}
    <div class="viewActionRow"><button class="shareAction" data-act="shareCurrentTalent">공유</button><span>현재 범위 달란트 현황을 바로 공유합니다.</span></div>
    ${scopeChoiceHtml('talent',talentScope,true)}
    <div class="sectionHead"><div><div class="sectionTitle">학생 선택</div><div class="muted">대상을 선택하고 금액을 누르면 바로 지급됩니다.</div></div><span class="badge">${selectedLabel}</span></div>
    <div class="list">${list.map(st=>`<button class="studentRow ${st.photo?'hasPhoto':'noPhoto'} ${ui.selected.has(st.id)?'selected':''}" data-selectstudent="${st.id}">${avatarCell(st)}<span><span class="studentName">${esc(st.name)}</span><span class="studentMeta">${esc(st.grade||'학년 미지정')}${att(st).present?' · 출석':''}</span></span><span class="amount ${todayAmt(st.id)<0?'negative':''}">${todayAmt(st.id)>0?'+':''}${fmt(todayAmt(st.id))}</span></button>`).join('')||'<div class="empty">학생이 없습니다.</div>'}</div>
    <div class="bottomSheet talentPanel"><div class="targetRow"><strong>${selectedLabel}</strong><div class="compactActions"><button class="mini" data-act="selectAllVisible">전체 선택</button><button class="mini" data-act="selectVisible">출석자 선택</button><button class="mini" data-act="clearSelect">해제</button><button class="mini resetMini" data-act="talentResetMenu">리셋</button>${last?`<button class="mini" data-act="shareLast">방금 기록 공유</button>`:''}</div></div><div class="talentActionLine"><button class="signMode minus ${ui.sign<0?'active':''}" data-act="toggleMinus">− 차감</button><span>${ui.sign<0?'차감할 금액을 누르세요':'금액을 누르면 바로 지급됩니다'}</span></div><div class="moneyRow">${state.settings.amounts.slice(0,4).map(a=>`<button class="money ${ui.sign<0?'minus':''}" data-money="${a}">${ui.sign<0?'−':'+'}${fmt(a)}</button>`).join('')}<button class="money mult" data-act="x2" ${last&&last.kind!=='reset'&&!last.x2Applied?'':'disabled'}>×2</button></div></div>`;
}

function attendanceScopeList(){
  const list=scopeStudents(ui.attendanceGrade);
  return [...list].sort((a,b)=>{
    const A=longAbsenceInfo(a), B=longAbsenceInfo(b);
    if(A.long!==B.long) return A.long?1:-1;
    return koName(a,b);
  });
}
function attendanceDraftKey(){ return `${ui.date}|${ui.attendanceGrade}`; }
function attendanceGradeSummary(){
  const gs=state.settings.adminMode?grades():(state.settings.managedGrades||[]);
  return `<div class="gradeOverview">${gs.map(g=>{const ss=scopedStudents(g);const cc=attendanceCounts(ss);const n=cc.present;return `<button data-attgrade="${attr(g)}"><strong>${esc(g)}</strong><span>${n}/${ss.length}명</span></button>`}).join('')}</div>`;
}
function attendanceView(){
  if(state.settings.teacherAttendanceEnabled && ui.attendanceMode==='teacher') return teacherAttendanceView();
  const list=attendanceScopeList(); const c=attendanceCounts(list); const present=c.present;
  const long=list.filter(s=>longAbsenceInfo(s).long), regular=list.filter(s=>!longAbsenceInfo(s).long);
  const listHtml=long.length
    ? `${regular.map(st=>attendanceRow(st,false)).join('')}<div class="listSection"><strong>장기 미출석 · 관리</strong><small>${long.length}명 · 기본 2개월, 설정에서 변경 가능</small></div>${long.map(st=>attendanceRow(st,true)).join('')}`
    : regular.map(st=>attendanceRow(st,false)).join('');
  return `${dateControl()}
    ${state.settings.teacherAttendanceEnabled?`<div class="seg"><button class="segBtn active" data-attmode="student">학생</button><button class="segBtn" data-attmode="teacher">교사</button></div>`:''}
    <div class="attendanceSummary attendanceSummaryStrong"><div class="attendanceSummaryMain"><div><div class="label lightLabel">${esc(scopeLabel(ui.attendanceGrade))} 출석</div><div class="attendanceBig"><strong>${present}</strong><span>/ ${list.length}명</span></div><div class="summarySub">결석 ${c.absent} · 지각 ${c.late} · 새친구 ${c.new}</div></div><button class="shareAction" data-act="shareCurrentAttendance">공유</button></div><div class="attendanceBulk"><button class="primary" data-act="attendanceSelectAll">전체 선택</button><button class="secondary darkSecondary" data-act="attendanceClearAll">전체 해제</button></div></div>
    ${scopeChoiceHtml('attendance',ui.attendanceGrade,true)}
    <div class="sortBar"><span>정렬</span><button class="sortBtn active" disabled>가나다</button></div>
    <div class="list">${listHtml||'<div class="empty">학생이 없습니다.</div>'}</div>`;
}
function attendanceRow(st,isLong=false){
  const a=att(st), info=longAbsenceInfo(st);
  return `<div class="attendanceRow ${isLong?'longAbsent':''}"><div class="attendanceTop ${st.photo?'hasPhoto':'noPhoto'}">${st.photo?`<button class="avatarButton" data-detail="${st.id}">${avatar(st)}</button>`:''}<button class="studentIdentity" data-detail="${st.id}"><span class="studentName">${esc(st.name)}</span><span class="studentMeta">${esc(st.grade||'학년 미지정')}${isLong?` · ${esc(info.label)}${info.last?` · 마지막 ${info.last.slice(5).replace('-','/')}`:''}`:' · 상세보기'}</span></button><button class="attendanceToggle ${a.present?'active':''}" data-attendance-toggle="${st.id}">${a.present?'✓':'출석'}</button></div><div class="attendanceFlags"><button class="flagBtn ${a.late?'active':''}" data-attendance-flag="late" data-student="${st.id}">지각</button><button class="flagBtn ${a.newcomer?'active':''}" data-attendance-flag="newcomer" data-student="${st.id}">새친구</button><button class="flagBtn longTermBtn ${st.longTermManual?'active':''}" data-longterm-toggle="${st.id}">${st.longTermManual?'장기 해제':'장기 미출석'}</button></div><div class="memoLine autoMemo"><input class="memo" data-memo="${st.id}" value="${attr(a.memo||'')}" placeholder="비고 · 결석 사유 · 전달사항"><span class="memoSaved" data-memo-saved="${st.id}"></span></div></div>`;
}

function toggleLongTermAttendance(id){
  const st=studentById(id); if(!st)return;
  pushUndo(); st.longTermManual=!st.longTermManual; save();
  toast(st.longTermManual?'장기 미출석으로 지정했습니다. 목록 아래로 이동합니다.':'장기 미출석 지정을 해제했습니다.');
  render();
}

function teacherAttendanceDraftKey(){ return `${ui.date}|teachers`; }
function teacherAttendanceView(){
  const list=activeTeachers(); const c=teacherAttendanceCounts(list); const present=c.present;
  return `${dateControl()}<div class="seg"><button class="segBtn" data-attmode="student">학생</button><button class="segBtn active" data-attmode="teacher">교사</button></div>
    <div class="attendanceSummary attendanceSummaryStrong"><div class="attendanceSummaryMain"><div><div class="label lightLabel">교사 출석</div><div class="attendanceBig"><strong>${present}</strong><span>/ ${list.length}명</span></div><div class="summarySub">결석 ${c.absent} · 지각 ${c.late}</div></div><button class="shareAction" data-act="shareCurrentTeacherAttendance">공유</button></div><div class="attendanceBulk"><button class="primary" data-act="teacherSelectAll">전체 선택</button><button class="secondary darkSecondary" data-act="teacherClearAll">전체 해제</button></div></div>
    <div class="list">${list.map(t=>{const a=teacherAtt(t);return `<div class="attendanceRow"><div class="attendanceTop teacherTop"><button class="studentIdentity" data-teacher-detail="${t.id}"><span class="studentName">${esc(t.name)}</span><span class="studentMeta">${esc(t.role||'담당 미지정')} · 연락처 보기</span></button><button class="attendanceToggle ${a.present?'active':''}" data-teacher-attendance-toggle="${t.id}">${a.present?'✓':'출석'}</button></div><div class="attendanceFlags"><button class="flagBtn ${a.late?'active':''}" data-teacher-flag="late" data-teacher="${t.id}">지각</button></div><div class="memoLine autoMemo"><input class="memo" data-teacher-reason="${t.id}" value="${attr(a.reason||'')}" placeholder="비고 · 결석/지각 사유"><span class="memoSaved" data-teacher-saved="${t.id}"></span></div></div>`}).join('')||'<div class="empty">교사가 없습니다.</div>'}</div>`;
}

function analyticsDates(range){
  const keys=Object.keys(state.sessions).filter(k=>typeof attendanceSessionRecorded==='function'?attendanceSessionRecorded(k):Object.keys(state.sessions[k]?.attendance||{}).length>0).sort();
  if(range==='전체') return keys;
  const now=new Date(`${ui.date}T12:00:00`); let start;
  if(range==='이번 달') start=new Date(now.getFullYear(),now.getMonth(),1);
  else if(range==='지난 달'){ start=new Date(now.getFullYear(),now.getMonth()-1,1); const end=new Date(now.getFullYear(),now.getMonth(),1); return keys.filter(k=>{const d=new Date(`${k}T12:00:00`);return d>=start&&d<end;}); }
  else if(range==='최근 3개월') start=new Date(now.getFullYear(),now.getMonth()-2,1);
  else if(range==='최근 6개월') start=new Date(now.getFullYear(),now.getMonth()-5,1);
  else start=new Date(0);
  return keys.filter(k=>new Date(`${k}T12:00:00`)>=start && new Date(`${k}T12:00:00`)<=now);
}
function studentAnalytics(st,dates){
  let attended=0, absent=0, checked=0, streak=0, maxRecentAbsent=0;
  dates.forEach(k=>{const raw=state.sessions[k]?.attendance?.[st.id]; if(!raw)return; const a=att(st,k); checked++; if(a.present){attended++;streak=0;}else{absent++;streak++;maxRecentAbsent=Math.max(maxRecentAbsent,streak);} });
  const recent=[...dates].sort().reverse(); let currentAbs=0; for(const k of recent){const raw=state.sessions[k]?.attendance?.[st.id];if(!raw)continue; if(!att(st,k).present)currentAbs++; else break;}
  return {attended,absent,checked,currentAbs,maxRecentAbsent};
}
function recordsView(){
  const dates=analyticsDates(ui.analyticsRange);
  const list=(ui.analyticsScope==='내 담당'?scopedStudents('내 담당'):ui.analyticsScope==='전체'?scopedStudents('전체'):scopedStudents(ui.analyticsScope));
  const totalMarked=list.reduce((n,st)=>n+studentAnalytics(st,dates).checked,0);
  const totalAtt=list.reduce((n,st)=>n+studentAnalytics(st,dates).attended,0);
  const focus=list.filter(st=>studentAnalytics(st,dates).currentAbs>=2 || (studentAnalytics(st,dates).checked>=3 && studentAnalytics(st,dates).attended/studentAnalytics(st,dates).checked<=0.5));
  const sessionDates=Object.keys(state.sessions).filter(k=>Object.keys(state.sessions[k]?.attendance||{}).length>0).sort().reverse();
  return `<div class="chips">${['이번 달','지난 달','최근 3개월','최근 6개월','전체'].map(v=>`<button class="chip ${ui.analyticsRange===v?'active':''}" data-range="${v}">${v}</button>`).join('')}</div>
    <div class="chips">${scopeOptionsWithManaged().map(v=>`<button class="chip ${ui.analyticsScope===v?'active':''}" data-analytics-scope="${attr(v)}">${esc(v)}</button>`).join('')}</div>
    <section class="hero"><div class="heroGrid"><div><div class="big">${totalMarked?Math.round(totalAtt/totalMarked*100):0}<span>%</span></div><div class="heroLabel">기록된 출석 기준</div></div><div class="heroRight"><strong>${focus.length}명</strong><div class="heroLabel">최근 집중 확인</div></div></div></section>
    <div class="sectionHead"><div><div class="sectionTitle">학생별 출석 흐름</div><div class="muted">언제 왔는지와 연속 결석을 확인합니다.</div></div></div>
    <div class="list">${list.map(st=>{const a=studentAnalytics(st,dates);const detail=dates.slice(-8).map(k=>{const raw=state.sessions[k]?.attendance?.[st.id];if(!raw)return `${k.slice(5).replace('-','/')} ·`;const aa=att(st,k);return `${k.slice(5).replace('-','/')} ${aa.present?(aa.late?'△':'✓'):'—'}`}).join('  ');return `<button class="recordCard" data-detail="${st.id}"><span><strong>${esc(st.name)}</strong><small>${esc(st.grade||'')} · ${a.attended}/${a.checked||0}회</small></span><span class="recordRate">${a.checked?Math.round(a.attended/a.checked*100):0}%</span><span class="recordDates">${detail||'기록 없음'}</span>${a.currentAbs>=2?`<span class="warning">최근 ${a.currentAbs}회 연속 결석</span>`:''}</button>`}).join('')||'<div class="empty">표시할 학생이 없습니다.</div>'}</div>
    <div class="card"><div class="sectionTitle">날짜별 출석 기록</div>${sessionDates.slice(0,30).map(k=>{const ss=ui.analyticsScope==='전체'?active():ui.analyticsScope==='내 담당'?scopedStudents('내 담당'):active().filter(s=>s.grade===ui.analyticsScope);const c=attendanceCounts(ss,k);return `<div class="history historyManage"><span><strong>${esc(displayDate(k))}</strong><small>${c.present}/${ss.length} 출석</small></span><button class="recordDelete" data-delete-session="${k}">기록 삭제</button></div>`}).join('')||'<div class="muted">출석 기록이 없습니다.</div>'}</div>`;
}

function studentsView(){
  let list=scopeStudents(ui.studentGrade);
  list=sortStudents(list,state.settings.studentSort||'name');
  return `<div class="card"><div class="row"><div><div class="label">학생 명부</div><div class="muted">이름을 누르면 연락처·주소·출석·달란트 이력을 봅니다.</div></div><div class="headActions"><button class="secondary nowrap" data-act="manageStudentList">명단 정리</button><button class="primary nowrap" data-act="addStudent">학생 추가</button></div></div></div>
    ${scopeChoiceHtml('students',ui.studentGrade,true)}
    <div class="sortBar"><span>정렬</span>${[['name','가나다'],['grade','학년'],['custom','사용자']].map(([v,l])=>`<button class="sortBtn ${state.settings.studentSort===v?'active':''}" data-stu-sort="${v}">${l}</button>`).join('')}</div>
    <div class="list">${list.map(st=>`<button class="studentRow ${st.photo?'hasPhoto':'noPhoto'}" data-detail="${st.id}">${avatarCell(st)}<span><span class="studentName">${esc(st.name)}</span><span class="studentMeta">${esc(st.grade||'학년 미지정')}${st.gender?' · '+esc(st.gender):''}${(st.teams||[]).length?' · '+esc(st.teams.join(', ')):''}</span></span><span class="amount">${fmt(totalAmt(st.id))}<small>누적</small></span></button>`).join('')||'<div class="empty">학생이 없습니다.</div>'}</div>
    <div class="divider"></div>
    <div class="card birthdayAccess"><div class="row"><div><div class="label">월별 생일자</div><div class="muted">학생 생일 정보에서 자동으로 월별 명단을 만듭니다.</div></div><button class="secondary nowrap" data-act="birthdayList">생일자 보기</button></div></div>
    <div class="card teacherAccess"><div class="row"><div><div class="label">교사 명부</div><div class="muted">학생과 별도 관리 · 연락처, 출석, 사유 기록</div></div><button class="secondary nowrap" data-act="manageTeachers">교사 보기</button></div></div>`;
}
function teamManagerCard(){
  return `<div class="card"><div class="row"><div><div class="label">행사·게임 팀</div><div class="muted">평소 소속과 별개입니다. 필요할 때만 만들어 사용합니다.</div></div><button class="secondary nowrap" data-act="newTeam">+ 팀</button></div>${allTeams().map((t,i)=>`<div class="teamRow"><button class="teamMain" data-edit-team="${attr(t)}"><strong>${esc(t)}</strong><small>${active().filter(s=>(s.teams||[]).includes(t)).length}명 · 팀원 편집</small></button><button class="smallIcon" data-team-up="${attr(t)}" ${i===0?'disabled':''}>↑</button><button class="smallIcon" data-team-down="${attr(t)}" ${i===allTeams().length-1?'disabled':''}>↓</button><button class="smallIcon dangerIcon" data-team-delete="${attr(t)}">⌫</button></div>`).join('')||'<div class="muted">아직 팀이 없습니다.</div>'}</div>`;
}
function gradeManagerCard(){
  const gs=grades();
  return `<div class="card"><div class="row"><div><div class="label">학년 관리</div><div class="muted">겹친 학년 이름을 병합하거나 이름을 바꾸고 정리합니다.</div></div><button class="secondary nowrap" data-act="manageGrades">관리</button></div>${gs.length?`<div class="gradeSummary">${gs.map(g=>`<span class="pill">${esc(g)} · ${active().filter(s=>s.grade===g).length}명</span>`).join('')}</div>`:''}</div>`;
}
function settingsView(){
  const admin=!!state.settings.adminMode;
  const scopeOptions=admin?['전체','내 담당',...grades()]:['내 담당',...(state.settings.managedGrades||[])];
  return `<div class="card"><div class="label">기본 설정</div><div class="form" style="margin-top:10px"><label class="fieldLabel">부서 이름<input id="department" class="input" value="${attr(state.settings.department||'')}"></label><div class="fieldLabel">사용 모드<div class="modeChoice"><label class="modeCard"><input type="radio" name="adminMode" value="teacher" ${!admin?'checked':''}><span>담당 선생님</span><small>내 담당 학년·팀만 기본 표시</small></label><label class="modeCard"><input type="radio" name="adminMode" value="admin" ${admin?'checked':''}><span>전체 관리자</span><small>전체 학년 보기 · 받은 데이터 병합</small></label></div><div class="modeHint">한 가지만 선택됩니다 · 아래 ‘변경사항 저장’을 누르면 적용됩니다.</div></div><div class="fieldLabel">내 담당 학년 <div class="managedGradeGrid">${grades().map(g=>`<label><input type="checkbox" data-managed-grade="${attr(g)}" ${(state.settings.managedGrades||[]).includes(g)?'checked':''}> ${esc(g)}</label>`).join('')||'<span class="muted">학생 학년을 먼저 등록해 주세요.</span>'}</div></div><div class="fieldLabel">내 담당 팀 · 선택 <div class="managedGradeGrid">${allTeams().map(t=>`<label><input type="checkbox" data-managed-team="${attr(t)}" ${(state.settings.managedTeams||[]).includes(t)?'checked':''}> ${esc(t)}</label>`).join('')||'<span class="muted">팀이 있으면 여기에서 지정할 수 있습니다.</span>'}</div></div><label class="fieldLabel">기본 관리 범위<select id="managementScope" class="input">${scopeOptions.map(v=>`<option ${state.settings.managementScope===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label class="fieldLabel">달란트 버튼<input id="amounts" class="input" value="${attr((state.settings.amounts||[]).join(', '))}" placeholder="10, 20, 50, 100"></label><button class="primary fullBtn" data-act="saveSettings">변경사항 저장</button></div></div>
    ${gradeManagerCard()}
    ${teamManagerCard()}
    <div class="card"><div class="row"><div><div class="label">교사 출석 기능</div><div class="muted">필요한 경우에만 출석 화면에 교사 탭을 표시합니다.</div></div><button class="toggle ${state.settings.teacherAttendanceEnabled?'on':''}" data-act="toggleTeacherAttendance"><span></span></button></div><div class="divider"></div><div class="row"><button class="secondary nowrap" data-act="manageTeachers">교사 명부</button><button class="secondary nowrap" data-act="teacherExcelImport">교사 가져오기</button><button class="secondary nowrap" data-act="exportTeachers">교사 Excel</button></div></div>
    <div class="card"><div class="label">학생 목록 · 출석 편의</div><div class="form" style="margin-top:10px"><label class="fieldLabel">장기 미출석 기준<select id="longAbsenceDays" class="input">${[[30,'1개월'],[60,'2개월 · 기본'],[90,'3개월'],[180,'6개월']].map(([v,l])=>`<option value="${v}" ${Number(state.settings.longAbsenceDays||60)===v?'selected':''}>${l}</option>`).join('')}</select></label><button class="secondary fullBtn" data-act="manageOrder">사용자 순서 정하기</button></div></div>
    <div class="card"><div class="label">부서 기본 데이터</div><div class="muted" style="margin-top:4px">학생·보호자·교사 기본정보를 다른 선생님에게 그대로 전달합니다. 출석·달란트 과거기록은 포함하지 않습니다.</div><div class="grid2" style="margin-top:10px"><button class="secondary nowrap" data-act="exportBaseData">기본 데이터 내보내기</button><button class="secondary nowrap" data-act="importBaseData">기본 데이터 가져오기</button></div></div>
    <div class="card"><div class="label">데이터</div><div class="muted" style="margin-top:4px">Excel은 먼저 분석한 뒤 업데이트·새 학생 추가·명단 교체 중에서 선택합니다.</div><div class="grid2" style="margin-top:10px"><button class="secondary nowrap" data-act="excelImport">학생/통합 Excel</button><button class="secondary nowrap" data-act="teacherExcelImport">교사 Excel 가져오기</button><button class="secondary nowrap" data-act="mergeImport">받은 기록 업데이트</button><button class="secondary nowrap" data-act="backup">전체 백업</button><button class="secondary nowrap" data-act="backupImport">백업 복원</button><button class="secondary nowrap" data-act="exportStudents">학생 Excel</button><button class="secondary nowrap" data-act="exportAttendance">출석 Excel</button><button class="secondary nowrap" data-act="exportTalent">달란트 Excel</button></div></div>
    <div class="card"><div class="row"><div><div class="label">데이터 관리</div><div class="muted">잘못 가져온 명단을 한 번에 정리하거나 이전 상태로 돌아갑니다.</div></div><button class="secondary nowrap" data-act="dataManager">관리</button></div></div>
    <div class="card"><div class="row"><div><div class="label">앱 버전</div><div class="muted">GitHub에는 앱만, 개인정보는 이 기기에 저장</div></div><span class="pill">v${APP_VERSION}</span></div></div>`;
}

function nav(){
  const items=[['talent','◉','달란트'],['attendance','✓','출석'],['records','▤','기록'],['students','♙','학생'],['settings','⚙','설정']];
  return `<nav class="nav">${items.map(([k,i,l])=>`<button class="navBtn ${ui.tab===k?'active':''}" data-tab="${k}"><span class="ico">${i}</span>${l}</button>`).join('')}</nav>`;
}
function mainView(){ return ui.tab==='talent'?talentView():ui.tab==='attendance'?attendanceView():ui.tab==='records'?recordsView():ui.tab==='students'?studentsView():settingsView(); }
function render(){
  document.getElementById('app').innerHTML=`<div class="shell">${topbar()}${mainView()}</div>${nav()}${modalHtml()}<div id="toast" class="toast"></div>`;
  bind();
}

function modalHtml(){
  if(!ui.modal)return '';
  const close=`<button class="icon" data-act="closeModal">×</button>`;
  if(ui.modal.type==='studentForm'){
    const st=ui.modal.id?studentById(ui.modal.id):{name:'',grade:'',gender:'',birthday:'',phone:'',parentName:'',parentRelation:'',parentPhone:'',parent2Name:'',parent2Relation:'',parent2Phone:'',school:'',siblings:'',address:'',memo:'',teams:[],active:true};
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${ui.modal.id?'학생 수정':'학생 추가'}</div><div class="muted">학생과 보호자 연락처를 구분해서 저장합니다.</div></div>${close}</div><div class="form"><input id="fName" class="input" placeholder="학생 이름" value="${attr(st.name||'')}"><div class="formGrid"><input id="fGrade" class="input" placeholder="학년 (예: 4학년)" value="${attr(normalizeGrade(st.grade)||'')}"><select id="fGender" class="input"><option value="">성별 선택</option><option ${st.gender==='남'?'selected':''}>남</option><option ${st.gender==='여'?'selected':''}>여</option></select></div><input id="fBirthday" class="input" type="date" value="${attr(st.birthday||'')}"><input id="fPhone" class="input" placeholder="학생 전화번호" value="${attr(st.phone||'')}"><div class="subLabel">보호자 1</div><div class="formGrid"><input id="fParentName" class="input" placeholder="이름" value="${attr(st.parentName||'')}"><input id="fParentRelation" class="input" placeholder="관계 (부/모 등)" value="${attr(st.parentRelation||'')}"></div><input id="fParentPhone" class="input" placeholder="보호자 1 연락처" value="${attr(st.parentPhone||'')}"><div class="subLabel">보호자 2 · 선택</div><div class="formGrid"><input id="fParent2Name" class="input" placeholder="이름" value="${attr(st.parent2Name||'')}"><input id="fParent2Relation" class="input" placeholder="관계" value="${attr(st.parent2Relation||'')}"></div><input id="fParent2Phone" class="input" placeholder="보호자 2 연락처" value="${attr(st.parent2Phone||'')}"><input id="fSchool" class="input" placeholder="학교" value="${attr(st.school||'')}"><input id="fSiblings" class="input" placeholder="형제관계" value="${attr(st.siblings||'')}"><textarea id="fAddress" class="input textarea" placeholder="주소">${esc(st.address||'')}</textarea><textarea id="fMemo" class="input textarea" placeholder="기타 메모">${esc(st.memo||'')}</textarea><button class="primary fullBtn" data-act="saveStudent" data-id="${st.id||''}">${ui.modal.id?'학생 정보 저장':'학생 추가'}</button>${ui.modal.id?`<button class="danger fullBtn" data-act="deactivateStudent" data-id="${st.id}">명단에서 비활성화</button>`:''}</div>`);
  }
  if(ui.modal.type==='detail'){
    const st=studentById(ui.modal.id); if(!st)return '';
    const phoneBtns=contactButtons(st.phone); const parentBtns=contactButtons(st.parentPhone); const parent2Btns=contactButtons(st.parent2Phone);
    const attendanceHistory=Object.keys(state.sessions).sort().reverse().filter(k=>(typeof attendanceSessionRecorded!=='function'||attendanceSessionRecorded(k))&&state.sessions[k]?.attendance?.[st.id]).slice(0,20);
    const txHistory=[]; Object.keys(state.sessions).sort().reverse().forEach(k=>(state.sessions[k].transactions||[]).filter(t=>(t.studentIds||[]).includes(st.id)).forEach(t=>txHistory.push({k,t})));
    return modal(`<div class="modalTitleRow"><div class="detailHead">${st.photo?avatar(st,'detailPhoto'):''}<div><div class="titleSmall">${esc(st.name)}</div><div class="muted">${esc(st.grade||'학년 미지정')} · 누적 ${fmt(totalAmt(st.id))} 달란트</div></div></div>${close}</div><div class="detailActions"><button class="secondary nowrap" data-act="editStudent" data-id="${st.id}">수정</button><button class="secondary nowrap" data-act="photo" data-id="${st.id}">${st.photo?'사진 변경':'사진 추가'}</button><button class="secondary nowrap ${st.longTermManual?'manualOn':''}" data-act="toggleLongTerm" data-id="${st.id}">${st.longTermManual?'장기 지정 해제':'장기 미출석 지정'}</button></div><div class="card kvCard">${kv('생일',st.birthday)}${kv('성별',st.gender)}${kv('학생 전화',st.phone,phoneBtns)}${kv('보호자 1',`${st.parentName||''}${st.parentRelation?` (${st.parentRelation})`:''}`)}${kv('보호자 1 연락',st.parentPhone,parentBtns)}${kv('보호자 2',`${st.parent2Name||''}${st.parent2Relation?` (${st.parent2Relation})`:''}`)}${kv('보호자 2 연락',st.parent2Phone,parent2Btns)}${kv('학교',st.school)}${kv('형제관계',st.siblings)}${kv('주소',st.address)}${kv('메모',st.memo)}</div><div class="card"><div class="sectionTitle">최근 출석</div>${attendanceHistory.map(k=>`<div class="history"><span><strong>${displayDate(k)}</strong><small>${esc(att(st,k).memo||'')}</small></span><strong>${statusLabel(att(st,k).status)}</strong></div>`).join('')||'<div class="muted">출석 기록 없음</div>'}</div><div class="card"><div class="sectionTitle">최근 달란트</div>${txHistory.slice(0,20).map(({k,t})=>`<div class="history"><span><strong>${displayDate(k)}</strong><small>${t.kind==='reset'?'잔액 리셋 · ':t.multiplier===2?'×2 · ':''}${esc(t.reason||'')}</small></span><strong class="${t.kind==='reset'?'resetText':t.amount<0?'negative':'positive'}">${t.kind==='reset'?'0으로':`${t.amount>0?'+':''}${fmt(t.amount)}`}</strong></div>`).join('')||'<div class="muted">달란트 기록 없음</div>'}</div>`);
  }
  if(ui.modal.type==='teamEdit'){
    const team=ui.modal.team; const list=active().filter(s=>ui.teamGrade==='전체'||s.grade===ui.teamGrade);
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${esc(team)} 팀원</div><div class="muted">이름을 누르면 즉시 팀에 들어가거나 빠집니다.</div></div>${close}</div><div class="formGrid"><input id="teamRename" class="input" value="${attr(team)}"><button class="primary nowrap" data-act="renameTeam" data-team="${attr(team)}">이름 저장</button></div><div class="chips" style="margin-top:10px">${['전체',...grades()].map(v=>`<button class="chip ${ui.teamGrade===v?'active':''}" data-team-grade="${attr(v)}">${esc(v)}</button>`).join('')}</div><div class="checkList">${list.map(st=>`<button class="checkPerson ${(st.teams||[]).includes(team)?'active':''}" data-team-member="${st.id}" data-team="${attr(team)}"><span>${esc(st.name)}</span><small>${esc(st.grade||'')}</small><b>${(st.teams||[]).includes(team)?'✓':'+'}</b></button>`).join('')}</div><div class="detailActions"><button class="secondary fullBtn" data-act="clearTeam" data-team="${attr(team)}">팀원 모두 빼기</button></div>`);
  }
  if(ui.modal.type==='teachers'){
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">교사 명부</div><div class="muted">학생과 별도 관리 · 전화/문자와 출석 기록</div></div>${close}</div><div class="grid2"><button class="primary nowrap" data-act="addTeacher">+ 교사 추가</button><button class="secondary nowrap" data-act="shareTeacherList">리스트 공유</button></div><div class="list" style="margin-top:10px">${activeTeachers().map(t=>`<div class="contactRow"><button class="contactMain" data-teacher-detail="${t.id}"><strong>${esc(t.name)}</strong><small>${esc(t.role||'담당 미지정')}${t.birthday?' · '+esc(t.birthday):''} · ${esc(t.phone||'연락처 없음')}${t.memo?' · 비고 있음':''}</small></button>${t.phone?`<a class="contactIcon" href="tel:${phoneUri(t.phone)}">☎</a><a class="contactIcon" href="sms:${phoneUri(t.phone)}">✉</a>`:''}<button class="contactIcon" data-edit-teacher="${t.id}" aria-label="교사 수정">✎</button><button class="contactIcon teacherDeleteIcon" data-act="deleteTeacher" data-id="${t.id}" aria-label="교사 완전 삭제">×</button></div>`).join('')||'<div class="empty">교사가 없습니다.</div>'}</div>`);
  }
  if(ui.modal.type==='teacherForm'){
    const t=ui.modal.id?teacherById(ui.modal.id):{name:'',role:'',birthday:'',phone:'',emergencyPhone:'',memo:''};
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${ui.modal.id?'교사 수정':'교사 추가'}</div></div>${close}</div><div class="form"><input id="tName" class="input" placeholder="이름" value="${attr(t.name)}"><input id="tRole" class="input" placeholder="담당/역할 (예: 5학년)" value="${attr(t.role)}"><label class="fieldLabel">생일<input id="tBirthday" class="input" type="date" value="${attr(t.birthday||'')}"></label><input id="tPhone" class="input" placeholder="전화번호" value="${attr(t.phone)}"><input id="tEmergencyPhone" class="input" placeholder="비상 연락처 · 선택" value="${attr(t.emergencyPhone||'')}"><label class="fieldLabel">비고<textarea id="tMemo" class="input textarea" placeholder="자유롭게 메모하세요">${esc(t.memo)}</textarea></label><button class="primary fullBtn" data-act="saveTeacher" data-id="${t.id||''}">저장</button>${ui.modal.id?`<button class="danger fullBtn" data-act="deactivateTeacher" data-id="${t.id}">명단에서 비활성화</button>`:''}</div>`);
  }
  if(ui.modal.type==='teacherDetail'){
    const t=teacherById(ui.modal.id); if(!t)return '';
    const history=Object.keys(state.teacherSessions).sort().reverse().filter(k=>(typeof teacherAttendanceSessionRecorded!=='function'||teacherAttendanceSessionRecorded(k))&&state.teacherSessions[k]?.attendance?.[t.id]).slice(0,20);
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${esc(t.name)}</div><div class="muted">${esc(t.role||'담당 미지정')}</div></div>${close}</div>${t.phone?`<div class="contactBar"><a class="primary linkBtn" href="tel:${phoneUri(t.phone)}">☎ 전화</a><a class="secondary linkBtn" href="sms:${phoneUri(t.phone)}">✉ 문자</a></div>`:''}<div class="card">${kv('생일',t.birthday)}${kv('전화번호',t.phone,contactButtons(t.phone))}${kv('비상 연락처',t.emergencyPhone,contactButtons(t.emergencyPhone))}${kv('비고',t.memo)}</div><div class="card"><div class="sectionTitle">출석 이력</div>${history.map(k=>`<div class="history"><span><strong>${displayDate(k)}</strong><small>${esc(teacherAtt(t,k).reason||'')}</small></span><strong>${teacherStatusLabel(teacherAtt(t,k).status)}</strong></div>`).join('')||'<div class="muted">기록 없음</div>'}</div>`);
  }
  if(ui.modal.type==='studentOrder'){
    const list=sortStudents(active().filter(s=>ui.orderGrade==='전체'||s.grade===ui.orderGrade),'custom');
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">학생 사용자 순서</div><div class="muted">자주 체크하는 학생은 위로, 장기 관리 학생은 아래로 직접 배치할 수 있습니다.</div></div>${close}</div><div class="chips">${scopeOptionsWithManaged().map(v=>`<button class="chip ${ui.orderGrade===v?'active':''}" data-order-grade="${attr(v)}">${esc(v)}</button>`).join('')}</div><div class="orderList">${list.map((st,i)=>`<div class="orderRow"><span>${st.photo?avatar(st):''}<b>${esc(st.name)}</b><small>${esc(st.grade||'')}</small></span><button class="smallIcon" data-order-up="${st.id}" ${i===0?'disabled':''}>↑</button><button class="smallIcon" data-order-down="${st.id}" ${i===list.length-1?'disabled':''}>↓</button></div>`).join('')}</div><div class="notice">이 순서는 출석부와 학생 명부에서 ‘사용자’ 정렬을 선택했을 때 적용됩니다.</div>`);
  }
  if(ui.modal.type==='talentReset'){
    const selected=[...ui.selected].filter(id=>studentById(id)?.active!==false); const visible=visibleIds(); const all=active().map(s=>s.id);
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">달란트 리셋</div><div class="muted">선택한 학생의 이전 달란트 지급·차감 내역을 비우고 0부터 새 회차를 시작합니다. 실수하면 바로 되돌릴 수 있습니다.</div></div>${close}</div><div class="menuList">${selected.length?`<button class="menuBtn" data-act="resetTalentSelected"><strong>선택 학생 ${selected.length}명 리셋</strong><small>지금 체크한 학생의 기록을 비우고 0부터</small></button>`:''}<button class="menuBtn" data-act="resetTalentVisible"><strong>현재 목록 ${visible.length}명 리셋</strong><small>${esc(ui.filterValue==='전체'?ui.filterType+' 현재 목록':ui.filterValue)} 기준 · 이전 기록 비우기</small></button><button class="menuBtn dangerMenu" data-act="resetTalentAll"><strong>전체 학생 ${all.length}명 리셋</strong><small>모든 활성 학생의 달란트 기록을 비우고 0부터</small></button></div><div class="undoInline"><button class="roundHistory" data-act="undo" ${ui.undo.length?'':'disabled'} aria-label="되돌리기">${historyArrow('left')}</button><button class="roundHistory" data-act="redo" ${ui.redo.length?'':'disabled'} aria-label="다시 실행">${historyArrow('right')}</button></div>`);
  }
  if(ui.modal.type==='birthdays'){
    const list=birthdayStudents(ui.birthdayMonth);
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">월별 생일자</div><div class="muted">학생 상세의 생일을 기준으로 자동 표시합니다.</div></div>${close}</div><div class="chips birthdayMonths">${Array.from({length:12},(_,i)=>i+1).map(m=>`<button class="chip ${ui.birthdayMonth===m?'active':''}" data-birthday-month="${m}">${m}월</button>`).join('')}</div><div class="birthdayList">${list.map(st=>`<button class="birthdayRow ${st.photo?'hasPhoto':'noPhoto'}" data-detail="${st.id}">${st.photo?avatar(st):''}<span><strong>${esc(st.name)}</strong><small>${Number(String(st.birthday).slice(8,10))}일 · ${esc(st.grade||'학년 미지정')}</small></span></button>`).join('')||'<div class="empty">이 달에 등록된 생일자가 없습니다.</div>'}</div>`);
  }
  if(ui.modal.type==='share'){
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">공유</div><div class="muted">현재 기록을 사람에게 알리거나 총괄자에게 데이터로 보낼 수 있습니다.</div></div>${close}</div><div class="menuList"><button class="menuBtn" data-act="shareSummary"><strong>오늘 요약 공유</strong><small>출석 + 달란트 총액을 휴대폰 공유로</small></button><button class="menuBtn" data-act="shareAttendance"><strong>학생 출석 보내기</strong><small>현재 학년/전체 출석 데이터 파일</small></button><button class="menuBtn" data-act="shareTalent"><strong>달란트 보내기</strong><small>이날 지급 기록 데이터 파일</small></button>${state.settings.teacherAttendanceEnabled?`<button class="menuBtn" data-act="shareTeacherAttendance"><strong>교사 출석 공유</strong><small>출석/결석/지각 + 사유</small></button>`:''}</div>`);
  }
  if(ui.modal.type==='import'){
    const p=ui.importPreview; const byGrade={}; (p?.students||[]).forEach(s=>byGrade[s.grade||'학년 미지정']=(byGrade[s.grade||'학년 미지정']||0)+1);
    const st=p?.stats||{newCount:0,updateCount:0,unchangedCount:0,missingCount:0};
    if(p?.teacherOnly){
      return modal(`<div class="modalTitleRow"><div><div class="titleSmall">교사 Excel 분석</div><div class="muted">이름 · 전화번호 · 생일 · 담당 · 비고를 교사 명부로 가져옵니다.</div></div>${close}</div><div class="card"><div class="history"><strong>교사 발견</strong><strong>${(p.teachers||[]).length}명</strong></div>${(p.teachers||[]).slice(0,8).map(t=>`<div class="history"><span><strong>${esc(t.name)}</strong><small>${esc(t.phone||'전화 없음')}${t.birthday?` · ${esc(t.birthday)}`:''}${t.memo?' · 비고 있음':''}</small></span><strong>${t.phone?'전화 ✓':''}</strong></div>`).join('')}</div><div class="notice">동일한 이름의 교사가 있으면 전화·생일·비고 등 기본정보를 업데이트하고, 없는 교사는 새로 추가합니다. 학생 명단은 건드리지 않습니다.</div><button class="primary fullBtn" data-act="confirmImport">교사 명부에 적용</button>`);
    }
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">Excel 가져오기</div><div class="muted">먼저 분석했습니다. 적용 방법을 선택해 주세요.</div></div>${close}</div>
      <div class="card">${Object.entries(byGrade).map(([g,n])=>`<div class="history"><strong>${esc(g)}</strong><strong>${n}명</strong></div>`).join('')}<div class="history"><strong>총 발견</strong><strong>${p?.students?.length||0}명</strong></div></div>
      <div class="card"><div class="sectionTitle">현재 명단과 비교</div>${kv('새 학생',`${st.newCount}명`)}${kv('정보 업데이트',`${st.updateCount}명`)}${kv('변경 없음',`${st.unchangedCount}명`)}${kv('Excel에 없는 기존 학생',`${st.missingCount}명`)}${kv('교사 발견',`${(p.teachers||[]).length}명`)}</div>
      <div class="sectionTitle" style="margin:4px 2px 7px">가져오기 방법</div>
      <div class="importModes">
        <button class="importMode ${ui.importMode==='update'?'active':''}" data-import-mode="update"><strong>기존 명단 업데이트</strong><small>기존 정보 갱신 + 새 학생 추가 · 출석/달란트 유지</small></button>
        <button class="importMode ${ui.importMode==='newonly'?'active':''}" data-import-mode="newonly"><strong>새 학생만 추가</strong><small>기존 학생 정보는 건드리지 않음</small></button>
        <button class="importMode ${ui.importMode==='replace'?'active':''}" data-import-mode="replace"><strong>현재 명단 교체</strong><small>Excel에 없는 학생은 비활성 · 과거 기록은 유지</small></button>
      </div>
      <div class="notice">적용 직전에 현재 상태를 자동 백업합니다. 팀은 Excel 때문에 새로 생성되지 않습니다.</div>
      <button class="primary fullBtn" data-act="confirmImport">선택한 방식으로 적용</button>`);
  }
  if(ui.modal.type==='studentBulk'){
    const list=sortStudents(cleanupStudents().filter(s=>ui.bulkGrade==='전체'||s.grade===ui.bulkGrade),'name');
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">학생 명단 정리</div><div class="muted">여러 명을 계속 선택해도 현재 스크롤 위치와 목록 순서를 유지합니다.</div></div>${close}</div><div class="chips">${scopeOptionsWithManaged().map(v=>`<button class="chip ${ui.bulkGrade===v?'active':''}" data-bulk-grade="${attr(v)}">${esc(v)}</button>`).join('')}</div><div class="row compactBar"><span class="badge">선택 ${ui.bulkSelected.size}명</span><div class="headActions"><button class="secondary nowrap" data-act="bulkSelectAll">현재 목록 전체</button><button class="secondary nowrap" data-act="bulkClear">해제</button></div></div><div class="checkList bulkCheckList">${list.map(st=>`<button class="checkPerson ${ui.bulkSelected.has(st.id)?'active':''}" data-bulk-student="${st.id}"><span>${esc(st.name)}</span><small>${esc(st.grade||'학년 미지정')} · ${esc(st.birthday||'')}</small><b>${ui.bulkSelected.has(st.id)?'✓':'+'}</b></button>`).join('')||'<div class="empty">학생이 없습니다.</div>'}</div><div class="notice">명단 제외는 과거 기록을 보존합니다. 완전 삭제는 잘못 가져온 가짜/중복 학생 정리용입니다.</div><div class="bulkActionBar"><div class="undoInline"><button class="roundHistory" data-act="undo" ${ui.undo.length?'':'disabled'} aria-label="되돌리기">${historyArrow('left')}</button><button class="roundHistory" data-act="redo" ${ui.redo.length?'':'disabled'} aria-label="다시 실행">${historyArrow('right')}</button></div><div class="grid3"><button class="secondary nowrap" data-act="bulkMoveGrade">학년 이동</button><button class="secondary nowrap" data-act="bulkDeactivate">명단 제외</button><button class="danger nowrap" data-act="bulkDelete">완전 삭제</button></div></div>`);
  }
  if(ui.modal.type==='gradeManager'){
    const gs=grades();
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">학년 관리</div><div class="muted">겹친 분류는 병합하고 필요 없는 분류는 정리합니다.</div></div>${close}</div><div class="list">${gs.map(g=>`<div class="gradeRow"><div><strong>${esc(g)}</strong><small>${active().filter(s=>s.grade===g).length}명</small></div><button class="smallText" data-grade-rename="${attr(g)}">이름변경</button><button class="smallText" data-grade-merge="${attr(g)}">병합</button><button class="smallText dangerText" data-grade-delete="${attr(g)}">삭제</button></div>`).join('')||'<div class="empty">학년 분류가 없습니다.</div>'}</div><div class="notice">삭제할 때 학생은 학년 미지정으로 남습니다. 학생 자체와 과거 출석·달란트 기록은 삭제되지 않습니다.</div>`);
  }
  if(ui.modal.type==='dataManager'){
    const snaps=state.snapshots||[];
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">데이터 관리</div><div class="muted">대량 작업은 실행 전에 자동 백업합니다.</div></div>${close}</div>
      <div class="card"><div class="sectionTitle">초기화</div><div class="grid2" style="margin-top:10px"><button class="danger nowrap" data-act="resetStudents">현재 학생 명단 비우기</button><button class="danger nowrap" data-act="resetTeams">팀만 초기화</button><button class="danger nowrap" data-act="resetAttendance">출석 기록 초기화</button><button class="danger nowrap" data-act="resetTalent">달란트 기록 초기화</button><button class="danger nowrap" data-act="resetTeachers">교사 데이터 초기화</button><button class="danger nowrap" data-act="resetAll">전체 데이터 초기화</button></div></div>
      <div class="card"><div class="sectionTitle">이전 상태 복원</div>${snaps.length?snaps.map(x=>`<button class="snapshotRow" data-snapshot="${x.id}"><span><strong>${esc(x.label)}</strong><small>${new Date(x.createdAt).toLocaleString('ko-KR')}</small></span><b>복원</b></button>`).join(''):'<div class="muted" style="margin-top:10px">아직 자동 백업이 없습니다.</div>'}</div>`);
  }
  if(ui.modal.type==='merge'){
    const p=ui.modal.preview;
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">받은 기록 업데이트</div><div class="muted">전체 데이터를 덮지 않고 새 기록만 병합합니다.</div></div>${close}</div><div class="card">${kv('파일',`${p.files}개`)}${kv('학생 출석',`${p.attendanceRecords}건`)}${kv('달란트',`${p.talentRecords}건`)}${kv('교사 출석',`${p.teacherRecords||0}건`)}${kv('이미 반영된 파일',`${p.duplicates}개`)}${kv('새 학생 후보',`${p.unknown.length}명`)}</div><button class="primary fullBtn" data-act="confirmMerge">업데이트</button>`);
  }
  return '';
}
function modal(inner){ return `<div class="modalBack"><div class="modal"><div class="handle"></div>${inner}</div></div>`; }
function kv(k,v,extra=''){ if(!v && !extra)return ''; return `<div class="kv"><span>${esc(k)}</span><span>${esc(v||'')}${extra?`<span class="inlineExtras">${extra}</span>`:''}</span></div>`; }
function contactButtons(phone){ if(!phone)return ''; const p=phoneUri(phone); return `<a class="tinyLink" href="tel:${p}">전화</a><a class="tinyLink" href="sms:${p}">문자</a>`; }

function bind(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
    ui.tab=b.dataset.tab;
    if(!state.settings.adminMode){
      const preferred=state.settings.managementScope||((state.settings.managedGrades||[])[0])||'전체';
      if(ui.tab==='attendance')ui.attendanceGrade=preferred;
      if(ui.tab==='talent'){ui.filterType='학년';ui.filterValue=preferred;}
      if(ui.tab==='records')ui.analyticsScope=preferred;
      if(ui.tab==='students')ui.studentGrade=preferred;
    }
    ui.scopeMenu=null;
    ui.modal=null;render();
  });
  const date=document.getElementById('mainDate'); if(date) date.onchange=e=>{ui.date=e.target.value;ui.lastTxId=null;ui.attendanceDraft=null;ui.attendanceDraftKey='';ui.teacherAttendanceDraft=null;ui.teacherAttendanceDraftKey='';render();};
  document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>handleAct(b.dataset.act,b));
  document.querySelectorAll('[data-scope-toggle]').forEach(b=>b.onclick=()=>{const v=b.dataset.scopeToggle;ui.scopeMenu=ui.scopeMenu===v?null:v;render();});
  document.querySelectorAll('[data-scope-pick]').forEach(b=>b.onclick=()=>{const v=b.dataset.scopePick,view=b.dataset.scopeView;ui.scopeMenu=null;if(view==='talent'){if(v.startsWith('팀:')){ui.filterType='팀';ui.filterValue=v.slice(2);}else{ui.filterType='학년';ui.filterValue=v;}ui.selected.clear();}else if(view==='attendance'){ui.attendanceGrade=v;}else if(view==='records'){ui.analyticsScope=v;}else if(view==='students'){ui.studentGrade=v;}render();});
  document.querySelectorAll('[data-filtertype]').forEach(b=>b.onclick=()=>{ui.filterType=b.dataset.filtertype;ui.filterValue='전체';ui.selected.clear();render();});
  document.querySelectorAll('[data-filtervalue]').forEach(b=>b.onclick=()=>{ui.filterValue=b.dataset.filtervalue;ui.selected.clear();render();});
  document.querySelectorAll('[data-selectstudent]').forEach(b=>b.onclick=()=>{const id=b.dataset.selectstudent;ui.selected.has(id)?ui.selected.delete(id):ui.selected.add(id);render();});
  document.querySelectorAll('[data-money]').forEach(b=>b.onclick=()=>addTalent(Number(b.dataset.money)));
  document.querySelectorAll('[data-sign]').forEach(b=>b.onclick=()=>{ui.sign=Number(b.dataset.sign);render();});
  document.querySelectorAll('[data-att-sort]').forEach(b=>b.onclick=()=>{state.settings.attendanceSort=b.dataset.attSort;save();render();});
  document.querySelectorAll('[data-stu-sort]').forEach(b=>b.onclick=()=>{state.settings.studentSort=b.dataset.stuSort;save();render();});
  document.querySelectorAll('[data-order-grade]').forEach(b=>b.onclick=()=>{ui.orderGrade=b.dataset.orderGrade;render();});
  document.querySelectorAll('[data-order-up]').forEach(b=>b.onclick=()=>moveStudentOrder(b.dataset.orderUp,-1));
  document.querySelectorAll('[data-order-down]').forEach(b=>b.onclick=()=>moveStudentOrder(b.dataset.orderDown,1));
  document.querySelectorAll('[data-attgrade]').forEach(b=>b.onclick=()=>{ui.attendanceGrade=b.dataset.attgrade;render();});
  document.querySelectorAll('[data-stugrade]').forEach(b=>b.onclick=()=>{ui.studentGrade=b.dataset.stugrade;render();});
  document.querySelectorAll('[data-attendance-toggle]').forEach(b=>b.onclick=()=>toggleStudentAttendance(b.dataset.attendanceToggle));
  document.querySelectorAll('[data-attendance-flag]').forEach(b=>b.onclick=()=>toggleStudentAttendanceFlag(b.dataset.student,b.dataset.attendanceFlag));
  document.querySelectorAll('[data-longterm-toggle]').forEach(b=>b.onclick=()=>toggleLongTermAttendance(b.dataset.longtermToggle));
  document.querySelectorAll('[data-memo]').forEach(el=>{el.onblur=()=>saveStudentMemoAuto(el.dataset.memo,el);el.onchange=()=>saveStudentMemoAuto(el.dataset.memo,el);});
  document.querySelectorAll('[data-teacher-attendance-toggle]').forEach(b=>b.onclick=()=>toggleTeacherAttendance(b.dataset.teacherAttendanceToggle));
  document.querySelectorAll('[data-teacher-flag]').forEach(b=>b.onclick=()=>toggleTeacherAttendanceFlag(b.dataset.teacher,b.dataset.teacherFlag));
  document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>{ui.modal={type:'detail',id:b.dataset.detail};render();});
  document.querySelectorAll('[data-attmode]').forEach(b=>b.onclick=()=>{ui.attendanceMode=b.dataset.attmode;render();});
  document.querySelectorAll('[data-teacher-reason]').forEach(el=>{el.onblur=()=>saveTeacherReasonAuto(el.dataset.teacherReason,el);el.onchange=()=>saveTeacherReasonAuto(el.dataset.teacherReason,el);});
  document.querySelectorAll('[data-teacher-detail]').forEach(b=>b.onclick=()=>{ui.modal={type:'teacherDetail',id:b.dataset.teacherDetail};render();});
  document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{ui.analyticsRange=b.dataset.range;render();});
  document.querySelectorAll('[data-analytics-scope]').forEach(b=>b.onclick=()=>{ui.analyticsScope=b.dataset.analyticsScope;render();});
  document.querySelectorAll('[data-edit-team]').forEach(b=>b.onclick=()=>{ui.teamGrade='전체';ui.modal={type:'teamEdit',team:b.dataset.editTeam};render();});
  document.querySelectorAll('[data-team-grade]').forEach(b=>b.onclick=()=>{ui.teamGrade=b.dataset.teamGrade;render();});
  document.querySelectorAll('[data-team-member]').forEach(b=>b.onclick=()=>toggleTeamMember(b.dataset.teamMember,b.dataset.team));
  document.querySelectorAll('[data-team-up]').forEach(b=>b.onclick=()=>moveTeam(b.dataset.teamUp,-1));
  document.querySelectorAll('[data-team-down]').forEach(b=>b.onclick=()=>moveTeam(b.dataset.teamDown,1));
  document.querySelectorAll('[data-team-delete]').forEach(b=>b.onclick=()=>deleteTeam(b.dataset.teamDelete));
  document.querySelectorAll('[data-edit-teacher]').forEach(b=>b.onclick=()=>{ui.modal={type:'teacherForm',id:b.dataset.editTeacher};render();});
  document.querySelectorAll('[data-bulk-grade]').forEach(b=>b.onclick=()=>{ui.bulkGrade=b.dataset.bulkGrade;ui.bulkSelected.clear();renderKeepModalScroll();});
  document.querySelectorAll('[data-bulk-student]').forEach(b=>b.onclick=()=>{const id=b.dataset.bulkStudent;ui.bulkSelected.has(id)?ui.bulkSelected.delete(id):ui.bulkSelected.add(id);renderKeepModalScroll();});
  document.querySelectorAll('[data-grade-rename]').forEach(b=>b.onclick=()=>renameGrade(b.dataset.gradeRename));
  document.querySelectorAll('[data-grade-merge]').forEach(b=>b.onclick=()=>mergeGrade(b.dataset.gradeMerge));
  document.querySelectorAll('[data-grade-delete]').forEach(b=>b.onclick=()=>deleteGrade(b.dataset.gradeDelete));
  document.querySelectorAll('[data-birthday-month]').forEach(b=>b.onclick=()=>{ui.birthdayMonth=Number(b.dataset.birthdayMonth);render();});
  document.querySelectorAll('[data-delete-session]').forEach(b=>b.onclick=()=>deleteSessionRecord(b.dataset.deleteSession));
  document.querySelectorAll('[data-import-mode]').forEach(b=>b.onclick=()=>{ui.importMode=b.dataset.importMode;render();});
  document.querySelectorAll('[data-snapshot]').forEach(b=>b.onclick=()=>restoreSnapshot(b.dataset.snapshot));
}

function handleAct(act,b){
  if(act==='undo')return undo(); if(act==='redo')return redo();
  if(act==='shareMenu'){ui.modal={type:'share'};return render();}
  if(act==='closeModal'){ui.modal=null;return render();}
  if(act==='toggleSign'||act==='toggleMinus'){ui.sign=ui.sign<0?1:-1;return render();}
  if(act==='x2')return doubleLastTalent();
  if(act==='selectAllVisible'){filterStudents().forEach(s=>ui.selected.add(s.id));return render();}
  if(act==='selectVisible'){filterStudents().filter(s=>isPresent(s)).forEach(s=>ui.selected.add(s.id));return render();}
  if(act==='clearSelect'){ui.selected.clear();return render();}
  if(act==='shareLast')return shareLast();
  if(act==='talentResetMenu'){ui.modal={type:'talentReset'};return render();}
  if(act==='resetTalentSelected')return resetTalentFor([...ui.selected],'선택 학생');
  if(act==='resetTalentVisible')return resetTalentFor(visibleIds(),'현재 목록');
  if(act==='resetTalentAll')return resetTalentFor(scopedStudents('전체').map(s=>s.id),state.settings.adminMode?'전체 학생':'내 담당 학생');
  if(act==='attendanceSelectAll')return setAllStudentAttendance(true);
  if(act==='attendanceClearAll')return setAllStudentAttendance(false);
  if(act==='teacherSelectAll')return setAllTeacherAttendance(true);
  if(act==='teacherClearAll')return setAllTeacherAttendance(false);
  if(act==='addStudent'){ui.modal={type:'studentForm'};return render();}
  if(act==='manageStudentList'){ui.bulkGrade='전체';ui.bulkSelected.clear();ui.modal={type:'studentBulk'};return render();}
  if(act==='bulkSelectAll'){cleanupStudents().filter(s=>ui.bulkGrade==='전체'||s.grade===ui.bulkGrade).forEach(s=>ui.bulkSelected.add(s.id));return renderKeepModalScroll();}
  if(act==='bulkClear'){ui.bulkSelected.clear();return renderKeepModalScroll();}
  if(act==='bulkDeactivate')return bulkDeactivate();
  if(act==='bulkDelete')return bulkDelete();
  if(act==='bulkMoveGrade')return bulkMoveGrade();
  if(act==='editStudent'){ui.modal={type:'studentForm',id:b.dataset.id};return render();}
  if(act==='saveStudent')return saveStudentForm(b.dataset.id);
  if(act==='deactivateStudent')return deactivateStudent(b.dataset.id);
  if(act==='photo'){ui.photoStudentId=b.dataset.id;document.getElementById('photoImport').click();return;}
  if(act==='toggleLongTerm')return toggleLongTerm(b.dataset.id);
  if(act==='birthdayList'){ui.birthdayMonth=new Date().getMonth()+1;ui.modal={type:'birthdays'};return render();}
  if(act==='newTeam')return newTeam();
  if(act==='renameTeam')return renameTeam(b.dataset.team);
  if(act==='clearTeam')return clearTeam(b.dataset.team);
  if(act==='saveSettings')return saveSettings();
  if(act==='manageOrder'){ui.orderGrade='전체';ui.modal={type:'studentOrder'};return render();}
  if(act==='exportBaseData')return exportBaseData();
  if(act==='importBaseData'){document.getElementById('baseDataImport').click();return;}
  if(act==='toggleTeacherAttendance'){state.settings.teacherAttendanceEnabled=!state.settings.teacherAttendanceEnabled;save();return render();}
  if(act==='manageTeachers'){ui.modal={type:'teachers'};return render();}
  if(act==='manageGrades'){ui.modal={type:'gradeManager'};return render();}
  if(act==='addTeacher'){ui.modal={type:'teacherForm'};return render();}
  if(act==='saveTeacher')return saveTeacherForm(b.dataset.id);
  if(act==='deactivateTeacher')return deactivateTeacher(b.dataset.id);
  if(act==='excelImport'){document.getElementById('excelImport').click();return;}
  if(act==='teacherExcelImport'){document.getElementById('teacherExcelImport').click();return;}
  if(act==='mergeImport'){document.getElementById('shareImport').click();return;}
  if(act==='dataManager'){ui.modal={type:'dataManager'};return render();}
  if(act==='resetStudents')return resetData('students');
  if(act==='resetTeams')return resetData('teams');
  if(act==='resetAttendance')return resetData('attendance');
  if(act==='resetTalent')return resetData('talent');
  if(act==='resetTeachers')return resetData('teachers');
  if(act==='resetAll')return resetData('all');
  if(act==='backup')return backup();
  if(act==='backupImport'){document.getElementById('backupImport').click();return;}
  if(act==='exportStudents')return exportWorkbook('students');
  if(act==='exportAttendance')return exportWorkbook('attendance');
  if(act==='exportTalent')return exportWorkbook('talent');
  if(act==='exportTeachers')return exportWorkbook('teachers');
  if(act==='confirmImport')return confirmImport();
  if(act==='confirmMerge')return confirmMerge();
  if(act==='shareCurrentAttendance')return shareCurrentAttendance();
  if(act==='shareCurrentTalent')return shareCurrentTalent();
  if(act==='shareCurrentTeacherAttendance')return shareCurrentTeacherAttendance();
  if(act==='shareSummary')return shareSummary();
  if(act==='shareAttendance')return shareAttendancePacket();
  if(act==='shareTalent')return shareTalentPacket();
  if(act==='shareTeacherAttendance')return shareTeacherAttendance();
  if(act==='shareTeacherList')return shareTeacherList();
}

function setStudentStatus(id,status){if(status==='present')return toggleStudentAttendance(id);if(status==='late')return toggleStudentAttendanceFlag(id,'late');if(status==='new')return toggleStudentAttendanceFlag(id,'newcomer');}

function writeStudentAttendance(id,a,k=ui.date){const sess=ensureSession(k);sess.attendance[id]={present:!!a.present,late:!!a.late,newcomer:!!a.newcomer,status:a.present?'present':'absent',memo:a.memo||''};}
function studentEntryMeaningful(a){return !!a && (!!a.present || !!a.late || !!a.newcomer);}
function teacherEntryMeaningful(a){return !!a && (!!a.present || !!a.late);}
function cleanupStudentAttendanceSession(k=ui.date){
  const sess=state.sessions?.[k];if(!sess)return;
  const meaningful=Object.values(sess.attendance||{}).some(studentEntryMeaningful);
  if(!meaningful){
    sess.attendance={};delete sess.attendanceStarted;
    if(!(sess.transactions||[]).length)delete state.sessions[k];
  }
}
function cleanupTeacherAttendanceSession(k=ui.date){
  const sess=state.teacherSessions?.[k];if(!sess)return;
  const meaningful=Object.values(sess.attendance||{}).some(teacherEntryMeaningful);
  if(!meaningful)delete state.teacherSessions[k];
}
function initializeAttendanceScope(list){const sess=ensureSession();for(const st of list){if(!Object.prototype.hasOwnProperty.call(sess.attendance,st.id))writeStudentAttendance(st.id,{present:false,late:false,newcomer:false,memo:''});}}
function toggleStudentAttendance(id){
  const st=studentById(id);if(!st)return;pushUndo();
  const current=att(st);
  if(!current.present){
    initializeAttendanceScope(attendanceScopeList());
    writeStudentAttendance(id,{...current,present:true});
  }else{
    writeStudentAttendance(id,{...current,present:false,late:false,newcomer:false});
    cleanupStudentAttendanceSession();
  }
  save();render();
}
function toggleStudentAttendanceFlag(id,flag){
  const st=studentById(id);if(!st)return;pushUndo();const current=att(st);
  const next=!current[flag];
  if(next)initializeAttendanceScope(attendanceScopeList());
  writeStudentAttendance(id,{...current,[flag]:next,present:next?true:current.present});
  if(!next)cleanupStudentAttendanceSession();
  save();render();
}
function setAllStudentAttendance(v){
  const list=attendanceScopeList();if(!list.length)return toast('학생이 없습니다.');pushUndo();
  if(v){
    initializeAttendanceScope(list);
    for(const st of list){const a=att(st);writeStudentAttendance(st.id,{...a,present:true});}
  }else{
    const sess=state.sessions?.[ui.date];
    if(sess){
      for(const st of list)delete sess.attendance?.[st.id];
      cleanupStudentAttendanceSession();
    }
  }
  save();toast(v?`${list.length}명 전체 출석 선택`:'현재 목록의 출석 체크를 해제했습니다.');render();
}
function writeTeacherAttendance(id,a,k=ui.date){const sess=ensureTeacherSession(k);sess.attendance[id]={present:!!a.present,late:!!a.late,status:a.present?'present':'absent',reason:a.reason||''};}
function initializeTeacherAttendance(list){const sess=ensureTeacherSession();for(const t of list){if(!Object.prototype.hasOwnProperty.call(sess.attendance,t.id))writeTeacherAttendance(t.id,{present:false,late:false,reason:''});}}
function toggleTeacherAttendance(id){
  const t=teacherById(id);if(!t)return;pushUndo();const current=teacherAtt(t);
  if(!current.present){initializeTeacherAttendance(activeTeachers());writeTeacherAttendance(id,{...current,present:true});}
  else{writeTeacherAttendance(id,{...current,present:false,late:false});cleanupTeacherAttendanceSession();}
  save();render();
}
function toggleTeacherAttendanceFlag(id,flag){
  const t=teacherById(id);if(!t)return;pushUndo();const current=teacherAtt(t),next=!current[flag];
  if(next)initializeTeacherAttendance(activeTeachers());
  writeTeacherAttendance(id,{...current,[flag]:next,present:next?true:current.present});
  if(!next)cleanupTeacherAttendanceSession();
  save();render();
}
function setAllTeacherAttendance(v){
  const list=activeTeachers();if(!list.length)return toast('교사 명단이 없습니다.');pushUndo();
  if(v){initializeTeacherAttendance(list);for(const t of list){const a=teacherAtt(t);writeTeacherAttendance(t.id,{...a,present:true});}}
  else{delete state.teacherSessions[ui.date];}
  save();toast(v?`${list.length}명 교사 전체 출석 선택`:'교사 전체 출석 체크를 해제했습니다.');render();
}
function doubleLastTalent(){const tx=ensureSession().transactions.find(t=>t.id===ui.lastTxId);if(!tx||tx.kind==='reset')return toast('2배로 바꿀 방금 기록이 없습니다.');if(tx.x2Applied)return toast('방금 기록은 이미 2배가 적용되었습니다.');pushUndo();tx.amount=Number(tx.amount||0)*2;tx.multiplier=2;tx.x2Applied=true;save();toast(`방금 기록을 ${tx.amount>0?'+':''}${fmt(tx.amount)}로 2배 적용했습니다.`);render();}
function saveStudentMemoAuto(id,el){
  const st=studentById(id);if(!st||!el)return;const sess=state.sessions?.[ui.date];
  if(!sess?.attendance?.[id]){if(String(el.value||'').trim())toast('먼저 출석을 체크한 뒤 비고를 입력해 주세요.');return;}
  const next=el.value,prev=att(st).memo||'';if(prev===next)return;const a=att(st);writeStudentAttendance(id,{...a,memo:next});save();const m=document.querySelector(`[data-memo-saved="${CSS.escape(id)}"]`);if(m){m.textContent='저장됨';setTimeout(()=>{if(m)m.textContent='';},800);}
}
function startAttendanceDraft(edit=false){
  const list=attendanceScopeList(); if(!list.length)return toast('출석 대상 학생이 없습니다.');
  ui.attendanceDraft=new Set(edit?list.filter(st=>att(st).present).map(st=>st.id):list.map(st=>st.id)); ui.attendanceDraftKey=attendanceDraftKey(); render();
}
function toggleAttendanceDraft(id){ if(!(ui.attendanceDraft instanceof Set))return; ui.attendanceDraft.has(id)?ui.attendanceDraft.delete(id):ui.attendanceDraft.add(id); render(); }
function confirmAttendanceDraft(){
  const list=attendanceScopeList(); if(!(ui.attendanceDraft instanceof Set))return;pushUndo();
  if(ui.attendanceDraft.size){
    initializeAttendanceScope(list);
    for(const st of list){const a=att(st),selected=ui.attendanceDraft.has(st.id);writeStudentAttendance(st.id,{...a,present:selected,late:selected&&a.late,newcomer:selected&&a.newcomer});}
  }else{
    const sess=state.sessions?.[ui.date];if(sess){for(const st of list)delete sess.attendance?.[st.id];cleanupStudentAttendanceSession();}
  }
  const n=ui.attendanceDraft.size;ui.attendanceDraft=null;ui.attendanceDraftKey='';save();toast(n?`${n}/${list.length}명 출석 저장`:'출석 체크가 없어 기록을 만들지 않았습니다.');render();
}
function startTeacherAttendanceDraft(edit=false){ const list=activeTeachers(); if(!list.length)return toast('교사 명단이 없습니다.'); ui.teacherAttendanceDraft=new Set(edit?list.filter(t=>teacherAtt(t).present).map(t=>t.id):list.map(t=>t.id));ui.teacherAttendanceDraftKey=teacherAttendanceDraftKey();render(); }
function toggleTeacherAttendanceDraft(id){if(!(ui.teacherAttendanceDraft instanceof Set))return;ui.teacherAttendanceDraft.has(id)?ui.teacherAttendanceDraft.delete(id):ui.teacherAttendanceDraft.add(id);render();}
function confirmTeacherAttendanceDraft(){
  const list=activeTeachers();if(!(ui.teacherAttendanceDraft instanceof Set))return;pushUndo();
  if(ui.teacherAttendanceDraft.size){initializeTeacherAttendance(list);for(const t of list){const a=teacherAtt(t),selected=ui.teacherAttendanceDraft.has(t.id);writeTeacherAttendance(t.id,{...a,present:selected,late:selected&&a.late});}}
  else delete state.teacherSessions[ui.date];
  const n=ui.teacherAttendanceDraft.size;ui.teacherAttendanceDraft=null;ui.teacherAttendanceDraftKey='';save();toast(n?`${n}/${list.length}명 교사 출석 저장`:'출석 체크가 없어 기록을 만들지 않았습니다.');render();
}
function setTeacherStatus(id,status){if(status==='present')return toggleTeacherAttendance(id);if(status==='late')return toggleTeacherAttendanceFlag(id,'late');}
function saveTeacherReasonAuto(id,el){
  const t=teacherById(id);if(!t||!el)return;const sess=state.teacherSessions?.[ui.date];
  if(!sess?.attendance?.[id]){if(String(el.value||'').trim())toast('먼저 출석을 체크한 뒤 비고를 입력해 주세요.');return;}
  const next=el.value,prev=teacherAtt(t).reason||'';if(prev===next)return;const a=teacherAtt(t);writeTeacherAttendance(id,{...a,reason:next});save();const m=document.querySelector(`[data-teacher-saved="${CSS.escape(id)}"]`);if(m){m.textContent='저장됨';setTimeout(()=>{if(m)m.textContent='';},800);}
}

function bulkDeactivate(){
  const ids=[...ui.bulkSelected]; if(!ids.length)return toast('정리할 학생을 선택해 주세요.');
  if(!confirm(`선택한 ${ids.length}명을 현재 명단에서 제외할까요?\n과거 출석·달란트 기록은 유지됩니다.`))return;
  createSnapshot('학생 일괄 정리 전');pushUndo();ids.forEach(id=>{const st=studentById(id);if(st)st.active=false;});save();ui.bulkSelected.clear();toast(`${ids.length}명을 명단에서 제외했습니다.`);ui.modal={type:'studentBulk'};render();
}
function bulkDelete(){
  const ids=[...ui.bulkSelected]; if(!ids.length)return toast('삭제할 학생을 선택해 주세요.');
  if(!confirm(`선택한 ${ids.length}명을 완전히 삭제할까요?\n잘못 가져온 가짜/중복 학생 정리용입니다. 출석·달란트 연결 기록도 함께 제거됩니다.\n실행 직후 되돌리기는 가능합니다.`))return;
  createSnapshot('학생 완전 삭제 전'); pushUndo(); const set=new Set(ids);
  state.students=state.students.filter(st=>!set.has(st.id));
  state.settings.customStudentOrder=(state.settings.customStudentOrder||[]).filter(id=>!set.has(id));
  Object.values(state.sessions).forEach(sess=>{ for(const id of ids)delete (sess.attendance||{})[id]; sess.transactions=(sess.transactions||[]).map(t=>({...t,studentIds:(t.studentIds||[]).filter(id=>!set.has(id))})).filter(t=>(t.studentIds||[]).length); });
  save(); ui.bulkSelected.clear(); toast(`${ids.length}명을 완전히 삭제했습니다. 되돌리기 가능`); ui.modal={type:'studentBulk'}; render();
}
function bulkMoveGrade(){
  const ids=[...ui.bulkSelected]; if(!ids.length)return toast('이동할 학생을 선택해 주세요.');
  const target=prompt(`선택한 ${ids.length}명을 어느 학년으로 이동할까요?\n예: 4학년, 5학년, 6학년`,'4학년'); if(target===null)return; const g=normalizeGrade(target.trim());
  if(!g)return toast('학년을 입력해 주세요.'); pushUndo(); ids.forEach(id=>{const st=studentById(id);if(st)st.grade=g;}); save(); ui.bulkSelected.clear(); toast(`${ids.length}명을 ${g}으로 이동했습니다.`); ui.modal={type:'studentBulk'}; render();
}
function saveStudentForm(id){
  const name=document.getElementById('fName').value.trim(); if(!name)return toast('학생 이름을 입력해 주세요.');
  pushUndo(); let st=id?studentById(id):null;
  if(!st){st={id:uid('stu'),teams:[],photo:null,active:true};state.students.push(st);}
  Object.assign(st,{name,grade:normalizeGrade(document.getElementById('fGrade').value.trim()),gender:document.getElementById('fGender').value,birthday:document.getElementById('fBirthday').value,phone:document.getElementById('fPhone').value.trim(),parentName:document.getElementById('fParentName').value.trim(),parentRelation:document.getElementById('fParentRelation').value.trim(),parentPhone:document.getElementById('fParentPhone').value.trim(),parent2Name:document.getElementById('fParent2Name').value.trim(),parent2Relation:document.getElementById('fParent2Relation').value.trim(),parent2Phone:document.getElementById('fParent2Phone').value.trim(),school:document.getElementById('fSchool').value.trim(),siblings:document.getElementById('fSiblings').value.trim(),address:document.getElementById('fAddress').value.trim(),memo:document.getElementById('fMemo').value.trim(),active:true});
  save(); ui.modal={type:'detail',id:st.id}; toast(id?'학생 정보를 수정했습니다.':'학생을 추가했습니다.'); render();
}
function deactivateStudent(id){ if(!confirm('현재 명단에서 숨길까요? 과거 출석·달란트 기록은 유지됩니다.'))return; pushUndo();studentById(id).active=false;save();ui.modal=null;render(); }

function newTeam(){ const n=prompt('새 팀 이름을 입력하세요.'); if(!n?.trim())return; const name=n.trim(); if(allTeams().includes(name))return toast('이미 있는 팀 이름입니다.'); pushUndo(); state.teams.push(name); save(); ui.teamGrade='전체'; ui.modal={type:'teamEdit',team:name}; render(); }
function renameTeam(old){ const el=document.getElementById('teamRename'); const n=el?.value.trim(); if(!n||n===old)return; if(allTeams().includes(n))return toast('이미 있는 팀 이름입니다.'); pushUndo(); const i=state.teams.indexOf(old); if(i>=0)state.teams[i]=n; active().forEach(s=>{s.teams=(s.teams||[]).map(t=>t===old?n:t)}); save(); ui.modal={type:'teamEdit',team:n}; toast('팀 이름을 바꿨습니다.'); render(); }
function toggleTeamMember(id,team){ pushUndo(); const st=studentById(id); st.teams ||= []; const i=st.teams.indexOf(team); if(i>=0)st.teams.splice(i,1); else st.teams.push(team); save(); render(); }
function clearTeam(team){ if(!confirm(`${team}의 팀원을 모두 뺄까요? 과거 달란트 기록은 유지됩니다.`))return; pushUndo();active().forEach(s=>s.teams=(s.teams||[]).filter(t=>t!==team));save();render(); }
function deleteTeam(team){ if(!confirm(`${team}을 삭제할까요? 과거 기록은 유지됩니다.`))return; pushUndo();state.teams=state.teams.filter(t=>t!==team);active().forEach(s=>s.teams=(s.teams||[]).filter(t=>t!==team));save();render(); }
function moveTeam(team,dir){ const arr=state.teams; const i=arr.indexOf(team); const j=i+dir; if(i<0||j<0||j>=arr.length)return; pushUndo(); [arr[i],arr[j]]=[arr[j],arr[i]]; save(); render(); }

function renameGrade(old){
  const n=prompt(`${old}의 새 이름을 입력하세요.`,old); if(!n?.trim())return; const next=normalizeGrade(n.trim()); if(next===old)return;
  if(grades().includes(next)) return mergeGrade(old,next);
  createSnapshot('학년 이름 변경 전'); pushUndo(); state.students.forEach(st=>{if(st.active!==false&&st.grade===old)st.grade=next;});
  if(state.settings.managementScope===old)state.settings.managementScope=next; if(ui.studentGrade===old)ui.studentGrade=next; if(ui.attendanceGrade===old)ui.attendanceGrade=next; if(ui.analyticsScope===old)ui.analyticsScope=next;
  save();toast('학년 이름을 변경했습니다.');ui.modal={type:'gradeManager'};render();
}
function mergeGrade(old,targetArg){
  const options=grades().filter(g=>g!==old); if(!options.length)return toast('병합할 다른 학년이 없습니다.');
  const target=targetArg||prompt(`${old}을 어느 학년으로 병합할까요?\n${options.join(' / ')}`,options[0]); if(!target)return; const next=options.find(x=>x===target.trim())||options.find(x=>normalizeGrade(x)===normalizeGrade(target)); if(!next)return toast('목록에 있는 학년 이름을 입력해 주세요.');
  if(!confirm(`${old} 학생을 모두 ${next}으로 이동할까요?\n과거 기록은 그대로 유지됩니다.`))return;
  createSnapshot('학년 병합 전');pushUndo();state.students.forEach(st=>{if(st.active!==false&&st.grade===old)st.grade=next;});
  if(state.settings.managementScope===old)state.settings.managementScope=next; [ui.studentGrade,ui.attendanceGrade,ui.analyticsScope].forEach(()=>{}); if(ui.studentGrade===old)ui.studentGrade=next;if(ui.attendanceGrade===old)ui.attendanceGrade=next;if(ui.analyticsScope===old)ui.analyticsScope=next;
  save();toast(`${old} → ${next} 병합 완료`);ui.modal={type:'gradeManager'};render();
}
function deleteGrade(g){
  const n=active().filter(st=>st.grade===g).length; if(!confirm(`${g} 분류를 삭제할까요?\n${n}명의 학생은 '학년 미지정'으로 남고 과거 기록은 유지됩니다.`))return;
  createSnapshot('학년 분류 삭제 전');pushUndo();state.students.forEach(st=>{if(st.active!==false&&st.grade===g)st.grade='';});if(state.settings.managementScope===g)state.settings.managementScope='전체';if(ui.studentGrade===g)ui.studentGrade='전체';if(ui.attendanceGrade===g)ui.attendanceGrade='전체';if(ui.analyticsScope===g)ui.analyticsScope='전체';save();toast('학년 분류를 정리했습니다.');ui.modal={type:'gradeManager'};render();
}
function saveSettings(){
  const dep=document.getElementById('department').value.trim(); let scope=document.getElementById('managementScope').value; const nums=document.getElementById('amounts').value.split(',').map(v=>Number(v.trim())).filter(v=>Number.isFinite(v)&&v>0).slice(0,4);
  if(nums.length<1)return toast('달란트 금액을 하나 이상 입력해 주세요.');
  const adminMode=(document.querySelector('input[name="adminMode"]:checked')?.value||'admin')==='admin';
  const managedGrades=[...document.querySelectorAll('[data-managed-grade]:checked')].map(x=>x.dataset.managedGrade);
  const managedTeams=[...document.querySelectorAll('[data-managed-team]:checked')].map(x=>x.dataset.managedTeam);
  if(!adminMode){ if(!managedGrades.length)return toast('담당 선생님 모드에서는 내 담당 학년을 하나 이상 선택해 주세요.'); scope='내 담당'; }
  state.settings.department=dep||'교회학교'; state.settings.adminMode=adminMode; state.settings.managementScope=scope; state.settings.amounts=nums; state.settings.managedGrades=managedGrades; state.settings.managedTeams=managedTeams; const la=document.getElementById('longAbsenceDays'); if(la)state.settings.longAbsenceDays=Number(la.value)||60; ui.attendanceGrade=scope; ui.analyticsScope=scope; ui.filterValue=(adminMode?'전체':'내 담당'); save();toast('설정을 저장했습니다.');render();
}
function saveTeacherForm(id){ const name=document.getElementById('tName').value.trim(); if(!name)return toast('교사 이름을 입력해 주세요.'); pushUndo(); let t=id?teacherById(id):null;if(!t){t={id:uid('tea'),active:true};state.teachers.push(t);}Object.assign(t,{name,role:document.getElementById('tRole').value.trim(),birthday:document.getElementById('tBirthday')?.value||'',phone:document.getElementById('tPhone').value.trim(),emergencyPhone:document.getElementById('tEmergencyPhone').value.trim(),memo:document.getElementById('tMemo').value.trim(),active:true});save();ui.modal={type:'teachers'};render(); }
function deactivateTeacher(id){ if(!confirm('교사 명단에서 비활성화할까요? 과거 출석은 유지됩니다.'))return;pushUndo();teacherById(id).active=false;save();ui.modal={type:'teachers'};render(); }

function ensureCustomOrder(){
  const ids=active().map(s=>s.id); const current=(state.settings.customStudentOrder||[]).filter(id=>ids.includes(id));
  ids.forEach(id=>{if(!current.includes(id))current.push(id);}); state.settings.customStudentOrder=current;
}
function moveStudentOrder(id,dir){
  ensureCustomOrder(); const arr=state.settings.customStudentOrder; const i=arr.indexOf(id); if(i<0)return;
  let candidates=sortStudents(active().filter(s=>ui.orderGrade==='전체'||s.grade===ui.orderGrade),'custom').map(s=>s.id);
  const ci=candidates.indexOf(id), ni=ci+dir; if(ni<0||ni>=candidates.length)return;
  const other=candidates[ni], oi=arr.indexOf(other); [arr[i],arr[oi]]=[arr[oi],arr[i]]; save();render();
}
function exportBaseData(){
  ensureCustomOrder();
  const packet={schema:'church-school-base-v1',createdAt:new Date().toISOString(),department:state.settings.department||'',students:clone(active().map(s=>({...s,photo:s.photo||null}))),teachers:clone(activeTeachers()),teams:clone(state.teams||[]),settings:{amounts:clone(state.settings.amounts||[]),managementScope:state.settings.managementScope||'전체',teacherAttendanceEnabled:!!state.settings.teacherAttendanceEnabled,longAbsenceDays:Number(state.settings.longAbsenceDays||60),customStudentOrder:clone(state.settings.customStudentOrder||[]),managedGrades:clone(state.settings.managedGrades||[]),managedTeams:clone(state.settings.managedTeams||[]),adminMode:!!state.settings.adminMode}};
  download(`${state.settings.department||'교회학교'}_부서기본데이터_${todayKey()}.json`,JSON.stringify(packet,null,2),'application/json');toast('부서 기본 데이터를 만들었습니다.');
}
async function importBaseDataFile(file){
  try{const p=JSON.parse(await file.text());if(p.schema!=='church-school-base-v1'||!Array.isArray(p.students))throw new Error('올바른 부서 기본 데이터가 아닙니다.');
    const mode=confirm('현재 명단과 합쳐 업데이트할까요?\n\n확인 = 기존 데이터에 업데이트/추가\n취소 = 기본 명단으로 교체')?'update':'replace';
    if(!confirm(mode==='update'?'학생·교사 기본정보를 업데이트하고 없는 사람만 추가합니다. 계속할까요?':'현재 활성 명단을 이 기본 데이터 기준으로 교체합니다. 과거 출석·달란트 기록은 보존됩니다. 계속할까요?'))return;
    createSnapshot('부서 기본 데이터 가져오기 전');pushUndo(); const matched=new Set();
    for(const inc of p.students){let st=resolveStudent(inc);if(st){const keep={id:st.id,teams:st.teams||[],photo:st.photo||null};Object.assign(st,clone(inc),keep,{active:true});}else{st=clone(inc);st.id=st.id&&!studentById(st.id)?st.id:uid('stu');st.active=true;state.students.push(st);}matched.add(st.id);}
    if(mode==='replace')active().forEach(st=>{if(!matched.has(st.id))st.active=false;});
    const tmatched=new Set();for(const inc of p.teachers||[]){let t=resolveTeacher(inc);if(t)Object.assign(t,clone(inc),{id:t.id,active:true});else{t=clone(inc);t.id=t.id&&!teacherById(t.id)?t.id:uid('tea');t.active=true;state.teachers.push(t);}tmatched.add(t.id);}if(mode==='replace')activeTeachers().forEach(t=>{if(!tmatched.has(t.id))t.active=false;});
    state.teams=clone(p.teams||state.teams||[]); state.settings={...state.settings,...clone(p.settings||{}),department:p.department||state.settings.department};save();toast('부서 기본 데이터를 적용했습니다.');render();
  }catch(e){alert(`기본 데이터 가져오기에 실패했습니다.\n${e.message||e}`);}
}
async function shareTeacherList(){
  const list=activeTeachers(); const text=[`${state.settings.department||'교회학교'} 교사 연락처`,...list.map(t=>`${t.name}${t.role?` · ${t.role}`:''}${t.birthday?` · 생일 ${t.birthday}`:''}${t.phone?` · ${t.phone}`:''}${t.memo?` · ${t.memo}`:''}`)].join('\n'); await nativeShare({title:'교사 연락처',text});
}
async function nativeShare({title,text,files}){ try{ if(files && navigator.canShare && navigator.canShare({files}) && navigator.share){await navigator.share({title,text,files});return true;} if(navigator.share){await navigator.share({title,text});return true;} if(navigator.clipboard){await navigator.clipboard.writeText(text);toast('내용을 복사했습니다.');return true;} }catch(e){} return false; }
async function shareCurrentAttendance(){
  const list=attendanceScopeList();
  const section=(group,label)=>{const present=group.filter(st=>att(st).present), absent=group.filter(st=>!att(st).present), notes=[];group.forEach(st=>{const a=att(st);const bits=[];if(a.late)bits.push('지각');if(a.newcomer)bits.push('새친구');if(a.memo)bits.push(a.memo);if(bits.length)notes.push(`${st.name} — ${bits.join(' · ')}`);});return [label,`오늘 출석 ${present.length} / 전체 ${group.length}명`,'','출석',present.map(s=>s.name).join(', ')||'없음','','결석',absent.map(s=>s.name).join(', ')||'없음',...(notes.length?['','비고',...notes]:[])];};
  let lines=[];
  if(ui.attendanceGrade==='전체'){lines=[`${displayDate()} · 전체 출석`,''];for(const g of grades()){const group=list.filter(s=>s.grade===g);if(group.length)lines.push(...section(group,g),'');}}
  else lines=[`${displayDate()} · ${ui.attendanceGrade} 출석`,'',...section(list,'').slice(1)];
  await nativeShare({title:`${ui.attendanceGrade} 출석`,text:lines.join('\n').trim()});
}
async function shareCurrentTalent(){
  const list=filterStudents(); const total=list.reduce((sum,st)=>sum+todayAmt(st.id),0); const lines=[`${displayDate()} · ${ui.filterValue||'전체'} 달란트`,`현재 범위 총 ${fmt(total)}달란트`];
  list.filter(st=>todayAmt(st.id)!==0).forEach(st=>lines.push(`${st.name} ${todayAmt(st.id)>0?'+':''}${fmt(todayAmt(st.id))}`));
  await nativeShare({title:'달란트 현황',text:lines.join('\n')});
}
async function shareCurrentTeacherAttendance(){
  const list=activeTeachers(), present=list.filter(t=>teacherAtt(t).present), absent=list.filter(t=>!teacherAtt(t).present), notes=[];
  list.forEach(t=>{const a=teacherAtt(t);const bits=[];if(a.late)bits.push('지각');if(a.reason)bits.push(a.reason);if(bits.length)notes.push(`${t.name} — ${bits.join(' · ')}`);});
  const lines=[`${displayDate()} · 교사 출석`,`오늘 출석 ${present.length} / 전체 ${list.length}명`,'','출석',present.map(t=>t.name).join(', ')||'없음','','결석',absent.map(t=>t.name).join(', ')||'없음',...(notes.length?['','비고',...notes]:[])];
  await nativeShare({title:'교사 출석',text:lines.join('\n')});
}
function deleteSessionRecord(k){
  if(typeof attendanceSessionRecorded==='function'?!attendanceSessionRecorded(k):(!state.sessions[k]||!Object.keys(state.sessions[k].attendance||{}).length))return toast('삭제할 출석 기록이 없습니다.');
  if(!confirm(`${displayDate(k)}의 출석 기록을 삭제할까요?\n달란트 기록과 학생 기본정보는 유지되며 되돌리기로 복구할 수 있습니다.`))return;
  pushUndo(); state.sessions[k].attendance={};delete state.sessions[k].attendanceStarted;if(!(state.sessions[k].transactions||[]).length)delete state.sessions[k]; save(); toast('출석 기록을 삭제했습니다.'); render();
}
async function shareSummary(){ const list=scopedStudents(ui.attendanceGrade==='전체'?(state.settings.managementScope||'전체'):ui.attendanceGrade); const c=attendanceCounts(list); const lines=[`${displayDate()} · ${state.settings.department||'교회학교'}`,`출석 ${c.present}/${list.length} · 결석 ${c.absent} · 지각 ${c.late}`,`달란트 총 ${fmt(sessionTotal())}`]; const gradesList=grades(); gradesList.forEach(g=>{const ss=active().filter(s=>s.grade===g); if(ss.length){const cc=attendanceCounts(ss); const talent=ss.reduce((n,s)=>n+todayAmt(s.id),0); lines.push(`${g} ${cc.present}/${ss.length} · ${fmt(talent)}달란트`);}}); await nativeShare({title:'오늘 요약',text:lines.join('\n')});ui.modal=null;render(); }
async function shareLast(){ const tx=ensureSession().transactions.find(t=>t.id===ui.lastTxId);if(!tx)return;const names=tx.studentIds.map(id=>studentById(id)?.name).filter(Boolean);if(tx.kind==='reset'){const lines=[`${displayDate()} 달란트 리셋`,...names.map(n=>`${n} · 잔액 0으로 리셋`),`총 ${names.length}명`];return nativeShare({title:'달란트 리셋',text:lines.join('\n')});}const lines=[`${displayDate()} 달란트 ${tx.amount<0?'차감':'지급'}`,...names.map(n=>`${n} ${tx.amount>0?'+':''}${tx.amount}`),`${tx.multiplier===2?`기본 ${tx.base} ×2 · `:''}총 ${fmt(tx.amount*names.length)}달란트`];await nativeShare({title:'달란트 기록',text:lines.join('\n')}); }
function studentPacketInfo(st){return {id:st.id,name:st.name,grade:st.grade||'',birthday:st.birthday||'',gender:st.gender||'',teams:clone(st.teams||[])};}
async function sharePacket(packet,name,text){ const file=new File([JSON.stringify(packet,null,2)],name,{type:'application/json'}); const shared=await nativeShare({title:name,text,files:[file]}); if(!shared)download(name,JSON.stringify(packet,null,2),'application/json'); }
async function shareAttendancePacket(){ const list=attendanceScopeList(); const p={schema:'church-school-share-v2',packetId:uid('packet'),type:'attendance',date:ui.date,scope:{kind:'grade',label:ui.attendanceGrade,grades:[...new Set(list.map(s=>s.grade).filter(Boolean))]},createdAt:new Date().toISOString(),students:list.map(studentPacketInfo),records:list.map(s=>({studentId:s.id,present:att(s).present,late:att(s).late,newcomer:att(s).newcomer,status:att(s).present?'present':'absent',memo:att(s).memo||''}))}; await sharePacket(p,`${ui.date}_${ui.attendanceGrade}_출석.json`,`${displayDate()} ${ui.attendanceGrade} 출석 기록`);ui.modal=null;render(); }
async function shareTalentPacket(){ const tx=ensureSession().transactions; const visible=filterStudents(); const ids=[...new Set(tx.flatMap(t=>t.studentIds||[]))]; const p={schema:'church-school-share-v2',packetId:uid('packet'),type:'talent',date:ui.date,scope:{kind:ui.filterType,label:ui.filterValue,grades:[...new Set(visible.map(s=>s.grade).filter(Boolean))],teams:[...new Set(visible.flatMap(s=>s.teams||[]))]},createdAt:new Date().toISOString(),students:ids.map(studentById).filter(Boolean).map(studentPacketInfo),records:clone(tx)}; await sharePacket(p,`${ui.date}_달란트.json`,`${displayDate()} 달란트 ${fmt(sessionTotal())}`);ui.modal=null;render(); }
async function shareTeacherAttendance(){ const list=activeTeachers();const c=teacherAttendanceCounts(list);const text=[`${displayDate()} 교사 출석`,`출석 ${c.present}/${list.length} · 지각 ${c.late} · 결석 ${c.absent}`,...list.filter(t=>teacherAtt(t).status!=='unset').map(t=>`${t.name} ${teacherStatusLabel(teacherAtt(t).status)}${teacherAtt(t).reason?` · ${teacherAtt(t).reason}`:''}`)].join('\n');const p={schema:'church-school-share-v2',packetId:uid('packet'),type:'teacher-attendance',date:ui.date,createdAt:new Date().toISOString(),teachers:list.map(t=>({id:t.id,name:t.name,role:t.role||''})),records:list.map(t=>({teacherId:t.id,present:teacherAtt(t).present,late:teacherAtt(t).late,status:teacherAtt(t).present?'present':'absent',reason:teacherAtt(t).reason||''}))};await sharePacket(p,`${ui.date}_교사출석.json`,text);ui.modal=null;render(); }

async function readShareFiles(files){
  const packets=[]; for(const f of files){try{const p=JSON.parse(await f.text());if(['church-school-share-v1','church-school-share-v2'].includes(p.schema)&&['attendance','talent','teacher-attendance'].includes(p.type))packets.push(p);}catch(e){}}
  if(!packets.length)return alert('출석/달란트/교사 출석 공유 파일을 찾지 못했습니다.');
  const preview={files:packets.length,attendanceRecords:0,talentRecords:0,teacherRecords:0,duplicates:0,unknown:[]}; const unknownMap=new Map();
  for(const p of packets){if(state.importedPacketIds.includes(p.packetId)){preview.duplicates++;continue;}if(p.type==='attendance')preview.attendanceRecords+=(p.records||[]).length;else if(p.type==='talent')preview.talentRecords+=(p.records||[]).length;else preview.teacherRecords+=(p.records||[]).length;for(const s of p.students||[]){if(!resolveStudent(s))unknownMap.set(`${s.name}|${s.grade}|${s.birthday}`,s);}}
  preview.unknown=[...unknownMap.values()];pendingMerge=packets;ui.modal={type:'merge',preview};render();
}
function resolveStudent(inc){ return studentById(inc.id)||active().find(s=>normalize(s.name)===normalize(inc.name)&&normalize(s.grade)===normalize(inc.grade)&&(inc.birthday?normalize(s.birthday)===normalize(inc.birthday):true))||active().find(s=>normalize(s.name)===normalize(inc.name)&&normalize(s.grade)===normalize(inc.grade)); }
function resolveTeacher(inc){ return teacherById(inc.id)||activeTeachers().find(t=>normalize(t.name)===normalize(inc.name)&&normalize(t.role)===normalize(inc.role)); }
function stableStudentId(n){return `stu-${normalize(n.grade||'x')}-${normalize(n.name||'x')}-${normalize(n.birthday||'x')}`.slice(0,80);}
function confirmMerge(){
  if(!pendingMerge)return;pushUndo();let added=0,attN=0,txN=0,teacherN=0;
  for(const p of pendingMerge){if(state.importedPacketIds.includes(p.packetId))continue;
    if(p.type==='teacher-attendance'){
      const map={};for(const inc of p.teachers||[]){let t=resolveTeacher(inc);if(!t){t={id:inc.id||uid('tea'),name:inc.name,role:inc.role||'',phone:'',memo:'',active:true};if(teacherById(t.id))t.id=uid('tea');state.teachers.push(t);}map[inc.id]=t.id;}const sess=ensureTeacherSession(p.date);for(const r of p.records||[]){const id=map[r.teacherId]||r.teacherId;if(teacherById(id)){sess.attendance[id]={present:(typeof r.present==='boolean'?r.present:['present','late'].includes(r.status)),late:!!r.late||r.status==='late',status:(typeof r.present==='boolean'?r.present:['present','late'].includes(r.status))?'present':'absent',reason:r.reason||''};teacherN++;}}state.importedPacketIds.push(p.packetId);continue;
    }
    const idMap={};for(const inc of p.students||[]){let local=resolveStudent(inc);if(!local){local={id:inc.id||stableStudentId(inc),name:inc.name,grade:inc.grade||'',birthday:inc.birthday||'',gender:inc.gender||'',phone:'',parentName:'',parentPhone:'',school:'',address:'',siblings:'',memo:'',teams:clone(inc.teams||[]),photo:null,active:true};if(studentById(local.id))local.id=uid('stu');state.students.push(local);added++;}idMap[inc.id]=local.id;}
    if(p.type==='attendance'){const sess=ensureSession(p.date);for(const r of p.records||[]){const id=idMap[r.studentId]||r.studentId;if(studentById(id)){sess.attendance[id]={present:(typeof r.present==='boolean'?r.present:['present','late','new'].includes(r.status)),late:!!r.late||r.status==='late',newcomer:!!r.newcomer||r.status==='new',status:(typeof r.present==='boolean'?r.present:['present','late','new'].includes(r.status))?'present':'absent',memo:r.memo||''};attN++;}}}
    if(p.type==='talent'){const sess=ensureSession(p.date);for(const r of p.records||[]){if(sess.transactions.some(t=>t.id===r.id))continue;const ids=(r.studentIds||[]).map(id=>idMap[id]||id).filter(id=>studentById(id));if(ids.length){sess.transactions.push({...r,studentIds:ids,date:p.date});txN++;}}}
    state.importedPacketIds.push(p.packetId);
  }
  save();pendingMerge=null;ui.modal=null;toast(`업데이트 · 출석 ${attN} · 달란트 ${txN} · 교사 ${teacherN}${added?` · 새 학생 ${added}`:''}`);render();
}

function backup(){download(`교회학교_전체백업_${todayKey()}.json`,JSON.stringify(state,null,2),'application/json');}
function resetData(kind){
  const labels={students:'현재 학생 명단',teams:'팀',attendance:'출석 기록',talent:'달란트 기록',teachers:'교사 데이터',all:'전체 데이터'};
  const label=labels[kind]||'데이터';
  if(!confirm(`${label}을 초기화할까요?\n실행 직전에 현재 상태를 자동 백업합니다.`))return;
  if(kind==='all' && !confirm('전체 학생·출석·달란트·팀·교사 데이터가 초기화됩니다. 정말 진행할까요?'))return;
  createSnapshot(`${label} 초기화 전`);
  if(kind==='students') state.students.forEach(s=>s.active=false);
  if(kind==='teams'){state.teams=[];state.students.forEach(s=>s.teams=[]);}
  if(kind==='attendance'){Object.values(state.sessions).forEach(sess=>sess.attendance={});}
  if(kind==='talent'){Object.values(state.sessions).forEach(sess=>sess.transactions=[]);}
  if(kind==='teachers'){state.teachers=[];state.teacherSessions={};}
  if(kind==='all'){
    const snapshots=state.snapshots;
    state=migrate({students:[],teachers:[],sessions:{},teacherSessions:{},teams:[],settings:clone(defaultState.settings),importedPacketIds:[],snapshots});
  }
  save();ui.selected.clear();ui.modal={type:'dataManager'};toast(`${label}을 초기화했습니다.`);render();
}
function download(name,data,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;document.body.appendChild(a);a.click();const u=a.href;a.remove();setTimeout(()=>URL.revokeObjectURL(u),1200);}

const aliases={name:['이름','성명','학생이름','name'],grade:['학년','grade'],gender:['성별','남여','성별남여'],birthday:['생일','생년월일','생년','birthday'],phone:['전화번호','학생전화번호','학생연락처','휴대폰','핸드폰'],parentName:['학부모성함','보호자성함','부모님성함','학부모','보호자'],parentPhone:['학부모연락처','보호자연락처','부모님연락처','학부모전화번호','보호자1연락처'],address:['주소','집주소'],school:['학교','학교명'],siblings:['형제관계','형제','자매관계'],memo:['기타','기재사항','비고','메모','특이사항']};
function labelField(v){const n=normalize(v);for(const [k,arr] of Object.entries(aliases))if(arr.some(a=>normalize(a)===n))return k;return null;}
function sheetGrade(name){const t=String(name||'').trim();const m=t.match(/(?:초등?|초)?\s*([1-6])\s*(?:학년|학년부)?/);return m?`${m[1]}학년`:'';}
function blankStudent(){return {name:'',grade:'',gender:'',birthday:'',phone:'',parentName:'',parentRelation:'',parentPhone:'',parent2Name:'',parent2Relation:'',parent2Phone:'',address:'',school:'',siblings:'',memo:'',teams:[]};}
function cellText(v){if(v==null)return '';if(v instanceof Date)return v.toISOString().slice(0,10);return String(v).trim();}

const teacherAliases={name:['교사명','선생님','선생님이름','교사이름','성함','성명','이름'],role:['담당','담당학년','역할','부서'],birthday:['생일','생년월일'],phone:['전화번호','연락처','휴대폰','핸드폰'],emergencyPhone:['비상연락처'],memo:['메모','비고','기타','참고','특이사항']};
function teacherLabelField(v){const n=normalize(v);for(const [k,arr] of Object.entries(teacherAliases))if(arr.some(a=>normalize(a)===n))return k;return null;}
function validIncomingName(v){const t=String(v||'').trim();return !!t && !labelField(t) && !obviousNonPersonName(t) && t.length<=30;}
function teacherSheetLikely(matrix,sheetName){
  if(/교사|선생|교역자|teacher/i.test(String(sheetName||'')))return true;
  for(let r=0;r<Math.min(30,matrix.length);r++){const row=(matrix[r]||[]).map(v=>String(v||'').trim());const fields=row.map(teacherLabelField).filter(Boolean);if(row.some(v=>/^성함$/.test(v))&&fields.includes('phone'))return true;if(fields.includes('name')&&fields.includes('phone')&&fields.includes('birthday'))return true;}
  return false;
}
function blankTeacher(){return {name:'',role:'',birthday:'',phone:'',emergencyPhone:'',memo:''};}
function splitTeacherNameRole(v){const raw=String(v||'').trim();const m=raw.match(/^(.+?)\s*[\(\[]\s*([^\)\]]+)\s*[\)\]]\s*$/);return m?{name:m[1].trim(),role:m[2].trim()}:{name:raw,role:''};}
function parseTeacherMatrix(matrix){
  const out=[];let header=-1,map=null;
  for(let r=0;r<Math.min(40,matrix.length);r++){const m={};(matrix[r]||[]).forEach((v,i)=>{const f=teacherLabelField(v);if(f)m[i]=f;});const d=[...new Set(Object.values(m))];if(d.includes('name')&&(d.includes('phone')||d.includes('birthday'))){header=r;map=m;break;}}
  if(header>=0){const ni=Number(Object.keys(map).find(i=>map[i]==='name'));for(let r=header+1;r<matrix.length;r++){const rr=matrix[r]||[];const rawName=cellText(rr[ni]);if(!rawName)continue;const parsed=splitTeacherNameRole(rawName);if(!validIncomingName(parsed.name))continue;const t=blankTeacher();t.name=parsed.name;t.role=parsed.role;for(const [i,f] of Object.entries(map)){if(f==='name')continue;const v=cellText(rr[Number(i)]);if(v&&!teacherLabelField(v))t[f]=v;}if(t.name)out.push(t);}return out;}
  let cur=null;for(let r=0;r<matrix.length;r++){const row=matrix[r]||[];for(let c=0;c<row.length;c++){const f=teacherLabelField(row[c]);if(!f)continue;let value='';for(let j=c+1;j<row.length;j++){const v=cellText(row[j]);if(v&&!teacherLabelField(v)){value=v;break;}}if(f==='name'){if(cur?.name)out.push(cur);cur=blankTeacher();const parsed=splitTeacherNameRole(value);cur.name=validIncomingName(parsed.name)?parsed.name:'';cur.role=parsed.role;}else if(cur&&value)cur[f]=value;}}if(cur?.name)out.push(cur);return out;
}
function resolveIncomingTeacher(n){return activeTeachers().find(t=>normalize(t.name)===normalize(n.name)&&(!n.birthday||!t.birthday||normalize(t.birthday)===normalize(n.birthday)))||activeTeachers().find(t=>normalize(t.name)===normalize(n.name));}

function parseMatrix(matrix,sheetName){
  const out=[];
  const sg=sheetGrade(sheetName);

  // 1) 일반적인 가로형 표인지 먼저 판별합니다.
  // 세로형 교적부는 각 학생 블록 안에 "이름" 라벨이 반복되므로,
  // 단순히 "이름" 하나만 발견했다고 헤더 행으로 판단하면 안 됩니다.
  let headerRow=-1, headerMapping=null;
  for(let r=0;r<Math.min(30,matrix.length);r++){
    const row=matrix[r]||[];
    const mapping={};
    row.forEach((v,i)=>{const f=labelField(v);if(f)mapping[i]=f;});
    const fields=Object.values(mapping);
    const distinct=[...new Set(fields)];
    // 이름 + 다른 필드가 최소 2개 이상 있을 때만 가로형 헤더로 인정
    if(distinct.includes('name') && distinct.length>=3){
      headerRow=r; headerMapping=mapping; break;
    }
  }

  if(headerRow>=0 && headerMapping){
    const nameKey=Object.keys(headerMapping).find(i=>headerMapping[i]==='name');
    if(nameKey!==undefined){
      const nameIdx=Number(nameKey);
      for(let r=headerRow+1;r<matrix.length;r++){
        const rr=matrix[r]||[];
        const name=cellText(rr[nameIdx]);
        if(!validIncomingName(name)) continue;
        const s=blankStudent();
        Object.entries(headerMapping).forEach(([i,f])=>{
          const v=cellText(rr[Number(i)]);
          if(v && !labelField(v)) s[f]=v;
        });
        s.grade=s.grade||sg;
        if(s.name) out.push(s);
      }
      if(out.length) return out;
    }
  }

  // 2) 학생 한 명이 여러 행으로 구성된 세로형 교적부를 읽습니다.
  // "이름" 라벨이 새 학생 블록의 시작점입니다.
  let cur=null;
  const findValue=(r,c)=>{
    const row=matrix[r]||[];
    // 같은 행의 오른쪽에서 첫 번째 실제 값 찾기
    for(let j=c+1;j<row.length;j++){
      const v=cellText(row[j]);
      if(!v) continue;
      // 다른 항목 라벨이면 값으로 사용하지 않음
      if(labelField(v)) continue;
      return v;
    }
    // 병합 셀/배치 차이 대비: 바로 다음 행의 같은 열 및 오른쪽도 확인
    for(let rr=r+1;rr<=Math.min(r+1,matrix.length-1);rr++){
      const next=matrix[rr]||[];
      for(let j=c;j<next.length;j++){
        const v=cellText(next[j]);
        if(!v || labelField(v)) continue;
        return v;
      }
    }
    return '';
  };

  for(let r=0;r<matrix.length;r++){
    const row=matrix[r]||[];
    for(let c=0;c<row.length;c++){
      const f=labelField(row[c]);
      if(!f) continue;
      const value=findValue(r,c);
      if(f==='name'){
        if(cur?.name) out.push(cur);
        cur=blankStudent();
        cur.grade=sg;
        // "생일", "전화번호" 같은 라벨이 이름으로 들어가는 것을 차단
        cur.name=validIncomingName(value) ? value : '';
      }else if(cur && value){
        cur[f]=value;
      }
    }
  }
  if(cur?.name) out.push(cur);

  // 마지막 안전장치: 필드명 자체가 학생 이름으로 들어온 잘못된 결과 제거
  return out.filter(s=>validIncomingName(s.name));
}
function parseCsv(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(q&&text[i+1]==='"'){cell+='"';i++;}else q=!q;}else if(ch===','&&!q){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=ch;}if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
function mergeIncomingStudents(rows){
  const map=new Map();
  for(const raw of rows){
    if(!raw?.name || !validIncomingName(raw.name))continue;
    const n={...blankStudent(),...raw,teams:[]}; n.grade=normalizeGrade(n.grade);
    const key=[normalize(n.name),normalize(n.grade),normalize(n.birthday)].join('|');
    const fallback=[normalize(n.name),normalize(n.grade)].join('|');
    const k=key.endsWith('|')?fallback:key;
    if(!map.has(k))map.set(k,n);
    else{
      const cur=map.get(k);
      for(const f of comparableFields())if(!cur[f]&&n[f])cur[f]=n[f];
    }
  }
  return [...map.values()];
}
function comparableFields(){return ['grade','gender','birthday','phone','parentName','parentRelation','parentPhone','parent2Name','parent2Relation','parent2Phone','address','school','siblings','memo'];}
function studentNeedsUpdate(st,n){return comparableFields().some(k=>n[k]&&normalize(st[k])!==normalize(n[k]));}
function analyzeIncoming(students){
  let newCount=0,updateCount=0,unchangedCount=0;
  const matched=new Set();
  for(const n of students){
    const st=resolveStudent({id:'',name:n.name,grade:n.grade,birthday:n.birthday});
    if(!st)newCount++;
    else{matched.add(st.id); if(studentNeedsUpdate(st,n))updateCount++; else unchangedCount++;}
  }
  const missingCount=active().filter(s=>!matched.has(s.id)).length;
  return {newCount,updateCount,unchangedCount,missingCount};
}
async function handleExcel(file){try{
  let students=[],teachers=[],sheets=[];
  if(file.name.toLowerCase().endsWith('.csv')){
    const matrix=parseCsv(await file.text()); students=parseMatrix(matrix,'CSV'); sheets=['CSV'];
  }else{
    if(typeof XLSX==='undefined')throw new Error('Excel 읽기 모듈이 아직 준비되지 않았습니다. 인터넷 연결 후 앱을 한 번 다시 열어 주세요.');
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true}); sheets=wb.SheetNames;
    for(const sn of wb.SheetNames){
      const matrix=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});
      if(teacherSheetLikely(matrix,sn)) teachers.push(...parseTeacherMatrix(matrix));
      else students.push(...parseMatrix(matrix,sn));
    }
  }
  students=mergeIncomingStudents(students).filter(s=>validIncomingName(s.name));
  const tmap=new Map();
  for(const t of teachers){
    if(!validIncomingName(t.name))continue;
    const k=normalize(t.name)+'|'+normalize(t.birthday);
    if(!tmap.has(k))tmap.set(k,t);
    else{const cur=tmap.get(k);for(const f of ['role','birthday','phone','emergencyPhone','memo'])if(!cur[f]&&t[f])cur[f]=t[f];}
  }
  teachers=[...tmap.values()];
  if(!students.length&&!teachers.length)throw new Error('학생 또는 교사 이름을 찾지 못했습니다.');
  ui.importMode='update';
  ui.importPreview={students,teachers,sheets,stats:analyzeIncoming(students),filename:file.name};
  ui.modal={type:'import'};render();
}catch(e){alert(`가져오기에 실패했습니다.\n${e.message||e}`);}}

async function handleTeacherExcel(file){
  try{
    let teachers=[],sheets=[];
    if(file.name.toLowerCase().endsWith('.csv')){
      const matrix=parseCsv(await file.text()); teachers=parseTeacherMatrix(matrix); sheets=['CSV'];
    }else{
      if(typeof XLSX==='undefined')throw new Error('Excel 읽기 모듈이 아직 준비되지 않았습니다. 인터넷 연결 후 앱을 한 번 다시 열어 주세요.');
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true}); sheets=wb.SheetNames;
      for(const sn of wb.SheetNames){const matrix=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false}); teachers.push(...parseTeacherMatrix(matrix));}
    }
    const map=new Map();
    for(const t of teachers){if(!validIncomingName(t.name))continue;const k=normalize(t.name)+'|'+normalize(t.birthday);if(!map.has(k))map.set(k,t);else{const cur=map.get(k);for(const f of ['role','birthday','phone','emergencyPhone','memo'])if(!cur[f]&&t[f])cur[f]=t[f];}}
    teachers=[...map.values()]; if(!teachers.length)throw new Error('교사 이름을 찾지 못했습니다. 표 위쪽에 성함/이름, 연락처, 생일, 비고 같은 제목이 있는지 확인해 주세요.');
    ui.importMode='update'; ui.importPreview={students:[],teachers,sheets,stats:{newCount:0,updateCount:0,unchangedCount:0,missingCount:0},filename:file.name,teacherOnly:true}; ui.modal={type:'import'}; render();
  }catch(e){alert(`교사 명부 가져오기에 실패했습니다.\n${e.message||e}`);}
}
function confirmImport(){
  const incoming=ui.importPreview?.students||[]; const incomingTeachers=ui.importPreview?.teachers||[]; if(!incoming.length&&!incomingTeachers.length)return;
  const mode=ui.importPreview?.teacherOnly?'update':(ui.importMode||'update');
  const modeLabel=ui.importPreview?.teacherOnly?'교사 Excel 가져오기':({update:'Excel 업데이트',newonly:'새 학생 추가',replace:'명단 교체'}[mode]||'Excel 가져오기');
  createSnapshot(`${modeLabel} 전`);pushUndo();
  let added=0,updated=0,unchanged=0,deactivated=0,teacherAdded=0,teacherUpdated=0;
  const matched=new Set();
  for(const n of incoming){
    let st=resolveStudent({id:'',name:n.name,grade:n.grade,birthday:n.birthday});
    if(st){
      matched.add(st.id);
      if(mode==='newonly'){unchanged++;continue;}
      const before=JSON.stringify(comparableFields().map(k=>st[k]||''));
      for(const k of comparableFields())if(n[k])st[k]=n[k];
      st.active=true;
      const after=JSON.stringify(comparableFields().map(k=>st[k]||''));
      before===after?unchanged++:updated++;
    }else{
      let id=stableStudentId(n);if(studentById(id))id=uid('stu');
      state.students.push({id,...n,teams:[],photo:null,active:true});matched.add(id);added++;
    }
  }
  if(mode==='replace'){
    for(const st of active())if(!matched.has(st.id)){st.active=false;deactivated++;}
  }
  for(const n of incomingTeachers){let t=resolveIncomingTeacher(n);if(t){if(mode!=='newonly'){for(const f of ['role','birthday','phone','emergencyPhone','memo'])if(n[f])t[f]=n[f];t.active=true;teacherUpdated++;}}else{state.teachers.push({id:uid('tea'),...blankTeacher(),...n,active:true});teacherAdded++;}}
  save();ui.importPreview=null;ui.modal=null;
  toast(`학생 신규 ${added} · 업데이트 ${updated}${deactivated?` · 비활성 ${deactivated}`:''}${teacherAdded||teacherUpdated?` · 교사 ${teacherAdded+teacherUpdated}`:''}`);render();
}

function exportWorkbook(kind){
  let rows=[],filename='교회학교';
  if(kind==='students'){filename='학생명단';rows=[['이름','학년','성별','생일','학생전화','보호자1','관계1','보호자1연락처','보호자2','관계2','보호자2연락처','학교','형제관계','주소','기타']];active().forEach(s=>rows.push([s.name,s.grade,s.gender,s.birthday,s.phone,s.parentName,s.parentRelation||'',s.parentPhone,s.parent2Name||'',s.parent2Relation||'',s.parent2Phone||'',s.school,s.siblings,s.address,s.memo]));}
  if(kind==='attendance'){filename='출석기록';rows=[['날짜','학생ID','이름','학년','상태','메모']];Object.keys(state.sessions).sort().forEach(k=>Object.entries(state.sessions[k].attendance||{}).forEach(([id,a])=>{const s=studentById(id);if(s)rows.push([k,id,s.name,s.grade,statusLabel(a.status),a.memo||'']);}));}
  if(kind==='talent'){filename='달란트기록';rows=[['날짜','시간','기록ID','학생ID','이름','학년','유형','금액','기본금액','배수','리셋전잔액']];Object.keys(state.sessions).sort().forEach(k=>(state.sessions[k].transactions||[]).forEach(t=>(t.studentIds||[]).forEach(id=>{const s=studentById(id);if(s)rows.push([k,t.time,t.id,id,s.name,s.grade,t.kind==='reset'?'리셋':t.amount<0?'차감':'지급',t.amount,t.base,t.multiplier,t.kind==='reset'?(t.resetFrom?.[id]??''):'']);})));}
  if(kind==='teachers'){filename='교사명단_출석';rows=[['교사ID','이름','담당','생일','전화번호','비상연락처','비고']];activeTeachers().forEach(t=>rows.push([t.id,t.name,t.role,t.birthday||'',t.phone,t.emergencyPhone||'',t.memo]));rows.push([]);rows.push(['날짜','교사ID','이름','상태','사유']);Object.keys(state.teacherSessions).sort().forEach(k=>Object.entries(state.teacherSessions[k].attendance||{}).forEach(([id,a])=>{const t=teacherById(id);if(t)rows.push([k,id,t.name,teacherStatusLabel(a.status),a.reason||'']);}));}
  if(typeof XLSX!=='undefined'){const ws=XLSX.utils.aoa_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,filename.slice(0,31));XLSX.writeFile(wb,`${filename}_${todayKey()}.xlsx`);}else{const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');download(`${filename}_${todayKey()}.csv`,csv,'text/csv;charset=utf-8');}
}

function toast(msg){const old=document.getElementById('toast');if(!old)return;old.textContent=msg;old.classList.add('show');setTimeout(()=>old.classList.remove('show'),1700);}
async function setupSW(){if(!('serviceWorker' in navigator)||location.protocol==='file:')return;try{const reg=await navigator.serviceWorker.register('./sw.js');reg.update().catch(()=>{});let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)return;refreshing=true;location.reload();});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{});});}catch(e){console.warn(e);}}

document.getElementById('excelImport').addEventListener('change',e=>{const f=e.target.files[0];if(f)handleExcel(f);e.target.value='';});
document.getElementById('teacherExcelImport').addEventListener('change',e=>{const f=e.target.files[0];if(f)handleTeacherExcel(f);e.target.value='';});
document.getElementById('backupImport').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const x=migrate(JSON.parse(await f.text()));if(!x.students||!x.sessions)throw new Error('올바른 백업이 아닙니다.');if(confirm('현재 데이터를 이 백업으로 교체할까요?')){state=x;save();location.reload();}}catch(err){alert(err.message);}e.target.value='';});
document.getElementById('shareImport').addEventListener('change',e=>{if(e.target.files.length)readShareFiles([...e.target.files]);e.target.value='';});
document.getElementById('baseDataImport').addEventListener('change',e=>{const f=e.target.files[0];if(f)importBaseDataFile(f);e.target.value='';});
document.getElementById('photoImport').addEventListener('change',e=>{const f=e.target.files[0];if(!f||!ui.photoStudentId)return;const r=new FileReader();r.onload=()=>{const s=studentById(ui.photoStudentId);if(s){pushUndo();s.photo=r.result;save();ui.modal={type:'detail',id:s.id};render();}};r.readAsDataURL(f);e.target.value='';});
window.addEventListener('load',setupSW);
render();
