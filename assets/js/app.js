/**
 * Ledgerix - Application Entry Point
 * Bootstraps all modules and exposes a single global namespace (_ledgerix)
 * so that existing HTML onclick handlers continue to work unchanged.
 */

'use strict';

import { checkPIN }             from './core/security.js';
import { loadAllData }          from './core/storage.js';
import { hideSplash, switchTab, closeModal, closeModalDirect, toggleSidebar } from './ui/navigation.js';
import { showToast }            from './ui/toast.js';
import { setTheme, toggleThemeMenu } from './ui/theme.js';
import { updateDashboard }      from './modules/dashboard.js';
import { renderItems, addItem, removeItem, updateItem, saveInvoice, resetInvoice,
         renderInvoicesList, filterInvoiceStatus, filterInvoices, loadSavedInvoice,
         deleteSavedInvoice, downloadSavedPDF, shareInvoice, autoSaveInvoice,
         getInvoiceData, generateInvoiceNumber }    from './modules/invoice.js';
import { renderClients, addNewClient, deleteClient, useClient, selectClient,
         searchClients, closeClientSearch, saveCurrentClient, filterClientList } from './modules/clients.js';
import { renderProducts, addNewProduct, deleteProduct, addProductToInvoice,
         searchProducts, closeProductSearch, filterProductList } from './modules/products.js';
import { addNotification, updateNotificationBadge, renderNotifications,
         markRead, toggleNotifications, checkPaymentReminders } from './modules/notifications.js';
import { saveProfile, loadProfileBanner, loadProfileForm,
         handleLogoUpload, handleSigUpload }        from './modules/profile.js';
import { saveSettings, togglePIN, savePIN }         from './modules/settings.js';
import { setGSTType, setQuickRate, calculateGST,
         clearCalculator, renderHistory, loadHistory, clearHistory } from './modules/gst.js';
import { generateReport, exportReportCSV, exportReportExcel, printReport } from './modules/reports.js';
import { renderAnalytics }      from './modules/analytics.js';
import { openGlobalSearch, closeGlobalSearch, performGlobalSearch } from './modules/search.js';
import { backupData, restoreData, clearAllData, setupOfflineDetection } from './modules/backup.js';
import { downloadPDF, previewInvoice, closePreview } from './modules/pdf.js';
import { handleOCRUpload, startOCRScan, createInvoiceFromOCR, addOCRItem,
         removeOCRItem, updateOCRItem, clearOCR }   from './modules/ocr.js';
import { today, addDays }       from './utils/helpers.js';

// ── Global namespace bridge ───────────────────────────────────────────────────
// All HTML onclick="..." attributes call through window._ledgerix.*
// This preserves 100% compatibility without touching the HTML.

window._ledgerix = {
  // Navigation
  nav: { switchTab, closeModal, closeModalDirect, toggleSidebar },

  // UI
  ui:  { showToast, setTheme, toggleThemeMenu },

  // Dashboard
  dashboard: { updateDashboard },

  // Invoice
  invoice: {
    addItem, removeItem, updateItem, saveInvoice, resetInvoice,
    renderItems, renderInvoicesList, filterInvoiceStatus, filterInvoices,
    loadSavedInvoice, deleteSavedInvoice, downloadSavedPDF, shareInvoice,
    autoSaveInvoice, getInvoiceData, generateInvoiceNumber,
    downloadPDF, previewInvoice, closePreview,
  },

  // Clients
  clients: { renderClients, addNewClient, deleteClient, useClient, selectClient,
             searchClients, closeClientSearch, saveCurrentClient, filterClientList },

  // Products
  products: { renderProducts, addNewProduct, deleteProduct, addProductToInvoice,
              searchProducts, closeProductSearch, filterProductList },

  // Notifications
  notifications: { addNotification, updateNotificationBadge, renderNotifications,
                   markRead, toggleNotifications, checkPaymentReminders },

  // Profile
  profile: { saveProfile, loadProfileBanner, loadProfileForm,
             handleLogoUpload, handleSigUpload },

  // Settings
  settings: { saveSettings, togglePIN, savePIN },

  // GST Calculator
  gst: { setGSTType, setQuickRate, calculateGST, clearCalculator,
         renderHistory, loadHistory, clearHistory },

  // Reports
  reports: { generateReport, exportReportCSV, exportReportExcel, printReport },

  // Analytics
  analytics: { renderAnalytics },

  // Search
  search: { openGlobalSearch, closeGlobalSearch, performGlobalSearch },

  // Backup
  backup: { backupData, restoreData, clearAllData },

  // OCR
  ocr: { handleOCRUpload, startOCRScan, createInvoiceFromOCR, addOCRItem,
         removeOCRItem, updateOCRItem, clearOCR },
};

// ── Convenience top-level shims (called directly from HTML onclick) ────────────
// These match the original monolithic function names exactly.

window.switchTab             = switchTab;
window.toggleSidebar         = toggleSidebar;
window.closeModal            = closeModal;
window.toggleThemeMenu       = toggleThemeMenu;
window.setTheme              = setTheme;
window.openGlobalSearch      = openGlobalSearch;
window.closeGlobalSearch     = closeGlobalSearch;
window.performGlobalSearch   = performGlobalSearch;
window.toggleNotifications   = toggleNotifications;
window.markRead              = markRead;

window.updateDashboard       = updateDashboard;

window.addItem               = addItem;
window.removeItem            = removeItem;
window.updateItem            = updateItem;
window.saveInvoice           = saveInvoice;
window.resetInvoice          = resetInvoice;
window.filterInvoiceStatus   = filterInvoiceStatus;
window.filterInvoices        = filterInvoices;
window.loadSavedInvoice      = loadSavedInvoice;
window.deleteSavedInvoice    = deleteSavedInvoice;
window.downloadSavedPDF      = downloadSavedPDF;
window.shareInvoice          = shareInvoice;
window.autoSaveInvoice       = autoSaveInvoice;
window.downloadPDF           = downloadPDF;
window.previewInvoice        = previewInvoice;
window.closePreview          = closePreview;

window.addNewClient          = addNewClient;
window.deleteClient          = deleteClient;
window.useClient             = useClient;
window.selectClient          = selectClient;
window.searchClients         = searchClients;
window.closeClientSearch     = closeClientSearch;
window.saveCurrentClient     = saveCurrentClient;
window.filterClientList      = filterClientList;

window.addNewProduct         = addNewProduct;
window.deleteProduct         = deleteProduct;
window.addProductToInvoice   = addProductToInvoice;
window.searchProducts        = searchProducts;
window.closeProductSearch    = closeProductSearch;
window.filterProductList     = filterProductList;

window.saveProfile           = saveProfile;
window.handleLogoUpload      = handleLogoUpload;
window.handleSigUpload       = handleSigUpload;

window.saveSettings          = saveSettings;
window.togglePIN             = togglePIN;
window.savePIN               = savePIN;

window.setGSTType            = setGSTType;
window.setQuickRate          = setQuickRate;
window.calculateGST          = calculateGST;
window.clearCalculator       = clearCalculator;
window.loadHistory           = loadHistory;
window.clearHistory          = clearHistory;

window.generateReport        = generateReport;
window.exportReportCSV       = exportReportCSV;
window.exportReportExcel     = exportReportExcel;
window.printReport           = printReport;

window.renderAnalytics       = renderAnalytics;

window.backupData            = backupData;
window.restoreData           = restoreData;
window.clearAllData          = clearAllData;

window.handleOCRUpload       = handleOCRUpload;
window.startOCRScan          = startOCRScan;
window.createInvoiceFromOCR  = createInvoiceFromOCR;
window.addOCRItem            = addOCRItem;
window.removeOCRItem         = removeOCRItem;
window.updateOCRItem         = updateOCRItem;
window.clearOCR              = clearOCR;

// ── Application Bootstrap ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async function () {
  try {
    await checkPIN();         // must be first — blocks until PIN verified
    await loadAllData();      // decrypt and hydrate state

    // Set default form dates
    const invDate    = document.getElementById('invDate');
    const invDueDate = document.getElementById('invDueDate');
    const rptFrom    = document.getElementById('reportFromDate');
    const rptTo      = document.getElementById('reportToDate');
    const t = today();
    if (invDate)    invDate.value    = t;
    if (invDueDate) invDueDate.value = addDays(t, 7);
    if (rptFrom)    rptFrom.value    = addDays(t, -30);
    if (rptTo)      rptTo.value      = t;

    // Set invoice number
    const invNum = document.getElementById('invNumber');
    if (invNum) {
      const { generateInvoiceNumber } = await import('./modules/invoice.js');
      invNum.value = generateInvoiceNumber();
    }

    renderItems();
    updateDashboard();
    setupOfflineDetection();
    renderNotifications();

    // Lazy: check payment reminders after 2.5s
    setTimeout(() => checkPaymentReminders(), 2500);

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeGlobalSearch();
        document.getElementById('notificationPanel')?.classList.remove('active');
        document.getElementById('modalOverlay')?.classList.remove('active');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openGlobalSearch();
      }
    });

    // Sidebar overlay click
    document.getElementById('sidebarOverlay')?.addEventListener('click', toggleSidebar);

    // Modal overlay click
    document.getElementById('modalOverlay')?.addEventListener('click', closeModal);

    // Invoice field change → auto-save
    document.getElementById('invoiceForm')?.addEventListener('change', autoSaveInvoice);

  } catch (e) {
    console.error('[App] Startup error:', e);
  } finally {
    hideSplash(); // always hide splash regardless of errors
  }
});
