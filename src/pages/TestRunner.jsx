import { useEffect, useRef, useState, useCallback } from 'react';
import ResultsPanel from './ResultsPanel.jsx';
import EditorModal from '../components/EditorModal.jsx';

export default function TestRunner() {
  const [files, setFiles]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [selections, setSelections] = useState({});
  const [expanded, setExpanded]     = useState({});
  const [headed, setHeaded]         = useState(true);
  const [editFile, setEditFile]     = useState(null); // { path, name }
  const [running, setRunning]       = useState(false);
  const [lines, setLines]           = useState([]);
  const [progress, setProgress]     = useState({ done: 0, total: 0 });
  const [runResult, setRunResult]   = useState(null);
  const [runError, setRunError]     = useState(null);

  const loadTests = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);

    fetch('/api/tests', { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`); return r.json(); })
      .then(d => {
        const f = d.files ?? [];
        setFiles(f);
        const sel = {};
        const exp = {};
        f.forEach(file => { sel[file.path] = []; exp[file.path] = true; });
        setSelections(sel);
        setExpanded(exp);
      })
      .catch(e => setFetchError(e.name === 'AbortError' ? 'Timeout — serwer nie odpowiada. Sprawdź czy Docker działa.' : e.message))
      .finally(() => { clearTimeout(timer); setLoading(false); });
  }, []);

  useEffect(() => { loadTests(); }, [loadTests]);

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

  // ── delete ───────────────────────────────────────────────────────────────

  const deleteTest = useCallback(async (path) => {
    const res = await fetch('/api/tests?path=' + encodeURIComponent(path), { method: 'DELETE' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Błąd usuwania'); return; }
    setFiles(prev => prev.filter(f => f.path !== path));
    setSelections(prev => { const n = { ...prev }; delete n[path]; return n; });
    setExpanded(prev => { const n = { ...prev }; delete n[path]; return n; });
  }, []);

  // ── run ──────────────────────────────────────────────────────────────────

  const runTests = async () => {
    if (totalSelected === 0) return;
    const total = totalSelected;
    setRunning(true);
    setLines([]);
    setProgress({ done: 0, total });
    setRunResult(null);
    setRunError(null);

    const selectedFiles = files
      .filter(f => (selections[f.path]?.length ?? 0) > 0)
      .map(f => {
        const sel = selections[f.path];
        return { path: f.path, tests: sel.length === f.tests.length ? null : sel };
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
          const evLines = event.split('\n');
          let evType = 'message', evData = '';
          for (const l of evLines) {
            if (l.startsWith('event: ')) evType = l.slice(7).trim();
            else if (l.startsWith('data: ')) evData = l.slice(6);
          }
          if (!evData) continue;
          const parsed = JSON.parse(evData);

          if (evType === 'done') {
            setRunResult(parsed);
            saveHistory(selectedFiles.map(f => f.path), parsed);
          } else if (evType === 'error') {
            setRunError(parsed.message ?? 'Nieznany błąd');
          } else {
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

  if (loading) return (
    <div className="empty">
      <div className="icon">⏳</div>
      <h3>Ładowanie testów…</h3>
      <p style={{ marginTop: 8, fontSize: 12 }}>Łączenie z API…</p>
    </div>
  );

  if (fetchError) return (
    <div style={{ padding: 32 }}>
      <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠ {fetchError}</div>
      <button className="btn btn-ghost" onClick={loadTests}>↺ Spróbuj ponownie</button>
    </div>
  );

  const hasOutput = lines.length > 0 || running || runResult || runError;

  return (
    <div>
      <h1 className="page-title">Uruchom testy</h1>
      <p className="page-sub">Wybierz testy i kliknij "Uruchom"</p>

      {/* ── toolbar ── */}
      <div className="toolbar">
        <button className="btn btn-ghost btn-sm" onClick={selectAll}>✔ Zaznacz wszystkie</button>
        <button className="btn btn-ghost btn-sm" onClick={deselectAll}>✖ Odznacz wszystkie</button>

        <label className="headed-toggle">
          <span className="headed-icon">🖥️</span>
          <span>Tryb wizualny</span>
          <div className={`toggle-switch ${headed ? 'on' : ''}`} onClick={() => setHeaded(v => !v)}>
            <div className="toggle-thumb" />
          </div>
          {headed && <span className="headed-badge">HEADED</span>}
        </label>

        <span className="toolbar-spacer" />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          Wybrano: <strong style={{ color: 'var(--text)' }}>{totalSelected}</strong> / {totalTests}
        </span>
        <button className="btn btn-primary" onClick={runTests} disabled={running || totalSelected === 0}>
          {running ? <><div className="spinner" /> Uruchamianie…</> : '▶ Uruchom wybrane'}
        </button>
      </div>

      {/* ── two-panel split ── */}
      <div className="runner-split">

        {/* LEFT — test list */}
        <div className="runner-panel runner-panel-left">
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
                  <FileCheckbox state={state} onChange={() => toggleFile(file.path, file.tests)} />
                  <div className="file-header-left" onClick={() => toggleExpand(file.path)}>
                    <span className={`file-chevron${isExp ? ' open' : ''}`}>▶</span>
                    <div>
                      <div className="file-name">{file.name}</div>
                      <div className="file-category">{file.category}</div>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {state !== 'none'
                      ? <span className="sel-chip">{selCount} / {file.tests.length}</span>
                      : <span className="file-badge">{file.tests.length} testów</span>
                    }
                    <button className="btn-icon" title="Edytuj plik"
                      onClick={e => { e.stopPropagation(); setEditFile({ path: file.path, name: file.name }); }}>
                      ✏️
                    </button>
                    <DeleteButton path={file.path} onDelete={deleteTest} />
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
                              <input type="checkbox" checked={checked} onChange={() => toggleTest(file.path, name)} />
                              <span className="test-dot" />
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
        </div>

        {/* RIGHT — output panel */}
        <div className="runner-panel runner-panel-right">
          {!hasOutput && (
            <div className="runner-right-empty">
              <div style={{ fontSize: 32, marginBottom: 12 }}>▶</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Tu pojawi się wynik testów</div>
              <div style={{ fontSize: 12 }}>Wybierz testy po lewej i kliknij "Uruchom"</div>
              {headed && (
                <div style={{ marginTop: 16, fontSize: 12 }}>
                  🖥️ Tryb wizualny włączony — przeglądarka otworzy się w{' '}
                  <a href="http://localhost:7900/vnc_auto.html" target="_blank" rel="noreferrer"
                     style={{ color: 'var(--primary)' }}>localhost:7900</a>
                </div>
              )}
            </div>
          )}

          {running && headed && (
            <div className="alert alert-info" style={{ marginBottom: 12 }}>
              🖥️ Przeglądarka otwarta w Docker —{' '}
              <a href="http://localhost:7900/vnc_auto.html" target="_blank" rel="noreferrer"
                 style={{ color: 'var(--primary)', fontWeight: 600 }}>
                Otwórz podgląd na localhost:7900
              </a>
            </div>
          )}

          {runError && <div className="alert alert-error">⚠ Błąd: {runError}</div>}

          {progress.total > 0 && (running || runResult) && (
            <ProgressBar done={progress.done} total={progress.total} success={runResult?.success} />
          )}

          {(lines.length > 0 || running) && <Terminal lines={lines} running={running} />}

          {runResult && <ResultsPanel result={runResult} />}
        </div>
      </div>

      {editFile && (
        <EditorModal
          path={editFile.path}
          name={editFile.name}
          onClose={() => setEditFile(null)}
          onSaved={loadTests}
        />
      )}
    </div>
  );
}

// ── DeleteButton ──────────────────────────────────────────────────────────────

function DeleteButton({ path, onDelete }) {
  const [confirm, setConfirm] = useState(false);

  if (confirm) return (
    <span style={{ display: 'flex', gap: 4 }}>
      <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); onDelete(path); }}
        style={{ padding: '3px 10px', fontSize: 11 }}>Usuń</button>
      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setConfirm(false); }}
        style={{ padding: '3px 8px', fontSize: 11 }}>✕</button>
    </span>
  );

  return (
    <button className="btn-delete" title="Usuń plik testu"
      onClick={e => { e.stopPropagation(); setConfirm(true); }}>🗑</button>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ done, total, success }) {
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;
  const isDone = done >= total;
  const color  = isDone ? (success === false ? 'var(--error)' : 'var(--success)') : 'var(--primary)';

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

// ── FileCheckbox ──────────────────────────────────────────────────────────────

function FileCheckbox({ state, onChange }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = state === 'some'; }, [state]);
  return (
    <input ref={ref} type="checkbox" className="file-check"
      checked={state === 'all'} onChange={onChange} onClick={e => e.stopPropagation()} />
  );
}

// ── Terminal ──────────────────────────────────────────────────────────────────

function Terminal({ lines, running }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);

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
