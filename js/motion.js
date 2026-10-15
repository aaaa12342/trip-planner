/* Optional GSAP presentation layer. Content stays usable without this library. */
(function () {
  'use strict';
  function init() {
    var gsap=window.gsap;
    if(!gsap || !gsap.matchMedia)return;
    var media=gsap.matchMedia();
    media.add({motion:'(prefers-reduced-motion: no-preference)',screen:'screen'},function(context) {
      if(!context.conditions.motion || !context.conditions.screen)return;
      var frame=0,pendingRecommendations=false,pendingResults=false,pendingRoute=false;
      var form=document.getElementById('plannerForm'),results=document.getElementById('results');
      var picker=document.getElementById('recommendedWrap'),route=document.getElementById('routeWrap');
      var active=new Set();
      function reveal(targets,from,options) {
        targets=gsap.utils.toArray(targets).filter(function(el){return el.isConnected && el.getClientRects().length;});
        if(!targets.length)return;
        gsap.killTweensOf(targets);
        var tween=gsap.fromTo(targets,from,Object.assign({duration:.32,ease:'power2.out',overwrite:true,
          clearProps:'transform,opacity',onComplete:function(){active.delete(tween);},
          onInterrupt:function(){active.delete(tween);}},options));
        active.add(tween);
      }
      context.add('intro',function() {
        // Only the small header is translated; sticky map/layout ancestors are untouched.
        reveal('.workspace-intro>div',{opacity:0,y:10},{duration:.42});
      });
      context.add('flush',function() {
        frame=0;
        if(pendingRecommendations)reveal(Array.from(picker.children).slice(0,8),{opacity:.45,y:8},{stagger:.035});
        if(!results.hidden && pendingResults) {
          reveal('.results-heading, .summary-item',{opacity:.35,y:10},{stagger:.035,duration:.38});
        } else if(!results.hidden && pendingRoute) {
          reveal(Array.from(route.querySelectorAll('.route-day')).slice(0,2),{opacity:.55,x:6},{duration:.26,stagger:.04});
        }
        pendingRecommendations=pendingResults=pendingRoute=false;
      });
      function schedule() { if(!frame)frame=requestAnimationFrame(context.flush); }
      var pickerObserver=new MutationObserver(function(){pendingRecommendations=true;schedule();});
      var resultObserver=new MutationObserver(function(){pendingResults=!results.hidden;schedule();});
      var routeObserver=new MutationObserver(function(){pendingRoute=true;schedule();});
      pickerObserver.observe(picker,{childList:true});
      resultObserver.observe(results,{attributes:true,attributeFilter:['hidden']});
      routeObserver.observe(route,{childList:true});
      context.add('selection',function(event) {
        var input=event.target;
        if(input.matches('#recommendedWrap input[type=checkbox]')) {
          reveal(input.closest('.recommended-stop'),{scale:.988},{duration:.2});
          reveal('#draftStops',{opacity:.45,y:3},{duration:.22});
        } else if(input.matches('.seg input[type=radio]')) {
          reveal(input.nextElementSibling,{scale:.96},{duration:.22});
        }
      });
      context.add('disclosure',function(event) {
        var details=event.target;
        if(!details.matches('details') || !details.open)return;
        // Native details owns visibility, keyboard behavior and focus; only animate opening content.
        reveal(Array.from(details.children).filter(function(el){return el.tagName!=='SUMMARY';}),
          {opacity:.4,y:5},{duration:.24});
      });
      context.add('step',function() {
        reveal('.workflow-steps [aria-current] span',{scale:.86},{duration:.24});
      });
      context.add('attraction',function(event) {
        var button=event.target.closest('.attr-head');
        if(button && button.getAttribute('aria-expanded')==='true') {
          reveal(button.closest('.attr-card').querySelector('.attr-body'),{opacity:.4,y:5},{duration:.24});
        }
      });
      var stepObserver=new MutationObserver(context.step);
      stepObserver.observe(document.querySelector('.workflow-steps'),{subtree:true,attributes:true,attributeFilter:['aria-current']});
      function finish() {
        active.forEach(function(tween){tween.progress(1);});active.clear();
      }
      form.addEventListener('change',context.selection);
      document.addEventListener('toggle',context.disclosure,true);
      document.addEventListener('click',context.attraction);
      window.addEventListener('beforeprint',finish);
      context.intro();
      return function() {
        cancelAnimationFrame(frame);
        pickerObserver.disconnect();resultObserver.disconnect();routeObserver.disconnect();stepObserver.disconnect();
        form.removeEventListener('change',context.selection);
        document.removeEventListener('toggle',context.disclosure,true);
        document.removeEventListener('click',context.attraction);
        window.removeEventListener('beforeprint',finish);
        active.clear();
      };
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
