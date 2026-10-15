const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const {pathToFileURL}=require('node:url');
const root = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const leafletJS = process.env.QA_LEAFLET_JS || path.join(os.tmpdir(), 'trip-planner-leaflet.js');
const leafletCSS = process.env.QA_LEAFLET_CSS || path.join(os.tmpdir(), 'trip-planner-leaflet.css');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) {res.writeHead(403);res.end();return;}
  fs.readFile(file, (error, data) => {
    if(error){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(data);
  });
});
let browser, checks = 0;
async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_BROWSER_PATH
    ? {executablePath:process.env.PLAYWRIGHT_BROWSER_PATH} : process.platform==='win32'?{channel:'msedge'}:{})});
  async function pageFor(options={}) {
    const context = await browser.newContext({viewport:{width:options.width||1280,height:900},timezoneId:'Asia/Shanghai',reducedMotion:options.motion?'no-preference':'reduce'});
    const page = await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const requests = { weather:0, route:0, geocode:0, overpass:0, attractions:0 };
    await page.route('**/*',async route=>{
      const target = route.request().url();
      if(options.noUi && target.includes('/js/ui.js'))return route.abort();
      if(options.noMotion && target.includes('/vendor/gsap/'))return route.abort();
      if(target.startsWith(url) || target.startsWith('file:')) { if(options.noMap && target.includes('/vendor/leaflet/'))return route.abort();return route.continue(); }
      if(target.includes('leaflet@1.9.4')) {
        if(options.noMap)return route.abort();
        const asset=target.endsWith('.js')?leafletJS:leafletCSS;
        if(fs.existsSync(asset)) return route.fulfill({body:fs.readFileSync(asset),contentType:target.endsWith('.js')?'application/javascript':'text/css'});
        return route.continue();
      }
      if(target.includes('geocoding-api')) {
        requests.geocode++;
        if(options.multiGeo)return route.fulfill({json:{results:[{name:'同名城',admin1:'甲省',country:'中国',latitude:30.3,longitude:120.2},{name:'同名城',admin1:'乙省',country:'中国',latitude:31.3,longitude:121.2}]}});
        if(options.geocodeFail)return route.fulfill({status:503,body:'{}'});
        return route.fulfill({json:{results:[{name:'测试城',latitude:30.3,longitude:120.2,country_code:'CN'}]}});
      }
      if(target.includes('api.open-meteo.com')) {
        requests.weather++;
        if(options.delay) await pause(options.delay);
        if(options.weatherFail)return route.fulfill({status:503,body:'{}'});
        if(options.weatherMalformed)return route.fulfill({json:{daily:{time:['2026-10-06'],temperature_2m_min:'broken'}}});
        const params=new URL(target).searchParams;
        const start=new Date(params.get('start_date')+'T00:00:00Z');
        const end=new Date(params.get('end_date')+'T00:00:00Z');
        const times=Array.from({length:Math.round((end-start)/86400000)+1},(_,i)=>new Date(+start+i*86400000).toISOString().slice(0,10));
        return route.fulfill({json:{current:{temperature_2m:35,weather_code:0,apparent_temperature:36,relative_humidity_2m:40,wind_speed_10m:5},daily:{time:times,weather_code:times.map(()=>61),temperature_2m_min:times.map(()=>5),temperature_2m_max:times.map(()=>18),precipitation_probability_max:times.map(()=>80),wind_speed_10m_max:times.map(()=>35)}}});
      }
      if(target.includes('router.project-osrm.org')) {
        requests.route++;
        if(options.routeFail)return route.fulfill({status:503,body:'{}'});
        return route.fulfill({json:{code:'Ok',routes:[{geometry:{type:'LineString',coordinates:[[116.4074,39.9042],[120.1551,30.2741]]}}]}});
      }
      if(target.includes('overpass-api.de')) {
        requests.overpass++;
        if(options.delayRecommendations)await pause(600);
        if(new URL(target).searchParams.get('data').includes('"tourism"'))requests.attractions++;
        if(options.overpassFail)return route.fulfill({status:503,body:'{}'});
        const poison='<img src=x onerror="window.__injected=true">';
        return route.fulfill({json:{elements:options.inject?[{lat:30.3,lon:120.2,tags:{tourism:'museum',name:poison}}]:options.multiGeo||options.nearby?[{lat:options.multiGeo?31.3:30.301,lon:options.multiGeo?121.2:120.201,tags:{tourism:'museum',name:'当地博物馆'}}]:[]}});
      }
      // Map tiles are deliberately replaced; tests exercise the real Leaflet code, not live tile availability.
      if(options.tileDelay && target.includes('tile.openstreetmap.org'))await pause(options.tileDelay);
      if(options.tileFail && (target.includes('basemaps.cartocdn.com')||target.includes('tile.openstreetmap.org')))return route.abort();
      if(options.blockedTile && target.includes('tile.openstreetmap.org'))return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(__dirname,'fixtures','osm-blocked.png'))});
      if(target.includes('basemaps.cartocdn.com')||target.includes('tile.openstreetmap.org'))return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aI1cAAAAASUVORK5CYII=','base64')});
      return route.abort();
    });
    await page.goto(options.localFile ? pathToFileURL(path.join(root,'index.html')).href : url,{waitUntil:'domcontentloaded'});
    return {page,context,requests,errors};
  }
  async function fill(page,dest='杭州',mode='高铁',duration='三天两夜') {
    await page.locator('#startInput').fill('北京');await page.locator('#destInput').fill(dest);
    await page.locator(`input[name="travelMode"][value="${mode}"] + span`).click();
    await page.locator(`input[name="duration"][value="${duration}"] + span`).click();
  }
  async function done(page, map=true) {
    await page.waitForFunction(()=>document.getElementById('loading').hidden&& !document.getElementById('generateBtn').disabled);
    assert.equal(await page.locator('#errorBox').isVisible(),false,await page.locator('#errorBox').textContent());
    assert.equal(await page.locator('#results').isVisible(),true);
    if(map) { await page.locator('#loadMapBtn').click();await page.waitForFunction(()=>!document.getElementById('loadMapBtn').disabled && document.getElementById('mapStatus').textContent); }
  }
  async function scenario(name,options,action) {
    const setup=await pageFor(options);try {await action(setup);assert.deepEqual(setup.errors,[]);checks++;console.log('PASS '+name);}
    finally{await setup.context.close();}
  }
  await scenario('core summary remains correct without presentation helpers',{noUi:true},async({page})=>{
    await fill(page,'杭州');
    assert.equal(await page.locator('#draftRoute').textContent(),'北京 → 杭州');
    assert.equal(await page.locator('#draftStops').textContent(),'5 个');
    assert.equal(await page.locator('#recommendBtn').isVisible(),false);
    assert.equal(await page.locator('#selectAllStops').isVisible(),false);
    await page.locator('#recommendedWrap input').first().uncheck();
    assert.equal(await page.locator('#draftStops').textContent(),'4 个');
    await page.locator('#generateBtn').click();await done(page);
    assert.equal(await page.locator('#draftStops').textContent(),'4 个');
    await page.locator('#saveBtn').click();
    await page.locator('#clearStops').click();
    assert.equal(await page.locator('#draftStops').textContent(),'0 个');
    assert.equal(await page.locator('#clearStops').isVisible(),false);
    await page.locator('#selectAllStops').click();
    assert.equal(await page.locator('#draftStops').textContent(),'5 个');
    await page.locator('[data-save-action="restore"]').first().click();
    assert.equal(await page.locator('#draftStops').textContent(),'4 个');
    await page.locator('#resetBtn').click();
    assert.equal(await page.locator('#draftStops').textContent(),'0 个');
    assert.equal(await page.locator('#draftRoute').textContent(),'先选一个目的地');
    await page.locator('#recommendBtn').click();
    assert.equal(await page.locator('#destInput').evaluate(el=>el===document.activeElement),true);
    assert.match(await page.locator('#pickerStatus').textContent(),/请先填写目的地/);
  });
  await scenario('pending recommendation action can cancel and retry instead of staying disabled',{nearby:true,delayRecommendations:true},async({page})=>{
    await fill(page,'未收录目的地');
    await page.locator('#recommendBtn').click();
    assert.equal(await page.locator('#recommendBtn').textContent(),'取消查询');
    assert.equal(await page.locator('#recommendBtn').isEnabled(),true);
    await page.locator('#recommendBtn').click();
    assert.match(await page.locator('#pickerStatus').textContent(),/已取消/);
    await pause(550);
    assert.equal(await page.locator('#recommendedWrap input').count(),0);
    await page.locator('#recommendBtn').click();
    await page.locator('#recommendedWrap input').waitFor();
    assert.equal(await page.locator('#recommendBtn').isVisible(),false);
    assert.equal(await page.locator('#draftStops').textContent(),'1 个');
  });
  await scenario('GSAP responds to selection and reduced motion clears running styles',{motion:true},async({page})=>{
    assert.equal(await page.evaluate(()=>gsap.version),'3.15.0');
    await fill(page);
    const checkbox=page.locator('#recommendedWrap input').first();
    await checkbox.focus();await checkbox.press('Space');
    assert.ok(await page.evaluate(()=>gsap.isTweening(document.querySelector('.recommended-stop'))));
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>!gsap.isTweening(document.querySelector('.recommended-stop')) && !document.querySelector('.recommended-stop').style.transform);
    assert.equal(await checkbox.evaluate(el=>el===document.activeElement),true);
    await checkbox.press('Space');
    assert.equal(await page.evaluate(()=>gsap.isTweening(document.querySelector('.recommended-stop'))),false);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('#generateBtn').click();await done(page);
    await page.locator('.attr-head').first().click();
    await page.waitForFunction(()=>gsap.isTweening(document.querySelector('.attr-body')));
    await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
    assert.ok(await page.locator('.summary-item').evaluateAll(els=>els.every(el=>!el.style.transform && !el.style.opacity)));
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('#results').isVisible(),true);
    assert.ok(await page.locator('.route-day').evaluateAll(els=>els.every(el=>!el.style.transform && !el.style.opacity)));
  });
  await scenario('GSAP missing keeps selecting generating and native details usable',{noMotion:true,motion:true},async({page})=>{
    assert.equal(await page.evaluate(()=>typeof window.gsap),'undefined');
    await fill(page);await page.locator('#advancedSettings > summary').click();
    assert.equal(await page.locator('#paceInput').isVisible(),true);
    await page.locator('#generateBtn').click();await done(page);
    assert.ok(await page.locator('.journey-visit').count()>0);
    assert.ok(await page.locator('.results-heading').evaluate(el=>getComputedStyle(el).opacity==='1'));
  });
  await scenario('workspace steps draft summary disclosures and desktop route map columns',{},async({page})=>{
    assert.equal(await page.locator('#advancedSettings').getAttribute('open'),null);
    if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'trip-workbench-empty.png')});
    await fill(page,'上海','高铁','四天三夜');
    await page.waitForFunction(()=>document.getElementById('draftStops').textContent==='5 个');
    assert.equal(await page.locator('#draftRoute').textContent(),'北京 → 上海');
    assert.equal(await page.locator('[data-step="3"]').getAttribute('aria-disabled'),'true');
    await page.locator('#tripSettings > summary').click();assert.equal(await page.locator('#durationGroup').isVisible(),false);
    await page.locator('[data-step="2"]').click();assert.equal(await page.locator('#durationGroup').isVisible(),true);
    await page.locator('#advancedSettings > summary').click();await page.locator('#paceInput').selectOption('轻松');
    assert.match(await page.locator('#preferencesSummary').textContent(),/轻松/);
    await page.locator('.header-link').click();assert.equal(await page.locator('#savedPanel').isVisible(),true);
    await page.locator('#generateBtn').click();await done(page,false);
    await page.waitForFunction(()=>document.querySelector('[data-step="3"]').getAttribute('aria-disabled')==='false');
    const boxes=await page.evaluate(()=>({route:document.getElementById('routeCard').getBoundingClientRect().toJSON(),map:document.getElementById('mapCard').getBoundingClientRect().toJSON()}));
    assert.ok(boxes.map.x>boxes.route.right);assert.ok(Math.abs(boxes.route.y-boxes.map.y)<2);
  });
  await scenario('unknown destination requires reviewing recommendations before generation',{nearby:true},async({page})=>{
    await fill(page,'未收录目的地');await page.locator('#generateBtn').click();
    await page.locator('#recommendedWrap input').waitFor();
    assert.equal(await page.locator('#results').isVisible(),false);
    await page.locator('#generateBtn').click();await done(page,false);
    assert.match(await page.locator('#routeWrap').textContent(),/当地博物馆/);
  });
  await scenario('airport choice updates entry transfer lodging map and survives save/restore',{},async({page})=>{
    await fill(page,'上海','飞机','一天一夜');await page.locator('#clearStops').click();
    await page.locator('[data-stop-id="0"]').check();await page.locator('[data-stop-id="4"]').check();
    await page.locator('#generateBtn').click();await done(page);
    assert.equal(await page.locator('#arrivalName').textContent(),'虹桥机场');
    await page.locator('#arrivalSelect').selectOption('3');
    assert.equal(await page.locator('#arrivalName').textContent(),'浦东机场');
    assert.match(await page.locator('.arrival-transfer').textContent(),/浦东机场/);
    assert.match(await page.locator('#stayWrap').textContent(),/已选抵达站点「浦东机场」/);
    assert.ok(await page.evaluate(()=>Object.values(window.__tripMap._layers).some(layer=>layer.getPopup && /抵达站点.*浦东机场/.test(layer.getPopup()?.getContent() || ''))));
    await page.locator('#saveBtn').click();await page.locator('#resetBtn').click();
    await page.locator('[data-save-action="restore"]').click();
    assert.equal(await page.locator('#arrivalName').textContent(),'浦东机场');
    assert.equal(await page.locator('#arrivalSelect').inputValue(),'3');
    await page.locator('#arrivalSelect').selectOption('auto');
    assert.equal(await page.locator('#arrivalName').textContent(),'虹桥机场');
  });
  await scenario('rail mode labels unconfirmed service and clears incompatible manual choices',{},async({page})=>{
    await fill(page,'杭州','高铁');await page.locator('#generateBtn').click();await done(page,false);
    assert.equal(await page.locator('#arrivalName').textContent(),'杭州东站');
    await page.locator('#arrivalSelect').selectOption('0');
    assert.match(await page.locator('#arrivalWrap').textContent(),/此站尚未确认高铁停靠信息/);
    await page.locator('input[name="duration"][value="四天三夜"] + span').click();await done(page,false);
    assert.equal(await page.locator('#arrivalSelect').inputValue(),'0');
    await page.locator('input[name="travelMode"][value="飞机"] + span').click();await done(page,false);
    assert.equal(await page.locator('#arrivalName').textContent(),'萧山机场');
    await page.locator('input[name="travelMode"][value="自驾"] + span').click();await done(page,false);
    assert.equal(await page.locator('#arrivalWrap').isVisible(),false);
  });
  await scenario('unavailable station lookup leaves the itinerary intact without inventing hubs',{overpassFail:true},async({page})=>{
    await fill(page,'福州','飞机','四天三夜');await page.locator('#generateBtn').click();await done(page,false);
    assert.match(await page.locator('#arrivalWrap').textContent(),/暂无匹配的机场资料/);
    assert.equal(await page.locator('#arrivalSelect').count(),0);
    assert.ok(await page.locator('.journey-visit').count()>0);
    assert.equal(await page.locator('.arrival-transfer').count(),0);
  });
  await scenario('destination change cancels stale recommendation results',{nearby:true,delayRecommendations:true},async({page})=>{
    await fill(page,'未收录目的地');await page.locator('#recommendBtn').click();
    await page.locator('#destInput').fill('杭州');await pause(800);
    assert.match(await page.locator('#recommendedWrap').textContent(),/西湖/);
    assert.doesNotMatch(await page.locator('#recommendedWrap').textContent(),/当地博物馆/);
    assert.equal(await page.locator('#recommendBtn').isEnabled(),true);
  });
  await scenario('local file page draws the bundled map without CDN',{localFile:true},async({page})=>{
    const tileRequests=[];page.on('request',request=>{if(request.url().includes('tile.openstreetmap.org'))tileRequests.push(request);});
    await page.route('**/*leaflet@1.9.4/**',route=>route.abort());
    await fill(page);await page.locator('#generateBtn').click();await done(page,false);
    await page.waitForFunction(()=>window.__tripMap && window.__tripMap._tripBasemapState==='ready');
    assert.ok(await page.locator('#map .num-marker').count()>0);
    assert.ok(tileRequests.length>0);
    assert.equal(tileRequests[0].headers()['x-requested-with'],'TravellingTripPlanner');
  });
  await scenario('HTTP 200 blocked placeholder is not accepted as a loaded basemap',{blockedTile:true},async({page})=>{
    await fill(page);await page.locator('#generateBtn').click();await done(page,false);
    await page.waitForFunction(()=>window.__tripMap && window.__tripMap._tripBasemapState==='failed');
    assert.match(await page.locator('#mapStatus').textContent(),/底图不可用/);
    assert.doesNotMatch(await page.locator('#mapStatus').textContent(),/地图已加载/);
    assert.ok(await page.locator('#map .num-marker').count()>0);
  });
  const recoverable={tileFail:true,tileDelay:500};
  await scenario('basemap loading is honest and retry recovers after network failure',recoverable,async({page})=>{
    await fill(page);await page.locator('#generateBtn').click();await done(page,false);
    await page.waitForFunction(()=>window.__tripMap && window.__tripMap._tripBasemapState==='loading');
    assert.doesNotMatch(await page.locator('#mapStatus').textContent(),/地图已加载/);
    await page.waitForFunction(()=>window.__tripMap._tripBasemapState==='failed');
    recoverable.tileFail=false;recoverable.tileDelay=0;
    await page.locator('#loadMapBtn').click();
    await page.waitForFunction(()=>window.__tripMap._tripBasemapState==='ready');
    assert.equal(await page.locator('#mapTileNotice').isVisible(),false);
  });
  await scenario('choose attractions before generating and see transport inside each day',{},async({page})=>{
    await fill(page,'天津','高铁','一天一夜');
    assert.equal(await page.locator('#results').isVisible(),false);
    assert.equal(await page.locator('#recommendedWrap input').count(),5);
    await page.locator('#clearStops').click();await page.locator('#generateBtn').click();
    assert.match(await page.locator('#errorBox').textContent(),/至少勾选/);
    await page.locator('[data-stop-id="0"]').check();await page.locator('[data-stop-id="4"]').check();
    await page.locator('#generateBtn').click();await done(page,false);
    assert.equal(await page.locator('.journey-visit').count(),2);
    assert.equal(await page.locator('.journey-transfer:not(.arrival-transfer)').count(),1);
    assert.match(await page.locator('.journey-transfer:not(.arrival-transfer)').textContent(),/公交 \/ 地铁/);
    const href=await page.locator('.journey-transfer:not(.arrival-transfer) a').getAttribute('href');
    const link=new URL(href);assert.equal(link.hostname,'uri.amap.com');assert.equal(link.searchParams.get('mode'),'bus');
    assert.equal(link.searchParams.get('coordinate'),'wgs84');
    assert.equal(await page.locator('#routeWrap').textContent().then(text=>text.includes('五大道')),false);
    await page.locator('input[name="playMode"][value="自驾"] + span').click();await done(page,false);
    assert.equal(await page.locator('.journey-visit').count(),2);
    assert.match(await page.locator('.journey-transfer:not(.arrival-transfer)').textContent(),/自驾/);
    await page.locator('#destInput').fill('福州');
    assert.equal(await page.locator('#recommendedWrap input').count(),4);
    assert.equal(await page.locator('#results').isVisible(),false);
  });
  await scenario('local map survives blocked CDN and reports failed basemaps',{tileFail:true},async({page})=>{
    await page.route('**/*leaflet@1.9.4/**',route=>route.abort());
    await fill(page);await page.locator('#generateBtn').click();await done(page,false);
    await page.waitForFunction(()=>window.__tripMap && window.__tripMap._tripBasemapState==='failed');
    await page.locator('#mapTileNotice').waitFor({state:'visible'});
    assert.match(await page.locator('#mapTileNotice').textContent(),/底图|路线示意/);
    assert.ok(await page.locator('#map .num-marker').count()>0);
    const center=await page.evaluate(()=>window.__tripMap.getCenter());
    assert.ok(Math.abs(center.lng-120.15)<1);assert.ok(Math.abs(center.lat-30.27)<1);
  });
  await scenario('supplemented cities retain editable attractions when Overpass fails',{overpassFail:true},async({page,requests})=>{
    for(const [city,landmark] of [['石家庄','河北博物院'],['太原','晋祠'],['沈阳','沈阳故宫'],['大连','星海广场'],['长春','伪满皇宫博物院'],['合肥','包公园'],['南昌','滕王阁'],['福州','三坊七巷']]) {
      await page.locator('#resetBtn').click();
      await fill(page,city,'高铁','四天三夜');await page.locator('#generateBtn').click();await done(page,false);
      assert.equal(await page.locator('#editorWrap input[type="checkbox"]').count(),4,city);
      assert.match(await page.locator('#editorWrap').textContent(),new RegExp(landmark),city);
    }
    assert.equal(requests.attractions,0);
  });
  await scenario('inspiration shortcut and accessible section navigation',{},async({page})=>{
    await page.keyboard.press('Tab');await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'plannerForm');
    await page.locator('.quick-routes button').first().click();
    assert.equal(await page.locator('#results').isVisible(),false);
    await page.locator('#generateBtn').click();await done(page,false);
    assert.equal(await page.locator('#startInput').inputValue(),'北京');
    assert.equal(await page.locator('#destInput').inputValue(),'杭州');
    await page.locator('.result-nav a[href="#routeCard"]').click();
    await page.waitForFunction(()=>document.querySelector('.result-nav a[aria-current]').hash==='#routeCard');
    const positions=await page.evaluate(()=>({target:document.getElementById('routeCard').getBoundingClientRect().top,nav:document.querySelector('.result-nav').getBoundingClientRect().bottom}));
    assert.ok(positions.target>=positions.nav);
  });
  await scenario('ambiguous locations require selection and cancellation is safe',{multiGeo:true},async({page})=>{
    await fill(page,'同名城');await page.locator('#recommendBtn').click();
    await page.locator('#locationDialog').waitFor({state:'visible'});
    await page.locator('.location-choice').nth(1).click();await page.locator('#recommendedWrap input').waitFor();await page.locator('#generateBtn').click();await done(page);
    assert.match(await page.locator('#sourceNotice').textContent(),/乙省/);
    await page.locator('#resetBtn').click();await fill(page,'同名城');await page.locator('#recommendBtn').click();
    await page.locator('#locationDialog').waitFor({state:'visible'});await page.locator('#cancelLocationBtn').click();
    await page.locator('#errorBox').waitFor({state:'visible'});assert.equal(await page.locator('#results').isVisible(),false);
    assert.equal(await page.locator('#generateBtn').isEnabled(),true);
  });
  await scenario('reset closes pending location dialog and queued requests',{multiGeo:true},async({page})=>{
    await fill(page,'同名城');await page.locator('#startInput').fill('另一同名城');await page.locator('#recommendBtn').click();
    await page.locator('#locationDialog').waitFor({state:'visible'});
    await page.evaluate(()=>document.getElementById('resetBtn').click());await pause(200);
    assert.equal(await page.locator('#locationDialog').isVisible(),false);
    assert.equal(await page.locator('#results').isVisible(),false);
  });
  await scenario('map loads automatically from local assets and daily view retains numbering',{},async({page,requests})=>{
    assert.equal(await page.evaluate(()=>!!window.L),false);
    await fill(page);await page.locator('#generateBtn').click();await done(page,false);
    await page.waitForFunction(()=>window.L && window.__tripMap && window.__tripMap._tripBasemapState==='ready');assert.equal(requests.route,0);
    assert.equal(await page.evaluate(()=>!!window.L),true);
    await page.locator('#mapDayInput').selectOption('1');assert.match(await page.locator('#mapLegend').textContent(),/第 2 天/);
  });
  await scenario('editing updates route, shows overload and can exclude stops',{},async({page})=>{
    await fill(page,'上海','高铁','四天三夜');await page.locator('#generateBtn').click();await done(page,false);
    await page.locator('.editor-panel summary').click();
    await page.locator('[data-action="day"][data-id="3"]').selectOption('0');
    assert.match(await page.locator('#routeWrap').textContent(),/超过当日时间预算/);
    await page.locator('[data-action="include"][data-id="3"]').uncheck();
    assert.doesNotMatch(await page.locator('#routeWrap').textContent(),/上海迪士尼乐园/);
    await page.locator('#advancedSettings > summary').click();await page.locator('#paceInput').selectOption('轻松');assert.match(await page.locator('#plannerNotice').textContent(),/轻松/);
  });
  await scenario('quiet preference changes area recommendation with explanation',{},async({page})=>{
    await fill(page);await page.locator('#generateBtn').click();await done(page,false);
    await page.locator('#advancedSettings > summary').click();await page.locator('#stayPreferenceInput').selectOption('安静休闲');
    assert.match(await page.locator('#stayWrap').textContent(),/清幽或安静/);
  });
  await scenario('save restore export import preserve manual ordering',{},async({page})=>{
    await fill(page,'杭州');await page.locator('#generateBtn').click();await done(page,false);
    await page.locator('.editor-panel summary').click();
    await page.locator('[data-action="day"][data-id="0"]').selectOption('1');
    const before=await page.locator('#routeWrap').textContent();
    await page.locator('#saveBtn').click();assert.equal(await page.locator('[data-save-action="restore"]').count(),1);
    const downloadPromise=page.waitForEvent('download');await page.locator('#exportBtn').click();const download=await downloadPromise;
    const payload=fs.readFileSync(await download.path(),'utf8');assert.equal(JSON.parse(payload).version,1);
    await page.locator('#resetBtn').click();await page.locator('[data-save-action="restore"]').click();
    assert.equal(await page.locator('#routeWrap').textContent(),before);assert.match(await page.locator('#sourceNotice').textContent(),/存档/);
    assert.match(await page.locator('#weatherWrap').textContent(),/存档时/);
    await page.locator('#resetBtn').click();await page.locator('#importInput').setInputFiles({name:'trip.json',mimeType:'application/json',buffer:Buffer.from(payload)});
    await page.locator('#results').waitFor({state:'visible'});assert.equal(await page.locator('#routeWrap').textContent(),before);
    await page.locator('[data-save-action="remove"]').click();assert.equal(await page.locator('[data-save-action="restore"]').count(),0);
  });
  await scenario('invalid import is rejected without replacing current plan',{},async({page})=>{
    await fill(page);await page.locator('#generateBtn').click();await done(page,false);const before=await page.locator('#sumRoute').textContent();
    await page.locator('#importInput').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":9}')});
    await page.waitForFunction(()=>document.getElementById('statusBox').textContent.includes('导入失败'));
    assert.equal(await page.locator('#sumRoute').textContent(),before);
  });
  await scenario('share restores inputs without automatic network requests',{},async({page,requests})=>{
    await fill(page);await page.locator('#generateBtn').click();await done(page,false);
    await page.locator('#shareBtn').click();const link=await page.locator('#shareInput').inputValue();
    const oldCalls=requests.weather;await page.goto(link);await page.reload();assert.equal(await page.locator('#destInput').inputValue(),'杭州');
    assert.equal(requests.weather,oldCalls);assert.equal(await page.locator('#results').isVisible(),false);
  });
  await scenario('normal generation, local geocoding, real map, keyboard expansion',{},async({page,requests})=>{
    assert.equal(await page.locator('#results').isVisible(),false);
    await fill(page);await page.locator('#generateBtn').click();await done(page);
    assert.equal(requests.geocode,0);assert.equal(requests.route,0);
    assert.match(await page.locator('#stayWrap').textContent(),/首选/);
    assert.match(await page.locator('#mapLegend').textContent(),/直线示意/);
    assert.match(await page.locator('#clothingWrap').textContent(),/最低 5/);
    assert.equal(await page.locator('#map .leaflet-pane').count()>0,true);
    const first=page.locator('.attr-head').first();await first.focus();await page.keyboard.press('Enter');
    assert.equal(await first.getAttribute('aria-expanded'),'true');await page.keyboard.press('Space');
    assert.equal(await first.getAttribute('aria-expanded'),'false');
    const mapInfo=await page.evaluate(()=>({layers:Object.keys(window.__tripMap._layers).length,center:window.__tripMap.getCenter()}));
    assert.ok(mapInfo.layers>3);
    await page.locator('input[name="duration"][value="四天三夜"] + span').click();await done(page);
    assert.match(await page.locator('#sumDuration').textContent(),/四天/);
  });
  await scenario('weather failure retains itinerary and neutral clothing',{weatherFail:true},async({page})=>{
    await fill(page);await page.locator('#generateBtn').click();await done(page);
    assert.match(await page.locator('#weatherWrap').textContent(),/暂不可用/);
    assert.match(await page.locator('#clothingWrap').textContent(),/天气暂不可用/);
    assert.match(await page.locator('#statusBox').textContent(),/天气查询失败/);
  });
  await scenario('malformed weather data degrades without losing itinerary',{weatherMalformed:true},async({page})=>{
    await fill(page);await page.locator('#generateBtn').click();await done(page);
    assert.match(await page.locator('#weatherWrap').textContent(),/暂不可用/);
  });
  await scenario('road route failure is labelled as schematic',{routeFail:true},async({page})=>{
    await fill(page,'杭州','自驾');await page.locator('#generateBtn').click();await done(page);
    assert.match(await page.locator('#mapLegend').textContent(),/非实际交通路线/);
    assert.match(await page.locator('#statusBox').textContent(),/驾车路线查询失败/);
  });
  await scenario('CDN/map unavailable does not prevent generation',{noMap:true},async({page})=>{
    await fill(page);await page.locator('#generateBtn').click();await done(page);
    assert.match(await page.locator('#map').textContent(),/地图暂不可用/);
  });
  await scenario('reset during a request prevents old results from reappearing',{delay:800},async({page})=>{
    await fill(page);await page.locator('#generateBtn').click();await page.waitForFunction(()=>!document.getElementById('loading').hidden);
    await page.locator('#resetBtn').click();await pause(1100);
    assert.equal(await page.locator('#results').isVisible(),false);
    assert.equal(await page.locator('#loading').isVisible(),false);
    assert.equal(await page.locator('#startInput').inputValue(),'');
    assert.equal(await page.locator('#generateBtn').isEnabled(),true);
  });
  await scenario('rapid switching during loading renders latest settings only',{delay:650},async({page})=>{
    await fill(page);await page.locator('#generateBtn').click();
    await page.locator('input[name="duration"][value="四天三夜"] + span').click();
    await page.locator('input[name="duration"][value="六天五夜"] + span').click();
    await page.locator('input[name="playMode"][value="租车"] + span').click();await done(page);
    assert.match(await page.locator('#sumDuration').textContent(),/六天/);
    assert.equal(await page.locator('#sumPlay').textContent(),'租车');
    await pause(900);assert.match(await page.locator('#sumDuration').textContent(),/六天/);
  });
  await scenario('reset cancels a pending debounce',{},async({page})=>{
    await fill(page);await page.locator('#generateBtn').click();await done(page);
    await page.locator('input[name="duration"][value="六天五夜"] + span').click();
    await page.locator('#resetBtn').click();await pause(700);
    assert.equal(await page.locator('#loading').isVisible(),false);assert.equal(await page.locator('#errorBox').isVisible(),false);
    assert.equal(await page.locator('#results').isVisible(),false);
  });
  await scenario('untrusted destination and external attraction remain inert',{inject:true},async({page})=>{
    const poison='<img src=x onerror="window.__injected=true">';
    await fill(page,poison);await page.locator('#recommendBtn').click();await page.locator('#recommendedWrap input').waitFor();await page.locator('#generateBtn').click();await done(page);
    assert.match(await page.locator('#foodWrap').textContent(),/<img src=x/);
    assert.match(await page.locator('#attractionsWrap').textContent(),/<img src=x/);
    assert.equal(await page.locator('#results img[src="x"]').count(),0);
    assert.equal(await page.evaluate(()=>window.__injected),undefined);
    await page.evaluate(()=>window.__tripMap.eachLayer(layer=>{if(layer.getPopup)layer.openPopup();}));
    assert.equal(await page.locator('#map img[src="x"]').count(),0);
  });
  await scenario('future dates beyond forecast range do not call weather',{},async({page,requests})=>{
    await fill(page);await page.locator('#dateInput').fill('2099-01-01');
    await page.locator('#generateBtn').click();await done(page);
    assert.equal(requests.weather,0);assert.match(await page.locator('#weatherWrap').textContent(),/超出近期预报范围/);
  });
  await scenario('geocoding failure restores the form',{geocodeFail:true},async({page})=>{
    await fill(page,'未知地点');await page.locator('#generateBtn').click();
    await page.locator('#errorBox').waitFor({state:'visible'});
    assert.equal(await page.locator('#generateBtn').isEnabled(),true);
    assert.equal(await page.locator('#results').isVisible(),false);
  });
  await scenario('one day and one night keeps return on the following day',{},async({page})=>{
    await fill(page,'杭州','高铁','一天一夜');await page.locator('#generateBtn').click();await done(page);
    assert.match(await page.locator('#routeWrap').textContent(),/次日预留返程/);
  });
  for(const width of [320,375,768,1280])await scenario('responsive and print at '+width+'px',{width},async({page})=>{
    await fill(page,'上海','飞机','四天三夜');
    await page.evaluate(()=>document.getElementById('pickerTitle').scrollIntoView({block:'start'}));
    if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'trip-picker-'+width+'.png')});
    await page.locator('#generateBtn').click();await done(page);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.evaluate(()=>window.scrollTo(0,0));
    if(process.env.QA_SCREENSHOT_DIR) {
      await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'trip-'+width+'.png'),fullPage:true});
      await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'trip-input-'+width+'.png')});
      await page.locator('#results').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'trip-results-'+width+'.png')});
      await page.evaluate(()=>document.getElementById('routeCard').scrollIntoView({block:'start'}));
      await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'trip-route-'+width+'.png')});
      await page.evaluate(()=>document.getElementById('mapCard').scrollIntoView({block:'start'}));
      await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'trip-map-'+width+'.png')});
    }
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.input-panel').isVisible(),false);
    assert.equal(await page.locator('#results').isVisible(),true);
    assert.equal(await page.locator('.attr-body').first().isVisible(),true);
    assert.equal(await page.locator('#arrivalSelect').isVisible(),false);
    assert.equal(await page.locator('#arrivalName').isVisible(),true);
  });
  console.log('Browser scenarios passed: '+checks);
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));});
