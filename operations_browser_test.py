# Local-only SIM-TEST browser regression. See DRILLING_RELEASE.md.
from playwright.sync_api import sync_playwright
import json, pathlib, argparse
parser=argparse.ArgumentParser()
parser.add_argument('--base-url',default='http://127.0.0.1:8845')
parser.add_argument('--proxy',default='http://127.0.0.1:8846/soap')
parser.add_argument('--store',default='http://127.0.0.1:8847/witsml')
parser.add_argument('--output',default='operations-browser-evidence')
args=parser.parse_args()
from urllib.parse import urlparse
assert all(urlparse(u).hostname in ['127.0.0.1','localhost'] for u in [args.base_url,args.proxy,args.store]),'Fixture test is local-only'
OUT=pathlib.Path(args.output);OUT.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for mode,width,height in [('desktop',1440,1000),('mobile',390,844)]:
  c=b.new_context(viewport={'width':width,'height':height},is_mobile=mode=='mobile',has_touch=mode=='mobile')
  c.add_init_script('Object.defineProperty(navigator, "webdriver", {get:()=>false})')
  p=c.new_page(); errors=[]; calls=[]
  p.on('pageerror',lambda e:errors.append(str(e)))
  p.on('request',lambda r:calls.append(json.loads(r.post_data or '{}').get('op')) if r.url==args.proxy else None)
  p.goto(args.base_url.rstrip('/')+'/?operations');p.wait_for_selector('#dwOperations');p.wait_for_function('window.GX?.witsml?.start && window.GEO');p.wait_for_timeout(1500)
  assert p.locator('#intro').count()==0,'Operations deep link must skip the startup intro'
  assert p.locator('#opsSource').inner_text()=='TRAINING SIMULATION'
  assert p.locator('#opsScene').evaluate('(c)=>c.width>0 && c.height>0')
  assert p.locator('#opsEmpty').is_hidden()
  assert p.locator('#opsTally li').count()>0
  for v in ['torque','wob','plan','mode']:
   p.locator('[data-view="'+v+'"]').click();assert p.locator('[data-view="'+v+'"]').get_attribute('aria-pressed')=='true'
  p.locator('[data-cmd="hold"]').click();p.wait_for_timeout(500)
  assert p.locator('#opsExecution').inner_text()=='Hold active'
  dimensions=p.locator('#dwOperations').evaluate('(e)=>({width:e.clientWidth,scroll:e.scrollWidth})')
  assert dimensions['scroll']<=dimensions['width']+1,dimensions
  p.screenshot(path=str(OUT/(mode+'-training.png')),full_page=True)
  p.locator('#opsConnect').click();p.wait_for_selector('#wproxy')
  for k,v in [('wproxy',args.proxy),('wurl',args.store),('wuser','SIM-TEST'),('wpass','SIM-TEST'),('wint','10000')]:p.locator('#'+k).fill(v)
  p.locator('#wcon').click();p.wait_for_function('document.querySelector("#wlog option[value=TLOG]")')
  p.locator('#wwell').select_option('DR101L');p.locator('#wwb').select_option('WB01B02');p.wait_for_timeout(500)
  p.locator('#wlog').select_option('TLOG');p.locator('#wgo').click();p.wait_for_function('GX.witsml.WML.rows>0');p.wait_for_timeout(1500)
  p.locator('#wx').click();p.evaluate('import("./operations.js").then(m=>m.open())');p.wait_for_selector('#dwOperations');p.wait_for_timeout(700)
  assert p.locator('#opsSource').inner_text()=='WITSML SIM-TEST',p.locator('#opsSource').inner_text()
  assert p.locator('[data-cmd]:enabled').count()==0
  assert 'WB01B02' in p.locator('#opsWell').inner_text()
  assert 'No channel' in p.locator('#opsControl').inner_text()
  assert 'No mapped anti-collision data' in p.locator('#opsRadarDetail').inner_text()
  p.evaluate('window.fixtureHistory=GX.witsml.WML.hist;GX.witsml.WML.hist=[]');p.wait_for_timeout(600)
  assert p.locator('#opsSource').inner_text()=='WITSML WAITING'
  assert p.locator('[data-cmd]:enabled').count()==0
  p.evaluate('GX.witsml.WML.hist=window.fixtureHistory;window.fixtureIndexType=GX.witsml.WML.log.indexType;GX.witsml.WML.log.indexType="measured depth"');p.wait_for_timeout(600)
  assert p.locator('#opsSource').inner_text()=='WITSML TIME LOG REQUIRED'
  p.evaluate('GX.witsml.WML.log.indexType=window.fixtureIndexType');p.wait_for_timeout(600)
  assert p.locator('#opsSource').inner_text()=='WITSML SIM-TEST'
  first=p.locator('#opsFooter').inner_text()
  p.wait_for_timeout(11000);second=p.locator('#opsFooter').inner_text();assert first!=second,(first,second)
  assert p.locator('#opsTrack0').evaluate('(c)=>c.width>0 && c.height>0')
  p.locator('#opsLoadImage').click();p.wait_for_function('!document.querySelector("#opsLoadImage").disabled');p.wait_for_timeout(500)
  image=p.locator('#opsDepth').inner_text()
  assert 'MWD Image' in image,image
  p.screenshot(path=str(OUT/(mode+'-fixture.png')),full_page=True)
  p.evaluate('clearInterval(GX.witsml.WML.timer);GX.witsml.WML.timer=null;GX.witsml.WML.lastRowMs=Date.now()-180000')
  p.wait_for_timeout(650);assert p.locator('#opsSource').inner_text()=='WITSML STALE'
  assert p.locator('[data-cmd]:enabled').count()==0
  assert 'Feed stale' in p.locator('#opsControl').inner_text()
  p.screenshot(path=str(OUT/(mode+'-stale.png')),full_page=True)
  assert not errors,errors
  assert set(calls)<=set(['WMLS_GetVersion','WMLS_GetCap','WMLS_GetFromStore']),calls
  results.append({'viewport':mode,'errors':errors,'horizontalOverflow':dimensions['scroll']>dimensions['width'],'source':'WITSML SIM-TEST','fixtureSamples':[first,second],'image':image,'readOnly':True,'stale':True,'missingChannels':True,'headerOnlyNotLive':True,'depthLogNotLive':True,'readOperations':sorted(set(calls))})
  c.close()
 b.close()
print(json.dumps(results,indent=2))
(OUT/'browser-results.json').write_text(json.dumps(results,indent=2))
