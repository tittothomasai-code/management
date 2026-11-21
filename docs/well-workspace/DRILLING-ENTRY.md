# Well Folder from Drilling

Open https://drilling.robotyx.systems/well-folder/ or select **Well Folder** on the
Operations dashboard. The game also has **Tools → Well Folder**. The entry works
before a WITSML session, well selection or incoming live feed.

The entry opens the existing well tree at robotyx.systems in a new tab. Sign in to
Robotyx and choose the account, registered connection and well you can access. The
Robotyx tenant and its existing Drive remain the source of the prepared well file.
A current selected Ops well/bore supplies exact UID hints; an unselected or invalid
context opens the general chooser. Planned wells can be chosen before live source
identifiers exist. The launcher does not choose a well by name.

This entry transfers only validated connection/well/bore identity hints. It does not
transfer WITSML credentials, authentication tokens, tenant overrides or redirects.
The destination origin is fixed. The existing document sign-in, tenant checks and
Drive authorization apply. It makes no permission, billing, storage or feed change.
The game insertion is one native link; all surrounding intro/menu/control bytes are
preserved. The published inventory and current Engineering/Performance modules are
preserved through the existing preview-and-promote workflow.

Tests cover the no-feed launcher, scoped UID hints, malicious/invalid parameters,
planned identities, and a byte-preserving/idempotent Tools patch. The existing real
Ops browser flow now tests the folder entry before source login and after synthetic
well selection on desktop and phone, including the protected destination. Screenshots
are synthetic. No real well documents or user credentials are fixtures. The actual
preview acceptance verifies the Tools entry alongside existing game/menu controls.
Rollback restores the preflight deployment; it does not remove well data or documents.
