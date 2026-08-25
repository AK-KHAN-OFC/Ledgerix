/**
 * Ledgerix - Notifications Module
 * Manages in-app notification state and payment-due reminders.
 * All persistence goes through core/storage.js — no direct localStorage access.
 */

'use strict';

import AppConfig from '../../../config/app.config.js';
import * as State from '../core/state.js';
import { nextId } from '../core/state.js';
import { saveNotifications, loadRemindersFiredToday, saveRemindersFiredToday } from '../core/storage.js';
import { esc, today, daysBetween, formatMoney } from '../utils/helpers.js';

export function addNotification(type, title, message) {
  const safeType = AppConfig.NOTIF_TYPES.has(type) ? type : 'info';
  const notif = {
    id: nextId(), type: safeType, title, message,
    time: new Date().toLocaleTimeString(), read: false,
  };
  State.notifications.unshift(notif);
  if (State.notifications.length > AppConfig.NOTIFICATION_CAP) State.notifications.pop();
  saveNotifications();
  updateNotificationBadge();
  renderNotifications();
}

export function updateNotificationBadge() {
  const unread = State.notifications.filter(n => !n.read).length;
  const badge  = document.getElementById('notifBadge');
  if (!badge) return;
  if (unread > 0) {
    badge.textContent   = unread > 9 ? '9+' : unread;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

export function renderNotifications() {
  const list = document.getElementById('notificationList');
  if (!list) return;

  if (State.notifications.length === 0) {
    list.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash" style="font-size:1.5rem;margin-bottom:0.5rem;display:block"></i>No notifications yet</div>';
    return;
  }

  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  list.innerHTML = State.notifications.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="window._ledgerix.notifications.markRead(${n.id})">
      <div class="notif-icon ${n.type}"><i class="fas ${icons[n.type] || icons.info}"></i></div>
      <div class="notif-content"><p><strong>${esc(n.title)}</strong><br>${esc(n.message)}</p><small>${esc(n.time)}</small></div>
    </div>
  `).join('');
}

export function markRead(id) {
  const n = State.notifications.find(x => x.id === id);
  if (n) { n.read = true; saveNotifications(); renderNotifications(); updateNotificationBadge(); }
}

export function toggleNotifications() {
  document.getElementById('notificationPanel').classList.toggle('active');
}

export function checkPaymentReminders() {
  const todayStr  = today();
  const firedToday = loadRemindersFiredToday(todayStr);

  State.savedInvoices.forEach(inv => {
    if (inv.paymentStatus === 'pending' || inv.paymentStatus === 'overdue') {
      const daysLeft   = daysBetween(todayStr, inv.dueDate);
      const needsNotif = (daysLeft <= 3 && daysLeft >= 0) || daysLeft < 0;
      if (needsNotif && !firedToday.has(inv.id)) {
        if (daysLeft < 0) {
          addNotification('error', 'Payment Overdue',
            `Invoice ${inv.invNum} for ${inv.clientName} is ${Math.abs(daysLeft)} days overdue (${formatMoney(inv.grandTotal)})`);
        } else {
          addNotification('warning', 'Payment Due Soon',
            `Invoice ${inv.invNum} for ${inv.clientName} is due in ${daysLeft} days (${formatMoney(inv.grandTotal)})`);
        }
        firedToday.add(inv.id);
      }
    }
  });

  saveRemindersFiredToday(todayStr, firedToday);
}
