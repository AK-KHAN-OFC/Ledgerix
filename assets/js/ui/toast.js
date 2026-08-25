/**
 * Ledgerix - Toast Notification UI
 */

'use strict';

import { addNotification } from '../modules/notifications.js';

const _NOTIF_WORTHY = new Set(['error']);

export function showToast(msg, type = 'info', notify = _NOTIF_WORTHY.has(type)) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${msg}`;
  container.appendChild(toast);

  if (notify) addNotification(type, type.charAt(0).toUpperCase() + type.slice(1), msg);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
