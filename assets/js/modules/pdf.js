/**
 * Ledgerix - PDF Generation Module
 * Uses jsPDF (loaded globally in index.html) for PDF output.
 * previewInvoice() uses window._ledgerix bridge to access getInvoiceData()
 * without a circular import — this is intentional and documented.
 */

'use strict';

import * as State from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { esc, formatMoney, numberToWords } from '../utils/helpers.js';

export function generateInvoiceHTML(data) {
  const profile = State.profile;
  const taxType = data.taxType || 'intra';

  const itemsHTML = (data.itemRows || []).map((it, i) => {
    const amount = parseFloat(it.amount || ((it.qty * it.rate) * (1 - (it.disc || 0) / 100)));
    const gstAmt = parseFloat(it.gstAmount || (amount * (it.gst / 100)));
    return `<tr style="border-bottom:1px solid #e8ecf1">
      <td style="padding:0.7rem;font-size:0.85rem">${i + 1}</td>
      <td style="padding:0.7rem;font-size:0.85rem">${esc(it.desc || 'Item')}</td>
      <td style="padding:0.7rem;font-size:0.85rem">${esc(it.hsn || '-')}</td>
      <td style="padding:0.7rem;font-size:0.85rem;text-align:center">${it.qty}</td>
      <td style="padding:0.7rem;font-size:0.85rem;text-align:right">${formatMoney(it.rate)}</td>
      <td style="padding:0.7rem;font-size:0.85rem;text-align:center">${it.gst}%</td>
      <td style="padding:0.7rem;font-size:0.85rem;text-align:center">${it.disc || 0}%</td>
      <td style="padding:0.7rem;font-size:0.85rem;text-align:right">${formatMoney(gstAmt)}</td>
      <td style="padding:0.7rem;font-size:0.85rem;text-align:right;font-weight:600">${formatMoney(amount + gstAmt)}</td>
    </tr>`;
  }).join('');

  const now     = new Date();
  const dueDate = new Date(data.dueDate);
  const isOverdue = dueDate < now && data.paymentStatus !== 'paid';
  const dueBadge  = isOverdue ? '<span style="color:#ef4444;font-size:0.75rem">(OVERDUE)</span>' : '';

  return `
  <div style="font-family:'Poppins',sans-serif;max-width:800px;margin:0 auto;background:#fff;padding:2rem;color:#1a1a2e">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:3px solid #0a1628">
      <div>
        ${profile.logo ? `<img src="${profile.logo}" style="height:60px;object-fit:contain;margin-bottom:0.5rem">` : ''}
        <div style="font-size:1.5rem;font-weight:700;color:#0a1628;font-family:'Playfair Display',serif">${esc(profile.name || 'Your Business')}</div>
        <p style="color:#666;font-size:0.8rem;margin-top:0.3rem">${esc(profile.address || '')}</p>
        <p style="color:#666;font-size:0.75rem">GSTIN: ${esc(profile.gstin || 'N/A')} | ${esc(profile.phone || '')}</p>
        <p style="color:#666;font-size:0.75rem">${esc(profile.email || '')}</p>
      </div>
      <div style="text-align:right">
        <div style="font-size:2rem;font-weight:800;color:#0a1628;letter-spacing:2px">INVOICE</div>
        <p style="color:#666;font-size:0.85rem;margin-top:0.3rem"><strong>Invoice #:</strong> ${esc(data.invNum)}</p>
        <p style="color:#666;font-size:0.85rem"><strong>Date:</strong> ${esc(data.invDate)}</p>
        <p style="color:#666;font-size:0.85rem"><strong>Due:</strong> ${esc(data.dueDate)} ${dueBadge}</p>
        <span style="display:inline-block;padding:0.25rem 0.75rem;border-radius:9999px;font-size:0.75rem;font-weight:600;margin-top:0.5rem;
          background:${data.paymentStatus === 'paid' ? '#d1fae5' : '#fee2e2'};color:${data.paymentStatus === 'paid' ? '#065f46' : '#991b1b'}">
          ${(data.paymentStatus || '').toUpperCase()}
        </span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.5rem;margin-bottom:2rem">
      <div style="background:#f8fafc;padding:1rem;border-radius:8px">
        <h4 style="color:#8892a8;font-size:0.75rem;text-transform:uppercase;margin-bottom:0.4rem">Bill To</h4>
        <p style="font-weight:600;color:#1a1a2e;font-size:0.95rem">${esc(data.clientName)}</p>
        <p style="font-size:0.8rem;color:#666">${esc(data.clientAddr || '')}</p>
        <p style="font-size:0.8rem;color:#666">GSTIN: ${esc(data.clientGSTIN || 'N/A')}</p>
        <p style="font-size:0.8rem;color:#666">${esc(data.clientPhone || '')}</p>
      </div>
      <div style="background:#f8fafc;padding:1rem;border-radius:8px">
        <h4 style="color:#8892a8;font-size:0.75rem;text-transform:uppercase;margin-bottom:0.4rem">Ship To</h4>
        <p style="font-weight:600;color:#1a1a2e;font-size:0.95rem">${esc(data.clientName)}</p>
        <p style="font-size:0.8rem;color:#666">${esc(data.clientAddr || '')}</p>
      </div>
      <div style="background:#f8fafc;padding:1rem;border-radius:8px">
        <h4 style="color:#8892a8;font-size:0.75rem;text-transform:uppercase;margin-bottom:0.4rem">Bank Details</h4>
        <p style="color:#666;font-size:0.75rem">${esc(profile.bank || 'N/A')}</p>
        <p style="color:#666;font-size:0.75rem">A/C: ${esc(profile.account || 'N/A')}</p>
        <p style="color:#666;font-size:0.75rem">IFSC: ${esc(profile.ifsc || 'N/A')}</p>
        <p style="color:#666;font-size:0.75rem">UPI: ${esc(profile.upi || 'N/A')}</p>
        ${data.paymentMethod ? `<p style="color:#666;font-size:0.75rem;margin-top:0.5rem"><strong>Via:</strong> ${esc(data.paymentMethod)}</p>` : ''}
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">
      <thead>
        <tr style="background:#0a1628;color:#c9a84c">
          <th style="padding:0.75rem;text-align:left;font-size:0.8rem">#</th>
          <th style="padding:0.75rem;text-align:left;font-size:0.8rem">Description</th>
          <th style="padding:0.75rem;text-align:left;font-size:0.8rem">HSN</th>
          <th style="padding:0.75rem;text-align:center;font-size:0.8rem">Qty</th>
          <th style="padding:0.75rem;text-align:right;font-size:0.8rem">Rate</th>
          <th style="padding:0.75rem;text-align:center;font-size:0.8rem">GST%</th>
          <th style="padding:0.75rem;text-align:center;font-size:0.8rem">Disc%</th>
          <th style="padding:0.75rem;text-align:right;font-size:0.8rem">Tax</th>
          <th style="padding:0.75rem;text-align:right;font-size:0.8rem">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-bottom:1.5rem">
      <div style="width:280px">
        <div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid #e8ecf1;font-size:0.85rem">
          <span style="color:#666">Subtotal</span><span>${formatMoney(data.subtotal)}</span>
        </div>
        ${taxType === 'inter'
          ? `<div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem"><span style="color:#666">IGST</span><span>${formatMoney(data.totalGST)}</span></div>`
          : `<div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem"><span style="color:#666">CGST</span><span>${formatMoney(parseFloat(data.totalGST)/2)}</span></div>
             <div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem"><span style="color:#666">SGST</span><span>${formatMoney(parseFloat(data.totalGST)/2)}</span></div>`}
        ${parseFloat(data.shipping)  ? `<div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem"><span style="color:#666">Shipping</span><span>${formatMoney(data.shipping)}</span></div>`  : ''}
        ${parseFloat(data.packaging) ? `<div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem"><span style="color:#666">Packaging</span><span>${formatMoney(data.packaging)}</span></div>` : ''}
        ${parseFloat(data.handling)  ? `<div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem"><span style="color:#666">Handling</span><span>${formatMoney(data.handling)}</span></div>`  : ''}
        <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-top:2px solid #0a1628;font-weight:700;font-size:1rem;color:#0a1628">
          <span>Grand Total</span><span>${formatMoney(data.grandTotal)}</span>
        </div>
        <div style="margin-top:0.5rem;font-size:0.8rem;color:#666">${esc(numberToWords(Math.round(data.grandTotal)))} Rupees Only</div>
      </div>
    </div>

    ${data.terms ? `<div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid #e8ecf1"><p style="color:#666;font-size:0.8rem"><strong>Terms &amp; Conditions:</strong></p><p style="color:#666;font-size:0.75rem;white-space:pre-line">${esc(data.terms)}</p></div>` : ''}
    ${data.notes ? `<div style="margin-top:1rem"><p style="color:#666;font-size:0.8rem"><strong>Notes:</strong></p><p style="color:#666;font-size:0.75rem">${esc(data.notes)}</p></div>` : ''}

    ${profile.signature ? `<div style="margin-top:2rem;text-align:right"><img src="${profile.signature}" style="height:60px;object-fit:contain"><p style="color:#666;font-size:0.75rem">Authorised Signature</p></div>` : ''}
    <div style="margin-top:2rem;text-align:center;color:#8892a8;font-size:0.75rem;border-top:1px solid #e8ecf1;padding-top:1rem">
      This is a computer-generated invoice. Thank you for your business!
    </div>
  </div>`;
}

// previewInvoice() cannot import invoice.js directly (circular: pdf ↔ invoice).
// It uses the global window bridge (window._ledgerix.invoice.getInvoiceData)
// which is always populated before any UI interaction occurs — this is safe.
export function previewInvoice() {
  const data = window._ledgerix && window._ledgerix.invoice && window._ledgerix.invoice.getInvoiceData
    ? window._ledgerix.invoice.getInvoiceData()
    : null;
  if (!data) return;
  const el = document.getElementById('invoicePreviewContent');
  if (el) el.innerHTML = generateInvoiceHTML(data);
  document.getElementById('invoicePreview')?.classList.add('active');
}

export function closePreview() {
  document.getElementById('invoicePreview')?.classList.remove('active');
}

export async function downloadPDF() {
  const data = window._ledgerix && window._ledgerix.invoice && window._ledgerix.invoice.getInvoiceData
    ? window._ledgerix.invoice.getInvoiceData()
    : null;
  if (!data) return;
  await downloadPDFFromData(data);
}

export async function downloadPDFFromData(data) {
  if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
    showToast('PDF library not loaded', 'error');
    return;
  }

  try {
    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const html = generateInvoiceHTML(data);

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:#fff';
    container.innerHTML = html;
    document.body.appendChild(container);

    await doc.html(container, {
      callback: (doc) => {
        doc.save(`${data.invNum}.pdf`);
        document.body.removeChild(container);
      },
      x: 10, y: 10, width: 190, windowWidth: 800,
    });
  } catch (e) {
    console.error('[PDF] Generation failed:', e);
    showToast('PDF generation failed. Try again.', 'error');
  }
}
