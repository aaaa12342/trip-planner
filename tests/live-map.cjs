/* Opt-in, one-viewport live verification. No pan/zoom, prefetch or tile archive. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let browser;
(async()=>{
  browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.url().includes('tile.openstreetmap.org'))requests.push(request);});
  // Weather is unrelated to this probe; only the actual map tiles are checked live.
  await page.route('**/v1/forecast?**',route=>route.abort());
  await page.goto(pathToFileURL(path.resolve(__dirname,'..','index.html')).href);
  await page.locator('#startInput').fill('北京');await page.locator('#destInput').fill('杭州');
  await page.locator('input[name="travelMode"][value="高铁"] + span').click();
  await page.locator('#clearStops').click();
  await page.locator('[data-stop-id="0"]').check();await page.locator('[data-stop-id="1"]').check();
  await page.locator('#generateBtn').click();
  await page.waitForFunction(()=>window.__tripMap && ['ready','partial','failed'].includes(window.__tripMap._tripBasemapState),{},{timeout:45000});
  await page.evaluate(()=>document.getElementById('routeCard').scrollIntoView({block:'start'}));
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#map .leaflet-tile')).filter(t=>t._tripValid).every(t=>Number(getComputedStyle(t).opacity)===1));
  const result=await page.evaluate(()=>({
    state:window.__tripMap._tripBasemapState,status:document.getElementById('mapStatus').textContent,
    markers:document.querySelectorAll('#map .num-marker').length,
    navigation:Array.from(document.querySelectorAll('.result-nav a')).map(a=>a.textContent),
    tiles:Array.from(document.querySelectorAll('#map .leaflet-tile')).filter(t=>t._tripValid).length
  }));
  assert.equal(result.state,'ready',JSON.stringify(result));assert.ok(result.tiles>0);
  assert.equal(result.markers,2);assert.deepEqual(errors,[]);
  assert.deepEqual(result.navigation,['概览','行程','地图','天气','住宿','景点']);
  assert.ok(requests.length>0);assert.ok(requests.every(r=>r.headers()['x-requested-with']==='TravellingTripPlanner'));
  if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'trip-map-live-fixed.png')});
  console.log(JSON.stringify({...result,tileRequests:requests.length,weather:'mocked failure; map tiles live'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
