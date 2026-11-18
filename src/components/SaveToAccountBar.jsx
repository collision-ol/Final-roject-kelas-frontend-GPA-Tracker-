import React from 'react';
import { planFingerprint } from '../engine/gpaEngine';

export function SaveToAccountBar({ state, accountContext, cloudLast, cloudBusy, onSaveClick }) {
  const isSynced = accountContext && cloudLast === planFingerprint(state);

  return (
    <div className="account-save">
      <button
        type="button"
        className={`outline${cloudBusy ? ' is-saving' : ''}`}
        id="saveToAccount"
        disabled={cloudBusy}
        onClick={onSaveClick}
      >
        {cloudBusy
          ? 'Menyimpan…'
          : isSynced
          ? '✓ Tersimpan di akun'
          : 'Simpan ke akun'}
      </button>
      <p id="cloudStatus" className="small muted" aria-live="polite">
        {accountContext
          ? isSynced
            ? 'Tersimpan di akun'
            : 'Ada perubahan belum disimpan'
          : 'Data tersimpan di browser ini'}
      </p>
    </div>
  );
}
