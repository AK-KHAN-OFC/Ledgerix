/**
 * Ledgerix - Products Module
 */

'use strict';

import * as State from '../core/state.js';
import { nextId } from '../core/state.js';
import { saveProducts } from '../core/storage.js';
import { showToast } from '../ui/toast.js';
import { esc, formatMoney } from '../utils/helpers.js';

export function renderProducts() {
  const list = document.getElementById('productsList');
  if (!list) return;

  const q = (document.getElementById('productSearch')?.value || '').toLowerCase();
  const products = q
    ? State.products.filter(p =>
        p.name.toLowerCase().includes(q) || (p.hsn && p.hsn.toLowerCase().includes(q)))
    : State.products;

  list.innerHTML = products.length === 0
    ? '<p style="color:var(--gray);text-align:center;padding:2rem">No products yet</p>'
    : products.map(p => `
      <div class="product-card">
        <div class="card-info">
          <h4>${esc(p.name)}</h4>
          <p>HSN: ${esc(p.hsn || 'N/A')} | Rate: ${formatMoney(p.rate)} | GST: ${p.gst}% | Stock: ${p.stock}</p>
        </div>
        <div class="card-actions">
          <button class="btn btn-info btn-sm" onclick="window._ledgerix.products.addProductToInvoice(${p.id})"><i class="fas fa-plus"></i></button>
          <button class="btn btn-danger btn-sm" onclick="window._ledgerix.products.deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
        </div>
      </div>`).join('');
}

export function addNewProduct() {
  const name  = document.getElementById('newProductName')?.value.trim();
  const hsn   = document.getElementById('newProductHSN')?.value.trim();
  const rate  = parseFloat(document.getElementById('newProductRate')?.value) || 0;
  const gst   = parseFloat(document.getElementById('newProductGST')?.value)  || 18;
  const stock = parseInt(document.getElementById('newProductStock')?.value)   || 0;

  if (!name) { showToast('Product name required!', 'error'); return; }

  State.products.push({ id: nextId(), name, hsn, rate, gst, stock });
  saveProducts();

  ['newProductName','newProductHSN','newProductRate','newProductGST','newProductStock']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  renderProducts();
  showToast('Product saved!', 'success');
}

export function deleteProduct(id) {
  if (!confirm('Delete product?')) return;
  State.setProducts(State.products.filter(p => p.id !== id));
  saveProducts();
  renderProducts();
  showToast('Product deleted!', 'warning');
}

export function addProductToInvoice(id) {
  const p = State.products.find(p => p.id === id);
  if (!p) return;
  import('./invoice.js').then(m => {
    m.addItem(p.name, p.hsn || '', 1, p.rate, p.gst, 0);
    closeProductSearch();
  });
}

export function searchProducts() {
  const q       = document.getElementById('productSearchInput')?.value.toLowerCase();
  const results = document.getElementById('productSearchResults');
  if (!results) return;
  if (!q || q.length < 1) { results.style.display = 'none'; return; }

  const matches = State.products.filter(p =>
    p.name.toLowerCase().includes(q) || (p.hsn && p.hsn.includes(q)));

  if (!matches.length) { results.style.display = 'none'; return; }

  results.style.display = 'block';
  results.innerHTML = matches.map(p => `
    <div class="product-item" onclick="window._ledgerix.products.addProductToInvoice(${p.id})" style="cursor:pointer">
      <div><strong>${esc(p.name)}</strong><br><small>HSN: ${esc(p.hsn || 'N/A')} | ${formatMoney(p.rate)}</small></div>
      <i class="fas fa-plus-circle" style="color:var(--gold)"></i>
    </div>`).join('');
}

export function closeProductSearch() {
  const el = document.getElementById('productSearchResults');
  if (el) el.style.display = 'none';
}

export function filterProductList() {
  renderProducts();
}
