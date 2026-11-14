const OCR_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/';
let loading;

function loadEngine() {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = OCR_CDN + 'tesseract.min.js';
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => {
      script.remove();
      reject(Error('Não foi possível baixar o mecanismo de OCR.'));
    };
    document.head.append(script);
  }).catch(error => {
    loading = undefined;
    throw error;
  });
  return loading;
}

export async function recognizePage(canvas, {signal, onProgress}) {
  signal.throwIfAborted();
  const engine = await loadEngine();
  signal.throwIfAborted();
  const worker = await engine.createWorker('por', 1, {
    workerPath: OCR_CDN + 'worker.min.js',
    logger: message => {
      if (!signal.aborted && message.status === 'recognizing text') {
        onProgress(Math.round(message.progress * 100));
      }
    },
  });
  const stop = () => { void worker.terminate().catch(() => {}); };
  signal.addEventListener('abort', stop, {once: true});
  try {
    signal.throwIfAborted();
    const {data} = await worker.recognize(canvas);
    return data.text.trim();
  } finally {
    signal.removeEventListener('abort', stop);
    if (!signal.aborted) await worker.terminate();
  }
}
