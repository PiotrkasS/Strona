import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ResultsPanel from './ResultsPanel.jsx';
import { downloadReport, printReport } from '../utils/reportGenerator.js';

export default function Results() {
  const [history, setHistory]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked]   = useState(new Set());
  const [tcModal, setTcModal]   = useState(null);  // entry id
  const [tcInput, setTcInput]   = useState('');

  useEffect(() => {
    const h = JSON.parse(localStorage.getItem('pw_history') ?? '[]');
    setHistory(h);
    if (h.length > 0) setSelected(h[0].id);
  }, []);

  const saveHistory = (next) => {
    localStorage.setItem('pw_history', JSON.stringify(next));
    setHistory(next);
  };

  const clearHistory = () => {
    if (!window.confirm('Usunąć całą historię wyników?')) return;
    localStorage.removeItem('pw_history');
    setHistory([]); setSelected(null); setChecked(new Set());
  };

  const toggleCheck = useCallback((id, e) => {
    e.stopPropagation();
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const checkAll   = () => setChecked(new Set(history.map(h => h.id)));
  const uncheckAll = () => setChecked(new Set());

  const checkedEntries = history.filter(h => checked.has(h.id));

  const openTcModal = (id, e) => {
    e.stopPropagation();
    const entry = history.find(h => h.id === id);
    setTcInput(entry?.testCase ?? '');
    setTcModal(id);
  };

  const saveTc = () => {
    const next = history.map(h =>
      h.id === tcModal ? { ...h, testCase: tcInput.trim() || undefined } : h
    );
    saveHistory(next);
    setTcModal(null);
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

  const chartData = [...history].reverse().slice(-15).map((e, i) => ({
    name:    `#${i + 1}`,
    passed:  e.summary?.passed  ?? 0,
    failed:  e.summary?.failed  ?? 0,
    time:    parseFloat((e.duration / 1000).toFixed(1)),
    success: e.success,
  }));

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Historia wyników</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={clearHistory}>🗑 Wyczyść</button>
        </div>
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

      {/* ── Toolbar multi-select ── */}
      <div className="select-toolbar">
        <label className="check-label">
          <input type="checkbox"
            checked={checked.size === history.length && history.length > 0}
            onChange={e => e.target.checked ? checkAll() : uncheckAll()} />
          <span>{checked.size > 0 ? `${checked.size} zaznaczonych` : 'Zaznacz wszystkie'}</span>
        </label>
        {checked.size > 0 && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn-ghost btn-sm"
              onClick={() => printReport(checkedEntries, `Raport testów — ${new Date().toLocaleDateString('pl-PL')}`)}>
              🖨 Drukuj / PDF
            </button>
            <button className="btn btn-primary btn-sm"
              onClick={() => downloadReport(checkedEntries, undefined, `Raport testów — ${new Date().toLocaleDateString('pl-PL')}`)}>
              ⬇ Pobierz HTML
            </button>
          </div>
        )}
      </div>

      {/* ── Lista ── */}
      {history.map(entry => {
        const s = entry.summary ?? {};
        return (
          <div key={entry.id}
            className={`history-item${selected === entry.id ? ' selected' : ''}`}
            onClick={() => setSelected(entry.id)}>

            <input type="checkbox" className="history-check"
              checked={checked.has(entry.id)}
              onChange={e => toggleCheck(entry.id, e)}
              onClick={e => e.stopPropagation()} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {new Date(entry.time).toLocaleString('pl-PL')}
              </div>
              <div style={{ fontSize: 13, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.files?.join(', ') ?? '—'}
              </div>
              {entry.testCase && (
                <div style={{ marginTop: 3 }}>
                  <span className="tc-pill">🏷 {entry.testCase}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{(entry.duration / 1000).toFixed(1)}s</span>
              <span className={`result-badge ${entry.success ? 'passed' : 'failed'}`}>
                {entry.success ? '✔ OK' : '✖ Błąd'}
              </span>
              {s.passed != null && <span className="result-badge passed">{s.passed} ✔</span>}
              {s.failed > 0      && <span className="result-badge failed">{s.failed} ✖</span>}
              <button className="btn btn-ghost btn-xs" title="Przypisz do Test Case"
                onClick={e => openTcModal(entry.id, e)}>
                🏷
              </button>
              <button className="btn btn-ghost btn-xs" title="Eksportuj ten wynik"
                onClick={e => { e.stopPropagation(); downloadReport([entry]); }}>
                ⬇
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Szczegóły zaznaczonego ── */}
      {selectedEntry && (
        <div style={{ marginTop: 8 }}>
          <ResultsPanel result={{ success: selectedEntry.success, duration: selectedEntry.duration, results: selectedEntry.results }} />
        </div>
      )}

      {/* ── Modal przypisania Test Case ── */}
      {tcModal && (
        <div className="modal-overlay" onClick={() => setTcModal(null)}>
          <div className="tc-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>🏷 Przypisz do Test Case</div>
            <input className="form-input" autoFocus
              placeholder="np. TC-001 Login, Checkout flow…"
              value={tcInput}
              onChange={e => setTcInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTc(); if (e.key === 'Escape') setTcModal(null); }} />
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '6px 0 14px' }}>
              Zostaw puste, aby usunąć przypisanie.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setTcModal(null)}>Anuluj</button>
              <button className="btn btn-primary btn-sm" onClick={saveTc}>Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
