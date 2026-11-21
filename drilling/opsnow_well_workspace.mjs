// Context hints only. The signed-in workspace still requires an explicit registered connection.
export function wellWorkspaceUrl({wellUid,wellboreUid}={}){
 const valid=x=>typeof x==='string'&&x.trim()&&x.length<=256&&!/[\u0000-\u001f]/.test(x);
 if(!valid(wellUid)||!valid(wellboreUid))return null;
 const url=new URL('https://robotyx.systems/witsml-viewer');url.searchParams.set('wellWorkspace','1');url.searchParams.set('wellUid',wellUid);url.searchParams.set('wellboreUid',wellboreUid);return url.href;
}
export function mountWellWorkspaceLink(anchor,getContext){
 anchor.target='_blank';anchor.rel='noopener noreferrer';const refresh=()=>{const context=getContext()||{};anchor.href=drillingWellFolderUrl(context,globalThis.location?.origin);anchor.setAttribute('aria-disabled','false');anchor.title=wellWorkspaceUrl(context)?'Open this well folder. Robotyx sign-in is required.':'Open the well tree before the live feed starts. Robotyx sign-in is required.';};refresh();return {refresh};
}

export function wellFolderUrl(context){const raw=wellWorkspaceUrl(context);if(!raw)return null;const u=new URL(raw);u.pathname='/well-folder';u.searchParams.delete('wellWorkspace');return u.href;}

// The drilling entry is available without a live well. Data stays behind Robotyx auth.
export function drillingWellFolderUrl(context={},origin='https://drilling.robotyx.systems'){
 const entry=new URL('/well-folder/',origin),scoped=wellFolderUrl(context);
 if(scoped)entry.search=new URL(scoped).search;
 return entry.href;
}

export function wellFolderTarget(search=''){
 const target=new URL('https://robotyx.systems/well-folder'),params=new URLSearchParams(search);
 const valid=v=>typeof v==='string'&&v.trim()&&v.length<=256&&!/[\u0000-\u001f]/.test(v);
 const connection=params.get('connectionUid'),well=params.get('wellUid'),bore=params.get('wellboreUid');
 if(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(connection||''))target.searchParams.set('connectionUid',connection);
 if(valid(well)){target.searchParams.set('wellUid',well);if(valid(bore))target.searchParams.set('wellboreUid',bore);}
 return target.href;
}
