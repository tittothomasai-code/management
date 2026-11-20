# Operations: Well Folder launcher

Release authorized by Titto on 20 November 2026. The separate Performance feature is already live. Publish the Robotyx UI and function before this launcher.

Select a wellbore in Operations and use **Well Folder ↗**. It opens the dedicated
Robotyx `/well-folder` page in a new tab. The launcher includes only the exact well
and wellbore UID hints. It never passes a store address, login, password or document.
Without a valid UID selection the link is disabled.

The Robotyx page selects and verifies an existing registered connection before it
loads files. Search names are labels, not join keys. The existing WITSML function
remains platform-admin-only; Drive must already be enabled. No access is expanded.

The page, authenticated context function, immutable Drive metadata migration,
rollback, synthetic browser harness and eight screenshots are in
`tittothomasai-code/the-dome`, merged PR #837 at
`f6882c9085a3310b683f1fc79d5f7338fd596544` (version 2.25.18).
The well-workspace backend is active at v1; its additive schema was applied.
Read `docs/well-workspace/HANDOFF.md` in that branch. That implementation must be
reviewed and released before this launcher is released. Files already in Drive
need an explicit verified well link; no files are guessed into a well by name.

## Verified

- Operations test suite: 150 passed, zero failures.
- Operations landing browser checks: desktop 1920×1080 and phone 390×844 passed.
- Browser assertions check the exact UID URL, new-tab protections and preserved
  landing dock, settings, simulation and survey behavior.
- Existing game, Performance and live connector code paths remain intact.
- All QA uses synthetic fixtures. No live WITSML query or real document was used.

The release workflow now runs local checks only for pull requests. It cannot create
an unpublished Netlify deployment or publish production on that event. The existing
push/manual release path keeps the normal verified-inventory and rollback workflow.
The new module is included in the future static overlay and production drift guard.
The root release uses the existing hosting connection and verifies its exact merged source and rollback deploy. The Operations release follows the root production smoke check.

Screenshot: `ops-link-phone.png` (synthetic QA).
