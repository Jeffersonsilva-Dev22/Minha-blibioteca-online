const THEME_KEY = 'minha-biblioteca:theme';
const THEMES = ['light', 'dark', 'reading'];

function validTheme(value) {
  return THEMES.includes(value) ? value : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.bsTheme = theme === 'dark' ? 'dark' : 'light';
}

let preference = 'light';
try {
  preference = validTheme(localStorage.getItem(THEME_KEY));
} catch {
  // The selector still works when storage is unavailable.
}
applyTheme(preference);

document.addEventListener('DOMContentLoaded', () => {
  const control = document.querySelector('.theme-control');
  const toggle = document.querySelector('#theme-toggle');
  const panel = document.querySelector('#theme-options');
  const buttons = [...panel.querySelectorAll('[data-display-mode]')];

  function updateButtons() {
    for (const button of buttons) {
      button.hidden = button.dataset.displayMode === preference;
      if (button.hidden) {
        toggle.querySelector('img').src = button.querySelector('img').src;
        toggle.setAttribute('aria-label', `Modo atual: ${button.title}. Alterar modo.`);
      }
    }
  }

  function setOpen(open, restoreFocus = false) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (restoreFocus) toggle.focus();
  }

  updateButtons();
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  for (const button of buttons) {
    button.addEventListener('click', () => {
      preference = validTheme(button.dataset.displayMode);
      applyTheme(preference);
      updateButtons();
      setOpen(false, true);
      try {
        localStorage.setItem(THEME_KEY, preference);
      } catch {
        // Keep the selected theme for this visit.
      }
    });
  }
  control.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      setOpen(false, true);
    }
  });
  control.addEventListener('focusout', event => {
    if (!control.contains(event.relatedTarget)) setOpen(false);
  });
  document.addEventListener('click', event => {
    if (!control.contains(event.target)) setOpen(false);
  });
});
