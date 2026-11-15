const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38';

export async function openPdfDocument(url) {
  const library = await import(PDFJS + '/build/pdf.min.mjs');
  library.GlobalWorkerOptions.workerSrc = PDFJS + '/build/pdf.worker.min.mjs';
  const task = library.getDocument({
    url, isEvalSupported: false,
    cMapUrl: PDFJS + '/cmaps/', cMapPacked: true,
    standardFontDataUrl: PDFJS + '/standard_fonts/',
    wasmUrl: PDFJS + '/wasm/',
  });
  return {library, task};
}

export async function countPdfPages(blob, open = openPdfDocument) {
  const url = URL.createObjectURL(blob);
  let task;
  try {
    ({task} = await open(url));
    const pdf = await task.promise;
    if (!Number.isSafeInteger(pdf.numPages) || pdf.numPages < 1) {
      throw Error('O PDF não contém páginas.');
    }
    return pdf.numPages;
  } finally {
    try {
      if (task) await task.destroy();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
