"""Browser smoke test against a local server serving the candidate site."""
import argparse
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

HARNESS = """<!doctype html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Robotyx offline observer smoke test</title>
<script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>
<script src="/units.js"></script></head><body>
<div id="testWatermark" style="position:fixed;bottom:4px;right:8px;z-index:100030;
background:#452300;color:#fff2ce;padding:5px 8px;font:bold 11px system-ui;
pointer-events:none">OFFLINE SMOKE TEST · SYNTHETIC FIXTURE</div>
<script type="module">
import {open} from '/operations.js?v=j13-20261109';
import {minCurvStations} from '/geo.js';
import {synth} from '/conn.js?v=fp-ops-r2-20261108';
const ft = .3048;
const base = Date.now() - 22000;
const history = synth({joints:2,start_m:242,len:28,rop_mh:24,withSlips:true});
const historyStart = base-15000-history.rows.at(-1).t*1000;
const ml = ['TIME','DMEA','BITDEP','ROP','WOB','TORQUE','RPM','SPP','ECD','FLOW_IN',
  'FLOW_OUT','PVT','TGAS','TF','AC_SF','AC_CTC','AC_OFFSET_N','AC_OFFSET_E',
  'STICKSLIP_ALARM','PACKOFF_ALARM','MOTOR_STALL_ALARM',
  'JOINT_START_MD','JOINT_END_MD','JOINT_NUMBER','SLIPS'];
const ul = ['','m','m','m/h','kN','kN·m','rpm','kPa','g/cm³','L/min','L/min','m3','%','deg',
  'ratio','m','m','m','','','','m','m','',''];
const log = {uid:'time',w:'w',b:'b',nameWell:'Offline QA Well',nameWb:'Bore A',
  indexType:'date time',nullValue:'-999.25'};
const feed = {mode:'off',hist:[],healthy:()=>true};
const CFG = {url:'https://example.com/never-contact',svWell:'w',map:{DMEA:'holedepth'}};
function push(t, md, i, start = 300, end = 313, joint = 85) {
  feed.hist.push({t,x:['',md,md,12+i,40+i,6+i/10,i<5?0:88,14500+i*10,1.23,
    1100+i,1092+i,37.5,1.2,42,1.62,22.3,10,-8,1,0,-999.25,start,end,joint]});
  feed.lastRowMs = t;
}
const stations = [[0,0,90],[60,0,90],[120,35,92],[180,70,88],[240,90,90],[269,90,90],[297,90,92],[313,90,93]]
  .map(([md,inc,azi])=>({md:md/ft,inc,azi,typ:'actual',wb:'b',traj:'survey',datum:'KB'}));
for (const [index,depth] of [269,297].entries()) {
  const station = stations.find(row=>Math.abs(row.md*ft-depth)<.001);
  station.t = new Date(historyStart + (history.truth[index].tSlipsIn+5)*1000).toISOString();
}
window.GEO = {calc:minCurvStations(stations),surv:{live:true,stations}};
feed.sv = {cur:{wb:'b',uid:'survey',st:stations}};
feed.svCands = [{uid:'plan',wb:'b',st:[...stations,{md:350/ft,inc:90,azi:93}]
  .map(row=>({...row,typ:'planned'}))}];
const G8 = {well:'w',wb:'b',sim:false,fe:{gr:[{md:291.25,v:70}]},img:{name:'Offline QA image',
  rows:Array.from({length:16},(_,i)=>({md:285+i/3,v:Array.from({length:12},(_,j)=>i+j%3)}))}};
window.GX = {
  witsml:{WML:feed,CFG,data:()=>({src:feed.simulated?'live-sim':'live',ml,ul,ix:0,rows:feed.hist}),
    open(){
      let panel=document.getElementById('witsml');
      if (!panel) {
        panel=document.createElement('div'); panel.id='witsml';
        panel.innerHTML='<button id="wX" type="button">Close WITSML panel</button>'+
          '<button id="wsim" type="button">Use simulated test store</button>'+
          '<div><button id="wrep" type="button">Import</button></div>'+
          '<div><label><input id="wlmc" type="checkbox">Follow feed</label></div>'+
          '<div id="wrbox">Replay</div>';
        document.body.append(panel);
        panel.querySelector('#wX').onclick=()=>window.GX.witsml.close();
      }
      panel.style.display=''; dispatchEvent(new Event('witsml:panel'));
    },
    close(){document.getElementById('witsml').style.display='none';dispatchEvent(new Event('witsml:panel'));}
  },
  geo8:{G8,load:async()=>{if (!window.keepOldDepthLogs) {G8.img={...G8.img};G8.fe={...G8.fe};}}}
};
window.test = {
  seed(){feed.log=log;
    for (const row of history.rows) {
      feed.hist.push({t:historyStart+row.t*1000,
        x:['',row.hd,row.bd,'','','',row.rpm,'','',row.flow,'','','','','','','','','','','','','','',row.slips]});
    }
    push(base-4000,299.5,0,287,300,84);
    for(let i=0;i<10;i++)push(base+i*1000,300+i*.6,i);
  },
  advance(){push(base+10000,306,10);feed.hist.at(-1).x[2]=304.7;},
  advanceWithinJoint(){push(base+10400,307,11);},
  newLog(){feed.log={...log,uid:'new-time'};feed.hist=[];window.keepOldDepthLogs=true;
    push(base+10500,306.5,10,'','','');},
  noJoint(){push(base+11000,307,11,'','','');},
  stale(){const now=Date.now;Date.now=()=>feed.lastRowMs+120000;window.resetTime=()=>Date.now=now;},
  testStore(){feed.simulated=true;},
  untest(){feed.simulated=false;},
  replay(){feed.mode='replay';},
  noData(){feed.mode='off';feed.log=null;}
};
open();
</script></body></html>"""


def verify(browser, base, screenshots, name, viewport, touch=False):
    context = browser.new_context(viewport=viewport, is_mobile=touch, has_touch=touch,
                                  service_workers="block")
    blocked = []
    context.route("**/*", lambda route: route.continue_() if route.request.url.startswith(base + "/")
                  else (blocked.append(route.request.url), route.abort()))
    page = context.new_page()
    page.route(base + "/__observer_test", lambda route: route.fulfill(
        status=200, content_type="text/html", body=HARNESS))
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base + "/__observer_test")
    badge = page.locator("#opsSource")
    expect(badge).to_have_text("WITSML DISCONNECTED")
    expect(page.locator("#opsTally")).to_have_text("No source joint tally")
    expect(page.locator("#opsMetres")).to_have_text("—")
    expect(page.locator("#opsEmpty")).to_have_text("No matched trajectory survey")
    assert page.locator("[data-cmd]").count() == 0

    page.locator("#opsConnect").click()
    expect(page.locator("#opsWitsmlDock")).to_be_visible()
    for control in ("#wsim", "#wrbox", "#wrep", "#wlmc"):
        expect(page.locator(control)).to_be_hidden()
    page.keyboard.press("Escape")
    expect(page.locator("#opsWitsmlDock")).to_be_hidden()

    page.evaluate("test.seed()")
    expect(badge).to_have_text("WITSML WAITING FOR ADVANCE")
    expect(page.locator("#opsMetres")).to_have_text("—")
    page.evaluate("test.advance()")
    expect(badge).to_have_text("WITSML LIVE")
    expected = {
        "#opsJoint": "Joint 85", "#opsMetres": "6.0 / 13.0 m", "#opsPct": "46%",
        "#opsStart": "START MD 300.0 m", "#opsEnd": "END MD 313.0 m",
        "#opsLatest0": "ROP 22.0 · WOB 50.0", "#opsLatest1": "Torque 7.0 · RPM 88.0",
        "#opsLatest2": "SPP 14,600.0 · ECD 1.23", "#opsLatest3": "In 1,110.0 · Out 1,102.0",
        "#opsSF": "SF 1.62", "#opsRadarDetail": "22.3 m centreline",
    }
    for selector, value in expected.items():
        expect(page.locator(selector)).to_have_text(value)
    expect(page.locator("#opsTally")).to_contain_text("J-84")
    expect(page.locator("#opsTally [aria-current=true]")).to_contain_text("J-85")
    expect(page.locator("#opsBar")).to_have_attribute("aria-label", re.compile("Remaining 7.0 m"))
    expect(page.locator("#opsRadarTargets circle")).to_have_count(2)
    for value in ["Stick-slipActive", "Pack-offNo active flag", "Motor stallNo alarm channel"]:
        expect(page.locator("#opsAlerts")).to_contain_text(value)
    for value in ["-8 L/min", "37.50 m³", "1.20 %"]:
        expect(page.locator("#opsControl")).to_contain_text(value)
    expect(page.locator("#opsSurvey")).to_contain_text("42°")
    expect(page.locator("#opsConnectionIntervals")).to_contain_text("270.00 → 298.00 m MD28.00 m")
    expect(page.locator("#opsSurveyIntervals")).to_contain_text("269.00 → 297.00 m MD28.00 m")
    expect(page.locator("#opsSurveyIntervals")).to_contain_text("Hole 270.00 → 298.00 m MD28.00 m")
    expect(page.locator("#opsSurveyIntervals")).to_contain_text("Bit pickup at survey1.50 m")
    expect(page.locator("#opsSurvey")).to_contain_text("LAST SURVEY MD  313.0 m MD")
    expect(page.locator("#opsNext")).to_contain_text("Hole MD306.00 m")
    expect(page.locator("#opsNext")).to_contain_text("Bit MD304.70 m")
    expect(page.locator("#opsNext")).to_contain_text("Gamma log MDUnavailable")
    expect(page.locator("#opsBit")).to_be_hidden()
    assert page.locator("#opsSourceTime").get_attribute("datetime") == page.evaluate(
        "new Date(window.GX.witsml.WML.lastRowMs).toISOString()")
    expect(page.locator("#opsEmpty")).to_be_hidden()
    expect(page.locator("#opsLegend")).to_contain_text("Schematic terrain")
    window_label = "JOINT WINDOW · HOLE MD 300.00–313.00 m"
    expect(page.locator("#opsTrackWindow")).to_have_text(window_label)
    page.locator("[data-view=dls]").click()
    expect(page.locator("#opsDlsPanel")).to_be_visible()
    expect(page.locator("#opsScene")).to_be_hidden()
    expect(page.locator("#opsDlsSummary")).to_have_text(re.compile(r"Latest DLS [0-9.]+ °/30 m · Survey MD 297.00–313.00 m · Datum KB"))
    assert page.locator("#opsDlsChart").evaluate(
        "(e)=>e.getContext('2d').getImageData(0,0,e.width,e.height).data.some((value,i)=>i%4===3&&value>0)")
    dls_label = page.add_style_tag(content=(
        '#opsSource {font-size:0!important;color:#ffd888!important;background:#482b0b!important}'
        '#opsSource::after {content:"OFFLINE FIXTURE";font-size:11px}'))
    page.locator("#dwOperations").evaluate("(e)=>e.scrollTop=0")
    page.screenshot(path=screenshots / f"dls-{name}.png")
    dls_label.evaluate("(tag)=>tag.remove()")
    for view in ("plan", "mode"):
        tab = page.locator(f"[data-view={view}]")
        tab.click()
        expect(tab).to_have_attribute("aria-pressed", "true")

    page.locator("#opsLoadImage").click()
    expect(page.locator("#opsDepth")).to_contain_text("LWD INDEX MD 285.00–290.00 m · Offline QA image")
    expect(page.locator("#opsNext")).to_contain_text("Gamma log MD291.25 m")
    assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
    page.locator("#dwOperations").evaluate("(e)=>e.scrollTop=0")
    test_label = page.add_style_tag(content=(
        '#opsSource {font-size:0!important;color:#ffd888!important;background:#482b0b!important}'
        '#opsSource::after {content:"OFFLINE FIXTURE";font-size:11px}'))
    page.screenshot(path=screenshots / f"operations-{name}.png")
    test_label.evaluate("(tag)=>tag.remove()")

    page.evaluate("test.advanceWithinJoint()")
    expect(page.locator("#opsMetres")).to_have_text("7.0 / 13.0 m")
    expect(page.locator("#opsTrackWindow")).to_have_text(window_label)
    page.evaluate("test.newLog()")
    expect(badge).to_have_text("WITSML WAITING FOR ADVANCE")
    page.evaluate("test.noJoint()")
    expect(badge).to_have_text("WITSML LIVE")
    page.locator("#opsLoadImage").click()
    expect(page.locator("#opsDepth")).to_have_text("No compatible image log found")
    expect(page.locator("#opsNext")).to_contain_text("Gamma log MDUnavailable")
    expect(page.locator("#opsMetres")).to_have_text("—")
    expect(page.locator("#opsTrackWindow")).to_have_text("RECENT TIME · SOURCE JOINT BOUNDARIES UNAVAILABLE")
    expect(page.locator("#opsTally [aria-current=true]")).to_have_count(0)
    page.evaluate("test.stale()")
    expect(badge).to_have_text("WITSML STALE")
    page.locator("[data-view=dls]").click()
    expect(page.locator("#opsDlsSummary")).to_contain_text("DLS unavailable")
    page.locator("[data-view=mode]").click()
    expect(page.locator("#opsLatest0")).to_have_text("ROP no channel · WOB no channel")
    expect(page.locator("#opsSurveyIntervals")).to_have_text("No matched source survey intervals")
    expect(page.locator("#opsConnectionIntervals")).to_have_text("No verified connection pair")
    expect(page.locator("#opsNext")).to_contain_text("Gamma log MDUnavailable")
    expect(page.locator("#opsRadarTargets circle")).to_have_count(0)
    expect(page.locator("#opsEmpty")).to_be_visible()
    expect(page.locator("#opsLoadImage")).to_be_hidden()
    page.evaluate("resetTime(); test.testStore()")
    expect(badge).to_have_text("WITSML TEST FEED")
    expect(page.locator("#opsMetres")).to_have_text("—")
    expect(page.locator("#opsSourceTime")).to_have_text("SOURCE TIME UNAVAILABLE")
    expect(page.locator("#opsWell")).not_to_contain_text("Offline QA Well")
    page.evaluate("test.untest(); test.replay()")
    expect(badge).to_have_text("WITSML REPLAY")
    page.evaluate("test.noData()")
    expect(badge).to_have_text("WITSML DISCONNECTED")
    page.locator("#opsClose").focus()
    page.keyboard.press("Escape")
    expect(page.locator("#dwOperations")).to_have_count(0)
    assert not errors, errors
    assert not blocked, blocked
    context.close()
    print(f"PASS {name}: all dashboard values, live gates, layout, overlays, image and Escape")


SUMMARY = """<!doctype html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Selected well summary fixture</title>
<style>
body{margin:0;background:#071019;color:#eaf4ff;font:15px system-ui,sans-serif}
main{padding:16px;max-width:880px}
h1{font-size:20px;margin:0 0 8px}
.banner{background:#452300;color:#fff2ce;padding:8px 10px;font-weight:700}
p{line-height:1.4}
li{margin:6px 0}
small{color:#b4c6d7}
</style></head><body>
<div class="banner">OFFLINE FIXTURE · SANITIZED CONTRACT · NOT A LIVE WELL</div>
<main id="out"></main>
<script id="contract" type="application/json">__CONTRACT__</script>
<script type="module">
import {sourceBackedSummary} from '/rtoc_summary.js?v=j13-20261109';
const contract = JSON.parse(document.getElementById('contract').textContent);
const summary = sourceBackedSummary(contract);
const out = document.getElementById('out');
const h = document.createElement('h1');
h.id = 'summaryMessage';
h.textContent = summary.message;
const meta = document.createElement('p');
meta.id = 'summaryMeta';
meta.textContent = summary.substantiveFactCount + ' source-backed well facts · verified ' + summary.verified
  + ' · ' + summary.serverMetadata.length + ' server capability rows kept separate · survey ' + summary.survey.status;
const list = document.createElement('ol');
for (const fact of summary.facts) {
  const li = document.createElement('li');
  li.textContent = fact.fact + ': ' + (Array.isArray(fact.value) ? fact.value.join(', ') : fact.value);
  list.append(li);
}
const server = document.createElement('p');
server.id = 'serverNote';
server.textContent = 'Server metadata is not counted: ' + summary.serverMetadata.map(row => row.fact).join(' · ');
const gaps = document.createElement('p');
gaps.id = 'gaps';
gaps.textContent = summary.gaps.join(' | ');
out.append(h, meta, list, server, gaps);
document.documentElement.dataset.ready = '1';
</script></body></html>"""


def verify_summary(browser, base, screenshots, name, viewport, touch=False):
    contract = (Path(__file__).parent / "fixtures" / "well-summary-safe.json").read_text()
    context = browser.new_context(viewport=viewport, is_mobile=touch, has_touch=touch, service_workers="block")
    blocked = []
    context.route("**/*", lambda route: route.continue_() if route.request.url.startswith(base + "/")
                  else (blocked.append(route.request.url), route.abort()))
    page = context.new_page()
    page.route(base + "/__summary_test", lambda route: route.fulfill(
        status=200, content_type="text/html", body=SUMMARY.replace("__CONTRACT__", contract)))
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base + "/__summary_test")
    page.wait_for_function("() => document.documentElement.dataset.ready === '1'")
    message = page.locator("#summaryMessage")
    expect(message).to_contain_text("not enough source-backed data for 10 facts")
    expect(message).to_contain_text("(6 source-backed)")
    expect(page.locator("#summaryMeta")).to_contain_text("verified false")
    expect(page.locator("#summaryMeta")).to_contain_text("survey unavailable")
    expect(page.locator("ol li")).to_have_count(6)
    expect(page.locator("body")).to_contain_text("DR101L")
    expect(page.locator("ol")).not_to_contain_text("Adaga")
    expect(page.locator("#serverNote")).to_contain_text("Adaga")
    expect(page.locator("#gaps")).to_contain_text("502")
    expect(page.locator("#gaps")).to_contain_text("504")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
    page.screenshot(path=screenshots / f"summary-{name}.png", full_page=True)
    assert not errors, errors
    assert not blocked, blocked
    context.close()
    print(f"PASS {name}: sanitized contract shows 6 facts, not 10")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8913")
    parser.add_argument("--screenshots", type=Path, required=True)
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    args = parser.parse_args()
    args.screenshots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium, args=[
            "--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        verify(browser,args.base_url,args.screenshots,"desktop",{"width":1680,"height":970})
        verify(browser,args.base_url,args.screenshots,"mobile",{"width":390,"height":844},touch=True)
        verify_summary(browser,args.base_url,args.screenshots,"desktop",{"width":1680,"height":970})
        verify_summary(browser,args.base_url,args.screenshots,"mobile",{"width":390,"height":844},touch=True)
        browser.close()
