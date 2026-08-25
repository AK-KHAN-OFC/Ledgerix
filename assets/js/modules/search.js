/**
 * Ledgerix - Global Search Module
 */

'use strict';

import * as State from '../core/state.js';
import { esc } from '../utils/helpers.js';
import { switchTab } from '../ui/navigation.js';

export function openGlobalSearch() {
  document.getElementById('globalSearchOverlay')?.classList.add('active');
  document.getElementById('globalSearchInput')?.focus();
}

export function closeGlobalSearch() {
  document.getElementById('globalSearchOverlay')?.classList.remove('active');
  const inp = document.getElementById('globalSearchInput');
  if (inp) inp.value = '';
  const res = document.getElementById('globalSearchResults');
  if (res) res.innerHTML = '';
}

export function performGlobalSearch() {
  const q   = (document.getElementById('globalSearchInput')?.value || '').toLowerCase().trim();
  const res = document.getElementById('globalSearchResults');
  if (!res) return;
  if (!q) { res.innerHTML = ''; return; }

  const results = [];

  // Search invoices
  State.savedInvoices.forEach(inv => {
    if (inv.invNum.toLowerCase().includes(q) || inv.clientName.toLowerCase().includes(q)) {
      results.push({
        type: 'invoice', icon: 'fa-file-invoice',
        title: inv.invNum + ' — ' + inv.clientName,
        sub: inv.invDate + ' | ' + (inv.grandTotal ? '₹' + parseFloat(inv.grandTotal).toFixed(2) : ''),
        action: () => { loadSavedInvoiceGlobal(inv.id); closeGlobalSearch(); },
      });
    }
  });

  // Search clients
  State.clients.forEach(c => {
    if (c.name.toLowerCase().includes(q) || (c.gstin && c.gstin.toLowerCase().includes(q))) {
      results.push({
        type: 'client', icon: 'fa-user',
        title: c.name,
        sub: c.gstin || 'No GSTIN',
        action: () => { switchTab('clients'); closeGlobalSearch(); },
      });
    }
  });

  // Search products
  State.products.forEach(p => {
    if (p.name.toLowerCase().includes(q) || (p.hsn && p.hsn.toLowerCase().includes(q))) {
      results.push({
        type: 'product', icon: 'fa-box',
        title: p.name,
        sub: 'HSN: ' + (p.hsn || 'N/A') + ' | ₹' + p.rate,
        action: () => { switchTab('products'); closeGlobalSearch(); },
      });
    }
  });

  if (!results.length) {
    res.innerHTML = '<div style="color:var(--gray);padding:1rem;text-align:center">No results found</div>';
    return;
  }

  // Render results — actions stored on DOM elements via index to avoid onclick injection
  res.innerHTML = results.slice(0, 10).map((r, idx) => `
    <div class="search-result-item" data-idx="${idx}" style="cursor:pointer;padding:0.75rem;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;gap:0.75rem">
      <i class="fas ${esc(r.icon)}" style="color:var(--gold);width:20px"></i>
      <div><div class="result-title">${esc(r.title)}</div><div class="result-sub" style="font-size:0.78rem;color:var(--gray)">${esc(r.sub)}</div></div>
    </div>`).join('');

  // Attach click handlers via addEventListener (not onclick attributes)
  res.querySelectorAll('.search-result-item').forEach(el => {
    const idx = parseInt(el.dataset.idx);
    el.addEventListener('click', () => results[idx].action());
  });
}

function loadSavedInvoiceGlobal(id) {
  import('./invoice.js').then(m => m.loadSavedInvoice(id));
  switchTab('invoice');
}
