/**
 * Ledgerix - Storage Service
 * SINGLE SOURCE OF TRUTH for all application persistence.
 * All localStorage operations go through this module — no other module
 * may directly call localStorage.getItem / setItem / removeItem / clear.
 *
 * Encrypted keys are transparently handled by security.js (AES-GCM).
 * Existing data format is 100% preserved; no schema migration is introduced.
 */

'use strict';

import AppConfig from '../../../config/app.config.js';
import { encStore, decStore } from './security.js';
import * as State from './state.js';

const K = AppConfig.STORAGE_KEYS;

// ── Load all data from localStorage into State ────────────────────────────────

export async function loadAllData() {
  try {
    const rawClients  = await decStore(K.CLIENTS,  '[]');
    const rawInvoices = await decStore(K.INVOICES, '[]');
    const rawProfile  = await decStore(K.PROFILE,  '{}');
    const rawDraft    = await decStore(K.INVOICE_DRAFT, null);

    const rawNotifs  = JSON.parse(localStorage.getItem(K.NOTIFICATIONS) || '[]');
    const validTypes = AppConfig.NOTIF_TYPES;

    State.setClients(JSON.parse(rawClients));
    State.setProducts(JSON.parse(localStorage.getItem(K.PRODUCTS) || '[]'));
    State.setSavedInvoices(JSON.parse(rawInvoices));
    State.setProfile(JSON.parse(rawProfile));
    State.setSettings(JSON.parse(localStorage.getItem(K.SETTINGS) || '{}'));
    State.setInvoiceCounter(parseInt(localStorage.getItem(K.INV_COUNTER) || '1'));
    State.setCalcHistory(JSON.parse(localStorage.getItem(K.CALC_HISTORY) || '[]'));

    // Sanitise notification types
    State.setNotifications(rawNotifs.map(n => ({
      ...n, type: validTypes.has(n.type) ? n.type : 'info'
    })));

    // Apply saved theme silently
    if (State.settings.theme) {
      const { setTheme } = await import('../ui/theme.js');
      setTheme(State.settings.theme, true);
    }

    // Apply saved language
    if (State.settings.language) {
      const el = document.getElementById('settingLanguage');
      if (el) el.value = State.settings.language;
    }

    // Apply currency
    if (State.settings.currency) {
      const el = document.getElementById('settingCurrency');
      if (el) el.value = State.settings.currency;
    }

    // Restore invoice draft
    if (rawDraft) {
      try {
        const draft = JSON.parse(rawDraft);
        _applyDraft(draft);
      } catch (e) { /* ignore corrupt draft */ }
    }

    // Populate profile form if already visible
    const { loadProfileForm } = await import('../modules/profile.js');
    loadProfileForm();

  } catch (e) {
    console.error('[Storage] Load error:', e);
  }
}

function _applyDraft(draft) {
  const fields = ['invClient','invClientAddr','invClientGSTIN','invClientPhone','invClientEmail',
                  'invNumber','invDate','invDueDate','invPaymentStatus','invPaymentMethod',
                  'invTaxType','invShipping','invPackaging','invHandling','invTerms','invNotes'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el && draft[_fieldKey(id)] !== undefined) el.value = draft[_fieldKey(id)];
  });
  if (draft.items) {
    State.setItems(draft.items);
  }
}

function _fieldKey(id) {
  const map = {
    invClient:'client', invClientAddr:'clientAddr', invClientGSTIN:'clientGSTIN',
    invClientPhone:'clientPhone', invClientEmail:'clientEmail', invNumber:'invNum',
    invDate:'invDate', invDueDate:'dueDate', invPaymentStatus:'paymentStatus',
    invPaymentMethod:'paymentMethod', invTaxType:'taxType', invShipping:'shipping',
    invPackaging:'packaging', invHandling:'handling', invTerms:'terms', invNotes:'notes',
  };
  return map[id] || id;
}

// ── Individual save helpers ────────────────────────────────────────────────────

export async function saveClients() {
  await encStore(K.CLIENTS, JSON.stringify(State.clients));
}

export function saveProducts() {
  localStorage.setItem(K.PRODUCTS, JSON.stringify(State.products));
}

export async function saveInvoices() {
  await encStore(K.INVOICES, JSON.stringify(State.savedInvoices));
}

export async function saveProfile() {
  await encStore(K.PROFILE, JSON.stringify(State.profile));
}

export function saveSettings() {
  localStorage.setItem(K.SETTINGS, JSON.stringify(State.settings));
}

export function saveNotifications() {
  localStorage.setItem(K.NOTIFICATIONS, JSON.stringify(State.notifications));
}

export function saveCalcHistory() {
  localStorage.setItem(K.CALC_HISTORY, JSON.stringify(State.calcHistory));
}

export function saveInvoiceCounter() {
  localStorage.setItem(K.INV_COUNTER, State.invoiceCounter);
}

export async function saveDraft(draft) {
  await encStore(K.INVOICE_DRAFT, JSON.stringify(draft));
}

export function clearDraft() {
  localStorage.removeItem(K.INVOICE_DRAFT);
}

// ── Reminder fired-today tracking (isolated, date-keyed) ──────────────────────
// Keeps notification.js from touching localStorage directly.

export function loadRemindersFiredToday(dateStr) {
  const key = AppConfig.STORAGE_KEYS.REMINDERS_PREFIX + dateStr;
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch (e) {
    return new Set();
  }
}

export function saveRemindersFiredToday(dateStr, firedSet) {
  const key = AppConfig.STORAGE_KEYS.REMINDERS_PREFIX + dateStr;
  localStorage.setItem(key, JSON.stringify([...firedSet]));
  // Purge stale reminder keys from other days
  Object.keys(localStorage)
    .filter(k => k.startsWith(AppConfig.STORAGE_KEYS.REMINDERS_PREFIX) && k !== key)
    .forEach(k => localStorage.removeItem(k));
}

// ── Returning-user detection (for splash timing) ──────────────────────────────
// Replaces direct localStorage.getItem in navigation.js.

export function isReturningUser() {
  return !!localStorage.getItem(K.INV_COUNTER);
}

// ── Clear all known app data ──────────────────────────────────────────────────

export function clearAllAppData() {
  const appKeys = Object.values(K);
  appKeys.forEach(k => localStorage.removeItem(k));
  Object.keys(localStorage)
    .filter(k => k.startsWith(AppConfig.STORAGE_KEYS.REMINDERS_PREFIX))
    .forEach(k => localStorage.removeItem(k));
}

// ── Restore from backup (with schema validation + key whitelisting) ────────────

export async function restoreFromBackup(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('Invalid backup root');

  const arrFields = ['clients','products','savedInvoices','notifications'];
  arrFields.forEach(f => {
    if (data[f] !== undefined && !Array.isArray(data[f])) throw new Error(`Invalid field: ${f}`);
  });
  ['profile','settings'].forEach(f => {
    if (data[f] !== undefined && (typeof data[f] !== 'object' || Array.isArray(data[f]))) throw new Error(`Invalid field: ${f}`);
  });
  if (data.invoiceCounter !== undefined &&
      (typeof data.invoiceCounter !== 'number' || !Number.isInteger(data.invoiceCounter) || data.invoiceCounter < 0)) {
    throw new Error('Invalid invoiceCounter');
  }

  function pickKeys(obj, allowed) {
    const out = {};
    allowed.forEach(k => { if (k in obj) out[k] = obj[k]; });
    return out;
  }

  if (data.clients)       await encStore(K.CLIENTS,    JSON.stringify(data.clients));
  if (data.products)      localStorage.setItem(K.PRODUCTS, JSON.stringify(data.products));
  if (data.savedInvoices) await encStore(K.INVOICES,   JSON.stringify(data.savedInvoices));
  if (data.profile)       await encStore(K.PROFILE,    JSON.stringify(pickKeys(data.profile, AppConfig.ALLOWED_PROFILE_KEYS)));
  if (data.settings)      localStorage.setItem(K.SETTINGS, JSON.stringify(pickKeys(data.settings, AppConfig.ALLOWED_SETTINGS_KEYS)));
  if (data.invoiceCounter) localStorage.setItem(K.INV_COUNTER, data.invoiceCounter);
  if (data.notifications) localStorage.setItem(K.NOTIFICATIONS, JSON.stringify(data.notifications));
}
