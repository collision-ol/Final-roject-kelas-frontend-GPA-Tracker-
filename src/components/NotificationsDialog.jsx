import React, { useEffect, useRef } from 'react';

export function NotificationsDialog({
  open,
  notifications,
  loading,
  unreadCount,
  onClose,
  onMarkRead,
  onMarkAllRead,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      id="notificationsDialog"
      aria-label="Notifikasi masukan Kaprodi"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="account-heading">
        <h2>Notifikasi.</h2>
        <button
          type="button"
          className="text-button"
          aria-label="Tutup notifikasi"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {unreadCount > 0 ? (
        <div className="notif-toolbar">
          <span className="small muted">{unreadCount} masukan belum dibaca</span>
          <button type="button" className="text-button" onClick={onMarkAllRead}>
            Tandai semua dibaca
          </button>
        </div>
      ) : null}

      <div className="notif-list">
        {loading ? (
          <p className="small muted">Memuat notifikasi…</p>
        ) : notifications.length ? (
          notifications.map((item) => (
            <article
              key={item.id}
              className={`notif-item${item.is_read ? '' : ' unread'}`}
              onClick={() => {
                if (!item.is_read) onMarkRead(item.id);
              }}
            >
              <div className="notif-meta">
                <div>
                  <strong>{item.kaprodi_name || 'Kaprodi'}</strong>
                  {!item.is_read ? <span className="notif-pill">Baru</span> : null}
                </div>
                <span className="small muted">
                  {new Date(item.created_at).toLocaleString('id-ID')}
                </span>
              </div>
              {item.plan_name ? (
                <p className="small notif-plan">Rencana: {item.plan_name}</p>
              ) : null}
              <p className="notif-message">{item.message}</p>
              {!item.is_read ? (
                <button
                  type="button"
                  className="text-button notif-read-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(item.id);
                  }}
                >
                  Tandai dibaca
                </button>
              ) : null}
            </article>
          ))
        ) : (
          <p className="small muted">Belum ada masukan dari Kaprodi.</p>
        )}
      </div>
    </dialog>
  );
}
