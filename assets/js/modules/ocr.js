/**
 * Ledgerix - OCR Bill Scanner Module
 * v2.4 fixes:
 *
 * 1. btnStartOCR was permanently `disabled` — handleOCRUpload now enables it.
 * 2. DOM ID mismatches fixed:
 *    ocrPreviewSection → no wrapper (img is directly in zone, display managed via ocrPreviewImg)
 *    ocrResultsSection → ocrDetectedPanel
 *    ocrDetectedDate   → ocrBillDate
 *    ocrDetectedBillNo → ocrBillNumber
 * 3. Tesseract.js v5 API incompatibility fixed:
 *    v4 API: Tesseract.recognize(image, lang) — REMOVED in v5
 *    v5 API: createWorker() → worker.recognize(image) — required
 *    Pinned to tesseract.js@4.1.1 which still exposes the simple recognize() API
 *    AND works on GitHub Pages (CDN workers, no local file needed).
 * 4. ocrGSTINBox shown/hidden based on whether GSTIN was detected.
 * 5. Error state now always shows a useful message and cleans up loading state.
 */

'use strict';

import * as State from '../core/state.js';
import { nextId } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { esc } from '../utils/helpers.js';

let _tesseractPromise = null;

// Tesseract.js v4.1.1 — exposes global Tesseract.recognize() — compatible with GitHub Pages CDN
const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/tesseract.min.js';

async function _loadTesseract() {
  if (window.Tesseract && typeof window.Tesseract.recognize === 'function') return true;
  if (_tesseractPromise) return _tesseractPromise;

  _tesseractPromise = new Promise((resolve, reject) => {
    const s    = document.createElement('script');
    s.src      = TESSERACT_CDN;
    s.onload   = () => {
      if (window.Tesseract && typeof window.Tesseract.recognize === 'function') {
        resolve(true);
      } else {
        _tesseractPromise = null;
        reject(new Error('Tesseract loaded but recognize() not available'));
      }
    };
    s.onerror  = () => {
      _tesseractPromise = null;
      reject(new Error('Failed to load Tesseract from CDN'));
    };
    document.head.appendChild(s);
  });
  return _tesseractPromise;
}

export function handleOCRUpload(e) {
  const file = e && e.target && e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (ev) {
    State.setOcrImageData(ev.target.result);

    // Show preview image
    const img = document.getElementById('ocrPreviewImg');
    if (img) {
      img.src           = ev.target.result;
      img.style.display = 'block';
    }

    // Update upload zone appearance
    const zone = document.getElementById('ocrUploadZone');
    if (zone) {
      const icon = zone.querySelector('i.fas');
      const h3   = zone.querySelector('h3');
      const p    = zone.querySelector('p');
      if (icon) icon.className  = 'fas fa-check-circle';
      if (h3)   h3.textContent  = file.name;
      if (p)    p.textContent   = `${(file.size / 1024).toFixed(0)} KB — ready to scan`;
      zone.classList.add('has-image');
    }

    // Enable the Start Scanning button
    const btn = document.getElementById('btnStartOCR');
    if (btn) btn.disabled = false;

    setOCRStatus('Image loaded. Click "Start Scanning" to extract data.', 'neutral');
  };

  reader.onerror = function () {
    setOCRStatus('Failed to read image file.', 'error');
    showToast('Could not read the image file', 'error');
  };

  reader.readAsDataURL(file);
}

export async function startOCRScan() {
  if (!State.ocrImageData) {
    showToast('Please upload an image first', 'warning');
    return;
  }

  const btn = document.getElementById('btnStartOCR');

  // Disable button during scan
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...'; }

  // Show progress bar
  const progressWrap = document.getElementById('ocrProgressWrap');
  if (progressWrap) progressWrap.style.display = 'block';
  setOCRProgress(0);

  try {
    // Load Tesseract if not already available
    if (!window.Tesseract || typeof window.Tesseract.recognize !== 'function') {
      setOCRStatus('Loading OCR engine...', 'scanning');
      await _loadTesseract();
    }

    setOCRStatus('Initializing scanner...', 'scanning');

    const result = await Tesseract.recognize(State.ocrImageData, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          setOCRStatus(`Reading text... ${pct}%`, 'scanning');
          setOCRProgress(pct);
        } else if (m.status === 'loading language traineddata') {
          setOCRStatus('Loading language data...', 'scanning');
          setOCRProgress(20);
        } else if (m.status === 'initializing api') {
          setOCRStatus('Initializing OCR engine...', 'scanning');
          setOCRProgress(10);
        }
      },
    });

    setOCRProgress(100);
    setOCRStatus('Scan complete! Parsing data...', 'scanning');
    parseOCRText(result.data.text);
    setOCRStatus('Data extracted. Review details and create invoice.', 'success');

  } catch (err) {
    console.error('[OCR] Scan failed:', err);
    const msg = err && err.message ? err.message : 'Unknown error';
    setOCRStatus(`Scan failed: ${msg}`, 'error');
    showToast('OCR scan failed. Check internet connection and try again.', 'error');
    if (progressWrap) progressWrap.style.display = 'none';
  } finally {
    // Always restore button state
    if (btn) {
      btn.disabled    = false;
      btn.innerHTML   = '<i class="fas fa-bolt"></i> Start Scanning';
    }
  }
}

export function setOCRStatus(msg, type) {
  const el = document.getElementById('ocrStatus');
  if (!el) return;
  el.className = 'ocr-status ' + (type || '');
  const icons = {
    scanning: '<i class="fas fa-spinner fa-spin"></i>',
    success:  '<i class="fas fa-check-circle"></i>',
    error:    '<i class="fas fa-times-circle"></i>',
    neutral:  '<i class="fas fa-hourglass-start"></i>',
  };
  el.innerHTML = (icons[type] || icons.neutral) + ' <span>' + msg + '</span>';
}

export function setOCRProgress(pct) {
  const bar = document.getElementById('ocrProgressBar');
  if (bar) bar.style.width = Math.min(100, Math.max(0, pct)) + '%';
}

function parseOCRText(text) {
  if (!text || !text.trim()) {
    setOCRStatus('No text detected in image. Try a clearer photo.', 'error');
    return;
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);

  // Vendor — first non-empty line
  State.setOcrDetectedVendor(lines[0] || '');

  // GSTIN pattern
  const gstMatch = text.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/);
  State.setOcrDetectedGSTIN(gstMatch ? gstMatch[0] : '');

  // Date
  const dateMatch = text.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
  State.setOcrDetectedDate(dateMatch ? _parseOCRDate(dateMatch[1]) : '');

  // Bill number
  const billMatch = text.match(/(?:bill|invoice|inv|no|#)[:\s#]*([A-Z0-9\-\/]+)/i);
  State.setOcrDetectedBillNo(billMatch ? billMatch[1] : '');

  // Items — lines that end with a number (price)
  const items = [];
  lines.forEach(line => {
    const priceMatch = line.match(/(\d+[\.,]?\d*)\s*$/);
    if (priceMatch && parseFloat(priceMatch[1]) > 0) {
      const name = line.replace(priceMatch[0], '').replace(/[:\-|]+$/, '').trim();
      if (name.length > 2 && !/^(total|subtotal|gst|tax|cgst|sgst|igst|amount|price|rate|qty|rs|inr)/i.test(name)) {
        items.push({
          id: nextId(), desc: name, hsn: '', qty: 1,
          rate: parseFloat(priceMatch[1].replace(',', '')),
          gst: State.settings?.defaultGST || 18, disc: 0,
        });
      }
    }
  });
  State.setOcrDetectedItems(items);

  _renderOCRResults();
}

function _parseOCRDate(dateStr) {
  try {
    const d      = dateStr.replace(/\./g, '/').replace(/-/g, '/');
    const parts  = d.split('/');
    if (parts.length === 3) {
      let y     = parseInt(parts[2]);
      if (y < 50) y += 2000; else if (y < 100) y += 1900;
      let month = parseInt(parts[1]);
      let day   = parseInt(parts[0]);
      if (month > 12) { [month, day] = [day, month]; }
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      }
    }
  } catch (e) {
    // ignore unparseable date
  }
  return '';
}

function _renderOCRResults() {
  // Populate vendor name
  const vendorEl = document.getElementById('ocrVendorName');
  if (vendorEl) vendorEl.value = State.ocrDetectedVendor;

  // GSTIN — show/hide box
  const gstinEl  = document.getElementById('ocrDetectedGSTIN');
  const gstinBox = document.getElementById('ocrGSTINBox');
  if (gstinEl) gstinEl.value = State.ocrDetectedGSTIN;
  if (gstinBox) gstinBox.style.display = State.ocrDetectedGSTIN ? 'flex' : 'none';

  // Date (HTML id: ocrBillDate, was ocrDetectedDate)
  const dateEl = document.getElementById('ocrBillDate');
  if (dateEl) dateEl.value = State.ocrDetectedDate;

  // Bill number (HTML id: ocrBillNumber, was ocrDetectedBillNo)
  const billNoEl = document.getElementById('ocrBillNumber');
  if (billNoEl) billNoEl.value = State.ocrDetectedBillNo;

  // Items table
  renderOCRItems();
  updateOCRCalculations();

  // Show detected panel (HTML id: ocrDetectedPanel, was ocrResultsSection)
  const panel     = document.getElementById('ocrDetectedPanel');
  const emptyState = document.getElementById('ocrEmptyState');
  if (panel)      panel.style.display      = 'block';
  if (emptyState) emptyState.style.display = 'none';
}

export function renderOCRItems() {
  const tbody = document.getElementById('ocrItemsBody');
  if (!tbody) return;
  if (State.ocrDetectedItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--c-text-mute);padding:1rem">No items detected</td></tr>';
    return;
  }
  tbody.innerHTML = State.ocrDetectedItems.map((it, idx) => `
    <tr>
      <td><input type="text"   value="${esc(it.desc)}"         onchange="window._ledgerix.ocr.updateOCRItem(${idx},'desc',this.value)"  placeholder="Product name"></td>
      <td><input type="number" value="${esc(String(it.qty))}"  onchange="window._ledgerix.ocr.updateOCRItem(${idx},'qty',this.value)"   min="1" style="text-align:center"></td>
      <td><input type="number" value="${esc(String(it.rate))}" onchange="window._ledgerix.ocr.updateOCRItem(${idx},'rate',this.value)"  min="0" style="text-align:right"></td>
      <td><input type="number" value="${esc(String(it.gst))}"  onchange="window._ledgerix.ocr.updateOCRItem(${idx},'gst',this.value)"   min="0" max="28" style="text-align:center"></td>
      <td><button class="btn btn-danger btn-sm" onclick="window._ledgerix.ocr.removeOCRItem(${idx})"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('');
}

export function addOCRItem() {
  State.ocrDetectedItems.push({
    id: nextId(), desc: '', hsn: '', qty: 1,
    rate: 0, gst: State.settings?.defaultGST || 18, disc: 0,
  });
  renderOCRItems();
  updateOCRCalculations();
}

export function removeOCRItem(idx) {
  State.ocrDetectedItems.splice(idx, 1);
  renderOCRItems();
  updateOCRCalculations();
}

export function updateOCRItem(idx, field, value) {
  if (!State.ocrDetectedItems[idx]) return;
  State.ocrDetectedItems[idx][field] = ['qty','rate','gst','disc'].includes(field)
    ? parseFloat(value) || 0
    : value;
  updateOCRCalculations();
}

export function updateOCRCalculations() {
  let subtotal = 0, totalGST = 0;
  State.ocrDetectedItems.forEach(it => {
    const amt = (it.qty * it.rate) * (1 - (it.disc || 0) / 100);
    subtotal  += amt;
    totalGST  += amt * (it.gst / 100);
  });
  const sub = document.getElementById('ocrSubtotal');
  const tax = document.getElementById('ocrTotalGST');
  const grd = document.getElementById('ocrGrandTotal');
  if (sub) sub.value = subtotal.toFixed(2);
  if (tax) tax.value = totalGST.toFixed(2);
  if (grd) grd.value = (subtotal + totalGST).toFixed(2);
}

export function createInvoiceFromOCR() {
  if (State.ocrDetectedItems.length === 0) {
    showToast('No items to create invoice from', 'warning');
    return;
  }
  if (State.items.length > 0 && !confirm('Replace current invoice items with OCR results?')) return;

  import('../ui/navigation.js').then(m => m.switchTab('invoice'));

  setTimeout(() => {
    const vendor  = document.getElementById('ocrVendorName')?.value.trim();
    const gstin   = document.getElementById('ocrDetectedGSTIN')?.value.trim();
    const date    = document.getElementById('ocrBillDate')?.value.trim();
    const billNo  = document.getElementById('ocrBillNumber')?.value.trim();

    if (vendor) { const el = document.getElementById('invClient');      if (el) el.value = vendor; }
    if (gstin)  { const el = document.getElementById('invClientGSTIN'); if (el) el.value = gstin; }
    if (date)   { const el = document.getElementById('invDate');        if (el) el.value = date; }
    if (billNo) { const el = document.getElementById('invNumber');      if (el) el.value = billNo; }

    State.setItems(State.ocrDetectedItems.map(it => ({ ...it, id: nextId() })));
    import('./invoice.js').then(m => {
      m.renderItems();
      showToast('Invoice created from OCR scan!', 'success');
    });
  }, 200);
}

export function clearOCR() {
  State.setOcrImageData(null);
  State.setOcrDetectedItems([]);
  State.setOcrDetectedVendor('');
  State.setOcrDetectedGSTIN('');
  State.setOcrDetectedDate('');
  State.setOcrDetectedBillNo('');

  // Hide panels
  const panel     = document.getElementById('ocrDetectedPanel');
  const emptyState = document.getElementById('ocrEmptyState');
  const progressWrap = document.getElementById('ocrProgressWrap');
  if (panel)        panel.style.display      = 'none';
  if (emptyState)   emptyState.style.display = 'block';
  if (progressWrap) progressWrap.style.display = 'none';

  // Reset preview image
  const img = document.getElementById('ocrPreviewImg');
  if (img) { img.src = ''; img.style.display = 'none'; }

  // Reset upload zone
  const zone = document.getElementById('ocrUploadZone');
  if (zone) {
    const icon = zone.querySelector('i.fas');
    const h3   = zone.querySelector('h3');
    const p    = zone.querySelector('p');
    if (icon) icon.className = 'fas fa-cloud-upload-alt';
    if (h3)   h3.textContent = 'Click to Upload Bill Image';
    if (p)    p.textContent  = 'Supports JPG, PNG, WEBP';
    zone.classList.remove('has-image');
  }

  // Reset file input so same file can be re-uploaded
  const fileInput = document.getElementById('ocrFileInput');
  if (fileInput) fileInput.value = '';

  // Disable scan button
  const btn = document.getElementById('btnStartOCR');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-bolt"></i> Start Scanning'; }

  setOCRProgress(0);
  setOCRStatus('Waiting for image...', 'neutral');
}
