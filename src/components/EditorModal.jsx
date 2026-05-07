import { useEffect, useState, useRef, useCallback } from 'react';
import MonacoEditor from '@monaco-editor/react';

export default function EditorModal({ path, name, onClose, onSaved }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [fixing,  setFixing]  = useState(false);
  const [error,   setError]   = useState(null);
  const [aiNote,  setAiNote]  = useState(null);
  const saveRef               = useRef(null);

  useEffect(() => {
    fetch('/api/file-content?path=' + encodeURIComponent(path))
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setContent(d.content ?? ''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const save = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/file-content?path=' + encodeURIComponent(path), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Błąd zapisu');
      if (onSaved) onSaved();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }, [content, path, onSaved, onClose]);

  useEffect(() => { saveRef.current = save; }, [save]);

  const fixWithAi = async () => {
    setFixing(true); setError(null); setAiNote(null);
    try {
      const res = await fetch('/api/ai-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: content }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Błąd AI');
      setContent(d.code);
      setAiNote(`✨ ${d.model ?? 'AI'} poprawił kod — sprawdź i zapisz.`);
    } catch (e) { setError(e.message); }
    finally { setFixing(false); }
  };

  const handleEditorMount = (editor, monaco) => {
    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => saveRef.current?.(),
    });
  };

  const lines = content.split('\n').length;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">

        <div className="modal-header">
          <div>
            <div className="modal-title">✏️ Edytuj test</div>
            <div className="modal-subtitle">tests/{path}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{lines} linii</span>
            <span style={{ fontSize: 10, color: 'var(--muted)', opacity: .6 }}>Ctrl+S = zapisz · Esc = zamknij</span>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} /> Ładowanie…
            </div>
          ) : (
            <MonacoEditor
              height="100%"
              defaultLanguage="typescript"
              value={content}
              theme="vs-dark"
              onChange={v => setContent(v ?? '')}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 12 },
              }}
            />
          )}
        </div>

        <div className="modal-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            {error  && <span className="modal-err">⚠ {error}</span>}
            {aiNote && <span style={{ color: '#a5b4fc', fontSize: 12 }}>{aiNote}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-ghost" onClick={onClose}>Anuluj</button>
            <button className="btn btn-ghost" onClick={fixWithAi} disabled={fixing || loading || saving}>
              {fixing ? <><div className="spinner" style={{ borderTopColor: '#a78bfa' }} /> Analizuję…</> : '🤖 Napraw z AI'}
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving || loading || fixing}>
              {saving ? <><div className="spinner" /> Zapisywanie…</> : '💾 Zapisz'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
