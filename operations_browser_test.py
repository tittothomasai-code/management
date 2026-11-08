# Local-only SIM-TEST browser regression. See DRILLING_RELEASE.md.
from playwright.sync_api import sync_playwright
import json, pathlib, argparse, re, struct, zlib
parser=argparse.ArgumentParser()
parser.add_argument('--base-url',default='http://127.0.0.1:8845')
parser.add_argument('--proxy',default='http://127.0.0.1:8846/soap')
parser.add_argument('--store',default='http://127.0.0.1:8847/witsml')
parser.add_argument('--output',default='operations-browser-evidence')
args=parser.parse_args()
from urllib.parse import urlparse
assert all(urlparse(u).hostname in ['127.0.0.1','localhost'] for u in [args.base_url,args.proxy,args.store]),'Fixture test is local-only'

def paeth(a,b,c):
 p=a+b-c; pa,pb,pc=abs(p-a),abs(p-b),abs(p-c)
 return a if pa<=pb and pa<=pc else b if pb<=pc else c
def png_colors(png):
 assert png.startswith(b'\x89PNG'),'scene screenshot is not a PNG'
 pos,w,h,ct,idat=8,0,0,0,b''
 while pos+8<=len(png):
  n=struct.unpack('>I', png[pos:pos+4])[0]; typ=png[pos+4:pos+8]; chunk=png[pos+8:pos+8+n]
  if typ==b'IHDR': w,h,depth,ct=struct.unpack('>IIBB', chunk[:10]); assert depth==8
  elif typ==b'IDAT': idat+=chunk
  elif typ==b'IEND': break
  pos+=12+n
 raw,bpp=zlib.decompress(idat),{2:3,6:4}[ct]
 stride,i,prev=w*bpp,0,bytearray(w*bpp)
 colors=set()
 for y in range(h):
  f,row=raw[i],bytearray(raw[i+1:i+1+stride]); i+=1+stride
  for x in range(stride):
   left,up,ul=row[x-bpp] if x>=bpp else 0,prev[x],prev[x-bpp] if x>=bpp else 0
   v=row[x]
   if f==1: v=(v+left)&255
   elif f==2: v=(v+up)&255
   elif f==3: v=(v+(left+up)//2)&255
   elif f==4: v=(v+paeth(left,up,ul))&255
   row[x]=v
  prev=row
  for x in range(0,w,max(1,w//40)):
   o=x*bpp; colors.add(bytes(row[o:o+3]))
 return len(colors)

def row_time_of(text):
 m=re.search(r'last source row (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)', text)
 assert m,text
 return m.group(1)
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
  (p.locator('#opsConnect').tap if mode=='mobile' else p.locator('#opsConnect').click)()
  p.wait_for_selector('#opsWitsmlDock #wproxy')
  assert p.locator('#dwOperations').is_visible()
  assert p.locator('#wproxy').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.width>20 && e===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)}'),'Docked connection inputs must be reachable'
  (p.locator('#wx').tap if mode=='mobile' else p.locator('#wx').click)()
  p.wait_for_function('!document.getElementById("witsml")')
  assert p.locator('#dwOperations').is_visible()
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
  (p.locator('#opsConnect').tap if mode=='mobile' else p.locator('#opsConnect').click)()
  p.wait_for_selector('#opsWitsmlDock #wproxy')
  assert p.locator('#dwOperations').is_visible(),'WITSML must dock inside Operations'
  assert p.locator('#wproxy').evaluate('(e)=>{const r=e.getBoundingClientRect();return e===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)}'),'Connection inputs must stay reachable'
  for k,v in [('wproxy',args.proxy),('wurl',args.store),('wuser','SIM-TEST'),('wpass','SIM-TEST'),('wint','10000')]:p.locator('#'+k).fill(v)
  p.locator('#wcon').click();p.wait_for_function('GX.witsml.WML.connected && document.querySelector("#wwb option[value=WB01B02]")')
  if p.locator('#wwell').input_value()!='DR101L':p.locator('#wwell').select_option('DR101L')
  p.locator('#wwb').select_option('WB01B02')
  p.wait_for_function('document.querySelector("#wlog option[value=TLOG]") && !document.querySelector("#wgo").disabled && GX.witsml.WML.preview?.w==="DR101L" && GX.witsml.WML.preview?.b==="WB01B02"')
  p.locator('#wlog').select_option('TLOG');p.locator('#wgo').click();p.wait_for_function('GX.witsml.WML.rows>0');p.wait_for_timeout(1500)
  assert p.locator('#dwOperations').is_visible()
  (p.locator('#wx').tap if mode=='mobile' else p.locator('#wx').click)()
  p.wait_for_function('!document.getElementById("witsml")')
  assert p.locator('#dwOperations').is_visible(),'Closing the connection panel must leave Operations open'
  p.wait_for_timeout(700)
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
  first=p.locator('#opsFooter').inner_text();first_row=row_time_of(badge())
  p.wait_for_timeout(11000);second=p.locator('#opsFooter').inner_text();second_row=row_time_of(badge())
  assert first!=second and first_row!=second_row,(first,second,first_row,second_row)
  scene=p.locator('#dwOperations #opsScene')
  assert scene.count()==1 and scene.is_visible()
  box=scene.bounding_box();assert box and box['width']>40 and box['height']>40,box
  colors=png_colors(scene.screenshot())
  assert colors>8,colors
  assert p.locator('#opsTally').inner_text().strip()!='','joint tally has no text'
  p.evaluate('''() => {
    const W=GX.witsml.WML, i=W.histMl.findIndex(m=>/rpm/i.test(m));
    clearInterval(W.timer); W.timer=null;
    if(i<0) throw new Error('no rpm mnemonic '+W.histMl.join(','));
    const last=W.hist.at(-1), row={t:last.t+15000, x:last.x.slice()};
    row.x[i]=''; W.hist.push(row); W.lastRowMs=row.t;
  }''')
  p.wait_for_function("document.getElementById('opsLatest1').textContent.includes('— no sample')",timeout=5000)
  rpm=p.locator('#opsLatest1').inner_text()
  assert 'RPM — no sample' in rpm and 'Torque' in rpm,rpm
  kept=p.evaluate('''() => {
    const W=GX.witsml.WML, i=W.histMl.indexOf('RPMA');
    const prior=W.hist.slice(0,-1).map(r=>r.x[i]);
    return {blank:W.hist.at(-1).x[i], prior:prior.filter(v=>v!=='' && v!='0').length};
  }''')
  assert kept['blank']=='' and kept['prior']>0,kept
  assert p.locator('#opsTrack1').evaluate('(c)=>c.width>0 && c.height>0')
  p.locator('#opsLoadImage').click();p.wait_for_function('!document.querySelector("#opsLoadImage").disabled');p.wait_for_timeout(500)
  image=p.locator('#opsDepth').inner_text()
  assert 'MWD Image' in image,image
  p.screenshot(path=str(OUT/(mode+'-fixture.png')),full_page=True)
  p.evaluate('clearInterval(GX.witsml.WML.timer);GX.witsml.WML.timer=null;GX.witsml.WML.lastRowMs=Date.now()-180000')
  p.wait_for_timeout(650);stale=badge();assert kind(stale)=='WITSML STALE' and 'last source row ' in stale,stale
  assert p.locator('[data-cmd]:enabled').count()==0
  assert 'Feed stale' in p.locator('#opsControl').inner_text()
  stale_rpm=p.locator('#opsLatest1').inner_text()
  assert 'feed stale' in stale_rpm and '— no sample' not in stale_rpm,stale_rpm
  p.screenshot(path=str(OUT/(mode+'-stale.png')),full_page=True)
  assert not errors,errors
  assert set(calls)<=set(['WMLS_GetVersion','WMLS_GetCap','WMLS_GetFromStore']),calls
  results.append({'viewport':mode,'errors':errors,'horizontalOverflow':dimensions['scroll']>dimensions['width'],'source':'WITSML SIM-TEST','fixtureSamples':[first,second],'image':image,'readOnly':True,'stale':True,'missingChannels':True,'headerOnlyNotLive':True,'depthLogNotLive':True,'readOperations':sorted(set(calls))})
  c.close()
 nb=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 native=nb.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 native.add_init_script('Object.defineProperty(navigator, "webdriver", {get:()=>false})')
 np=native.new_page(); nerr=[]
 np.on('pageerror',lambda e:nerr.append(str(e)))
 import datetime
 fresh={'first':None}
 def iso(dt): return dt.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
 def fake(route):
  bdy=json.loads(route.request.post_data or '{}'); op,typ,q=bdy.get('op'),bdy.get('wmlType'),bdy.get('query') or ''
  def R(xml): return route.fulfill(status=200,content_type='application/json',body=json.dumps({'result':1,'xml':xml,'supp':''}))
  ns='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"'
  if op=='WMLS_GetVersion': return route.fulfill(status=200,content_type='application/json',body=json.dumps({'result':1,'version':'1.4.1.1','xml':'','supp':''}))
  if op=='WMLS_GetCap': return R('<capServers/>')
  if typ=='well': return R(f'<wells {ns}><well uid="FIX-W"><name>FIXTURE TEST WELL (NOT LIVE)</name></well></wells>')
  if typ=='wellbore': return R(f'<wellbores {ns}><wellbore uidWell="FIX-W" uid="FIX-WB"><name>FIXTURE WB</name></wellbore></wellbores>')
  if typ=='log':
   now=datetime.datetime.now(datetime.timezone.utc)
   if fresh['first'] is None: fresh['first']=now-datetime.timedelta(seconds=20)
   a,b=iso(fresh['first']),iso(now)
   curves=''.join(f'<logCurveInfo uid="{m}"><mnemonic>{m}</mnemonic><unit>{u}</unit></logCurveInfo>' for m,u in [('TIME','s'),('DEPT','m'),('BDEP','m'),('RPMA','rpm'),('SWOB','kN'),('ROPA','m/h'),('MFIA','L/min')])
   if '<logData' not in q: return R(f'<logs {ns}><log uidWell="FIX-W" uidWellbore="FIX-WB" uid="GT"><nameWell>FIXTURE TEST WELL (NOT LIVE)</nameWell><nameWellbore>FIXTURE WB</nameWellbore><name>General Time-Based</name><indexType>date time</indexType><indexCurve>TIME</indexCurve><endDateTimeIndex>{b}</endDateTimeIndex>{curves}</log></logs>')
   row=f'<data>{b},2002,2002,,15,28,2500</data>' if a in q else f'<data>{a},2000,2000,90,14,30,2600</data>'
   return R(f'<logs {ns}><log uidWell="FIX-W" uidWellbore="FIX-WB" uid="GT"><logData><mnemonicList>TIME,DEPT,BDEP,RPMA,SWOB,ROPA,MFIA</mnemonicList><unitList>s,m,m,rpm,kN,m/h,L/min</unitList>{row}</logData></log></logs>')
  return R(f'<{typ or "x"}s {ns}/>')
 np.route('http://127.0.0.1:8952/**', fake)
 np.goto(args.base_url.rstrip('/')+'/?operations'); np.wait_for_selector('#dwOperations'); np.wait_for_function('!!window.GX?.witsml?.start',timeout=120000)
 np.locator('#opsConnect').tap(); np.wait_for_selector('#opsWitsmlDock #wurl')
 assert np.locator('#dwOperations').is_visible()
 np.locator('#wproxy').fill('http://127.0.0.1:8952/witsml-proxy'); np.locator('#wurl').fill('https://fixture.invalid/WMLS')
 np.locator('#wuser').fill('fixture'); np.locator('#wpass').fill('fixture'); np.locator('#wint').fill('10000')
 np.locator('#wcon').tap(); np.wait_for_function('document.querySelector("#wlog option[value=GT]") && !document.querySelector("#wgo").disabled',timeout=30000)
 np.locator('#wgo').tap(); np.wait_for_function('GX.witsml.WML.hist&&GX.witsml.WML.hist.length>=2',timeout=30000)
 assert np.locator('#dwOperations').is_visible()
 np.locator('#wx').tap(); np.wait_for_function('!document.getElementById("witsml")')
 assert np.locator('#dwOperations').is_visible()
 np.wait_for_selector('#dwOperations #opsScene')
 np.wait_for_function("document.getElementById('opsLatest1').textContent.includes('— no sample')",timeout=25000)
 native_badge=np.locator('#opsSource').inner_text()
 assert native_badge.startswith('WITSML SIM-TEST') and not native_badge.startswith('WITSML LIVE'),native_badge
 ident=np.evaluate("({well:GX.witsml.WML.log.nameWell,sim:GX.witsml.WML.simulated,url:GX.witsml.CFG.url,proxy:GX.witsml.CFG.proxy})")
 assert ident=={'well':'FIXTURE TEST WELL (NOT LIVE)','sim':False,'url':'https://fixture.invalid/WMLS','proxy':'http://127.0.0.1:8952/witsml-proxy'},ident
 times=np.evaluate('''() => GX.witsml.WML.hist.map(r=>new Date(r.t).toISOString().replace(/\\.000Z$/,'Z'))''')
 assert len(times)>=2 and times[0]!=times[-1] and row_time_of(np.locator('#opsSource').inner_text())==times[-1],times
 cells=np.evaluate('''() => {const W=GX.witsml.WML,i=W.histMl.indexOf('RPMA');return {first:W.hist[0].x[i],last:W.hist.at(-1).x[i]}}''')
 assert cells=={'first':'90','last':''},cells
 assert 'RPM — no sample' in np.locator('#opsLatest1').inner_text()
 assert 'SPP no channel' in np.locator('#opsLatest2').inner_text()
 assert np.locator('[data-cmd]:enabled').count()==0
 assert np.locator('#opsExecution').inner_text()=='Observer only'
 assert 'No matched trajectory survey' in np.locator('#opsEmpty').inner_text()
 assert 'image unavailable' in np.locator('#opsDepth').inner_text()
 assert np.locator('#opsTally').inner_text().strip()
 nscene=np.locator('#dwOperations #opsScene'); nbox=nscene.bounding_box()
 assert nscene.count()==1 and nbox and nbox['width']>40 and nbox['height']>40
 assert png_colors(nscene.screenshot())>8
 assert not nerr,nerr
 native.close(); nb.close()
 b.close()
print(json.dumps(results,indent=2))
(OUT/'browser-results.json').write_text(json.dumps(results,indent=2))
