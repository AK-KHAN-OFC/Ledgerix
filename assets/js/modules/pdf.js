/**
 * Ledgerix - PDF Generation Module
 * v2.6 fix: replaced doc.html() (requires missing html2canvas) with
 *           jsPDF + autoTable — reliable on mobile without extra dependencies.
 *           Preview uses style.display (not classList) to override inline display:none.
 */

'use strict';

import * as State from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { esc, formatMoney, numberToWords } from '../utils/helpers.js';

// ── Preview ──────────────────────────────────────────────────────────────────

export function previewInvoice() {
  const data = _getInvoiceData();
  if (!data) return;

  const content = document.getElementById('invoicePreviewContent');
  const wrapper = document.getElementById('invoicePreview');
  if (!content || !wrapper) { showToast('Preview area not found', 'warning'); return; }

  content.innerHTML = generateInvoiceHTML(data);
  wrapper.style.display = 'block';
  setTimeout(() => wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

export function closePreview() {
  const wrapper = document.getElementById('invoicePreview');
  if (wrapper) wrapper.style.display = 'none';
}

// ── PDF — jsPDF + autoTable (no html2canvas required) ────────────────────────

export async function downloadPDF() {
  const data = _getInvoiceData();
  if (!data) return;
  await downloadPDFFromData(data);
}

export async function downloadPDFFromData(data) {
  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDFCtor) {
    showToast('PDF library not loaded — use Print instead', 'warning');
    window.print();
    return;
  }

  try {
    const doc     = new jsPDFCtor({ orientation: 'p', unit: 'mm', format: 'a4' });
    const profile = State.profile || {};
    const W       = 210; // A4 width mm
    const margin  = 14;
    let   y       = margin;

    // ── Header ──
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 22, 40);
    doc.text(profile.name || 'Your Business', margin, y);

    doc.setFontSize(22);
    doc.setTextColor(201, 168, 76);
    doc.text('INVOICE', W - margin, y, { align: 'right' });
    y += 6;

    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    if (profile.address) { doc.text(profile.address, margin, y); y += 4; }
    if (profile.gstin)   doc.text('GSTIN: ' + profile.gstin, margin, y);
    if (profile.phone)   doc.text(profile.phone, margin, y + 4);

    // Invoice meta (right side)
    const metaX = W - margin;
    doc.setFontSize(8);
    doc.text('Invoice #: ' + (data.invNum || ''), metaX, y,       { align: 'right' });
    doc.text('Date:      ' + (data.invDate || ''), metaX, y + 4,  { align: 'right' });
    doc.text('Due:       ' + (data.dueDate || ''), metaX, y + 8,  { align: 'right' });
    doc.text('Status:    ' + (data.paymentStatus || '').toUpperCase(), metaX, y + 12, { align: 'right' });
    y += 18;

    // Divider
    doc.setDrawColor(10, 22, 40);
    doc.setLineWidth(0.5);
    doc.line(margin, y, W - margin, y);
    y += 5;

    // ── Bill To ──
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('BILL TO', margin, y);
    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(10, 22, 40);
    doc.setFont('helvetica', 'bold');
    doc.text(data.clientName || '', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    if (data.clientAddr)  { doc.text(data.clientAddr,  margin, y); y += 4; }
    if (data.clientGSTIN) { doc.text('GSTIN: ' + data.clientGSTIN, margin, y); y += 4; }
    if (data.clientPhone) { doc.text(data.clientPhone, margin, y); y += 4; }
    y += 2;

    // ── Items table ──
    const tableRows = (data.itemRows || []).map((it, i) => {
      const amount = parseFloat(it.amount || 0) || ((it.qty || 0) * (it.rate || 0)) * (1 - ((it.disc || 0) / 100));
      const gstAmt = parseFloat(it.gstAmount || 0) || (amount * ((it.gst || 0) / 100));
      return [
        String(i + 1),
        it.desc || '',
        it.hsn || '',
        String(it.qty || 1),
        formatMoney(it.rate || 0),
        (it.gst || 0) + '%',
        (it.disc || 0) + '%',
        formatMoney(gstAmt),
        formatMoney(amount + gstAmt),
      ];
    });

    doc.autoTable({
      startY: y,
      head: [['#', 'Description', 'HSN', 'Qty', 'Rate', 'GST%', 'Disc%', 'Tax', 'Total']],
      body: tableRows.length ? tableRows : [['', 'No items', '', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [10, 22, 40], textColor: [201, 168, 76], fontSize: 7, fontStyle: 'bold' },
      bodyStyles:  { fontSize: 7, textColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 45 },
        2: { cellWidth: 18 },
        3: { cellWidth: 10, halign: 'center' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 14, halign: 'center' },
        7: { cellWidth: 22, halign: 'right' },
        8: { cellWidth: 22, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    y = doc.lastAutoTable.finalY + 5;

    // ── Totals ──
    const totalsX   = W - margin - 60;
    const valX      = W - margin;
    const taxType   = data.taxType || 'intra';
    const totalGST  = parseFloat(data.totalGST || 0);
    const subtotal  = parseFloat(data.subtotal  || 0);
    const grandTotal= parseFloat(data.grandTotal|| 0);
    const shipping  = parseFloat(data.shipping  || 0);
    const packaging = parseFloat(data.packaging || 0);
    const handling  = parseFloat(data.handling  || 0);

    const totLines = [
      ['Subtotal', formatMoney(subtotal)],
      ...(taxType === 'inter'
        ? [['IGST', formatMoney(totalGST)]]
        : [['CGST', formatMoney(totalGST / 2)], ['SGST', formatMoney(totalGST / 2)]]),
      ...(shipping  ? [['Shipping',  formatMoney(shipping)]]  : []),
      ...(packaging ? [['Packaging', formatMoney(packaging)]] : []),
      ...(handling  ? [['Handling',  formatMoney(handling)]]  : []),
    ];

    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    totLines.forEach(([lbl, val]) => {
      doc.text(lbl, totalsX, y, { align: 'left' });
      doc.text(val, valX,    y, { align: 'right' });
      y += 5;
    });

    doc.setLineWidth(0.4);
    doc.setDrawColor(10, 22, 40);
    doc.line(totalsX, y, valX, y);
    y += 4;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 22, 40);
    doc.text('Grand Total', totalsX, y, { align: 'left' });
    doc.setTextColor(201, 168, 76);
    doc.text(formatMoney(grandTotal), valX, y, { align: 'right' });
    y += 5;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text(numberToWords(Math.round(grandTotal)) + ' Rupees Only', valX, y, { align: 'right' });
    y += 8;

    // ── Bank details ──
    if (profile.bank || profile.upi) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      if (profile.bank)    { doc.text('Bank: '  + profile.bank,    margin, y); y += 4; }
      if (profile.account) { doc.text('A/C: '   + profile.account, margin, y); y += 4; }
      if (profile.ifsc)    { doc.text('IFSC: '  + profile.ifsc,    margin, y); y += 4; }
      if (profile.upi)     { doc.text('UPI: '   + profile.upi,     margin, y); y += 4; }
    }

    // ── Terms ──
    if (data.terms) {
      y += 3;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Terms & Conditions:', margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      const termLines = doc.splitTextToSize(data.terms, W - margin * 2);
      doc.text(termLines, margin, y);
      y += termLines.length * 4;
    }

    // ── Footer ──
    const pageH = doc.internal.pageSize.height;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('This is a computer-generated invoice. Thank you for your business!',
             W / 2, pageH - 10, { align: 'center' });

    doc.save((data.invNum || 'invoice') + '.pdf');
    showToast('PDF downloaded!', 'success');

  } catch (e) {
    console.error('[PDF] Generation failed:', e);
    showToast('PDF failed — opening print view', 'warning');
    previewInvoice();
    setTimeout(() => window.print(), 500);
  }
}

// ── Invoice HTML for browser preview ─────────────────────────────────────────

export function generateInvoiceHTML(data) {
  const profile = State.profile || {};
  const taxType = data.taxType || 'intra';
  const totalGST = parseFloat(data.totalGST || 0);

  const itemsHTML = (data.itemRows || []).map((it, i) => {
    const amount = parseFloat(it.amount || 0) || ((it.qty || 0) * (it.rate || 0)) * (1 - ((it.disc || 0) / 100));
    const gstAmt = parseFloat(it.gstAmount || 0) || (amount * ((it.gst || 0) / 100));
    return `<tr style="border-bottom:1px solid #e8ecf1">
      <td style="padding:6px 5px;font-size:12px">${i+1}</td>
      <td style="padding:6px 5px;font-size:12px">${esc(it.desc||'Item')}</td>
      <td style="padding:6px 5px;font-size:12px">${esc(it.hsn||'—')}</td>
      <td style="padding:6px 5px;font-size:12px;text-align:center">${it.qty||1}</td>
      <td style="padding:6px 5px;font-size:12px;text-align:right">${formatMoney(it.rate||0)}</td>
      <td style="padding:6px 5px;font-size:12px;text-align:center">${it.gst||0}%</td>
      <td style="padding:6px 5px;font-size:12px;text-align:center">${it.disc||0}%</td>
      <td style="padding:6px 5px;font-size:12px;text-align:right">${formatMoney(gstAmt)}</td>
      <td style="padding:6px 5px;font-size:12px;text-align:right;font-weight:600">${formatMoney(amount+gstAmt)}</td>
    </tr>`;
  }).join('');

  const gstBlock = taxType === 'inter'
    ? `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span style="color:#666">IGST</span><span>${formatMoney(totalGST)}</span></div>`
    : `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span style="color:#666">CGST</span><span>${formatMoney(totalGST/2)}</span></div>
       <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span style="color:#666">SGST</span><span>${formatMoney(totalGST/2)}</span></div>`;

  return `<div style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;background:#fff;padding:24px;color:#1a2236">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #0a1628">
    <div>
      ${profile.logo?`<img src="${profile.logo}" style="height:48px;object-fit:contain;margin-bottom:6px;display:block">`:''}
      <div style="font-size:18px;font-weight:700;color:#0a1628">${esc(profile.name||'Your Business')}</div>
      <p style="color:#555;font-size:11px;margin-top:2px">${esc(profile.address||'')}</p>
      <p style="color:#555;font-size:11px">GSTIN: ${esc(profile.gstin||'N/A')} | ${esc(profile.phone||'')}</p>
    </div>
    <div style="text-align:right">
      <div style="font-size:24px;font-weight:800;color:#0a1628;letter-spacing:2px">INVOICE</div>
      <p style="color:#555;font-size:11px;margin-top:4px"><strong>${esc(data.invNum||'')}</strong></p>
      <p style="color:#555;font-size:11px">Date: ${esc(data.invDate||'')} | Due: ${esc(data.dueDate||'')}</p>
      <span style="display:inline-block;padding:2px 10px;border-radius:3px;font-size:10px;font-weight:700;margin-top:4px;
        background:${data.paymentStatus==='paid'?'#d1fae5':'#fee2e2'};color:${data.paymentStatus==='paid'?'#065f46':'#991b1b'}">
        ${(data.paymentStatus||'PENDING').toUpperCase()}</span>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
    <div style="background:#f8fafc;padding:12px;border-radius:5px">
      <p style="color:#8892a8;font-size:9px;text-transform:uppercase;margin-bottom:4px">Bill To</p>
      <p style="font-weight:700;color:#1a2236;font-size:13px">${esc(data.clientName||'')}</p>
      <p style="font-size:11px;color:#555">${esc(data.clientAddr||'')}</p>
      <p style="font-size:11px;color:#555">GSTIN: ${esc(data.clientGSTIN||'N/A')}</p>
      <p style="font-size:11px;color:#555">${esc(data.clientPhone||'')} ${data.clientEmail?'| '+esc(data.clientEmail):''}</p>
    </div>
    <div style="background:#f8fafc;padding:12px;border-radius:5px">
      <p style="color:#8892a8;font-size:9px;text-transform:uppercase;margin-bottom:4px">Bank Details</p>
      <p style="font-size:11px;color:#555">${esc(profile.bank||'N/A')}</p>
      <p style="font-size:11px;color:#555">A/C: ${esc(profile.account||'N/A')} | IFSC: ${esc(profile.ifsc||'N/A')}</p>
      <p style="font-size:11px;color:#555">UPI: ${esc(profile.upi||'N/A')}</p>
      ${data.paymentMethod?`<p style="font-size:11px;color:#555;margin-top:4px">Via: ${esc(data.paymentMethod)}</p>`:''}
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <thead><tr style="background:#0a1628;color:#c9a84c">
      <th style="padding:7px 5px;text-align:left;font-size:10px">#</th>
      <th style="padding:7px 5px;text-align:left;font-size:10px">Description</th>
      <th style="padding:7px 5px;text-align:left;font-size:10px">HSN</th>
      <th style="padding:7px 5px;text-align:center;font-size:10px">Qty</th>
      <th style="padding:7px 5px;text-align:right;font-size:10px">Rate</th>
      <th style="padding:7px 5px;text-align:center;font-size:10px">GST%</th>
      <th style="padding:7px 5px;text-align:center;font-size:10px">Disc%</th>
      <th style="padding:7px 5px;text-align:right;font-size:10px">Tax</th>
      <th style="padding:7px 5px;text-align:right;font-size:10px">Total</th>
    </tr></thead>
    <tbody>${itemsHTML||'<tr><td colspan="9" style="text-align:center;padding:14px;color:#888">No items</td></tr>'}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
    <div style="width:240px">
      <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #e8ecf1;font-size:12px">
        <span style="color:#666">Subtotal</span><span>${formatMoney(data.subtotal||0)}</span>
      </div>
      ${gstBlock}
      ${parseFloat(data.shipping) ?`<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span style="color:#666">Shipping</span><span>${formatMoney(data.shipping)}</span></div>`:''}
      ${parseFloat(data.packaging)?`<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span style="color:#666">Packaging</span><span>${formatMoney(data.packaging)}</span></div>`:''}
      ${parseFloat(data.handling) ?`<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span style="color:#666">Handling</span><span>${formatMoney(data.handling)}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:2px solid #0a1628;font-weight:700;font-size:14px;color:#0a1628">
        <span>Grand Total</span><span>${formatMoney(data.grandTotal||0)}</span>
      </div>
      <div style="font-size:10px;color:#666;font-style:italic">${esc(numberToWords(Math.round(parseFloat(data.grandTotal)||0)))} Rupees Only</div>
    </div>
  </div>
  ${data.terms?`<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e8ecf1"><p style="font-size:10px;color:#666"><strong>Terms:</strong> ${esc(data.terms)}</p></div>`:''}
  ${data.notes?`<div style="margin-top:8px"><p style="font-size:10px;color:#666"><strong>Notes:</strong> ${esc(data.notes)}</p></div>`:''}
  ${profile.signature?`<div style="margin-top:20px;text-align:right"><img src="${profile.signature}" style="height:48px;object-fit:contain"><p style="font-size:10px;color:#666">Authorised Signature</p></div>`:''}
  <div style="margin-top:16px;text-align:center;color:#8892a8;font-size:9px;border-top:1px solid #e8ecf1;padding-top:10px">This is a computer-generated invoice.</div>
</div>`;
}

function _getInvoiceData() {
  try {
    const fn = window._ledgerix?.invoice?.getInvoiceData || window.getInvoiceData;
    if (typeof fn === 'function') return fn();
  } catch (e) { console.error('[PDF] getInvoiceData:', e); }
  showToast('Could not read invoice data', 'warning');
  return null;
}
