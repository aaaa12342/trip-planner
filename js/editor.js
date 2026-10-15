/* Local itinerary editing. All controls use catalog indices, never user-supplied HTML. */
(function (global) {
  'use strict';
  function render(state) {
    var escape = TripCore.escapeHTML;
    document.getElementById('editorWrap').innerHTML = state.attractions.map(function (a,id) {
      var dayIndex = state.schedule.days.findIndex(function (day) { return day.attractions.indexOf(a) >= 0; });
      var position = dayIndex < 0 ? -1 : state.schedule.days[dayIndex].attractions.indexOf(a);
      var options = '<option value="-1"' + (dayIndex < 0 ? ' selected' : '') + '>备选</option>';
      state.schedule.days.forEach(function (_,i) { options += '<option value="' + i + '"' + (i === dayIndex ? ' selected' : '') + '>第 ' + (i+1) + ' 天</option>'; });
      return '<div class="editor-row"><label><input type="checkbox" data-action="include" data-id="' + id + '"' + (state.selected.indexOf(id) >= 0 ? ' checked' : '') + '> ' + escape(a.name) + ' <small>' + escape(a.duration) + '</small></label>' +
        '<div class="editor-controls"><select data-action="day" data-id="' + id + '" aria-label="' + escape(a.name) + ' 安排日期">' + options + '</select>' +
        '<button type="button" data-action="up" data-id="' + id + '" aria-label="提前游览 ' + escape(a.name) + '"' + (position <= 0 ? ' disabled' : '') + '>上移</button>' +
        '<button type="button" data-action="down" data-id="' + id + '" aria-label="延后游览 ' + escape(a.name) + '"' + (dayIndex < 0 || position === state.schedule.days[dayIndex].attractions.length-1 ? ' disabled' : '') + '>下移</button></div></div>';
    }).join('') || '<p class="empty">暂无景点可调整。</p>';
  }
  function edit(state, id, action, value) {
    var attraction = state.attractions[id];
    if (!attraction) return;
    var dayIndex = state.schedule.days.findIndex(function (day) { return day.attractions.indexOf(attraction) >= 0; });
    if (action === 'include') {
      state.selected = state.selected.filter(function (index) { return index !== id; });
      if (value) state.selected.push(id);
      state.schedule = TripPlanner.plan(state.selected.map(function (index) { return state.attractions[index]; }), state.schedule.days.length, state.destGeo, state.inputs);
    } else if (action === 'day') {
      var target = Number(value);
      if (!Number.isInteger(target) || target < -1 || target >= state.schedule.days.length) return;
      state.schedule.days.forEach(function (day) { day.attractions = day.attractions.filter(function (a) { return a !== attraction; }); });
      if (state.selected.indexOf(id) < 0) state.selected.push(id);
      if (target >= 0) state.schedule.days[target].attractions.push(attraction);
    } else if (dayIndex >= 0 && (action === 'up' || action === 'down')) {
      var list = state.schedule.days[dayIndex].attractions, index = list.indexOf(attraction);
      var next = index + (action === 'up' ? -1 : 1);
      if (next < 0 || next >= list.length) return;
      list.splice(index,1); list.splice(next,0,attraction);
    }
    var planned = state.schedule.days.flatMap(function (day) { return day.attractions; });
    state.schedule.remaining = state.selected.map(function (index) { return state.attractions[index]; }).filter(function (a) { return planned.indexOf(a) < 0; });
    TripPlanner.recalculate(state.schedule,state.destGeo,state.inputs);
  }
  global.TripEditor = { render:render, edit:edit };
})(window);
