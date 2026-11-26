import {WITSML_ENABLED, requireWitsml} from './witsml-policy.mjs';
// opsnow_wire.js: read-only WITSML transport for the operator screen. Same contract and storage as
// ext4.js: hosted proxy, Basic credentials in sessionStorage for this tab only (key shared with the
// simulator so one sign-in serves both), username alone remembered on the device. Only
// WMLS_GetFromStore is ever sent. One call at a time; auth failure or a proxy refusal stops reads.
export const HOSTED_PROXY = 'https://tryfecta-witsml-proxy.netlify.app/witsml-proxy';
export const STORE_URL = 'https://australia.adagasolutions.com/WMLS';
const CKEY = 'dw-witsml-cred', RKEY = 'dw-witsml-remember', UKEY = 'dw-witsml-ui';
const jget = (s, k) => { try { return JSON.parse(s.getItem(k) || 'null'); } catch { return null; } };
let cred = (() => { const c = jget(sessionStorage, CKEY); return c && typeof c.user === 'string' ? {user: c.user, pass: String(c.pass || '')} : {user: '', pass: ''}; })();
const ui = jget(localStorage, UKEY) || {}, rem = jget(localStorage, RKEY) || {};
export const cfg = {proxy: rem.proxy || ui.proxy || HOSTED_PROXY, url: rem.url || ui.url || STORE_URL};
if (!/^https:\/\//.test(cfg.proxy)) cfg.proxy = HOSTED_PROXY;
export const disconnected = !WITSML_ENABLED;
export const state = {calls: 0, errors: 0, inflight: false, dead: '', lastCallAt: 0, lastError: ''};
export const hasCred = () => WITSML_ENABLED && Boolean(cred.user && cred.pass);
export const rememberedUser = () => cred.user || rem.user || '';
export function signIn(user, pass, remember) {
  requireWitsml();
  cred = {user: String(user || ''), pass: String(pass || '')}; state.dead = '';
  try { sessionStorage.setItem(CKEY, JSON.stringify(cred)); } catch {}
  if (remember) try { const r = {...rem, user: cred.user, url: cfg.url, proxy: cfg.proxy}; delete r.pass; delete r.password; localStorage.setItem(RKEY, JSON.stringify(r)); } catch {}
}
export function signOut() { cred = {user: '', pass: ''}; try { sessionStorage.removeItem(CKEY); } catch {} }
const err = (msg, extra) => Object.assign(new Error(msg), extra);
export async function get(wmlType, query, options, timeoutMs = 45000) {
  requireWitsml();
  if (state.dead) throw err(state.dead, {fatal: true});
  if (!hasCred()) throw err('Sign in to read WITSML', {needAuth: true});
  if (state.inflight) throw err('busy');
  state.inflight = true; state.calls++; state.lastCallAt = Date.now();
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let r;
    try {
      r = await fetch(cfg.proxy, {method: 'POST', signal: ac.signal, headers: {'Content-Type': 'application/json',
        'X-Witsml-Authorization': 'Basic ' + btoa(unescape(encodeURIComponent(cred.user + ':' + cred.pass)))},
        body: JSON.stringify({url: cfg.url, op: 'WMLS_GetFromStore', wmlType, query, options})});
    } catch (e) { throw err(ac.signal.aborted ? 'WITSML store did not answer in ' + Math.round(timeoutMs / 1000) + ' s' : 'Cannot reach the WITSML proxy'); }
    const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {}
    if (r.status === 401 || /Authentication failed/i.test(j?.error || '')) { signOut(); state.dead = 'Sign-in rejected by the WITSML store. Reads stopped.'; throw err(state.dead, {fatal: true, needAuth: true}); }
    if (r.status === 422 || j?.code === 'proxy-refusal') { state.dead = 'The proxy refused a reply for safety (' + (j?.reason || 'refusal') + '). Reads stopped.'; throw err(state.dead, {fatal: true}); }
    if (!j || typeof j !== 'object') throw err('Proxy reply was not readable (HTTP ' + r.status + ')');
    if (j.error) throw err('Proxy: ' + String(j.error).slice(0, 120));
    const result = Number(j.result);
    if (!Number.isFinite(result) || result < 1) throw err('WITSML result ' + j.result + (j.supp ? ' · ' + String(j.supp).slice(0, 120) : ''));
    return {result, xml: String(j.xml || '')};
  } catch (e) { state.errors++; state.lastError = e.message; throw e; }
  finally { clearTimeout(to); state.inflight = false; }
}
