import { useState } from 'react';

export default function ResultsPanel({ result }) {
  const [open, setOpen] = useState(false);

  const { success, duration, results } = result;
  const stats   = results?.stats ?? {};
  const passed  = stats.expected   ?? 0;
  const failed  = stats.unexpected ?? 0;
  const skipped = stats.skipped    ?? 0;
  const total   = passed + failed + skipped;

  const byFile = groupByFile(results?.suites ?? []);

  return (
    <div className="results-wrap">
      {/* ── compact summary bar ── */}
      <div className={`results-bar ${success ? 'bar-ok' : 'bar-fail'}`}>
        <span className="bar-icon">{success ? '✅' : '❌'}</span>
        <span className="bar-label">Wyniki:</span>

        <span className="bar-chip ok">{passed} ✔</span>
        {failed  > 0 && <span className="bar-chip fail">{failed} ✖</span>}
        {skipped > 0 && <span className="bar-chip skip">{skipped} ⏭</span>}

        <span className="bar-total">/ {total}</span>
        <span className="bar-time">⏱ {(duration / 1000).toFixed(1)}s</span>

        <button
          className="bar-toggle"
          onClick={() => setOpen(v => !v)}
        >
          {open ? '▲ Zwiń' : '▼ Szczegóły'}
        </button>
      </div>

      {/* ── expandable details ── */}
      {open && (
        <div className="results-details">
          {byFile.length === 0 && (
            <div className="alert alert-info">ℹ Brak szczegółowych wyników — sprawdź terminal powyżej.</div>
          )}

          {byFile.map(({ file, tests }) => {
            const filePassed  = tests.filter(t => t.status === 'passed').length;
            const fileFailed  = tests.filter(t => t.status === 'failed').length;
            const fileSkipped = tests.filter(t => t.status === 'skipped').length;

            return (
              <FileResult
                key={file}
                file={file}
                tests={tests}
                passed={filePassed}
                failed={fileFailed}
                skipped={fileSkipped}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function FileResult({ file, tests, passed, failed, skipped }) {
  const [open, setOpen] = useState(failed > 0); // auto-open if there are failures

  return (
    <div className="file-result-card">
      {/* file header */}
      <div className="file-result-header" onClick={() => setOpen(v => !v)}>
        <span className="file-result-chevron">{open ? '▼' : '▶'}</span>
        <span className="file-result-name">{file || 'nieznany plik'}</span>
        <div className="file-result-chips">
          <span className="bar-chip ok">{passed} ✔</span>
          {failed  > 0 && <span className="bar-chip fail">{failed} ✖</span>}
          {skipped > 0 && <span className="bar-chip skip">{skipped} ⏭</span>}
        </div>
      </div>

      {/* individual tests */}
      {open && (
        <div className="file-result-body">
          {tests.map((t, i) => (
            <div key={i} className={`tr-item tr-${t.status}`}>
              <span className="tr-icon">
                {t.status === 'passed'  && '✔'}
                {t.status === 'failed'  && '✖'}
                {t.status === 'skipped' && '⏭'}
              </span>
              <div className="tr-info">
                <div className="tr-name">{t.title}</div>
                {t.duration > 0 && (
                  <div className="tr-dur">{t.duration}ms</div>
                )}
                {t.error && (
                  <div className="tr-error">{t.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function groupByFile(suites) {
  const map = new Map();

  function walk(suites, file) {
    for (const suite of suites) {
      const f = suite.file ?? file;
      if (suite.specs) {
        if (!map.has(f)) map.set(f, []);
        for (const spec of suite.specs) {
          const res    = spec.tests?.[0]?.results?.[0] ?? {};
          const status = resolveStatus(spec.tests?.[0]);
          const error  = res.errors?.[0]?.message ?? res.error?.message ?? null;
          map.get(f).push({
            title:    spec.title,
            status,
            duration: res.duration ?? 0,
            error,
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
  if (!r) return 'skipped';
  return r.status === 'passed' ? 'passed' : r.status === 'skipped' ? 'skipped' : 'failed';
}
