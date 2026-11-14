import {readBooks} from './core.js';

const DB_NAME = 'minha-biblioteca';
const KEY = 'collection';
const FORMAT = 'minha-biblioteca-backup';
export const MAX_PDF = 150 * 1024 * 1024;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function openLibrary() {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('library');
    request.result.createObjectStore('pdfs');
  };
  const db = await requestResult(request);
  db.onversionchange = () => db.close();
  return db;
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error ?? Error('Operação cancelada.'));
  });
}

export async function loadLibrary(db, legacy) {
  const transaction = db.transaction('library', 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore('library');
  let books;
  try {
    books = await requestResult(store.get(KEY));
    if (books === undefined) {
      books = readBooks(legacy);
      store.put(books, KEY);
    }
  } catch (error) {
    transaction.abort();
    await done.catch(() => {});
    throw error;
  }
  await done;
  return books;
}

export async function saveLibrary(db, previous, next, attachments = []) {
  const transaction = db.transaction(['library', 'pdfs'], 'readwrite');
  const done = transactionDone(transaction);
  const library = transaction.objectStore('library');
  const pdfs = transaction.objectStore('pdfs');
  try {
    const current = await requestResult(library.get(KEY));
    if (JSON.stringify(current) !== JSON.stringify(previous)) {
      throw Error('A coleção mudou em outra aba. Recarregue a página antes de salvar.');
    }
    library.put(next, KEY);
    for (const [id, file] of attachments) {
      if (file) pdfs.put(file, id);
      else pdfs.delete(id);
    }
  } catch (error) {
    transaction.abort();
    await done.catch(() => {});
    throw error;
  }
  await done;
}

export function getPdf(db, id) {
  return requestResult(db.transaction('pdfs').objectStore('pdfs').get(id));
}

export async function validatePdf(file) {
  if (file.size > MAX_PDF) throw Error('Escolha um PDF de até 150 MB.');
  const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== '%PDF-') throw Error('O arquivo escolhido não é um PDF válido.');
  return file.slice(0, file.size, 'application/pdf');
}

function encodePdf(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function exportLibrary(db) {
  const transaction = db.transaction(['library', 'pdfs']);
  const books = await requestResult(transaction.objectStore('library').get(KEY));
  const store = transaction.objectStore('pdfs');
  const attachments = await Promise.all(books.filter(book => book.pdfName).map(async book => {
    const blob = await requestResult(store.get(book.id));
    if (!blob) throw Error('O PDF de um livro não foi encontrado. O backup não foi gerado.');
    return {id: book.id, data: await encodePdf(blob)};
  }));
  return new Blob([JSON.stringify({format: FORMAT, version: 1, books, attachments})],
    {type: 'application/json'});
}

export async function readBackup(file) {
  const backup = JSON.parse(await file.text());
  if (backup?.format !== FORMAT || backup.version !== 1
      || !Array.isArray(backup.books) || !Array.isArray(backup.attachments)) {
    throw Error('Selecione um backup da Minha Biblioteca Online.');
  }
  const books = readBooks({getItem: () => JSON.stringify(backup.books)});
  const expected = new Set(books.filter(book => book.pdfName).map(book => book.id));
  const attachments = new Map();
  for (const {id, data} of backup.attachments) {
    if (!expected.delete(id) || typeof data !== 'string' || data.length > Math.ceil(MAX_PDF / 3) * 4) {
      throw Error('O backup contém anexos inválidos.');
    }
    const decoded = atob(data);
    const bytes = new Uint8Array(decoded.length);
    for (let offset = 0; offset < bytes.length; offset++) {
      bytes[offset] = decoded.charCodeAt(offset);
    }
    attachments.set(id, await validatePdf(new Blob([bytes])));
  }
  if (expected.size) throw Error('Há PDFs faltando no backup.');
  return {books, attachments};
}
