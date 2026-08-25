/**
 * Ledgerix - Navigation & UI Shell
 * All persistence goes through core/storage.js — no direct localStorage access.
 */

'use strict';

import { isReturningUser } from '../core/storage.js';

export function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.tab === tab) item.classList.add('active');
  });

  const el = document.getElementById(tab + '-tab');
  if (el) el.classList.add('active');

  // Lazy-load tab-specific logic
  import('../modules/tabHandlers.js').then(m => m.onTabSwitch(tab));
}

export function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}

export function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.remove('active');
}

export function closeModalDirect() {
  document.getElementById('modalOverlay').classList.remove('active');
}

export function hideSplash() {
  // Use storage service instead of direct localStorage access
  const returning = isReturningUser();
  setTimeout(() => {
    const el = document.getElementById('splashScreen');
    if (el) el.classList.add('hidden');
  }, returning ? 400 : 2000);
}
