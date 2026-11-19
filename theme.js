(() => {
  'use strict';
  const STORAGE_KEY = 'typo-fix.color-mode';
  const modes = new Set(['system', 'light', 'dark']);
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  let control;
  let menu;
  let options = [];

  function readPreference() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return modes.has(saved) ? saved : 'system';
    } catch {
      return 'system';
    }
  }

  let preference = readPreference();
  function applyTheme() {
    root.dataset.themePreference = preference;
    root.dataset.theme = preference === 'system'
      ? (systemTheme.matches ? 'dark' : 'light') : preference;
    if (control) {
      const selected = options.find(option => option.dataset.themeMode === preference);
      document.getElementById('theme-label').textContent = selected.firstChild.textContent;
      control.setAttribute('aria-label', `颜色模式：${selected.firstChild.textContent}`);
      options.forEach(option => option.setAttribute('aria-checked', String(option === selected)));
    }
  }

  // Run in <head> before styles load, avoiding a light flash on dark pages.
  applyTheme();
  systemTheme.addEventListener('change', applyTheme);
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) {
      preference = readPreference();
      applyTheme();
    }
  });
  window.addEventListener('pageshow', () => {
    preference = readPreference();
    applyTheme();
  });

  document.addEventListener('DOMContentLoaded', () => {
    control = document.getElementById('theme-trigger');
    menu = document.getElementById('theme-menu');
    if (!control || !menu) return;
    options = Array.from(menu.querySelectorAll('[data-theme-mode]'));
    applyTheme();

    function closeMenu(restoreFocus = false) {
      menu.hidden = true;
      control.setAttribute('aria-expanded', 'false');
      if (restoreFocus) control.focus();
    }
    function openMenu(index = options.findIndex(option => option.dataset.themeMode === preference)) {
      menu.hidden = false;
      control.setAttribute('aria-expanded', 'true');
      options[index].focus();
    }
    control.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu());
    control.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openMenu(event.key === 'ArrowDown' ? 0 : options.length - 1);
      }
    });
    options.forEach(option => option.addEventListener('click', () => {
      preference = option.dataset.themeMode;
      applyTheme();
      closeMenu(true);
      try {
        localStorage.setItem(STORAGE_KEY, preference);
      } catch {
        // Storage may be blocked. Switching still works for the current page.
      }
    }));
    menu.addEventListener('keydown', event => {
      const index = options.indexOf(document.activeElement);
      let next;
      if (event.key === 'ArrowDown') next = (index + 1) % options.length;
      if (event.key === 'ArrowUp') next = (index + options.length - 1) % options.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = options.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        options[next].focus();
      }
      if (event.key === 'Tab') {
        // Restore the trigger as the tab origin, then allow normal navigation.
        closeMenu(true);
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !menu.hidden) {
        event.preventDefault();
        closeMenu(true);
      }
    });
    const container = control.closest('.theme-control');
    document.addEventListener('pointerdown', event => {
      if (!container.contains(event.target)) closeMenu();
    });
    document.addEventListener('focusin', event => {
      if (!container.contains(event.target)) closeMenu();
    });
  });
})();
