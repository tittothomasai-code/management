// Test stub for the frozen reader's unused `./wdash_core.js?v=w2` import.
// negotiate, pickVersion, capsFrom, and versionAdapter do not call these.
// If a test reaches one, the reader path under test is no longer those four.

function unused(name) {
  return () => {
    throw new Error("wdash_core." + name + " is outside the adapter contract");
  };
}

export const soapResult = unused("soapResult");
export const parseLogs = unused("parseLogs");
export const appendRows = unused("appendRows");
