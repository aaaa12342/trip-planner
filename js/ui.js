/* Presentation-only helpers: inspiration shortcuts and section navigation. */
(function () {
  'use strict';
  function init() {
    document.querySelectorAll('.quick-routes button').forEach(function (button) {
      button.addEventListener('click',function () {
        var start=document.getElementById('startInput'),dest=document.getElementById('destInput');
        start.value=button.dataset.start;dest.value=button.dataset.dest;
        start.dispatchEvent(new Event('input',{bubbles:true}));dest.dispatchEvent(new Event('input',{bubbles:true}));
        document.getElementById('pickerTitle').scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      });
    });
    var links=document.querySelectorAll('.result-nav a');
    var pending=false;
    function updateNavigation() {
      pending=false;
      var active=links[0],closest=-Infinity;
      links.forEach(function (link) {
        var section=document.querySelector(link.hash);
        var top=section && section.getClientRects().length ? section.getBoundingClientRect().top : Infinity;
        if(top<=120 && top>closest) { active=link;closest=top; }
      });
      links.forEach(function (link) {
        if(link===active) link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
    }
    function scheduleNavigation() {
      if(!pending) { pending=true;requestAnimationFrame(updateNavigation); }
    }
    window.addEventListener('scroll',scheduleNavigation,{passive:true});
    window.addEventListener('resize',scheduleNavigation);
    updateNavigation();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
