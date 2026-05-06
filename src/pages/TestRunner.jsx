import { useEffect, useRef, useState, useCallback } from 'react';
import ResultsPanel from './ResultsPanel.jsx';

export default function TestRunner() {
  const [files, setFiles]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [selected, setSelected]     = useState({});
  const [expanded, setExpanded]     = useState({});
  const [running, setRunning]       = useState(false);
  const [lines, setLines]           = useState([]);
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
        f.forEach(file => { sel[file.path] = false; exp[file.path] = true; });
        setSelected(sel);
        setExpanded(exp);
      })
      .catch(e => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleFile    = useCallback(path => setSelected(p => ({ ...p, [path]: !p[path] })), []);
  const toggleExpand  = useCallback(path => setExpanded(p => ({ ...p, [path]: !p[path] })), []);
  const selectAll     = () => { const s = {}; files.forEach(f => { s[f.path] = true; }); setSelected(s); };
  const deselectAll   = () => { const s = {}; files.forEach(f => { s[f.path] = false; }); setSelected(s); };
  const selectedPaths = files.filter(f => selected[f.path]).map(f => f.path);

  const runTests = async () => {
    if (selectedPaths.length === 0) return;
    setRunning(true);
    setLines([]);
    setRunResult(null);
    setRunError(null);

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: selectedPaths }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? response.statusText);
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (separated by double newline)
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
            saveHistory(selectedPaths, parsed);
          } else if (eventType === 'error') {
            setRunError(parsed.message ?? 'Nieznany błąd');
          } else {
            // regular output line
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
        <span className="toolbar-spacer" />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          Wybrano: <strong style={{ color: 'var(--text)' }}>{selectedPaths.length}</strong> / {files.length} plików
        </span>
        <button
          className="btn btn-primary"
          onClick={runTests}
          disabled={running || selectedPaths.length === 0}
        >
          {running ? <><div className="spinner" /> Uruchamianie…</> : '▶ Uruchom wybrane'}
        </button>
      </div>

      {/* ── file list ── */}
      {files.length === 0 && (
        <div className="empty">
          <div className="icon">🔍</div>
          <h3>Brak plików testów</h3>
          <p>Dodaj pliki <code>*.spec.ts</code> do folderu <code>tests/</code></p>
        </div>
      )}

      {files.map(file => (
        <div key={file.path} className="file-card">
          <div className="file-header">
            <input
              type="checkbox"
              className="file-check"
              checked={!!selected[file.path]}
              onChange={() => toggleFile(file.path)}
              onClick={e => e.stopPropagation()}
            />
            <div className="file-header-left" onClick={() => toggleExpand(file.path)}>
              <span className={`file-chevron${expanded[file.path] ? ' open' : ''}`}>▶</span>
              <div>
                <div className="file-name">{file.name}</div>
                <div className="file-category">{file.category}</div>
              </div>
            </div>
            <span className="file-badge">{file.tests.length} testów</span>
            <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8, fontFamily: 'monospace' }}>{file.path}</span>
          </div>

          {expanded[file.path] && file.tests.length > 0 && (
            <div className="file-body">
              <ul className="test-list">
                {file.tests.map((name, i) => (
                  <li key={i} className="test-item">
                    <label><span>🧪</span> {name}</label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      {runError && <div className="alert alert-error">⚠ Błąd: {runError}</div>}

      {/* ── live terminal ── */}
      {(lines.length > 0 || running) && <Terminal lines={lines} running={running} />}

      {/* ── structured results ── */}
      {runResult && <ResultsPanel result={runResult} />}
    </div>
  );
}

// ── Terminal component ────────────────────────────────────────────────────────

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
        <div key={i} className={`terminal-line ${lineClass(line)}`}>
          {line || ' '}
        </div>
      ))}
      {running && <span className="terminal-cursor" />}
    </div>
  );
}

function lineClass(line) {
  if (/✓|passed|PASS/i.test(line))   return 'ok';
  if (/✗|×|failed|FAIL|Error/i.test(line)) return 'err';
  if (/warning/i.test(line))          return 'warn';
  return '';
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseSummary(results) {
  if (!results?.stats) return { passed: 0, failed: 0, skipped: 0 };
  const { expected = 0, unexpected = 0, skipped = 0 } = results.stats;
  return { passed: expected, failed: unexpected, skipped };
}

function saveHistory(selectedPaths, data) {
  const entry = {
    id:       Date.now(),
    time:     new Date().toISOString(),
    files:    selectedPaths,
    duration: data.duration,
    success:  data.success,
    summary:  parseSummary(data.results),
    results:  data.results,
  };
  const history = JSON.parse(localStorage.getItem('pw_history') ?? '[]');
  history.unshift(entry);
  localStorage.setItem('pw_history', JSON.stringify(history.slice(0, 50)));
}
