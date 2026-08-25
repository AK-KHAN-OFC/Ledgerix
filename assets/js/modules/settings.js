/**
 * Ledgerix - Settings Module
 */

'use strict';

import * as State from '../core/state.js';
import { saveSettings as _save } from '../core/storage.js';
import { showToast } from '../ui/toast.js';
import { setTheme } from '../ui/theme.js';
import { checkPIN, savePINToStorage } from '../core/security.js';

export function saveSettings() {
  Object.assign(State.settings, {
    currency:    document.getElementById('settingCurrency')?.value,
    defaultGST:  parseFloat(document.getElementById('settingDefaultGST')?.value)  || 18,
    dateFormat:  document.getElementById('settingDateFormat')?.value || 'DD/MM/YYYY',
    language:    document.getElementById('settingLanguage')?.value   || 'en',
  });
  _save();
  showToast('Settings saved!', 'success');
}

export function togglePIN() {
  const setup = document.getElementById('pinSetup');
  const check = document.getElementById('pinEnabled');
  if (setup) setup.style.display = check?.checked ? 'block' : 'none';
}

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
  showToast('PIN set!', 'success');
}
