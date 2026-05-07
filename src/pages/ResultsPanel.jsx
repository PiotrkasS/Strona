import { useState } from 'react';

export default function ResultsPanel({ result }) {
  const [open, setOpen] = useState(false);

  const { success, duration, results } = result;
  const stats   = results?.stats ?? {};
  const passed  = stats.expected   ?? 0;
  const failed  = stats.unexpected ?? 0;
  const skipped = stats.skipped    ?? 0;
  const total   = passed + failed + skipped;
  const byFile  = groupByFile(results?.suites ?? []);

  return (
    <div className="results-wrap">
      <div className={`results-bar ${success ? 'bar-ok' : 'bar-fail'}`}>
        <span className="bar-icon">{success ? '✅' : '❌'}</span>
        <span className="bar-label">Wyniki:</span>
        <span className="bar-chip ok">{passed} ✔</span>
        {failed  > 0 && <span className="bar-chip fail">{failed} ✖</span>}
        {skipped > 0 && <span className="bar-chip skip">{skipped} ⏭</span>}
        <span className="bar-total">/ {total}</span>
        <span className="bar-time">⏱ {(duration / 1000).toFixed(1)}s</span>
        <button className="bar-toggle" onClick={() => setOpen(v => !v)}>
          {open ? '▲ Zwiń' : '▼ Szczegóły'}
        </button>
      </div>

      {open && (
        <div className="results-details">
          {byFile.length === 0 && <div className="alert alert-info">ℹ Brak szczegółowych wyników.</div>}
          {byFile.map(({ file, tests }) => (
            <FileResult key={file} file={file} tests={tests}
              passed={tests.filter(t => t.status === 'passed').length}
              failed={tests.filter(t => t.status === 'failed').length}
              skipped={tests.filter(t => t.status === 'skipped').length} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileResult({ file, tests, passed, failed, skipped }) {
  const [open, setOpen] = useState(failed > 0);
  return (
    <div className="file-result-card">
      <div className="file-result-header" onClick={() => setOpen(v => !v)}>
        <span className="file-result-chevron">{open ? '▼' : '▶'}</span>
        <span className="file-result-name">{file || 'nieznany plik'}</span>
        <div className="file-result-chips">
          <span className="bar-chip ok">{passed} ✔</span>
          {failed  > 0 && <span className="bar-chip fail">{failed} ✖</span>}
          {skipped > 0 && <span className="bar-chip skip">{skipped} ⏭</span>}
        </div>
      </div>
      {open && (
        <div className="file-result-body">
          {tests.map((t, i) => (
            <div key={i} className={`tr-item tr-${t.status}`}>
              <span className="tr-icon">
                {t.status === 'passed' ? '✔' : t.status === 'failed' ? '✖' : '⏭'}
              </span>
              <div className="tr-info" style={{ flex: 1 }}>
                <div className="tr-name">{t.title}</div>
                {t.duration > 0 && <div className="tr-dur">{t.duration}ms</div>}
                {t.error && <div className="tr-error">{t.error}</div>}
                {t.screenshots?.length > 0 && (
                  <div className="screenshot-row">
                    {t.screenshots.map((sc, si) => (
                      <a key={si} href={`/api/screenshot?path=${encodeURIComponent(sc)}`}
                         target="_blank" rel="noreferrer" className="screenshot-thumb">
                        <img src={`/api/screenshot?path=${encodeURIComponent(sc)}`}
                          alt="screenshot" loading="lazy" />
                        <span>📷 Zrzut</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByFile(suites) {
  const map = new Map();
  function walk(suites, file) {
    for (const suite of suites) {
      const f = suite.file ?? file;
      if (suite.specs) {
        if (!map.has(f)) map.set(f, []);
        for (const spec of suite.specs) {
          const test = spec.tests?.[0];
          const res  = test?.results?.[0] ?? {};
          const screenshots = (res.attachments ?? [])
            .filter(a => a.contentType?.includes('image') || a.name === 'screenshot')
            .map(a => { const p = a.path ?? ''; const i = p.indexOf('/test-results/'); return i >= 0 ? p.slice(i + 14) : null; })
            .filter(Boolean);
          map.get(f).push({
            title: spec.title,
            status: resolveStatus(test),
            duration: res.duration ?? 0,
            error: res.errors?.[0]?.message ?? null,
            screenshots,
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
