export function isLiveWitsml(tag, note) {
  return tag?.textContent?.trim() === 'LIVE' &&
    tag.classList?.contains('LIVE') === true &&
    /^LIVE\s*·/.test(note?.textContent?.trim() || '');
}

export function renderLiveLabel(doc, live) {
  const banner = doc.getElementById('sim');
  if (!banner) return;
  const source = live ? 'witsml-live' : 'simulated';
  const text = live ? 'LIVE WITSML · READ ONLY' : 'Simulated';
  const title = live ? 'Drilling World v3 (LIVE WITSML)' : 'Drilling World v3 (SIMULATED)';
  if (banner.dataset.source !== source) banner.dataset.source = source;
  if (banner.textContent !== text) banner.textContent = text;
  if (!live) {
    banner.style.removeProperty('background');
    banner.style.removeProperty('color');
    banner.style.removeProperty('font-weight');
  }
  if (doc.title !== title) doc.title = title;
}

function syncLabel() {
  const tag = document.getElementById('wdTag');
  const note = document.getElementById('wdNote');
  renderLiveLabel(document, isLiveWitsml(tag, note));
}

if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver(syncLabel);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  syncLabel();
}
