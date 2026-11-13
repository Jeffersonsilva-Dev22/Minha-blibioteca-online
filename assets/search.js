export const normalize = value => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function withinEditLimit(left, right, limit) {
  if (Math.abs(left.length - right.length) > limit) return false;
  let previous = Array.from({length: right.length + 1}, (_, index) => index);
  let beforePrevious;
  for (let row = 1; row <= left.length; row++) {
    const current = [row];
    for (let column = 1; column <= right.length; column++) {
      const substitution = Number(left[row - 1] !== right[column - 1]);
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1,
        previous[column - 1] + substitution);
      if (row > 1 && column > 1 && left[row - 1] === right[column - 2]
          && left[row - 2] === right[column - 1]) {
        current[column] = Math.min(current[column], beforePrevious[column - 2] + 1);
      }
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[right.length] <= limit;
}

export function searchRank(value, query) {
  const text = normalize(value);
  const term = normalize(query).trim();
  if (!term) return 0;
  if (text === term) return 0;
  if (text.startsWith(term)) return 1;
  if (text.includes(term)) return 2;
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = term.match(/[\p{L}\p{N}]+/gu) ?? [];
  const matches = terms.length > 0 && terms.every(token => words.some(word => {
    if (word.startsWith(token)) return true;
    if (token.length < 4) return false;
    return withinEditLimit(token, word, token.length >= 8 ? 2 : 1);
  }));
  return matches ? 3 : Infinity;
}

export function suggestSearch(options, query) {
  return options.map(label => ({label, rank: searchRank(label, query)}))
    .filter(item => Number.isFinite(item.rank))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 6)
    .map(item => item.label);
}

const HISTORY_KEY = 'minha-biblioteca:search-history:v1';

export function loadSearchHistory(storage) {
  try {
    const entries = JSON.parse(storage.getItem(HISTORY_KEY));
    return Array.isArray(entries) ? entries.filter(item => typeof item === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(storage, history, query) {
  const term = query.trim();
  if (!term) return history;
  const recent = [term, ...history.filter(item => normalize(item) !== normalize(term))].slice(0, 6);
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(recent));
  } catch {
    // Keep searches available in this tab if browser storage is unavailable.
  }
  return recent;
}
