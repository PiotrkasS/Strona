import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ResultsPanel from './ResultsPanel.jsx';

export default function Results() {
  const [history, setHistory]   = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const h = JSON.parse(localStorage.getItem('pw_history') ?? '[]');
    setHistory(h);
    if (h.length > 0) setSelected(h[0].id);
  }, []);

  const clearHistory = () => {
    if (!window.confirm('Usunąć całą historię wyników?')) return;
    localStorage.removeItem('pw_history');
    setHistory([]); setSelected(null);
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

  // Chart data — last 15 runs, oldest first
  const chartData = [...history].reverse().slice(-15).map((e, i) => ({
    name: `#${i + 1}`,
    passed:  e.summary?.passed  ?? 0,
    failed:  e.summary?.failed  ?? 0,
    time:    parseFloat((e.duration / 1000).toFixed(1)),
    success: e.success,
  }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Historia wyników</h1>
        <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={clearHistory}>
          🗑 Wyczyść historię
        </button>
      </div>
      <p className="page-sub">Poprzednie uruchomienia ({history.length})</p>

      {/* ── Wykresy ── */}
      {history.length > 1 && (
        <div className="chart-grid">
          <div className="chart-card">
            <div className="chart-title">Testy: zdane / błędy</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
                  labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="passed" name="Zdane" fill="#22c55e" radius={[3,3,0,0]} />
                <Bar dataKey="failed" name="Błędy" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <div className="chart-title">Czas wykonania (s)</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
                  labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="time" name="Czas (s)" radius={[3,3,0,0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.success ? '#3b82f6' : '#f59e0b'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Lista ── */}
      {history.map(entry => {
        const s = entry.summary ?? {};
        return (
          <div key={entry.id}
            className={`history-item${selected === entry.id ? ' selected' : ''}`}
            onClick={() => setSelected(entry.id)}>
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
          <ResultsPanel result={{ success: selectedEntry.success, duration: selectedEntry.duration, results: selectedEntry.results }} />
        </div>
      )}
    </div>
  );
}
