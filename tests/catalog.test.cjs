const test=require('node:test'),assert=require('node:assert/strict'),load=require('./context.cjs');
test('knowledge base has valid coordinates, fields and associations',()=>{
  const result=load().TripCatalog.audit();console.log('Catalog: '+JSON.stringify(result.counts)+'; warnings='+result.warnings.length);assert.deepEqual(Array.from(result.errors),[]);
  assert.equal(result.counts.cities,220);assert.equal(result.counts.scenic,71);assert.equal(result.counts.stays,40);
});
test('duration parsing handles minutes, half hours, day ranges and hours',()=>{
  const p=load().TripPlanner;
  for(const [text,hours] of [['30分钟',0.5],['半小时',0.5],['1-2小时',2],['半天',4],['1天',8],['2天',16],['1.5小时',1.5]])assert.equal(p.durationHours(text),hours,text);
});

test('scenic aliases can resolve to a city',()=>{const c=load();assert.equal(c.findDestination('张家界国家森林公园').data.name,'张家界');});

test('supplemented cities resolve to four distinct local attractions',()=>{
  const c=load();
  for(const name of ['石家庄','太原','沈阳','大连','长春','合肥','南昌','福州']) {
    const city=c.findDestination(name).data;
    assert.equal(city.attractions.length,4,name);
    assert.equal(new Set(city.attractions.map(a=>a.name)).size,4,name);
    for(const a of city.attractions) {
      assert.ok(c.TripCore.validPoint(a),a.name);
      assert.ok(c.TripPlanner.durationHours(a.duration)>0,a.name);
      assert.ok(a.desc && a.highlights.length && a.get,a.name);
    }
  }
  assert.equal(c.TripCatalog.audit().counts.attractions,215);
});
