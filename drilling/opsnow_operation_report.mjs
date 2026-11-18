// Dated human report, separate from WITSML measurements. No operational time is inferred.
import {referenceScope} from './opsnow_tally_compare.mjs?v=opsref1118';
export const END_OF_WELL_REPORT=Object.freeze({
 id:'dr101l-wb04b01-eow-20261118',well:'DR101L',wellbore:'WB04B01',reportedDate:'2026-11-18',timeZone:'Australia/Brisbane',
 source:'End-of-well lateral summary supplied by user',phaseSource:'User reported that the well has reached TD and is running liner',
 phase:'running-liner',tdMd:2618.90,kopMd:822.53,lateralLength:1796.37,inSeamLength:1774.37,inSeamPercent:98.78,
 faultedExitLength:22,stratigraphicExitLength:0,
 faultedExits:Object.freeze([Object.freeze({fromMd:1826,toMd:1832}),Object.freeze({fromMd:2223,toMd:2239})]),
 reasonForTd:'Well heavy scrape the floor. Rig issues and potential stuck pipe.',
 tdAt:null,linerDepth:null,linerJoints:null
});
export function reportedOperation(well,wellbore,now=Date.now()){
 // Do not apply a later human report to a replay before its report date.
 return referenceScope(well,wellbore)&&now>=Date.parse(END_OF_WELL_REPORT.reportedDate+'T00:00:00+10:00')?END_OF_WELL_REPORT:null;
}
export function reportDepthIssue(report,holeMd,tolerance=.3){
 return report&&Number.isFinite(holeMd)&&holeMd>report.tdMd+tolerance?'Source hole MD exceeds reported TD; review the phase and depth reference.':null;
}
export function drillingReferenceMd(report,bitMd,holeMd){return report?report.tdMd:Number.isFinite(bitMd)?bitMd:holeMd;}
export function renderOperationReport(host,report,holeMd){
 if(!host)return;host.hidden=!report;if(!report){host.replaceChildren();delete host.dataset.signature;return;}
 host.style.cssText='margin:8px 0;padding:8px 10px;border-left:3px solid #68b5b0;background:#14262e;border-radius:5px;font-size:12px;line-height:1.45;overflow-wrap:anywhere;min-width:0';
 const signature=JSON.stringify([report.id,reportDepthIssue(report,holeMd)]);if(host.dataset.signature===signature)return;host.dataset.signature=signature;host.replaceChildren();
 const title=document.createElement('strong');title.textContent='TD reached · liner running (reported 18 Nov 2026 AEST)';host.append(title);
 const line=document.createElement('div');line.textContent='TD 2,618.90 m MD · drilling complete. Liner depth and joint count not supplied.';host.append(line);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='End-of-well report';details.append(summary);
 const facts=document.createElement('p');facts.textContent='KOP 822.53 m MD · lateral 1,796.37 m · in seam 1,774.37 m (98.78%). Faulted exits: 1,826–1,832 and 2,223–2,239 m MD (22 m total). No stratigraphic exits reported.';details.append(facts);
 const reason=document.createElement('p');reason.textContent='Reason for TD (report): '+report.reasonForTd;details.append(reason);
 const source=document.createElement('p');source.textContent=report.source+'. Liner phase: user report, not live telemetry. Exact TD/liner start times were not supplied. Depth-indexed drilling rows do not track current liner movement; a separate liner tally is needed. The TD inventory reference is not a measured final joint count.';details.append(source);host.append(details);
 const issue=reportDepthIssue(report,holeMd);if(issue){const p=document.createElement('p');p.setAttribute('role','status');p.style.color='#ffbe70';p.textContent=issue;host.append(p);}
}
