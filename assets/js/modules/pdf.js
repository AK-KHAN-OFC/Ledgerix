/**
 * Ledgerix - PDF Generation Module
 * v2.3 fixes:
 *   - previewInvoice(): shows/hides via style.display (not classList.active)
 *     because the HTML element has inline style="display:none".
 *   - closePreview(): same fix.
 *   - downloadPDFFromData(): guaranteed container cleanup in finally block.
 *   - PDF fallback to print when jsPDF unavailable.
 *   - All async paths leave the UI usable.
 *   - Uses window._ledgerix bridge to avoid circular invoice↔pdf import.
 */

'use strict';

import * as State from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { esc, formatMoney, numberToWords } from '../utils/helpers.js';

export function generateInvoiceHTML(data) {
  const profile = State.profile;
  const taxType = data.taxType || 'intra';

  const itemsHTML = (data.itemRows || []).map((it, i) => {
    const amount = parseFloat(it.amount  || 0) || ((it.qty || 0) * (it.rate || 0)) * (1 - ((it.disc || 0) / 100));
    const gstAmt = parseFloat(it.gstAmount || 0) || (amount * ((it.gst || 0) / 100));
    return `<tr style="border-bottom:1px solid #e8ecf1">
      <td style="padding:0.6rem 0.5rem;font-size:0.82rem">${i + 1}</td>
      <td style="padding:0.6rem 0.5rem;font-size:0.82rem">${esc(it.desc || 'Item')}</td>
      <td style="padding:0.6rem 0.5rem;font-size:0.82rem">${esc(it.hsn || '—')}</td>
      <td style="padding:0.6rem 0.5rem;font-size:0.82rem;text-align:center">${it.qty || 1}</td>
      <td style="padding:0.6rem 0.5rem;font-size:0.82rem;text-align:right">${formatMoney(it.rate || 0)}</td>
      <td style="padding:0.6rem 0.5rem;font-size:0.82rem;text-align:center">${it.gst || 0}%</td>
      <td style="padding:0.6rem 0.5rem;font-size:0.82rem;text-align:center">${it.disc || 0}%</td>
      <td style="padding:0.6rem 0.5rem;font-size:0.82rem;text-align:right">${formatMoney(gstAmt)}</td>
      <td style="padding:0.6rem 0.5rem;font-size:0.82rem;text-align:right;font-weight:600">${formatMoney(amount + gstAmt)}</td>
    </tr>`;
  }).join('');

  const now      = new Date();
  const dueDate  = data.dueDate ? new Date(data.dueDate) : null;
  const overdue  = dueDate && dueDate < now && data.paymentStatus !== 'paid';
  const dueBadge = overdue ? '<span style="color:#ef4444;font-size:0.72rem;margin-left:4px">(OVERDUE)</span>' : '';

  const gstBlock = taxType === 'inter'
    ? `<div style="display:flex;justify-content:space-between;padding:0.35rem 0;font-size:0.82rem"><span style="color:#666">IGST</span><span>${formatMoney(data.totalGST)}</span></div>`
    : `<div style="display:flex;justify-content:space-between;padding:0.35rem 0;font-size:0.82rem"><span style="color:#666">CGST</span><span>${formatMoney(parseFloat(data.totalGST) / 2)}</span></div>
       <div style="display:flex;justify-content:space-between;padding:0.35rem 0;font-size:0.82rem"><span style="color:#666">SGST</span><span>${formatMoney(parseFloat(data.totalGST) / 2)}</span></div>`;

  return `<div style="font-family:'Poppins',sans-serif;max-width:800px;margin:0 auto;background:#fff;padding:1.8rem;color:#1a2236">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid #0a1628">
      <div>
        ${profile.logo ? `<img src="${profile.logo}" style="height:52px;object-fit:contain;margin-bottom:0.4rem;display:block">` : ''}
        <div style="font-size:1.35rem;font-weight:700;color:#0a1628;font-family:'Playfair Display',serif">${esc(profile.name || 'Your Business')}</div>
        <p style="color:#555;font-size:0.78rem;margin-top:0.2rem">${esc(profile.address || '')}</p>
        <p style="color:#555;font-size:0.75rem">GSTIN: ${esc(profile.gstin || 'N/A')} | ${esc(profile.phone || '')}</p>
        <p style="color:#555;font-size:0.75rem">${esc(profile.email || '')}</p>
      </div>
      <div style="text-align:right">
        <div style="font-size:1.8rem;font-weight:800;color:#0a1628;letter-spacing:2px">INVOICE</div>
        <p style="color:#555;font-size:0.82rem;margin-top:0.25rem"><strong>Invoice #:</strong> ${esc(data.invNum)}</p>
        <p style="color:#555;font-size:0.82rem"><strong>Date:</strong> ${esc(data.invDate || '')}</p>
        <p style="color:#555;font-size:0.82rem"><strong>Due:</strong> ${esc(data.dueDate || '')} ${dueBadge}</p>
        <span style="display:inline-block;padding:0.2rem 0.65rem;border-radius:4px;font-size:0.72rem;font-weight:600;margin-top:0.4rem;
          background:${data.paymentStatus === 'paid' ? '#d1fae5' : '#fee2e2'};
          color:${data.paymentStatus === 'paid' ? '#065f46' : '#991b1b'}">
          ${(data.paymentStatus || 'PENDING').toUpperCase()}
        </span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1.5rem">
      <div style="background:#f8fafc;padding:0.8rem;border-radius:6px">
        <h4 style="color:#8892a8;font-size:0.7rem;text-transform:uppercase;margin-bottom:0.3rem">Bill To</h4>
        <p style="font-weight:600;color:#1a2236;font-size:0.9rem">${esc(data.clientName)}</p>
        <p style="font-size:0.78rem;color:#555;margin-top:2px">${esc(data.clientAddr || '')}</p>
        <p style="font-size:0.75rem;color:#555">GSTIN: ${esc(data.clientGSTIN || 'N/A')}</p>
        <p style="font-size:0.75rem;color:#555">${esc(data.clientPhone || '')}</p>
      </div>
      <div style="background:#f8fafc;padding:0.8rem;border-radius:6px">
        <h4 style="color:#8892a8;font-size:0.7rem;text-transform:uppercase;margin-bottom:0.3rem">Ship To</h4>
        <p style="font-weight:600;color:#1a2236;font-size:0.9rem">${esc(data.clientName)}</p>
        <p style="font-size:0.78rem;color:#555">${esc(data.clientAddr || '')}</p>
      </div>
      <div style="background:#f8fafc;padding:0.8rem;border-radius:6px">
        <h4 style="color:#8892a8;font-size:0.7rem;text-transform:uppercase;margin-bottom:0.3rem">Bank Details</h4>
        <p style="color:#555;font-size:0.72rem">${esc(profile.bank || 'N/A')}</p>
        <p style="color:#555;font-size:0.72rem">A/C: ${esc(profile.account || 'N/A')}</p>
        <p style="color:#555;font-size:0.72rem">IFSC: ${esc(profile.ifsc || 'N/A')}</p>
        <p style="color:#555;font-size:0.72rem">UPI: ${esc(profile.upi || 'N/A')}</p>
        ${data.paymentMethod ? `<p style="color:#555;font-size:0.72rem;margin-top:4px"><strong>Via:</strong> ${esc(data.paymentMethod)}</p>` : ''}
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:1.2rem">
      <thead>
        <tr style="background:#0a1628;color:#c9a84c">
          <th style="padding:0.55rem 0.5rem;text-align:left;font-size:0.75rem">#</th>
          <th style="padding:0.55rem 0.5rem;text-align:left;font-size:0.75rem">Description</th>
          <th style="padding:0.55rem 0.5rem;text-align:left;font-size:0.75rem">HSN</th>
          <th style="padding:0.55rem 0.5rem;text-align:center;font-size:0.75rem">Qty</th>
          <th style="padding:0.55rem 0.5rem;text-align:right;font-size:0.75rem">Rate</th>
          <th style="padding:0.55rem 0.5rem;text-align:center;font-size:0.75rem">GST%</th>
          <th style="padding:0.55rem 0.5rem;text-align:center;font-size:0.75rem">Disc%</th>
          <th style="padding:0.55rem 0.5rem;text-align:right;font-size:0.75rem">Tax</th>
          <th style="padding:0.55rem 0.5rem;text-align:right;font-size:0.75rem">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHTML || '<tr><td colspan="9" style="text-align:center;padding:1rem;color:#888">No items</td></tr>'}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-bottom:1.2rem">
      <div style="width:260px">
        <div style="display:flex;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid #e8ecf1;font-size:0.82rem">
          <span style="color:#666">Subtotal</span><span>${formatMoney(data.subtotal)}</span>
        </div>
        ${gstBlock}
        ${parseFloat(data.shipping)  ? `<div style="display:flex;justify-content:space-between;padding:0.35rem 0;font-size:0.82rem"><span style="color:#666">Shipping</span><span>${formatMoney(data.shipping)}</span></div>`  : ''}
        ${parseFloat(data.packaging) ? `<div style="display:flex;justify-content:space-between;padding:0.35rem 0;font-size:0.82rem"><span style="color:#666">Packaging</span><span>${formatMoney(data.packaging)}</span></div>` : ''}
        ${parseFloat(data.handling)  ? `<div style="display:flex;justify-content:space-between;padding:0.35rem 0;font-size:0.82rem"><span style="color:#666">Handling</span><span>${formatMoney(data.handling)}</span></div>`  : ''}
        <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-top:2px solid #0a1628;font-weight:700;font-size:0.95rem;color:#0a1628">
          <span>Grand Total</span><span>${formatMoney(data.grandTotal)}</span>
        </div>
        <div style="margin-top:4px;font-size:0.72rem;color:#666;font-style:italic">${esc(numberToWords(Math.round(parseFloat(data.grandTotal) || 0)))} Rupees Only</div>
      </div>
    </div>

    ${data.terms ? `<div style="margin-top:1rem;padding-top:0.8rem;border-top:1px solid #e8ecf1"><p style="color:#666;font-size:0.78rem"><strong>Terms & Conditions:</strong></p><p style="color:#666;font-size:0.73rem;white-space:pre-line;margin-top:3px">${esc(data.terms)}</p></div>` : ''}
    ${data.notes ? `<div style="margin-top:0.8rem"><p style="color:#666;font-size:0.78rem"><strong>Notes:</strong></p><p style="color:#666;font-size:0.73rem;margin-top:3px">${esc(data.notes)}</p></div>` : ''}
    ${profile.signature ? `<div style="margin-top:1.5rem;text-align:right"><img src="${profile.signature}" style="height:52px;object-fit:contain"><p style="color:#666;font-size:0.72rem;margin-top:3px">Authorised Signature</p></div>` : ''}

    <div style="margin-top:1.5rem;text-align:center;color:#8892a8;font-size:0.7rem;border-top:1px solid #e8ecf1;padding-top:0.8rem">
      This is a computer-generated invoice.
    </div>
  </div>`;
}

// ── Preview ──────────────────────────────────────────────────────────────────
// The HTML element uses inline style="display:none" — we override with style.display
// because classList.add('active') cannot override an inline style without !important.

export function previewInvoice() {
  const data = _getInvoiceData();
  if (!data) return;

  const content = document.getElementById('invoicePreviewContent');
  const wrapper = document.getElementById('invoicePreview');

  if (!content || !wrapper) {
    showToast('Preview area not found', 'error');
    return;
  }

  content.innerHTML = generateInvoiceHTML(data);
  wrapper.style.display = 'block';
  wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function closePreview() {
  const wrapper = document.getElementById('invoicePreview');
  if (wrapper) wrapper.style.display = 'none';
}

// ── PDF Download ──────────────────────────────────────────────────────────────

export async function downloadPDF() {
  const data = _getInvoiceData();
  if (!data) return;
  await downloadPDFFromData(data);
}

export async function downloadPDFFromData(data) {
  // Try jsPDF first, fall back to print
  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;

  if (!jsPDFCtor) {
    showToast('PDF library not loaded — opening print dialog instead', 'warning');
    // Use print as fallback
    previewInvoice();
    setTimeout(() => window.print(), 400);
    return;
  }

  let container = null;
  try {
    const doc = new jsPDFCtor({ orientation: 'p', unit: 'mm', format: 'a4' });
    const html = generateInvoiceHTML(data);

    container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:#fff;z-index:-1';
    container.innerHTML = html;
    document.body.appendChild(container);

    await new Promise((resolve, reject) => {
      doc.html(container, {
        callback: (d) => {
          try {
            d.save(`${data.invNum || 'invoice'}.pdf`);
            resolve();
          } catch (saveErr) {
            reject(saveErr);
          }
        },
        x: 8, y: 8, width: 194, windowWidth: 800,
        margin: [8, 8, 8, 8],
      });
    });

    showToast('PDF downloaded!', 'success');
  } catch (e) {
    console.error('[PDF] Generation failed:', e);
    showToast('PDF generation failed — try Print instead', 'error');
  } finally {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

// ── Internal helper — gets invoice data via bridge (avoids circular import) ──

function _getInvoiceData() {
  try {
    const fn = window._ledgerix?.invoice?.getInvoiceData;
    if (typeof fn === 'function') return fn();
    // Fallback: try direct window shim
    if (typeof window.getInvoiceData === 'function') return window.getInvoiceData();
  } catch (e) {
    console.error('[PDF] getInvoiceData failed:', e);
  }
  showToast('Could not read invoice data', 'error');
  return null;
}
