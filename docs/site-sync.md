# Saved site sync (phone and laptop)

Start menu bottom bar: **⇄ Sync sites** opens the sync panel (`sitesync.js`, API `GX.sync`).

## Sync file (always on)
- **Make sync file**: writes all saved EDM sites to `drilling-world-sites-<date>.json` (share or download).
- **Open sync file**: adds the sites on the other device. The newer copy of a site wins; the same file twice adds no duplicates.
- Credential-like keys (WITSML, password, secret, token, credential, auth, username, api key, cookie, session) are removed before export, upload and import. WITSML log-in data is never stored or sent.

## Cloud sync (off by default)
Turn on with `<meta name="dw-sync-url">` + `<meta name="dw-sync-key">` (public anon key only) or `window.DW_SYNC={url,key}`.
Devices sign in anonymously, one device makes a pairing code, the other pairs with it, then **Send sites** / **Get sites**.
Schema: `supabase/migrations/20261031_dw_site_sync.sql` — additive; RLS on `dw_sync_spaces`, `dw_sync_members`, `dw_sync_sites`; members-only reads; writes via security definer RPCs with fixed `search_path`; check constraint refuses credential keys.

**Status:** not provisioned. The only active Supabase project is a shared production database for another product, so the migration was not applied there. A free project for the drilling game is needed; then apply the migration, enable anonymous sign-in, and set the two meta tags.

## Tests
`node sitesync_test.mjs <url>` — file round trip laptop → phone, no credentials, no duplicates, wrong file refused, phone layout, and the cloud flow against a mocked project (no network).
