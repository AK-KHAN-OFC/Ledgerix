/**
 * Ledgerix - OCR Bill Scanner Module
 */

'use strict';

import * as State from '../core/state.js';
import { nextId } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { esc } from '../utils/helpers.js';

let _tesseractPromise = null;

async function _loadTesseract() {
  if (window.Tesseract) return true;
  if (_tesseractPromise) return _tesseractPromise;
  _tesseractPromise = new Promise((resolve, reject) => {
    const s   = document.createElement('script');
    s.src     = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload  = () => resolve(true);
    s.onerror = () => { _tesseractPromise = null; reject(new Error('Failed to load Tesseract')); };
    document.head.appendChild(s);
  });
  return _tesseractPromise;
}

export function handleOCRUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function (ev) {
    State.setOcrImageData(ev.target.result);
    const img = document.getElementById('ocrPreviewImg');
    if (img) img.src = ev.target.result;
    document.getElementById('ocrPreviewSection')?.style.setProperty('display','block');

    const zone = document.getElementById('ocrUploadZone');
    if (zone) {
      const icon = zone.querySelector('i');
      const h3   = zone.querySelector('h3');
      const p    = zone.querySelector('p');
      if (icon) icon.className = 'fas fa-check-circle';
      if (h3)   h3.textContent = file.name;
      if (p)    p.textContent  = 'Image ready for scanning';
    }
    setOCRStatus('Image loaded. Click "Start Scanning" to extract data.', 'neutral');
  };
  reader.readAsDataURL(file);
}

export async function startOCRScan() {
  if (!State.ocrImageData) { showToast('Please upload an image first', 'error'); return; }
  if (!window.Tesseract) {
    try {
      setOCRStatus('Loading OCR engine...', 'scanning');
      await _loadTesseract();
    } catch (e) {
      showToast('OCR library failed to load. Check internet.', 'error');
      return;
    }
  }

  setOCRStatus('Initializing scanner...', 'scanning');
  document.getElementById('ocrProgressWrap')?.style.setProperty('display','block');

  try {
    const result = await Tesseract.recognize(State.ocrImageData, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          setOCRStatus('Reading text... ' + Math.round(m.progress * 100) + '%', 'scanning');
          setOCRProgress(Math.round(m.progress * 100));
        }
      },
    });
    setOCRStatus('Scan complete! Parsing data...', 'scanning');
    parseOCRText(result.data.text);
    setOCRStatus('Data extracted successfully! Review and create invoice.', 'success');
  } catch (err) {
    console.error('[OCR] Scan failed:', err);
    setOCRStatus('Scan failed: ' + (err.message || 'Unknown error'), 'error');
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
  el.innerHTML = icons[type] || icons.neutral;
  const span = document.createElement('span');
  span.textContent = ' ' + msg;
  el.appendChild(span);
}

export function setOCRProgress(pct) {
  const bar = document.getElementById('ocrProgressBar');
  if (bar) bar.style.width = pct + '%';
}

function parseOCRText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);

  // Vendor detection
  State.setOcrDetectedVendor(lines[0] || '');

  // GSTIN
  const gstMatch = text.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/);
  State.setOcrDetectedGSTIN(gstMatch ? gstMatch[0] : '');

  // Date
  const dateMatch = text.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
  State.setOcrDetectedDate(dateMatch ? parseOCRDate(dateMatch[1]) : '');

  // Bill number
  const billMatch = text.match(/(?:bill|invoice|inv|no|#)[:\s#]*([A-Z0-9\-\/]+)/i);
  State.setOcrDetectedBillNo(billMatch ? billMatch[1] : '');

  // Items — look for lines with amounts
  const items = [];
  // amountRegex removed — Fix 32: declared but never used
  lines.forEach(line => {
    const priceMatch = line.match(/(\d+[\.,]?\d*)\s*$/);
    if (priceMatch && parseFloat(priceMatch[1]) > 0) {
      const name = line.replace(priceMatch[0], '').trim();
      if (name.length > 2) {
        items.push({
          id: nextId(), desc: name, hsn: '', qty: 1,
          rate: parseFloat(priceMatch[1].replace(',', '')),
          gst: State.settings.defaultGST || 18, disc: 0,
        });
      }
    }
  });
  State.setOcrDetectedItems(items);

  renderOCRResults();
}

function parseOCRDate(dateStr) {
  try {
    const d = dateStr.replace(/\./g, '/').replace(/-/g, '/');
    const parts = d.split('/');
    if (parts.length === 3) {
      let y = parseInt(parts[2]);
      if (y < 50) y += 2000; else if (y < 100) y += 1900;
      let month = parseInt(parts[1]);
      let day   = parseInt(parts[0]);
      if (month > 12) { month = parseInt(parts[0]); day = parseInt(parts[1]); }
      if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error('invalid components');
      return `${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
  } catch (e) {
    console.warn('[OCR] parseOCRDate: could not parse', JSON.stringify(dateStr), e);
  }
  return '';
}

function renderOCRResults() {
  const el = document.getElementById('ocrVendorName');      if (el) el.value = State.ocrDetectedVendor;
  const g  = document.getElementById('ocrDetectedGSTIN');   if (g)  g.value  = State.ocrDetectedGSTIN;
  const d  = document.getElementById('ocrDetectedDate');    if (d)  d.value  = State.ocrDetectedDate;
  const b  = document.getElementById('ocrDetectedBillNo');  if (b)  b.value  = State.ocrDetectedBillNo;
  renderOCRItems();
  updateOCRCalculations();
  document.getElementById('ocrResultsSection')?.style.setProperty('display','block');
}

export function renderOCRItems() {
  const tbody = document.getElementById('ocrItemsBody');
  if (!tbody) return;
  tbody.innerHTML = State.ocrDetectedItems.map((it, idx) => `
    <tr>
      <td><input type="text"   value="${esc(it.desc)}"         onchange="window._ledgerix.ocr.updateOCRItem(${idx},'desc',this.value)"  placeholder="Product name"></td>
      <td><input type="text"   value="${esc(String(it.qty))}"  onchange="window._ledgerix.ocr.updateOCRItem(${idx},'qty',this.value)"   min="1" style="text-align:center"></td>
      <td><input type="number" value="${esc(String(it.rate))}" onchange="window._ledgerix.ocr.updateOCRItem(${idx},'rate',this.value)"  min="0" style="text-align:right"></td>
      <td><input type="number" value="${esc(String(it.gst))}"  onchange="window._ledgerix.ocr.updateOCRItem(${idx},'gst',this.value)"   min="0" max="28" style="text-align:center"></td>
      <td><button class="btn btn-danger btn-sm" onclick="window._ledgerix.ocr.removeOCRItem(${idx})"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('');
}

export function addOCRItem() {
  State.ocrDetectedItems.push({ id: nextId(), desc: '', hsn: '', qty: 1, rate: 0, gst: State.settings.defaultGST || 18, disc: 0 });
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
  State.ocrDetectedItems[idx][field] = ['qty','rate','gst','disc'].includes(field) ? parseFloat(value)||0 : value;
  updateOCRCalculations();
}

export function updateOCRCalculations() {
  let subtotal = 0, totalGST = 0;
  State.ocrDetectedItems.forEach(it => {
    const amt = (it.qty * it.rate) * (1 - (it.disc||0)/100);
    subtotal += amt;
    totalGST += amt * (it.gst / 100);
  });
  const sub = document.getElementById('ocrSubtotal');
  const tax = document.getElementById('ocrTotalGST');
  const grd = document.getElementById('ocrGrandTotal');
  if (sub) sub.value = subtotal.toFixed(2);
  if (tax) tax.value = totalGST.toFixed(2);
  if (grd) grd.value = (subtotal + totalGST).toFixed(2);
}

export function createInvoiceFromOCR() {
  if (State.ocrDetectedItems.length === 0) { showToast('No items to create invoice', 'error'); return; }
  if (State.items.length > 0 && !confirm('This will replace your current invoice items. Continue?')) return;

  import('../ui/navigation.js').then(m => m.switchTab('invoice'));

  setTimeout(() => {
    const vendor = document.getElementById('ocrVendorName')?.value.trim();
    if (vendor) { const el = document.getElementById('invClient'); if (el) el.value = vendor; }

    const gstin = document.getElementById('ocrDetectedGSTIN')?.value.trim();
    if (gstin)  { const el = document.getElementById('invClientGSTIN'); if (el) el.value = gstin; }

    const date  = document.getElementById('ocrDetectedDate')?.value.trim();
    if (date)   { const el = document.getElementById('invDate'); if (el) el.value = date; }

    const billNo = document.getElementById('ocrDetectedBillNo')?.value.trim();
    if (billNo)  { const el = document.getElementById('invNumber'); if (el) el.value = billNo; }

    State.setItems(State.ocrDetectedItems.map(it => ({ ...it, id: nextId() })));
    import('./invoice.js').then(m => m.renderItems());
  }, 200);
}

export function clearOCR() {
  State.setOcrImageData(null);
  State.setOcrDetectedItems([]);
  State.setOcrDetectedVendor('');
  State.setOcrDetectedGSTIN('');
  State.setOcrDetectedDate('');
  State.setOcrDetectedBillNo('');

  document.getElementById('ocrPreviewSection')?.style.setProperty('display','none');
  document.getElementById('ocrResultsSection')?.style.setProperty('display','none');
  document.getElementById('ocrProgressWrap')?.style.setProperty('display','none');

  const zone = document.getElementById('ocrUploadZone');
  if (zone) {
    const icon = zone.querySelector('i'); const h3 = zone.querySelector('h3'); const p = zone.querySelector('p');
    if (icon) icon.className = 'fas fa-cloud-upload-alt';
    if (h3)   h3.textContent = 'Click to Upload Bill Image';
    if (p)    p.textContent  = 'Supports JPG, PNG, WEBP';
  }
  setOCRStatus('Waiting for image...', 'neutral');
}
