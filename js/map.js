/* ============================================================
 * 地图模块：Leaflet（无需 API Key）
 *  - OpenStreetMap 底图；file:// 请求携带应用标识
 *  - 底图失败保留路线示意；状态以实际瓦片结果为准
 *  - 起点 → 目的地行进路线（OSRM，失败退化为直线）
 *  - 景点游玩路线（序号标记 + 连线）
 * ============================================================ */
(function (global) {
  'use strict';

  var OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';

  function loadAsset(tag, url, signal) {
    return new Promise(function (resolve,reject) {
      var element=document.createElement(tag), timer;
      function cleanup() { clearTimeout(timer); signal.removeEventListener('abort',abort); element.onload=null; element.onerror=null; }
      function finish(error) { cleanup(); if (error) { element.remove();reject(error); } else resolve(); }
      function abort() { finish(new DOMException('地图加载已取消','AbortError')); }
      if (signal.aborted) { abort();return; }
      if (tag==='link') { element.rel='stylesheet';element.href=url; } else { element.src=url;element.async=true; }
      element.onload=function () { finish(); };element.onerror=function () { finish(new Error('地图组件下载失败')); };
      signal.addEventListener('abort',abort,{once:true});timer=setTimeout(function () { finish(new Error('地图组件下载超时')); },6000);
      document.head.appendChild(element);
    });
  }
  async function ensureLibrary(signal) {
    if (global.L) return;
    var prefixes=['vendor/leaflet/','https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/','https://unpkg.com/leaflet@1.9.4/dist/'];
    var lastError;
    for (var i=0;i<prefixes.length;i++) {
      try { await loadAsset('link',prefixes[i]+'leaflet.css',signal);await loadAsset('script',prefixes[i]+'leaflet.js',signal);return; }
      catch (error) { if (signal.aborted) throw error;lastError=error; }
    }
    throw lastError;
  }

  // Actual HTTP-200 access-blocked tile observed during live verification.
  var BLOCKED_TILE_HASH='b02c44252dac5a5e820ecef1e9bf9200e9407c042df668a466a1aa81a9ecca7a';
  function createBaseLayers() {
    var IdentifiedTiles=L.TileLayer.extend({
      createTile:function(coords,done) {
        var tile=document.createElement('img'),controller=new AbortController(),finished=false,objectUrl=null;
        tile.alt='';tile.setAttribute('role','presentation');
        function cleanup() { clearTimeout(timer);if(objectUrl)URL.revokeObjectURL(objectUrl);tile.onload=null;tile.onerror=null; }
        function complete(error) {
          if(finished)return;finished=true;cleanup();
          tile._tripValid=!error;tile._tripFailed=!!error;done(error || null,tile);
        }
        tile._tripCancel=function() { if(finished)return;finished=true;controller.abort();cleanup(); };
        var timer=setTimeout(function(){controller.abort();complete(new Error('底图请求超时'));},10000);
        var options={signal:controller.signal,referrerPolicy:'strict-origin-when-cross-origin'};
        // file:// has no HTTP Referer. OSM documents this application-ID header.
        if(global.location.protocol==='file:')options.headers={'X-Requested-With':'TravellingTripPlanner'};
        fetch(this.getTileUrl(coords),options).then(async function(response) {
          if(!response.ok)throw new Error('底图请求失败：'+response.status);
          if(!/^image\//i.test(response.headers.get('content-type') || ''))throw new Error('底图返回的不是图片');
          var blob=await response.blob();
          if(global.crypto && global.crypto.subtle) {
            var digest=await global.crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
            var hash=Array.from(new Uint8Array(digest)).map(function(n){return n.toString(16).padStart(2,'0');}).join('');
            if(hash===BLOCKED_TILE_HASH)throw new Error('底图返回访问受限提示图');
          }
          if(finished)return;
          tile.onload=function(){complete();};tile.onerror=function(){complete(new Error('底图图片无法解码'));};
          objectUrl=URL.createObjectURL(blob);tile.src=objectUrl;
        }).catch(function(error){complete(error);});
        return tile;
      }
    });
    var osm=new IdentifiedTiles('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19
    });
    osm.on('tileunload',function(event){if(event.tile._tripCancel)event.tile._tripCancel();});
    return {'OpenStreetMap':osm,'仅路线示意（无底图）':L.layerGroup()};
  }

  /** OSRM 行进路线（GeoJSON LineString） */
  async function fetchTravelRoute(start, dest, signal) {
    var url = OSRM_URL +
      start.lng + ',' + start.lat + ';' + dest.lng + ',' + dest.lat +
      '?overview=full&geometries=geojson&alternatives=false';
    var json = await TripCore.requestJSON(url, { signal: signal, ttl: 3600000 });
    if (json.code !== 'Ok' || !json.routes || !json.routes.length) {
      throw new Error('OSRM 无可用路线');
    }
    var geometry = json.routes[0].geometry;
    if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates) || !geometry.coordinates.length ||
      !geometry.coordinates.every(function (c) { return Array.isArray(c) && TripCore.validPoint({ lat: c[1], lng: c[0] }); })) throw new Error('路线坐标无效');
    return geometry;
  }

  function numberIcon(i) {
    return L.divIcon({
      className: '',
      html: '<div class="num-marker">' + i + '</div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  function drawPlan(containerId, plan) {
    var container = document.getElementById(containerId);
    if (!container) return null;

    // 销毁旧实例
    if (container._leaflet_id && global.__tripMap) {
      try { global.__tripMap.remove(); } catch (e) { /* ignore */ }
      global.__tripMap = null;
    }

    var points = [];
    var start = plan.start, dest = plan.dest;
    var attrs = plan.attractions || [];
    var arrival=plan.arrival && plan.arrival.station;

    container.replaceChildren();
    var map = L.map(containerId, { scrollWheelZoom: true });
    global.__tripMap = map;

    var BASELAYERS = createBaseLayers();
    var primary=BASELAYERS.OpenStreetMap,fallback=BASELAYERS['仅路线示意（无底图）'];
    var notice=document.getElementById('mapTileNotice'),status=document.getElementById('mapStatus'),tileTimer;
    function publish(state,message,detail) {
      if(global.__tripMap!==map)return;
      map._tripBasemapState=state;if(status)status.textContent=message;
      if(notice){notice.hidden=!detail;notice.textContent=detail || '';}
    }
    function failBasemap() {
      clearTimeout(tileTimer);
      // Leaflet still accesses its map after dispatching the final tile event.
      // Remove the layer after that callback stack has finished.
      queueMicrotask(function() {
        if(global.__tripMap!==map)return;
        if(map.hasLayer(primary))map.removeLayer(primary);
        fallback.addTo(map);
        publish('failed','底图不可用，已显示路线示意','在线底图加载失败或返回访问受限提示，当前保留景点和路线示意。可在图层菜单重新选择 OpenStreetMap，或通过交通链接查看实际地图。');
      });
    }
    function beginLoading() {
      clearTimeout(tileTimer);publish('loading','路线已绘制，底图加载中…');
      tileTimer=setTimeout(failBasemap,12000);
    }
    primary.on('loading',beginLoading);
    primary.on('load',function() {
      clearTimeout(tileTimer);
      var tiles=Object.values(primary._tiles).filter(function(t){return t.current;});
      var ready=tiles.filter(function(t){return t.el._tripValid;}).length;
      var failed=tiles.filter(function(t){return t.el._tripFailed;}).length;
      if(!ready){failBasemap();return;}
      if(failed)publish('partial','部分底图已加载','部分底图加载失败，空缺区域可通过交通链接查询，或切换图层后重试。');
      else publish('ready','地图已加载（OpenStreetMap）');
    });
    map.on('baselayerchange',function(event) {
      if(event.layer===fallback){clearTimeout(tileTimer);publish('schematic','路线示意（未使用在线底图）','当前仅显示景点位置与路线示意；选择 OpenStreetMap 可重新加载在线底图。');}
    });
    map.on('unload',function(){clearTimeout(tileTimer);});
    beginLoading();
    primary.addTo(map);

    addLayerControl(map, BASELAYERS);
    if(TripCore.validPoint(arrival)) {
      points.push([arrival.lat,arrival.lng]);
      L.circleMarker([arrival.lat,arrival.lng],{radius:10,color:'#7655a1',weight:3,fillOpacity:.85}).addTo(map)
        .bindPopup('<b>抵达站点</b><br>'+TripCore.escapeHTML(arrival.name));
      if(TripCore.validPoint(plan.arrival.target))L.polyline([[arrival.lat,arrival.lng],[plan.arrival.target.lat,plan.arrival.target.lng]],{color:'#7655a1',weight:4,dashArray:'6 5'})
        .addTo(map).bindPopup('抵达站点 → 首个景点：直线衔接参考，非实际道路');
    }

    // 起点 / 终点
    if (start && start.lat != null) {
      points.push([start.lat, start.lng]);
      L.circleMarker([start.lat, start.lng], {
        radius: 9, color: '#16a34a', weight: 3, fillColor: '#16a34a', fillOpacity: 0.9
      }).addTo(map).bindPopup('<b>起点</b><br>' + TripCore.escapeHTML(start.name));
    }
    if (dest && dest.lat != null) {
      points.push([dest.lat, dest.lng]);
      L.circleMarker([dest.lat, dest.lng], {
        radius: 9, color: '#dc2626', weight: 3, fillColor: '#dc2626', fillOpacity: 0.9
      }).addTo(map).bindPopup('<b>目的地</b><br>' + TripCore.escapeHTML(dest.name));
    }

    // 行进路线（蓝）
    if (plan.travelRoute && plan.travelRoute.coordinates && plan.travelRoute.coordinates.length) {
      var latlngs = plan.travelRoute.coordinates.map(function (c) { return [c[1], c[0]]; });
      L.polyline(latlngs, { color: '#2f6bff', weight: 4, opacity: 0.85, dashArray: '8 6' }).addTo(map).bindPopup('驾车路线参考');
      plan.travelRoute.coordinates.forEach(function (c) { points.push([c[1], c[0]]); });
    } else if (start && start.lat != null && dest && dest.lat != null) {
      L.polyline([[start.lat, start.lng], [dest.lat, dest.lng]], {
        color: '#2f6bff', weight: 4, opacity: 0.85, dashArray: '8 6'
      }).addTo(map).bindPopup('起终点直线示意，非实际交通路线');
    }

    // Draw each day's schematic separately, without linking overnight stops.
    (plan.days || [{ attractions: attrs }]).forEach(function (day, index) {
      var stops = day.attractions.filter(TripCore.validPoint).map(function (a) { return [a.lat, a.lng]; });
      if (stops.length > 1) L.polyline(stops, { color: '#ff8a2a', weight: 4, opacity: 0.9, dashArray: '4 6' })
        .addTo(map).bindPopup('第 ' + (day.number || index + 1) + ' 天游览顺序示意');
    });

    // 景点游玩路线（橙）+ 序号
    if (attrs.length) {
      attrs.forEach(function (a) { if (a.lat != null) points.push([a.lat, a.lng]); });
      attrs.forEach(function (a, i) {
        if (a.lat == null) return;
        L.marker([a.lat, a.lng], { icon: numberIcon(a.sequence || i + 1) })
          .addTo(map)
          .bindPopup('<b>' + (a.sequence || i + 1) + '. ' + TripCore.escapeHTML(a.name) + '</b><br>' + (a.category ? ('[' + TripCore.escapeHTML(a.category) + '] ') : ''));
      });
    }

    if (points.length) {
      var focus=attrs.length && !plan.includeJourney ? attrs.filter(TripCore.validPoint).map(function(a){return [a.lat,a.lng];}) : points;
      if(!plan.includeJourney && TripCore.validPoint(arrival))focus=focus.concat([[arrival.lat,arrival.lng]]);
      map.fitBounds(L.latLngBounds(focus.length ? focus : points), { padding: [30, 30],maxZoom:15 });
    } else if (dest && dest.lat != null) {
      map.setView([dest.lat, dest.lng], 12);
    }

    return map;
  }

  function addLayerControl(map, layers) {
    var control = L.control.layers(
      layers,
      null, { position: 'topright' }
    );
    control.addTo(map);
    map._controlLayers = control;
  }

  global.TripMap = { ensureLibrary:ensureLibrary, fetchTravelRoute: fetchTravelRoute, drawPlan: drawPlan };
})(window);
