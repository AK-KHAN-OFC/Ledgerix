/**
 * Ledgerix - Security Module
 * AES-GCM encryption, PBKDF2 PIN hashing, secure localStorage wrappers.
 *
 * v2.2 fixes:
 *  - checkPIN() now resolves immediately (never hangs) when:
 *      • No PIN stored
 *      • WebCrypto unavailable (fails safe — allow access)
 *      • DOM error during overlay construction
 *      • Unhandled rejection in submitPIN logic
 *  - checkPIN() returns a promise that ALWAYS resolves, never permanently rejects.
 *  - hideSplash is called BEFORE checkPIN overlay so splash is always dismissed.
 *  - PIN overlay uses only inline concrete colors (not CSS variables) to avoid
 *    token-name mismatches across theme versions.
 *  - removePIN() exported so settings.js can clear PIN on toggle-off.
 */

'use strict';

import AppConfig from '../../../config/app.config.js';

const _ENC_KEYS  = new Set(AppConfig.ENCRYPTED_KEYS);
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
        const enc2   = new TextEncoder();
        const secret = sessionStorage.getItem(AppConfig.STORAGE_KEYS.INSTALL_SECRET);
        if (!secret) return raw;
        const km = await crypto.subtle.importKey('raw', enc2.encode(secret), 'PBKDF2', false, ['deriveKey']);
        const k  = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: enc2.encode(payload.salt), iterations: AppConfig.PBKDF2_ITERATIONS, hash: 'SHA-256' },
          km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
        );
        const pt      = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(payload.iv) }, k, new Uint8Array(payload.ct));
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
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await hashPIN(pin, salt);
  localStorage.setItem(AppConfig.STORAGE_KEYS.PIN, JSON.stringify({ hash, salt }));
}

// ── PIN remove ───────────────────────────────────────────────────────────────

export function removePIN() {
  localStorage.removeItem(AppConfig.STORAGE_KEYS.PIN);
}

// ── PIN check ────────────────────────────────────────────────────────────────
//
// Design contract (v2.2):
//   - Always resolves. Never permanently rejects or hangs.
//   - If no PIN stored → resolves immediately (pass-through).
//   - If WebCrypto unavailable → resolves immediately (fail-safe, no lock).
//   - If PIN data is corrupt/unparseable → removes stale data and resolves.
//   - If DOM construction fails → logs error and resolves (don't block app).
//   - Called AFTER hideSplash in bootstrap so the splash is gone before the
//     PIN overlay appears (overlay replaces it rather than hiding behind it).
//
// The splash is dismissed first by the bootstrap; this function only shows
// the unlock screen. It does NOT control the splash lifecycle.

export function checkPIN() {
  const stored = localStorage.getItem(AppConfig.STORAGE_KEYS.PIN);

  // No PIN set — resolve immediately
  if (!stored) return Promise.resolve();

  // WebCrypto unavailable — fail open so the app doesn't hang
  if (!window.crypto || !window.crypto.subtle) {
    console.warn('[Security] checkPIN: WebCrypto unavailable, skipping PIN check');
    return Promise.resolve();
  }

  // Parse stored PIN data — if corrupt, clear and recover
  let pinData;
  try {
    pinData = JSON.parse(stored);
  } catch (e) {
    console.warn('[Security] checkPIN: corrupt PIN data, clearing');
    localStorage.removeItem(AppConfig.STORAGE_KEYS.PIN);
    return Promise.resolve();
  }

  // Legacy PIN (plain base64) — clear and recover gracefully
  if (!pinData || (!pinData.hash && !pinData.salt)) {
    console.warn('[Security] checkPIN: legacy/invalid PIN format, clearing');
    localStorage.removeItem(AppConfig.STORAGE_KEYS.PIN);
    return Promise.resolve();
  }

  // Build the PIN overlay and return a Promise that resolves when unlocked.
  // Wrap everything in try/catch — if DOM creation fails, resolve immediately.
  return new Promise((resolve) => {
    try {
      // Remove any pre-existing overlay (e.g. after hot-reload)
      document.getElementById('pinOverlay')?.remove();

      const overlay = document.createElement('div');
      overlay.id = 'pinOverlay';

      // Use concrete inline colors — NOT CSS custom properties — so the overlay
      // works regardless of which CSS version / theme variable names are active.
      overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'background:#0a1628',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'justify-content:center',
        'z-index:100001',
        'gap:14px',
        'font-family:Poppins,sans-serif',
      ].join(';');

      overlay.innerHTML = `
        <div style="width:52px;height:52px;background:#c9a84c;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#0a1628;font-family:'Playfair Display',serif">L</div>
        <h2 style="color:#c9a84c;font-family:'Playfair Display',serif;font-size:22px;margin:0">Ledgerix</h2>
        <p style="color:#8892a8;font-size:13px;margin:0">Enter your PIN to continue</p>
        <input id="pinInput" type="password" maxlength="4" inputmode="numeric" pattern="[0-9]*"
          style="background:#1a2842;border:1px solid #c9a84c;color:#f0f0f0;padding:10px 20px;border-radius:6px;font-size:22px;text-align:center;letter-spacing:8px;width:180px;outline:none;font-family:monospace"
          placeholder="••••" autocomplete="off">
        <p id="pinError" style="color:#e74c3c;font-size:12px;min-height:18px;margin:0"></p>
        <button id="pinUnlockBtn"
          style="background:#c9a84c;color:#0a1628;border:none;padding:10px 28px;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer;font-family:Poppins,sans-serif">
          Unlock
        </button>
        <button id="pinForgotBtn"
          style="background:transparent;color:#8892a8;border:none;font-size:11px;cursor:pointer;text-decoration:underline;font-family:Poppins,sans-serif;margin-top:-6px">
          Forgot PIN? Reset app data
        </button>
      `;

      document.body.appendChild(overlay);

      const inputEl      = overlay.querySelector('#pinInput');
      const errorEl      = overlay.querySelector('#pinError');
      const unlockBtn    = overlay.querySelector('#pinUnlockBtn');
      const forgotBtn    = overlay.querySelector('#pinForgotBtn');

      inputEl.focus();

      async function submitPIN() {
        const entered = inputEl.value;
        if (!/^\d{4}$/.test(entered)) {
          errorEl.textContent = 'Enter 4-digit PIN';
          return;
        }
        errorEl.textContent = '';
        unlockBtn.disabled  = true;
        unlockBtn.textContent = 'Checking...';

        try {
          let ok = false;
          if (pinData.hash && pinData.salt) {
            const hash = await hashPIN(entered, pinData.salt);
            ok = (hash === pinData.hash);
          } else {
            // Legacy base64 path (should have been cleared above, safety net)
            try { ok = (atob(stored) === entered); } catch (_) { ok = false; }
            if (ok) await savePINToStorage(entered); // migrate to v2 hash
          }

          if (ok) {
            overlay.remove();
            resolve();
          } else {
            errorEl.textContent     = 'Incorrect PIN. Try again.';
            inputEl.value           = '';
            unlockBtn.disabled      = false;
            unlockBtn.textContent   = 'Unlock';
            inputEl.focus();
          }
        } catch (err) {
          console.error('[Security] PIN verify error:', err);
          errorEl.textContent   = 'Error checking PIN. Try again.';
          unlockBtn.disabled    = false;
          unlockBtn.textContent = 'Unlock';
        }
      }

      inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') submitPIN(); });
      unlockBtn.addEventListener('click', submitPIN);

      forgotBtn.addEventListener('click', () => {
        if (!confirm('This will delete ALL stored data including invoices and clients. Are you sure?')) return;
        if (!confirm('Really delete all data and reset the PIN?')) return;
        // Clear everything and reload fresh
        try { localStorage.clear(); } catch (_) {}
        try { sessionStorage.clear(); } catch (_) {}
        overlay.remove();
        resolve(); // let the app mount on a clean slate
        location.reload();
      });

    } catch (domErr) {
      // DOM construction failed — resolve so the app is not permanently locked
      console.error('[Security] checkPIN: overlay construction failed, skipping PIN', domErr);
      resolve();
    }
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
