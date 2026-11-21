// Add one native link to the existing Tools menu. Keep all other game bytes intact.
export const WELL_FOLDER_ENTRY='<a id="wellFolderEntry" href="./well-folder/" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;min-height:36px;padding:4px 10px;border:1px solid #567;border-radius:4px;background:#162633;color:#def;text-decoration:none">Well Folder</a>';
export function patchWellFolderGameHtml(html){
 if(html.includes('id="wellFolderEntry"')){if(!html.includes(WELL_FOLDER_ENTRY))throw Error('Review the existing Well Folder entry before changing it.');return html;}
 const anchor=/<button\b[^>]*\bid=["']opsDashboard["'][^>]*>[\s\S]*?<\/button>/;
 if(!anchor.test(html))throw Error('The existing Operations control was not found. Keep the published Tools menu.');
 return html.replace(anchor,match=>match+'\n'+WELL_FOLDER_ENTRY);
}
