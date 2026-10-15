/* Presentation-only helpers: inspiration shortcuts and section navigation. */
(function () {
  'use strict';
  function init() {
    var results=document.getElementById('results'),steps=document.querySelectorAll('.workflow-steps a');
    function markStep(number) {
      steps.forEach(function(link){if(link.dataset.step===String(number))link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});
    }
    function updateResults() {
      var link=document.querySelector('[data-step="3"]');
      link.setAttribute('aria-disabled',String(results.hidden));
      if(results.hidden)link.setAttribute('tabindex','-1');else link.removeAttribute('tabindex');
      if(!results.hidden)markStep(3);
      else if(link.hasAttribute('aria-current'))markStep(1);
    }
    document.getElementById('resetBtn').addEventListener('click',function(){markStep(1);});
    new MutationObserver(updateResults).observe(results,{attributes:true,attributeFilter:['hidden']});
    document.querySelectorAll('a[href="#tripSettings"]').forEach(function(link){link.addEventListener('click',function(){document.getElementById('tripSettings').open=true;markStep(2);});});
    steps.forEach(function(link){link.addEventListener('click',function(event){
      if(link.getAttribute('aria-disabled')==='true'){event.preventDefault();return;}
      markStep(link.dataset.step);
    });});
    document.querySelector('a[href="#savedPanel"]').addEventListener('click',function(){document.getElementById('savedDetails').open=true;});
    updateResults();
    document.querySelectorAll('.quick-routes button').forEach(function (button) {
      button.addEventListener('click',function () {
        var start=document.getElementById('startInput'),dest=document.getElementById('destInput');
        start.value=button.dataset.start;dest.value=button.dataset.dest;
        start.dispatchEvent(new Event('input',{bubbles:true}));dest.dispatchEvent(new Event('input',{bubbles:true}));
        document.getElementById('pickerTitle').scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      });
    });
    var links=document.querySelectorAll('.result-nav a');
    var preferredHash='';
    links.forEach(function(link){link.addEventListener('click',function(){preferredHash=link.hash;scheduleNavigation();});});
    var pending=false;
    function updateNavigation() {
      pending=false;
      var active=links[0],closest=-Infinity;
      links.forEach(function (link) {
        var section=document.querySelector(link.hash);
        if(link.hash==='#mapCard' && window.matchMedia('(min-width:1101px)').matches)section=document.getElementById('routeCard');
        var top=section && section.getClientRects().length ? section.getBoundingClientRect().top : Infinity;
        if(top<=120 && (top>closest || top===closest && link.hash===preferredHash)) { active=link;closest=top; }
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
