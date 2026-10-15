/* Rule-based itinerary: time budgets and nearby stops, without claiming live routing. */
(function (global) {
  'use strict';
  function durationHours(text) {
    text = String(text || '');
    if (/半小时/.test(text)) return 0.5;
    if (/半天/.test(text)) return 4;
    if (/一天|全天/.test(text)) return 8;
    var numbers = text.match(/\d+(?:\.\d+)?/g);
    if (!numbers) return 2;
    var value = Math.max.apply(null, numbers.map(Number));
    if (/分钟/.test(text)) value /= 60;
    else if (/天/.test(text)) value *= 8;
    return Math.min(48, Math.max(0.25, value));
  }

  function travelHours(a, b, playMode) {
    var km = TripCore.distance(a, b);
    var speed = playMode === '公共交通' ? 20 : 30;
    return km == null ? 0.5 : Math.max(0.25, km * 1.3 / speed);
  }
  function orderStops(stops, center, playMode) {
    var pending = stops.slice(), sorted = [], previous = center;
    while (pending.length) {
      pending.sort(function (a, b) { return travelHours(previous, a, playMode) - travelHours(previous, b, playMode); });
      previous = pending.shift(); sorted.push(previous);
    }
    return sorted;
  }
  function estimate(stops, center, playMode) {
    if (stops.length === 1 && durationHours(stops[0].duration) >= 8) return durationHours(stops[0].duration);
    var previous = center;
    return stops.reduce(function (hours, stop) {
      var total = hours + durationHours(stop.duration) + travelHours(previous, stop, playMode);
      previous = stop; return total;
    }, 0);
  }
  function plan(attractions, days, center, options) {
    options = options || {};
    var budgets = options.pace === '轻松' ? [3,4,6] : options.pace === '紧凑' ? [5,6,9] : [4,5,8];
    var buckets = Array.from({ length: days }, function (_, i) {
      return { attractions: [], hours: 0, budget: days === 1 ? budgets[0] : (i === 0 || i === days - 1 ? budgets[1] : budgets[2]) };
    });
    var remaining = [];
    // Reserve an entire middle day for full-day attractions.
    var ordered = attractions.map(function (a, i) { return { attraction: a, index: i, hours: durationHours(a.duration) }; })
      .sort(function (a, b) { return b.hours - a.hours || a.index - b.index; });
    ordered.forEach(function (entry) {
      var candidates = buckets.map(function (day, index) {
        if (day.attractions.some(function (a) { return durationHours(a.duration) >= 8; })) return null;
        if (entry.hours >= 8 && day.attractions.length) return null;
        var stops = orderStops(day.attractions.concat(entry.attraction), center, options.playMode);
        var hours = estimate(stops, center, options.playMode);
        if (hours > day.budget) return null;
        return { index: index, stops: stops, hours: hours,
          score: day.hours + (hours - day.hours - entry.hours) + day.attractions.length * 1.5 };
      }).filter(Boolean).sort(function (a, b) { return a.score - b.score || a.index - b.index; });
      if (!candidates.length) { remaining.push(entry.attraction); return; }
      var chosen = candidates[0];
      buckets[chosen.index].attractions = chosen.stops;
      buckets[chosen.index].hours = chosen.hours;
    });
    return { days: buckets, remaining: remaining };
  }
  function recalculate(schedule, center, options) {
    schedule.days.forEach(function (day) {
      day.hours = estimate(day.attractions, center, options.playMode);
      day.warning = day.hours > day.budget ? '超过当日时间预算，请减少景点或增加天数。' : '';
      if (day.attractions.length > 1 && day.attractions.some(function (a) { return durationHours(a.duration) >= 8; }))
        day.warning += '全天景点建议单独安排。';
    });
    return schedule;
  }
  global.TripPlanner = { plan: plan, durationHours: durationHours, travelHours:travelHours, recalculate: recalculate };
})(window);
