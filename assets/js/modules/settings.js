/**
 * Ledgerix - Settings Module
 * v2.2: togglePIN properly removes PIN when unchecked.
 *        removePINFromSettings() exported for explicit "Remove PIN" button.
 */

'use strict';

import * as State from '../core/state.js';
import { saveSettings as _save } from '../core/storage.js';
import { showToast } from '../ui/toast.js';
import { setTheme } from '../ui/theme.js';
import { savePINToStorage, removePIN } from '../core/security.js';

export function saveSettings() {
  Object.assign(State.settings, {
    currency:   document.getElementById('settingCurrency')?.value,
    defaultGST: parseFloat(document.getElementById('settingDefaultGST')?.value) || 18,
    dateFormat: document.getElementById('settingDateFormat')?.value || 'DD/MM/YYYY',
    language:   document.getElementById('settingLanguage')?.value  || 'en',
  });
  _save();
  showToast('Settings saved!', 'success');
}

/**
 * Called when the "Enable PIN" checkbox is toggled.
 * Checked   → show the PIN setup form.
 * Unchecked → immediately remove any stored PIN and update UI.
 */
export function togglePIN() {
  const check    = document.getElementById('pinEnabled');
  const setup    = document.getElementById('pinSetup');
  const removeEl = document.getElementById('pinRemove');
  const enabled  = check?.checked;

  if (enabled) {
    // Show setup form so the user can enter their new PIN
    if (setup)    setup.style.display    = 'block';
    if (removeEl) removeEl.style.display = 'none';
  } else {
    // User unchecked → remove PIN immediately
    removePIN();
    if (setup)    setup.style.display    = 'none';
    if (removeEl) removeEl.style.display = 'none';
    showToast('PIN protection disabled', 'info');
  }
}

/**
 * Save a new 4-digit PIN entered in #newPIN.
 */
export async function savePIN() {
  if (!window.crypto || !window.crypto.subtle) {
    showToast('PIN requires a secure context (HTTPS)', 'error');
    return;
  }
  const pin = document.getElementById('newPIN')?.value;
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    showToast('Enter 4-digit PIN!', 'error');
    return;
  }
  await savePINToStorage(pin);

  // Update UI: hide setup form, show remove button
  const setup    = document.getElementById('pinSetup');
  const removeEl = document.getElementById('pinRemove');
  if (setup)    setup.style.display    = 'none';
  if (removeEl) removeEl.style.display = 'block';

  // Clear the input field
  const pinInput = document.getElementById('newPIN');
  if (pinInput) pinInput.value = '';

  showToast('PIN enabled — reload will require this PIN', 'success');
}

/**
 * Explicit "Remove PIN" action from settings UI.
 * Exported for window bridge and for settings HTML onclick.
 */
export function removePINFromSettings() {
  if (!confirm('Remove PIN protection? The app will no longer require a PIN on startup.')) return;
  removePIN();

  const check    = document.getElementById('pinEnabled');
  const setup    = document.getElementById('pinSetup');
  const removeEl = document.getElementById('pinRemove');
  if (check)    check.checked           = false;
  if (setup)    setup.style.display     = 'none';
  if (removeEl) removeEl.style.display  = 'none';

  showToast('PIN removed', 'info');
}
