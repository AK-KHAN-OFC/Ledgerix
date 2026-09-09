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
  // toggleThemeMenu is called from the header cog button.
  // Themes are applied directly via setTheme() in the Settings tab.
  // Switch to settings tab so the user can select a theme.
  import('../ui/navigation.js').then(m => m.switchTab('settings'));
}
