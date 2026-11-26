// This deployment has no live WITSML feed. All transport entry points share this policy.
export const WITSML_ENABLED = false;
export const DISCONNECTED = 'WITSML disconnected';

export function requireWitsml() {
  if (!WITSML_ENABLED) {
    throw Object.assign(new Error(DISCONNECTED), {fatal: true, closed: true, guardRefusal: true});
  }
}

// Discard only credentials stored by the drilling site. Keep well files and local plans.
if (!WITSML_ENABLED) {
  try {
    sessionStorage.removeItem('dw-witsml-cred');
    sessionStorage.removeItem('dw_wdash_pw');
    localStorage.removeItem('dw_wdash_pwenc');
  } catch {
    // Browsers can disable storage. The transport policy still applies.
  }
}
