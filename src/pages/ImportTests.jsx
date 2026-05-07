import { useState, useCallback, useRef, useEffect } from 'react';
import MonacoEditor from '@monaco-editor/react';

const VALID_EXTS = ['.spec.ts', '.spec.js', '.test.ts', '.test.js', '.zip'];
const MAX_SIZE   = 2 * 1024 * 1024; // 2 MB

export default function ImportTests() {
  const [items, setItems]           = useState([]);         // pliki do importu
  const [folders, setFolders]       = useState([]);         // istniejące foldery
  const [defaultFolder, setDefaultFolder] = useState('');
  const [dragging, setDragging]     = useState(false);
  const [importing, setImporting]   = useState(false);
  const [results, setResults]       = useState(null);
  const [preview, setPreview]       = useState(null);       // { name, content }
  const [overwrite, setOverwrite]   = useState(false);
  const inputRef = useRef(null);

  // Pobierz istniejące foldery z /api/tests
  useEffect(() => {
    fetch('/api/tests')
      .then(r => r.json())
      .then(d => {
        const dirs = [...new Set(
          (d.files ?? [])
            .map(f => f.path.includes('/') ? f.path.split('/')[0] : '')
            .filter(Boolean)
        )].sort();
        setFolders(dirs);
        if (dirs.length) setDefaultFolder(dirs[0]);
      })
      .catch(() => {});
  }, []);

  // ── Parsowanie pliku po stronie klienta ─────────────────────────────────────
  const parseFile = useCallback(async (file) => {
    const id   = Math.random().toString(36).slice(2);
    const name = file.name;
    const size = file.size;

    if (!VALID_EXTS.some(ext => name.toLowerCase().endsWith(ext))) {
      return { id, file, name, size, valid: false, error: 'Nieobsługiwany format', tests: 0, folder: defaultFolder };
    }
    if (size > MAX_SIZE) {
      return { id, file, name, size, valid: false, error: 'Plik za duży (max 2 MB)', tests: 0, folder: defaultFolder };
    }
    if (name.toLowerCase().endsWith('.zip')) {
      return { id, file, name, size, valid: true, isZip: true, tests: '?', folder: defaultFolder };
    }

    const content   = await file.text();
    const hasImport = content.includes('@playwright/test');
    const hasTest   = /\b(test|it|describe)\s*\(/.test(content);
    const valid     = hasImport || hasTest;
    const tests     = (content.match(/\b(test|it)\s*\(\s*['"` ]/g) ?? []).length;

    return { id, file, name, size, content, valid, isZip: false,
      error: valid ? null : 'Brak wzorców Playwright (import z @playwright/test lub test()/describe())',
      tests, folder: defaultFolder };
  }, [defaultFolder]);

  const addFiles = useCallback(async (fileList) => {
    const parsed = await Promise.all([...fileList].map(parseFile));
    setItems(prev => {
      const existingNames = new Set(prev.map(p => p.name));
      return [...prev, ...parsed.filter(p => !existingNames.has(p.name))];
    });
  }, [parseFile]);

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  const onDrop      = useCallback(e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }, [addFiles]);
  const onDragOver  = e => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const removeItem   = id => setItems(prev => prev.filter(i => i.id !== id));
  const setItemFolder = (id, folder) => setItems(prev => prev.map(i => i.id === id ? { ...i, folder } : i));
  const clearAll     = () => { setItems([]); setResults(null); };

  // ── Import ───────────────────────────────────────────────────────────────────
  const importAll = async () => {
    const valid = items.filter(i => i.valid);
    if (!valid.length) return;
    setImporting(true);
    setResults(null);

    const fd = new FormData();
    valid.forEach(item => {
      fd.append('files[]', item.file, item.name);
      fd.append('folders[]', item.folder);
    });
    fd.append('overwrite', overwrite ? 'true' : 'false');

    try {
      const res  = await fetch('/api/upload-tests', { method: 'POST', body: fd });
      const data = await res.json();
      const res2 = data.results ?? [];
      setResults(res2);
      const okNames = new Set(res2.filter(r => r.ok).map(r => r.name));
      setItems(prev => prev.filter(i => !okNames.has(i.name)));
    } catch (e) {
      setResults([{ name: 'Błąd sieci', ok: false, error: e.message }]);
    } finally {
      setImporting(false);
    }
  };

  const validCount = items.filter(i => i.valid).length;

  // ── Folder input – istniejący lub nowy ──────────────────────────────────────
  function FolderInput({ value, onChange }) {
    return (
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <input
          className="form-input"
          list="folder-list"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="folder (opcjonalnie)"
          style={{ width: 160, fontSize: 12, padding: '3px 8px' }}
        />
        <datalist id="folder-list">
          {folders.map(f => <option key={f} value={f} />)}
        </datalist>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Import testów</h1>
      <p className="page-sub">Wgraj pliki .spec.ts / .spec.js od kolegi lub z innego projektu</p>

      {/* ── Strefa upuszczania ── */}
      <div
        className={`drop-zone${dragging ? ' drop-zone-active' : ''}`}
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple hidden
          accept=".spec.ts,.spec.js,.test.ts,.test.js,.zip"
          onChange={e => addFiles(e.target.files)} />
        <div className="drop-icon">📂</div>
        <div className="drop-title">Upuść pliki tutaj lub kliknij</div>
        <div className="drop-sub">
          Obsługiwane: <strong>.spec.ts</strong> · <strong>.spec.js</strong> ·{' '}
          <strong>.test.ts</strong> · <strong>.test.js</strong> · <strong>.zip</strong> (archiwum z testami)
        </div>
      </div>

      {/* ── Opcje ── */}
      {items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '12px 0 8px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)}
              style={{ accentColor: 'var(--primary)', width: 15, height: 15 }} />
            Nadpisuj istniejące pliki
          </label>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {validCount} z {items.length} gotowych do importu
          </span>
          <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ marginLeft: 'auto' }}>
            🗑 Wyczyść listę
          </button>
          <button className="btn btn-primary btn-sm" onClick={importAll}
            disabled={importing || validCount === 0}>
            {importing
              ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Importuję…</>
              : `⬆ Importuj ${validCount} ${validCount === 1 ? 'plik' : 'pliki/plików'}`}
          </button>
        </div>
      )}

      {/* ── Lista plików ── */}
      {items.map(item => (
        <div key={item.id} className={`import-item${item.valid ? '' : ' import-item-invalid'}`}>
          <div className="import-item-icon">
            {item.isZip ? '🗜' : item.name.endsWith('.ts') ? '🟦' : '🟨'}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="import-item-name">{item.name}</span>
              <span className="import-item-size">{formatSize(item.size)}</span>
              {item.valid
                ? <span className="import-badge ok">
                    ✔ {item.isZip ? 'ZIP' : `${item.tests} test${item.tests !== 1 ? 'ów' : ''}`}
                  </span>
                : <span className="import-badge fail">✖ Błąd</span>
              }
              {item.from_zip && (
                <span className="import-badge info">z {item.from_zip}</span>
              )}
            </div>
            {item.error && (
              <div className="import-error">{item.error}</div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            {/* Folder docelowy */}
            {item.valid && (
              <FolderInput value={item.folder} onChange={v => setItemFolder(item.id, v)} />
            )}

            {/* Podgląd (tylko nie-ZIP) */}
            {item.content && (
              <button className="btn btn-ghost btn-xs"
                onClick={() => setPreview({ name: item.name, content: item.content })}>
                👁 Podgląd
              </button>
            )}

            <button className="btn btn-ghost btn-xs" onClick={() => removeItem(item.id)}
              title="Usuń z listy">✕</button>
          </div>
        </div>
      ))}

      {/* ── Wyniki importu ── */}
      {results && (
        <div className="import-results">
          <div className="section-title" style={{ marginBottom: 12 }}>
            Wyniki importu
          </div>
          {results.map((r, i) => (
            <div key={i} className={`import-result-row${r.ok ? ' ok' : ' fail'}`}>
              <span>{r.ok ? '✔' : '✖'}</span>
              <span className="import-result-name">{r.name}</span>
              {r.ok
                ? <>
                    {r.path && <span className="import-result-path">→ tests/{r.path}</span>}
                    {r.tests > 0 && <span className="import-badge ok">{r.tests} testów</span>}
                    {r.from_zip && <span className="import-badge info">z {r.from_zip}</span>}
                  </>
                : <span className="import-result-error">{r.error}</span>
              }
            </div>
          ))}
          {results.some(r => r.ok) && (
            <div style={{ marginTop: 12 }}>
              <a href="/tests" className="btn btn-primary btn-sm">
                ▶ Przejdź do uruchamiania testów
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Modal podglądu ── */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">👁 Podgląd</div>
                <div className="modal-subtitle">{preview.name}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 0, overflow: 'hidden' }}>
              <MonacoEditor
                height="100%"
                defaultLanguage="typescript"
                value={preview.content}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  fontSize: 13,
                  fontFamily: '"Fira Code","Cascadia Code",Consolas,monospace',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  padding: { top: 12 },
                  automaticLayout: true,
                }}
              />
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setPreview(null)}>Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
