import {recognizePage} from './pdf-ocr.js';

const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38';
const DICTIONARY = 'https://api.dicionario-aberto.net/word/';

export function dictionaryWord(selection) {
  const word = selection.normalize('NFC').trim()
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').toLocaleLowerCase('pt-BR');
  return word.length <= 64 && /^\p{L}+(?:[-'’]\p{L}+)*$/u.test(word) ? word : '';
}

export function bindPdfDictionary() {
  const dialog = document.querySelector('#pdf-reader');
  const page = dialog.querySelector('#reader-page');
  const status = dialog.querySelector('#reader-status');
  const previous = dialog.querySelector('#reader-previous');
  const next = dialog.querySelector('#reader-next');
  const counter = dialog.querySelector('#reader-counter');
  const lookup = dialog.querySelector('#dictionary-lookup');
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
    lookup.disabled = !active.word || Boolean(active.lookup || active.ocr);
  });

  lookup.addEventListener('click', async () => {
    const session = active;
    if (!session?.word || session.lookup || session.ocr) return;
    const word = session.word;
    const controller = new AbortController();
    session.lookup = controller;
    ocrButton.disabled = true;
    lookup.disabled = previous.disabled = next.disabled = true;
    result.textContent = `Consultando “${word}”…`;
    source.hidden = true;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(DICTIONARY + encodeURIComponent(word), {
        signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
      });
      if (!response.ok && response.status !== 404) throw Error('Consulta indisponível.');
      const entries = response.status === 404 ? [] : await response.json();
      if (!Array.isArray(entries)) throw Error('Resposta inválida.');
      const parser = new DOMParser();
      const definitions = entries.flatMap(entry => typeof entry.xml === 'string'
        ? Array.from(parser.parseFromString(entry.xml, 'application/xml').querySelectorAll('def'),
            node => node.textContent.trim().replace(/\s+/g, ' '))
        : []).filter(Boolean);
      if (active !== session) return;
      result.textContent = definitions.length
        ? `${word}: ${[...new Set(definitions)].slice(0, 3).join(' / ')}`
        : `Nenhuma definição encontrada para “${word}”.`;
      source.hidden = !definitions.length;
    } catch {
      if (active === session) result.textContent = 'Dicionário indisponível. Verifique a conexão e tente novamente.';
    } finally {
      clearTimeout(timeout);
      if (active === session) {
        session.lookup = null;
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
