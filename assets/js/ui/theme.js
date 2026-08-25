/**
 * Ledgerix - Theme Management
 */

'use strict';

import AppConfig from '../../../config/app.config.js';
import * as State from '../core/state.js';
import { saveSettings } from '../core/storage.js';

export function setTheme(theme, silent = false) {
  AppConfig.THEME_CLASSES.forEach(c => document.body.classList.remove(c));
  if (theme && theme !== 'default') document.body.classList.add(theme);
  State.settings.theme = theme;
  saveSettings();
  if (!silent) {
    import('./toast.js').then(({ showToast }) => showToast('Theme updated!', 'success'));
  }
}

export function toggleThemeMenu() {
  document.getElementById('themeMenu').classList.toggle('active');
}
