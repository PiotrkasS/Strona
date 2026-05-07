import { useEffect, useState } from 'react';
import { downloadReport, printReport } from '../utils/reportGenerator.js';
import ResultsPanel from './ResultsPanel.jsx';

export default function TestCases() {
  const [history, setHistory]   = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const h = JSON.parse(localStorage.getItem('pw_history') ?? '[]');
    setHistory(h);
  }, []);

  const groups = buildGroups(history);

  const toggle = (label) => setExpanded(v => v === label ? null : label);

  if (groups.length === 0) {
    return (
      <div>
        <h1 className="page-title">Test Cases</h1>
        <p className="page-sub">Uruchomienia pogrupowane według etykiet</p>
        <div className="empty">
          <div className="icon">🏷</div>
          <h3>Brak przypisanych Test Case</h3>
          <p>W <strong>Historii wyników</strong> kliknij 🏷 przy uruchomieniu i przypisz etykietę (np. TC-001).</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Test Cases</h1>
      <p className="page-sub">Uruchomienia pogrupowane według etykiet ({groups.length})</p>

      {groups.map(({ label, entries }) => {
        const totalP = entries.reduce((s, e) => s + (e.summary?.passed  ?? 0), 0);
        const totalF = entries.reduce((s, e) => s + (e.summary?.failed  ?? 0), 0);
        const totalS = entries.reduce((s, e) => s + (e.summary?.skipped ?? 0), 0);
        const totalT = totalP + totalF + totalS;
        const passRate = totalT > 0 ? Math.round((totalP / totalT) * 100) : 0;
        const anyFail  = totalF > 0;
        const isOpen   = expanded === label;

        return (
          <div key={label} className="tc-group">
            {/* ── nagłówek grupy ── */}
            <div className="tc-group-header" onClick={() => toggle(label)}>
              <span className="tc-group-chevron">{isOpen ? '▼' : '▶'}</span>
              <span className="tc-group-label">🏷 {label}</span>
              <div className="tc-group-chips">
                <span className="result-badge passed">{totalP} ✔</span>
                {totalF > 0 && <span className="result-badge failed">{totalF} ✖</span>}
                {totalS > 0 && <span className="result-badge skipped">{totalS} ⏭</span>}
                <span className={`result-badge ${anyFail ? 'failed' : 'passed'}`}>
                  {passRate}%
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>
                  {entries.length} run{entries.length > 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost btn-xs"
                  title="Drukuj raport PDF"
                  onClick={() => printReport(entries, `Test Case: ${label}`)}>
                  🖨
                </button>
                <button className="btn btn-ghost btn-xs"
                  title="Pobierz raport HTML"
                  onClick={() => downloadReport(entries, `tc-${slugify(label)}.html`, `Test Case: ${label}`)}>
                  ⬇
                </button>
              </div>
            </div>

            {/* ── lista uruchomień ── */}
            {isOpen && (
              <div className="tc-group-body">
                {entries.map((entry, idx) => {
                  const s = entry.summary ?? {};
                  return (
                    <div key={entry.id} className="tc-run-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Run #{idx + 1}</span>
                        <span className={`result-badge ${entry.success ? 'passed' : 'failed'}`}>
                          {entry.success ? '✔ OK' : '✖ Błąd'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {new Date(entry.time).toLocaleString('pl-PL')}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                          {(entry.duration / 1000).toFixed(1)}s
                        </span>
                        {s.passed != null && <span className="result-badge passed">{s.passed} ✔</span>}
                        {s.failed > 0      && <span className="result-badge failed">{s.failed} ✖</span>}
                        <button className="btn btn-ghost btn-xs"
                          title="Pobierz HTML"
                          onClick={() => downloadReport([entry], undefined, `Test Case: ${label} — Run #${idx + 1}`)}>
                          ⬇
                        </button>
                      </div>
                      {entry.files?.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                          📁 {entry.files.join(', ')}
                        </div>
                      )}
                      <ResultsPanel result={{ success: entry.success, duration: entry.duration, results: entry.results }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function buildGroups(history) {
  const map = new Map();
  for (const entry of history) {
    if (!entry.testCase) continue;
    if (!map.has(entry.testCase)) map.set(entry.testCase, []);
    map.get(entry.testCase).push(entry);
  }
  return [...map.entries()].map(([label, entries]) => ({ label, entries }));
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
