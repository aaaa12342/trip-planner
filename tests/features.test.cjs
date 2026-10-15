const test=require('node:test'),assert=require('node:assert/strict'),load=require('./context.cjs');
test('transport suggestions match the chosen mode and preserve safe navigation endpoints',()=>{
  const c=load(),a={name:'起点 <x>',lat:30,lng:120},b={name:'终点 & y',lat:30.1,lng:120.1};
  const bus=c.TripJourney.transfer(a,b,'公共交通'),car=c.TripJourney.transfer(a,b,'自驾');
  assert.match(bus.mode,/公交/);assert.match(bus.detail,/暂无可靠/);assert.equal(car.mode,'自驾');
  assert.ok(bus.minutes>=car.minutes);
  const url=new URL(bus.url);assert.equal(url.searchParams.get('from'),'120,30,起点 <x>');
  assert.equal(url.searchParams.get('coordinate'),'wgs84');assert.equal(url.searchParams.get('mode'),'bus');
  const walk=c.TripJourney.transfer(a,{name:'附近',lat:30.001,lng:120.001},'公共交通');
  assert.equal(walk.mode,'步行');assert.equal(new URL(walk.url).searchParams.get('mode'),'walk');
});
test('daily route details only connect adjacent visits within the same day',()=>{
  const c=load(),s=state(c),a=s.attractions;
  s.schedule={days:[{attractions:[a[0],a[1]],hours:4,budget:5},{attractions:[a[2]],hours:2,budget:8}],remaining:[]};
  const days=c.TripJourney.days(s);
  assert.equal(days[0].stops.length,2);assert.equal(days[0].stops[0].transfer,null);
  assert.equal(days[0].stops[1].transfer.from,a[0].name);
  assert.equal(days[0].stops[1].transfer.to,a[1].name);
  assert.equal(days[1].stops[0].transfer,null);
  assert.equal(days[1].stops[0].sequence,3);
});
function state(c) {
  const city=c.findDestination('杭州').data;
  const input={startName:'北京',destName:'杭州',travelMode:'高铁',playMode:'公共交通',duration:'三天两夜',startDate:'2026-10-06',pace:'舒适',stayPreference:'景点便利'};
  return {inputs:input,startGeo:c.findDestination('北京').data,destGeo:city,destData:city,attractions:city.attractions,
    selected:city.attractions.map((_,i)=>i),schedule:c.TripPlanner.plan(city.attractions,3,city,input),weather:{},stay:c.STAY_DATA['杭州'],generatedAt:'2026-10-06T00:00:00Z'};
}
test('pace budgets and transit mode change estimates',()=>{
  const c=load(),attrs=[{name:'A',lat:30,lng:120,duration:'1小时'},{name:'B',lat:30.2,lng:120.2,duration:'1小时'}];
  const relaxed=c.TripPlanner.plan(attrs,3,attrs[0],{pace:'轻松',playMode:'公共交通'});
  const busy=c.TripPlanner.plan(attrs,3,attrs[0],{pace:'紧凑',playMode:'自驾'});
  assert.ok(relaxed.days[1].budget<busy.days[1].budget);
  const walk={days:[{attractions:attrs,budget:8}]},drive={days:[{attractions:attrs,budget:8}]};
  c.TripPlanner.recalculate(walk,attrs[0],{playMode:'公共交通'});c.TripPlanner.recalculate(drive,attrs[0],{playMode:'自驾'});
  assert.ok(walk.days[0].hours>drive.days[0].hours);
});
test('manual movement shows overload without dropping attractions',()=>{
  const c=load(),s=state(c);c.TripEditor.edit(s,0,'day','0');c.TripEditor.edit(s,1,'day','0');c.TripEditor.edit(s,2,'day','0');
  assert.match(s.schedule.days[0].warning,/超过/);
  assert.ok(s.schedule.days[0].attractions.includes(s.attractions[2]));
  c.TripEditor.edit(s,2,'up');assert.ok(s.schedule.days[0].attractions.indexOf(s.attractions[2])<s.schedule.days[0].attractions.length-1);
  c.TripEditor.edit(s,2,'include',false);assert.ok(!s.schedule.days.flatMap(d=>d.attractions).includes(s.attractions[2]));
});
test('quiet preferences and actual flight hubs change rankings',()=>{
  const c=load(),areas=[{name:'热闹',lat:30,lng:120,desc:'商圈',env:'繁华'},{name:'静区',lat:30,lng:120.01,desc:'度假',env:'清幽'}];
  const stations=[{name:'机场',kind:'机场',lat:30,lng:120.01}];
  assert.equal(c.TripStay.score(areas,stations,[areas[0]],'高铁','景点便利')[0].area.name,'热闹');
  assert.equal(c.TripStay.score(areas,stations,[areas[0]],'高铁','安静休闲')[0].area.name,'静区');
  assert.equal(c.TripStay.score(areas,stations,[areas[0]],'飞机','交通优先')[0].area.name,'静区');
});
test('snapshots round-trip manual order and strip unknown fields',()=>{
  const c=load(),s=state(c);c.TripEditor.edit(s,0,'day','1');
  const data=c.TripStorage.snapshot(s);data.untrusted='<script>';
  const normalized=c.TripStorage.parse(JSON.stringify(data));assert.equal(normalized.untrusted,undefined);
  const restored=c.TripStorage.restore(normalized);
  assert.equal(JSON.stringify(restored.schedule.days.map(d=>d.attractions.map(a=>a.name))),JSON.stringify(s.schedule.days.map(d=>d.attractions.map(a=>a.name))));
  assert.equal(restored.archived,true);
});
test('invalid indices, duplicate visits, bad versions and oversized imports are rejected',()=>{
  const c=load(),data=c.TripStorage.snapshot(state(c));
  for(const mutate of [d=>d.version=9,d=>d.order[0]=[999],d=>d.order[0]=[0,0],d=>d.startGeo.lat=999,d=>d.inputs.playMode='未知']){
    const copy=JSON.parse(JSON.stringify(data));mutate(copy);assert.throws(()=>c.TripStorage.parse(JSON.stringify(copy)));
  }
  assert.throws(()=>c.TripStorage.parse(' '.repeat(1000001)));
});
test('storage quota errors preserve previously stored plans; retains only ten entries',()=>{
  let stored=null,fail=false;
  const c=load({localStorage:{getItem:()=>stored,setItem:(_,value)=>{if(fail)throw new Error('quota');stored=value;}}});
  const s=state(c);for(let i=0;i<11;i++)c.TripStorage.save(s);assert.equal(c.TripStorage.list().length,10);
  const before=stored;fail=true;assert.throws(()=>c.TripStorage.save(s),/quota/);assert.equal(stored,before);
});
test('share links contain only whitelisted inputs and ignore section anchors',()=>{
  const c=load(),input=state(c).inputs;
  const link=c.TripStorage.share({...input,secret:'hidden'},'https://example.com/trip/');
  assert.ok(!link.includes('secret'));assert.equal(c.TripStorage.readShare(new URL(link).hash).destName,'杭州');
  assert.equal(c.TripStorage.readShare('#weatherCard'),null);assert.throws(()=>c.TripStorage.readShare('#startName=x'));
});
test('ambiguous geocoding uses the selected result rather than population',async()=>{
  const c=load({fetch:async()=>({ok:true,json:async()=>({results:[{name:'同名',latitude:30,longitude:120,population:1e6},{name:'同名',latitude:31,longitude:121}]})})});
  const chosen=await c.TripWeather.geocodeCity('同名',new AbortController().signal,async(_,choices)=>choices[1]);
  assert.equal(chosen.lat,31);await assert.rejects(c.TripWeather.geocodeCity('同名',new AbortController().signal),/多个地点/);
});
test('invalid responses are rejected before caching',async()=>{
  let calls=0;const c=load({fetch:async()=>{calls++;return {ok:true,json:async()=>({value:calls})};}});
  await assert.rejects(c.TripCore.requestJSON('test',{ttl:1000,validate:x=>x.value>1}),/格式无效/);
  assert.equal((await c.TripCore.requestJSON('test',{ttl:1000,validate:x=>x.value>1})).value,2);
});

test('multi-day attractions are not silently shortened into one day',()=>{
  const c=load(),attraction={name:'多日景区',lat:30,lng:120,duration:'1-2天'};
  const schedule=c.TripPlanner.plan([attraction],4,attraction);
  assert.equal(schedule.remaining.length,1);
  schedule.days[1].attractions=[attraction];c.TripPlanner.recalculate(schedule,attraction,{});
  assert.equal(schedule.days[1].hours,16);assert.match(schedule.days[1].warning,/超过/);
});
