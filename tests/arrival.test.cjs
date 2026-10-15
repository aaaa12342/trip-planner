const test=require('node:test'),assert=require('node:assert/strict'),load=require('./context.cjs');
function fixture(c,mode='火车') {
  const attrs=[{name:'首站',lat:30,lng:120,duration:'1小时'},{name:'次站',lat:30,lng:120.2,duration:'1小时'}];
  return {inputs:{travelMode:mode,playMode:'公共交通',pace:'舒适'},destGeo:attrs[0],
    stay:{stations:[{name:'近首站',kind:'火车站',lat:30,lng:120},{name:'近次站',kind:'高铁站',lat:30,lng:120.2},{name:'机场',kind:'机场',lat:30,lng:120.05}]},
    schedule:{days:[{attractions:attrs,budget:5}],remaining:[]},arrivalStationIndex:null};
}
test('arrival ranking uses the approved 70/30 formula and actual first stop',()=>{
  const c=load(),s=fixture(c);let r=c.TripArrival.update(s);
  assert.equal(r.selected.station.name,'近首站');assert.equal(r.candidates.length,2);
  const candidate=r.candidates[0];assert.equal(candidate.distance,candidate.firstKm*0.7+candidate.avgKm*0.3);
  s.schedule.days[0].attractions.reverse();r=c.TripArrival.update(s);
  assert.equal(r.selected.station.name,'近次站');
});
test('airports and railway stations are separated and unknown high-speed service is labelled',()=>{
  const c=load(),s=fixture(c,'飞机');let r=c.TripArrival.update(s);
  assert.equal(r.candidates.length,1);assert.equal(r.selected.station.kind,'机场');
  s.inputs.travelMode='高铁';r=c.TripArrival.update(s);
  assert.equal(r.selected.station.name,'近次站');assert.equal(r.candidates[1].unconfirmed,true);
  s.stay.stations=s.stay.stations.filter(a=>a.kind!=='高铁站');r=c.TripArrival.update(s);
  assert.equal(r.selected.unconfirmed,true);
  s.inputs.travelMode='自驾';r=c.TripArrival.update(s);assert.equal(r.enabled,false);assert.equal(r.selected,null);
});
test('manual choice survives reordering and incompatible choices return to automatic',()=>{
  const c=load(),s=fixture(c);s.arrivalStationIndex=1;
  assert.equal(c.TripArrival.update(s).selected.station.name,'近次站');
  s.schedule.days[0].attractions.reverse();assert.equal(c.TripArrival.update(s).manual,true);
  s.inputs.travelMode='飞机';const r=c.TripArrival.update(s);
  assert.equal(s.arrivalStationIndex,null);assert.equal(r.selected.station.kind,'机场');
});
test('arrival travel replaces the first city-centre leg without accumulating on rerender',()=>{
  const c=load(),s=fixture(c,'飞机');s.stay.stations[2].lng=120.8;
  c.TripArrival.update(s);const hours=s.schedule.days[0].hours;
  assert.match(s.schedule.days[0].warning,/抵达站点/);
  c.TripArrival.update(s);assert.equal(s.schedule.days[0].hours,hours);
  assert.equal(c.TripJourney.days(s)[0].stops[0].transfer.from,'机场');
});
test('a later first visit is a reference transfer and does not invent an overnight station leg',()=>{
  const c=load(),s=fixture(c);s.schedule.days.unshift({attractions:[],budget:5});
  c.TripArrival.update(s);assert.equal(s.arrival.firstDay,1);
  assert.equal(s.schedule.days[0].hours,0);assert.equal(c.TripJourney.days(s)[1].stops[0].transfer,null);
});
test('missing stations, no visits and malformed points degrade without invented candidates',()=>{
  const c=load(),s=fixture(c);s.stay.stations=[];
  assert.match(c.TripArrival.update(s).notice,/暂无/);
  s.stay.stations=[{name:'错误',kind:'火车站',lat:NaN,lng:120}];assert.equal(c.TripArrival.update(s).candidates.length,0);
  s.schedule.days[0].attractions=[];assert.match(c.TripArrival.update(s).notice,/尚无/);
});
test('unplanned alternatives do not change the arrival ranking',()=>{
  const c=load(),s=fixture(c),before=c.TripArrival.update(s).selected.station.name;
  s.schedule.remaining=Array.from({length:15},()=>({name:'远方备选',lat:50,lng:100,duration:'1小时'}));
  assert.equal(c.TripArrival.update(s).selected.station.name,before);
  assert.equal(s.schedule.remaining.length,15);
});
test('lodging transport preference uses the selected station rather than the closest arbitrary hub',()=>{
  const c=load(),s=fixture(c);const areas=s.stay.stations.slice(0,2).map(a=>({...a,env:'商圈',desc:'商圈'}));
  const left=c.TripStay.score(areas,s.stay.stations,[s.destGeo],'火车','交通优先',s.stay.stations[0]);
  const right=c.TripStay.score(areas,s.stay.stations,[s.destGeo],'火车','交通优先',s.stay.stations[1]);
  assert.equal(left[0].area.name,'近首站');assert.equal(right[0].area.name,'近次站');
  assert.match(right[0].reason,/近次站/);
});
test('arrival choice round-trips, legacy documents default to auto, invalid references are rejected',()=>{
  const c=load(),city=c.findDestination('上海').data;
  const s={...fixture(c,'飞机'),inputs:{startName:'北京',destName:'上海',travelMode:'飞机',playMode:'公共交通',pace:'舒适',duration:'一天一夜',startDate:'2026-10-15',stayPreference:'景点便利'},
    attractions:city.attractions,selected:[],startGeo:c.findDestination('北京').data,destGeo:city,destData:city,stay:c.STAY_DATA['上海'],weather:{},generatedAt:'2026-10-15T00:00:00Z',arrivalStationIndex:2};
  s.schedule={days:[{attractions:[],budget:3}],remaining:[]};
  const data=c.TripStorage.snapshot(s);assert.equal(c.TripStorage.restore(data).arrivalStationIndex,2);
  const legacy={...data};delete legacy.arrivalStationIndex;assert.equal(c.TripStorage.restore(legacy).arrivalStationIndex,null);
  for(const invalid of [-1,99,'2',0])assert.throws(()=>c.TripStorage.parse(JSON.stringify({...data,arrivalStationIndex:invalid})));
});
