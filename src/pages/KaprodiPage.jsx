import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  calculate,
  cleanPlan,
  fmt,
  forecast,
  getCourseDisplayName,
  getCoursesForState,
  meetsTarget,
} from '../engine/gpaEngine';

function summarizePlan(rawPlan) {
  try {
    const plan = cleanPlan(rawPlan.data);
    const courses = getCoursesForState(plan);
    const calc = calculate(plan.records, courses);
    const fc = forecast(plan.records, plan.predictions, plan.target, courses);
    const blocked = calc.failed > 0;
    const selectedCourses = courses
      .filter((c) => !plan.records[c.id]?.skipped && plan.records[c.id]?.selected)
      .map((c) => ({
        id: c.id,
        name: getCourseDisplayName(plan, c),
        credits: c.credits,
        semester: c.semester,
        grade: plan.records[c.id].grade,
      }));
    return {
      ...rawPlan,
      plan,
      calc,
      fc,
      blocked,
      possible: !blocked && meetsTarget(fc.maximum, plan.target),
      selectedCourses,
    };
  } catch {
    return {
      ...rawPlan,
      plan: null,
      calc: null,
      fc: null,
      blocked: false,
      possible: false,
      selectedCourses: [],
    };
  }
}

export function KaprodiPage({
  cloudClientRef,
  cloudUser,
  profileName,
  toast,
}) {
  const [students, setStudents] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [curriculumFilter, setCurriculumFilter] = useState('all'); // 'all' | 'si2024' | 'if2024'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Feedback composer dialog state
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPlan, setComposerPlan] = useState(null); // { id, name } | null
  const [feedbackText, setFeedbackText] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [composerError, setComposerError] = useState('');

  const composerRef = useRef(null);
  const textareaRef = useRef(null);

  const loadData = useCallback(async () => {
    const client = cloudClientRef.current;
    if (!client) return;
    setLoading(true);
    setErrorText('');
    try {
      const [profilesRes, plansRes, rolesRes] = await Promise.all([
        client
          .from('gradpath_profiles')
          .select('user_id,full_name,email,updated_at')
          .order('full_name', { ascending: true })
          .limit(500),
        client
          .from('gradpath_plans')
          .select('id,user_id,name,updated_at,data')
          .order('updated_at', { ascending: false })
          .limit(1000),
        client
          .from('gradpath_roles')
          .select('user_id,role')
          .eq('role', 'kaprodi'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (plansRes.error) throw plansRes.error;

      const excludedIds = new Set(cloudUser?.id ? [cloudUser.id] : []);
      if (!rolesRes.error) {
        for (const r of rolesRes.data || []) {
          if (r.role === 'kaprodi') excludedIds.add(r.user_id);
        }
      }

      const map = new Map();
      for (const p of profilesRes.data || []) {
        if (excludedIds.has(p.user_id)) continue;
        map.set(p.user_id, {
          userId: p.user_id,
          fullName: p.full_name || 'Tanpa nama',
          email: p.email || '',
          updatedAt: p.updated_at,
          plans: [],
        });
      }

      for (const raw of plansRes.data || []) {
        if (excludedIds.has(raw.user_id)) continue;
        const entry = map.get(raw.user_id) || {
          userId: raw.user_id,
          fullName: 'Mahasiswa (belum isi nama)',
          email: '',
          updatedAt: raw.updated_at,
          plans: [],
        };
        entry.plans.push(summarizePlan(raw));
        if (!entry.updatedAt || new Date(raw.updated_at) > new Date(entry.updatedAt)) {
          entry.updatedAt = raw.updated_at;
        }
        map.set(raw.user_id, entry);
      }

      const list = [...map.values()].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, 'id-ID')
      );
      setStudents(list);
      setSelectedUserId((prev) =>
        prev && list.some((s) => s.userId === prev) ? prev : list[0]?.userId || null
      );
    } catch (e) {
      setErrorText(
        ['PGRST205', '42P01', '42501'].includes(e?.code)
          ? 'Akses Kaprodi di Supabase belum siap. Jalankan SQL migrasi Kaprodi terlebih dahulu.'
          : e?.message || 'Gagal memuat data mahasiswa.'
      );
    } finally {
      setLoading(false);
    }
  }, [cloudClientRef, cloudUser?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadStudentFeedback = useCallback(
    async (studentId) => {
      const client = cloudClientRef.current;
      if (!client || !studentId) {
        setFeedbackHistory([]);
        return;
      }
      setLoadingFeedback(true);
      try {
        const { data, error } = await client
          .from('gradpath_feedback')
          .select('id,kaprodi_name,plan_name,message,is_read,created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setFeedbackHistory(data || []);
      } catch {
        setFeedbackHistory([]);
      } finally {
        setLoadingFeedback(false);
      }
    },
    [cloudClientRef]
  );

  useEffect(() => {
    loadStudentFeedback(selectedUserId);
  }, [selectedUserId, loadStudentFeedback]);

  useEffect(() => {
    const dialog = composerRef.current;
    if (!dialog) return;
    if (composerOpen && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => textareaRef.current?.focus());
    } else if (!composerOpen && dialog.open) {
      dialog.close();
    }
  }, [composerOpen]);

  const filteredStudents = students.filter((student) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      student.fullName.toLowerCase().includes(q) ||
      student.email.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (curriculumFilter === 'all') return true;
    return student.plans.some((p) => p.plan?.curriculum === curriculumFilter);
  });

  const selectedStudent =
    filteredStudents.find((s) => s.userId === selectedUserId) || filteredStudents[0] || null;

  const visiblePlans = selectedStudent
    ? selectedStudent.plans.filter(
        (p) => curriculumFilter === 'all' || p.plan?.curriculum === curriculumFilter
      )
    : [];

  const openFeedbackComposer = (plan = null) => {
    setComposerPlan(plan ? { id: plan.id, name: plan.name } : null);
    setFeedbackText('');
    setComposerError('');
    setComposerOpen(true);
  };

  const handleSendFeedback = async (e) => {
    e.preventDefault();
    const client = cloudClientRef.current;
    if (!client || !cloudUser || !selectedStudent || sendingFeedback) return;
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      setComposerError('Tulis masukan terlebih dahulu.');
      return;
    }

    setSendingFeedback(true);
    setComposerError('');
    try {
      const { error } = await client.from('gradpath_feedback').insert({
        student_id: selectedStudent.userId,
        kaprodi_id: cloudUser.id,
        kaprodi_name: profileName || cloudUser.email || 'Kaprodi',
        plan_id: composerPlan?.id || null,
        plan_name: composerPlan?.name || null,
        message: trimmed,
      });
      if (error) throw error;
      setComposerOpen(false);
      toast('Masukan terkirim ke mahasiswa.');
      await loadStudentFeedback(selectedStudent.userId);
    } catch (err) {
      setComposerError(
        ['PGRST205', '42P01', '42501'].includes(err?.code)
          ? 'Tabel gradpath_feedback belum siap atau belum diberi izin.'
          : err?.message || 'Gagal mengirim masukan.'
      );
    } finally {
      setSendingFeedback(false);
    }
  };

  return (
    <>
      <header className="results-head kaprodi-head">
        <div className="kaprodi-top-row">
          <h1 tabIndex={-1}>Dashboard Kaprodi.</h1>
          <button
            type="button"
            className="outline small-button"
            disabled={loading}
            onClick={loadData}
          >
            {loading ? 'Memuat…' : 'Muat ulang'}
          </button>
        </div>
        <p>Pantau riwayat rencana nilai mahasiswa (SI &amp; Informatika) dan kirim masukan.</p>
      </header>

      <div className="toolbar kaprodi-toolbar">
        <label>
          Cari mahasiswa
          <input
            type="search"
            placeholder="Nama atau email mahasiswa…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        <label>
          Filter Program Studi
          <select
            value={curriculumFilter}
            onChange={(e) => setCurriculumFilter(e.target.value)}
          >
            <option value="all">Semua (SI &amp; Informatika)</option>
            <option value="si2024">Sistem Informasi 2024</option>
            <option value="if2024">Informatika 2024</option>
          </select>
        </label>
      </div>

      {errorText ? (
        <div className="error" role="alert">
          {errorText}
        </div>
      ) : null}

      {loading ? (
        <p className="muted">Memuat daftar mahasiswa…</p>
      ) : (
        <div className="kaprodi-layout">
          <section className="kaprodi-students" aria-label="Daftar mahasiswa">
            <h2>Mahasiswa ({filteredStudents.length})</h2>
            {filteredStudents.length ? (
              <div className="kaprodi-student-list">
                {filteredStudents.map((s) => {
                  const active = selectedStudent?.userId === s.userId;
                  const latest = s.plans[0];
                  const curricula = [
                    ...new Set(
                      s.plans
                        .map((p) =>
                          p.plan?.curriculum === 'if2024'
                            ? 'IF'
                            : p.plan?.curriculum === 'si2024'
                            ? 'SI'
                            : null
                        )
                        .filter(Boolean)
                    ),
                  ];
                  return (
                    <button
                      type="button"
                      key={s.userId}
                      className={`kaprodi-student-card${active ? ' active' : ''}`}
                      onClick={() => setSelectedUserId(s.userId)}
                    >
                      <div className="kaprodi-student-name">
                        <strong>{s.fullName}</strong>
                        {curricula.length ? (
                          <span className="kaprodi-badge">{curricula.join(' · ')}</span>
                        ) : null}
                      </div>
                      {s.email ? <p className="small muted">{s.email}</p> : null}
                      <p className="small muted">
                        {s.plans.length} rencana
                        {latest?.calc ? ` · IPK ${fmt(latest.calc.gpa)}` : ''}
                        {latest?.plan ? ` · Target ${fmt(latest.plan.target)}` : ''}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="small muted">Tidak ada mahasiswa yang cocok dengan filter.</p>
            )}
          </section>

          <section className="kaprodi-detail" aria-label="Detail mahasiswa">
            {selectedStudent ? (
              <>
                <div className="kaprodi-detail-header">
                  <div>
                    <h2>{selectedStudent.fullName}</h2>
                    {selectedStudent.email ? (
                      <p className="small muted">{selectedStudent.email}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => openFeedbackComposer(null)}
                  >
                    Beri Masukan
                  </button>
                </div>

                <h3>Riwayat Rencana ({visiblePlans.length})</h3>
                {visiblePlans.length ? (
                  <div className="kaprodi-plans">
                    {visiblePlans.map((item) => (
                      <article className="kaprodi-plan-card" key={item.id}>
                        <div className="kaprodi-plan-top">
                          <div>
                            <strong>{item.name}</strong>
                            <p className="small muted">
                              {item.plan?.curriculum === 'if2024'
                                ? 'Informatika 2024'
                                : 'Sistem Informasi 2024'}{' '}
                              · Diperbarui{' '}
                              {new Date(item.updated_at).toLocaleString('id-ID')}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="outline small-button"
                            onClick={() => openFeedbackComposer(item)}
                          >
                            Beri Masukan
                          </button>
                        </div>

                        {item.calc && item.plan ? (
                          <>
                            <div className="kaprodi-stats">
                              <div>
                                <span className="small muted">IPK saat ini</span>
                                <b>{fmt(item.calc.gpa)}</b>
                              </div>
                              <div>
                                <span className="small muted">Target IPK</span>
                                <b>{fmt(item.plan.target)}</b>
                              </div>
                              <div>
                                <span className="small muted">Proyeksi IPK</span>
                                <b>{item.blocked ? '—' : fmt(item.fc?.projected)}</b>
                              </div>
                              <div>
                                <span className="small muted">IPK maks. (sisa A)</span>
                                <b>{item.blocked ? '—' : fmt(item.fc?.maximum)}</b>
                              </div>
                              <div>
                                <span className="small muted">SKS dinilai</span>
                                <b>
                                  {item.calc.credits} / {item.calc.total}
                                </b>
                              </div>
                            </div>
                            {item.calc.failed > 0 ? (
                              <p className="small notice">
                                Ada {item.calc.failed} SKS dengan nilai di bawah C.
                              </p>
                            ) : null}

                            <details className="kaprodi-details">
                              <summary>
                                Lihat nilai ({item.selectedCourses.length} matkul)
                              </summary>
                              <div className="kaprodi-details-body">
                                <h4>Nilai Mata Kuliah</h4>
                                {item.selectedCourses.length ? (
                                  <table className="table">
                                    <thead>
                                      <tr>
                                        <th>Mata kuliah</th>
                                        <th>SKS</th>
                                        <th>Nilai</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.selectedCourses.map((c) => (
                                        <tr key={c.id}>
                                          <td>{c.name}</td>
                                          <td>{c.credits}</td>
                                          <td>{c.grade}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="small muted">Belum ada nilai yang diisi.</p>
                                )}
                              </div>
                            </details>
                          </>
                        ) : (
                          <p className="small muted">Format data rencana tidak dapat dibaca.</p>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="small muted">Mahasiswa ini belum memiliki rencana tersimpan.</p>
                )}

                <div className="kaprodi-feedback-history">
                  <h3>Riwayat Masukan Terkirim</h3>
                  {loadingFeedback ? (
                    <p className="small muted">Memuat riwayat masukan…</p>
                  ) : feedbackHistory.length ? (
                    feedbackHistory.map((fb) => (
                      <div className="notif-item" key={fb.id}>
                        <div className="notif-meta">
                          <strong>{fb.kaprodi_name}</strong>
                          <span className="small muted">
                            {new Date(fb.created_at).toLocaleString('id-ID')} ·{' '}
                            {fb.is_read ? 'Sudah dibaca' : 'Belum dibaca'}
                          </span>
                        </div>
                        {fb.plan_name ? (
                          <p className="small notif-plan">Rencana: {fb.plan_name}</p>
                        ) : null}
                        <p className="notif-message">{fb.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="small muted">Belum ada masukan yang dikirim ke mahasiswa ini.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="small muted">Pilih mahasiswa dari daftar di sebelah kiri.</p>
            )}
          </section>
        </div>
      )}

      <dialog
        ref={composerRef}
        id="feedbackDialog"
        aria-label="Kirim masukan ke mahasiswa"
        onCancel={(e) => {
          if (sendingFeedback) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          setComposerOpen(false);
        }}
      >
        <form onSubmit={handleSendFeedback}>
          <h2>Beri masukan.</h2>
          <p className="small muted">
            Untuk: <strong>{selectedStudent?.fullName}</strong>
            {composerPlan ? ` · Rencana "${composerPlan.name}"` : ''}
          </p>
          <label htmlFor="kaprodiFeedbackInput">Pesan masukan</label>
          <textarea
            ref={textareaRef}
            id="kaprodiFeedbackInput"
            rows={4}
            maxLength={2000}
            required
            placeholder="Tulis saran akademik untuk mahasiswa…"
            disabled={sendingFeedback}
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
          />
          {composerError ? (
            <div className="error" role="alert">
              {composerError}
            </div>
          ) : null}
          <div className="dialog-actions">
            <button
              type="button"
              className="text-button"
              disabled={sendingFeedback}
              onClick={() => setComposerOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="outline" disabled={sendingFeedback}>
              {sendingFeedback ? 'Mengirim…' : 'Kirim masukan'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
