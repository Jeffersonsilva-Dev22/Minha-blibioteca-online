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
  const buttons = document.querySelectorAll('[data-display-mode]');
  function updateButtons() {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.displayMode === preference));
    }
  }
  updateButtons();
  for (const button of buttons) {
    button.addEventListener('click', () => {
      preference = validTheme(button.dataset.displayMode);
      applyTheme(preference);
      updateButtons();
      try {
        localStorage.setItem(THEME_KEY, preference);
      } catch {
        // Keep the selected theme for this visit.
      }
    });
  }
});
