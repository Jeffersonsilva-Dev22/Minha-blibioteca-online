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
  const selector = document.querySelector('#theme-select');
  selector.value = preference;
  selector.addEventListener('change', () => {
    preference = validTheme(selector.value);
    applyTheme(preference);
    try {
      localStorage.setItem(THEME_KEY, preference);
    } catch {
      // Keep the selected theme for this visit.
    }
  });
});
