# Minha Biblioteca Online

Aplicação para organizar uma coleção pessoal de livros e acompanhar leituras. Projeto de portfólio em desenvolvimento por etapas, sem empréstimos, devoluções ou reservas.

## Fase 1 — implementada

- Dashboard com contagens, leituras em andamento, progresso e livros recentes.
- Cadastro, edição, detalhes e exclusão com confirmação.
- Título, autor, gênero, ano, ISBN, páginas, capa por URL, sinopse e anotações.
- Status: Quero ler, Lendo, Concluído e Abandonado.
- Página atual, datas de início e conclusão e avaliação de 1 a 5 estrelas.
- Busca por título, autor, categoria ou subgênero, com sugestões durante a digitação, filtros combinados, quatro ordenações e grade/lista.
- 15 categorias fixas e subgêneros opcionais. Gêneros de livros já cadastrados continuam disponíveis.
- Estatísticas calculadas exclusivamente a partir da coleção cadastrada.
- Layout responsivo, formulários rotulados, navegação por teclado, mensagens acessíveis e redução de movimento.

## Executar

Requer Node.js com npm. Na pasta do projeto:

```sh
npm start
```

O comando utiliza `npx` para baixar e executar `http-server` e informa o endereço local. Alternativamente, sirva esta pasta com a extensão Live Server do VS Code. Abra via HTTP: módulos JavaScript não devem ser executados diretamente por `file://`.

Bootstrap 5.3.3 e fontes são carregados por CDN; acesso à internet é necessário para carregar esses recursos. Não há build nem dependências de aplicação instaladas. O CSS personalizado e a lógica estão no projeto.

## Organização e decisões

```text
index.html          Estrutura e diálogos acessíveis
assets/style.css    Identidade visual e layouts responsivos
assets/app.js       Interface, eventos, CRUD e feedback
assets/core.js      Validação, armazenamento, filtros e cálculos
assets/genres.js    Categorias, subgêneros e sugestões de busca
tests/core.test.js  Testes da lógica com node:test
```

A lógica independente do DOM facilita testes e a futura migração para React. O IndexedDB armazena livros e anexos. Na primeira abertura, os registros da chave antiga `minha-biblioteca:v1` do localStorage são importados automaticamente. A coleção começa vazia. Capas são opcionais; sem imagem, o aplicativo gera uma representação tipográfica com título e autor. URLs de capa aceitam apenas HTTP/HTTPS.

Progresso geral = soma das páginas atuais / soma das páginas totais. Livros concluídos têm a página atual ajustada ao total ao salvar. Média das avaliações considera apenas livros avaliados. O status de conclusão não preenche automaticamente uma data: registre a data real no formulário.

Os dados pertencem ao navegador e à origem utilizados, sem sincronização entre dispositivos. Limpar dados do navegador remove a coleção. Em **Backup**, exporte a coleção e os PDFs juntos em JSON. A restauração acrescenta registros ausentes e preserva os livros que já existem. Falhas de escrita são informadas sem atualizar a coleção em memória; dados inválidos na leitura bloqueiam gravações para evitar sobrescrever registros existentes.

## Verificação

```sh
npm test
```

A suíte contém seis grupos: CRUD e persistência, estatísticas, pesquisa/filtros, ordenações, validações e armazenamento inválido/indisponível. Durante a implementação, as verificações desses grupos foram executadas no runtime Node disponível e passaram. O comando `npm test` não foi executado no terminal Windows, onde Node não estava no PATH.

**Pendente:** teste visual e fluxos completos em navegador, inclusive em telas móveis. Media queries foram implementadas, mas não equivalem a uma verificação visual realizada.

Roteiro manual: cadastrar um livro; recarregar e confirmar persistência; editar página/status/avaliação; conferir detalhes e estatísticas; combinar busca e filtros; alternar grade/lista; cancelar e confirmar exclusão; verificar larguras de 360, 768 e 1440 px e navegação por teclado.

## Próxima fase — depende de autorização

React e Bootstrap no frontend; ASP.NET Core Web API com C#, Entity Framework Core e MySQL no backend. Cadastro/login, autenticação segura e autorização por usuário deverão garantir que cada biblioteca seja acessível somente ao seu proprietário. A Fase 2 ainda não foi iniciada.
A versão de demonstração usa o GitHub Pages.

### Leitor de PDF

No cadastro ou na edição, anexe um PDF de até 25 MB. Abra os detalhes do livro e selecione **Ler PDF** para usar o visualizador nativo do navegador. Se ele não estiver disponível, baixe o anexo pelo link no leitor. Os PDFs ficam no IndexedDB do navegador e não são enviados a um servidor.
