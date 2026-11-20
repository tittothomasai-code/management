import {wellFolderTarget} from '../opsnow_well_workspace.mjs?v=well-folder2';
const target=wellFolderTarget(location.search);
document.getElementById('open-folder').href=target;
location.replace(target);
