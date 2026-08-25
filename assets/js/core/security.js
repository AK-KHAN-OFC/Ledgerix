/**
 * Ledgerix - Security Module
 * AES-GCM encryption, PBKDF2 PIN hashing, secure localStorage wrappers.
 */

'use strict';

import AppConfig from '../../../config/app.config.js';

const _ENC_KEYS = new Set(AppConfig.ENCRYPTED_KEYS);
const _KEY_CACHE = {};

// ── PBKDF2 session key (derived once per session) ────────────────────────────

async function _getSessionKey() {
  if (_KEY_CACHE['__session__']) return _KEY_CACHE['__session__'];
  if (!window.crypto || !window.crypto.subtle) throw new Error('WebCrypto unavailable');

  let installSecret = sessionStorage.getItem(AppConfig.STORAGE_KEYS.INSTALL_SECRET);
  if (!installSecret) {
    installSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(AppConfig.STORAGE_KEYS.INSTALL_SECRET, installSecret);
  }

  const enc    = new TextEncoder();
  const keyMat = await crypto.subtle.importKey('raw', enc.encode(installSecret), 'PBKDF2', false, ['deriveKey']);
  const key    = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ledgerix-v2-stable'), iterations: AppConfig.PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMat, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
  _KEY_CACHE['__session__'] = key;
  return key;
}

// ── Encrypted localStorage read/write ────────────────────────────────────────

export async function encStore(name, value) {
  if (!_ENC_KEYS.has(name)) { localStorage.setItem(name, value); return; }
  if (!window.crypto || !window.crypto.subtle) { localStorage.setItem(name, value); return; }

  try {
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const key = await _getSessionKey();
    const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
    const payload = { v: 2, iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) };
    localStorage.setItem(name, JSON.stringify(payload));
  } catch (e) {
    console.warn('[Security] encStore failed for', name, e);
    localStorage.setItem(name, value);
  }
}

export async function decStore(name, fallback = null) {
  const raw = localStorage.getItem(name);
  if (!raw) return fallback;
  if (!_ENC_KEYS.has(name)) return raw;
  if (!window.crypto || !window.crypto.subtle) return raw;

  try {
    const payload = JSON.parse(raw);
    if (!payload || payload.v !== 2) {
      // v1 migration: per-write salt scheme
      if (payload && payload.v === 1 && payload.salt) {
        const enc2 = new TextEncoder();
        const secret = sessionStorage.getItem(AppConfig.STORAGE_KEYS.INSTALL_SECRET);
        if (!secret) return raw;
        const km = await crypto.subtle.importKey('raw', enc2.encode(secret), 'PBKDF2', false, ['deriveKey']);
        const k  = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: enc2.encode(payload.salt), iterations: AppConfig.PBKDF2_ITERATIONS, hash: 'SHA-256' },
          km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
        );
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(payload.iv) }, k, new Uint8Array(payload.ct));
        const decoded = new TextDecoder().decode(pt);
        await encStore(name, decoded); // migrate to v2
        return decoded;
      }
      return raw;
    }
    const key = await _getSessionKey();
    const pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(payload.iv) }, key, new Uint8Array(payload.ct));
    return new TextDecoder().decode(pt);
  } catch (e) {
    return raw;
  }
}

// ── PIN hashing ──────────────────────────────────────────────────────────────

export async function hashPIN(pin, salt) {
  if (!window.crypto || !window.crypto.subtle) throw new Error('WebCrypto unavailable');
  const enc    = new TextEncoder();
  const keyMat = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits   = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: AppConfig.PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMat, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── PIN save ─────────────────────────────────────────────────────────────────

export async function savePINToStorage(pin) {
  const salt    = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const hash    = await hashPIN(pin, salt);
  localStorage.setItem(AppConfig.STORAGE_KEYS.PIN, JSON.stringify({ hash, salt }));
}

// ── PIN check (renders blocking overlay) ─────────────────────────────────────

export async function checkPIN() {
  const stored = localStorage.getItem(AppConfig.STORAGE_KEYS.PIN);
  if (!stored) return;
  if (!window.crypto || !window.crypto.subtle) {
    console.warn('[Security] checkPIN: WebCrypto unavailable, skipping PIN check');
    return;
  }

  let pinData;
  try { pinData = JSON.parse(stored); } catch (e) { return; }
  const isLegacy = !pinData.hash;

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.id = 'pinOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:var(--navy);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;gap:1rem';
    overlay.innerHTML = `
      <div class="logo-icon" style="width:60px;height:60px;font-size:2rem">L</div>
      <h2 style="color:var(--gold);font-family:'Playfair Display',serif">Ledgerix</h2>
      <p style="color:var(--gray);font-size:0.9rem">Enter your PIN to continue</p>
      <input id="pinInput" type="password" maxlength="4" inputmode="numeric" pattern="[0-9]*"
        style="background:var(--navy-lighter);border:1px solid var(--gold);color:var(--white);padding:0.8rem 1.5rem;border-radius:var(--radius-md);font-size:1.5rem;text-align:center;letter-spacing:0.5rem;width:180px;outline:none"
        placeholder="••••">
      <p id="pinError" style="color:var(--danger);font-size:0.85rem;min-height:1.2em"></p>
      <button id="pinUnlockBtn" style="background:linear-gradient(135deg,var(--gold),var(--gold-dark));color:var(--navy);border:none;padding:0.7rem 2rem;border-radius:var(--radius-md);font-weight:700;font-size:1rem;cursor:pointer">Unlock</button>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('pinInput');
    input.focus();

    async function submitPIN() {
      const entered = document.getElementById('pinInput').value;
      if (!/^\d{4}$/.test(entered)) {
        document.getElementById('pinError').textContent = 'Enter 4-digit PIN';
        return;
      }
      let ok = false;
      if (isLegacy) {
        try { ok = (atob(stored) === entered); } catch (e) { ok = false; }
        if (ok) await savePINToStorage(entered); // migrate
      } else {
        const hash = await hashPIN(entered, pinData.salt);
        ok = (hash === pinData.hash);
      }
      if (ok) {
        overlay.remove();
        resolve();
      } else {
        document.getElementById('pinError').textContent = 'Incorrect PIN. Try again.';
        document.getElementById('pinInput').value = '';
        document.getElementById('pinInput').focus();
      }
    }

    input.addEventListener('keydown', e => { if (e.key === 'Enter') submitPIN(); });
    document.getElementById('pinUnlockBtn').addEventListener('click', submitPIN);
  });
}

// ── Image size guard ─────────────────────────────────────────────────────────

export function checkImageSize(dataUrl, label, showToastFn) {
  const bytes = Math.round(dataUrl.length * 0.75);
  if (bytes > AppConfig.IMG_MAX_BYTES) {
    showToastFn(`${label} is too large (>${Math.round(AppConfig.IMG_MAX_BYTES / 1024)} KB). Please resize first.`, 'error');
    return false;
  }
  if (bytes > AppConfig.IMG_WARN_BYTES) {
    showToastFn(`${label} is large (${Math.round(bytes / 1024)} KB) — may approach storage limit.`, 'warning');
  }
  return true;
}
