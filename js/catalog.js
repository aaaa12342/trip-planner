/* Searchable catalog and structural knowledge-base audit. */
(function (global) {
  'use strict';
  function cities() { return Object.assign({}, global.CITY_EXTRA, global.CITY_RICH, global.DEST_DB); }
  function names() { return Array.from(new Set(Object.keys(cities()).concat(Object.keys(global.SCENIC || {})))).sort(function (a,b) { return a.localeCompare(b, 'zh-CN'); }); }
  function audit() {
    var errors = [], warnings = [], counts = { cities: 0, scenic: 0, stays: 0, attractions: 0 };
    var cityMap = cities();
    function point(value, label) { if (!TripCore.validPoint(value)) errors.push(label + '：坐标无效'); }
    Object.keys(cityMap).forEach(function (key) {
      var city = cityMap[key]; counts.cities++; point(city, key);
      if (city.name !== key) errors.push(key + '：名称与键不一致');
      if (['city','historic','coastal','beach','mountain','oldtown'].indexOf(city.type) < 0) errors.push(key + '：目的地类型无效');
      if (!Array.isArray(city.attractions) || !Array.isArray(city.foods)) errors.push(key + '：景点或美食格式无效');
      var seen = new Set();
      (city.attractions || []).forEach(function (a) {
        counts.attractions++; point(a, key + '/' + a.name);
        if (!a.name || !a.duration || !a.desc) errors.push(key + '：景点缺少必要字段');
        if (seen.has(a.name)) errors.push(key + '：重复景点 ' + a.name);
        seen.add(a.name);
      });
    });
    Object.keys(global.SCENIC || {}).forEach(function (key) {
      var scenic = global.SCENIC[key]; counts.scenic++; point(scenic, key);
      if (!cityMap[scenic.parent]) warnings.push(key + '：所属城市 ' + scenic.parent + ' 未收录完整城市资料');
    });
    Object.keys(global.STAY_DATA || {}).forEach(function (key) {
      var stay = global.STAY_DATA[key]; counts.stays++;
      if (!cityMap[key]) errors.push(key + '：住宿城市不存在');
      ['stations', 'areas'].forEach(function (group) {
        if (!Array.isArray(stay[group])) errors.push(key + '：住宿字段 ' + group + ' 无效');
        else stay[group].forEach(function (item) { point(item, key + '/' + item.name); });
      });
    });
    Object.keys(global.SCENIC_ALIASES || {}).forEach(function (key) {
      if (!global.SCENIC[global.SCENIC_ALIASES[key]] && !cityMap[global.SCENIC_ALIASES[key]]) errors.push(key + '：景点别名目标不存在');
    });
    return { counts: counts, errors: errors, warnings: warnings };
  }
  global.TripCatalog = { names: names, cities: cities, audit: audit };
})(window);
