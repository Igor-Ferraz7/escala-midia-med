// Escala da mídia: liga a planilha do Google à página no GitHub Pages.
// Cole este arquivo inteiro em Extensões > Apps Script da planilha (o passo a passo está no LEIA-ME.md).

const NOME_ABA = 'Escala';
const COLUNAS = ['id', 'data', 'tipo', 'tarefa', 'detalhe', 'marca', 'nome', 'token', 'quando'];

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

// A página pede a lista de tarefas.
function doGet(e) {
  const token = (e && e.parameter && e.parameter.token) || '';
  return responder({ ok: true, tarefas: listar(token) });
}

// A página pede para escalar alguém ou para desfazer.
function doPost(e) {
  let pedido;
  try {
    pedido = JSON.parse(e.postData.contents);
  } catch (erro) {
    return responder({ ok: false, erro: 'pedido_invalido' });
  }
  const token = String(pedido.token || '');
  if (token.length < 16 || token.length > 64) return responder({ ok: false, erro: 'token_invalido' });

  // Uma pessoa por vez, para duas não pegarem a mesma vaga ao mesmo tempo.
  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    let erro;
    if (pedido.acao === 'escalar') erro = escalar(pedido.id, pedido.nome, token);
    else if (pedido.acao === 'desfazer') erro = desfazer(pedido.id, token);
    else erro = 'acao_invalida';
    return responder({ ok: !erro, erro: erro || null, tarefas: listar(token) });
  } finally {
    trava.releaseLock();
  }
}

function lerAba() {
  const aba = SpreadsheetApp.getActive().getSheetByName(NOME_ABA);
  if (!aba) throw new Error('Aba "' + NOME_ABA + '" não encontrada. Rode a função configurar primeiro.');
  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0].map(function (c) { return String(c).trim().toLowerCase(); });
  const col = {};
  COLUNAS.forEach(function (nome) { col[nome] = cabecalho.indexOf(nome); });
  return { aba: aba, col: col, linhas: valores.slice(1) };
}

function texto(valor) {
  if (valor instanceof Date) return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(valor == null ? '' : valor).trim();
}

function listar(token) {
  const d = lerAba();
  return d.linhas
    .filter(function (l) { return texto(l[d.col.id]) && texto(l[d.col.data]); })
    .map(function (l) {
      return {
        id: texto(l[d.col.id]),
        data: texto(l[d.col.data]),
        tipo: texto(l[d.col.tipo]),
        tarefa: texto(l[d.col.tarefa]),
        detalhe: texto(l[d.col.detalhe]),
        marca: texto(l[d.col.marca]),
        nome: texto(l[d.col.nome]),
        seu: !!token && texto(l[d.col.token]) === token
      };
    });
}

function acharLinha(id) {
  const d = lerAba();
  const i = d.linhas.findIndex(function (l) { return texto(l[d.col.id]) === String(id); });
  d.indice = i;
  d.linha = d.linhas[i];
  d.numero = i + 2;
  return d;
}

function escalar(id, nome, token) {
  nome = String(nome || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!nome) return 'nome_vazio';
  const d = acharLinha(id);
  if (d.indice < 0) return 'tarefa_nao_existe';
  if (texto(d.linha[d.col.nome])) return 'ocupada';
  // Evita que um nome começando com = vire fórmula na planilha.
  if (/^[=+\-@]/.test(nome)) nome = "'" + nome;
  d.aba.getRange(d.numero, d.col.nome + 1).setValue(nome);
  d.aba.getRange(d.numero, d.col.token + 1).setValue(token);
  d.aba.getRange(d.numero, d.col.quando + 1).setValue(new Date());
  return null;
}

function desfazer(id, token) {
  const d = acharLinha(id);
  if (d.indice < 0) return 'tarefa_nao_existe';
  if (texto(d.linha[d.col.token]) !== token) return 'nao_e_seu';
  d.aba.getRange(d.numero, d.col.nome + 1).clearContent();
  d.aba.getRange(d.numero, d.col.token + 1).clearContent();
  d.aba.getRange(d.numero, d.col.quando + 1).clearContent();
  return null;
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
