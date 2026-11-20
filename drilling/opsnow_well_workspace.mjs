// Context hints only. The signed-in workspace still requires an explicit registered connection.
export function wellWorkspaceUrl({wellUid,wellboreUid}={}){
 const valid=x=>typeof x==='string'&&x.trim()&&x.length<=256&&!/[\u0000-\u001f]/.test(x);
 if(!valid(wellUid)||!valid(wellboreUid))return null;
 const url=new URL('https://robotyx.systems/witsml-viewer');url.searchParams.set('wellWorkspace','1');url.searchParams.set('wellUid',wellUid);url.searchParams.set('wellboreUid',wellboreUid);return url.href;
}
export function mountWellWorkspaceLink(anchor,getContext){
 anchor.target='_blank';anchor.rel='noopener noreferrer';const refresh=()=>{const url=wellFolderUrl(getContext());anchor.setAttribute('aria-disabled',String(!url));if(url)anchor.href=url;else anchor.removeAttribute('href');anchor.title=url?'Choose a registered connection to verify this well context.':'Select a well and wellbore first.';};anchor.addEventListener('click',e=>{if(anchor.getAttribute('aria-disabled')==='true')e.preventDefault();});refresh();return {refresh};
}

export function wellFolderUrl(context){const raw=wellWorkspaceUrl(context);if(!raw)return null;const u=new URL(raw);u.pathname='/well-folder';u.searchParams.delete('wellWorkspace');return u.href;}
