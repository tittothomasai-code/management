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
  p.goto(args.base_url.rstrip('/')+'/?operations');p.wait_for_selector('#dwOperations');p.wait_for_function('window.GX?.witsml?.start && window.GEO && window.GX?.player',timeout=120000);p.wait_for_timeout(1500)
  assert p.locator('#intro').count()==0,'Operations deep link must skip the startup intro'
  assert p.locator('#plJoin').count()==0,'Observer mode must not require a simulator player profile'
  def badge():
    return p.locator('#opsSource').inner_text()
  def kind(text):
    return text.split(' · ',1)[0]
  assert badge()=='TRAINING SIMULATION'
  p.evaluate('GX.witsml.open()');p.wait_for_selector('#wproxy')
  assert p.locator('#dwOperations').is_visible()
  assert p.locator('#wproxy').evaluate('(e)=>{const r=e.getBoundingClientRect();return e===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)}'),'WITSML panel must stay above the operations overlay'
  p.locator('#wx').click();p.wait_for_function('!document.getElementById("witsml")')
  assert p.locator('#opsScene').evaluate('(c)=>c.width>0 && c.height>0')
  assert p.locator('#opsEmpty').is_hidden()
  assert p.locator('#opsTally li').count()>0
  for v in ['torque','wob','plan','mode']:
   p.locator('[data-view="'+v+'"]').click();assert p.locator('[data-view="'+v+'"]').get_attribute('aria-pressed')=='true'
  p.locator('[data-cmd="hold"]').click();p.wait_for_timeout(500)
  assert p.locator('#opsExecution').inner_text()=='Hold active'
  dimensions=p.locator('#dwOperations').evaluate('(e)=>({width:e.clientWidth,scroll:e.scrollWidth})')
  assert dimensions['scroll']<=dimensions['width']+1,dimensions
  assert p.locator('#opsBar').evaluate('(e)=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}'),'Floating simulator controls cover dashboard progress'
  p.screenshot(path=str(OUT/(mode+'-training.png')),full_page=True)
  p.locator('#opsConnect').click();p.wait_for_selector('#wproxy')
  assert p.locator('#wproxy').evaluate('(e)=>{const r=e.getBoundingClientRect();return e===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)}'),'Connection inputs must stay above floating controls'
  for k,v in [('wproxy',args.proxy),('wurl',args.store),('wuser','SIM-TEST'),('wpass','SIM-TEST'),('wint','10000')]:p.locator('#'+k).fill(v)
  p.locator('#wcon').click();p.wait_for_function('GX.witsml.WML.connected && document.querySelector("#wwb option[value=WB01B02]")')
  if p.locator('#wwell').input_value()!='DR101L':p.locator('#wwell').select_option('DR101L')
  p.locator('#wwb').select_option('WB01B02')
  p.wait_for_function('document.querySelector("#wlog option[value=TLOG]") && !document.querySelector("#wgo").disabled && GX.witsml.WML.preview?.w==="DR101L" && GX.witsml.WML.preview?.b==="WB01B02"')
  p.locator('#wlog').select_option('TLOG');p.locator('#wgo').click();p.wait_for_function('GX.witsml.WML.rows>0');p.wait_for_timeout(1500)
  p.locator('#wx').click();p.evaluate('import("./operations.js").then(m=>m.open())');p.wait_for_selector('#dwOperations');p.wait_for_timeout(700)
  live=badge();assert kind(live)=='WITSML SIM-TEST' and 'last source row ' in live and not live.startswith('WITSML LIVE'),live
  p.evaluate('''() => {
    const W = GX.witsml.WML, C = GX.witsml.CFG;
    window.__prov = {sim:W.simulated, name:W.log.name, well:W.log.nameWell, url:C.url, proxy:C.proxy};
    W.simulated = false; W.log.name = 'General Time-Based'; W.log.nameWell = 'FIXTURE TEST WELL (NOT LIVE)';
    C.url = 'https://fixture.invalid/WMLS'; C.proxy = 'http://127.0.0.1:8952/witsml-proxy';
  }''')
  p.wait_for_timeout(600)
  reported=badge();assert kind(reported)=='WITSML SIM-TEST' and not reported.startswith('WITSML LIVE'),reported
  assert p.evaluate("({well:GX.witsml.WML.log.nameWell,sim:GX.witsml.WML.simulated,url:GX.witsml.CFG.url,proxy:GX.witsml.CFG.proxy})")=={'well':'FIXTURE TEST WELL (NOT LIVE)','sim':False,'url':'https://fixture.invalid/WMLS','proxy':'http://127.0.0.1:8952/witsml-proxy'}
  assert 'FIXTURE TEST WELL (NOT LIVE)' in p.locator('#opsWell').inner_text()
  p.evaluate('''() => { const W = GX.witsml.WML, C = GX.witsml.CFG, k = window.__prov; W.simulated = k.sim; W.log.name = k.name; W.log.nameWell = k.well; C.url = k.url; C.proxy = k.proxy; }''')
  p.wait_for_timeout(500)
  fitted=p.locator('#dwOperations').evaluate('(e)=>({width:e.clientWidth,scroll:e.scrollWidth})')
  assert fitted['scroll']<=fitted['width']+1,fitted
  assert p.locator('[data-cmd]:enabled').count()==0
  assert 'WB01B02' in p.locator('#opsWell').inner_text(),p.locator('#opsWell').inner_text()
  assert p.evaluate('GX.witsml.WML.log.b')=='WB01B02'
  assert 'No channel' in p.locator('#opsControl').inner_text()
  assert 'No mapped anti-collision data' in p.locator('#opsRadarDetail').inner_text()
  p.evaluate('window.fixtureHistory=GX.witsml.WML.hist;GX.witsml.WML.hist=[]');p.wait_for_timeout(600)
  assert badge()=='WITSML WAITING'
  assert p.locator('[data-cmd]:enabled').count()==0
  p.evaluate('GX.witsml.WML.hist=window.fixtureHistory;window.fixtureIndexType=GX.witsml.WML.log.indexType;GX.witsml.WML.log.indexType="measured depth"');p.wait_for_timeout(600)
  assert badge()=='WITSML TIME LOG REQUIRED'
  p.evaluate('GX.witsml.WML.log.indexType=window.fixtureIndexType');p.wait_for_timeout(600)
  restored=badge();assert kind(restored)=='WITSML SIM-TEST' and not restored.startswith('WITSML LIVE'),restored
  first=p.locator('#opsFooter').inner_text();first_row=badge().split('row ',1)[1].split(' ',1)[0]
  p.wait_for_timeout(11000);second=p.locator('#opsFooter').inner_text();second_row=badge().split('row ',1)[1].split(' ',1)[0]
  assert first!=second and first_row!=second_row and first_row.endswith('Z') and second_row.endswith('Z'),(first,second,first_row,second_row)
  assert p.locator('#opsTrack0').evaluate('(c)=>c.width>0 && c.height>0')
  p.locator('#opsLoadImage').click();p.wait_for_function('!document.querySelector("#opsLoadImage").disabled');p.wait_for_timeout(500)
  image=p.locator('#opsDepth').inner_text()
  assert 'MWD Image' in image,image
  p.screenshot(path=str(OUT/(mode+'-fixture.png')),full_page=True)
  p.evaluate('clearInterval(GX.witsml.WML.timer);GX.witsml.WML.timer=null;GX.witsml.WML.lastRowMs=Date.now()-180000')
  p.wait_for_timeout(650);stale=badge();assert kind(stale)=='WITSML STALE' and 'last source row ' in stale,stale
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
