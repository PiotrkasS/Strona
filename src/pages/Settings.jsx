import { useState, useEffect } from 'react';

const DEFAULT_ENVS = [
  { name: 'Lokalny', url: 'http://localhost' },
];

export default function Settings() {
  const [envs, setEnvs]           = useState([]);
  const [newName, setNewName]      = useState('');
  const [newUrl, setNewUrl]        = useState('');
  const [slackUrl, setSlackUrl]    = useState('');
  const [saved, setSaved]          = useState('');

  useEffect(() => {
    setEnvs(JSON.parse(localStorage.getItem('pw_envs') ?? JSON.stringify(DEFAULT_ENVS)));
    setSlackUrl(localStorage.getItem('pw_slack') ?? '');
  }, []);

  const saveEnvs = (next) => {
    setEnvs(next);
    localStorage.setItem('pw_envs', JSON.stringify(next));
    flash('Zapisano środowiska');
  };

  const addEnv = () => {
    if (!newName || !newUrl) return;
    saveEnvs([...envs, { name: newName.trim(), url: newUrl.trim() }]);
    setNewName(''); setNewUrl('');
  };

  const removeEnv = (i) => saveEnvs(envs.filter((_, j) => j !== i));

  const saveSlack = () => {
    localStorage.setItem('pw_slack', slackUrl);
    flash('Zapisano webhook');
  };

  const flash = (msg) => { setSaved(msg); setTimeout(() => setSaved(''), 2000); };

  const testSlack = async () => {
    if (!slackUrl) return;
    try {
      await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '✅ Panel Test Runner — połączenie testowe działa!' }),
      });
      flash('Wiadomość testowa wysłana!');
    } catch { flash('Błąd wysyłania'); }
  };

  return (
    <div>
      <h1 className="page-title">Ustawienia</h1>
      <p className="page-sub">Środowiska, powiadomienia i konfiguracja</p>

      {saved && <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ {saved}</div>}

      {/* ── Środowiska ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>🌍 Środowiska testowe</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          Szybki przełącznik BASE_URL w panelu "Uruchom testy".
        </p>

        {envs.map((env, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ minWidth: 120, fontWeight: 600, fontSize: 13 }}>{env.name}</span>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>{env.url}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => removeEnv(i)}>✕</button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input className="form-input" placeholder="Nazwa (np. Staging)"
            value={newName} onChange={e => setNewName(e.target.value)}
            style={{ width: 160 }} />
          <input className="form-input" placeholder="URL (np. https://staging.example.com)"
            value={newUrl} onChange={e => setNewUrl(e.target.value)}
            style={{ flex: 1 }} />
          <button className="btn btn-primary btn-sm" onClick={addEnv}
            disabled={!newName || !newUrl}>+ Dodaj</button>
        </div>
      </div>

      {/* ── Powiadomienia Slack ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>🔔 Powiadomienia Slack</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          Webhook URL — dostaniesz wiadomość gdy testy się nie powiodą.
          Utwórz na: <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer"
            style={{ color: 'var(--primary)' }}>api.slack.com/apps</a>
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" placeholder="https://hooks.slack.com/services/..."
            value={slackUrl} onChange={e => setSlackUrl(e.target.value)}
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }} />
          <button className="btn btn-ghost btn-sm" onClick={testSlack} disabled={!slackUrl}>
            Testuj
          </button>
          <button className="btn btn-primary btn-sm" onClick={saveSlack}>Zapisz</button>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>ℹ️ Informacje</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
          <div>Aplikacja: <strong style={{ color: 'var(--text)' }}>Panel Test Runner</strong></div>
          <div>Stack: <strong style={{ color: 'var(--text)' }}>Playwright · PHP · React</strong></div>
          <div>noVNC: <a href="http://localhost:7900" target="_blank" rel="noreferrer"
            style={{ color: 'var(--primary)' }}>localhost:7900</a></div>
        </div>
      </div>
    </div>
  );
}
