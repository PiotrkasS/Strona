import { useEffect, useRef, useState, useCallback } from 'react';
import ResultsPanel from './ResultsPanel.jsx';

export default function TestRunner() {
  const [files, setFiles]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(null);
  // selections: { [path]: string[] } — selected test names per file
  const [selections, setSelections] = useState({});
  const [expanded, setExpanded]     = useState({});
  const [headed, setHeaded]         = useState(false);
  const [running, setRunning]       = useState(false);
  const [lines, setLines]           = useState([]);
  const [progress, setProgress]     = useState({ done: 0, total: 0 });
  const [runResult, setRunResult]   = useState(null);
  const [runError, setRunError]     = useState(null);

  useEffect(() => {
    fetch('/api/tests')
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(d => {
        const f = d.files ?? [];
        setFiles(f);
        const sel = {};
        const exp = {};
        f.forEach(file => { sel[file.path] = []; exp[file.path] = true; });
        setSelections(sel);
        setExpanded(exp);
      })
      .catch(e => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── selection helpers ────────────────────────────────────────────────────

  const fileState = useCallback((path, allTests) => {
    const sel = selections[path] ?? [];
    if (sel.length === 0) return 'none';
    if (sel.length === allTests.length) return 'all';
    return 'some';
  }, [selections]);

  const toggleFile = useCallback((path, allTests) => {
    setSelections(prev => {
      const isAll = (prev[path] ?? []).length === allTests.length;
      return { ...prev, [path]: isAll ? [] : [...allTests] };
    });
  }, []);

  const toggleTest = useCallback((path, testName) => {
    setSelections(prev => {
      const cur = prev[path] ?? [];
      const has = cur.includes(testName);
      return { ...prev, [path]: has ? cur.filter(t => t !== testName) : [...cur, testName] };
    });
  }, []);

  const toggleExpand = useCallback(path => setExpanded(p => ({ ...p, [path]: !p[path] })), []);

  const selectAll   = () => setSelections(Object.fromEntries(files.map(f => [f.path, [...f.tests]])));
  const deselectAll = () => setSelections(Object.fromEntries(files.map(f => [f.path, []])));

  const totalSelected = files.reduce((n, f) => n + (selections[f.path]?.length ?? 0), 0);
  const totalTests    = files.reduce((n, f) => n + f.tests.length, 0);

  // ── run ──────────────────────────────────────────────────────────────────

  const runTests = async () => {
    if (totalSelected === 0) return;
    // Count total selected tests for progress bar
    const total = files.reduce((n, f) => n + (selections[f.path]?.length ?? 0), 0);

    setRunning(true);
    setLines([]);
    setProgress({ done: 0, total });
    setRunResult(null);
    setRunError(null);

    // Build payload: only files with ≥1 test selected
    const selectedFiles = files
      .filter(f => (selections[f.path]?.length ?? 0) > 0)
      .map(f => {
        const sel = selections[f.path];
        const isAll = sel.length === f.tests.length;
        return { path: f.path, tests: isAll ? null : sel };
      });

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: selectedFiles, options: { headed } }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? response.statusText);
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const eventLines = event.split('\n');
          let eventType = 'message';
          let eventData = '';
          for (const l of eventLines) {
            if (l.startsWith('event: ')) eventType = l.slice(7).trim();
            else if (l.startsWith('data: ')) eventData = l.slice(6);
          }
          if (!eventData) continue;
          const parsed = JSON.parse(eventData);

          if (eventType === 'done') {
            setRunResult(parsed);
            saveHistory(selectedFiles.map(f => f.path), parsed);
          } else if (eventType === 'error') {
            setRunError(parsed.message ?? 'Nieznany błąd');
          } else {
            // detect completed test line (✓ or ✗ prefix from list reporter)
            if (/^\s*[✓✗×]\s+\d+/.test(parsed)) {
              setProgress(p => ({ ...p, done: Math.min(p.done + 1, p.total) }));
            }
            setLines(prev => [...prev, parsed]);
          }
        }
      }
    } catch (e) {
      setRunError(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading)    return <div className="empty"><div className="icon">⏳</div><h3>Ładowanie testów…</h3></div>;
  if (fetchError) return <div className="alert alert-error">⚠ Błąd ładowania: {fetchError}</div>;

  return (
    <div>
      <h1 className="page-title">Uruchom testy</h1>
      <p className="page-sub">Wybierz testy do uruchomienia i kliknij "Uruchom"</p>

      {/* ── toolbar ── */}
      <div className="toolbar">
        <button className="btn btn-ghost btn-sm" onClick={selectAll}>✔ Zaznacz wszystkie</button>
        <button className="btn btn-ghost btn-sm" onClick={deselectAll}>✖ Odznacz wszystkie</button>

        {/* headed toggle */}
        <label className="headed-toggle" title="Otwiera przeglądarkę na żywo (działa tylko lokalnie, nie w Docker)">
          <span className="headed-icon">🖥️</span>
          <span>Tryb wizualny</span>
          <div className={`toggle-switch ${headed ? 'on' : ''}`} onClick={() => setHeaded(v => !v)}>
            <div className="toggle-thumb" />
          </div>
          {headed && <span className="headed-badge">HEADED</span>}
        </label>

        <span className="toolbar-spacer" />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          Wybrano: <strong style={{ color: 'var(--text)' }}>{totalSelected}</strong> / {totalTests} testów
        </span>
        <button
          className="btn btn-primary"
          onClick={runTests}
          disabled={running || totalSelected === 0}
        >
          {running ? <><div className="spinner" /> Uruchamianie…</> : '▶ Uruchom wybrane'}
        </button>
      </div>

      {/* ── file cards ── */}
      {files.length === 0 && (
        <div className="empty">
          <div className="icon">🔍</div>
          <h3>Brak plików testów</h3>
          <p>Dodaj pliki <code>*.spec.ts</code> do folderu <code>tests/</code></p>
        </div>
      )}

      {files.map(file => {
        const state    = fileState(file.path, file.tests);
        const selCount = selections[file.path]?.length ?? 0;
        const isExp    = expanded[file.path];

        return (
          <div key={file.path} className={`file-card ${state !== 'none' ? 'file-card-active' : ''}`}>
            <div className="file-header">
              <FileCheckbox
                state={state}
                onChange={() => toggleFile(file.path, file.tests)}
              />
              <div className="file-header-left" onClick={() => toggleExpand(file.path)}>
                <span className={`file-chevron${isExp ? ' open' : ''}`}>▶</span>
                <div>
                  <div className="file-name">{file.name}</div>
                  <div className="file-category">{file.category}</div>
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                {state !== 'none' && (
                  <span className="sel-chip">{selCount} / {file.tests.length}</span>
                )}
                <span className="file-badge">{file.tests.length} testów</span>
                <span style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'monospace' }}>{file.path}</span>
              </div>
            </div>

            {isExp && file.tests.length > 0 && (
              <div className="file-body">
                <ul className="test-list">
                  {file.tests.map((name, i) => {
                    const checked = (selections[file.path] ?? []).includes(name);
                    return (
                      <li key={i} className={`test-item ${checked ? 'test-item-checked' : ''}`}>
                        <label>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTest(file.path, name)}
                          />
                          <span className="test-emoji">🧪</span>
                          <span>{name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}

      {runError && <div className="alert alert-error" style={{ marginTop: 16 }}>⚠ Błąd: {runError}</div>}

      {/* ── progress bar ── */}
      {progress.total > 0 && (running || runResult) && (
        <ProgressBar done={progress.done} total={progress.total} success={runResult?.success} />
      )}

      {(lines.length > 0 || running) && <Terminal lines={lines} running={running} />}

      {runResult && <ResultsPanel result={runResult} />}
    </div>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ done, total, success }) {
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
  const isDone  = done >= total;
  const color   = isDone ? (success === false ? 'var(--error)' : 'var(--success)') : 'var(--primary)';

  return (
    <div className="progress-wrap">
      <div className="progress-meta">
        <span>{isDone ? (success === false ? '❌ Zakończono z błędami' : '✅ Zakończono') : '⏳ Trwa…'}</span>
        <span className="progress-count">{done} / {total} testów</span>
        <span className="progress-pct">{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── FileCheckbox (supports indeterminate) ─────────────────────────────────────

function FileCheckbox({ state, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="file-check"
      checked={state === 'all'}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
    />
  );
}

// ── Terminal ──────────────────────────────────────────────────────────────────

function Terminal({ lines, running }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <div className="terminal" ref={ref}>
      {running && lines.length === 0 && (
        <div className="terminal-line muted">Uruchamianie playwright…</div>
      )}
      {lines.map((line, i) => (
        <div key={i} className={`terminal-line ${lineClass(line)}`}>{line || ' '}</div>
      ))}
      {running && <span className="terminal-cursor" />}
    </div>
  );
}

function lineClass(line) {
  if (/✓|passed|PASS/i.test(line))        return 'ok';
  if (/✗|×|failed|FAIL|Error/i.test(line)) return 'err';
  if (/warning/i.test(line))               return 'warn';
  return '';
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseSummary(results) {
  if (!results?.stats) return { passed: 0, failed: 0, skipped: 0 };
  const { expected = 0, unexpected = 0, skipped = 0 } = results.stats;
  return { passed: expected, failed: unexpected, skipped };
}

function saveHistory(paths, data) {
  const entry = {
    id: Date.now(), time: new Date().toISOString(),
    files: paths, duration: data.duration,
    success: data.success, summary: parseSummary(data.results),
    results: data.results,
  };
  const history = JSON.parse(localStorage.getItem('pw_history') ?? '[]');
  history.unshift(entry);
  localStorage.setItem('pw_history', JSON.stringify(history.slice(0, 50)));
}
