/**
 * Ledgerix - GST Calculator Module
 * v2.3 fix: corrected DOM ID mismatches between HTML and JS.
 *
 * HTML IDs actually used:
 *   calcAmount     (was: gstAmount)
 *   taxType        (was: gstTaxType)       — also used in invoice tab, same name is fine
 *   taxCategory    (was: gstTaxCategory)
 *   customRate     (was: gstRate when custom is active)
 *   historyList    (was: calcHistoryList)
 *   calcResults    — hidden grid, shown after first calculate
 *   calcHistoryCard — hidden card, shown when history has entries
 *   customRateGroup — hidden input for custom rate
 *
 * Effective rate: if quick-rate active → that value.
 *                 if custom rate group visible → customRate value.
 */

'use strict';

import * as State from '../core/state.js';
import { saveCalcHistory } from '../core/storage.js';
import { showToast } from '../ui/toast.js';
import { formatMoney, esc } from '../utils/helpers.js';

// Get the effective GST rate from the UI (quick button or custom input)
function _getEffectiveRate() {
  const customGroup = document.getElementById('customRateGroup');
  const isCustom    = customGroup && customGroup.style.display !== 'none';
  if (isCustom) {
    return parseFloat(document.getElementById('customRate')?.value) || 0;
  }
  // Find the active quick-rate button value
  const activeBtn = document.querySelector('.quick-rate-btn.active');
  if (activeBtn) {
    const txt = activeBtn.textContent.replace('%','').trim();
    const v   = parseFloat(txt);
    return isNaN(v) ? 0 : v;
  }
  return 18; // sensible default
}

export function setGSTType(inclusive) {
  State.setIsInclusive(inclusive);
  document.getElementById('btnExclusive')?.classList.toggle('active', !inclusive);
  document.getElementById('btnInclusive')?.classList.toggle('active',  inclusive);

  const expEl = document.getElementById('gstExplanation');
  if (expEl) {
    if (inclusive) {
      expEl.innerHTML = '<strong>Inclusive GST:</strong> GST is already <strong>INCLUDED</strong> in the amount.<br>Example: ₹11,800 incl. 18% = ₹10,000 base + ₹1,800 GST';
    } else {
      expEl.innerHTML = '<strong>Exclusive GST:</strong> GST will be <strong>ADDED</strong> to the amount.<br>Example: ₹10,000 + 18% GST = ₹11,800 final (CGST 9% + SGST 9%)';
    }
  }

  // Recalculate if there is a value already
  const amt = parseFloat(document.getElementById('calcAmount')?.value) || 0;
  if (amt > 0) calculateGST(false);
}

export function setQuickRate(rate, e) {
  document.querySelectorAll('.quick-rate-btn').forEach(b => b.classList.remove('active'));
  const customGroup = document.getElementById('customRateGroup');

  if (rate === 'custom') {
    // Show custom input, deselect all quick buttons
    if (customGroup) customGroup.style.display = 'block';
    document.getElementById('customRate')?.focus();
    return;
  }

  if (customGroup) customGroup.style.display = 'none';
  if (e && e.target) e.target.classList.add('active');

  // Recalculate immediately
  const amt = parseFloat(document.getElementById('calcAmount')?.value) || 0;
  if (amt > 0) calculateGST(false);
}

export function calculateGST(saveToHistory = true) {
  const amount      = parseFloat(document.getElementById('calcAmount')?.value) || 0;
  const rate        = _getEffectiveRate();
  const taxType     = document.getElementById('taxType')?.value     || 'intra';
  const taxCategory = document.getElementById('taxCategory')?.value || 'regular';

  if (amount <= 0) {
    if (saveToHistory) showToast('Enter a valid amount', 'error');
    return;
  }

  let base, totalGST, finalAmt;

  // Zero-rated / exempt / no-GST categories
  if (taxCategory === 'zero' || taxCategory === 'exempt' || taxCategory === 'nogst') {
    base     = amount;
    totalGST = 0;
    finalAmt = amount;
  } else if (State.isInclusive) {
    base      = amount / (1 + rate / 100);
    totalGST  = amount - base;
    finalAmt  = amount;
  } else {
    base      = amount;
    totalGST  = amount * (rate / 100);
    finalAmt  = amount + totalGST;
  }

  const cgst = taxType === 'inter' ? 0 : totalGST / 2;
  const sgst = taxType === 'inter' ? 0 : totalGST / 2;
  const igst = taxType === 'inter' ? totalGST : 0;

  // Show/hide CGST+SGST vs IGST boxes
  document.getElementById('cgstBox')?.classList.toggle('hidden', taxType === 'inter');
  document.getElementById('sgstBox')?.classList.toggle('hidden', taxType === 'inter');
  document.getElementById('igstBox')?.classList.toggle('hidden', taxType !== 'inter');

  function setEl(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  setEl('resBase',     formatMoney(base));
  setEl('resCGST',     formatMoney(cgst));
  setEl('resSGST',     formatMoney(sgst));
  setEl('resIGST',     formatMoney(igst));
  setEl('resTotalGST', formatMoney(totalGST));
  setEl('resFinal',    formatMoney(finalAmt));

  // Show the results grid (was display:none initially)
  const resultsEl = document.getElementById('calcResults');
  if (resultsEl) resultsEl.style.display = '';

  if (saveToHistory) {
    State.calcHistory.unshift({
      type:        State.isInclusive ? 'Inclusive' : 'Exclusive',
      amount, rate, base, cgst, sgst, igst, totalGST,
      final:       finalAmt, taxType, taxCategory,
      time:        new Date().toLocaleTimeString(),
    });
    if (State.calcHistory.length > 50) State.calcHistory.pop();
    saveCalcHistory();
    renderHistory();
  }
}

export function clearCalculator() {
  const amtEl = document.getElementById('calcAmount');
  if (amtEl) amtEl.value = '';

  const customEl = document.getElementById('customRate');
  if (customEl) customEl.value = '';

  const resultsEl = document.getElementById('calcResults');
  if (resultsEl) resultsEl.style.display = 'none';

  ['resBase','resCGST','resSGST','resIGST','resTotalGST','resFinal']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '₹0.00'; });
}

export function renderHistory() {
  // HTML uses id="historyList", not "calcHistoryList"
  const list = document.getElementById('historyList');
  const card = document.getElementById('calcHistoryCard');

  if (!list) return;

  if (State.calcHistory.length === 0) {
    if (card) card.style.display = 'none';
    return;
  }

  if (card) card.style.display = '';

  list.innerHTML = State.calcHistory.slice(0, 20).map((h, idx) => `
    <div class="client-card" style="cursor:pointer" onclick="window._ledgerix.gst.loadHistory(${idx})">
      <div class="card-info">
        <h4 style="font-size:0.85rem">${formatMoney(h.amount)} @ ${h.rate}% (${esc(h.type)})</h4>
        <p>${h.taxType === 'inter' ? 'IGST' : 'CGST+SGST'} · ${esc(h.time)}</p>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-weight:700;color:var(--c-gold)">${formatMoney(h.final)}</div>
        <small style="color:var(--c-text-mute)">Tax: ${formatMoney(h.totalGST)}</small>
      </div>
    </div>`).join('');
}

export function loadHistory(idx) {
  const h = State.calcHistory[idx];
  if (!h) return;
  const amtEl = document.getElementById('calcAmount');
  if (amtEl) amtEl.value = h.amount;
  setGSTType(h.type === 'Inclusive');
  // Set tax type
  const ttEl = document.getElementById('taxType');
  if (ttEl) ttEl.value = h.taxType || 'intra';
  // Set the matching quick-rate button active
  document.querySelectorAll('.quick-rate-btn').forEach(b => {
    const v = parseFloat(b.textContent);
    b.classList.toggle('active', v === h.rate);
  });
  // If no quick-rate matched, show custom input
  const anyActive = document.querySelector('.quick-rate-btn.active');
  const customGroup = document.getElementById('customRateGroup');
  if (!anyActive && customGroup) {
    customGroup.style.display = 'block';
    const cr = document.getElementById('customRate');
    if (cr) cr.value = h.rate;
  }
  calculateGST(false);
}

export function clearHistory() {
  State.setCalcHistory([]);
  saveCalcHistory();
  renderHistory();
  showToast('History cleared', 'info');
}
