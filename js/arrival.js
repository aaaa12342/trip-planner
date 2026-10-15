/* Arrival comparison uses straight-line distances, not ticket availability. */
(function(global){
  'use strict';
  function eligible(station,mode) {
    return TripCore.validPoint(station) && (mode==='飞机' ? station.kind==='机场' :
      (mode==='火车' || mode==='高铁') && ['火车站','高铁站'].indexOf(station.kind)>=0);
  }
  function rank(stations,schedule,mode) {
    var enabled=['飞机','火车','高铁'].indexOf(mode)>=0;
    var firstDay=schedule.days.findIndex(function(day){return day.attractions.length;});
    var planned=schedule.days.flatMap(function(day){return day.attractions;}).filter(TripCore.validPoint);
    var first=firstDay>=0 ? schedule.days[firstDay].attractions[0] : null;
    var result={enabled:enabled,candidates:[],first:first,firstDay:firstDay,selected:null,inbound:null};
    if(!enabled)return result;
    if(!first || !planned.length){result.notice='尚无已安排景点，请先安排游览日后比较抵达站点。';return result;}
    result.candidates=stations.map(function(station,index){
      if(!eligible(station,mode))return null;
      var firstKm=TripCore.distance(station,first);
      var avgKm=planned.reduce(function(sum,a){return sum+TripCore.distance(station,a);},0)/planned.length;
      return {station:station,index:index,firstKm:firstKm,avgKm:avgKm,distance:firstKm*0.7+avgKm*0.3,
        unconfirmed:mode==='高铁' && station.kind!=='高铁站'};
    }).filter(Boolean).sort(function(a,b){return Number(a.unconfirmed)-Number(b.unconfirmed) || a.distance-b.distance || a.index-b.index;});
    if(!result.candidates.length)result.notice='暂无匹配的'+(mode==='飞机'?'机场':'铁路站点')+'资料，请核实实际抵达站点；当前不作站点推荐。';
    return result;
  }
  function update(state) {
    TripPlanner.recalculate(state.schedule,state.destGeo,state.inputs);
    var result=rank(state.stay.stations || [],state.schedule,state.inputs.travelMode);
    var manual=result.candidates.find(function(c){return c.index===state.arrivalStationIndex;});
    if(!manual)state.arrivalStationIndex=null;
    result.selected=manual || result.candidates[0] || null;
    result.manual=!!manual;
    if(result.selected) {
      result.inbound=TripJourney.transfer(result.selected.station,result.first,state.inputs.playMode);
      if(result.firstDay===0) {
        var day=state.schedule.days[0];
        var base=day.attractions.length===1 && TripPlanner.durationHours(result.first.duration)>=8 ? 0 : TripPlanner.travelHours(state.destGeo,result.first,state.inputs.playMode);
        day.hours+=result.inbound.minutes/60-base;
        if(day.hours>day.budget)day.warning=(day.warning || '')+' 计入抵达站点至首个景点的交通后超过当日预算，请减少首日景点或调整日期。';
      }
    }
    state.arrival=result;return result;
  }
  global.TripArrival={rank:rank,update:update,eligible:eligible};
})(window);
