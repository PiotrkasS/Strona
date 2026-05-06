import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [testFiles, setTestFiles] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [lastRun, setLastRun]     = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/tests')
      .then(r => r.json())
      .then(d => setTestFiles(d.files ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

    const history = JSON.parse(localStorage.getItem('pw_history') ?? '[]');
    if (history.length > 0) setLastRun(history[0]);
  }, []);

  const totalTests = testFiles.reduce((s, f) => s + f.tests.length, 0);
  const last = lastRun?.summary ?? null;

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Przegląd testów panelu</p>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-label">Pliki testów</div>
          <div className="stat-value">{loading ? '…' : testFiles.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Przypadki testowe</div>
          <div className="stat-value">{loading ? '…' : totalTests}</div>
        </div>
        {last ? (
          <>
            <div className="stat-card success">
              <div className="stat-label">Ostatnie: zaliczone</div>
              <div className="stat-value">{last.passed}</div>
            </div>
            <div className="stat-card error">
              <div className="stat-label">Ostatnie: błędy</div>
              <div className="stat-value">{last.failed}</div>
            </div>
          </>
        ) : (
          <div className="stat-card">
            <div className="stat-label">Ostatnie uruchomienie</div>
            <div className="stat-value" style={{ fontSize: 16, color: 'var(--muted)' }}>Brak</div>
          </div>
        )}
      </div>

      {testFiles.length > 0 && (
        <div className="card">
          <div className="section-title">📁 Dostępne pliki testów</div>
          {testFiles.map(f => (
            <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 13 }}>{f.path}</span>
              <span className="file-badge" style={{ marginLeft: 'auto' }}>{f.tests.length} testów</span>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => navigate('/tests')}>
              ▶ Uruchom testy
            </button>
          </div>
        </div>
      )}

      {!loading && testFiles.length === 0 && (
        <div className="empty">
          <div className="icon">🔍</div>
          <h3>Brak plików testów</h3>
          <p>Dodaj pliki <code>*.spec.ts</code> do folderu <code>tests/</code></p>
        </div>
      )}
    </div>
  );
}
