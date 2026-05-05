import { useEffect, useState } from 'react';
import ResultsPanel from './ResultsPanel.jsx';

export default function Results() {
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const h = JSON.parse(localStorage.getItem('pw_history') ?? '[]');
    setHistory(h);
    if (h.length > 0) setSelected(h[0].id);
  }, []);

  const clearHistory = () => {
    if (!window.confirm('Usunąć całą historię wyników?')) return;
    localStorage.removeItem('pw_history');
    setHistory([]);
    setSelected(null);
  };

  const selectedEntry = history.find(h => h.id === selected) ?? null;

  if (history.length === 0) {
    return (
      <div>
        <h1 className="page-title">Historia wyników</h1>
        <p className="page-sub">Poprzednie uruchomienia testów</p>
        <div className="empty">
          <div className="icon">📋</div>
          <h3>Brak historii</h3>
          <p>Uruchom testy, aby zobaczyć wyniki tutaj.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Historia wyników</h1>
        <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={clearHistory}>
          🗑 Wyczyść historię
        </button>
      </div>
      <p className="page-sub">Poprzednie uruchomienia testów ({history.length})</p>

      {history.map(entry => {
        const s = entry.summary ?? {};
        return (
          <div
            key={entry.id}
            className={`history-item${selected === entry.id ? ' selected' : ''}`}
            onClick={() => setSelected(entry.id)}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {new Date(entry.time).toLocaleString('pl-PL')}
              </div>
              <div style={{ fontSize: 13, marginTop: 2 }}>
                {entry.files?.join(', ') ?? '—'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{(entry.duration / 1000).toFixed(1)}s</span>
              <span className={`result-badge ${entry.success ? 'passed' : 'failed'}`}>
                {entry.success ? '✔ OK' : '✖ Błąd'}
              </span>
              {s.passed != null && <span className="result-badge passed">{s.passed} ✔</span>}
              {s.failed > 0      && <span className="result-badge failed">{s.failed} ✖</span>}
            </div>
          </div>
        );
      })}

      {selectedEntry && (
        <div style={{ marginTop: 8 }}>
          <ResultsPanel result={{
            success:   selectedEntry.success,
            duration:  selectedEntry.duration,
            results:   selectedEntry.results,
            rawOutput: selectedEntry.raw,
          }} />
        </div>
      )}
    </div>
  );
}
