/**
 * Ledgerix - GST Calculator Module
 */

'use strict';

import * as State from '../core/state.js';
import { saveCalcHistory } from '../core/storage.js';
import { showToast } from '../ui/toast.js';
import { formatMoney, esc } from '../utils/helpers.js';

export function setGSTType(inclusive) {
  State.setIsInclusive(inclusive);
  document.getElementById('btnExclusive')?.classList.toggle('active', !inclusive);
  document.getElementById('btnInclusive')?.classList.toggle('active',  inclusive);
}

export function setQuickRate(rate, e) {
  document.querySelectorAll('.quick-rate-btn').forEach(b => b.classList.remove('active'));
  if (e && e.target) e.target.classList.add('active');
  const el = document.getElementById('gstRate');
  if (el) el.value = rate;
}

export function calculateGST(saveToHistory = true) {
  const amount     = parseFloat(document.getElementById('gstAmount')?.value) || 0;
  const rate       = parseFloat(document.getElementById('gstRate')?.value)   || 0;
  const taxType    = document.getElementById('gstTaxType')?.value  || 'intra';
  const taxCategory = document.getElementById('gstTaxCategory')?.value || 'goods';

  if (amount <= 0) { showToast('Enter a valid amount', 'error'); return; }

  let base, totalGST, finalAmt;
  if (State.isInclusive) {
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

  function setEl(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  setEl('resBase',     formatMoney(base));
  setEl('resCGST',     formatMoney(cgst));
  setEl('resSGST',     formatMoney(sgst));
  setEl('resIGST',     formatMoney(igst));
  setEl('resTotalGST', formatMoney(totalGST));
  setEl('resFinal',    formatMoney(finalAmt));

  if (saveToHistory) {
    State.calcHistory.unshift({
      type: State.isInclusive ? 'Inclusive' : 'Exclusive',
      amount, rate, base, cgst, sgst, igst, totalGST,
      final: finalAmt, taxType, taxCategory,
      time: new Date().toLocaleTimeString(),
    });
    if (State.calcHistory.length > 50) State.calcHistory.pop();
    saveCalcHistory();
    renderHistory();
  }
}

export function clearCalculator() {
  ['gstAmount','gstRate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['resBase','resCGST','resSGST','resIGST','resTotalGST','resFinal']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '₹0.00'; });
}

export function renderHistory() {
  const list = document.getElementById('calcHistoryList');
  if (!list) return;
  if (State.calcHistory.length === 0) {
    list.innerHTML = '<p style="color:var(--gray);text-align:center;padding:1rem">No calculations yet</p>';
    return;
  }
  list.innerHTML = State.calcHistory.slice(0, 20).map((h, idx) => `
    <div class="history-item" onclick="window._ledgerix.gst.loadHistory(${idx})">
      <div>
        <strong>${formatMoney(h.amount)}</strong> @ ${h.rate}% GST (${h.type})
        <br><small style="color:var(--gray)">${h.taxType === 'inter' ? 'IGST' : 'CGST+SGST'} | ${h.time}</small>
      </div>
      <div style="text-align:right">
        <div style="color:var(--gold)">${formatMoney(h.final)}</div>
        <small>GST: ${formatMoney(h.totalGST)}</small>
      </div>
    </div>`).join('');
}

export function loadHistory(idx) {
  const h = State.calcHistory[idx];
  if (!h) return;
  const amtEl = document.getElementById('gstAmount');
  const rateEl = document.getElementById('gstRate');
  if (amtEl) amtEl.value = h.amount;
  if (rateEl) rateEl.value = h.rate;
  setGSTType(h.type === 'Inclusive');
  calculateGST(false);
}

export function clearHistory() {
  State.setCalcHistory([]);
  saveCalcHistory();
  renderHistory();
  showToast('History cleared', 'info');
}
