/* v1.5.2.3 — TALENT ONLY HOTFIX
   Scope intentionally limited to:
   1) talent amount-button colors
   2) automatic return to + mode after one successful deduction
*/
(function(){
  const style=document.createElement('style');
  style.id='v1523-talent-only-style';
  style.textContent=`
    .talentPanel .money:not(.minus):not(.mult){
      background:#FFD21F!important;
      color:#111!important;
      border:2px solid #111!important;
      min-height:58px!important;
      font-size:18px!important;
      font-weight:950!important;
      box-shadow:none!important;
    }
    .talentPanel .money:not(.minus):not(.mult):active{
      background:#F1C400!important;
      color:#111!important;
    }
    .talentPanel .money.minus{
      background:#111!important;
      color:#FFF!important;
      border:2px solid #111!important;
      min-height:58px!important;
      font-size:18px!important;
      font-weight:950!important;
      box-shadow:none!important;
    }
    .talentPanel .money.minus:active{
      background:#000!important;
      color:#FFF!important;
    }
    .talentPanel .money.mult{
      background:#FFF!important;
      color:#111!important;
      border:1.5px solid #111!important;
      font-weight:900!important;
    }
    .talentPanel .money.mult:disabled{
      background:#FFF!important;
      color:#B8B8B8!important;
      border-color:#C9C9C9!important;
      opacity:1!important;
    }
  `;
  document.head.appendChild(style);

  if(typeof addTalent==='function'){
    const originalAddTalent=addTalent;
    addTalent=function(base){
      const wasMinus=ui.sign<0;
      let before=0;
      try{ before=(ensureSession().transactions||[]).length; }catch(e){}
      const result=originalAddTalent(base);
      let after=before;
      try{ after=(ensureSession().transactions||[]).length; }catch(e){}

      // Only after a transaction was actually recorded.
      if(wasMinus && after>before){
        ui.sign=1;
        // The original function normally renders already; this final render
        // guarantees the visible controls return to + mode after deduction.
        setTimeout(()=>{ try{ render(); }catch(e){} },0);
      }
      return result;
    };
  }
})();
