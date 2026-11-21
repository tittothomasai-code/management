// Source selection is a UI choice, never proof of live drilling or a plan association.
const valid=v=>typeof v==='string'&&v.trim()&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v);
const un=v=>String(v||'').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const time=v=>/(Z|[+-]\d\d:\d\d)$/.test(v||'')&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
export function wellCandidates(xml,parse,now=Date.now()){
 if(typeof xml!=='string'||xml.length>8e6||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Unsupported well list.');
 const dates=new Map();for(const m of xml.matchAll(/<(?:\w+:)?well\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?well>)/g)){
  const uid=un(/\buid=["']([^"']*)["']/.exec(m[1])?.[1]);const date=k=>time(new RegExp('<(?:\\w+:)?'+k+'\\b[^>]*>([^<]+)</').exec(m[2]||'')?.[1]);
  const created=date('dTimCreation'),changed=date('dTimLastChange');dates.set(uid,{created:created!==null&&created<=now+30000?created:null,changed:changed!==null&&changed<=now+30000?changed:null});
 }
 const rows=parse(xml);if(rows.some(w=>!valid(w.uid)))throw Error('The source did not identify each well.');
 if(new Set(rows.map(w=>w.uid)).size!==rows.length)throw Error('The source returned duplicate well identifiers.');
 return rows.map(w=>({...w,...dates.get(w.uid)}));
}
export function chooseWell(rows,target=''){
 if(target){const matches=rows.filter(w=>w.uid===target||w.name===target);if(matches.length!==1)throw Error(matches.length?'Several wells match. Enter the exact well UID in Settings.':'The selected well was not found on this connection.');return matches[0];}
 if(rows.length===1)return rows[0];
 const ranked=rows.map(w=>({w,at:w.created??w.changed??null})).filter(x=>x.at!==null).sort((a,b)=>b.at-a.at);
 if(!ranked.length||ranked[1]?.at===ranked[0].at)throw Error('Choose a well in Settings. Source dates do not identify one current well.');
 return ranked[0].w;
}
export function bindWellUrl(href,well){const u=new URL(href);if(!valid(well?.uid))throw Error('A verified source well UID is required.');u.searchParams.set('wellUid',well.uid);u.searchParams.set('well',well.name||well.uid);return u.href;}
export function tallyStorageKey(source,well,bore){return valid(source)&&valid(well)&&valid(bore)?'opsnow-tally-scope:'+JSON.stringify([source,well,bore]):null;}
