import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CreateTest() {
  const [url, setUrl]                   = useState('');
  const [filename, setFilename]         = useState('');
  const [recording, setRecording]       = useState(false);
  const [lines, setLines]               = useState([]);
  const [result, setResult]             = useState(null);
  const [error, setError]               = useState(null);
  const [liveCode, setLiveCode]         = useState('');
  const [liveLines, setLiveLines]       = useState(0);
  const [fileContent, setFileContent]   = useState(null);
  const [showCode, setShowCode]         = useState(false);
  const navigate                        = useNavigate();
  const termRef                         = useRef(null);
  const pollRef                         = useRef(null);
  const recordingPathRef                = useRef('');

  const autoScroll = () => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  };

  // Poll the output file for live code preview during recording
  useEffect(() => {
    if (recording && recordingPathRef.current) {
      pollRef.current = setInterval(() => {
        fetch('/api/file-content?path=' + encodeURIComponent(recordingPathRef.current))
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d?.content) {
              setLiveCode(d.content);
              setLiveLines(d.content.split('\n').length);
            }
          })
          .catch(() => {});
      }, 2000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [recording]);

  const startRecording = async () => {
    if (!url || !filename) return;
    const safeName = filename.replace(/[^a-z0-9\-_]/gi, '-').replace(/^-+|-+$/g, '') || 'nowy-test';
    recordingPathRef.current = 'panel/' + safeName + (safeName.endsWith('.spec.ts') ? '' : '.spec.ts');
    // Auto-open noVNC after short delay (browser needs a moment to start)
    setTimeout(() => window.open('http://localhost:7900/vnc_auto.html', '_blank'), 2500);

    setRecording(true);
    setLines([]);
    setLiveCode('');
    setLiveLines(0);
    setResult(null);
    setError(null);
    setFileContent(null);
    setShowCode(false);

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

          if (evType === 'done') {
            setResult(parsed);
            if (parsed.success && parsed.path) {
              fetch('/api/file-content?path=' + encodeURIComponent(parsed.path))
                .then(r => r.json())
                .then(d => { if (d.content) { setFileContent(d.content); setLiveCode(d.content); setShowCode(true); } })
                .catch(() => {});
            }
          } else if (evType === 'error') {
            setError(parsed.message ?? 'Błąd nagrywania');
          } else {
            setLines(p => [...p, parsed]); autoScroll();
          }
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRecording(false);
    }
  };

  const safeName = filename.replace(/[^a-z0-9\-_]/gi, '-').replace(/^-+|-+$/g, '') || '';
  const isActive = recording || !!result;

  return (
    <div>
      <h1 className="page-title">Nagraj nowy test</h1>
      <p className="page-sub">Playwright otworzy przeglądarkę, nagra Twoje kliknięcia i zapisze je jako plik .spec.ts</p>

      {/* ── form card ── */}
      <div className="card">
        <div className="form-group">
          <label className="form-label">Adres URL strony do testowania</label>
          <input type="url" className="form-input" placeholder="https://twoj-panel.pl/login"
            value={url} onChange={e => setUrl(e.target.value)} disabled={recording} />
        </div>

        <div className="form-group">
          <label className="form-label">Nazwa pliku testu</label>
          <div className="form-row">
            <span className="form-addon">tests/panel/</span>
            <input type="text" className="form-input" placeholder="np. checkout-flow"
              value={filename} onChange={e => setFilename(e.target.value)} disabled={recording} />
            <span className="form-addon">.spec.ts</span>
          </div>
          {safeName && <div className="form-hint">Zostanie utworzony: <code>tests/panel/{safeName}.spec.ts</code></div>}
        </div>

        <div style={{ marginTop: 20 }}>
          <button className={`btn btn-primary btn-lg ${recording ? 'btn-recording' : ''}`}
            onClick={startRecording} disabled={recording || !url || !filename}>
            {recording
              ? <><div className="spinner" /> Nagrywanie — zamknij przeglądarkę gdy skończysz</>
              : '🎬 Uruchom nagrywanie'}
          </button>
        </div>
      </div>

      {/* ── how it works (hidden while recording) ── */}
      {!isActive && (
        <div className="card how-card">
          <div className="section-title">📖 Jak to działa?</div>
          <div className="how-steps">
            {[
              ['1', 'Wpisz URL strony którą chcesz testować'],
              ['2', 'Nadaj nazwę plikowi testu'],
              ['3', 'Kliknij "Uruchom nagrywanie" — otworzy się przeglądarka Chromium'],
              ['4', 'Klikaj po stronie — otworzy się też okno Playwright Inspector z kodem'],
              ['5', 'Zamknij przeglądarkę gdy skończysz'],
              ['6', 'Plik .spec.ts zostaje zapisany automatycznie'],
              ['7', 'Test pojawi się w zakładce "Uruchom testy"'],
            ].map(([n, txt]) => (
              <div key={n} className="how-step">
                <span className="how-num">{n}</span>
                <span>{txt}</span>
              </div>
            ))}
          </div>
          <div className="alert alert-info" style={{ marginTop: 16 }}>
            💡 Podgląd przeglądarki na żywo:{' '}
            <a href="http://localhost:7900/vnc_auto.html" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
              localhost:7900/vnc_auto.html
            </a>
            {' '}(Docker). Zobaczysz tam zarówno przeglądarkę jak i Playwright Inspector z generowanym kodem.
          </div>
        </div>
      )}

      {/* ── two-panel: terminal + live code ── */}
      {isActive && (
        <div className="record-split">

          {/* LEFT — status + terminal */}
          <div className="record-split-left">
            {recording && (
              <div className="alert alert-info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ fontWeight: 600 }}>🖥️ Przeglądarka otwarta w kontenerze Docker</div>
                <div style={{ fontSize: 12 }}>Klikaj po stronie w podglądzie noVNC:</div>
                <a href="http://localhost:7900/vnc_auto.html" target="_blank" rel="noreferrer"
                   className="btn btn-primary btn-sm">🔗 Otwórz noVNC — localhost:7900</a>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Zamknij przeglądarkę w noVNC gdy skończysz.</div>
              </div>
            )}

            {result?.success && (
              <div className="alert alert-success">
                ✅ Plik <strong>tests/panel/{result.filename}</strong> zapisany!
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                  onClick={() => navigate('/tests')}>→ Przejdź do testów</button>
              </div>
            )}
            {result && !result.success && (
              <div className="alert alert-error">❌ Nagrywanie nie powiodło się lub plik nie został zapisany.</div>
            )}
            {error && <div className="alert alert-error">⚠ {error}</div>}

            {(lines.length > 0 || recording) && (
              <div className="terminal" ref={termRef} style={{ marginTop: 8 }}>
                {lines.map((l, i) => <div key={i} className="terminal-line">{l || ' '}</div>)}
                {recording && <span className="terminal-cursor" />}
              </div>
            )}
          </div>

          {/* RIGHT — noVNC during recording, code after */}
          <div className="record-split-right" style={{ minHeight: 520 }}>
            {recording ? (
              <>
                <div className="record-code-header">
                  <span>🖥️ Podgląd na żywo — klikaj tutaj!</span>
                  <a href="http://localhost:7900/vnc_auto.html" target="_blank" rel="noreferrer"
                     style={{ color: 'var(--primary)', fontSize: 11 }}>↗ pełny ekran</a>
                </div>
                <iframe
                  src="http://localhost:7900/vnc_auto.html"
                  style={{ width: '100%', height: 460, border: 'none', display: 'block' }}
                  title="noVNC – podgląd przeglądarki"
                />
                <div style={{ padding: '8px 14px', background: 'var(--bg3)', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>
                  💡 <strong style={{ color: 'var(--text)' }}>Gdzie kod?</strong>{' '}
                  W dolnym pasku przeglądarki (zakładka <strong style={{ color: 'var(--primary)' }}>Log</strong>) — widać każde kliknięcie na żywo.
                  Prawa strona ekranu to Playwright Codegen z pełnym kodem.
                </div>
              </>
            ) : (
              <>
                <div className="record-code-header">
                  <span>📄 Wygenerowany kod testu</span>
                  {liveLines > 0 && <span>{liveLines} linii</span>}
                </div>
                {liveCode ? (
                  <pre>{liveCode}</pre>
                ) : (
                  <div className="record-code-empty">
                    <div style={{ fontSize: 28, marginBottom: 10 }}>✍️</div>
                    <div>Kod pojawi się tu po zakończeniu nagrywania</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
