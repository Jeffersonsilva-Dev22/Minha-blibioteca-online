import {openLibrary, loadLibrary, saveLibrary, getPdf, validatePdf, exportLibrary, readBackup} from './library-storage.js';
import {loadSearchHistory, rememberSearch, suggestSearch} from './search.js';
import {GENRES, genreOptions, searchOptions} from './genres.js';
import {formatWorkYear, parseWorkYear, bookTitle, STATUSES,readBooks,validate,stats,queryBooks} from './core.js';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let books=[], storageFailed=false, pendingDelete=null, view='grid';
let database;
try {
  database = await openLibrary();
  books = await loadLibrary(database, {getItem: key => window.localStorage.getItem(key)});
} catch {
  storageFailed = true;
  try { books = readBooks(window.localStorage); } catch { /* No readable legacy collection. */ }
}
let searchStorage;
try { searchStorage = window.localStorage; } catch { /* Search still works without storage. */ }
let searchHistory = loadSearchHistory(searchStorage);
const filters={search:'',genre:'',status:'',sort:'recent'};
const fieldDefinitions=[['title','Título principal','text',true],['subtitle','Subtítulo (opcional)','text'],['author','Autor','text',true],['genre','Categoria principal','genre',true],['subgenre','Subgênero','subgenre'],['year','Ano da obra (opcional)','number'],['yearEra','Era','era'],['yearApproximate','Ano aproximado','checkbox'],['isbn','ISBN (opcional)','text'],['pages','Total de páginas','number',true],['currentPage','Página atual','number'],['cover','URL da capa (opcional)','url'],['status','Status de leitura','select'],['rating','Avaliação pessoal','rating'],['startDate','Início da leitura','date'],['endDate','Conclusão da leitura','date'],['synopsis','Sinopse','textarea'],['notes','Anotações pessoais','textarea']];
$('#fields').innerHTML=fieldDefinitions.map(([name,label,type,required])=>`<label class="${type==='textarea'?'wide':''}">${label}${required?' *':''}${type==='era'?'<select name="yearEra" class="form-select"><option value="ad">d.C.</option><option value="bc">a.C.</option></select>':type==='checkbox'?'<input name="yearApproximate" type="checkbox" class="form-check-input">':type==='genre'||type==='subgenre'?`<select name="${name}" class="form-select" ${required?'required':''}></select>`:type==='select'?`<select name="${name}" class="form-select">${STATUSES.map(s=>`<option>${s}</option>`).join('')}</select>`:type==='rating'?`<select name="rating" class="form-select"><option value="0">Sem avaliação</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n} ${n===1?'estrela':'estrelas'}</option>`).join('')}</select>`:type==='textarea'?`<textarea name="${name}" class="form-control" rows="3" maxlength="10000"></textarea>`:`<input name="${name}" type="${type}" class="form-control" ${required?'required':''} ${type==='number'?`min="${name==='currentPage'?0:1}" max="${name==='year'?9999:1000000}" step="1"`:''} ${type==='text'?'maxlength="300"':''}>`}</label>`).join('');
const form = $('#book-form');
const genreField = form.elements.genre;
const subgenreField = form.elements.subgenre;

function populateSubgenres(selected = '') {
  const choices = GENRES.get(genreField.value) ?? [];
  subgenreField.replaceChildren(new Option('Sem subgênero', ''));
  for (const choice of choices) subgenreField.add(new Option(choice, choice));
  if (selected && !choices.includes(selected)) subgenreField.add(new Option(selected, selected));
  subgenreField.value = selected;
  subgenreField.disabled = !choices.length && !selected;
}

genreField.addEventListener('change', () => populateSubgenres());

function notify(message) {$('#toast').textContent=message;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
let mutationPending = false;
async function persist(next, attachments = []) {
  if (storageFailed) throw Error('O armazenamento da coleção está indisponível.');
  await saveLibrary(database, books, next, attachments);
  books = next;
}
const progress=b=>Math.round(b.currentPage/b.pages*100);
function cover(b) {return `<div class="book-cover" style="--cover-hue:${Array.from(b.title).reduce((n,c)=>n+c.charCodeAt(0),0)%70+200}"><span class="cover-fallback"><small>MINHA BIBLIOTECA</small><strong>${esc(bookTitle(b))}</strong><span>${esc(b.author)}</span><i>▤</i></span>${b.cover?`<img src="${esc(b.cover)}" alt="Capa de ${esc(bookTitle(b))}" loading="lazy" referrerpolicy="no-referrer">`:''}</div>`;}
function card(b){return `<button class="book-card" data-action="details" data-id="${esc(b.id)}">${cover(b)}<div class="book-info"><span class="book-genre">${esc(b.genre)}${b.subgenre?' · '+esc(b.subgenre):''} · ${formatWorkYear(b)}</span><h3>${esc(bookTitle(b))}</h3><p>${esc(b.author)}</p><div class="book-meta"><span class="status status-${STATUSES.indexOf(b.status)}">${esc(b.status)}</span>${b.rating?`<span class="stars" aria-label="${b.rating} de 5 estrelas">${'★'.repeat(b.rating)}</span>`:''}</div>${b.status==='Lendo'?`<div class="reading-line"><span>Leitura</span><span>${progress(b)}%</span></div><progress max="100" value="${progress(b)}" aria-label="Progresso de ${esc(bookTitle(b))}"></progress>`:''}</div></button>`;}
function wireImages(){document.querySelectorAll('.book-cover img').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true}));}
function metrics(s){return `<div class="metrics">${[['Livros na coleção',s.total,'▥'],['Leituras concluídas',s.completed,'✓'],['Lendo agora',s.reading,'▤'],['Quero ler',s.wanted,'◇']].map(([label,n,icon])=>`<article class="metric"><span class="metric-icon">${icon}</span><p>${label}</p><strong>${n}</strong></article>`).join('')}</div>`;}
function empty(filtered=false){return `<div class="empty"><span>▤</span><h3>${filtered?'Nenhum livro encontrado':'Uma estante cheia de possibilidades'}</h3><p>${filtered?'Experimente outra pesquisa ou ajuste os filtros.':'Cadastre seu primeiro livro e comece a contar sua história de leitura.'}</p>${filtered?'':'<button class="btn btn-primary" data-action="add">+ Adicionar meu primeiro livro</button>'}</div>`;}
function render(){const route=location.hash.slice(1)||'inicio',s=stats(books);document.querySelectorAll('nav a').forEach(a=>{const active=a.hash===`#${route}`;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
const warning=storageFailed?'<div class="alert alert-warning" role="alert">Não foi possível ler os dados locais. Para proteger sua coleção, o salvamento está bloqueado. Verifique as permissões e faça uma cópia dos dados do navegador antes de tentar recuperá-los.</div>':'';
if(route==='biblioteca'){$('#main').innerHTML=warning+`<div class="page-heading"><div><span class="eyebrow">CADA LIVRO, UMA DESCOBERTA</span><h1>Minha biblioteca<span>.</span></h1><p>Todos os seus livros, em um só lugar.</p></div><span class="count">${s.total} livros na coleção</span></div><section class="filterbar" aria-label="Filtros da biblioteca"><form class="search catalog-search" id="search-form" role="search"><label for="search">Pesquisar</label><div class="search-controls"><input id="search" class="form-control" placeholder="Título, subtítulo, autor ou gênero…" value="${esc(filters.search)}" type="search" maxlength="300" autocomplete="off" aria-controls="search-suggestions"><button class="btn btn-primary" type="submit">Buscar</button></div><div id="search-suggestions" class="search-suggestions"></div></form><label>Categoria<select id="genre" class="form-select"><option value="">Todas as categorias</option>${genreOptions(books).map(g=>`<option ${filters.genre===g?'selected':''}>${esc(g)}</option>`).join('')}</select></label><label>Status<select id="status" class="form-select"><option value="">Todos os status</option>${STATUSES.map(g=>`<option ${filters.status===g?'selected':''}>${g}</option>`).join('')}</select></label><label>Ordenar por<select id="sort" class="form-select">${[['recent','Mais recentes'],['year','Ano da obra (mais antigo primeiro)'],['title','Título'],['author','Autor'],['rating','Avaliação']].map(([v,l])=>`<option value="${v}" ${filters.sort===v?'selected':''}>${l}</option>`).join('')}</select></label><div class="view-switch" aria-label="Visualização"><button class="icon-button" data-action="grid" aria-label="Grade" aria-pressed="${view==='grid'}">▦</button><button class="icon-button" data-action="list" aria-label="Lista" aria-pressed="${view==='list'}">☰</button></div></section><p id="result-count" class="muted" aria-live="polite"></p><section id="catalog" aria-label="Livros"></section>`;bindCatalogSearch();
  for (const id of ['genre', 'status', 'sort']) {
    $('#'+id).addEventListener('change', event => {
      filters[id] = event.target.value;
      renderCatalog();
    });
  }
  renderCatalog();}
else if(route==='estatisticas'){$('#main').innerHTML=warning+`<div class="page-heading"><div><span class="eyebrow">SUA JORNADA EM NÚMEROS</span><h1>Estatísticas<span>.</span></h1><p>Pequenas leituras. Grandes conquistas.</p></div></div>${metrics(s)}<div class="statistics-grid"><article class="panel"><h2>Seu ritmo de leitura</h2><div class="big-number">${s.pagesRead.toLocaleString('pt-BR')}<small>páginas lidas</small></div><p>Média das avaliações: <strong>${s.average?s.average.toFixed(1)+' / 5':'Sem avaliações'}</strong></p><p>Progresso das páginas da coleção: ${s.progress}%</p><progress max="100" value="${s.progress}" aria-label="Progresso geral"></progress></article><article class="panel"><h2>Histórias por gênero</h2>${Object.entries(s.genres).map(([g,n])=>`<div class="genre-row"><span>${esc(g)}</span><strong>${n}</strong><progress max="${s.total}" value="${n}" aria-label="${esc(g)}: ${n} livros"></progress></div>`).join('')||'<p class="muted">Os gêneros aparecerão após cadastrar seu primeiro livro.</p>'}</article></div><p class="muted mt-4">As estatísticas consideram somente os dados cadastrados. A média exclui livros sem avaliação; páginas lidas correspondem à página atual de cada livro.</p>`;}
else {$('#main').innerHTML=warning+`<section class="welcome"><div><span class="eyebrow">BEM-VINDO À SUA BIBLIOTECA</span><h1>Boas histórias<br>merecem um lugar<span>.</span></h1><p>Organize seus livros, acompanhe suas leituras<br>e redescubra o prazer de cada página.</p><button class="btn btn-primary" data-action="add">+ Adicionar um livro</button></div><div class="hero-art" aria-hidden="true"><div class="art-orbit"></div><div class="art-book book-back">HISTÓRIAS<br>PARA GUARDAR</div><div class="art-book book-front"><span>UM NOVO CAPÍTULO</span><strong>Sua próxima<br>descoberta.</strong><i>✧</i></div><div class="art-caption">SUA ESTANTE, SEU UNIVERSO</div></div></section>${metrics(s)}<div class="section-heading"><div><span class="eyebrow">MAIS UM CAPÍTULO</span><h2>Continue sua leitura</h2></div><a href="#biblioteca">Ver biblioteca →</a></div><section class="reading-panel">${books.some(b=>b.status==='Lendo')?`<div class="catalog">${books.filter(b=>b.status==='Lendo').slice(0,3).map(card).join('')}</div>`:'<div class="reading-empty"><span>▤</span><div><h3>Qual será sua próxima leitura?</h3><p>Seus livros com status “Lendo” aparecem aqui.</p></div><a href="#biblioteca">Escolher um livro →</a></div>'}<div class="overall"><div><strong>Seu progresso geral</strong><span>${s.progress}% das páginas da coleção</span></div><progress max="100" value="${s.progress}" aria-label="Progresso geral"></progress></div></section><div class="section-heading"><div><span class="eyebrow">NOVIDADES NA ESTANTE</span><h2>Adicionados recentemente</h2></div><a href="#biblioteca">Ver todos →</a></div><section class="catalog">${books.length?queryBooks(books).slice(0,4).map(card).join(''):empty()}</section>`;}wireImages();}
function bindCatalogSearch() {
  const form = $('#search-form');
  const input = $('#search');
  const suggestions = $('#search-suggestions');
  const options = searchOptions(books);

  function renderSuggestions() {
    const query = input.value.trim();
    const terms = query ? suggestSearch(options, query) : searchHistory;
    suggestions.hidden = terms.length === 0;
    suggestions.innerHTML = terms.length
      ? `<p>${query ? 'Sugestões' : 'Buscas recentes'}</p>${terms.map(term =>
          `<button type="button" value="${esc(term)}">${esc(term)}</button>`
        ).join('')}`
      : '';
  }

  input.addEventListener('focus', renderSuggestions);
  input.addEventListener('input', () => {
    filters.search = input.value;
    renderCatalog();
    renderSuggestions();
  });

  function submitSearch() {
    filters.search = input.value.trim();
    input.value = filters.search;
    searchHistory = rememberSearch(searchStorage, searchHistory, filters.search);
    renderCatalog();
    suggestions.hidden = true;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    submitSearch();
  });
  suggestions.addEventListener('click', event => {
    const option = event.target.closest('button');
    if (!option) return;
    input.value = option.value;
    input.focus();
    submitSearch();
  });
  form.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !suggestions.hidden) {
      event.preventDefault();
      input.focus();
      suggestions.hidden = true;
    } else if (event.key === 'ArrowDown' && event.target === input && !suggestions.hidden) {
      const firstOption = suggestions.querySelector('button');
      if (firstOption) {
        event.preventDefault();
        firstOption.focus();
      }
    }
  });
  renderSuggestions();
}

function renderCatalog(){const filtered=queryBooks(books,filters);$('#result-count').textContent=`${filtered.length} ${filtered.length===1?'livro encontrado':'livros encontrados'}`;$('#catalog').className='catalog '+(view==='list'?'list-view':'');$('#catalog').innerHTML=filtered.length?filtered.map(card).join(''):empty(books.length>0);wireImages();}
function openEditor(id){const b=books.find(b=>b.id===id);form.reset();$('#attached-pdf').textContent=b?.pdfName??'Nenhum PDF anexado';$('#remove-pdf-label').hidden=!b?.pdfName;genreField.replaceChildren(new Option('Selecione uma categoria', ''));for(const genre of genreOptions(books))genreField.add(new Option(genre,genre));genreField.value=b?.genre??'';populateSubgenres(b?.subgenre);$('#form-error').textContent='';$('#editor-title').textContent=b?'Editar livro':'Adicionar livro';$('#book-form').elements.id.value='';$('#book-form').elements.currentPage.value=0;if(b)Object.entries(b).forEach(([k,v])=>{if($('#book-form').elements.namedItem(k) && k!=='pdfFile' && k!=='removePdf' && !['year','yearEra','yearApproximate'].includes(k))$('#book-form').elements.namedItem(k).value=v;});
  form.elements.year.value = b?.year == null ? '' : Math.abs(b.year);
  form.elements.yearEra.value = b?.year < 0 ? 'bc' : 'ad';
  form.elements.yearApproximate.checked = b?.yearApproximate === true;
  $('#details').close();
  $('#editor').showModal();
}
function showDetails(id){const b=books.find(b=>b.id===id);if(!b)return;$('#details').innerHTML=`<div class="dialog-heading"><span class="eyebrow">UM LIVRO DA SUA COLEÇÃO</span><button class="icon-button" data-action="close-details" aria-label="Fechar detalhes">×</button></div><div class="detail-layout">${cover(b)}<div><span class="book-genre">${esc(b.genre)}${b.subgenre?' · '+esc(b.subgenre):''}</span><h2 id="detail-title">${esc(bookTitle(b))}</h2><p>${esc(b.author)} · ${formatWorkYear(b)}</p><span class="status status-${STATUSES.indexOf(b.status)}">${b.status}</span><p class="mt-3">${b.rating?'★'.repeat(b.rating)+' · '+b.rating+'/5':'Sem avaliação'}</p><p>ISBN: ${esc(b.isbn)||'Não informado'}</p><p>${b.currentPage} de ${b.pages} páginas · ${progress(b)}%</p><progress value="${b.currentPage}" max="${b.pages}" aria-label="Progresso da leitura"></progress><p class="mt-3">Início: ${formatDate(b.startDate)}<br>Conclusão: ${formatDate(b.endDate)}</p></div></div><h3 class="mt-4">Sinopse</h3><p class="preserve">${esc(b.synopsis)||'Nenhuma sinopse cadastrada.'}</p><h3>Anotações pessoais</h3><p class="preserve">${esc(b.notes)||'Nenhuma anotação por enquanto.'}</p><div class="dialog-actions">${b.pdfName?`<button class="btn btn-primary" data-action="read-pdf" data-id="${esc(b.id)}">Ler PDF</button>`:''}<button class="btn btn-outline-danger" data-action="delete" data-id="${esc(b.id)}">Excluir</button><button class="btn btn-primary" data-action="edit" data-id="${esc(b.id)}">Editar livro e progresso</button></div>`;$('#details').showModal();wireImages();}
function formatDate(date){return date?date.split('-').reverse().join('/'):'Não informada';}
document.addEventListener('click',e=>{const target=e.target.closest('[data-action]');if(!target)return;const {action,id}=target.dataset;if(action==='add')openEditor();if(action==='edit')openEditor(id);if(action==='details')showDetails(id);if(action==='close-editor'&&!mutationPending)$('#editor').close();if(action==='close-details')$('#details').close();if(action==='delete'){pendingDelete=id;$('#delete-dialog').showModal();}if(action==='cancel-delete'&&!mutationPending){$('#delete-dialog').close();pendingDelete=null;}if(action==='confirm-delete')deleteBook();if(action==='read-pdf')openReader(id);if(action==='close-reader')$('#pdf-reader').close();if(action==='backup')$('#backup-dialog').showModal();if(action==='close-backup'&&!mutationPending)$('#backup-dialog').close();if(action==='export-backup')downloadBackup();if(action==='grid'||action==='list'){view=action;render();}});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (mutationPending) return;
  mutationPending = true;
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  const error = $('#form-error');
  error.textContent = '';
  try {
    const {pdfFile, removePdf, yearEra, yearApproximate, ...data} = Object.fromEntries(new FormData(form));
    for (const field of ['pages', 'currentPage', 'rating']) data[field] = Number(data[field]);
    const previous = books.find(book => book.id === data.id);
    const book = validate({
      ...data, year: parseWorkYear(data.year, yearEra), yearApproximate: yearApproximate === 'on',
      id: previous?.id ?? crypto.randomUUID(),
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      pdfName: pdfFile?.name ? pdfFile.name : removePdf ? '' : previous?.pdfName ?? '',
    });
    const changes = pdfFile?.name ? [[book.id, await validatePdf(pdfFile)]]
      : removePdf ? [[book.id, null]] : [];
    const next = previous ? books.map(item => item.id === book.id ? book : item) : [...books, book];
    await persist(next, changes);
    $('#editor').close();
    render();
    notify(previous ? 'Livro atualizado.' : 'Livro adicionado à biblioteca.');
  } catch (failure) {
    error.textContent = failure.message;
  } finally {
    mutationPending = false;
    submit.disabled = false;
  }
});

async function deleteBook() {
  if (!pendingDelete || mutationPending) return;
  const id = pendingDelete;
  mutationPending = true;
  try {
    await persist(books.filter(book => book.id !== id), [[id, null]]);
    $('#delete-dialog').close();
    $('#details').close();
    pendingDelete = null;
    render();
    notify('Livro excluído da coleção.');
  } catch (error) {
    notify(error.message);
  } finally {
    mutationPending = false;
  }
}

let readerUrl;
let readerPending = false;
async function openReader(id) {
  const book = books.find(item => item.id === id);
  if (!book || readerPending || $('#pdf-reader').open) return;
  readerPending = true;
  try {
    const pdf = await getPdf(database, id);
    if (!pdf) throw Error('O PDF não está disponível neste navegador.');
    readerUrl = URL.createObjectURL(pdf);
    $('#pdf-title').textContent = bookTitle(book);
    $('#pdf-frame').src = readerUrl;
    $('#pdf-download').href = readerUrl;
    $('#pdf-download').download = book.pdfName;
    $('#pdf-reader').showModal();
  } catch (error) {
    notify(error.message);
  } finally {
    readerPending = false;
  }
}

$('#pdf-reader').addEventListener('close', () => {
  $('#pdf-frame').removeAttribute('src');
  $('#pdf-download').removeAttribute('href');
  if (readerUrl) URL.revokeObjectURL(readerUrl);
  readerUrl = undefined;
});

let exportPending = false;
async function downloadBackup() {
  if (exportPending) return;
  exportPending = true;
  const status = $('#backup-status');
  status.textContent = 'Preparando backup…';
  try {
    if (storageFailed) throw Error('A coleção está indisponível.');
    const backup = await exportLibrary(database);
    const url = URL.createObjectURL(backup);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'minha-biblioteca-backup.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status.textContent = 'Backup preparado para download.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    exportPending = false;
  }
}

$('#restore-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (mutationPending) return;
  mutationPending = true;
  const restore = event.currentTarget;
  const button = restore.querySelector('button');
  button.disabled = true;
  const status = $('#backup-status');
  status.textContent = 'Lendo backup…';
  try {
    const imported = await readBackup(restore.elements.backupFile.files[0]);
    const existing = new Set(books.map(book => book.id));
    const added = imported.books.filter(book => !existing.has(book.id));
    const pdfs = added.filter(book => book.pdfName).map(book => [book.id, imported.attachments.get(book.id)]);
    await persist([...books, ...added], pdfs);
    restore.reset();
    render();
    status.textContent = `Livros importados: ${added.length}. Já existentes: ${imported.books.length - added.length}.`;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    mutationPending = false;
    button.disabled = false;
  }
});

for (const selector of ['#editor', '#delete-dialog', '#backup-dialog']) {
  $(selector).addEventListener('cancel', event => {
    if (mutationPending) event.preventDefault();
  });
}
window.addEventListener('hashchange',()=>{render();$('#main').focus();});render();
