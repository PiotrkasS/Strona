import { useEffect, useState, useRef } from 'react';

export default function EditorModal({ path, name, onClose, onSaved }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [fixing,  setFixing]  = useState(false);
  const [error,   setError]   = useState(null);
  const [saved,   setSaved]   = useState(false);
  const [aiNote,  setAiNote]  = useState(null);
  const textareaRef           = useRef(null);

  useEffect(() => {
    fetch('/api/file-content?path=' + encodeURIComponent(path))
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setContent(d.content ?? '');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  // Focus textarea after load
  useEffect(() => {
    if (!loading && textareaRef.current) textareaRef.current.focus();
  }, [loading]);

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/file-content?path=' + encodeURIComponent(path), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Błąd zapisu');
      setSaved(true);
      if (onSaved) onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fixWithAi = async () => {
    setFixing(true);
    setError(null);
    setAiNote(null);
    try {
      const res = await fetch('/api/ai-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: content }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Błąd AI');
      setContent(d.code);
      setAiNote('✨ AI poprawił kod — sprawdź i zapisz.');
      setSaved(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setFixing(false);
    }
  };

  // Tab key inserts spaces instead of switching focus
  const handleKeyDown = e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta  = e.target;
      const s   = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = content.substring(0, s) + '  ' + content.substring(end);
      setContent(newVal);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  };

  const lines = content.split('\n').length;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">

        {/* Header */}
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

        {/* Body */}
        <div className="modal-body">
          {loading && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} /> Ładowanie…
            </div>
          )}
          {!loading && (
            <textarea
              ref={textareaRef}
              className="code-editor"
              value={content}
              onChange={e => { setContent(e.target.value); setSaved(false); }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            {error  && <span className="modal-err">⚠ {error}</span>}
            {saved  && <span className="modal-ok">✅ Zapisano!</span>}
            {aiNote && !saved && <span style={{ color: '#a5b4fc', fontSize: 12 }}>{aiNote}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-ghost" onClick={onClose}>Anuluj</button>
            <button className="btn btn-ghost" onClick={fixWithAi} disabled={fixing || loading || saving}
              title="Wyślij kod do Claude AI — poprawi selektory, usunie duplikaty, doda asercje">
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
