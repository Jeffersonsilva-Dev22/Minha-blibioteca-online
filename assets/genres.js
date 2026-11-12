export const GENRES = new Map([
  ['Romance', ['Histórico', 'Psicológico', 'Romântico']],
  ['Fantasia', ['Épica', 'Urbana', 'Sombria']],
  ['Ficção científica', ['Cyberpunk', 'Distopia', 'Espacial']],
  ['Terror', ['Gótico', 'Sobrenatural', 'Psicológico']],
  ['Suspense e mistério', ['Policial', 'Investigação', 'Thriller']],
  ['Aventura e ação', ['Exploração', 'Sobrevivência']],
  ['Clássicos literários', ['Literatura clássica', 'Gótica']],
  ['Filosofia', ['Ética', 'Existencialismo']],
  ['História', ['Antiga', 'Medieval', 'Contemporânea']],
  ['Política e sociedade', ['Sociologia', 'Economia', 'Geopolítica']],
  ['Ciência e tecnologia', ['Física', 'Programação', 'IA']],
  ['Psicologia', ['Comportamento', 'Cognição']],
  ['Desenvolvimento pessoal', ['Produtividade', 'Finanças']],
  ['Biografias', ['Autobiografias', 'Memórias']],
  ['Quadrinhos e mangás', ['Mangá', 'Graphic novel']],
]);

export function genreOptions(books) {
  return [...new Set([...GENRES.keys(), ...books.map(book => book.genre)])];
}

export function searchOptions(books) {
  const bookTerms = books.flatMap(book => [book.title, book.author, book.subgenre]);
  const genreTerms = [...GENRES.values()].flat();
  return [...new Set([...bookTerms, ...genreOptions(books), ...genreTerms].filter(Boolean))];
}
