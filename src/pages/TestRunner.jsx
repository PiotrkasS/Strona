import { useEffect, useState, useCallback } from 'react';
import ResultsPanel from './ResultsPanel.jsx';

export default function TestRunner() {
  const [files, setFiles]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [selected, setSelected]     = useState({});   // path -> bool
  const [expanded, setExpanded]     = useState({});   // path -> bool
  const [running, setRunning]       = useState(false);
  const [runResult, setRunResult]   = useState(null);
  const [runError, setRunError]     = useState(null);

  // Load test file list
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

  const toggleFile = useCallback((path) => {
    setSelected(prev => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const toggleExpand = useCallback((path) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const selectAll = () => {
    const sel = {};
    files.forEach(f => { sel[f.path] = true; });
    setSelected(sel);
  };

  const deselectAll = () => {
    const sel = {};
    files.forEach(f => { sel[f.path] = false; });
    setSelected(sel);
  };

  const selectedPaths = files.filter(f => selected[f.path]).map(f => f.path);

  const runTests = async () => {
    if (selectedPaths.length === 0) return;
    setRunning(true);
    setRunResult(null);
    setRunError(null);

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: selectedPaths }),
      });
      const data = await res.json();
      setRunResult(data);

      // Save to history
      const summary = parseSummary(data.results);
      const entry = {
        id:       Date.now(),
        time:     new Date().toISOString(),
        files:    selectedPaths,
        duration: data.duration,
        success:  data.success,
        summary,
        results:  data.results,
        raw:      data.rawOutput,
      };
      const history = JSON.parse(localStorage.getItem('pw_history') ?? '[]');
      history.unshift(entry);
      localStorage.setItem('pw_history', JSON.stringify(history.slice(0, 50)));
    } catch (e) {
      setRunError(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="empty"><div className="icon">⏳</div><h3>Ładowanie testów…</h3></div>;
  if (fetchError) return <div className="alert alert-error">⚠ Błąd ładowania: {fetchError}</div>;

  return (
    <div>
      <h1 className="page-title">Uruchom testy</h1>
      <p className="page-sub">Wybierz testy do uruchomienia i kliknij "Uruchom"</p>

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
              <span className="file-chevron" style={{ transform: expanded[file.path] ? 'rotate(90deg)' : 'none' }}>▶</span>
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
                    <label>
                      <span>🧪</span> {name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      {runError && <div className="alert alert-error">⚠ Błąd: {runError}</div>}

      {runResult && <ResultsPanel result={runResult} />}
    </div>
  );
}

function parseSummary(results) {
  if (!results?.stats) return { passed: 0, failed: 0, skipped: 0 };
  const { expected = 0, unexpected = 0, skipped = 0 } = results.stats;
  return { passed: expected, failed: unexpected, skipped };
}
