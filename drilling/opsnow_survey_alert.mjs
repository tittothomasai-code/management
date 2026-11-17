// Receipt notices use actual source surveys, never projections or imported plans.
const finite = Number.isFinite;
export function createSurveyTracker() {
  const feeds = new Map();
  return {
    observe({scope, source, stations}) {
      if (!scope || !Array.isArray(stations)) return null;
      const rows = stations.filter(s => finite(s.md) && s.md >= 0 && finite(s.inc) && s.inc >= 0 && s.inc <= 180 &&
        finite(s.azi) && s.azi >= 0 && s.azi <= 360 && !/plan|propos|project|no survey|missing/i.test(s.type || ''));
      const key = JSON.stringify([scope, source]);
      let feed = feeds.get(key);
      const first = !feed;
      if (!feed) {
        feed = {seen: new Set(), md: -Infinity, at: -Infinity};
        feeds.set(key, feed);
        if (feeds.size > 16) feeds.delete(feeds.keys().next().value);
      }
      const added = [];
      for (const row of rows) {
        const at = Date.parse(row.t), id = row.uid ? 'uid:' + row.uid : JSON.stringify([row.md, finite(at) ? at : null]);
        const unseen = !feed.seen.has(id);
        feed.seen.add(id);
        const newer = finite(at) && finite(feed.at) ? at > feed.at || (at === feed.at && row.md > feed.md) : row.md > feed.md || (source === 'reports' && row.md === feed.md);
        if (!first && unseen && newer) added.push(row);
      }
      for (const row of rows) { feed.md = Math.max(feed.md, row.md); const at = Date.parse(row.t); if (finite(at)) feed.at = Math.max(feed.at, at); }
      while (feed.seen.size > 4096) feed.seen.delete(feed.seen.values().next().value);
      if (!added.length) return null;
      const latest = added.reduce((a, b) => (Date.parse(b.t) || 0) > (Date.parse(a.t) || 0) ||
        ((Date.parse(b.t) || 0) === (Date.parse(a.t) || 0) && b.md > a.md) ? b : a);
      return {source, count: added.length, latest};
    },
  };
}

// One report can supply many interpolated joints. Observe its provenance once,
// rather than treating every interpolated row or generated-file time as a survey.
export function reportSurveyStations(report) {
  if (report?.status !== 'ok') return null;
  const records = new Map();
  for (const entry of report.entries || []) {
    if (entry.status === 'no survey' || !finite(entry.inc) || !finite(entry.azi)) continue;
    const sources = entry.report ? entry.report.split(' + ').filter(Boolean) : [];
    for (const source of sources) {
      const uid = JSON.stringify([source, entry.reportTime || '']);
      const row = {uid, md: entry.md, inc: entry.inc, azi: entry.azi, t: entry.reportTime, type: 'report'};
      if (!records.has(uid) || row.md > records.get(uid).md) records.set(uid, row);
    }
  }
  return [...records.values()];
}

export function createSurveyAlerts({document: doc = document} = {}) {
  const tracker = createSurveyTracker();
  let card, title, detail, sourceLine;
  function show(event, context) {
    if (!card) {
      const style = doc.createElement('link');style.rel = 'stylesheet';style.href = new URL('./opsnow_survey_alert.css', import.meta.url);doc.head.append(style);
      card = doc.createElement('aside');card.id = 'onSurveyReceived';card.hidden = true;
      card.setAttribute('role', 'status');card.setAttribute('aria-live', 'polite');card.setAttribute('aria-atomic', 'true');
      const close = doc.createElement('button');close.type = 'button';close.textContent = 'Dismiss';close.setAttribute('aria-label', 'Dismiss survey notification');
      close.onclick = () => { card.hidden = true;card.classList.remove('on-survey-pulse'); };
      title = doc.createElement('strong');detail = doc.createElement('p');sourceLine = doc.createElement('small');
      card.append(title, detail, sourceLine, close);doc.body.append(card);
    }
    const row = event.latest;
    title.textContent = 'Survey received';
    detail.textContent = [context.well, context.wellbore].filter(Boolean).join(' / ') + ' · MD ' + row.md.toFixed(2) +
      ' m · Inc ' + row.inc.toFixed(2) + '° · Azi ' + row.azi.toFixed(2) + '°';
    sourceLine.textContent = event.source === 'reports' ? 'Geosteering report survey data' : 'WITSML · ' + event.count + (event.count === 1 ? ' new survey station' : ' new survey stations');
    card.hidden = false;card.classList.remove('on-survey-pulse');void card.offsetWidth;card.classList.add('on-survey-pulse');
  }
  return {
    observe({scope, source, stations, well, wellbore}) { const event = tracker.observe({scope, source, stations});if (event) show(event, {well, wellbore});return event; },
    clear() { if (card) { card.hidden = true;card.classList.remove('on-survey-pulse'); } },
  };
}
