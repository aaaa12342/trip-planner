/* Shared text safety and bounded, cancellable JSON requests. */
(function (global) {
  'use strict';
  var cache = new Map();
  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function abortError() { return new DOMException('请求已取消', 'AbortError'); }
  async function requestJSON(url, options) {
    options = options || {};
    var signal = options.signal;
    if (signal && signal.aborted) throw abortError();
    var hit = cache.get(url);
    if (hit && hit.expires > Date.now() && (!options.validate || options.validate(hit.data))) return hit.data;
    var controller = new AbortController();
    var abort = function () { controller.abort(); };
    if (signal) signal.addEventListener('abort', abort, { once: true });
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; controller.abort(); }, options.timeout || 12000);
    try {
      var response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('数据请求失败（' + response.status + '）');
      var data = await response.json();
      if (options.validate && !options.validate(data)) throw new Error('返回数据格式无效');
      if (signal && signal.aborted) throw abortError();
      if (timedOut) throw new Error('请求超时，请稍后重试');
      if (options.ttl) {
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(url, { data: data, expires: Date.now() + options.ttl });
      }
      return data;
    } catch (error) {
      if (signal && signal.aborted) throw abortError();
      if (timedOut) throw new Error('请求超时，请稍后重试');
      throw error;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', abort);
    }
  }
  function validPoint(point) {
    return point && Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
      Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
  }
  function distance(a, b) {
    if (!validPoint(a) || !validPoint(b)) return null;
    var radians = Math.PI / 180;
    var h = Math.sin((b.lat - a.lat) * radians / 2) ** 2 +
      Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin((b.lng - a.lng) * radians / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  }
  global.TripCore = { escapeHTML: escapeHTML, requestJSON: requestJSON, validPoint: validPoint, distance: distance };
})(window);
