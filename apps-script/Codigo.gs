// Escala da mídia: liga a planilha do Google à página no GitHub Pages.
// Cole este arquivo inteiro em Extensões > Apps Script da planilha (o passo a passo está no LEIA-ME.md).

const NOME_ABA = 'Escala';
const COLUNAS = ['id', 'data', 'tipo', 'tarefa', 'detalhe', 'marca', 'nome', 'token', 'quando'];

// Cada nome fica ligado aos aparelhos que podem usá-lo (pelo código guardado em cada navegador).
// A coluna "token" guarda um ou mais códigos separados por espaço. Um aparelho novo entra
// com o código de 6 números gerado num aparelho que já usa o nome.
// Para liberar um nome do zero, apague a célula "token" da pessoa na aba Pessoas.
const NOME_ABA_PESSOAS = 'Pessoas';
const COLUNAS_PESSOAS = ['nome', 'token', 'desde', 'codigo', 'validade', 'tentativas'];
const MINUTOS_CODIGO = 15;
const MAX_TENTATIVAS = 5;

// Calendário de outubro de 2026. Só é usado pela função configurar.
const OUTUBRO = [
  ['1', '2026-10-01', 'culto', 'Culto', 'Postagem no insta e whats', ''],
  ['2', '2026-10-02', 'resumo', 'Resumo do culto', 'Postar no insta e whats', ''],
  ['3', '2026-10-04', 'oracao', 'Pedido de oração', '', ''],
  ['4', '2026-10-05', 'devocional', 'Devocional', 'Deus ainda está trabalhando · João 5:17', ''],
  ['5', '2026-10-06', 'culto', 'Culto', 'Postagem no insta e whats', ''],
  ['6', '2026-10-07', 'musica', 'Música do dia', '', ''],
  ['7', '2026-10-08', 'culto', 'Culto', 'Postagem no insta e whats', ''],
  ['8', '2026-10-09', 'resumo', 'Resumo do culto', 'Postar no insta e whats', ''],
  ['9', '2026-10-11', 'oracao', 'Pedido de oração', '', ''],
  ['10', '2026-10-12', 'devocional', 'Devocional', 'A alegria que vem do Senhor · Neemias 8:10', 'Saco cheio'],
  ['11', '2026-10-13', 'aviso', 'Aviso', 'Não terá culto · postar no insta e whats', 'Saco cheio'],
  ['12', '2026-10-14', 'musica', 'Música do dia', '', 'Saco cheio'],
  ['13', '2026-10-15', 'aviso', 'Aviso', 'Não terá culto', 'Saco cheio'],
  ['14', '2026-10-15', 'devocional', 'Devocional', 'Reconheça aquilo que Deus já fez · Salmos 126:3', 'Saco cheio'],
  ['15', '2026-10-16', 'aviso', 'Aviso', 'O que é o Momento de fé · postar no insta e whats', 'Saco cheio'],
  ['16', '2026-10-17', 'musica', 'Música do dia', '', ''],
  ['17', '2026-10-18', 'momento', 'Momento de fé', '', ''],
  ['18', '2026-10-19', 'resumo', 'Resumo do Momento de fé', 'Postar no insta e whats', ''],
  ['19', '2026-10-19', 'devocional', 'Devocional', 'Descanse em Deus · Mateus 11:28', ''],
  ['20', '2026-10-20', 'culto', 'Culto', 'Postagem no insta e whats', ''],
  ['21', '2026-10-21', 'musica', 'Música do dia', '', ''],
  ['22', '2026-10-22', 'culto', 'Culto', 'Postagem no insta e whats', ''],
  ['23', '2026-10-23', 'resumo', 'Resumo do culto', 'Postar no insta e whats', ''],
  ['24', '2026-10-25', 'oracao', 'Pedido de oração', 'Caixinha de pedidos', ''],
  ['25', '2026-10-26', 'devocional', 'Devocional', 'O chamado começa na obediência · 1 Samuel 15:22', ''],
  ['26', '2026-10-27', 'culto', 'Culto', 'Postagem no insta e whats', ''],
  ['27', '2026-10-28', 'musica', 'Música do dia', '', ''],
  ['28', '2026-10-29', 'culto', 'Culto', 'Postagem no insta e whats', ''],
  ['29', '2026-10-30', 'resumo', 'Resumo do culto', 'Postar no insta e whats', ''],
  ['30', '2026-10-30', 'devocional', 'Devocional', 'Fechamento do mês: terminar com gratidão e fé · Salmos 37:5', '']
];

// Rode esta função uma vez, pelo editor, para criar a aba Escala já preenchida com outubro.
function configurar() {
  const planilha = SpreadsheetApp.getActive();
  let aba = planilha.getSheetByName(NOME_ABA);
  if (aba && aba.getLastRow() > 1) {
    throw new Error('A aba "' + NOME_ABA + '" já tem dados. Apague ou renomeie a aba antes de rodar de novo.');
  }
  if (!aba) aba = planilha.insertSheet(NOME_ABA);

  // Datas e códigos como texto, para a planilha não transformar em outra coisa.
  aba.getRange('A:B').setNumberFormat('@');
  aba.getRange('H:H').setNumberFormat('@');

  const linhas = OUTUBRO.map(function (t) { return t.concat(['', '', '']); });
  aba.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]).setFontWeight('bold');
  aba.getRange(2, 1, linhas.length, COLUNAS.length).setValues(linhas);
  aba.setFrozenRows(1);
  aba.autoResizeColumns(1, COLUNAS.length);
  aba.hideColumns(COLUNAS.indexOf('token') + 1);
}

// A página pede a lista de tarefas e de nomes.
function doGet(e) {
  const token = (e && e.parameter && e.parameter.token) || '';
  return responder(resposta({}, token));
}

// A página pede uma ação: escalar, desfazer, gerar_codigo ou usar_codigo.
function doPost(e) {
  let pedido;
  try {
    pedido = JSON.parse(e.postData.contents);
  } catch (erro) {
    return responder({ ok: false, erro: 'pedido_invalido' });
  }
  const token = String(pedido.token || '');
  if (token.length < 16 || token.length > 64 || /\s/.test(token)) return responder({ ok: false, erro: 'token_invalido' });

  // Uma pessoa por vez, para duas não pegarem a mesma vaga ao mesmo tempo.
  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    let r;
    if (pedido.acao === 'escalar') r = escalar(pedido.id, pedido.nome, token);
    else if (pedido.acao === 'desfazer') r = desfazer(pedido.id, token);
    else if (pedido.acao === 'gerar_codigo') r = gerarCodigo(pedido.nome, token);
    else if (pedido.acao === 'usar_codigo') r = usarCodigo(pedido.nome, pedido.codigo, token);
    else r = { erro: 'acao_invalida' };
    return responder(resposta(r, token));
  } finally {
    trava.releaseLock();
  }
}

// r: { erro?, ...dados extras da ação }
function resposta(r, token) {
  const pessoas = lerPessoas();
  return Object.assign({}, r, {
    ok: !r.erro,
    erro: r.erro || null,
    tarefas: listar(token, pessoas),
    pessoas: listarPessoas(token, pessoas)
  });
}

// ---------- Leitura das abas ----------

function lerAba() {
  const aba = SpreadsheetApp.getActive().getSheetByName(NOME_ABA);
  if (!aba) throw new Error('Aba "' + NOME_ABA + '" não encontrada. Rode a função configurar primeiro.');
  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0].map(function (c) { return String(c).trim().toLowerCase(); });
  const col = {};
  COLUNAS.forEach(function (nome) { col[nome] = cabecalho.indexOf(nome); });
  return { aba: aba, col: col, linhas: valores.slice(1) };
}

// A aba Pessoas é criada sozinha na primeira vez, já com quem se escalou antes dela existir.
function abaPessoas() {
  const planilha = SpreadsheetApp.getActive();
  let aba = planilha.getSheetByName(NOME_ABA_PESSOAS);
  if (aba) return aba;
  aba = planilha.insertSheet(NOME_ABA_PESSOAS);
  aba.getRange('B:B').setNumberFormat('@');
  aba.getRange(1, 1, 1, COLUNAS_PESSOAS.length).setValues([COLUNAS_PESSOAS]).setFontWeight('bold');
  aba.setFrozenRows(1);

  const d = lerAba();
  const vistos = {};
  const linhas = [];
  d.linhas.forEach(function (l) {
    const nome = texto(l[d.col.nome]);
    const token = texto(l[d.col.token]);
    if (!nome || !token || vistos[chave(nome)]) return;
    vistos[chave(nome)] = true;
    linhas.push([seguro(nome), token, new Date(), '', '', '']);
  });
  if (linhas.length) aba.getRange(2, 1, linhas.length, COLUNAS_PESSOAS.length).setValues(linhas);
  return aba;
}

function lerPessoas() {
  const aba = abaPessoas();
  let valores = aba.getDataRange().getValues();
  let cabecalho = valores[0].map(function (c) { return String(c).trim().toLowerCase(); });

  // Aba criada pela versão anterior: acrescenta as colunas que faltam no fim do cabeçalho.
  const faltam = COLUNAS_PESSOAS.filter(function (c) { return cabecalho.indexOf(c) < 0; });
  if (faltam.length) {
    aba.getRange(1, cabecalho.length + 1, 1, faltam.length).setValues([faltam]).setFontWeight('bold');
    cabecalho = cabecalho.concat(faltam);
  }

  const col = {};
  COLUNAS_PESSOAS.forEach(function (nome) { col[nome] = cabecalho.indexOf(nome); });
  const linhas = [];
  valores.slice(1).forEach(function (l, i) {
    const nome = texto(l[col.nome]);
    if (!nome) return;
    linhas.push({
      nome: nome,
      tokens: texto(l[col.token]).split(/[\s,;]+/).filter(Boolean),
      codigo: texto(l[col.codigo]),
      validade: l[col.validade],
      tentativas: Number(l[col.tentativas]) || 0,
      numero: i + 2
    });
  });
  return { aba: aba, col: col, linhas: linhas };
}

function texto(valor) {
  if (valor instanceof Date) return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(valor == null ? '' : valor).trim();
}

// "Ígor  ferraz" e "Igor Ferraz" contam como o mesmo nome.
function chave(nome) {
  return String(nome).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Evita que um nome começando com = vire fórmula na planilha.
function seguro(nome) {
  return /^[=+\-@]/.test(nome) ? "'" + nome : nome;
}

function acharPessoa(pessoas, nome) {
  const k = chave(nome);
  return pessoas.linhas.find(function (p) { return chave(p.nome) === k; });
}

function ehDoAparelho(pessoa, token) {
  return !!pessoa && !!token && pessoa.tokens.indexOf(token) >= 0;
}

function gravarPessoa(pessoas, p, campos) {
  Object.keys(campos).forEach(function (c) {
    pessoas.aba.getRange(p.numero, pessoas.col[c] + 1).setValue(campos[c]);
  });
}

// ---------- Respostas para a página ----------

function listar(token, pessoas) {
  const d = lerAba();
  return d.linhas
    .filter(function (l) { return texto(l[d.col.id]) && texto(l[d.col.data]); })
    .map(function (l) {
      const nome = texto(l[d.col.nome]);
      return {
        id: texto(l[d.col.id]),
        data: texto(l[d.col.data]),
        tipo: texto(l[d.col.tipo]),
        tarefa: texto(l[d.col.tarefa]),
        detalhe: texto(l[d.col.detalhe]),
        marca: texto(l[d.col.marca]),
        nome: nome,
        seu: !!token && !!nome && (texto(l[d.col.token]) === token || ehDoAparelho(acharPessoa(pessoas, nome), token))
      };
    });
}

// Só o nome e se é deste aparelho. Os códigos dos aparelhos nunca saem da planilha.
function listarPessoas(token, pessoas) {
  return pessoas.linhas
    .map(function (p) { return { nome: p.nome, seu: ehDoAparelho(p, token) }; })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt'); });
}

// ---------- Ações ----------

function acharLinha(id) {
  const d = lerAba();
  const i = d.linhas.findIndex(function (l) { return texto(l[d.col.id]) === String(id); });
  d.indice = i;
  d.linha = d.linhas[i];
  d.numero = i + 2;
  return d;
}

// Liga o nome a este aparelho, ou recusa se ele já for de outro.
function vincular(nome, token) {
  const pessoas = lerPessoas();
  const p = acharPessoa(pessoas, nome);
  if (!p) {
    pessoas.aba.appendRow([seguro(nome), token, new Date(), '', '', '']);
    return { nome: nome };
  }
  if (!p.tokens.length) {
    gravarPessoa(pessoas, p, { token: token });
    return { nome: p.nome };
  }
  if (ehDoAparelho(p, token)) return { nome: p.nome };
  return { erro: 'nome_de_outro' };
}

function escalar(id, nome, token) {
  nome = String(nome || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!nome) return { erro: 'nome_vazio' };
  const d = acharLinha(id);
  if (d.indice < 0) return { erro: 'tarefa_nao_existe' };
  if (texto(d.linha[d.col.nome])) return { erro: 'ocupada' };
  const v = vincular(nome, token);
  if (v.erro) return v;
  d.aba.getRange(d.numero, d.col.nome + 1).setValue(seguro(v.nome));
  d.aba.getRange(d.numero, d.col.token + 1).setValue(token);
  d.aba.getRange(d.numero, d.col.quando + 1).setValue(new Date());
  return {};
}

// Sai da tarefa quem se escalou por este aparelho, ou qualquer aparelho ligado ao nome.
function desfazer(id, token) {
  const d = acharLinha(id);
  if (d.indice < 0) return { erro: 'tarefa_nao_existe' };
  const nome = texto(d.linha[d.col.nome]);
  const dono = nome ? acharPessoa(lerPessoas(), nome) : null;
  if (texto(d.linha[d.col.token]) !== token && !ehDoAparelho(dono, token)) return { erro: 'nao_e_seu' };
  d.aba.getRange(d.numero, d.col.nome + 1).clearContent();
  d.aba.getRange(d.numero, d.col.token + 1).clearContent();
  d.aba.getRange(d.numero, d.col.quando + 1).clearContent();
  return {};
}

// Num aparelho que já usa o nome: cria um código de 6 números para ligar outro aparelho.
function gerarCodigo(nome, token) {
  const pessoas = lerPessoas();
  const p = acharPessoa(pessoas, nome || '');
  if (!ehDoAparelho(p, token)) return { erro: 'nao_e_seu' };
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const validade = new Date(Date.now() + MINUTOS_CODIGO * 60000);
  gravarPessoa(pessoas, p, { codigo: codigo, validade: validade, tentativas: 0 });
  return { codigo: codigo, minutos: MINUTOS_CODIGO };
}

// No aparelho novo: confere o código e acrescenta este aparelho ao nome.
// Depois de MAX_TENTATIVAS erros o código deixa de valer, para ninguém sair chutando.
function usarCodigo(nome, codigo, token) {
  const pessoas = lerPessoas();
  const p = acharPessoa(pessoas, nome || '');
  if (!p) return { erro: 'nome_nao_existe' };
  if (ehDoAparelho(p, token)) return { nome: p.nome };
  const validade = p.validade ? new Date(p.validade).getTime() : 0;
  if (!p.codigo || !(validade > Date.now())) return { erro: 'codigo_expirado' };
  if (String(codigo || '').replace(/\D/g, '') !== p.codigo) {
    const tentativas = p.tentativas + 1;
    if (tentativas >= MAX_TENTATIVAS) {
      gravarPessoa(pessoas, p, { codigo: '', validade: '', tentativas: '' });
      return { erro: 'codigo_expirado' };
    }
    gravarPessoa(pessoas, p, { tentativas: tentativas });
    return { erro: 'codigo_errado' };
  }
  gravarPessoa(pessoas, p, { token: p.tokens.concat([token]).join(' '), codigo: '', validade: '', tentativas: '' });
  return { nome: p.nome };
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
