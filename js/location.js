/* Serial, cancellable location selection, so origin and destination never overlap dialogs. */
(function (global) {
  'use strict';
  var queue = Promise.resolve();
  function choose(name, candidates, signal) {
    function run() {
      if (signal.aborted) throw new DOMException('地点选择已取消', 'AbortError');
      return new Promise(function (resolve, reject) {
        var dialog = document.getElementById('locationDialog');
        var list = document.getElementById('locationChoices');
        var finished = false;
        function cleanup() {
          signal.removeEventListener('abort', abort);
          dialog.removeEventListener('cancel', cancel);
          document.getElementById('cancelLocationBtn').removeEventListener('click', cancel);
          if (dialog.open) dialog.close();
          list.replaceChildren();
        }
        function finish(candidate, error) {
          if (finished) return; finished = true; cleanup();
          if (error) reject(error); else resolve(candidate);
        }
        function abort() { finish(null, new DOMException('地点选择已取消', 'AbortError')); }
        function cancel(event) { event.preventDefault(); finish(null, new Error('地点选择已取消，请修改输入后重新生成。')); }
        document.getElementById('locationTitle').textContent = '请选择「' + name + '」的具体地点';
        list.replaceChildren();
        candidates.forEach(function (candidate) {
          var button = document.createElement('button'); button.type = 'button'; button.className = 'location-choice';
          button.textContent = [candidate.name, candidate.admin1, candidate.country].filter(Boolean).join(' · ') + '（' + candidate.lat.toFixed(3) + ', ' + candidate.lng.toFixed(3) + '）';
          button.addEventListener('click', function () { finish(candidate); }); list.appendChild(button);
        });
        signal.addEventListener('abort', abort, { once: true });
        dialog.addEventListener('cancel', cancel);
        document.getElementById('cancelLocationBtn').addEventListener('click', cancel);
        dialog.showModal(); list.firstElementChild.focus();
      });
    }
    var result = queue.then(run, run); queue = result.catch(function () {}); return result;
  }
  global.TripLocation = { choose: choose };
})(window);
