# Draft fixture cleanup

This directory is a temporary Netlify draft for the approved synthetic preview. It is not part of the production overlay for site `d548e1ee-91eb-4166-a2bd-d8fdb7fbd5a9` or deploy `6aefa5b44e57e24ef002a2f3`.

Do not copy `draft-fixture/` into the production candidate. Do not run a production publish of this folder against `robotyx-drilling`.

After the preview:

1. Delete the draft deploy from the separate draft site.
2. Remove the draft site if it was created only for this fixture.
3. Confirm `https://drilling.robotyx.systems` still serves deploy `6aefa5b44e57e24ef002a2f3` or its later operations overlay, and that `/.netlify/functions/witsml-fixture` is not on that site.
4. Keep the production proxy allow-list, origin checks, and password handling unchanged.

The handler answers `WMLS_GetVersion` and `WMLS_GetFromStore` from memory. It does not forward `url`, store credentials, or write logs.
