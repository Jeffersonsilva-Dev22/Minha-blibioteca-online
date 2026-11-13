import {searchRank} from './search.js';

export const STATUSES = ['Quero ler', 'Lendo', 'Concluído', 'Abandonado'];
export const KEY = 'minha-biblioteca:v1';
export {normalize} from './search.js';
export function bookTitle(book) {
  const subtitle = book.subtitle?.trim();
  return subtitle ? `${book.title}: ${subtitle}` : book.title;
}

export function validate(book) {
  if (!book.title?.trim() || !book.author?.trim() || !book.genre?.trim()) throw Error('Preencha título, autor e gênero.');
  for (const field of ['pages','currentPage','year','rating']) if (!Number.isInteger(book[field])) throw Error('Use números inteiros nos campos numéricos.');
  if (book.pages < 1 || book.currentPage < 0 || book.currentPage > book.pages) throw Error('A página atual deve estar entre zero e o total de páginas.');
  if (book.year < 1 || book.year > 9999 || book.rating < 0 || book.rating > 5) throw Error('Verifique o ano e a avaliação.');
  if (!STATUSES.includes(book.status)) throw Error('Status de leitura inválido.');
  if (book.startDate && !validDate(book.startDate) || book.endDate && !validDate(book.endDate)) throw Error('Data inválida.');
  if (book.startDate && book.endDate && book.endDate < book.startDate) throw Error('A conclusão não pode ser anterior ao início.');
  if (book.cover && !/^https?:\/\//i.test(book.cover)) throw Error('A capa deve usar um endereço http ou https.');
  return {...book, title:book.title.trim(), subtitle:typeof book.subtitle === 'string' ? book.subtitle.trim() : '', author:book.author.trim(), genre:book.genre.trim(), currentPage:book.status === 'Concluído' ? book.pages : book.currentPage};
}
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }
export function stats(books) {
  const totalPages=books.reduce((n,b)=>n+b.pages,0), pagesRead=books.reduce((n,b)=>n+b.currentPage,0), rated=books.filter(b=>b.rating>0);
  return {total:books.length, completed:books.filter(b=>b.status==='Concluído').length, reading:books.filter(b=>b.status==='Lendo').length, wanted:books.filter(b=>b.status==='Quero ler').length, pagesRead, progress:totalPages?Math.round(pagesRead/totalPages*100):0, average:rated.length?rated.reduce((n,b)=>n+b.rating,0)/rated.length:0, genres:books.reduce((g,b)=>(g[b.genre]=(g[b.genre]||0)+1,g),{})};
}
export function queryBooks(books, {search='',genre='',status='',sort='recent'}={}) {
  const term = search.trim();
  return books.filter(b=>(!term||[b.title + " " + b.author, bookTitle(b), b.subtitle, b.genre, b.subgenre].some(value => Number.isFinite(searchRank(value, term))))&&(!genre||b.genre===genre)&&(!status||b.status===status)).sort((a,b)=>sort==='rating'?b.rating-a.rating:sort==='title'?bookTitle(a).localeCompare(bookTitle(b),'pt-BR'):sort==='author'?a.author.localeCompare(b.author,'pt-BR'):b.createdAt.localeCompare(a.createdAt));
}
export function readBooks(storage) {
  const raw=storage.getItem(KEY); if (!raw) return [];
  const books=JSON.parse(raw); if (!Array.isArray(books)) throw Error('Formato de armazenamento inválido.');
  const ids=new Set(); return books.map(b=>{if(typeof b.id!=='string'||!b.id||ids.has(b.id)||typeof b.createdAt!=='string'||!Number.isFinite(Date.parse(b.createdAt))) throw Error('Registro inválido.'); ids.add(b.id);return validate(b);});
}
export function saveBooks(storage, books) {storage.setItem(KEY,JSON.stringify(books));}
