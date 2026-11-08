# handoff: site sync (feat/site-sync-513) — paused 31 Oct 17:45 AEST
- Branch feat/site-sync-513 = sync commits cherry-picked onto c33a620 (live v5.12.1 Showroom B, contains 2eeae04/v5.12.0). Old feat/site-sync (on 2eeae04) kept untouched.
- index.html conflict: kept HEAD, start.js cache key s6->s7. No version stamp yet.
- Cloud sync OFF (no dw-sync meta); migration supabase/migrations/20261031_dw_site_sync.sql NOT applied.
- Partial regress (stopped for SE1 release): start 38/0, phone 89/0, desk 25/0, monitor 34/0, gamepad 47/0, edm 25/0.
- Remaining: edmsave edmstats wml wmlinv anim sitesync safety showroomb showroom night night_real ddrun dock; then stamp, deploy --local, live tests, live-log.
- Before resuming: check if SE1 shipped a newer live build; if so rebase onto it.
