import React, { useEffect, useRef, useState } from 'react';

export function AccountDialog({
  open,
  cloudUser,
  cloudReady,
  cloudBusy,
  accountContext,
  accountPlans,
  loadingPlans,
  accountErrorText,
  saveIntentFlag,
  profileName,
  loadingProfile,
  needsProfileName,
  userRole,
  onClose,
  onSignIn,
  onSignOut,
  onSaveCloud,
  onLoadCloud,
  onDeleteCloud,
  onSaveProfile,
}) {
  const dialogRef = useRef(null);
  const planNameInputRef = useRef(null);
  const fullNameInputRef = useRef(null);
  const [planName, setPlanName] = useState('Rencana kuliah saya');
  const [fullNameInput, setFullNameInput] = useState('');
  const [loginRole, setLoginRole] = useState('student');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setPlanName(accountContext?.name || 'Rencana kuliah saya');
      setFullNameInput(profileName || '');
    }
  }, [open, accountContext, profileName]);

  useEffect(() => {
    if (!open || !cloudUser) return;
    if (!loadingProfile && needsProfileName) {
      fullNameInputRef.current?.focus();
    } else if (saveIntentFlag && !loadingPlans && !needsProfileName) {
      planNameInputRef.current?.focus();
    }
  }, [open, saveIntentFlag, cloudUser, loadingPlans, loadingProfile, needsProfileName]);

  const handleCancel = (e) => {
    if (cloudBusy) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveCloud(true, planName);
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    onSaveProfile(fullNameInput);
  };

  const showProfilePrompt = Boolean(cloudUser && !loadingProfile && needsProfileName);
  const isKaprodi = Boolean(cloudUser && userRole === 'kaprodi');

  return (
    <dialog
      ref={dialogRef}
      id="accountDialog"
      aria-label="Akun dan rencana tersimpan"
      onCancel={handleCancel}
    >
      <div className="account-heading">
        <h2>
          {!cloudUser
            ? 'Simpan progresmu.'
            : showProfilePrompt
            ? 'Lengkapi namamu.'
            : isKaprodi
            ? 'Akun Kaprodi.'
            : 'Rencana saya.'}
        </h2>
        <button
          type="button"
          className="text-button"
          id="closeAccount"
          aria-label="Tutup"
          disabled={cloudBusy}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {cloudUser ? (
        <>
          <p className="small muted account-email">
            {profileName && !showProfilePrompt ? (
              <>
                <strong>{profileName}</strong> ·{' '}
              </>
            ) : null}
            {cloudUser.email || 'Akun Google'}
          </p>

          {cloudReady ? (
            <div id="accountContent">
              {loadingProfile || (!isKaprodi && loadingPlans) ? (
                <p className="muted small">Memuat akun…</p>
              ) : showProfilePrompt ? (
                <form id="profileNameForm" onSubmit={handleProfileSubmit}>
                  <label htmlFor="profileFullName">Nama lengkap</label>
                  <input
                    ref={fullNameInputRef}
                    id="profileFullName"
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder="Masukkan nama lengkap"
                    disabled={cloudBusy}
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                  />
                  <div className="cloud-save-actions">
                    <button className="outline" type="submit" disabled={cloudBusy}>
                      {cloudBusy ? 'Menyimpan…' : 'Simpan & lanjutkan'}
                    </button>
                  </div>
                </form>
              ) : isKaprodi ? (
                <p className="small muted" style={{ marginBottom: 18 }}>
                  Masuk sebagai Kaprodi. Gunakan dashboard untuk melihat riwayat rencana mahasiswa dan memberi masukan.
                </p>
              ) : (
                <>
                  <form id="cloudSaveForm" onSubmit={handleSubmit}>
                    <label htmlFor="cloudPlanName">Nama rencana</label>
                    <input
                      ref={planNameInputRef}
                      id="cloudPlanName"
                      maxLength={80}
                      required
                      disabled={cloudBusy}
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                    />
                    <div className="cloud-save-actions">
                      {accountContext ? (
                        <button
                          className="outline"
                          type="button"
                          id="updateCloudPlan"
                          disabled={cloudBusy}
                          onClick={() => onSaveCloud(false, planName)}
                        >
                          Simpan perubahan
                        </button>
                      ) : null}
                      <button className="outline" type="submit" disabled={cloudBusy}>
                        Simpan sebagai rencana baru
                      </button>
                    </div>
                    <p className="small muted">
                      Input saat ini disimpan hanya setelah Anda menekan tombol simpan.
                    </p>
                  </form>

                  <div className="cloud-list">
                    {accountPlans.length ? (
                      accountPlans.map((p) => (
                        <div className="cloud-plan" key={p.id}>
                          <div>
                            <b>{p.name}</b>
                            <p className="small muted">
                              {p.curriculum === 'if2024'
                                ? 'Informatika 2024'
                                : 'Sistem Informasi 2024'}{' '}
                              · {new Date(p.updated_at).toLocaleString('id-ID')}
                            </p>
                          </div>
                          <div className="cloud-plan-actions">
                            <button
                              type="button"
                              className="outline small-button"
                              disabled={cloudBusy}
                              onClick={() => onLoadCloud(p.id)}
                            >
                              Lanjutkan
                            </button>
                            <button
                              type="button"
                              className="text-button cloud-delete-button"
                              aria-label={`Hapus rencana ${p.name}`}
                              disabled={cloudBusy}
                              onClick={() => onDeleteCloud(p)}
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="muted small">Belum ada rencana di akun ini.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}

          <button
            type="button"
            className="text-button"
            id="signOut"
            disabled={cloudBusy}
            onClick={onSignOut}
          >
            Keluar
          </button>
        </>
      ) : (
        <>
          <p className="muted">Pilih jenis akun sebelum masuk dengan Google.</p>
          <div className="login-role-choices" role="radiogroup" aria-label="Pilih peran login">
            <label className="choice login-role-option">
              <input
                type="radio"
                name="loginRole"
                value="student"
                checked={loginRole === 'student'}
                disabled={cloudBusy}
                onChange={() => setLoginRole('student')}
              />
              <div className="login-role-copy">
                <strong>Mahasiswa</strong>
                <span className="small muted">Hitung IPK, simulasi nilai, dan simpan rencana.</span>
              </div>
            </label>
            <label className="choice login-role-option">
              <input
                type="radio"
                name="loginRole"
                value="kaprodi"
                checked={loginRole === 'kaprodi'}
                disabled={cloudBusy}
                onChange={() => setLoginRole('kaprodi')}
              />
              <div className="login-role-copy">
                <strong>Kaprodi</strong>
                <span className="small muted">Pantau riwayat rencana mahasiswa dan beri masukan.</span>
              </div>
            </label>
          </div>
          <button
            type="button"
            className="outline google-button"
            id="googleLogin"
            disabled={cloudBusy || !cloudReady}
            onClick={() => onSignIn(loginRole)}
          >
            Lanjutkan dengan Google ({loginRole === 'kaprodi' ? 'Kaprodi' : 'Mahasiswa'})
          </button>
          <p className="small muted">Tetap bisa mencoba sebagai mahasiswa tanpa login.</p>
        </>
      )}

      <p id="accountError" className="error" role="alert">
        {accountErrorText}
      </p>
    </dialog>
  );
}
