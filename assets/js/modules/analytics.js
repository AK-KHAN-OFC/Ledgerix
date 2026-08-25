/**
 * Ledgerix - Analytics Module
 */

'use strict';

import * as State from '../core/state.js';
import { formatMoney, today, getMonthStart, getMonthEnd } from '../utils/helpers.js';

export function renderAnalytics() {
  if (typeof Chart === 'undefined') return;

  const todayStr   = today();
  const monthStart = getMonthStart(todayStr);
  const monthEnd   = getMonthEnd(todayStr);

  // Single pass over all invoices
  const monthlyMap = {}, categoryMap = {}, clientMap = {}, productMap = {};
  let totalSales = 0, totalGST = 0, paidTotal = 0, invoiceCount = 0;
  let avgInvoiceVal = 0;

  State.savedInvoices.forEach(inv => {
    const amt = parseFloat(inv.grandTotal) || 0;
    const gst = parseFloat(inv.totalGST)   || 0;
    const mo  = inv.invDate.substring(0, 7);

    totalSales  += amt;
    totalGST    += gst;
    invoiceCount++;
    if (inv.paymentStatus === 'paid') paidTotal += amt;

    monthlyMap[mo] = (monthlyMap[mo] || 0) + amt;

    const cat = inv.taxType === 'inter' ? 'Inter-state' : 'Intra-state';
    categoryMap[cat] = (categoryMap[cat] || 0) + amt;

    clientMap[inv.clientName] = (clientMap[inv.clientName] || 0) + amt;

    (inv.itemRows || []).forEach(it => {
      const itAmt = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
      productMap[it.desc] = (productMap[it.desc] || 0) + itAmt;
    });
  });

  avgInvoiceVal = invoiceCount > 0 ? totalSales / invoiceCount : 0;
  const collectionRate = totalSales > 0 ? Math.round((paidTotal / totalSales) * 100) : 0;

  // Summary stats
  function setEl(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  setEl('analyticsTopProduct',      Object.keys(productMap).sort((a,b) => productMap[b]-productMap[a])[0] || '-');
  setEl('analyticsTopCustomer',     Object.keys(clientMap).sort((a,b) => clientMap[b]-clientMap[a])[0]   || '-');
  setEl('analyticsAvgInvoice',      formatMoney(avgInvoiceVal));
  setEl('analyticsCollectionRate',  collectionRate + '%');

  // Last 6 months labels
  const months = Object.keys(monthlyMap).sort().slice(-6);
  const revenueData = months.map(m => monthlyMap[m] || 0);

  // Sales trend line chart
  _renderChart('analyticsSalesChart', 'line', {
    labels: months,
    datasets: [{
      label: 'Monthly Revenue',
      data: revenueData,
      borderColor: '#c9a84c',
      backgroundColor: 'rgba(201,168,76,0.1)',
      fill: true, tension: 0.4, pointBackgroundColor: '#c9a84c',
    }],
  }, {
    scales: {
      x: { ticks: { color: '#c9c9c9' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#c9c9c9' }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  });

  // Top clients bar chart
  const topClients = Object.entries(clientMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  _renderChart('analyticsClientChart', 'bar', {
    labels: topClients.map(c => c[0].substring(0,15)),
    datasets: [{
      label: 'Revenue',
      data: topClients.map(c => c[1]),
      backgroundColor: 'rgba(201,168,76,0.8)',
      borderColor: '#c9a84c', borderWidth: 1,
    }],
  }, {
    indexAxis: 'y',
    scales: {
      x: { ticks: { color: '#c9c9c9' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#c9c9c9' }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  });

  // Top products doughnut
  const topProducts = Object.entries(productMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  _renderChart('analyticsProductChart', 'doughnut', {
    labels: topProducts.map(p => p[0].substring(0,20)),
    datasets: [{
      data: topProducts.map(p => p[1]),
      backgroundColor: ['#c9a84c','#4CAF50','#2196F3','#FF6B6B','#9C27B0'],
      borderWidth: 0,
    }],
  }, {});

  // Category pie
  _renderChart('analyticsCategoryChart', 'pie', {
    labels: Object.keys(categoryMap),
    datasets: [{
      data: Object.values(categoryMap),
      backgroundColor: ['#c9a84c','#4CAF50'],
      borderWidth: 0,
    }],
  }, {});
}

function _renderChart(canvasId, type, data, extraOptions) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (State.charts[canvasId]) State.charts[canvasId].destroy();

  State.charts[canvasId] = new Chart(ctx, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#c9c9c9', font: { size: 11 } } } },
      ...extraOptions,
    },
  });
}
