import React from 'react';

export function TopControls({
  theme,
  onToggleTheme,
  cloudUser,
  cloudBusy,
  userRole,
  unreadCount,
  isHome,
  onGoHome,
  onReset,
  onOpenAccount,
  onOpenNotifications,
}) {
  const isLight = theme === 'light';
  const nextLabel = isLight ? 'Dark mode' : 'Light mode';
  const isKaprodi = Boolean(cloudUser && userRole === 'kaprodi');

  return (
    <div className="top-controls">
      {cloudUser && !isKaprodi ? (
        <button
          type="button"
          id="notificationsButton"
          className="account-button notif-button"
          aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} belum dibaca` : ''}`}
          onClick={onOpenNotifications}
        >
          <span>Notifikasi</span>
          {unreadCount > 0 ? <span className="notif-badge">{unreadCount}</span> : null}
        </button>
      ) : null}

      {!isKaprodi ? (
        <>
          <button
            type="button"
            id="homeButton"
            className={`account-button${isHome ? ' active-nav' : ''}`}
            onClick={onGoHome}
          >
            Home
          </button>
          <button
            type="button"
            id="resetButton"
            className="account-button"
            title="Reset semua input lokal"
            onClick={onReset}
          >
            Reset
          </button>
        </>
      ) : null}

      <button
        type="button"
        id="accountButton"
        className="account-button"
        disabled={cloudBusy}
        onClick={onOpenAccount}
      >
        {cloudUser ? 'Akun' : 'Masuk'}
      </button>

      <button
        id="themeToggle"
        className="theme-toggle"
        type="button"
        aria-label={`Beralih ke ${nextLabel.toLowerCase()}`}
        title={`Beralih ke ${nextLabel.toLowerCase()}`}
        onClick={onToggleTheme}
      >
        {isLight ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </svg>
        )}
        <span>{nextLabel}</span>
      </button>
    </div>
  );
}
