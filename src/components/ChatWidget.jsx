import React, { useState, useEffect, useRef, useCallback } from 'react';
import { calculate, fmt, getCoursesForState } from '../engine/gpaEngine';

const onlyAI = (list) =>
  Array.isArray(list)
    ? list.filter(
        (m, i) =>
          m &&
          typeof m.text === 'string' &&
          ((m.role === 'assistant' && m.source === 'gemini') ||
            (m.role === 'user' && (m.source === 'user' || list[i + 1]?.source === 'gemini')))
      )
    : [];

export function ChatWidget({
  state,
  cloudUser,
  cloudClientRef,
  accountContext,
  accountRevision,
  onOpenAccount,
  isOpen,
  onToggleOpen,
}) {
  const isVisible = state.step === 'result';
  const owner = cloudUser?.id || null;
  const scope = `${owner || 'guest'}:${state.curriculum}:${accountContext?.id || 'draft'}`;
  const sessionKey = `gradpath-chat-v1:${scope}`;
  const curriculumLabel =
    state.curriculum === 'if2024' ? 'Informatika 2024' : 'Sistem Informasi 2024';

  const [view, setView] = useState('chat'); // 'chat' | 'history'
  const [messages, setMessages] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [lastPlan, setLastPlan] = useState('');
  const [dirty, setDirty] = useState(false);
  const [consent, setConsent] = useState(false);
  const [inputText, setInputText] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [showRetry, setShowRetry] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [historyList, setHistoryList] = useState([]);

  const scrollRef = useRef(null);
  const controllerRef = useRef(null);
  const epochRef = useRef(0);
  const prevScopeRef = useRef('');

  const persistSession = useCallback(
    (nextMessages, nextThreadId, nextDirty, nextLastPlan, key = sessionKey) => {
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({
            messages: nextMessages,
            threadId: nextThreadId,
            dirty: nextDirty,
            lastPlan: nextLastPlan,
          })
        );
      } catch {
        // Ignore sessionStorage errors.
      }
    },
    [sessionKey]
  );

  // Sync scope changes and login intent
  useEffect(() => {
    if (prevScopeRef.current !== scope) {
      controllerRef.current?.abort();
      epochRef.current += 1;
      prevScopeRef.current = scope;
      setBusy(false);
      setConsent(false);
      setErrorText('');
      setShowRetry(false);
      setStatusText('');
      setView('chat');

      let loadedMessages = [];
      let loadedThreadId = null;
      let loadedDirty = false;
      let loadedLastPlan = '';

      try {
        const d = JSON.parse(sessionStorage.getItem(sessionKey));
        if (Array.isArray(d?.messages)) {
          loadedMessages = onlyAI(d.messages).slice(-40);
          loadedThreadId = d.threadId || null;
          loadedDirty = Boolean(d.dirty);
          loadedLastPlan = d.lastPlan || '';
        }
      } catch {
        // Ignore parse error.
      }

      setMessages(loadedMessages);
      setThreadId(loadedThreadId);
      setDirty(loadedDirty);
      setLastPlan(loadedLastPlan);
    }

    if (owner) {
      try {
        const intent = JSON.parse(sessionStorage.getItem('gradpath-chat-login-intent'));
        if (
          intent &&
          Date.now() - intent.time < 900000 &&
          intent.curriculum === state.curriculum
        ) {
          const cleaned = onlyAI(intent.messages);
          setMessages(cleaned);
          setThreadId(null);
          setDirty(true);
          persistSession(cleaned, null, true, '', sessionKey);
          sessionStorage.removeItem('gradpath-chat-login-intent');
        }
      } catch {
        // Ignore parse error.
      }
    }
  }, [scope, sessionKey, owner, state.curriculum, accountRevision, persistSession]);

  const callApi = useCallback(async (path, options = {}) => {
    const r = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: options.signal || AbortSignal.timeout(20000),
    });
    let data;
    try {
      data = await r.json();
    } catch {
      throw Error('Layanan chat belum tersedia.');
    }
    if (!r.ok) throw Error(data.error || 'Permintaan belum berhasil.');
    return data;
  }, []);

  // Automatically check AI availability whenever chat is visible
  useEffect(() => {
    if (!isVisible) return undefined;
    let active = true;
    (async () => {
      try {
        const status = await callApi('/api/chat/status');
        if (active) setReady(Boolean(status.ready));
      } catch {
        if (active) {
          setReady(false);
          setStatusText('AI belum terhubung. Coba lagi nanti.');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [isVisible, isOpen, callApi]);

  // Auto-scroll messages
  useEffect(() => {
    if (scrollRef.current && view === 'chat' && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy, view, isOpen]);

  const authHeaders = async (required = false) => {
    if (!owner) {
      if (required) throw Error('Masuk lewat tombol Masuk, lalu buka chat kembali untuk menyimpan.');
      return {};
    }
    const client = cloudClientRef.current;
    if (!client) throw Error('Layanan akun belum siap.');
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.access_token) throw Error('Sesi berakhir. Masuk kembali.');
    return { Authorization: 'Bearer ' + data.session.access_token };
  };

  const buildPlanSnapshot = () => ({
    curriculum: state.curriculum,
    records: state.records,
    predictions: state.predictions,
    extras: state.extras,
    creditsOverrides: state.creditsOverrides,
    semesterOverrides: state.semesterOverrides,
    target: state.target,
    scenarios: state.scenarios,
  });

  const send = async (questionOverride, retry = false) => {
    if (busy || !ready || !consent) return;
    const q = (questionOverride ?? inputText).trim();
    if (!q) return;
    if (q.length > 1200) {
      setErrorText('Maksimal 1.200 karakter.');
      return;
    }

    const snapshot = JSON.stringify(buildPlanSnapshot());
    const version = epochRef.current;
    const history = snapshot === lastPlan ? messages.slice(-6) : [];
    if (retry && history.at(-1)?.role === 'user' && history.at(-1)?.text === q) {
      history.pop();
    }
    setLastPlan(snapshot);

    let nextMessages = messages;
    if (!retry) {
      nextMessages = [...messages, { role: 'user', text: q, source: 'user' }].slice(-40);
      setMessages(nextMessages);
      setDirty(true);
      persistSession(nextMessages, threadId, true, snapshot);
      setInputText('');
    }

    setLastQuestion(q);
    setBusy(true);
    setErrorText('');
    setShowRetry(false);
    setStatusText('');

    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 40000);

    try {
      const headers = await authHeaders();
      if (version !== epochRef.current) return;
      const result = await callApi('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: q,
          history: history.filter((m) => m.source === 'gemini' || m.role === 'user'),
          plan: JSON.parse(snapshot),
          consent: true,
        }),
        signal: controller.signal,
      });
      if (version !== epochRef.current) return;

      const updated = [
        ...nextMessages,
        { role: 'assistant', text: result.answer, source: 'gemini' },
      ].slice(-40);
      setMessages(updated);
      setDirty(true);
      persistSession(updated, threadId, true, snapshot);
      if (result.truncated) {
        setStatusText('Jawaban terpotong. Coba pertanyaan yang lebih spesifik.');
      }
    } catch (e) {
      if (version === epochRef.current) {
        setErrorText(
          e.name === 'AbortError'
            ? 'Waktu tunggu habis. Pesanmu tetap tersedia.'
            : e.message
        );
        setShowRetry(true);
      }
    } finally {
      clearTimeout(timer);
      if (version === epochRef.current) {
        setBusy(false);
      }
    }
  };

  const handleNewChat = () => {
    if (
      dirty &&
      messages.length &&
      !window.confirm(
        'Mulai chat baru? Percakapan yang belum disimpan akan dihapus dari sesi ini.'
      )
    ) {
      return;
    }
    controllerRef.current?.abort();
    epochRef.current += 1;
    setBusy(false);
    setMessages([]);
    setThreadId(null);
    setDirty(false);
    setLastPlan('');
    setErrorText('');
    setShowRetry(false);
    setStatusText('');
    setView('chat');
    persistSession([], null, false, '');
  };

  const handleSaveChat = async () => {
    if (busy || saving) return;
    if (!messages.length) {
      setStatusText('Mulai percakapan terlebih dahulu.');
      return;
    }
    if (!owner) {
      try {
        sessionStorage.setItem(
          'gradpath-chat-login-intent',
          JSON.stringify({ messages, curriculum: state.curriculum, time: Date.now() })
        );
      } catch {
        // Ignore storage error.
      }
      onOpenAccount(false);
      return;
    }

    const version = epochRef.current;
    const snapshot = JSON.stringify(messages);
    setSaving(true);
    try {
      const headers = await authHeaders(true);
      if (version !== epochRef.current) return;
      setStatusText('Menyimpan…');
      const result = await callApi('/api/chat/threads', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: threadId,
          curriculum: state.curriculum,
          messages: JSON.parse(snapshot),
          title: messages.find((m) => m.role === 'user')?.text,
        }),
      });
      if (version !== epochRef.current) return;
      setThreadId(result.id);
      const stillDirty = JSON.stringify(messages) !== snapshot;
      setDirty(stillDirty);
      persistSession(messages, result.id, stillDirty, lastPlan);
      setStatusText(
        stillDirty
          ? 'Chat tersimpan; ada pesan baru yang belum disimpan.'
          : 'Percakapan tersimpan di akun.'
      );
    } catch (e) {
      if (version === epochRef.current) {
        setStatusText(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const showHistory = async () => {
    if (busy) return;
    const version = epochRef.current;
    try {
      const headers = await authHeaders(true);
      if (version !== epochRef.current) return;
      setStatusText('Memuat riwayat…');
      const result = await callApi('/api/chat/threads', { headers });
      if (version !== epochRef.current) return;
      setHistoryList(result.threads || []);
      setView('history');
      setStatusText('Hanya percakapan akunmu yang ditampilkan.');
    } catch (e) {
      if (version === epochRef.current) {
        setStatusText(e.message);
      }
    }
  };

  const openThread = async (t) => {
    if (t.curriculum !== state.curriculum) {
      setStatusText('Pilih kurikulum yang sesuai untuk membuka percakapan ini.');
      return;
    }
    if (
      dirty &&
      messages.length &&
      !window.confirm('Buka riwayat? Chat saat ini yang belum disimpan akan diganti.')
    ) {
      return;
    }
    const version = epochRef.current;
    try {
      const headers = await authHeaders(true);
      const saved = await callApi('/api/chat/threads?id=' + encodeURIComponent(t.id), {
        headers,
      });
      if (version !== epochRef.current) return;
      const loaded = onlyAI(saved.messages);
      setMessages(loaded);
      setThreadId(saved.id);
      setDirty(false);
      setLastPlan('');
      persistSession(loaded, saved.id, false, '');
      setView('chat');
      setStatusText('Riwayat dibuka. Pertanyaan berikut memakai data rencana saat ini.');
    } catch (e) {
      setStatusText(e.message);
    }
  };

  const deleteThread = async (t) => {
    if (!window.confirm('Hapus percakapan ini dari akun?')) return;
    const version = epochRef.current;
    try {
      const headers = await authHeaders(true);
      await callApi('/api/chat/threads?id=' + encodeURIComponent(t.id), {
        method: 'DELETE',
        headers,
      });
      if (version !== epochRef.current) return;
      if (threadId === t.id) {
        setThreadId(null);
        setDirty(true);
        persistSession(messages, null, true, lastPlan);
      }
      await showHistory();
    } catch (e) {
      setStatusText(e.message);
    }
  };

  if (!isVisible) return null;

  const calc = calculate(state.records, getCoursesForState(state));

  if (!isOpen) {
    return (
      <button
        className="chat-launch-left"
        id="chatLaunch"
        type="button"
        aria-expanded="false"
        aria-controls="chatPanel"
        onClick={() => onToggleOpen(true)}
      >
        <span className="chat-spark" aria-hidden="true">
          ✦
        </span>{' '}
        Tanya GradPath
      </button>
    );
  }

  return (
    <aside
      id="chatPanel"
      className="chat-panel chat-left"
      aria-label="Tanya GradPath"
    >
      <div className="chat-head">
        <span className="chat-spark" aria-hidden="true">
          ✦
        </span>
        <div>
          <h2>Tanya GradPath</h2>
          <p id="chatAvailability">{ready ? 'AI siap membantu' : 'Memeriksa AI…'}</p>
        </div>
        <button
          type="button"
          className="text-button chat-close"
          id="chatClose"
          aria-label="Sembunyikan chat"
          title="Sembunyikan panel chat"
          onClick={() => onToggleOpen(false)}
        >
          ×
        </button>
      </div>

      <div className="chat-tools">
        <button type="button" className="text-button" id="chatNew" onClick={handleNewChat}>
          Chat baru
        </button>
        <button type="button" className="text-button" id="chatHistory" onClick={showHistory}>
          Riwayat akun
        </button>
        <button type="button" className="text-button" id="chatSave" onClick={handleSaveChat}>
          Simpan chat
        </button>
      </div>

      <div className="chat-context" id="chatContext">
        {curriculumLabel} · IPK {fmt(calc.gpa)} · Target {fmt(state.target)}
      </div>

      <div className="chat-scroll" id="chatScroll" ref={scrollRef}>
        {view === 'history' ? (
          <>
            <button
              type="button"
              className="text-button"
              onClick={() => setView('chat')}
            >
              ← Kembali ke chat
            </button>
            {!historyList.length ? (
              <p>Belum ada percakapan tersimpan.</p>
            ) : (
              historyList.map((t) => (
                <div className="chat-history-item" key={t.id}>
                  <button type="button" className="text-button" onClick={() => openThread(t)}>
                    {t.title}
                    <small>
                      {t.curriculum === 'if2024' ? 'Informatika' : 'Sistem Informasi'} ·{' '}
                      {new Date(t.updated_at).toLocaleDateString('id-ID')}
                    </small>
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Hapus percakapan ${t.title}`}
                    onClick={() => deleteThread(t)}
                  >
                    Hapus
                  </button>
                </div>
              ))
            )}
          </>
        ) : (
          <div id="chatMessages" role="log" aria-label="Percakapan">
            {!messages.length ? (
              <div className="chat-intro">
                <span className="chat-spark" aria-hidden="true">
                  ✦
                </span>
                <h3>
                  Mau bahas
                  <br />
                  target IPK-mu?
                </h3>
                <p>Pahami hasilmu, lalu tentukan langkah berikutnya.</p>
              </div>
            ) : null}

            {messages.map((m, idx) => (
              <div key={idx} className={`chat-message ${m.role}`}>
                <small className="chat-source">
                  {m.role === 'user' ? 'Kamu' : 'Jawaban AI · periksa kembali sarannya'}
                </small>
                {m.text}
              </div>
            ))}

            {busy ? (
              <p className="chat-wait">GradPath sedang memikirkan jawaban…</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="chat-footer">
        <label className="chat-consent">
          <input
            id="chatConsent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            Izinkan pesan dan ringkasan akademik dikirim ke Google. Paket gratis dapat
            digunakan untuk peningkatan produk.{' '}
            <a
              href="https://ai.google.dev/gemini-api/terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ketentuan
            </a>
          </span>
        </label>

        <form
          className="chat-compose"
          id="chatForm"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            id="chatInput"
            maxLength={1200}
            aria-label="Pesan untuk GradPath"
            placeholder="Tanyakan tentang targetmu…"
            disabled={!ready}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (ready && consent && !busy) send();
              }
            }}
          />
          <button
            className="chat-send"
            id="chatSend"
            type="submit"
            aria-label="Kirim pesan"
            disabled={!ready || !consent || busy}
          >
            ↑
          </button>
        </form>

        <p className="chat-error" id="chatError" role="alert">
          {errorText}
        </p>
        <button
          type="button"
          id="chatRetry"
          className="outline chat-retry"
          hidden={!showRetry}
          onClick={() => send(lastQuestion, true)}
        >
          Coba lagi
        </button>
        <p className="chat-status" id="chatStatus" role="status">
          {statusText}
        </p>
        <p className="chat-note">
          {ready ? 'Jangan sertakan identitas pribadi. AI dapat keliru.' : 'AI menunggu aktivasi.'}
        </p>
      </div>
    </aside>
  );
}
