/* Versioned, bounded local snapshots. Imported documents are rebuilt from whitelisted fields. */
(function (global) {
  'use strict';
  var KEY = 'trip-planner:saved:v1';
  var durations = ['一天一夜','两天一夜','三天两夜','四天三夜','五天四夜','六天五夜'];
  function fail() { throw new Error('攻略文件格式无效或超过大小限制。'); }
  function text(value, limit, optional) {
    if (value == null && optional) return '';
    if (typeof value !== 'string' || value.length > limit || (!optional && !value.trim())) fail();
    return value;
  }
  function choice(value, allowed) { if (allowed.indexOf(value) < 0) fail(); return value; }
  function array(value, limit) { if (!Array.isArray(value) || value.length > limit) fail(); return value; }
  function date(value) { text(value,10); if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail(); return value; }
  function inputs(value) {
    if (!value || typeof value !== 'object') fail();
    return { startName:text(value.startName,200),destName:text(value.destName,200),startDate:date(value.startDate),
      travelMode:choice(value.travelMode,['自驾','打车','火车','高铁','飞机','邮轮','大巴']),
      playMode:choice(value.playMode,['公共交通','打车','自驾','包车','租车']),duration:choice(value.duration,durations),
      pace:choice(value.pace,['舒适','轻松','紧凑']),stayPreference:choice(value.stayPreference,['景点便利','交通优先','安静休闲']) };
  }
  function point(value) {
    if (!TripCore.validPoint(value)) fail();
    return {name:text(value.name,200),lat:value.lat,lng:value.lng,admin1:text(value.admin1,200,true),country:text(value.country,200,true)};
  }
  function attraction(value) {
    var result = point(value);
    result.category = text(value.category,100,true); result.duration = text(value.duration,100);
    result.desc = text(value.desc,4000,true); result.get = text(value.get,1000,true);
    result.highlights = array(value.highlights || [],20).map(function (item) { return text(item,1000); });
    result.metro = value.metro ? {line:text(value.metro.line,200),station:text(value.metro.station,200),walk:text(value.metro.walk,200,true)} : null;
    return result;
  }
  function weather(value) {
    value = value || {}; var result = {current:{},daily:{},notice:text(value.notice,1000,true)};
    ['temperature_2m','weather_code','apparent_temperature','relative_humidity_2m','wind_speed_10m'].forEach(function (key) {
      if (value.current && value.current[key] != null) { if (!Number.isFinite(value.current[key])) fail(); result.current[key]=value.current[key]; }
    });
    if (value.daily && value.daily.time) {
      result.daily.time = array(value.daily.time,16).map(date);
      ['temperature_2m_min','temperature_2m_max','weather_code','precipitation_probability_max','uv_index_max','wind_speed_10m_max'].forEach(function (key) {
        var data = array(value.daily[key] || [],16);
        if (data.length && data.length !== result.daily.time.length) fail();
        result.daily[key] = data.map(function (item) { if (item !== null && !Number.isFinite(item)) fail(); return item; });
      });
    }
    return result;
  }
  function normalize(value) {
    if (!value || value.version !== 1) fail();
    var result = { version:1, title:text(value.title,200), savedAt:text(value.savedAt,40), inputs:inputs(value.inputs),
      startGeo:point(value.startGeo),destGeo:point(value.destGeo),attractions:array(value.attractions,100).map(attraction),
      weather:weather(value.weather),destData:null,stay:{stations:[],areas:[]},selected:[],order:[] };
    result.arrivalStationIndex=null;
    if (!Number.isFinite(Date.parse(result.savedAt))) fail();
    if (value.destData) {
      var source=value.destData; result.destData={};
      ['name','province','region','type','overview','tips'].forEach(function (key) { result.destData[key]=text(source[key],4000,true); });
      result.destData.foods=array(source.foods || [],30).map(function (food) { return {name:text(food.name,200),desc:text(food.desc,4000,true)}; });
    }
    if (!value.stay) fail();
    result.stay.stations=array(value.stay.stations,20).map(function (station) { return Object.assign(point(station),{kind:choice(station.kind,['机场','火车站','高铁站'])}); });
    result.stay.areas=array(value.stay.areas,20).map(function (area) { return Object.assign(point(area),{desc:text(area.desc,4000,true),env:text(area.env,4000,true)}); });
    if(value.arrivalStationIndex!=null) {
      var arrivalIndex=value.arrivalStationIndex;
      if(!Number.isInteger(arrivalIndex) || arrivalIndex<0 || arrivalIndex>=result.stay.stations.length || !TripArrival.eligible(result.stay.stations[arrivalIndex],result.inputs.travelMode))fail();
      result.arrivalStationIndex=arrivalIndex;
    }
    function index(id) { if (!Number.isInteger(id) || id < 0 || id >= result.attractions.length) fail(); return id; }
    result.selected=array(value.selected,100).map(index);
    if (new Set(result.selected).size !== result.selected.length) fail();
    var dayCount=durations.indexOf(result.inputs.duration)+1;
    result.order=array(value.order,6).map(function (day) { return array(day,100).map(index); });
    if (result.order.length !== dayCount) fail();
    var planned=result.order.flat();
    if (new Set(planned).size !== planned.length || planned.some(function (id) { return result.selected.indexOf(id) < 0; })) fail();
    return result;
  }
  function snapshot(state) {
    return normalize({ version:1,title:state.inputs.startName+' → '+state.inputs.destName,savedAt:state.generatedAt || new Date().toISOString(),inputs:state.inputs,
      startGeo:state.startGeo,destGeo:state.destGeo,destData:state.destData,attractions:state.attractions,weather:state.weather,
      stay:state.stay,selected:state.selected,arrivalStationIndex:state.arrivalStationIndex,order:state.schedule.days.map(function (day) { return day.attractions.map(function (a) { return state.attractions.indexOf(a); }); }) });
  }
  function restore(document) {
    var data=normalize(document), days=data.order.length;
    var schedule=TripPlanner.plan([],days,data.destGeo,data.inputs);
    schedule.days.forEach(function (day,index) { day.attractions=data.order[index].map(function (id) { return data.attractions[id]; }); });
    schedule.remaining=data.selected.filter(function (id) { return data.order.flat().indexOf(id)<0; }).map(function (id) { return data.attractions[id]; });
    TripPlanner.recalculate(schedule,data.destGeo,data.inputs);
    return { inputs:data.inputs,startGeo:data.startGeo,destGeo:data.destGeo,destData:data.destData,km:TripCore.distance(data.startGeo,data.destGeo),
      attractions:data.attractions,weather:data.weather,stay:data.stay,selected:data.selected,schedule:schedule,travelRoute:null,
      warnings:[],archived:true,generatedAt:data.savedAt,arrivalStationIndex:data.arrivalStationIndex };
  }
  function parse(source) { if (typeof source !== 'string' || source.length > 1000000) fail(); return normalize(JSON.parse(source)); }
  function list() {
    var raw=global.localStorage.getItem(KEY); if (!raw) return [];
    if (raw.length > 3000000) fail();
    return array(JSON.parse(raw),10).map(function (entry) { return {id:text(entry.id,80),data:normalize(entry.data)}; });
  }
  function save(state) {
    var data=snapshot(state), entries=list();
    var id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
    var next=[{id:id,data:data}].concat(entries).slice(0,10);
    var encoded=JSON.stringify(next); if (encoded.length > 3000000) throw new Error('保存空间不足，请先导出或删除部分本机攻略。');
    global.localStorage.setItem(KEY,encoded); return id;
  }
  function remove(id) { global.localStorage.setItem(KEY,JSON.stringify(list().filter(function (item) { return item.id!==id; }))); }
  function share(input, address) {
    var data=inputs(input), url=new URL(address); url.hash=new URLSearchParams(data).toString(); return url.toString();
  }
  function readShare(hash) {
    if (!hash) return null;
    if (hash.length > 4000) fail();
    var params=new URLSearchParams(hash.replace(/^#/,''));
    if (!params.has('startName') && !params.has('destName')) return null;
    return inputs(Object.fromEntries(params.entries()));
  }
  global.TripStorage={snapshot:snapshot,restore:restore,parse:parse,list:list,save:save,remove:remove,share:share,readShare:readShare};
})(window);
