import {recognizePage} from './pdf-ocr.js';

const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38';
const DICTIONARY = 'https://api.dicionario-aberto.net/';

export function dictionaryWord(selection) {
  const word = selection.replace(/\u00ad/g, '').normalize('NFC').trim()
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').toLocaleLowerCase('pt-BR');
  return word.length <= 64 && /^\p{L}+(?:[-'’]\p{L}+)*$/u.test(word) ? word : '';
}

export function dictionaryVariants(word) {
  if (word.length < 4) return [];
  const variants = new Set();
  if (/ções$/.test(word)) variants.add(word.replace(/ções$/, 'ção'));
  if (/ões$/.test(word)) variants.add(word.replace(/ões$/, 'ão'));
  if (/ais$/.test(word)) variants.add(word.replace(/ais$/, 'al'));
  if (/res$|zes$/.test(word)) variants.add(word.slice(0, -2));
  if (word.endsWith('s')) variants.add(word.slice(0, -1));
  if (/[ai]ram$|eram$/.test(word)) variants.add(word.slice(0, -2));
  return [...variants];
}

async function dictionaryRequest(route, word, signal) {
  const response = await fetch(DICTIONARY + route + '/' + encodeURIComponent(word), {
    signal, credentials: 'omit', referrerPolicy: 'no-referrer',
  });
  if (response.status === 404) return [];
  if (!response.ok) throw Error('Consulta indisponível.');
  const entries = await response.json();
  if (!Array.isArray(entries)) throw Error('Resposta inválida.');
  return entries;
}

export async function findDefinition(word, signal) {
  const parser = new DOMParser();
  for (const candidate of [word, ...dictionaryVariants(word)]) {
    const entries = await dictionaryRequest('word', candidate, signal);
    const definitions = entries.flatMap(entry => typeof entry?.xml === 'string'
      ? Array.from(parser.parseFromString(entry.xml, 'application/xml').querySelectorAll('def'),
          node => node.textContent.trim().replace(/\s+/g, ' '))
      : []).filter(Boolean);
    if (definitions.length) return {term: candidate, definitions: [...new Set(definitions)].slice(0, 3)};
  }
  let suggestions = [];
  if (word.length >= 4) {
    try {
      const nearby = await dictionaryRequest('near', word, signal);
      suggestions = [...new Set(nearby.filter(item => typeof item === 'string')
        .map(dictionaryWord).filter(item => item && item !== word))].slice(0, 5);
    } catch {
      // The exact lookup has already completed even if suggestions fail.
    }
  }
  return {term: word, definitions: [], suggestions};
}

export function bindPdfDictionary() {
  const dialog = document.querySelector('#pdf-reader');
  const page = dialog.querySelector('#reader-page');
  const status = dialog.querySelector('#reader-status');
  const previous = dialog.querySelector('#reader-previous');
  const next = dialog.querySelector('#reader-next');
  const counter = dialog.querySelector('#reader-counter');
  const lookup = dialog.querySelector('#dictionary-lookup');
  const query = dialog.querySelector('#dictionary-word');
  const suggestions = dialog.querySelector('#dictionary-suggestions');
  const result = dialog.querySelector('#dictionary-result');
  const source = dialog.querySelector('#dictionary-source');
  const ocrButton = dialog.querySelector('#reader-ocr');
  const ocrStatus = dialog.querySelector('#ocr-status');
  const transcript = dialog.querySelector('#ocr-transcript');
  let active;

  function resetOcr() {
    ocrButton.disabled = true;
    ocrStatus.textContent = '';
    transcript.hidden = true;
    transcript.querySelector('pre').textContent = '';
  }

  ocrButton.addEventListener('click', async () => {
    const session = active;
    if (!session?.ready || session.ocr || session.lookup) return;
    const controller = new AbortController();
    session.ocr = controller;
    ocrButton.disabled = previous.disabled = next.disabled = lookup.disabled = true;
    ocrStatus.textContent = 'Preparando OCR em português…';
    try {
      const text = await recognizePage(page.querySelector('canvas'), {
        signal: controller.signal,
        onProgress: percent => {
          ocrStatus.textContent = `Reconhecendo texto: ${percent}%`;
        },
      });
      if (active !== session) return;
      transcript.querySelector('pre').textContent = text;
      transcript.hidden = !text;
      ocrStatus.textContent = text
        ? 'Selecione uma palavra no texto reconhecido e clique em Consultar significado.'
        : 'Nenhum texto foi reconhecido nesta página.';
    } catch {
      if (active === session) {
        ocrStatus.textContent = 'Não foi possível reconhecer o texto. Verifique a conexão e tente novamente.';
      }
    } finally {
      if (active === session) {
        session.ocr = undefined;
        ocrButton.disabled = false;
        lookup.disabled = !session.word;
        previous.disabled = session.number <= 1;
        next.disabled = session.number >= session.pdf.numPages;
      }
    }
  });

  async function renderPage(session, number) {
    const {pdf, library} = session;
    previous.disabled = next.disabled = lookup.disabled = true;
    resetOcr();
    session.ready = false;
    session.word = '';
    query.value = '';
    query.disabled = true;
    suggestions.replaceChildren();
    page.scrollTop = 0;
    result.textContent = '';
    source.hidden = true;
    page.replaceChildren();
    status.textContent = 'Carregando página…';

    try {
      const pdfPage = await pdf.getPage(number);
      if (active !== session) return;
      const original = pdfPage.getViewport({scale: 1});
      const viewport = pdfPage.getViewport({scale: Math.min(1.5, page.clientWidth / original.width)});
      const sheet = document.createElement('div');
      sheet.className = 'pdf-sheet';
      sheet.style.width = viewport.width + 'px';
      sheet.style.height = viewport.height + 'px';
      sheet.style.setProperty('--scale-factor', viewport.scale);
      const canvas = document.createElement('canvas');
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      const layer = document.createElement('div');
      layer.className = 'textLayer';
      sheet.append(canvas, layer);
      page.append(sheet);

      const render = pdfPage.render({
        canvasContext: canvas.getContext('2d'), viewport,
        transform: [ratio, 0, 0, ratio, 0, 0],
      });
      const text = new library.TextLayer({
        textContentSource: pdfPage.streamTextContent(), container: layer, viewport,
      });
      session.render = render;
      session.text = text;
      await Promise.all([render.promise, text.render()]);
      if (active !== session) return;
      session.number = number;
      session.ready = true;
      query.disabled = false;
      ocrButton.disabled = false;
      counter.textContent = `Página ${number} de ${pdf.numPages}`;
      previous.disabled = number <= 1;
      next.disabled = number >= pdf.numPages;
      status.textContent = layer.querySelector('span')
        ? 'Selecione uma palavra em português e clique em Consultar significado.'
        : 'Esta página não tem texto selecionável.';
    } catch {
      if (active === session) status.textContent = 'Não foi possível carregar a página. Use Abrir PDF original.';
    }
  }

  previous.addEventListener('click', () => active?.pdf && renderPage(active, active.number - 1));
  next.addEventListener('click', () => active?.pdf && renderPage(active, active.number + 1));
  document.addEventListener('selectionchange', () => {
    if (!active?.ready || !dialog.open) return;
    const selection = document.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const inside = container => container.contains(range.startContainer)
      && container.contains(range.endContainer);
    if (!inside(page) && !inside(transcript)) return;
    active.word = dictionaryWord(selection.toString());
    query.value = active.word;
    lookup.disabled = !active.word || Boolean(active.lookup || active.ocr);
  });

  query.addEventListener('input', () => {
    if (!active?.ready) return;
    active.word = dictionaryWord(query.value);
    lookup.disabled = !active.word || Boolean(active.lookup || active.ocr);
  });

  suggestions.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !active?.ready || active.lookup || active.ocr) return;
    query.value = button.textContent;
    query.dispatchEvent(new Event('input'));
    dialog.querySelector('#dictionary-form').requestSubmit();
  });

  dialog.querySelector('#dictionary-form').addEventListener('submit', async event => {
    event.preventDefault();
    const session = active;
    if (!session?.word || session.lookup || session.ocr) return;
    const word = session.word;
    query.disabled = true;
    suggestions.replaceChildren();
    const controller = new AbortController();
    session.lookup = controller;
    ocrButton.disabled = true;
    lookup.disabled = previous.disabled = next.disabled = true;
    result.textContent = `Consultando “${word}”…`;
    source.hidden = true;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const found = await findDefinition(word, controller.signal);
      if (active !== session) return;
      if (found.definitions.length) {
        const heading = found.term === word ? word : `Possível verbete para “${word}”: ${found.term}`;
        result.textContent = `${heading}: ${found.definitions.join(' / ')}`;
      } else {
        result.textContent = `Nenhuma definição encontrada para “${word}”. Confira a grafia ou tente a forma básica da palavra.`;
        for (const term of found.suggestions) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn-light me-2 mb-2';
          button.textContent = term;
          suggestions.append(button);
        }
      }
      source.hidden = !found.definitions.length;
    } catch {
      if (active === session) result.textContent = 'Dicionário indisponível. Verifique a conexão e tente novamente.';
    } finally {
      clearTimeout(timeout);
      if (active === session) {
        session.lookup = null;
        query.disabled = false;
        ocrButton.disabled = false;
        lookup.disabled = !session.word;
        previous.disabled = session.number <= 1;
        next.disabled = session.number >= session.pdf.numPages;
      }
    }
  });

  dialog.addEventListener('close', () => {
    const session = active;
    active = undefined;
    if (!session) return;
    session.lookup?.abort();
    session.ocr?.abort();
    resetOcr();
    session.render?.cancel();
    session.text?.cancel();
    session.task?.destroy().catch(() => {});
    page.replaceChildren();
  });

  return async function open(url) {
    const session = {};
    active = session;
    query.value = '';
    query.disabled = true;
    suggestions.replaceChildren();
    counter.textContent = '';
    result.textContent = '';
    page.replaceChildren();
    source.hidden = true;
    previous.disabled = next.disabled = lookup.disabled = true;
    status.textContent = 'Carregando leitor…';
    try {
      const library = await import(PDFJS + '/build/pdf.min.mjs');
      if (active !== session) return;
      library.GlobalWorkerOptions.workerSrc = PDFJS + '/build/pdf.worker.min.mjs';
      session.library = library;
      session.task = library.getDocument({
        url, isEvalSupported: false,
        cMapUrl: PDFJS + '/cmaps/', cMapPacked: true,
        standardFontDataUrl: PDFJS + '/standard_fonts/',
        wasmUrl: PDFJS + '/wasm/',
      });
      session.pdf = await session.task.promise;
      if (active === session) await renderPage(session, 1);
    } catch {
      if (active === session) status.textContent = 'Leitor integrado indisponível. Use Abrir PDF original.';
    }
  };
}
