/**
 * Ledgerix - Backup & Restore Module
 */

'use strict';

import * as State from '../core/state.js';
import { restoreFromBackup, clearAllAppData, loadAllData } from '../core/storage.js';
import { showToast } from '../ui/toast.js';
import { closeModalDirect } from '../ui/navigation.js';

export function backupData() {
  const data = {
    clients:        State.clients,
    products:       State.products,
    savedInvoices:  State.savedInvoices,
    profile:        _stripImages(State.profile),
    settings:       State.settings,
    invoiceCounter: State.invoiceCounter,
    notifications:  State.notifications,
    exportedAt:     new Date().toISOString(),
    version:        '2.0',
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Ledgerix_Backup_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded!', 'success');
}

function _stripImages(profile) {
  const { logo, signature, ...rest } = profile || {};
  return rest;
}

export function restoreData(e) {
  // e may be an Event (from onchange="restoreData(event)") or an HTMLInputElement
  // Handle both safely
  const file = (e && e.target ? e.target.files : e && e.files ? e.files : null)?.[0];
  if (!file) return;
  if (!file.name.endsWith('.json')) { showToast('Please select a JSON backup file!', 'error'); return; }

  const reader = new FileReader();
  reader.onload = function (ev) {
    (async () => {
      try {
        const data = JSON.parse(ev.target.result);
        await restoreFromBackup(data);
        await loadAllData();

        // Refresh all visible UI
        const { updateDashboard } = await import('./dashboard.js');
        const { renderClients }   = await import('./clients.js');
        const { renderProducts }  = await import('./products.js');
        const { renderInvoicesList } = await import('./invoice.js');

        updateDashboard();
        renderClients();
        renderProducts();
        renderInvoicesList();

        showToast('Data restored!', 'success', true);
        closeModalDirect();
      } catch (err) {
        showToast('Invalid or corrupt backup file!', 'error');
        console.error('[Backup] Restore error:', err);
      }
    })();
  };
  reader.readAsText(file);
}

export function clearAllData() {
  if (!confirm('WARNING: This will delete ALL data! Are you sure?')) return;
  if (!confirm('Really sure? This cannot be undone!')) return;
  clearAllAppData();
  location.reload();
}

export function setupOfflineDetection() {
  window.addEventListener('online',  () => {
    document.getElementById('offlineBar')?.classList.remove('active');
    showToast('Back online!', 'success');
  });
  window.addEventListener('offline', () => {
    document.getElementById('offlineBar')?.classList.add('active');
    showToast('You are offline', 'warning');
  });
  if (!navigator.onLine) document.getElementById('offlineBar')?.classList.add('active');
}
