import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CreateTest() {
  const [url, setUrl]           = useState('');
  const [filename, setFilename] = useState('');
  const [recording, setRecording] = useState(false);
  const [lines, setLines]       = useState([]);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const navigate                = useNavigate();
  const termRef                 = useRef(null);

  const autoScroll = () => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  };

  const startRecording = async () => {
    if (!url || !filename) return;
    setRecording(true);
    setLines([]);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/codegen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, filename }),
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

          if (evType === 'done')       setResult(parsed);
          else if (evType === 'error') setError(parsed.message ?? 'Błąd nagrywania');
          else { setLines(p => [...p, parsed]); autoScroll(); }
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRecording(false);
    }
  };

  const safeName = filename.replace(/[^a-z0-9\-_]/gi, '-').replace(/^-+|-+$/g, '') || '';

  return (
    <div>
      <h1 className="page-title">Nagraj nowy test</h1>
      <p className="page-sub">Playwright otworzy przeglądarkę, nagra Twoje kliknięcia i zapisze je jako plik .spec.ts</p>

      <div className="card">
        {/* URL */}
        <div className="form-group">
          <label className="form-label">Adres URL strony do testowania</label>
          <input
            type="url"
            className="form-input"
            placeholder="https://twoj-panel.pl/login"
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={recording}
          />
        </div>

        {/* filename */}
        <div className="form-group">
          <label className="form-label">Nazwa pliku testu</label>
          <div className="form-row">
            <span className="form-addon">tests/panel/</span>
            <input
              type="text"
              className="form-input"
              placeholder="np. checkout-flow"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              disabled={recording}
            />
            <span className="form-addon">.spec.ts</span>
          </div>
          {safeName && (
            <div className="form-hint">
              Zostanie utworzony: <code>tests/panel/{safeName}.spec.ts</code>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <button
            className={`btn btn-primary btn-lg ${recording ? 'btn-recording' : ''}`}
            onClick={startRecording}
            disabled={recording || !url || !filename}
          >
            {recording
              ? <><div className="spinner" /> Nagrywanie — zamknij przeglądarkę gdy skończysz</>
              : '🎬 Uruchom nagrywanie'}
          </button>
        </div>
      </div>

      {/* how it works */}
      {!recording && !result && (
        <div className="card how-card">
          <div className="section-title">📖 Jak to działa?</div>
          <div className="how-steps">
            {[
              ['1', 'Wpisz URL strony którą chcesz testować'],
              ['2', 'Nadaj nazwę plikowi wynikowego testu'],
              ['3', 'Kliknij "Uruchom nagrywanie" — otworzy się przeglądarka Chromium'],
              ['4', 'Klikaj po stronie jak normalny użytkownik (logowanie, formularze, przyciski…)'],
              ['5', 'Zamknij przeglądarkę gdy skończysz nagrywanie'],
              ['6', 'Playwright zapisze wszystkie akcje jako gotowy plik .spec.ts'],
              ['7', 'Test pojawi się automatycznie w zakładce "Uruchom testy"'],
            ].map(([n, txt]) => (
              <div key={n} className="how-step">
                <span className="how-num">{n}</span>
                <span>{txt}</span>
              </div>
            ))}
          </div>
          <div className="alert alert-info" style={{ marginTop: 16 }}>
            💡 Podczas nagrywania możesz śledzić przeglądarkę na żywo pod adresem{' '}
            <a href="http://localhost:7900" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
              http://localhost:7900
            </a>
            {' '}(tylko gdy używasz Docker).
          </div>
        </div>
      )}

      {/* live terminal */}
      {(lines.length > 0 || recording) && (
        <div className="terminal" ref={termRef} style={{ marginTop: 16 }}>
          {lines.map((l, i) => <div key={i} className="terminal-line">{l || ' '}</div>)}
          {recording && <span className="terminal-cursor" />}
        </div>
      )}

      {/* result */}
      {result?.success && (
        <div className="alert alert-success" style={{ marginTop: 16 }}>
          ✅ Plik <strong>tests/panel/{result.filename}</strong> został nagrany!
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 16 }}
            onClick={() => navigate('/tests')}
          >
            → Przejdź do testów
          </button>
        </div>
      )}
      {result && !result.success && (
        <div className="alert alert-error" style={{ marginTop: 16 }}>
          ❌ Nagrywanie nie powiodło się lub plik nie został zapisany.
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginTop: 16 }}>⚠ {error}</div>
      )}
    </div>
  );
}
