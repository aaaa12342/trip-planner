/* Explainable area comparisons, based on source descriptions and straight-line distances. */
(function (global) {
  'use strict';
  function score(areas, stations, attractions, travelMode, preference, arrivalStation) {
    var rails = stations.filter(function (s) { return s.kind !== '机场'; });
    var airports = stations.filter(function (s) { return s.kind === '机场'; });
    var attrs = attractions.filter(TripCore.validPoint);
    var quietPattern = /清幽|安静|宁静|幽静|静谧/;
    var hasQuiet = areas.some(function (a) { return quietPattern.test(a.env + a.desc); });
    return areas.map(function (area) {
      var distances = attrs.map(function (a) { return TripCore.distance(area,a); });
      var avgAttr = distances.length ? distances.reduce(function (a,b) { return a+b; },0) / distances.length : null;
      var rail = rails.length ? Math.min.apply(null,rails.map(function (s) { return TripCore.distance(area,s); })) : null;
      var airport = airports.length ? Math.min.apply(null,airports.map(function (s) { return TripCore.distance(area,s); })) : null;
      var arrivalKm=TripCore.validPoint(arrivalStation) ? TripCore.distance(area,arrivalStation) : null;
      var relevant = arrivalKm!=null ? arrivalKm : travelMode === '飞机' ? airport : travelMode === '高铁' || travelMode === '火车' ? rail : null;
      var transportFirst = preference === '交通优先';
      var value = 100 - (avgAttr == null ? 15 : avgAttr * (transportFirst ? 2 : 6)) - (relevant == null ? 0 : relevant * (transportFirst ? 4 : 1));
      var quiet = quietPattern.test(area.env + area.desc);
      if (preference === '安静休闲' && hasQuiet) value += quiet ? 35 : -10;
      var reasons = [];
      if (avgAttr != null) reasons.push('按已安排景点平均直线距离比较');
      if (relevant != null) reasons.push(transportFirst ? '优先接近所选出行方式的交通枢纽' : '兼顾所选交通枢纽距离');
      if (arrivalKm!=null) reasons.push('交通距离按已选抵达站点「'+arrivalStation.name+'」比较');
      if (preference === '安静休闲') reasons.push(hasQuiet ? (quiet ? '资料描述含清幽或安静特点' : '资料未描述安静特点') : '没有明确安静区域资料，按距离比较，建议核实噪声情况');
      return { area:area, avgAttr:avgAttr == null ? null : Math.round(avgAttr*10)/10,
        nearRail:rail == null ? null : Math.round(rail*10)/10, airportDist:airport == null ? null : Math.round(airport),arrivalKm:arrivalKm==null ? null : Math.round(arrivalKm*10)/10,
        score:Math.max(0,Math.min(100,Math.round(value))), reason:reasons.join('；'), rawScore:value };
    }).sort(function (a,b) { return b.rawScore-a.rawScore; });
  }
  global.TripStay = { score:score };
})(window);
