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

                {/* ── Akcje: screenshoty + trace ── */}
                {(t.screenshots?.length > 0 || t.traces?.length > 0) && (
                  <div className="tr-attachments">
                    {t.screenshots?.map((sc, si) => (
                      <a key={si} href={`/api/screenshot?path=${encodeURIComponent(sc)}`}
                         target="_blank" rel="noreferrer" className="screenshot-thumb">
                        <img src={`/api/screenshot?path=${encodeURIComponent(sc)}`}
                          alt="screenshot" loading="lazy" />
                        <span>📷 Zrzut</span>
                      </a>
                    ))}
                    {t.traces?.map((tr, ti) => (
                      <TraceButtons key={ti} tracePath={tr} />
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

function TraceButtons({ tracePath }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [viewerUrl, setViewerUrl] = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');

  const launch = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/trace-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tracePath }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Błąd serwera');
      if (!d.ready) throw new Error('Serwer nie odpowiada — spróbuj ponownie');
      setViewerUrl(d.url);
      setStatus('ready');
      window.open(d.url, '_blank');
    } catch (e) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  const downloadUrl = `/api/trace-file?path=${encodeURIComponent(tracePath)}`;

  return (
    <div className="trace-row">
      <button className="btn btn-ghost btn-xs trace-btn" onClick={launch}
        disabled={status === 'loading'} title="Uruchom Playwright Trace Viewer">
        {status === 'loading'
          ? <><div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> Uruchamiam…</>
          : status === 'ready'
            ? '🔍 Otwórz ponownie'
            : '🔍 Trace Viewer'}
      </button>

      <a href={downloadUrl} download className="btn btn-ghost btn-xs"
        title="Pobierz plik trace.zip">
        ⬇ trace.zip
      </a>

      {status === 'ready' && viewerUrl && (
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          → <a href={viewerUrl} target="_blank" rel="noreferrer"
              style={{ color: 'var(--primary)' }}>{viewerUrl}</a>
        </span>
      )}
      {status === 'error' && (
        <span style={{ fontSize: 11, color: 'var(--error)' }}>⚠ {errorMsg}</span>
      )}
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

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
          const screenshots = (res.attachments ?? [])
            .filter(a => a.contentType?.includes('image') || a.name === 'screenshot')
            .map(a => extractRelPath(a.path ?? ''))
            .filter(Boolean);
          const traces = (res.attachments ?? [])
            .filter(a => a.name === 'trace' || a.path?.endsWith('trace.zip'))
            .map(a => extractRelPath(a.path ?? ''))
            .filter(Boolean);
          map.get(f).push({
            title:    spec.title,
            status:   resolveStatus(test),
            duration: res.duration ?? 0,
            error:    res.errors?.[0]?.message ?? null,
            screenshots,
            traces,
          });
        }
      }
      if (suite.suites) walk(suite.suites, f);
    }
  }
  walk(suites, '');
  return [...map.entries()].map(([file, tests]) => ({ file, tests }));
}

function extractRelPath(p) {
  const i = p.indexOf('/test-results/');
  return i >= 0 ? p.slice(i + 14) : null;
}

function resolveStatus(test) {
  if (!test) return 'skipped';
  if (test.status === 'expected')   return 'passed';
  if (test.status === 'unexpected') return 'failed';
  if (test.status === 'skipped')    return 'skipped';
  const r = test.results?.[0];
  return !r ? 'skipped' : r.status === 'passed' ? 'passed' : r.status === 'skipped' ? 'skipped' : 'failed';
}
