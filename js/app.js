/* ============================================================
 * 主逻辑：推荐 + 行程生成 + 渲染
 * ============================================================ */
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var escape = TripCore.escapeHTML;
  var requestId = 0, activeController = null, debounceTimer = null;
  var currentPlan = null, mapController = null, mapRequestId = 0;
  var recommendations=null, recommendationController=null, recommendationId=0;
  function cancelRecommendations() {
    recommendationId++;
    if(recommendationController) recommendationController.abort();
    recommendationController=null;$('recommendBtn').disabled=false;
  }
  function updatePickerCount() {
    $('pickerCount').textContent='已选 '+recommendations.selected.length+' / '+recommendations.attractions.length+' 个景点';
  }
  function renderRecommendations() {
    var list=recommendations.attractions;
    $('pickerTools').hidden=!list.length;
    var source=recommendations.archived ? '存档景点' : recommendations.destData && Array.isArray(recommendations.destData.attractions) && recommendations.destData.attractions.length ? '本地精选资料' : 'OpenStreetMap 附近景点';
    $('pickerStatus').textContent=list.length ? recommendations.name+' · '+source+'。默认勾选，可取消不想去的景点；游览时长为建议值。' : '暂未查到推荐景点，请更换目的地或重试景点查询。';
    $('recommendedWrap').innerHTML=list.map(function(a,id) {
      return '<label class="recommended-stop"><span class="picker-stop-heading"><input type="checkbox" data-stop-id="'+id+'"'+(recommendations.selected.indexOf(id)>=0?' checked':'')+'><strong>'+escape(a.name)+'</strong></span><span class="picker-meta">'+escape(a.category || '景点')+' · 建议 '+escape(a.duration)+'</span><span>'+escape(a.desc)+'</span>'+
        '<span class="picker-highlights">'+(a.highlights || []).map(escape).join(' / ')+'</span></label>';
    }).join('');
    updatePickerCount();
  }
  function localRecommendations() {
    var name=$('destInput').value.trim(),found=findDestination(name);
    if(!found || !found.data.attractions.length) return false;
    recommendations={name:name,destData:found.data,geo:{name:found.data.name,lat:found.data.lat,lng:found.data.lng},
      attractions:found.data.attractions.slice(),selected:found.data.attractions.map(function(_,i){return i;})};
    renderRecommendations();return true;
  }
  async function prepareRecommendations() {
    cancelRecommendations();var token=recommendationId,name=$('destInput').value.trim();
    if(!name) { $('pickerStatus').textContent='请先填写目的地。';return false; }
    showError(null);
    if(recommendations && recommendations.name===name && recommendations.attractions.length) return true;
    if(localRecommendations()) return true;
    recommendationController=new AbortController();var signal=recommendationController.signal;
    $('recommendBtn').disabled=true;$('pickerStatus').textContent='正在查询目的地与推荐景点…';
    try {
      var found=findDestination(name),data=found ? found.data : null;
      var geo=data ? {name:data.name,lat:data.lat,lng:data.lng} : await TripWeather.geocodeCity(name,signal,TripLocation.choose);
      var attrs=await fetchNearbyAttractions(geo.lat,geo.lng,signal);
      if(token!==recommendationId || signal.aborted || name!==$('destInput').value.trim()) return false;
      recommendations={name:name,destData:data,geo:geo,attractions:attrs,selected:attrs.map(function(_,i){return i;})};
      renderRecommendations();return true;
    } catch(error) {
      if(token===recommendationId && !signal.aborted) { $('pickerStatus').textContent='推荐景点查询失败：'+error.message+'。请重试或选择已收录的城市。';showError('景点查询失败：'+error.message); }
      return false;
    } finally { if(token===recommendationId) { recommendationController=null;$('recommendBtn').disabled=false; } }
  }
  function cancelGeneration() {
    cancelMapRequest();
    if (global.__tripMap) { global.__tripMap.remove(); global.__tripMap=null; }
    requestId++;
    if (activeController) activeController.abort();
    activeController = null;
    clearTimeout(debounceTimer);
    showLoading(false);
    $('generateBtn').disabled = false;
  }
  function localDate() {
    var date = new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  var DURATION_MAP = {
    '一天一夜': { days: 1, nights: 1 },
    '两天一夜': { days: 2, nights: 1 },
    '三天两夜': { days: 3, nights: 2 },
    '四天三夜': { days: 4, nights: 3 },
    '五天四夜': { days: 5, nights: 4 },
    '六天五夜': { days: 6, nights: 5 }
  };

  var PLAY_VERB = {
    '公共交通': '乘坐公共交通',
    '打车': '打车',
    '自驾': '自驾',
    '包车': '包车',
    '租车': '租车自驾'
  };
  var ARRIVE_VERB = {
    '自驾': '自驾前往',
    '打车': '打车前往',
    '火车': '乘火车抵达',
    '高铁': '乘高铁抵达',
    '飞机': '乘飞机抵达',
    '邮轮': '乘邮轮抵达',
    '大巴': '乘大巴抵达'
  };

  /* ---------- 工具 ---------- */
  function selectedRadio(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  function haversineKm(a, b) {
    return TripCore.distance(a, b);
  }

  function fmtKm(km) {
    if (km == null) return '—';
    if (km >= 1000) return km.toFixed(1) + ' 公里';
    return Math.round(km) + ' 公里';
  }

  function showLoading(on) {
    $('loading').hidden = !on;
  }
  function showError(msg) {
    var box = $('errorBox');
    if (msg) { box.textContent = '⚠️ ' + msg; box.hidden = false; }
    else { box.hidden = true; }
  }

  /* ---------- 推荐逻辑 ---------- */
  function recommendTravelMode(km) {
    if (km == null) return { mode: '高铁', reason: '距离未知，默认推荐高铁，长途可选飞机。' };
    if (km < 80) return { mode: '自驾', reason: '两地较近（约' + Math.round(km) + '公里），自驾/打车最灵活省时。' };
    if (km < 300) return { mode: '高铁', reason: '中短途（约' + Math.round(km) + '公里），高铁快速舒适，也可自驾。' };
    if (km < 800) return { mode: '高铁', reason: '约' + Math.round(km) + '公里，高铁是最省心高效的选择。' };
    if (km < 1400) return { mode: '高铁', reason: '约' + Math.round(km) + '公里，可优先比较高铁与飞机的总耗时，是否直达需查实际班次。' };
    return { mode: '飞机', reason: '长途（约' + Math.round(km) + '公里），飞机更高效省时。' };
  }

  function recommendPlayMode(destType) {
    if (destType === 'beach' || destType === 'coastal') {
      return { mode: '自驾', reason: '海滨/海岛景点较分散，自驾或租车更自由。' };
    }
    if (destType === 'mountain' || destType === 'oldtown') {
      return { mode: '包车', reason: '山水/古城景点间距离较远，包车省心省力。' };
    }
    return { mode: '公共交通', reason: '市区地铁公交便利，公共交通性价比高。' };
  }

  function recommendDuration(attractions) {
    var hours=attractions.reduce(function (total,a) { return total+TripPlanner.durationHours(a.duration); },0);
    var days=Math.max(2,Math.min(6,Math.ceil(hours/6)+1));
    var labels=['一天一夜','两天一夜','三天两夜','四天三夜','五天四夜','六天五夜'];
    return {mode:labels[days-1],reason:'已勾选 '+attractions.length+' 个景点，游览约 '+hours+' 小时，预留交通后建议 '+labels[days-1]+'；多日景区可单独规划。'};
  }

  function markRecommended(name, value) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      var seg = input.closest('.seg');
      if (seg) seg.classList.toggle('rec', input.value === value);
    });
  }

  /* ---------- 附近景点（未手写景点城市：OpenStreetMap 实时检索 + 类型模板） ---------- */
  var CAT_TEMPLATES = {
    '博物馆': { label: '博物馆', desc: '馆藏当地历史与特色文物，是了解城市文化的窗口。', highlights: ['看馆藏代表性文物', '了解当地历史脉络'], duration: '2小时' },
    '寺庙': { label: '寺庙', desc: '香火旺盛的古刹，建筑与宗教文化底蕴深厚。', highlights: ['参拜大殿', '看古建筑与碑刻'], duration: '1-2小时' },
    '公园': { label: '公园', desc: '市民休闲的城市绿地，适合散步放松。', highlights: ['散步休闲', '赏花看景'], duration: '1-2小时' },
    '古城': { label: '古城', desc: '保留老城风貌的历史街区。', highlights: ['逛老街巷', '看古建筑'], duration: '2小时' },
    '历史': { label: '历史', desc: '承载当地历史记忆的名胜古迹。', highlights: ['实地参观', '了解历史典故'], duration: '1-2小时' },
    '自然': { label: '自然', desc: '自然山水风光，适合户外游览。', highlights: ['观景拍照', '徒步游览'], duration: '半天' },
    '游乐园': { label: '游乐园', desc: '主题乐园，适合亲子与娱乐。', highlights: ['玩游乐项目', '看表演'], duration: '半天' },
    '动物园': { label: '动物园', desc: '观赏各种动物，亲子游好去处。', highlights: ['看动物', '亲近自然'], duration: '2-3小时' },
    '海滩': { label: '海滩', desc: '滨海沙滩，适合玩水休闲。', highlights: ['玩水踏浪', '看海景'], duration: '半天' },
    '观景点': { label: '观景点', desc: '俯瞰城市或山水的绝佳位置。', highlights: ['登高望远', '拍全景'], duration: '1小时' },
    '景点': { label: '景点', desc: '当地代表性游览点，值得一逛。', highlights: ['实地游览', '拍照打卡'], duration: '1-2小时' }
  };

  function classifyOsm(tags) {
    var t = tags.tourism;
    if (t === 'museum' || t === 'gallery') return '博物馆';
    if (t === 'theme_park' || t === 'attraction' && (tags.attraction === 'roller_coaster' || tags.leisure === 'water_park')) return '游乐园';
    if (t === 'zoo' || t === 'aquarium') return '动物园';
    if (t === 'viewpoint') return '观景点';
    if (t === 'artwork') return '景点';
    if (tags.historic && /castle|monument|fort|ruins|citywalls|city_gate|memorial/.test(tags.historic)) return '历史';
    if (tags.natural === 'beach' || tags.beach) return '海滩';
    if (tags.leisure === 'park' || tags.landuse === 'recreation_ground') return '公园';
    if (tags.amenity === 'place_of_worship' && /buddhist|taoist|shinto/.test(tags.religion || '')) return '寺庙';
    return '景点';
  }

  async function fetchNearbyAttractions(lat, lng, signal) {
    var query = '[out:json][timeout:25];(' +
      'node["tourism"~"attraction|viewpoint|museum|theme_park|zoo|aquarium|artwork|gallery"](around:25000,' + lat + ',' + lng + ');' +
      'way["tourism"~"attraction|viewpoint|museum|theme_park|zoo"](around:25000,' + lat + ',' + lng + ');' +
      'node["historic"~"castle|monument|fort|ruins|citywalls|city_gate|memorial"](around:25000,' + lat + ',' + lng + ');' +
      'node["natural"="beach"](around:25000,' + lat + ',' + lng + ');' +
      ');out center 60;';
    var url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
    var json = await TripCore.requestJSON(url, { signal: signal, timeout: 15000, ttl: 86400000 });
    var seen = {};
    var out = [];
    (json.elements || []).forEach(function (el) {
      var tags = el.tags || {};
      var name = tags['name:zh'] || tags.name;
      var la = el.lat != null ? el.lat : (el.center && el.center.lat);
      var lo = el.lon != null ? el.lon : (el.center && el.center.lon);
      if (!name || !TripCore.validPoint({ lat: la, lng: lo })) return;
      if (seen[name]) return;
      seen[name] = 1;
      var tpl = CAT_TEMPLATES[classifyOsm(tags)] || CAT_TEMPLATES['景点'];
      out.push({
        name: name, lat: la, lng: lo,
        category: tpl.label, duration: tpl.duration,
        desc: tpl.desc, highlights: tpl.highlights.slice(),
        metro: null, get: '查询当地公交 / 打车前往'
      });
    });
    // 按距离市中心排序
    out.sort(function (a, b) { return haversineKm({ lat: lat, lng: lng }, a) - haversineKm({ lat: lat, lng: lng }, b); });
    return out.slice(0, 6);
  }

  /* ---------- 车站/机场检索（未手写居住地城市的兜底） ---------- */
  async function fetchTransitHubs(lat, lng, signal) {
    var query = '[out:json][timeout:25];(' +
      'node["railway"="station"](around:40000,' + lat + ',' + lng + ');' +
      'node["aeroway"="aerodrome"](around:100000,' + lat + ',' + lng + ');' +
      'way["aeroway"="aerodrome"](around:100000,' + lat + ',' + lng + ');' +
      ');out center 80;';
    var url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
    var json = await TripCore.requestJSON(url, { signal: signal, timeout: 15000, ttl: 86400000 });
    var stations = [];
    (json.elements || []).forEach(function (el) {
      var tags = el.tags || {};
      var la = el.lat != null ? el.lat : (el.center && el.center.lat);
      var lo = el.lon != null ? el.lon : (el.center && el.center.lon);
      if (!TripCore.validPoint({ lat: la, lng: lo })) return;
      var isAirport = /aerodrome|airstrip/.test(tags.aeroway || '');
      if(!isAirport && tags.railway!=='station')return;
      // 跳过地铁/轻轨站（它们也是 railway=station）
      if (!isAirport && /subway|light_rail|monorail|tram/.test((tags.station || '') + (tags.subway || ''))) return;
      var name = tags['name:zh'] || tags.name || '';
      if (!name) return;
      stations.push({ name: name, lat: la, lng: lo, kind: isAirport ? '机场' : '火车站' });
    });
    var seen = {};
    var dedup = [];
    stations.forEach(function (s) {
      if (seen[s.name]) return;
      seen[s.name] = 1;
      dedup.push(s);
    });
    dedup.sort(function (a, b) { return haversineKm({ lat: lat, lng: lng }, a) - haversineKm({ lat: lat, lng: lng }, b); });
    return dedup.filter(function(s){return s.kind!=='机场';}).slice(0,12).concat(dedup.filter(function(s){return s.kind==='机场';}).slice(0,8));
  }

  /* ---------- 居住地推荐 ---------- */
  function buildGenericAreas(center, stations) {
    var areas = [{ name: '市中心/商圈', lat: center.lat, lng: center.lng, desc: '城市中心，商业餐饮集中', env: '购物吃饭方便，去各景点与车站都较均衡' }];
    var rail = stations.filter(function (s) { return s.kind !== '机场'; })[0];
    if (rail) areas.push({ name: '火车站周边', lat: rail.lat, lng: rail.lng, desc: rail.name + '附近', env: '紧邻车站，适合晚到早走的中转旅客' });
    return areas;
  }

  async function buildStayData(destData, destGeo, attractions, signal, travelMode, preference) {
    var stayKey = destData ? (destData.parent || destData.name) : null;
    var curated = global.STAY_DATA && global.STAY_DATA[stayKey];
    var stations, areas, hubUnavailable = false;
    if (curated) {
      stations = curated.stations.slice();
      areas = curated.areas.slice();
    } else {
      stations = [];
      try { stations = await fetchTransitHubs(destGeo.lat, destGeo.lng, signal); } catch (e) { if (e.name === 'AbortError') throw e; stations = []; hubUnavailable = true; }
      if (destData && destData.scenic) {
        areas = [{
          name: '景区周边/游客中心', lat: destGeo.lat, lng: destGeo.lng,
          desc: '紧邻' + destData.name, env: '就近游览最方便，客栈民宿集中'
        }];
        if (destData.parentLat != null && destData.parent != null) {
          areas.push({
            name: destData.parent + '市区/县城', lat: destData.parentLat, lng: destData.parentLng,
            desc: destData.parent + '城区', env: '配套齐全、进出方便，需乘车往返景区'
          });
        }
      } else {
        areas = buildGenericAreas(destGeo, stations);
      }
    }
    var scored = TripStay.score(areas, stations, attractions, travelMode, preference);
    return { stations: stations, areas: areas, scored: scored, hubUnavailable: hubUnavailable };
  }

  /* ---------- 行程生成 ---------- */
  function buildItinerary(opts) {
    var playVerb = PLAY_VERB[opts.playMode] || '乘坐公共交通';
    return opts.schedule.days.map(function (day, index) {
      var text = '';
      if (index === 0) text += '从' + opts.startName + '出发，' + (ARRIVE_VERB[opts.travelMode] || '前往') + ' ' + opts.destName + '，预留抵达和安顿时间。';
      if (day.attractions.length) {
        text += playVerb + '依次游览：' + day.attractions.map(function (a) { return a.name; }).join(' → ') + '。';
        text += (day.attractions.length === 1 && TripPlanner.durationHours(day.attractions[0].duration) >= 8 ? '全天游览约 ' : '预计游览与市内交通约 ') + day.hours.toFixed(1) + ' 小时（估算，需另核实开放与交通时间）。';
      } else text += '自由活动、逛街或休息，可根据实际抵达时间调整。';
      if (index === opts.schedule.days.length - 1) {
        text += opts.nights >= opts.schedule.days.length
          ? '当晚住宿，次日预留返程时间。'
          : '预留返程时间，返回' + opts.startName + '。';
      }
      return { title: '第 ' + (index + 1) + ' 天', text: text, warning: day.warning, stops: day.attractions.map(function (a) { return a.name; }) };
    });
  }

  /* ---------- 渲染 ---------- */
  function renderSummary(s, rec, destData) {
    $('sumRoute').textContent = s.startName + ' → ' + s.destName;
    $('sumTravel').textContent = s.travelMode;
    $('sumPlay').textContent = s.playMode;
    $('sumDuration').textContent = s.duration + '（' + s.days + '天' + (s.nights ? s.nights + '晚' : '') + '）';
    $('sumDistance').textContent = fmtKm(s.km);
    $('sumDest').textContent = destData ? (destData.name + (destData.province ? ' · ' + destData.province : '') + ' · ' + destData.typeName) : s.destName;

    var notes = [];
    notes.push('推荐出行方式：<b>' + escape(rec.travel.mode) + '</b> — ' + escape(rec.travel.reason));
    notes.push('推荐游玩方式：<b>' + escape(rec.play.mode) + '</b> — ' + escape(rec.play.reason));
    notes.push('推荐时长：<b>' + escape(rec.duration.mode) + '</b> — ' + escape(rec.duration.reason));
    if (destData) notes.push('目的地速览：' + escape(destData.overview));
    if (destData && destData.tips) notes.push('实用贴士：' + escape(destData.tips));
    $('sumNote').innerHTML = notes.join('<br>');
  }

  function renderWeather(weather, days) {
    var cur = weather.current || {};
    var daily = weather.daily || {};
    var html = '';
    if (cur.temperature_2m != null) {
      var info = TripWeather.wmoInfo(cur.weather_code);
      html += '<div class="weather-now">' +
        '<div>' + (weather.archived ? '存档时' : '当前') + ' <span class="temp">' + Math.round(cur.temperature_2m) + '°C</span></div>' +
        '<div class="desc">' + escape(info.icon) + ' ' + escape(info.desc) + '</div>' +
        '<div class="meta">体感 ' + Math.round(cur.apparent_temperature) + '°C · 湿度 ' +
        (Number.isFinite(cur.relative_humidity_2m) ? cur.relative_humidity_2m : '—') + '% · 风速 ' +
        Math.round(cur.wind_speed_10m) + ' km/h</div>' +
        '</div>';
    }
    var times = daily.time || [];
    var n = Math.min(times.length, days);
    for (var i = 0; i < n; i++) {
      var code = daily.weather_code && daily.weather_code[i];
      var inf = TripWeather.wmoInfo(code);
      var maxT = daily.temperature_2m_max && daily.temperature_2m_max[i] != null ? Math.round(daily.temperature_2m_max[i]) : '—';
      var minT = daily.temperature_2m_min && daily.temperature_2m_min[i] != null ? Math.round(daily.temperature_2m_min[i]) : '—';
      var prec = daily.precipitation_probability_max && daily.precipitation_probability_max[i] != null ? daily.precipitation_probability_max[i] : null;
      html += '<div class="weather-day">' +
        '<div class="d-name">' + TripWeather.formatDate(times[i]) + '</div>' +
        '<div class="d-icon">' + escape(inf.icon) + '</div>' +
        '<div class="d-temp"><span class="lo">低温 ' + minT + '°</span><span class="hi">高温 ' + maxT + '°</span></div>' +
        '<div class="d-prec">' + escape(inf.desc) + (prec != null ? ' · 降水 ' + escape(prec) + '%' : '') + '</div>' +
        '</div>';
    }
    if (weather.notice) html += '<p class="empty">' + escape(weather.notice) + '</p>';
    if (!html) html = '<p class="empty">暂未获取到天气数据。</p>';
    $('weatherWrap').innerHTML = html;
  }

  function renderClothing(cloth) {
    var html = '<div class="clothing-list">' +
      '<div class="clothing-row"><span class="ck">上装</span><span class="cv">' + escape(cloth.upper) + '</span></div>' +
      '<div class="clothing-row"><span class="ck">下装</span><span class="cv">' + escape(cloth.lower) + '</span></div>' +
      '<div class="clothing-row"><span class="ck">配饰</span><span class="cv">' + escape(cloth.accessory) + '</span></div>' +
      '</div>';
    if (cloth.tips && cloth.tips.length) {
      html += '<div class="clothing-tip">' + cloth.tips.map(escape).join('　') + '</div>';
    }
    $('clothingWrap').innerHTML = html;
  }

  function renderItems(cats) {
    var html = '';
    cats.forEach(function (cat) {
      html += '<div class="items-cat"><h4>' + escape(cat.name.replace(/^[^\u4e00-\u9fff]+/,'')) + '</h4><ul>' +
        cat.items.map(function (it) { return '<li>' + escape(it) + '</li>'; }).join('') +
        '</ul></div>';
    });
    $('itemsWrap').innerHTML = html;
  }

  function renderRoute(state) {
    var itinerary=buildItinerary({startName:state.inputs.startName,destName:state.inputs.destName,travelMode:state.inputs.travelMode,playMode:state.inputs.playMode,nights:DURATION_MAP[state.inputs.duration].nights,schedule:state.schedule});
    var html = '';
    TripJourney.days(state).forEach(function (day,index) {
      var intro=day.stops.length ? (index===0 ? '从'+state.inputs.startName+'出发，'+(ARRIVE_VERB[state.inputs.travelMode] || '前往')+' '+state.inputs.destName+'，预留抵达与入住时间。' : '按下列顺序游览，景点间交通已合并在路线中。') : itinerary[index].text;
      if(day.stops.length && index===state.schedule.days.length-1) intro+=state.schedule.days.length===1 ? '次日预留返程时间，不压缩在当日游玩预算内。' : '当天预留返程时间。';
      html += '<div class="route-day"><h4>第 '+day.number+' 天 <span class="day-budget">预计 '+day.hours.toFixed(1)+' 小时 / 预算 '+day.budget+' 小时</span></h4><p>'+escape(intro)+'</p>';
      if(day.warning) html+='<p class="day-warning">'+escape(day.warning)+'</p>';
      html+='<ol class="journey-stops">'+day.stops.map(function(stop,i) {
        var a=stop.attraction,leg=stop.transfer;
        return '<li>'+(leg ? '<div class="journey-transfer'+(i===0?' arrival-transfer':'')+'"><strong>'+(i===0?'抵达衔接：':'')+escape(leg.from)+' → '+escape(leg.to)+'</strong><span>'+escape(leg.mode)+' · 预留约 '+leg.minutes+' 分钟 · 直线约 '+fmtKm(leg.km)+'</span><p>'+escape(leg.detail)+'</p><a href="'+escape(leg.url)+'" target="_blank" rel="noopener">打开地图查看这段交通 →</a></div>':'')+
          '<div class="journey-visit"><span class="journey-index">'+stop.sequence+'</span><div><strong>'+escape(a.name)+'</strong><span class="journey-duration">建议游览 '+escape(a.duration)+'</span><p>'+escape(a.desc)+'</p><small>'+(a.highlights || []).map(escape).join(' / ')+'</small></div></div></li>';
      }).join('')+'</ol>';
      html+='</div>';
    });
    $('routeWrap').innerHTML = html;
  }

  function renderArrival(state) {
    var arrival=state.arrival,wrap=$('arrivalWrap');wrap.hidden=!arrival.enabled;
    if(!arrival.enabled){wrap.innerHTML='';return;}
    if(!arrival.selected){wrap.innerHTML='<h3>推荐抵达站点</h3><p>'+escape(arrival.notice)+'</p>';return;}
    var selected=arrival.selected;
    var alternatives=arrival.candidates.filter(function(c){return c.index!==selected.index;}).slice(0,2);
    wrap.innerHTML='<div class="arrival-heading"><div><span class="section-kicker">ARRIVAL / 抵达建议</span><h3><span class="arrival-caption">'+(arrival.manual?'已选抵达站点':'推荐抵达站点')+'</span><span id="arrivalName">'+escape(selected.station.name)+'</span></h3></div><span class="tag">'+escape(selected.station.kind)+'</span></div>'+
      '<p>首个景点：第 '+(arrival.firstDay+1)+' 天 · '+escape(arrival.first.name)+'。直线约 <b>'+selected.firstKm.toFixed(1)+' km</b>；距已安排景点平均约 <b>'+selected.avgKm.toFixed(1)+' km</b>。</p>'+
      '<p class="arrival-rule">排序依据：首个景点距离 70% ＋ 全部已安排景点平均距离 30%。'+(state.inputs.travelMode==='高铁'?'优先使用资料标注为高铁站的候选；其他铁路站作为待核实备选。':'')+'</p>'+
      '<label class="arrival-select-label" for="arrivalSelect">抵达站点</label><select id="arrivalSelect"><option value="auto"'+(!arrival.manual?' selected':'')+'>自动推荐：'+escape(arrival.candidates[0].station.name)+'</option>'+
      arrival.candidates.map(function(c){return '<option value="'+c.index+'"'+(arrival.manual && selected.index===c.index?' selected':'')+'>'+escape(c.station.name)+' · '+(c.unconfirmed?'高铁车次待核实':escape(c.station.kind))+' · 首站 '+c.firstKm.toFixed(1)+' km</option>';}).join('')+'</select>'+
      (selected.unconfirmed?'<p class="day-warning">此站尚未确认高铁停靠信息，请先核实车次；当前推荐只比较景点距离。</p>':'')+
      (alternatives.length?'<div class="arrival-alternatives">'+alternatives.map(function(c){return '<span>备选：'+escape(c.station.name)+' · 首站 '+c.firstKm.toFixed(1)+' km'+(c.unconfirmed?'（高铁车次待核实）':'')+'</span>';}).join('')+'</div>':'')+
      '<p class="arrival-rule">这是抵达地候选，不代表从「'+escape(state.inputs.startName)+'」有对应班次。购票前请核实车次/航线、运营与实际交通。</p>'+
      (arrival.firstDay>0?'<p class="arrival-reference">抵达衔接参考：'+escape(arrival.inbound.from)+' → '+escape(arrival.inbound.to)+' · '+escape(arrival.inbound.mode)+' · 约 '+arrival.inbound.minutes+' 分钟。首个景点安排在第 '+(arrival.firstDay+1)+' 天；若先入住，请按住宿位置调整。<a href="'+escape(arrival.inbound.url)+'" target="_blank" rel="noopener">查看交通</a></p>':'<p class="arrival-rule">抵达站点 → 首个景点的交通已合并进首日路线与时间预算，接送、安检和跨城交通另行预留。</p>');
  }

  function accessText(a) {
    if (a.metro) return a.metro.line + '·' + a.metro.station + '（' + a.metro.walk + '）';
    if (a.get) return a.get;
    return '查询当地公交 / 打车前往';
  }

  function renderAttractions(attrs) {
    var wrap = $('attractionsWrap');
    if (!attrs || !attrs.length) {
      wrap.innerHTML = '<p class="empty">暂无已安排景点，可增加游玩天数或结合当地攻略调整。</p>';
      return;
    }
    var html = '';
    attrs.forEach(function (a, i) {
      var hl = (a.highlights && a.highlights.length)
        ? '<div class="attr-hl"><strong>具体玩点</strong><ul>' +
          a.highlights.map(function (h) { return '<li>' + escape(h) + '</li>'; }).join('') + '</ul></div>'
        : '';
      var searchUrl = 'https://www.baidu.com/s?wd=' + encodeURIComponent(a.name + ' 景点介绍 游玩攻略');
      html += '<div class="attr-card">' +
        '<button type="button" class="attr-head" aria-expanded="false" aria-controls="attr-body-' + i + '">' +
          '<span class="attr-title"><span class="idx">' + (i + 1) + '</span>' + escape(a.name) + ' <span class="tag">' + escape(a.category || '景点') + '</span></span>' +
          '<span class="attr-toggle" aria-hidden="true">▾</span>' +
        '</button>' +
        '<p class="attr-desc">' + escape(a.desc) + '</p>' +
        '<div class="attr-body" id="attr-body-' + i + '">' +
          hl +
          '<div class="attr-meta">' +
            (a.duration ? '<div>建议游玩：' + escape(a.duration) + '</div>' : '') +
            '<div>交通：' + escape(accessText(a)) + '</div>' +
          '</div>' +
          '<a class="attr-link" target="_blank" rel="noopener" href="' + escape(searchUrl) + '">查看详细介绍 →</a>' +
        '</div>' +
        '</div>';
    });
    wrap.innerHTML = html;
  }

  function renderFood(foods, destName) {
    var wrap = $('foodWrap');
    if (!foods || !foods.length) {
      wrap.innerHTML = '<p class="empty">暂未收录「' + escape(destName) + '」的特色美食，建议到当地口碑餐厅或美食街现场探寻。</p>';
      return;
    }
    var html = '';
    foods.forEach(function (f) {
      html += '<div class="food-card"><h4>' + escape(f.name) + '</h4><p>' + escape(f.desc) + '</p></div>';
    });
    wrap.innerHTML = html;
  }

  function renderMap(plan) {
    if (!global.TripMap) { $('map').textContent = '地图组件暂不可用，其他攻略内容可正常查看。'; return; }
    var m = TripMap.drawPlan('map', plan);
    if (m) {
      setTimeout(function () { if (global.__tripMap === m) m.invalidateSize(); }, 60);
    }
  }

  function renderStay(stations, scored) {
    var wrap = $('stayWrap');
    if (!scored || !scored.length) {
      wrap.innerHTML = '<p class="empty">未能获取居住地信息，建议住在市中心或火车站附近。</p>';
      return;
    }
    var top = scored[0];
    var html = '';
    if (stations && stations.length) {
      html += '<p class="stay-hubs">主要车站/机场：' +
        stations.slice(0, 6).map(function (s) { return escape(s.name) + '（' + escape(s.kind) + '）'; }).join('、') + '</p>';
    }
    html += '<div class="stay-top">' +
      '<div class="stay-top-head"><span class="stay-badge">首选</span><strong>' + escape(top.area.name) + '</strong>' +
        '<span class="stay-score">综合便利度 ' + top.score + '</span></div>' +
      '<p class="stay-desc">' + escape(top.area.desc) + '</p>' +
      '<p class="stay-env">环境：' + escape(top.area.env) + '</p>' +
      '<p class="stay-reason">推荐依据：' + escape(top.reason) + '</p>' +
      '<div class="stay-metrics">' +
        (top.arrivalKm != null ? '<span>距已选抵达站点约 '+top.arrivalKm+' km</span>' : '') +
        (top.avgAttr != null ? '<span>距景点平均约 ' + top.avgAttr + ' km</span>' : '') +
        (top.nearRail != null ? '<span>距车站约 ' + top.nearRail + ' km</span>' : '') +
        (top.airportDist != null ? '<span>距机场约 ' + top.airportDist + ' km</span>' : '') +
      '</div>' +
    '</div>';

    if (scored.length > 1) {
      html += '<div class="stay-alt">';
      scored.slice(1, 3).forEach(function (s) {
        html += '<div class="stay-alt-item">' +
          '<strong>' + escape(s.area.name) + '</strong> <span class="stay-score">' + s.score + '</span>' +
          '<p>' + escape(s.area.desc) + '（' + escape(s.area.env) + '）</p>' +
          '<div class="stay-metrics">' +
            (s.avgAttr != null ? '<span>景点 ' + s.avgAttr + 'km</span>' : '') +
            (s.nearRail != null ? '<span>车站 ' + s.nearRail + 'km</span>' : '') +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    wrap.innerHTML = html;
  }

  var TYPE_NAME = {
    city: '都市', historic: '历史文化', coastal: '海滨', beach: '海岛度假',
    mountain: '山水/自然', oldtown: '古城古镇'
  };


  function cancelMapRequest() {
    mapRequestId++; if (mapController) mapController.abort(); mapController=null;
    if ($('loadMapBtn')) { $('loadMapBtn').disabled=false; $('mapStatus').textContent=''; }
  }
  function drawCurrentMap() {
    var state=currentPlan;if (!state || !state.mapLoaded) return;
    var planned=state.schedule.days.flatMap(function (day) { return day.attractions; });
    var view=$('mapDayInput').value, day=Number(view), all=view==='all' || view==='travel';
    var shown=all ? planned : state.schedule.days[day].attractions;
    var markerData=shown.map(function (a) { return Object.assign({},a,{sequence:planned.indexOf(a)+1}); });
    var arrival=state.arrival && state.arrival.selected && (all || day===0) ? {station:state.arrival.selected.station,target:all || state.arrival.firstDay===0 ? state.arrival.first : null} : null;
    renderMap({start:all ? state.startGeo : null,dest:state.destGeo,attractions:markerData,
      days:(all ? state.schedule.days : [state.schedule.days[day]]).map(function (d,i) { return Object.assign({},d,{number:all ? i+1 : day+1}); }),travelRoute:all ? state.travelRoute : null,includeJourney:view==='travel',arrival:arrival});
    $('mapLegend').textContent=(all ? (state.travelRoute ? '蓝线：驾车路线参考' : '蓝线：起终点直线示意，非实际交通路线') : '第 '+(day+1)+' 天景点')+' · 橙色虚线：游览顺序示意，序号对应景点卡片'+(arrival?' · 紫色标记/连线：抵达站点与首个景点的衔接参考':'');
  }
  async function loadMap() {
    if (!currentPlan) return;
    cancelMapRequest();var token=mapRequestId,state=currentPlan;
    mapController=new AbortController();var signal=mapController.signal;
    $('loadMapBtn').disabled=true; $('mapStatus').textContent='正在加载地图…';
    try {
      await TripMap.ensureLibrary(signal);
      if (token!==mapRequestId || state!==currentPlan || signal.aborted) return;
      state.mapLoaded=true;drawCurrentMap();
      var road=['自驾','打车','大巴'].indexOf(state.inputs.travelMode)>=0;
      if (road && !state.travelRoute && state.km>1 && state.km<8000) {
        try { state.travelRoute=await TripMap.fetchTravelRoute(state.startGeo,state.destGeo,signal); }
        catch (error) { if (signal.aborted) throw error;notify('驾车路线查询失败，地图将显示直线示意。'); }
      }
      if (token!==mapRequestId || state!==currentPlan || signal.aborted) return;
      if(state.travelRoute)drawCurrentMap();
    } catch (error) {
      if (token!==mapRequestId || signal.aborted) return;
      state.mapLoaded=false;$('map').textContent='地图暂不可用，可重试加载；其他攻略内容可正常查看。';$('mapStatus').textContent='地图加载失败';
    } finally { if (token===mapRequestId) { mapController=null;$('loadMapBtn').disabled=false; } }
  }

  function renderCurrentPlan() {
    if (!currentPlan) return;
    cancelMapRequest(); $('shareWrap').hidden=true;
    var state = currentPlan, input = state.inputs, dur = DURATION_MAP[input.duration];
    var destData = state.destData, destType = destData ? destData.type : 'city';
    var planned = state.schedule.days.flatMap(function (day) { return day.attractions; });
    var arrival=TripArrival.update(state);
    state.stay.scored = TripStay.score(state.stay.areas || [],state.stay.stations,planned,input.travelMode,input.stayPreference,arrival.selected && arrival.selected.station);
    var rec = { travel:recommendTravelMode(state.km), play:recommendPlayMode(destType), duration:recommendDuration(state.selected.map(function (id) { return state.attractions[id]; })) };
    [['travelMode',rec.travel],['playMode',rec.play],['duration',rec.duration]].forEach(function (entry) {
      $(entry[0]+'Rec').textContent = '推荐：'+entry[1].mode;
      $(entry[0]+'Rec').hidden = false; markRecommended(entry[0],entry[1].mode);
    });
    renderSummary({ startName:input.startName, destName:input.destName, travelMode:input.travelMode, playMode:input.playMode,
      duration:input.duration, days:dur.days, nights:dur.nights, km:state.km },rec,destData ? {
      name:destData.name,province:destData.province,typeName:TYPE_NAME[destType] || '目的地',overview:destData.overview,tips:destData.tips
    } : null);
    renderWeather(Object.assign({},state.weather,{ archived:!!state.archived }),dur.days);
    renderClothing(TripWeather.recommendClothing(state.weather,destType,dur.days));
    renderItems(TripWeather.recommendItems({weather:state.weather,destType:destType,region:destData ? destData.region : '',
      travelMode:input.travelMode,playMode:input.playMode,tripDays:dur.days}));
    renderStay(state.stay.stations,state.stay.scored);
    renderArrival(state);
    renderRoute(state);
    $('plannerNotice').textContent = '当前节奏：'+input.pace+'。首尾日预留交通时间，市内交通按'+input.playMode+'估算。'+
      (state.schedule.remaining.length ? '备选景点：'+state.schedule.remaining.map(function (a) { return a.name; }).join('、')+'。可手动安排或增加天数。' : '开放时间与预约要求请出发前核实。');
    renderAttractions(planned);
    if (state.schedule.remaining.length) $('attractionsWrap').insertAdjacentHTML('beforeend','<p class="empty">备选景点：'+state.schedule.remaining.map(function (a) { return escape(a.name)+'（'+escape(a.duration)+'）'; }).join('、')+'</p>');
    renderFood(destData && destData.foods ? destData.foods : [],destData ? destData.name : input.destName);
    TripEditor.render(state);
    $('sourceNotice').textContent = (state.archived ? '已恢复存档，天气为保存时数据，请出发前重新查询。' : '本次生成：') + new Date(state.generatedAt).toLocaleString('zh-CN') + ' · 定位：' + [state.destGeo.name,state.destGeo.admin1,state.destGeo.country].filter(Boolean).join(' · ');
    $('results').hidden = false;
    $('statusBox').textContent = state.warnings.join(' '); $('statusBox').hidden = !state.warnings.length;
    var previous=$('mapDayInput').value;
    $('mapDayInput').innerHTML='<option value="all">目的地全部景点</option><option value="travel">含出发地的完整旅程</option>'+state.schedule.days.map(function (_,i) { return '<option value="'+i+'">第 '+(i+1)+' 天</option>'; }).join('');
    $('mapDayInput').value=previous==='all' || previous==='travel' || Number(previous)<state.schedule.days.length ? previous : 'all';
    $('mapLegend').textContent='地图尚未加载。景点连线为游览顺序示意，交通时长请另行核实。';
    if (state.mapLoaded) { try { drawCurrentMap(); } catch (error) { state.mapLoaded=false;$('map').textContent='地图暂不可用，请重新加载。'; } }
    else { if (global.__tripMap) { global.__tripMap.remove(); global.__tripMap=null; } $('map').innerHTML='<p class="empty">点击“加载地图”查看路线，可按天切换。</p>'; }

  }

  /* ---------- 主流程 ---------- */
  async function generate() {
    if(!recommendations || recommendations.name!==$('destInput').value.trim()) {
      if(await prepareRecommendations()) { $('pickerStatus').textContent+=' 请确认勾选后点击“按所选景点生成路线”。';$('pickerTitle').scrollIntoView({block:'center'}); }
      return;
    }
    if(!recommendations.selected.length) { showError('请至少勾选一个想去的景点，再生成路线。');$('pickerTitle').scrollIntoView({block:'center'});return; }
    var chosen=recommendations,selected=chosen.selected.slice();
    cancelGeneration();
    var id = requestId;
    var startName = $('startInput').value.trim(), destName = $('destInput').value.trim();
    var travelMode = selectedRadio('travelMode'), playMode = selectedRadio('playMode');
    var duration = selectedRadio('duration'), startDate = $('dateInput').value || localDate();
    var inputs = { startName:startName,destName:destName,travelMode:travelMode,playMode:playMode,duration:duration,startDate:startDate,pace:$('paceInput').value,stayPreference:$('stayPreferenceInput').value };
    var previousArrival=currentPlan && currentPlan.inputs.travelMode===travelMode && currentPlan.inputs.destName===destName && currentPlan.arrivalStationIndex!=null ? currentPlan.stay.stations[currentPlan.arrivalStationIndex] : null;
    currentPlan = null;
    $('results').hidden = true; $('statusBox').hidden = true;
    if (!startName || !destName) { showError('请填写「起点」和「终点」。'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(startDate)) || new Date(startDate).toISOString().slice(0, 10) !== startDate || startDate < localDate()) {
      showError('请选择今天或之后的有效出发日期。'); return;
    }
    showError(null); showLoading(true); $('generateBtn').disabled = true;
    activeController = new AbortController();
    var signal = activeController.signal, warnings = [];
    function optional(promise, fallback, message) {
      return promise.catch(function (error) {
        if (signal.aborted) throw error;
        warnings.push(message); return fallback;
      });
    }
    function resolvePlace(name) {
      var found = findDestination(name);
      if (found && TripCore.validPoint(found.data)) return Promise.resolve({ name: found.data.name, lat: found.data.lat, lng: found.data.lng });
      return TripWeather.geocodeCity(name, signal, TripLocation.choose);
    }
    try {
      var dur = DURATION_MAP[duration] || { days: 3, nights: 2 };
      var destData = chosen.destData;
      var places = await Promise.all([resolvePlace(startName), Promise.resolve(chosen.geo)]);
      var startGeo = places[0], destGeo = places[1], km = haversineKm(startGeo, destGeo);
      var endDate = Date.parse(startDate) + (dur.days - 1) * 86400000;
      var inForecastRange = endDate <= Date.parse(localDate()) + 15 * 86400000;
      var weatherPromise = inForecastRange
        ? optional(TripWeather.fetchWeather(destGeo.lat, destGeo.lng, dur.days, startDate, signal),
          { notice: '天气查询暂不可用，请出发前复查预报。' }, '天气查询失败，已保留其他攻略内容。')
        : Promise.resolve({ notice: '行程超出近期预报范围，请临近出发时再查询天气。' });
      var attrsPromise = Promise.resolve(chosen.attractions.slice());
      var stayPromise = attrsPromise.then(function (attrs) {
        var schedule = TripPlanner.plan(selected.map(function(i){return attrs[i];}), dur.days, destGeo,inputs);
        var planned = schedule.days.flatMap(function (day) { return day.attractions; });
        return optional(buildStayData(destData, destGeo, planned, signal, travelMode,inputs.stayPreference),
          { stations: [], areas: [], scored: [] }, '住宿区域暂不可用。');
      });
      var data = await Promise.all([weatherPromise, attrsPromise, stayPromise]);
      if (id !== requestId || signal.aborted) return;
      var weather = data[0], attractions = data[1], travelRoute = null, stay = data[2];
      var schedule = TripPlanner.plan(selected.map(function(i){return attractions[i];}),dur.days,destGeo,inputs);
      if (stay.hubUnavailable) warnings.push('车站和机场查询失败，住宿区域按景点距离估算。');
      currentPlan = { inputs:inputs,destData:destData,startGeo:startGeo,destGeo:destGeo,km:km,weather:weather,
        attractions:attractions,schedule:schedule,stay:stay,travelRoute:travelRoute,warnings:warnings,
        generatedAt:new Date().toISOString(),selected:selected,arrivalStationIndex:previousArrival ? stay.stations.findIndex(function(s){return s.name===previousArrival.name && s.lat===previousArrival.lat && s.lng===previousArrival.lng;}) : null };
      renderCurrentPlan();
      loadMap();
      $('results').scrollIntoView({ behavior: global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } catch (error) {
      if (id !== requestId || signal.aborted) return;
      activeController.abort();
      showError('生成失败：' + (error.message || '网络或数据异常，请稍后重试。'));
      $('results').hidden = true;
    } finally {
      if (id === requestId) {
        activeController = null; showLoading(false); $('generateBtn').disabled = false;
      }
    }
  }

  function notify(message) { $('statusBox').textContent=message; $('statusBox').hidden=false; }
  function applyInputs(input) {
    $('startInput').value=input.startName; $('destInput').value=input.destName; $('dateInput').value=input.startDate;
    $('paceInput').value=input.pace; $('stayPreferenceInput').value=input.stayPreference;
    ['travelMode','playMode','duration'].forEach(function (name) {
      document.querySelector('input[name="'+name+'"][value="'+input[name]+'"]').checked=true;
    });
  }
  function renderSaved() {
    try {
      $('savedWrap').innerHTML=TripStorage.list().map(function (entry,index) {
        return '<div class="saved-row"><span>'+escape(entry.data.title)+' <small>'+escape(new Date(entry.data.savedAt).toLocaleString('zh-CN'))+'</small></span><div>'+
          '<button type="button" class="btn-ghost" data-save-index="'+index+'" data-save-action="restore">恢复</button> '+
          '<button type="button" class="btn-ghost" data-save-index="'+index+'" data-save-action="remove" aria-label="删除 '+escape(entry.data.title)+'">删除</button></div></div>';
      }).join('') || '<p class="empty">尚未保存攻略。</p>';
    } catch (error) { $('savedWrap').textContent='本机保存列表不可用，请检查浏览器存储设置或通过 JSON 导出保留攻略。'; }
  }
  function restoreDocument(data) {
    var restored=TripStorage.restore(data);
    cancelGeneration();cancelRecommendations();currentPlan=restored;applyInputs(restored.inputs);
    recommendations={name:restored.inputs.destName,destData:restored.destData,geo:restored.destGeo,attractions:restored.attractions,selected:restored.selected.slice(),archived:true};
    renderRecommendations();renderCurrentPlan();loadMap();
    $('shareWrap').hidden=true;
    $('results').scrollIntoView({behavior:'auto',block:'start'});
  }

  /* ---------- 事件绑定 ---------- */
  function init() {
    TripCatalog.names().forEach(function (name) {
      var option = document.createElement('option'); option.value = name; $('destinationNames').appendChild(option);
    });
    // 默认出发日期 = 今天
    $('dateInput').value = localDate();
    $('dateInput').min = localDate();

    $('plannerForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      generate();
    });
    $('recommendBtn').addEventListener('click',prepareRecommendations);
    $('recommendedWrap').addEventListener('change',function(event) {
      if(!recommendations || !event.target.matches('[data-stop-id]')) return;
      var id=Number(event.target.dataset.stopId);
      recommendations.selected=recommendations.selected.filter(function(i){return i!==id;});
      if(event.target.checked) recommendations.selected.push(id);
      updatePickerCount();invalidateInputs();
    });
    ['selectAllStops','clearStops'].forEach(function(id) { $(id).addEventListener('click',function() {
      if(!recommendations) return;
      recommendations.selected=id==='selectAllStops' ? recommendations.attractions.map(function(_,i){return i;}) : [];
      renderRecommendations();invalidateInputs();
    }); });

    $('resetBtn').addEventListener('click', function () {
      cancelGeneration();cancelRecommendations();recommendations=null;$('recommendedWrap').innerHTML='';$('pickerTools').hidden=true;$('pickerStatus').textContent='选择目的地后，这里会展示推荐景点。';currentPlan = null; $('shareWrap').hidden = true;
      $('paceInput').value = '舒适'; $('stayPreferenceInput').value = '景点便利';
      $('dateInput').value = localDate();
      $('statusBox').hidden = true;
      $('startInput').value = '';
      $('destInput').value = '';
      document.querySelectorAll('#plannerForm input[type=radio]').forEach(function (r) { r.checked = false; });
      // 恢复默认勾选
      document.querySelector('input[name="travelMode"][value="自驾"]').checked = true;
      document.querySelector('input[name="playMode"][value="公共交通"]').checked = true;
      document.querySelector('input[name="duration"][value="三天两夜"]').checked = true;
      ['travelModeRec', 'playModeRec', 'durationRec'].forEach(function (id) { $(id).hidden = true; });
      document.querySelectorAll('.seg.rec').forEach(function (s) { s.classList.remove('rec'); });
      $('results').hidden = true;
      showError(null);
    });

    $('swapBtn').addEventListener('click', function () {
      invalidateInputs();
      var a = $('startInput').value, b = $('destInput').value;
      $('startInput').value = b; $('destInput').value = a;
      refreshDestination();
    });

    // 三个可切换模块：切换后若已有结果则自动重新生成（防抖）
    function onSwitch() {
      var shouldGenerate = !$('results').hidden || !$('loading').hidden;
      cancelGeneration();
      if (!shouldGenerate) return;
      $('results').hidden = true; showLoading(true);
      debounceTimer = setTimeout(generate, 450);
    }
    function invalidateInputs() {
      cancelGeneration(); currentPlan = null; $('shareWrap').hidden = true; $('results').hidden = true; $('statusBox').hidden = true; showError(null);
      ['travelModeRec', 'playModeRec', 'durationRec'].forEach(function (id) { $(id).hidden = true; });
      document.querySelectorAll('.seg.rec').forEach(function (seg) { seg.classList.remove('rec'); });
    }
    ['startInput', 'destInput', 'dateInput'].forEach(function (id) { $(id).addEventListener('input', invalidateInputs); });
    function refreshDestination() {
      cancelRecommendations();recommendations=null;$('recommendedWrap').innerHTML='';$('pickerTools').hidden=true;
      if(!localRecommendations()) $('pickerStatus').textContent=$('destInput').value.trim() ? '点击“查看推荐景点”，查询此目的地可选景点。' : '选择目的地后，这里会展示推荐景点。';
    }
    $('destInput').addEventListener('input',refreshDestination);
    ['paceInput','stayPreferenceInput'].forEach(function (id) { $(id).addEventListener('change',function () {
      if (!currentPlan || !$('loading').hidden) { onSwitch(); return; }
      currentPlan.inputs.pace = $('paceInput').value; currentPlan.inputs.stayPreference = $('stayPreferenceInput').value;
      if (id === 'paceInput') currentPlan.schedule = TripPlanner.plan(currentPlan.selected.map(function (index) { return currentPlan.attractions[index]; }),currentPlan.schedule.days.length,currentPlan.destGeo,currentPlan.inputs);
      renderCurrentPlan();
    }); });
    function onEdit(event) {
      if (!currentPlan) return;
      var target = event.target.closest('[data-action]'); if (!target) return;
      var action = target.dataset.action;
      if ((event.type === 'click') !== (action === 'up' || action === 'down')) return;
      var id = Number(target.dataset.id);
      TripEditor.edit(currentPlan,id,action,action === 'include' ? target.checked : target.value);
      recommendations.selected=currentPlan.selected.slice();renderRecommendations();
      renderCurrentPlan();
      var focus = $('editorWrap').querySelector('[data-id="'+id+'"][data-action="'+action+'"]'); if (focus) focus.focus({preventScroll:true});
    }
    $('editorWrap').addEventListener('change',onEdit); $('editorWrap').addEventListener('click',onEdit);
    $('arrivalWrap').addEventListener('change',function(event) {
      if(!currentPlan || event.target.id!=='arrivalSelect')return;
      var value=event.target.value;
      if(value!=='auto' && !currentPlan.arrival.candidates.some(function(c){return c.index===Number(value);}))return;
      currentPlan.arrivalStationIndex=value==='auto' ? null : Number(value);
      renderCurrentPlan();$('arrivalSelect').focus({preventScroll:true});
    });
    $('replanBtn').addEventListener('click',function () {
      if (!currentPlan) return;
      currentPlan.schedule = TripPlanner.plan(currentPlan.selected.map(function (index) { return currentPlan.attractions[index]; }),currentPlan.schedule.days.length,currentPlan.destGeo,currentPlan.inputs);renderCurrentPlan();
    });
    $('attractionsWrap').addEventListener('click', function (event) {
      var button = event.target.closest('.attr-head');
      if (!button) return;
      var open = button.closest('.attr-card').classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    });
    renderSaved();
    try { var shared=TripStorage.readShare(global.location.hash); if (shared) { applyInputs(shared);refreshDestination();notify('已载入分享的输入和偏好，请确认日期与景点后生成路线。'); } }
    catch (error) { notify('分享链接格式无效，请重新填写行程。'); }
    $('saveBtn').addEventListener('click',function () {
      if (!currentPlan) return;
      try { TripStorage.save(currentPlan); renderSaved(); notify('攻略已保存到当前浏览器，可从本机攻略列表恢复。'); }
      catch (error) { notify('保存失败：'+error.message+' 可导出 JSON 保留攻略。'); }
    });
    $('exportBtn').addEventListener('click',function () {
      if (!currentPlan) return;
      try {
        var url=URL.createObjectURL(new Blob([JSON.stringify(TripStorage.snapshot(currentPlan),null,2)],{type:'application/json'}));
        var link=document.createElement('a');link.href=url;link.download='旅行攻略-'+currentPlan.inputs.startDate+'.json';document.body.appendChild(link);link.click();link.remove();setTimeout(function () { URL.revokeObjectURL(url); },1000);
      } catch (error) { notify('导出失败：'+error.message); }
    });
    $('shareBtn').addEventListener('click',async function () {
      if (!currentPlan) return;
      if (global.location.protocol==='file:') { notify('本地文件链接无法供他人访问，请从已部署的网站复制分享链接，或导出 JSON 文件。'); return; }
      var link=TripStorage.share(currentPlan.inputs,global.location.href);
      $('shareInput').value=link; $('shareWrap').hidden=false;
      try { await navigator.clipboard.writeText(link); notify('已复制输入与偏好链接。手动行程请导出 JSON 分享。'); }
      catch (error) { $('shareInput').focus();$('shareInput').select();notify('请手动复制下方输入链接。'); }
    });
    $('importInput').addEventListener('change',async function () {
      var file=this.files[0]; if (!file) return;
      var token=requestId;
      try { if (file.size>1000000) throw new Error('文件超过 1 MB'); var data=TripStorage.parse(await file.text()); if (token!==requestId) return; restoreDocument(data); notify('已导入攻略。天气来自存档，出发前请重新查询。'); }
      catch (error) { notify('导入失败：'+error.message); }
      this.value='';
    });
    $('savedWrap').addEventListener('click',function (event) {
      var button=event.target.closest('[data-save-action]'); if (!button) return;
      try { var entry=TripStorage.list()[Number(button.dataset.saveIndex)]; if (!entry) return;
        if (button.dataset.saveAction==='restore') restoreDocument(entry.data);
        else { TripStorage.remove(entry.id);renderSaved();notify('已删除选中的本机攻略。'); }
      } catch (error) { notify('读取攻略失败：'+error.message); }
    });
    $('loadMapBtn').addEventListener('click',loadMap);
    $('mapDayInput').addEventListener('change',function () { if (currentPlan && currentPlan.mapLoaded) drawCurrentMap(); });
    $('printBtn').addEventListener('click', function () { global.print(); });
    ['travelMode', 'playMode', 'duration'].forEach(function (name) {
      document.querySelectorAll('input[name="' + name + '"]').forEach(function (r) {
        r.addEventListener('change', onSwitch);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
