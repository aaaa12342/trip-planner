const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load(extra = {}) {
  const context = { console, setTimeout, clearTimeout, AbortController, DOMException, URLSearchParams, ...extra };
  context.window = context; vm.createContext(context);
  for (const name of ['core', 'planner', 'data', 'cities-rich', 'cities-extra', 'scenic', 'stay', 'weather']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8'), context);
  }
  return context;
}
test('untrusted text is escaped, including both quote types', () => {
  const c = load();
  assert.equal(c.TripCore.escapeHTML(`<img src=x onerror="alert('x')">&`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;');
  assert.equal(c.TripCore.escapeHTML(null), '');
});
test('coordinate validation rejects non-numbers and impossible coordinates', () => {
  const c = load();
  assert.equal(c.TripCore.validPoint({ lat: '30', lng: 120 }), false);
  assert.equal(c.TripCore.validPoint({ lat: 91, lng: 120 }), false);
  assert.equal(c.TripCore.distance({lat: 0,lng: 0}, {lat: 0,lng: 0}), 0);
});
test('five short stops span four days without losing any stop', () => {
  const c = load();
  const attrs = Array.from({length: 5}, (_, i) => ({name: 'stop'+i, lat: 30, lng: 120, duration: '1小时'}));
  const p = c.TripPlanner.plan(attrs, 4, attrs[0]);
  assert.equal(p.remaining.length, 0);
  assert.equal(p.days.filter(d => d.attractions.length).length, 4);
});
test('a full-day attraction occupies a middle day by itself', () => {
  const c = load();
  const city = c.findDestination('上海').data;
  const p = c.TripPlanner.plan(city.attractions, 3, city);
  const day = p.days.find(d => d.attractions.some(a => a.name === '上海迪士尼乐园'));
  assert.ok(day); assert.equal(day.attractions.length, 1);
  assert.equal(p.days.indexOf(day), 1);
  const short = c.TripPlanner.plan(city.attractions, 1, city);
  assert.ok(short.remaining.some(a => a.name === '上海迪士尼乐园'));
});
test('all curated city and scenic itineraries respect budgets, exclusivity, and source data', () => {
  const c = load();
  const names = new Set([...Object.keys(c.DEST_DB), ...Object.keys(c.CITY_RICH), ...Object.keys(c.CITY_EXTRA), ...Object.keys(c.SCENIC)]);
  let checks = 0;
  for (const name of names) {
    const city = c.findDestination(name).data;
    const before = JSON.stringify(city);
    for (let days = 1; days <= 6; days++) {
      const attrs = city.attractions || [];
      const p = c.TripPlanner.plan(attrs, days, city);
      const all = p.days.flatMap(d => d.attractions).concat(p.remaining);
      assert.equal(all.length, attrs.length, name);
      assert.equal(new Set(all).size, all.length, name);
      for (const day of p.days) {
        assert.ok(day.hours <= day.budget, name);
        if (day.attractions.some(a => c.TripPlanner.durationHours(a.duration) >= 8)) assert.equal(day.attractions.length, 1, name);
      }
      checks++;
    }
    assert.equal(JSON.stringify(city), before, name);
  }
  console.log('Validated ' + checks + ' city/scenic duration combinations');
});
test('travel forecast, not current weather, controls clothing and rain gear', () => {
  const c = load();
  const weather = {current:{temperature_2m: 35,weather_code: 0},daily:{time:['2026-10-08'],temperature_2m_min:[-8],temperature_2m_max:[2],weather_code:[73],precipitation_probability_max:[80],wind_speed_10m_max:[35]}};
  const clothing = c.TripWeather.recommendClothing(weather, 'city', 3);
  assert.match(clothing.upper, /厚羽绒服/);
  assert.match(clothing.accessory, /防滑雪地靴/);
  assert.match(clothing.accessory, /防风/);
  const items = c.TripWeather.recommendItems({weather,tripDays:3}).flatMap(cat => cat.items);
  assert.ok(items.includes('雨伞 / 雨衣'));
});
test('missing weather produces neutral advice without inventing a temperature', () => {
  const c = load();
  assert.match(c.TripWeather.recommendClothing({},'city',3).upper, /天气暂不可用/);
  const items = c.TripWeather.recommendItems({weather:{},tripDays:3}).flatMap(cat => cat.items);
  assert.ok(!items.includes('暖宝宝'));
});
test('successful JSON responses are cached without repeating requests', async () => {
  let calls = 0;
  const c = load({fetch: async () => { calls++; return {ok:true,json:async()=>({value:1})}; }});
  assert.equal((await c.TripCore.requestJSON('https://test/cache',{ttl:10000})).value,1);
  await c.TripCore.requestJSON('https://test/cache',{ttl:10000});
  assert.equal(calls,1);
});
test('a cancelled request rejects even if a fetch implementation ignores cancellation', async () => {
  let resolve;
  const c = load({fetch: () => new Promise(r => {resolve=r;})});
  const controller = new AbortController();
  const promise = c.TripCore.requestJSON('https://test/abort',{signal:controller.signal});
  controller.abort(); resolve({ok:true,json:async()=>({})});
  await assert.rejects(promise, e => e.name === 'AbortError');
});
test('timeouts are reported and failed requests are not cached', async () => {
  let calls = 0;
  const c = load({fetch: (_,opts) => {calls++; return new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));}});
  for(let i=0;i<2;i++) await assert.rejects(c.TripCore.requestJSON('https://test/timeout',{timeout:10,ttl:10000}), /请求超时/);
  assert.equal(calls,2);
});
test('already aborted signals also reject when a cache entry exists', async () => {
  const c=load({fetch:async()=>({ok:true,json:async()=>({})})});
  await c.TripCore.requestJSON('https://test/cache',{ttl:10000});
  const controller=new AbortController();controller.abort();
  await assert.rejects(c.TripCore.requestJSON('https://test/cache',{signal:controller.signal}),e=>e.name==='AbortError');
});
