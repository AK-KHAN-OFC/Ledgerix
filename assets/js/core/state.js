/**
 * Ledgerix - Application State
 * Single source of truth for all mutable runtime state.
 * All modules import from here — never declare their own globals.
 */

'use strict';

// Console safety shim — some Android WebViews stub console without all methods
(function () {
  if (!window.console) window.console = {};
  ['log','info','warn','error','debug','group','groupEnd','time','timeEnd'].forEach(function (m) {
    if (typeof window.console[m] !== 'function') window.console[m] = function () {};
  });
})();

// Monotonic ID counter — guarantees uniqueness in synchronous loops
let _itemIdCounter = Date.now();
export function nextId() { return ++_itemIdCounter; }

// ── Core data ─────────────────────────────────────────────────────────────────
export let clients        = [];
export let products       = [];
export let savedInvoices  = [];
export let profile        = {};
export let settings       = {};
export let invoiceCounter = 1;
export let notifications  = [];
export let calcHistory    = [];

// ── Invoice builder ───────────────────────────────────────────────────────────
export let items               = [];
export let currentInvoiceFilter = 'all';

// ── UI state ──────────────────────────────────────────────────────────────────
export let charts               = {};
export let deferredInstallPrompt = null;
export let currentReportData    = null;
export let isInclusive          = false;

// ── OCR state ─────────────────────────────────────────────────────────────────
export let ocrImageData     = null;
export let ocrDetectedItems = [];
export let ocrDetectedVendor  = '';
export let ocrDetectedGSTIN   = '';
export let ocrDetectedDate    = '';
export let ocrDetectedBillNo  = '';

// ── Setters (used by modules to mutate shared state) ─────────────────────────
export function setClients(v)               { clients = v; }
export function setProducts(v)              { products = v; }
export function setSavedInvoices(v)         { savedInvoices = v; }
export function setProfile(v)               { profile = v; }
export function setSettings(v)              { settings = v; }
export function setInvoiceCounter(v)        { invoiceCounter = v; }
export function setNotifications(v)         { notifications = v; }
export function setCalcHistory(v)           { calcHistory = v; }
export function setItems(v)                 { items = v; }
export function setCurrentInvoiceFilter(v)  { currentInvoiceFilter = v; }
export function setCharts(v)                { charts = v; }
export function setDeferredInstallPrompt(v) { deferredInstallPrompt = v; }
export function setCurrentReportData(v)     { currentReportData = v; }
export function setIsInclusive(v)           { isInclusive = v; }
export function setOcrImageData(v)          { ocrImageData = v; }
export function setOcrDetectedItems(v)      { ocrDetectedItems = v; }
export function setOcrDetectedVendor(v)     { ocrDetectedVendor = v; }
export function setOcrDetectedGSTIN(v)      { ocrDetectedGSTIN = v; }
export function setOcrDetectedDate(v)       { ocrDetectedDate = v; }
export function setOcrDetectedBillNo(v)     { ocrDetectedBillNo = v; }
