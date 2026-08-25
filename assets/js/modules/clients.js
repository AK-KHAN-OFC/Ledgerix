/**
 * Ledgerix - Clients Module
 */

'use strict';

import * as State from '../core/state.js';
import { nextId } from '../core/state.js';
import { saveClients } from '../core/storage.js';
import { showToast } from '../ui/toast.js';
import { esc, validateGSTIN, validatePhone } from '../utils/helpers.js';
import { switchTab } from '../ui/navigation.js';

export function renderClients() {
  const list = document.getElementById('clientsList');
  if (!list) return;

  const q = (document.getElementById('clientSearch')?.value || '').toLowerCase();
  const clients = q
    ? State.clients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.gstin && c.gstin.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)))
    : State.clients;

  list.innerHTML = clients.length === 0
    ? '<p style="color:var(--gray);text-align:center;padding:2rem">No clients yet</p>'
    : clients.map(c => `
      <div class="client-card">
        <div class="card-info">
          <h4>${esc(c.name)}</h4>
          <p>${esc(c.address || 'No address')}<br>GSTIN: ${esc(c.gstin || 'N/A')} | ${esc(c.phone || '')}</p>
        </div>
        <div class="card-actions">
          <button class="btn btn-info btn-sm" onclick="window._ledgerix.clients.useClient(${c.id})"><i class="fas fa-file-invoice"></i></button>
          <button class="btn btn-danger btn-sm" onclick="window._ledgerix.clients.deleteClient(${c.id})"><i class="fas fa-trash"></i></button>
        </div>
      </div>`).join('');
}

export async function addNewClient() {
  const name  = document.getElementById('newClientName')?.value.trim();
  const gstin = document.getElementById('newClientGSTIN')?.value.trim();
  const addr  = document.getElementById('newClientAddr')?.value.trim();
  const phone = document.getElementById('newClientPhone')?.value.trim();
  const email = document.getElementById('newClientEmail')?.value.trim();

  if (!name) { showToast('Client name required!', 'error'); return; }
  if (!validateGSTIN(gstin)) { showToast('Invalid GSTIN format!', 'error'); return; }
  if (!validatePhone(phone))  { showToast('Invalid phone number!', 'error'); return; }

  State.clients.push({ id: nextId(), name, gstin, address: addr, phone, email });
  await saveClients();

  ['newClientName','newClientGSTIN','newClientAddr','newClientPhone','newClientEmail']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  renderClients();
  showToast('Client saved!', 'success');
}

export async function deleteClient(id) {
  if (!confirm('Delete client?')) return;
  State.setClients(State.clients.filter(c => c.id !== id));
  await saveClients();
  renderClients();
  showToast('Client deleted!', 'warning');
}

export function useClient(id) {
  const c = State.clients.find(c => c.id === id);
  if (!c) return;
  switchTab('invoice');
  setTimeout(() => selectClient(id), 100);
}

export function selectClient(id) {
  const c = State.clients.find(c => c.id === id);
  if (!c) return;
  const fields = { invClient: c.name, invClientAddr: c.address || '', invClientGSTIN: c.gstin || '', invClientPhone: c.phone || '', invClientEmail: c.email || '' };
  Object.entries(fields).forEach(([k, v]) => { const el = document.getElementById(k); if (el) el.value = v; });
  closeClientSearch();
}

export function searchClients() {
  const q       = document.getElementById('invClient')?.value.toLowerCase();
  const results = document.getElementById('clientSearchResults');
  if (!results) return;

  if (!q || q.length < 1) { results.style.display = 'none'; return; }

  const matches = State.clients.filter(c =>
    c.name.toLowerCase().includes(q) || (c.gstin && c.gstin.toLowerCase().includes(q)));

  if (!matches.length) { results.style.display = 'none'; return; }

  results.style.display = 'block';
  results.innerHTML = matches.map(c => `
    <div class="product-item" onclick="window._ledgerix.clients.selectClient(${c.id})" style="cursor:pointer">
      <div><strong>${esc(c.name)}</strong><br><small>${esc(c.gstin || '')}</small></div>
      <i class="fas fa-check-circle" style="color:var(--gold)"></i>
    </div>`).join('');
}

export function closeClientSearch() {
  const el = document.getElementById('clientSearchResults');
  if (el) el.style.display = 'none';
}

export async function saveCurrentClient() {
  const name = document.getElementById('invClient')?.value.trim();
  if (!name) { showToast('Enter client name first!', 'error'); return; }
  const data = {
    name,
    address: document.getElementById('invClientAddr')?.value.trim(),
    gstin:   document.getElementById('invClientGSTIN')?.value.trim(),
    phone:   document.getElementById('invClientPhone')?.value.trim(),
    email:   document.getElementById('invClientEmail')?.value.trim(),
  };
  const existing = State.clients.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (existing) Object.assign(existing, data);
  else State.clients.push({ id: nextId(), ...data });
  await saveClients();
  showToast('Client saved!', 'success');
}

export function filterClientList() {
  renderClients();
}
