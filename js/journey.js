/* Visit blocks and transport suggestions; no claim of live transit routing. */
(function (global) {
  'use strict';
  function transfer(a,b,mode) {
    var km=TripCore.distance(a,b), walk=km!==null && km<=1;
    var minutes=Math.ceil((walk ? Math.max(0.25,km*1.3/4) : TripPlanner.travelHours(a,b,mode))*60);
    var label=walk ? '步行' : mode==='公共交通' ? '公交 / 地铁' : mode==='租车' ? '租车自驾' : mode;
    var detail=walk ? '距离较近，可优先查看步行路线；请确认道路连通与出入口。' : '';
    if(!walk && mode==='公共交通') {
      if(a.metro && b.metro && a.metro.line===b.metro.line)
        detail='可优先查询'+a.metro.line+'：'+a.metro.station+' → '+b.metro.station+'，核实方向、步行距离与班次。';
      else if(a.metro && b.metro)
        detail='从'+a.metro.station+'（'+a.metro.line+'）前往'+b.metro.station+'（'+b.metro.line+'），换乘方案请查地图。';
      else detail='暂无可靠的具体公交线路资料，请打开地图查询；班次少或换乘不便时可比较打车。';
    }
    if(!walk && mode!=='公共交通') detail='预留接送、道路拥堵与停车时间；参考位置可能不是实际入口。';
    var params=new URLSearchParams({from:a.lng+','+a.lat+','+a.name,to:b.lng+','+b.lat+','+b.name,
      mode:walk?'walk':mode==='公共交通'?'bus':'car',coordinate:'wgs84',callnative:'0',src:'trip-planner'});
    return {from:a.name,to:b.name,km:km,minutes:minutes,mode:label,detail:detail,url:'https://uri.amap.com/navigation?'+params.toString()};
  }
  function days(state) {
    var sequence=0;
    return state.schedule.days.map(function (day,index) {
      return {number:index+1,hours:day.hours,budget:day.budget,warning:day.warning || '',
        stops:day.attractions.map(function (a,i) {
          return {attraction:a,sequence:++sequence,hours:TripPlanner.durationHours(a.duration),
            transfer:i ? transfer(day.attractions[i-1],a,state.inputs.playMode) : index===0 && state.arrival && state.arrival.firstDay===0 ? state.arrival.inbound : null};
        })};
    });
  }
  global.TripJourney={transfer:transfer,days:days};
})(window);
