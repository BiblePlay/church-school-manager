/* v1.5.3.12 — narrow safe fix
   Scope ONLY:
   - Settings > 학년 관리: show grade names without student counts.
   No attendance/talent/student/team/data logic changes.
*/
(function(){
  'use strict';

  const priorGradeManagerCard_v15312 = gradeManagerCard;
  gradeManagerCard = function(){
    const gs = grades();
    return `<div class="card"><div class="row"><div><div class="label">학년 관리</div><div class="muted">겹친 학년 이름을 병합하거나 이름을 바꾸고 정리합니다.</div></div><button class="secondary nowrap" data-act="manageGrades">관리</button></div>${gs.length?`<div class="gradeSummary">${gs.map(g=>`<span class="pill">${esc(g)}</span>`).join('')}</div>`:''}</div>`;
  };

  const priorModalView_v15312 = modalView;
  modalView = function(){
    if(ui.modal?.type !== 'gradeManager') return priorModalView_v15312();
    const gs = grades();
    const close = `<button class="icon" data-act="closeModal" aria-label="닫기">×</button>`;
    return modal(`<div class="modalTitleRow"><div><div class="titleSmall">학년 관리</div><div class="muted">겹친 분류는 병합하고 필요 없는 분류는 정리합니다.</div></div>${close}</div><div class="list">${gs.map(g=>`<div class="gradeRow"><div><strong>${esc(g)}</strong></div><button class="smallText" data-grade-rename="${attr(g)}">이름변경</button><button class="smallText" data-grade-merge="${attr(g)}">병합</button><button class="smallText dangerText" data-grade-delete="${attr(g)}">삭제</button></div>`).join('')||'<div class="empty">학년 분류가 없습니다.</div>'}</div><div class="notice">삭제할 때 학생은 학년 미지정으로 남습니다. 학생 자체와 과거 출석·달란트 기록은 삭제되지 않습니다.</div>`);
  };
})();
