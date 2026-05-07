// ─── helpers ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function groupByFile(suites) {
  const map = new Map();
  function walk(list, file) {
    for (const suite of list) {
      const f = suite.file ?? file;
      if (suite.specs) {
        if (!map.has(f)) map.set(f, []);
        for (const spec of suite.specs) {
          const test = spec.tests?.[0];
          const res  = test?.results?.[0] ?? {};
          map.get(f).push({
            title:    spec.title,
            status:   resolveStatus(test),
            duration: res.duration ?? 0,
            error:    res.errors?.[0]?.message ?? null,
          });
        }
      }
      if (suite.suites) walk(suite.suites, f);
    }
  }
  walk(suites, '');
  return [...map.entries()].map(([file, tests]) => ({ file, tests }));
}

function resolveStatus(test) {
  if (!test) return 'skipped';
  if (test.status === 'expected')   return 'passed';
  if (test.status === 'unexpected') return 'failed';
  if (test.status === 'skipped')    return 'skipped';
  const r = test.results?.[0];
  return !r ? 'skipped' : r.status === 'passed' ? 'passed' : r.status === 'skipped' ? 'skipped' : 'failed';
}

// ─── HTML report generation ───────────────────────────────────────────────────

export function generateReport(entries, title = 'Raport testów Playwright') {
  const now = new Date().toLocaleString('pl-PL');

  let totalPassed = 0, totalFailed = 0, totalSkipped = 0, totalDuration = 0;
  for (const e of entries) {
    const s = e.summary ?? {};
    totalPassed   += s.passed  ?? 0;
    totalFailed   += s.failed  ?? 0;
    totalSkipped  += s.skipped ?? 0;
    totalDuration += e.duration ?? 0;
  }
  const totalTests = totalPassed + totalFailed + totalSkipped;
  const passRate   = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
  const overallOk  = totalFailed === 0;

  const summaryGrid = `
    <div class="sum-card ${overallOk ? 'ok' : 'fail'}">
      <div class="sum-icon">${overallOk ? '✔' : '✖'}</div>
      <div class="sum-label">Status</div>
      <div class="sum-val">${overallOk ? 'PASS' : 'FAIL'}</div>
    </div>
    <div class="sum-card">
      <div class="sum-icon">🔢</div>
      <div class="sum-label">Uruchomienia</div>
      <div class="sum-val">${entries.length}</div>
    </div>
    <div class="sum-card ok">
      <div class="sum-icon">✔</div>
      <div class="sum-label">Zdane</div>
      <div class="sum-val">${totalPassed}&thinsp;/&thinsp;${totalTests}</div>
    </div>
    <div class="sum-card ${totalFailed > 0 ? 'fail' : ''}">
      <div class="sum-icon">✖</div>
      <div class="sum-label">Błędy</div>
      <div class="sum-val">${totalFailed}</div>
    </div>
    <div class="sum-card">
      <div class="sum-icon">📊</div>
      <div class="sum-label">Pass rate</div>
      <div class="sum-val">${passRate}%</div>
    </div>
    <div class="sum-card">
      <div class="sum-icon">⏱</div>
      <div class="sum-label">Łączny czas</div>
      <div class="sum-val">${(totalDuration / 1000).toFixed(1)}s</div>
    </div>`;

  const runSections = entries.map((entry, idx) => {
    const s       = entry.summary ?? {};
    const byFile  = groupByFile(entry.results?.suites ?? []);
    const rPassed = s.passed  ?? 0;
    const rFailed = s.failed  ?? 0;
    const rSkipped = s.skipped ?? 0;

    const fileSections = byFile.map(({ file, tests }) => {
      const fp = tests.filter(t => t.status === 'passed').length;
      const ff = tests.filter(t => t.status === 'failed').length;
      const fs = tests.filter(t => t.status === 'skipped').length;

      const rows = tests.map(t => {
        const icon = t.status === 'passed' ? '✔' : t.status === 'failed' ? '✖' : '⏭';
        const errRow = t.error
          ? `<tr class="error-row"><td></td><td colspan="2" class="error-msg">${escHtml(t.error)}</td></tr>`
          : '';
        return `<tr class="test-row ${t.status}">
            <td class="status-cell"><span class="status-icon">${icon}</span></td>
            <td class="name-cell">${escHtml(t.title)}</td>
            <td class="dur-cell">${t.duration > 0 ? t.duration + 'ms' : '—'}</td>
          </tr>${errRow}`;
      }).join('');

      const chips = `<span class="chip ok">${fp} ✔</span>`
        + (ff > 0 ? `<span class="chip fail">${ff} ✖</span>` : '')
        + (fs > 0 ? `<span class="chip skip">${fs} ⏭</span>` : '');

      return `<div class="file-section">
          <div class="file-header">
            <span class="file-name">${escHtml(file || 'nieznany plik')}</span>
            <div class="file-chips">${chips}</div>
          </div>
          <table class="test-table"><tbody>${rows}</tbody></table>
        </div>`;
    }).join('');

    const tcBadge = entry.testCase
      ? `<span class="tc-badge">🏷 ${escHtml(entry.testCase)}</span>` : '';

    return `<div class="run-section${idx > 0 ? ' page-break' : ''}">
        <div class="run-header">
          <div class="run-title-row">
            <span class="run-num">Uruchomienie #${idx + 1}</span>
            <span class="run-badge ${entry.success ? 'ok' : 'fail'}">${entry.success ? '✔ OK' : '✖ BŁĄD'}</span>
            ${tcBadge}
          </div>
          <div class="run-meta">
            <span>📅 ${new Date(entry.time).toLocaleString('pl-PL')}</span>
            <span>⏱ ${(entry.duration / 1000).toFixed(1)}s</span>
            ${entry.files?.length ? `<span>📁 ${escHtml(entry.files.join(', '))}</span>` : ''}
          </div>
          <div class="run-chips">
            <span class="chip ok">${rPassed} ✔</span>
            ${rFailed  > 0 ? `<span class="chip fail">${rFailed} ✖</span>` : ''}
            ${rSkipped > 0 ? `<span class="chip skip">${rSkipped} ⏭</span>` : ''}
          </div>
        </div>
        ${fileSections || '<div class="no-details">Brak szczegółowych wyników.</div>'}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>

<div class="cover">
  <div class="cover-logo">🎭</div>
  <h1 class="cover-title">${escHtml(title)}</h1>
  <div class="cover-date">Wygenerowano: ${now}</div>
  <div class="summary-grid">${summaryGrid}</div>
</div>

${runSections}

<div class="report-footer">Wygenerowano przez Panel Test Runner &mdash; ${now}</div>
</body>
</html>`;
}

export function downloadReport(entries, filename, title) {
  const html = generateReport(entries, title);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename || `raport-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printReport(entries, title) {
  const html = generateReport(entries, title);
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}

// ─── embedded CSS (screen + print) ───────────────────────────────────────────

const REPORT_CSS = `
@page { margin: 18mm 14mm; size: A4; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
  font-size: 13px; line-height: 1.5;
  color: #1e293b; background: #f1f5f9;
}
.cover {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: white; padding: 44px 40px; margin-bottom: 24px; border-radius: 12px;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.cover-logo { font-size: 44px; margin-bottom: 12px; }
.cover-title { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
.cover-date { font-size: 12px; color: #94a3b8; margin-bottom: 28px; }
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
}
.sum-card {
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 8px; padding: 12px 10px; text-align: center;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.sum-card.ok   { background: rgba(34,197,94,.2);  border-color: rgba(34,197,94,.3); }
.sum-card.fail { background: rgba(239,68,68,.2);  border-color: rgba(239,68,68,.3); }
.sum-icon  { font-size: 17px; margin-bottom: 5px; }
.sum-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; }
.sum-val   { font-size: 19px; font-weight: 700; margin-top: 3px; }
.run-section {
  background: white; border: 1px solid #e2e8f0;
  border-radius: 10px; margin-bottom: 20px; overflow: hidden;
}
.page-break { page-break-before: auto; }
.run-header {
  background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 16px;
}
.run-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
.run-num  { font-weight: 700; font-size: 14px; color: #0f172a; }
.run-badge {
  display: inline-block; padding: 2px 8px; border-radius: 4px;
  font-size: 11px; font-weight: 600;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.run-badge.ok   { background: #dcfce7; color: #16a34a; }
.run-badge.fail { background: #fee2e2; color: #dc2626; }
.tc-badge {
  display: inline-block; padding: 2px 8px; border-radius: 4px;
  font-size: 11px; background: #ede9fe; color: #7c3aed;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.run-meta {
  font-size: 11px; color: #64748b;
  display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 5px;
}
.run-chips { display: flex; gap: 5px; }
.chip {
  display: inline-block; padding: 2px 7px; border-radius: 4px;
  font-size: 11px; font-weight: 600;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.chip.ok   { background: #dcfce7; color: #16a34a; }
.chip.fail { background: #fee2e2; color: #dc2626; }
.chip.skip { background: #f1f5f9; color: #64748b; }
.file-section { border-bottom: 1px solid #f1f5f9; }
.file-section:last-child { border-bottom: none; }
.file-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 16px; background: #fafafa; border-bottom: 1px solid #f1f5f9;
}
.file-name {
  font-size: 11px; font-family: 'Cascadia Code','Fira Code',Consolas,monospace;
  color: #334155; font-weight: 600;
}
.file-chips { display: flex; gap: 4px; }
.test-table { width: 100%; border-collapse: collapse; }
.test-row { border-bottom: 1px solid #f8fafc; }
.test-row.passed .status-icon { color: #16a34a; font-weight: 700; }
.test-row.failed .status-icon { color: #dc2626; font-weight: 700; }
.test-row.skipped .status-icon { color: #94a3b8; }
.status-cell { width: 30px; padding: 5px 0 5px 14px; text-align: center; }
.name-cell   { padding: 5px 8px; font-size: 12px; }
.dur-cell    { padding: 5px 14px 5px 8px; text-align: right; font-size: 11px; color: #94a3b8; white-space: nowrap; }
.error-msg {
  padding: 3px 14px 7px 44px;
  font-size: 11px; color: #dc2626;
  font-family: 'Cascadia Code','Fira Code',Consolas,monospace;
  white-space: pre-wrap; word-break: break-all;
}
.no-details { padding: 14px 16px; font-size: 12px; color: #94a3b8; }
.report-footer {
  text-align: center; font-size: 11px; color: #94a3b8;
  margin-top: 28px; padding-bottom: 24px;
}
@media print {
  body { background: white; }
  .run-section { break-inside: avoid; box-shadow: none; border: 1px solid #ccc; }
}
`;
