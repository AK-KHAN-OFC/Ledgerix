/**
 * Ledgerix - Tab Switch Handlers
 * Called whenever the user switches tabs. Lazy-loads heavy modules.
 */

'use strict';

export async function onTabSwitch(tab) {
  switch (tab) {
    case 'dashboard':
      (await import('./dashboard.js')).updateDashboard();
      break;
    case 'invoice':
      (await import('./profile.js')).loadProfileBanner();
      (await import('./invoice.js')).renderItems();
      break;
    case 'invoices':
      (await import('./invoice.js')).renderInvoicesList();
      break;
    case 'clients':
      (await import('./clients.js')).renderClients();
      break;
    case 'products':
      (await import('./products.js')).renderProducts();
      break;
    case 'analytics':
      (await import('./analytics.js')).renderAnalytics();
      break;
    case 'profile':
      (await import('./profile.js')).loadProfileForm();
      break;
    case 'reports':
      // nothing extra needed on switch
      break;
    case 'scanner':
      // OCR tab ready
      break;
    case 'calculator':
      (await import('./gst.js')).renderHistory();
      break;
    default:
      break;
  }
}
