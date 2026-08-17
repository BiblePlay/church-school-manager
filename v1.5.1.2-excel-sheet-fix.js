/* v1.5.1.2 EXCEL SHEET CLASSIFICATION FIX
   UI FREEZE: only workbook sheet classification is corrected.
   - Grade sheets (4학년/5학년/6학년 etc.) are ALWAYS student sheets.
   - Teacher sheets are recognized only by teacher-specific sheet names or a clear teacher header row.
   - This prevents student registry sheets containing 이름/전화번호/생일 labels from being misclassified as teacher sheets.
*/
(function(){
  const oldTeacherSheetLikely = teacherSheetLikely;

  teacherSheetLikely = function(matrix, sheetName){
    const name = String(sheetName || '').trim();

    // A grade-labeled sheet is authoritative student data.
    // Examples: 4학년, 5학년부, 초4, 초등 6학년.
    if (sheetGrade(name) || /(?:^|\s)(?:초등?|초)?\s*[1-6]\s*(?:학년|학년부)(?:\s|$)/.test(name)) {
      return false;
    }

    // Explicit teacher sheet names are authoritative teacher data.
    if (/교사|선생|교역자|teacher|teachers/i.test(name)) {
      return true;
    }

    // For unnamed/mixed sheets, require a CLEAR teacher table header.
    // Do NOT classify merely because generic labels 이름 + 전화번호 + 생일 exist;
    // student registry blocks contain those labels too.
    for (let r = 0; r < Math.min(40, matrix.length); r++) {
      const row = (matrix[r] || []).map(v => String(v == null ? '' : v).trim());
      const normalized = row.map(v => normalize(v));

      const hasNo = normalized.some(v => ['no','번호','순번','연번'].includes(v));
      const hasTeacherName = normalized.some(v => ['성함','교사명','교사이름','선생님','선생님이름'].includes(v));
      const hasPhone = normalized.some(v => ['연락처','전화번호','휴대폰','핸드폰'].includes(v));
      const hasBirthday = normalized.some(v => ['생일','생년월일'].includes(v));
      const hasRole = normalized.some(v => ['담당','담당학년','역할','직책','부서'].includes(v));

      // User's teacher workbook/table commonly uses NO | 성함 | 연락처 | 생일.
      if (hasTeacherName && hasPhone && (hasNo || hasBirthday || hasRole)) return true;
    }

    return false;
  };

  // Diagnostic helper kept internal: makes future failures visible in console only.
  window.__v1512TeacherSheetLikely = teacherSheetLikely;
})();
