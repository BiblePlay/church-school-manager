/* v1.4 integrated patch — student care filters, contacts/visits, 2 distribution packs, admin dashboard */

// ---------- data migration ----------
function v14EnsureStudent(st){
  st.assignedTeacher ||= '';
  st.parentFaith ||= '미기재';
  if(st.multicultural===undefined) st.multicultural=false;
  st.tags = Array.isArray(st.tags) ? st.tags : String(st.tags||'').split(',').map(x=>x.trim()).filter(Boolean);
  st.visitLogs = Array.isArray(st.visitLogs) ? st.visitLogs : [];
  st.extraContacts = Array.isArray(st.extraContacts) ? st.extraContacts : [];
  // keep legacy fields; expose them as contact records in the UI without duplicating storage
  return st;
}
function v14EnsureTeacher(t){
  t.teacherType ||= '정교사';
  if(t.officialIncluded===undefined) t.officialIncluded=true;
  t.leave = t.leave && typeof t.leave==='object' ? t.leave : {enabled:false,reason:'',start:'',end:''};
  return t;
}
state.students.forEach(v14EnsureStudent);
state.teachers.forEach(v14EnsureTeacher);
state.importedTextIds = Array.isArray(state.importedTextIds)?state.importedTextIds:[];
state.settings.basePacketVersion = Number(state.settings.basePacketVersion||1);
save();

ui.studentFilters = ui.studentFilters || {grade:'전체',teacher:'전체',parentFaith:'전체',multicultural:'전체',tag:'전체',team:'전체',gender:'전체',longAbsent:'전체'};
ui.studentFilters.grade='전체'; ui.studentFilters.team='전체';
ui.dashboardRange = ui.dashboardRange || 6;

function v14StudentContacts(st){
  const out=[];
  if(st.phone) out.push({name:st.name,relation:'학생',phone:st.phone});
  if(st.parentPhone) out.push({name:st.parentName||'보호자 1',relation:st.parentRelation||'보호자',phone:st.parentPhone});
  if(st.parent2Phone) out.push({name:st.parent2Name||'보호자 2',relation:st.parent2Relation||'보호자',phone:st.parent2Phone});
  for(const c of st.extraContacts||[]) if(c?.phone) out.push({name:c.name||'기타 연락처',relation:c.relation||'가족/친척',phone:c.phone});
  return out;
}
function v14LastVisit(st){
  const logs=[...(st.visitLogs||[])].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  return logs[0]||null;
}
function v14FilterOptions(field){
  if(field==='teacher') return ['전체',...Array.from(new Set(active().map(s=>s.assignedTeacher).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ko'))];
  if(field==='parentFaith') return ['전체','신자','비신자','미기재'];
  if(field==='multicultural') return ['전체','다문화','일반/미기재'];
  if(field==='tag') return ['전체',...Array.from(new Set(active().flatMap(s=>s.tags||[]))).sort((a,b)=>a.localeCompare(b,'ko'))];
  if(field==='team') return ['전체',...allTeams()];
  if(field==='gender') return ['전체','남','여','미지정'];
  if(field==='longAbsent') return ['전체','장기 미출석','최근 출석'];
  return ['전체',...grades()];
}
function v14FilteredStudents(){
  // 담당 학년은 '기본 시작 범위'일 뿐 접근 제한이 아니다.
  // 학생 명부의 실제 데이터 원본은 항상 등록된 전체 활성 학생이다.
  let arr=active();
  const f=ui.studentFilters;
  // 학년/팀은 각 화면의 '보기' 선택기가 단일 기준이다.
  // 예전 고급 필터의 grade/team 값이 남아 있어도 목록을 다시 잘라내지 않는다.
  if(f.teacher!=='전체') arr=arr.filter(s=>(s.assignedTeacher||'')===f.teacher);
  if(f.parentFaith!=='전체') arr=arr.filter(s=>(s.parentFaith||'미기재')===f.parentFaith);
  if(f.multicultural!=='전체') arr=arr.filter(s=>f.multicultural==='다문화'?!!s.multicultural:!s.multicultural);
  if(f.tag!=='전체') arr=arr.filter(s=>(s.tags||[]).includes(f.tag));
  if(f.gender!=='전체') arr=arr.filter(s=>(s.gender||'미지정')===f.gender);
  if(f.longAbsent!=='전체') arr=arr.filter(s=>f.longAbsent==='장기 미출석'?longAbsenceInfo(s).long:!longAbsenceInfo(s).long);
  return sortStudents(arr,state.settings.studentSort||'name');
}
function v14AppliedFilterCount(){ return Object.entries(ui.studentFilters).filter(([k,v])=>!['grade','team'].includes(k)&&v&&v!=='전체').length; }
function v14VisitGapDays(st){
  const last=v14LastVisit(st); if(!last?.date)return null;
  return Math.max(0,Math.floor((new Date(`${todayKey()}T12:00:00`)-new Date(`${last.date}T12:00:00`))/86400000));
}

// ---------- stronger students page ----------
const __v13StudentsView = studentsView;
studentsView = function(){
  const list=v14FilteredStudents();
  const fcount=v14AppliedFilterCount();
  const longN=list.filter(s=>longAbsenceInfo(s).long).length;
  const month=new Date().getMonth()+1;
  const birthN=list.filter(s=>Number(String(s.birthday||'').slice(5,7))===month).length;
  return `<section class="studentHero"><div><small>학생 관리</small><strong>${list.length}<span>명</span></strong></div><div class="studentHeroStats"><span>장기 미출석 <b>${longN}</b></span><span>${month}월 생일 <b>${birthN}</b></span></div></section>
    <div class="studentActionGrid"><button class="primary" data-act="addStudent">+ 학생 추가</button><button class="contrastBtn" data-act="studentFilter">필터${fcount?` · ${fcount}`:''}</button><button class="contrastBtn" data-act="manageStudentList">명단 정리</button></div>
    <div class="sortBar strongSort"><span>정렬</span>${[['name','가나다'],['grade','학년']].map(([v,l])=>`<button class="sortBtn ${state.settings.studentSort===v?'active':''}" data-stu-sort="${v}">${l}</button>`).join('')}</div>
    ${fcount?`<div class="filterSummary"><strong>필터 ${fcount}개 적용</strong><span>${list.length}명만 표시 중</span><button data-act="clearStudentFilters">전체 보기</button></div>`:''}
    <div class="list">${list.map(st=>{const lv=v14LastVisit(st);return `<button class="studentRow ${st.photo?'hasPhoto':'noPhoto'}" data-detail="${st.id}">${avatarCell(st)}<span><span class="studentName">${esc(st.name)}</span><span class="studentMeta">${esc(st.grade||'학년 미지정')}${st.assignedTeacher?' · '+esc(st.assignedTeacher):''}${st.parentFaith&&st.parentFaith!=='미기재'?' · 부모 '+esc(st.parentFaith):''}</span>${lv?`<span class="visitMini">최근 ${esc(lv.date.slice(5).replace('-','/'))} · ${esc((lv.note||'심방').slice(0,22))}</span>`:''}</span><span class="amount">${fmt(totalAmt(st.id))}<small>달란트</small></span></button>`}).join('')||'<div class="empty">조건에 맞는 학생이 없습니다.</div>'}</div>
    <div class="divider"></div>
    <div class="studentQuickCards"><button class="quickDark" data-act="birthdayList"><strong>월별 생일자</strong><small>생일 자동 분류</small></button><button class="quickYellow" data-act="manageTeachers"><strong>교사 명부</strong><small>전화 · 문자 바로 연결</small></button></div>`;
};

// ---------- admin dashboard ----------
function v14MonthKeys(count=6){
  const now=new Date(`${ui.date}T12:00:00`), out=[];
  for(let i=count-1;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }
  return out;
}
function v14MonthStats(scope='전체',count=6){
  const months=v14MonthKeys(count); const list=scope==='전체'?active():scope==='내 담당'?scopedStudents('내 담당'):active().filter(s=>s.grade===scope);
  return months.map(m=>{
    const dates=Object.keys(state.sessions).filter(k=>k.startsWith(m)&&Object.keys(state.sessions[k]?.attendance||{}).length).sort();
    let denom=0,present=0,talent=0;
    dates.forEach(k=>{list.forEach(st=>{if(state.sessions[k]?.attendance?.[st.id]){denom++;if(att(st,k).present)present++;}});talent+=(state.sessions[k]?.transactions||[]).reduce((sum,t)=>sum+Number(t.amount||0)*(t.studentIds||[]).filter(id=>list.some(s=>s.id===id)).length,0);});
    return {month:Number(m.slice(5)),label:`${Number(m.slice(5))}월`,rate:denom?Math.round(present/denom*100):0,talent,services:dates.length};
  });
}
function v14LineChart(stats){
  const w=330,h=135,p=24; const maxY=100; const step=(w-p*2)/Math.max(1,stats.length-1);
  const pts=stats.map((d,i)=>[p+i*step,h-p-(d.rate/maxY)*(h-p*2)]);
  const poly=pts.map(x=>x.join(',')).join(' ');
  return `<div class="chartWrap"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="월별 출석률 그래프"><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" class="chartAxis"/><line x1="${p}" y1="${p}" x2="${p}" y2="${h-p}" class="chartAxis"/><line x1="${p}" y1="${h-p-(50/maxY)*(h-p*2)}" x2="${w-p}" y2="${h-p-(50/maxY)*(h-p*2)}" class="chartGrid"/><polyline points="${poly}" class="chartLine"/>${pts.map((pt,i)=>`<circle cx="${pt[0]}" cy="${pt[1]}" r="4" class="chartDot"/><text x="${pt[0]}" y="${h-5}" text-anchor="middle" class="chartLabel">${stats[i].label}</text><text x="${pt[0]}" y="${Math.max(13,pt[1]-8)}" text-anchor="middle" class="chartValue">${stats[i].rate}%</text>`).join('')}</svg></div>`;
}
function v14DashboardHtml(){
  const scope=ui.analyticsScope||'전체'; const stats=v14MonthStats(scope,ui.dashboardRange||6);
  const recent=stats[stats.length-1]||{rate:0,talent:0,services:0};
  const gs=(state.settings.adminMode?grades():state.settings.managedGrades||[]);
  const focus=active().filter(st=>{const a=studentAnalytics(st,analyticsDates('최근 3개월'));return a.currentAbs>=2;}).length;
  return `<div class="dashboardTop"><div><small>임원 대시보드 · ${esc(scope)}</small><strong>${recent.rate}<span>%</span></strong><em>최근 월 출석률</em></div><div><b>${focus}</b><span>연속 결석 확인</span><b>${fmt(recent.talent)}</b><span>최근 월 달란트</span></div></div>
    <div class="dashboardCard"><div class="dashboardHead"><strong>월별 출석 흐름</strong><span>최근 ${ui.dashboardRange}개월</span></div>${v14LineChart(stats)}</div>
    <div class="gradeDash">${gs.map(g=>{const d=v14MonthStats(g,1)[0];const ss=active().filter(s=>s.grade===g);const long=ss.filter(s=>longAbsenceInfo(s).long).length;return `<button data-analytics-scope="${attr(g)}"><span>${esc(g)}</span><strong>${d?.rate||0}%</strong><small>${ss.length}명 · 장기 ${long}명</small></button>`}).join('')}</div>`;
}
const __v13RecordsView = recordsView;
recordsView = function(){
  const original=__v13RecordsView();
  if(!state.settings.adminMode) return original;
  return `<div class="recordsModeRow"><button class="dashLaunch" data-act="openDashboard">▣ 부서 현황</button></div>${original}`;
};

// ---------- packet export/import ----------
function v14MinimalStudent(st){ return {id:st.id,name:st.name,grade:st.grade||'',gender:st.gender||'',teams:clone(st.teams||[]),assignedTeacher:st.assignedTeacher||'',active:true}; }
function v14AdminStudent(st){ const x=clone(st); return x; }
function v14DistributionPacket(kind){
  ensureCustomOrder();
  const admin=kind==='care';
  state.settings.basePacketVersion=(state.settings.basePacketVersion||0)+1; save();
  return {
    schema:'church-school-base-v2', packetType:admin?'care-admin':'youth-basic', packetVersion:state.settings.basePacketVersion,
    createdAt:new Date().toISOString(), department:state.settings.department||'',
    students:active().map(st=>admin?v14AdminStudent(st):v14MinimalStudent(st)),
    teachers:activeTeachers().map(t=>({id:t.id,name:t.name,role:t.role||'',birthday:t.birthday||'',phone:t.phone||'',teacherType:t.teacherType||'정교사',officialIncluded:t.officialIncluded!==false,active:true})),
    teams:clone(state.teams||[]),
    settings:{amounts:clone(state.settings.amounts||[]),longAbsenceDays:Number(state.settings.longAbsenceDays||60),customStudentOrder:clone(state.settings.customStudentOrder||[])},
    privacy:admin?'학생 상세관리 정보 포함':'학생 연락처·보호자·주소·심방정보 제외'
  };
}
function v14ExportPack(kind){
  const p=v14DistributionPacket(kind); const label=kind==='care'?'임원_양육교사용':'청년교사용';
  download(`${state.settings.department||'교회학교'}_${label}_데이터팩_v${p.packetVersion}_${todayKey()}.json`,JSON.stringify(p,null,2),'application/json');
  toast(`${label} 데이터팩을 만들었습니다.`);
}
function v14MergeDefined(target,inc,allowed=null){
  for(const [k,v] of Object.entries(inc||{})){
    if(['id','active'].includes(k))continue;
    if(allowed && !allowed.includes(k))continue;
    if(v===undefined||v===null)continue;
    target[k]=clone(v);
  }
}
const __v13ImportBaseDataFile = importBaseDataFile;
importBaseDataFile = async function(file){
  try{
    const p=JSON.parse(await file.text());
    if(p.schema==='church-school-base-v1') return __v13ImportBaseDataFile(file);
    if(p.schema!=='church-school-base-v2'||!Array.isArray(p.students)) throw new Error('올바른 v2 데이터팩이 아닙니다.');
    const detailed=p.packetType==='care-admin';
    if(!confirm(`${detailed?'임원·양육교사용':'청년교사용'} 데이터팩 v${p.packetVersion||'?'}을 적용할까요?\n현재 출석·달란트·심방 기록은 유지하고 기본 명단만 업데이트합니다.`))return;
    createSnapshot('배포 데이터팩 적용 전'); pushUndo();
    let added=0,updated=0;
    for(const inc of p.students){
      let st=resolveStudent(inc);
      if(!st){ st={id:inc.id&&!studentById(inc.id)?inc.id:uid('stu'),teams:[],photo:null,active:true}; state.students.push(st); added++; }
      const allowed=detailed?null:['name','grade','gender','teams','assignedTeacher'];
      v14MergeDefined(st,inc,allowed); st.active=true; v14EnsureStudent(st); updated++;
    }
    for(const inc of p.teachers||[]){let t=resolveTeacher(inc);if(!t){t={id:inc.id&&!teacherById(inc.id)?inc.id:uid('tea'),active:true};state.teachers.push(t);}v14MergeDefined(t,inc);t.active=true;v14EnsureTeacher(t);}
    if(Array.isArray(p.teams))state.teams=clone(p.teams);
    if(p.settings?.amounts)state.settings.amounts=clone(p.settings.amounts);
    if(p.settings?.longAbsenceDays)state.settings.longAbsenceDays=p.settings.longAbsenceDays;
    save(); toast(`데이터팩 적용 완료 · 신규 ${added}명`); render();
  }catch(e){alert(`데이터팩 가져오기에 실패했습니다.\n${e.message||e}`);}
};

// ---------- visit logs ----------
function v14AddVisit(id,quick=false){
  const st=studentById(id); if(!st)return;
  const date=document.getElementById('visitDate')?.value||todayKey();
  const note=quick?'심방':(document.getElementById('visitMemo')?.value||'').trim();
  if(!note)return toast('심방 또는 연락 내용을 입력해 주세요.');
  pushUndo(); st.visitLogs ||= []; st.visitLogs.unshift({id:uid('visit'),date,note,createdAt:new Date().toISOString()}); save(); ui.modal={type:'detail',id}; toast(`${date} 기록을 저장했습니다.`); render();
}
function v14DeleteVisit(stId,visitId){const st=studentById(stId);if(!st)return;if(!confirm('이 심방/연락 기록을 삭제할까요?'))return;pushUndo();st.visitLogs=(st.visitLogs||[]).filter(x=>x.id!==visitId);save();render();}

// ---------- teacher leave ----------
function v14TeacherOnLeave(t,k=ui.date){
  const L=t.leave||{}; if(!L.enabled)return false;
  if(L.start && k<L.start)return false; if(L.end && k>L.end)return false; return true;
}
const __v13TeacherAttendanceView=teacherAttendanceView;
teacherAttendanceView=function(){
  const all=activeTeachers(); const target=all.filter(t=>!v14TeacherOnLeave(t)); const leave=all.filter(t=>v14TeacherOnLeave(t)); const c=teacherAttendanceCounts(target); const present=c.present;
  return `${dateControl()}<div class="seg"><button class="segBtn" data-attmode="student">학생</button><button class="segBtn active" data-attmode="teacher">교사</button></div>
    <div class="attendanceSummary attendanceSummaryStrong"><div class="attendanceSummaryMain"><div><div class="label lightLabel">교사 출석</div><div class="attendanceBig"><strong>${present}</strong><span>/ ${target.length}명</span></div><div class="summarySub">전체 ${all.length} · 출석대상 ${target.length} · 장기부재 ${leave.length}</div></div><button class="shareAction" data-act="shareCurrentTeacherAttendance">공유</button></div><div class="attendanceBulk"><button class="primary" data-act="teacherSelectAll">전체 선택</button><button class="secondary darkSecondary" data-act="teacherClearAll">전체 해제</button></div></div>
    <div class="list">${target.map(t=>{const a=teacherAtt(t);return `<div class="attendanceRow"><div class="attendanceTop teacherTop"><button class="studentIdentity" data-teacher-detail="${t.id}"><span class="studentName">${esc(t.name)}</span><span class="studentMeta">${esc(t.role||'담당 미지정')} · ${esc(t.teacherType||'정교사')}</span></button><button class="attendanceToggle ${a.present?'active':''}" data-teacher-attendance-toggle="${t.id}">${a.present?'✓':'출석'}</button></div><div class="attendanceFlags"><button class="flagBtn ${a.late?'active':''}" data-teacher-flag="late" data-teacher="${t.id}">지각</button></div><div class="memoLine autoMemo"><input class="memo" data-teacher-reason="${t.id}" value="${attr(a.reason||'')}" placeholder="비고 · 결석/지각 사유"><span class="memoSaved" data-teacher-saved="${t.id}"></span></div></div>`}).join('')||'<div class="empty">출석 대상 교사가 없습니다.</div>'}</div>
    ${leave.length?`<div class="listSection"><strong>장기 부재</strong><small>출석 분모에서 제외</small></div><div class="list">${leave.map(t=>`<button class="teacherLeaveRow" data-teacher-detail="${t.id}"><strong>${esc(t.name)}</strong><span>${esc(t.leave.reason||'장기부재')}${t.leave.end?` · ~${esc(t.leave.end)}`:' · 종료일 없음'}</span></button>`).join('')}</div>`:''}`;
};
const __v13SetAllTeacherAttendance=setAllTeacherAttendance;
setAllTeacherAttendance=function(v){
  const list=activeTeachers().filter(t=>!v14TeacherOnLeave(t));if(!list.length)return toast('출석 대상 교사가 없습니다.');pushUndo();
  if(v){
    initializeTeacherAttendance(list);
    for(const t of list){const a=teacherAtt(t);writeTeacherAttendance(t.id,{...a,present:true});}
  }else{
    const sess=state.teacherSessions?.[ui.date];
    if(sess){for(const t of list)delete sess.attendance?.[t.id];cleanupTeacherAttendanceSession(ui.date);}
  }
  save();toast(v?`${list.length}명 교사 전체 출석 선택`:'교사 전체 출석을 해제했습니다.');render();
};

// ---------- settings stronger hierarchy ----------
const __v13SettingsView=settingsView;
settingsView=function(){
  let old=__v13SettingsView();
  const obsoleteStart='<div class="card"><div class="label">부서 기본 데이터</div>';
  const nextData='<div class="card"><div class="label">데이터</div>';
  const oi=old.indexOf(obsoleteStart), ni=old.indexOf(nextData);
  if(oi>=0&&ni>oi) old=old.slice(0,oi)+old.slice(ni);
  const first=`<section class="settingsHero"><small>처음 시작</small><strong>명단을 한 번만 넣으면 됩니다.</strong><p>Excel 또는 완성된 데이터팩을 가져오고, 이후에는 필요한 부분만 업데이트합니다.</p><div class="settingsHeroGrid"><button data-act="excelImport">학생 Excel</button><button data-act="teacherExcelImport">교사 Excel</button><button data-act="importBaseData">데이터팩 가져오기</button></div></section>`;
  const dist=`<section class="settingsSection contrastSection"><div class="settingsSectionHead"><span>배포 데이터팩</span><small>원본은 하나 · 내보낼 때 개인정보 범위만 다르게</small></div><div class="packetActionCard"><div class="packetActionText"><strong>임원·양육교사용</strong><small>학생 상세정보 · 연락처 · 심방관리 포함</small></div><button class="packetExportBtn" data-act="exportCarePack"><span aria-hidden="true">↓</span> 내보내기</button></div><div class="packetActionCard"><div class="packetActionText"><strong>청년교사용</strong><small>학생 최소명단 + 교사 연락처 · 학생 상세 개인정보 제외</small></div><button class="packetExportBtn" data-act="exportYouthPack"><span aria-hidden="true">↓</span> 내보내기</button></div><div class="packetHint">선택하는 메뉴가 아닙니다. 필요한 종류의 ‘내보내기’를 누르면 데이터팩 파일이 만들어집니다.</div></section>`;
  const merge=`<section class="settingsSection"><div class="settingsSectionHead"><span>받은 기록 합치기</span><small>다른 선생님이 카톡으로 보내준 출석·달란트 기록을 전체 기록에 합칩니다.</small></div><button class="contrastBtn fullBtn" data-act="pasteRecord">카톡 기록 붙여넣기</button></section>`;
  return first+dist+merge+old;
};

// ---------- modal overrides ----------
const __v13ModalHtml=modalHtml;
modalHtml=function(){
  const close=`<button class="icon" data-act="closeModal">×</button>`;
  if(ui.modal?.type==='studentFilters'){
    const f=ui.studentFilters;
    const row=(key,label)=>`<label class="filterField"><span>${label}</span><select class="input" data-filter-key="${key}">${v14FilterOptions(key).map(v=>`<option ${f[key]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">학생 필터</div><div class="muted">학년·팀은 화면의 ‘보기’에서 선택하고, 여기서는 추가 조건만 고릅니다.</div></div>${close}</div><div class="filterGrid">${row('teacher','담당교사')}${row('parentFaith','부모 신앙')}${row('multicultural','다문화')}${row('tag','기타 분류')}${row('gender','성별')}${row('longAbsent','출석 상태')}</div><div class="notice">학년·팀 선택과 중복되지 않습니다. 이 분류는 내부 관리용이며 출석·달란트 공유에는 포함되지 않습니다.</div><div class="grid2"><button class="secondary" data-act="clearStudentFilters">전체 해제</button><button class="primary" data-act="applyStudentFilters">필터 적용</button></div>`);
  }
  if(ui.modal?.type==='dashboard'){
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">부서 현황</div><div class="muted">월별 흐름과 학년별 상태를 한 화면에서 확인합니다.</div></div>${close}</div><div class="chips">${scopeOptionsWithManaged().map(v=>`<button class="chip ${ui.analyticsScope===v?'active':''}" data-analytics-scope="${attr(v)}">${esc(v)}</button>`).join('')}</div>${v14DashboardHtml()}`);
  }
  if(ui.modal?.type==='pasteRecord'){
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">카톡 기록 붙여넣기</div><div class="muted">이 앱에서 공유한 출석/달란트 문장을 그대로 복사해 붙여넣으세요.</div></div>${close}</div><textarea id="pasteRecordText" class="input textarea bigPaste" placeholder="카카오톡에서 메시지 전체 복사 → 여기에 붙여넣기"></textarea><div class="notice">학생 연락처·부모정보·주소 같은 상세정보는 공유문에 들어가지 않습니다.</div><button class="primary fullBtn" data-act="parsePastedRecord">내용 확인</button>`);
  }
  if(ui.modal?.type==='pastePreview'){
    const p=ui.modal.preview;
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">받은 기록 확인</div><div class="muted">합치기 전에 날짜와 인원을 확인합니다.</div></div>${close}</div><div class="card">${kv('종류',p.type==='attendance'?'출석':'달란트')}${kv('날짜',p.date)}${kv('범위',p.scope||'')}${kv('찾은 학생',`${p.matched}명`)}${kv('찾지 못한 이름',`${p.unknown.length}명`)}${p.duplicate?kv('중복','이미 가져온 기록'):''}</div>${p.unknown.length?`<div class="notice">찾지 못함: ${esc(p.unknown.join(', '))}</div>`:''}<button class="primary fullBtn" data-act="confirmPastedRecord" ${p.duplicate?'disabled':''}>${p.duplicate?'이미 반영됨':'기록 합치기'}</button>`);
  }
  if(ui.modal?.type==='studentForm'){
    const st=ui.modal.id?studentById(ui.modal.id):{name:'',grade:'',gender:'',birthday:'',phone:'',parentName:'',parentRelation:'',parentPhone:'',parent2Name:'',parent2Relation:'',parent2Phone:'',school:'',siblings:'',address:'',memo:'',assignedTeacher:'',parentFaith:'미기재',multicultural:false,tags:[],extraContacts:[]};
    v14EnsureStudent(st);
    const extras=(st.extraContacts||[]).map(c=>`${c.name||''}|${c.relation||''}|${c.phone||''}`).join('\n');
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${ui.modal.id?'학생 정보 수정':'학생 추가'}</div><div class="muted">처음에는 이름과 학년만 넣어도 됩니다. 나머지는 나중에 보완하세요.</div></div>${close}</div><div class="form"><div class="formGrid"><input id="fName" class="input" placeholder="이름 *" value="${attr(st.name)}"><input id="fGrade" class="input" placeholder="학년 *" value="${attr(st.grade)}"></div><div class="formGrid"><select id="fGender" class="input"><option ${!st.gender?'selected':''}>미지정</option><option ${st.gender==='남'?'selected':''}>남</option><option ${st.gender==='여'?'selected':''}>여</option></select><input id="fBirthday" class="input" type="date" value="${attr(st.birthday||'')}"></div><input id="fAssignedTeacher" class="input" placeholder="담당교사 (예: 김선생)" value="${attr(st.assignedTeacher||'')}"><div class="formGrid"><select id="fParentFaith" class="input"><option ${st.parentFaith==='미기재'?'selected':''}>미기재</option><option ${st.parentFaith==='신자'?'selected':''}>신자</option><option ${st.parentFaith==='비신자'?'selected':''}>비신자</option></select><select id="fMulticultural" class="input"><option value="no" ${!st.multicultural?'selected':''}>다문화 미체크</option><option value="yes" ${st.multicultural?'selected':''}>다문화</option></select></div><input id="fTags" class="input" placeholder="기타 분류 · 쉼표로 구분" value="${attr((st.tags||[]).join(', '))}"><div class="sectionMiniTitle">연락처</div><input id="fPhone" class="input" placeholder="학생 전화번호" value="${attr(st.phone||'')}"><div class="formGrid"><input id="fParentName" class="input" placeholder="보호자 1 이름" value="${attr(st.parentName||'')}"><input id="fParentRelation" class="input" placeholder="관계" value="${attr(st.parentRelation||'')}"></div><input id="fParentPhone" class="input" placeholder="보호자 1 전화번호" value="${attr(st.parentPhone||'')}"><div class="formGrid"><input id="fParent2Name" class="input" placeholder="보호자 2 이름" value="${attr(st.parent2Name||'')}"><input id="fParent2Relation" class="input" placeholder="관계" value="${attr(st.parent2Relation||'')}"></div><input id="fParent2Phone" class="input" placeholder="보호자 2 전화번호" value="${attr(st.parent2Phone||'')}"><label class="fieldLabel">기타 가족·친척 연락처<textarea id="fExtraContacts" class="input textarea" placeholder="한 줄에 이름|관계|전화번호\n예: 김할머니|외할머니|010-1234-5678">${esc(extras)}</textarea></label><div class="sectionMiniTitle">추가 정보</div><input id="fSchool" class="input" placeholder="학교" value="${attr(st.school||'')}"><input id="fSiblings" class="input" placeholder="형제관계" value="${attr(st.siblings||'')}"><input id="fAddress" class="input" placeholder="주소" value="${attr(st.address||'')}"><textarea id="fMemo" class="input textarea" placeholder="학생 기본 메모">${esc(st.memo||'')}</textarea><button class="primary fullBtn" data-act="saveStudent" data-id="${st.id||''}">저장</button>${ui.modal.id?`<button class="danger fullBtn" data-act="deactivateStudent" data-id="${st.id}">명단에서 제외</button>`:''}</div>`);
  }
  if(ui.modal?.type==='detail'){
    const st=studentById(ui.modal.id); if(!st)return '';
    v14EnsureStudent(st); const contacts=v14StudentContacts(st); const logs=[...(st.visitLogs||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const attendanceHistory=Object.keys(state.sessions).sort().reverse().filter(k=>state.sessions[k]?.attendance?.[st.id]).slice(0,12);
    return modal(`<div class="modalTitleRow"><div class="detailHead">${st.photo?avatar(st,'detailPhoto'):''}<div><div class="titleSmall">${esc(st.name)}</div><div class="muted">${esc(st.grade||'학년 미지정')}${st.assignedTeacher?' · '+esc(st.assignedTeacher):''}</div></div></div>${close}</div><div class="detailActions"><button class="primary nowrap" data-act="editStudent" data-id="${st.id}">정보 수정</button><button class="secondary nowrap" data-act="photo" data-id="${st.id}">${st.photo?'사진 변경':'사진 추가'}</button></div>
      <div class="careMeta"><span>부모 ${esc(st.parentFaith||'미기재')}</span>${st.multicultural?'<span>다문화</span>':''}${(st.tags||[]).map(x=>`<span>${esc(x)}</span>`).join('')}</div>
      <div class="card"><div class="sectionTitle">전화 · 문자</div>${contacts.map(c=>`<div class="contactPerson"><span><strong>${esc(c.name)}</strong><small>${esc(c.relation)}</small></span><b>${esc(c.phone)}</b><a href="tel:${phoneUri(c.phone)}">전화</a><a href="sms:${phoneUri(c.phone)}">문자</a></div>`).join('')||'<div class="muted">등록된 연락처가 없습니다.</div>'}</div>
      <div class="visitBox"><div class="visitBoxHead"><div><strong>심방 · 연락 기록</strong><small>메모를 남기면 날짜와 함께 자동으로 누적됩니다.</small></div><button class="quickVisit" data-act="quickVisit" data-id="${st.id}">오늘 심방 ✓</button></div><div class="visitEntry"><input id="visitDate" class="input" type="date" value="${todayKey()}"><textarea id="visitMemo" class="input textarea" placeholder="통화, 문자, 심방 내용"></textarea><button class="primary" data-act="addVisit" data-id="${st.id}">기록 추가</button></div>${logs.map(x=>`<div class="visitLog"><div><strong>${esc(x.date)}</strong><p>${esc(x.note||'')}</p></div><button data-act="deleteVisit" data-id="${st.id}" data-visit="${x.id}">삭제</button></div>`).join('')||'<div class="visitEmpty">아직 심방/연락 기록이 없습니다.</div>'}</div>
      <div class="card kvCard">${kv('생일',st.birthday)}${kv('학교',st.school)}${kv('형제관계',st.siblings)}${kv('주소',st.address)}${kv('메모',st.memo)}</div><div class="card"><div class="sectionTitle">최근 출석</div>${attendanceHistory.map(k=>`<div class="history"><span><strong>${displayDate(k)}</strong><small>${esc(att(st,k).memo||'')}</small></span><strong>${statusLabel(att(st,k).status)}</strong></div>`).join('')||'<div class="muted">출석 기록 없음</div>'}</div>`);
  }
  if(ui.modal?.type==='teacherForm'){
    const t=ui.modal.id?teacherById(ui.modal.id):{name:'',role:'',birthday:'',phone:'',emergencyPhone:'',memo:'',teacherType:'정교사',officialIncluded:true,leave:{enabled:false,reason:'',start:'',end:''}};v14EnsureTeacher(t);
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">${ui.modal.id?'교사 수정':'교사 추가'}</div></div>${close}</div><div class="form"><input id="tName" class="input" placeholder="이름" value="${attr(t.name)}"><input id="tRole" class="input" placeholder="담당/역할" value="${attr(t.role||'')}"><select id="tType" class="input">${['정교사','보조교사','교역자','스태프','기타'].map(v=>`<option ${t.teacherType===v?'selected':''}>${v}</option>`).join('')}</select><label class="checkLine"><input id="tOfficial" type="checkbox" ${t.officialIncluded!==false?'checked':''}> 공식 명단에 포함</label><label class="fieldLabel">생일<input id="tBirthday" class="input" type="date" value="${attr(t.birthday||'')}"></label><input id="tPhone" class="input" placeholder="전화번호" value="${attr(t.phone||'')}"><input id="tEmergencyPhone" class="input" placeholder="비상 연락처 · 선택" value="${attr(t.emergencyPhone||'')}"><textarea id="tMemo" class="input textarea" placeholder="비고">${esc(t.memo||'')}</textarea><div class="sectionMiniTitle">장기 부재</div><label class="checkLine"><input id="tLeaveEnabled" type="checkbox" ${t.leave.enabled?'checked':''}> 출석 대상에서 제외</label><input id="tLeaveReason" class="input" placeholder="사유 · 군복무/장기출장/휴직/해외체류" value="${attr(t.leave.reason||'')}"><div class="formGrid"><label class="fieldLabel">시작<input id="tLeaveStart" class="input" type="date" value="${attr(t.leave.start||'')}"></label><label class="fieldLabel">종료 · 선택<input id="tLeaveEnd" class="input" type="date" value="${attr(t.leave.end||'')}"></label></div><button class="primary fullBtn" data-act="saveTeacher" data-id="${t.id||''}">저장</button>${ui.modal.id?`<button class="secondary fullBtn" data-act="deactivateTeacher" data-id="${t.id}">명단에서 비활성화</button><button class="danger fullBtn" data-act="deleteTeacher" data-id="${t.id}">교사 완전 삭제</button>`:''}</div>`);
  }
  return __v13ModalHtml();
};

// ---------- student/teacher save overrides ----------
saveStudentForm=function(id){
  const name=document.getElementById('fName')?.value.trim(); if(!name)return toast('학생 이름을 입력해 주세요.');
  pushUndo(); let st=id?studentById(id):null; if(!st){st={id:uid('stu'),teams:[],photo:null,active:true};state.students.push(st);} v14EnsureStudent(st);
  const extras=String(document.getElementById('fExtraContacts')?.value||'').split(/\n+/).map(line=>{const [name,relation,phone]=line.split('|').map(x=>(x||'').trim());return {name,relation,phone};}).filter(x=>x.phone);
  Object.assign(st,{name,grade:normalizeGrade(document.getElementById('fGrade')?.value.trim()),gender:document.getElementById('fGender')?.value||'미지정',birthday:document.getElementById('fBirthday')?.value||'',assignedTeacher:document.getElementById('fAssignedTeacher')?.value.trim()||'',parentFaith:document.getElementById('fParentFaith')?.value||'미기재',multicultural:document.getElementById('fMulticultural')?.value==='yes',tags:String(document.getElementById('fTags')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),phone:document.getElementById('fPhone')?.value.trim()||'',parentName:document.getElementById('fParentName')?.value.trim()||'',parentRelation:document.getElementById('fParentRelation')?.value.trim()||'',parentPhone:document.getElementById('fParentPhone')?.value.trim()||'',parent2Name:document.getElementById('fParent2Name')?.value.trim()||'',parent2Relation:document.getElementById('fParent2Relation')?.value.trim()||'',parent2Phone:document.getElementById('fParent2Phone')?.value.trim()||'',extraContacts:extras,school:document.getElementById('fSchool')?.value.trim()||'',siblings:document.getElementById('fSiblings')?.value.trim()||'',address:document.getElementById('fAddress')?.value.trim()||'',memo:document.getElementById('fMemo')?.value.trim()||'',active:true});
  save();ui.modal={type:'detail',id:st.id};toast(id?'학생 정보를 수정했습니다.':'학생을 추가했습니다.');render();
};
saveTeacherForm=function(id){
  const name=document.getElementById('tName')?.value.trim();if(!name)return toast('교사 이름을 입력해 주세요.');pushUndo();let t=id?teacherById(id):null;if(!t){t={id:uid('tea'),active:true};state.teachers.push(t);}v14EnsureTeacher(t);
  Object.assign(t,{name,role:document.getElementById('tRole')?.value.trim()||'',teacherType:document.getElementById('tType')?.value||'정교사',officialIncluded:!!document.getElementById('tOfficial')?.checked,birthday:document.getElementById('tBirthday')?.value||'',phone:document.getElementById('tPhone')?.value.trim()||'',emergencyPhone:document.getElementById('tEmergencyPhone')?.value.trim()||'',memo:document.getElementById('tMemo')?.value.trim()||'',leave:{enabled:!!document.getElementById('tLeaveEnabled')?.checked,reason:document.getElementById('tLeaveReason')?.value.trim()||'',start:document.getElementById('tLeaveStart')?.value||'',end:document.getElementById('tLeaveEnd')?.value||''},active:true});save();ui.modal={type:'teachers'};render();
};

// ---------- deterministic paste merge ----------
function v14Hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
function v14FindStudentByName(name,scope=''){const candidates=active().filter(s=>normalize(s.name)===normalize(name));if(candidates.length===1)return candidates[0];if(scope&&scope!=='전체'){const x=candidates.find(s=>s.grade===scope);if(x)return x;}return candidates[0]||null;}
function v14ParsePasted(text){
  const raw=String(text||'').trim(); if(!raw)throw new Error('붙여넣은 내용이 없습니다.'); const lines=raw.split(/\r?\n/).map(x=>x.trim());
  const first=lines.find(Boolean)||''; const dm=first.match(/(20\d{2}-\d{2}-\d{2})/); const date=dm?dm[1]:todayKey();
  const scopeMatch=first.match(/·\s*([^·]+?)\s*(?:출석|달란트)/); const scope=scopeMatch?scopeMatch[1].trim():'전체'; const hash=v14Hash(raw);
  if(/출석/.test(first)||lines.includes('출석')){
    const idxP=lines.indexOf('출석'), idxA=lines.indexOf('결석'), idxN=lines.indexOf('비고');
    const namesP=idxP>=0&&lines[idxP+1]?lines[idxP+1].split(',').map(x=>x.trim()).filter(x=>x&&x!=='없음'):[];
    const namesA=idxA>=0&&lines[idxA+1]?lines[idxA+1].split(',').map(x=>x.trim()).filter(x=>x&&x!=='없음'):[];
    const notes={}; if(idxN>=0)for(const line of lines.slice(idxN+1)){const m=line.match(/^(.+?)\s*[—-]\s*(.+)$/);if(m)notes[m[1].trim()]=m[2].trim();}
    const rows=[]; const unknown=[]; for(const [names,present] of [[namesP,true],[namesA,false]])for(const n of names){const st=v14FindStudentByName(n,scope);if(st)rows.push({id:st.id,present,note:notes[n]||''});else unknown.push(n);}return {type:'attendance',date,scope,rows,matched:rows.length,unknown,hash,duplicate:state.importedTextIds.includes(hash),raw};
  }
  const rows=[],unknown=[]; for(const line of lines.slice(1)){const m=line.match(/^(.+?)\s+([+-]\d[\d,]*)$/);if(!m)continue;const st=v14FindStudentByName(m[1].trim(),scope);if(st)rows.push({id:st.id,amount:Number(m[2].replace(/,/g,''))});else unknown.push(m[1].trim());}return {type:'talent',date,scope,rows,matched:rows.length,unknown,hash,duplicate:state.importedTextIds.includes(hash),raw};
}
function v14ApplyPasted(p){if(!p||p.duplicate)return;if(!p.rows.length)return toast('합칠 기록이 없습니다.');createSnapshot('카톡 기록 합치기 전');pushUndo();if(p.type==='attendance'){for(const r of p.rows){const old=state.sessions[p.date]?.attendance?.[r.id]||{};if(!state.sessions[p.date])state.sessions[p.date]={attendance:{},transactions:[]};state.sessions[p.date].attendance[r.id]={present:r.present,late:/지각/.test(r.note),newcomer:/새친구/.test(r.note),status:r.present?'present':'absent',memo:r.note.replace(/(?:지각|새친구)(?:\s*·\s*)?/g,'').trim()};}}else{if(!state.sessions[p.date])state.sessions[p.date]={attendance:{},transactions:[]};for(const r of p.rows)state.sessions[p.date].transactions.push({id:uid('tx'),date:p.date,studentIds:[r.id],base:Math.abs(r.amount),multiplier:1,sign:r.amount<0?-1:1,amount:r.amount,time:new Date().toISOString(),reason:'카톡 기록 병합'});}state.importedTextIds.push(p.hash);save();ui.modal=null;toast('받은 기록을 합쳤습니다.');render();}

// human-share text now includes exact date for deterministic paste
shareCurrentAttendance=async function(){
  const list=attendanceScopeList(); const section=(group,label)=>{const present=group.filter(st=>att(st).present),absent=group.filter(st=>!att(st).present),notes=[];group.forEach(st=>{const a=att(st);const bits=[];if(a.late)bits.push('지각');if(a.newcomer)bits.push('새친구');if(a.memo)bits.push(a.memo);if(bits.length)notes.push(`${st.name} — ${bits.join(' · ')}`);});return [label,`오늘 출석 ${present.length} / 전체 ${group.length}명`,'','출석',present.map(s=>s.name).join(', ')||'없음','','결석',absent.map(s=>s.name).join(', ')||'없음',...(notes.length?['','비고',...notes]:[])];};
  let lines=[];if(ui.attendanceGrade==='전체'){lines=[`${ui.date} · 전체 출석`,''];for(const g of grades()){const group=list.filter(s=>s.grade===g);if(group.length)lines.push(...section(group,g),'');}}else lines=[`${ui.date} · ${ui.attendanceGrade} 출석`,'',...section(list,'').slice(1)];await nativeShare({title:`${ui.attendanceGrade} 출석`,text:lines.join('\n').trim()});
};
shareCurrentTalent=async function(){const list=filterStudents();const total=list.reduce((sum,st)=>sum+todayAmt(st.id),0);const lines=[`${ui.date} · ${ui.filterValue||'전체'} 달란트`,`현재 범위 총 ${fmt(total)}달란트`];list.filter(st=>todayAmt(st.id)!==0).forEach(st=>lines.push(`${st.name} ${todayAmt(st.id)>0?'+':''}${fmt(todayAmt(st.id))}`));await nativeShare({title:'달란트 현황',text:lines.join('\n')});};

// ---------- handler extension ----------
const __v13HandleAct=handleAct;
handleAct=function(act,b){
  if(act==='studentFilter'){ui.modal={type:'studentFilters'};return render();}
  if(act==='clearStudentFilters'){ui.studentFilters={grade:'전체',teacher:'전체',parentFaith:'전체',multicultural:'전체',tag:'전체',team:'전체',gender:'전체',longAbsent:'전체'};ui.modal=null;return render();}
  if(act==='applyStudentFilters'){document.querySelectorAll('[data-filter-key]').forEach(el=>ui.studentFilters[el.dataset.filterKey]=el.value);ui.modal=null;return render();}
  if(act==='openDashboard'){ui.modal={type:'dashboard'};return render();}
  if(act==='exportCarePack')return v14ExportPack('care');
  if(act==='exportYouthPack')return v14ExportPack('youth');
  if(act==='pasteRecord'){ui.modal={type:'pasteRecord'};return render();}
  if(act==='parsePastedRecord'){try{const p=v14ParsePasted(document.getElementById('pasteRecordText')?.value||'');ui.modal={type:'pastePreview',preview:p};return render();}catch(e){return alert(e.message||e);}}
  if(act==='confirmPastedRecord')return v14ApplyPasted(ui.modal?.preview);
  if(act==='quickVisit')return v14AddVisit(b.dataset.id,true);
  if(act==='addVisit')return v14AddVisit(b.dataset.id,false);
  if(act==='deleteVisit')return v14DeleteVisit(b.dataset.id,b.dataset.visit);
  return __v13HandleAct(act,b);
};

// Re-render once so the v1.4 views are active.
render();


// ---------- v1.4.1 teacher hard delete ----------
function v141DeleteTeacher(id){
  const t=teacherById(id); if(!t)return toast('삭제할 교사를 찾지 못했습니다.');
  if(!confirm(`${t.name} 교사를 완전히 삭제할까요?\n교사 명부와 교사 출석 기록에서 제거됩니다.`))return;
  createSnapshot('교사 완전 삭제 전'); pushUndo();
  state.teachers=state.teachers.filter(x=>x.id!==id);
  for(const k of Object.keys(state.teacherSessions||{})){
    if(state.teacherSessions[k]?.attendance) delete state.teacherSessions[k].attendance[id];
  }
  // 학생의 담당교사 문자열은 자동 삭제하지 않는다. 동명이인/표기 차이로 잘못 지워지는 것을 막고,
  // 필터에서만 더 이상 교사 명부 항목으로 잡히지 않게 한다.
  save(); ui.modal={type:'teachers'}; toast(`${t.name} 교사를 완전히 삭제했습니다.`); render();
}
const __v14HandleAct141=handleAct;
handleAct=function(act,b){
  if(act==='deleteTeacher') return v141DeleteTeacher(b.dataset.id);
  return __v14HandleAct141(act,b);
};
render();
