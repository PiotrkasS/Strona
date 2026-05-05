import { useState } from 'react';

export default function ResultsPanel({ result }) {
  const [showRaw, setShowRaw] = useState(false);

  const { success, duration, results, rawOutput } = result;
  const stats = results?.stats ?? {};
  const passed  = stats.expected  ?? 0;
  const failed  = stats.unexpected ?? 0;
  const skipped = stats.skipped   ?? 0;
  const total   = passed + failed + skipped;

  const flatTests = flattenTests(results?.suites ?? []);

  return (
    <div style={{ marginTop: 24 }}>
      <div className="section-title">
        {success ? '✅' : '❌'} Wyniki uruchomienia
      </div>

      <div className="results-summary">
        <span>
          <span className="label">Czas:</span>
          <span className="value">{(duration / 1000).toFixed(1)}s</span>
        </span>
        <span>
          <span className="label">Łącznie:</span>
          <span className="value">{total}</span>
        </span>
        <span>
          <span className="label" style={{ color: 'var(--success)' }}>✔ Zaliczone:</span>
          <span className="value" style={{ color: 'var(--success)' }}>{passed}</span>
        </span>
        <span>
          <span className="label" style={{ color: 'var(--error)' }}>✖ Błędy:</span>
          <span className="value" style={{ color: 'var(--error)' }}>{failed}</span>
        </span>
        {skipped > 0 && (
          <span>
            <span className="label">⏭ Pominięte:</span>
            <span className="value" style={{ color: 'var(--skipped)' }}>{skipped}</span>
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowRaw(v => !v)}>
            {showRaw ? '▲ Ukryj' : '▼ Surowy output'}
          </button>
        </span>
      </div>

      {flatTests.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {flatTests.map((t, i) => (
            <div key={i} className="test-result-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="test-result-name">{t.title}</div>
                <div className="test-result-file">{t.file}</div>
                {t.error && <div className="error-details">{t.error}</div>}
              </div>
              <div className="test-result-meta">
                <span className="test-result-duration">{t.duration}ms</span>
                <span className={`result-badge ${t.status}`}>
                  {t.status === 'passed'  && '✔ Zaliczony'}
                  {t.status === 'failed'  && '✖ Błąd'}
                  {t.status === 'skipped' && '⏭ Pominięty'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {flatTests.length === 0 && rawOutput && (
        <div className="alert alert-info">ℹ Brak szczegółowych wyników. Sprawdź surowy output poniżej.</div>
      )}

      {showRaw && rawOutput && (
        <div className="raw-output">{rawOutput}</div>
      )}
    </div>
  );
}

function flattenTests(suites, file = '') {
  const out = [];
  for (const suite of suites) {
    const f = suite.file ?? file;
    if (suite.specs) {
      for (const spec of suite.specs) {
        const testResult = spec.tests?.[0]?.results?.[0] ?? {};
        const status = resolveStatus(spec.tests?.[0]);
        const error = testResult.errors?.[0]?.message ?? testResult.error?.message ?? null;
        out.push({
          title:    spec.title,
          file:     f,
          status,
          duration: testResult.duration ?? 0,
          error,
        });
      }
    }
    if (suite.suites) {
      out.push(...flattenTests(suite.suites, f));
    }
  }
  return out;
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
