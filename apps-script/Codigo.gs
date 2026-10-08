// Escala da mídia: liga a planilha do Google à página no GitHub Pages.
// Cole este arquivo inteiro em Extensões > Apps Script da planilha (o passo a passo está no LEIA-ME.md).
//
// Partes deste arquivo:
//   1. Configuração e calendário inicial
//   2. Entrada: o que a página pede (doGet / doPost)
//   3. Leitura das abas
//   4. Escala e nomes (escalar, desfazer, ligar aparelhos)
//   5. Administração (protegida por senha)
//   6. Lembretes (notificações no navegador)
//   7. Assinatura das notificações (ECDSA P-256 / VAPID)

// ===================== 1. Configuração e calendário inicial =====================

const NOME_ABA = 'Escala';
const COLUNAS = ['id', 'data', 'tipo', 'tarefa', 'detalhe', 'marca', 'nome', 'token', 'quando', 'hora'];
const TIPOS = ['culto', 'resumo', 'musica', 'devocional', 'oracao', 'momento', 'aviso'];

// Cada nome fica ligado aos aparelhos que podem usá-lo (pelo código guardado em cada navegador).
// A coluna "token" guarda um ou mais códigos separados por espaço. Um aparelho novo entra
// com o código de 6 números gerado num aparelho que já usa o nome.
// Para liberar um nome do zero, apague a célula "token" da pessoa na aba Pessoas.
const NOME_ABA_PESSOAS = 'Pessoas';
const COLUNAS_PESSOAS = ['nome', 'token', 'desde', 'codigo', 'validade', 'tentativas'];
const MINUTOS_CODIGO = 15;
const MAX_TENTATIVAS = 5;

// Administração: a senha NÃO fica aqui (este arquivo é público no GitHub).
// Ela fica em Configurações do projeto > Propriedades do script, com o nome SENHA_ADMIN.
const HORAS_SESSAO_ADMIN = 6;
const MAX_FALHAS_ADMIN = 8; // erros seguidos de senha antes de bloquear por 15 minutos

// Lembretes: uma linha por aparelho que ativou as notificações.
const NOME_ABA_LEMBRETES = 'Lembretes';
const COLUNAS_LEMBRETES = ['token', 'endpoint', 'regras', 'site', 'atualizado', 'pendentes'];
const HORA_PADRAO = '09:00'; // prazo de uma tarefa sem horário definido
const MAX_REGRAS = 5;
// Só aceita endereços dos serviços de notificação dos navegadores (Google, Mozilla, Apple, Microsoft).
const SERVICOS_PUSH = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|push\.apple\.com|notify\.windows\.com)\//i;

// Marcas de acento que sobram depois de separar "é" em "e" + "´" (faixa 0300 a 036F do Unicode).
const ACENTOS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

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

  // Datas, horas e códigos como texto, para a planilha não transformar em outra coisa.
  ['id', 'data', 'token', 'hora'].forEach(function (c) { formatarComoTexto(aba, COLUNAS.indexOf(c) + 1); });

  const linhas = OUTUBRO.map(function (t) { return t.concat(['', '', '', '']); });
  aba.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]).setFontWeight('bold');
  aba.getRange(2, 1, linhas.length, COLUNAS.length).setValues(linhas);
  aba.setFrozenRows(1);
  aba.autoResizeColumns(1, COLUNAS.length);
  aba.hideColumns(COLUNAS.indexOf('token') + 1);
}

// ===================== 2. Entrada =====================

// A página pede a lista de tarefas e de nomes.
// O service worker (notificações) pede as mensagens pendentes do aparelho dele.
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.pendentes) return responder(buscarPendentes(String(p.pendentes)));
  return responder(resposta({}, p.token || ''));
}

const ACOES = {
  escalar: function (p, token) { return escalar(p.id, p.nome, token); },
  desfazer: function (p, token) { return desfazer(p.id, token); },
  gerar_codigo: function (p, token) { return gerarCodigo(p.nome, token); },
  usar_codigo: function (p, token) { return usarCodigo(p.nome, p.codigo, token); },
  salvar_lembretes: salvarLembretes,
  remover_lembretes: removerLembretes,
  testar_lembrete: testarLembrete,
  adm_entrar: admEntrar,
  adm_sair: admSair
};

// Ações que só funcionam com a sessão aberta pela senha.
const ACOES_ADMIN = {
  adm_dados: function () { return {}; },
  adm_salvar_tarefa: admSalvarTarefa,
  adm_excluir_tarefa: admExcluirTarefa,
  adm_tirar_pessoa: admTirarPessoa,
  adm_limpar_inscricoes: admLimparInscricoes,
  adm_apagar_tarefas: admApagarTarefas,
  adm_liberar_pessoa: admLiberarPessoa,
  adm_excluir_pessoa: admExcluirPessoa
};

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
    const tem = function (lista) { return Object.prototype.hasOwnProperty.call(lista, pedido.acao); };
    let r;
    if (tem(ACOES)) {
      r = ACOES[pedido.acao](pedido, token);
    } else if (tem(ACOES_ADMIN)) {
      if (!sessaoValida(pedido.sessao)) return responder({ ok: false, erro: 'sessao_expirada' });
      r = ACOES_ADMIN[pedido.acao](pedido, token);
      if (!r.erro) r.adm = dadosAdmin();
    } else {
      r = { erro: 'acao_invalida' };
    }
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
    pessoas: listarPessoas(token, pessoas),
    lembretes: dadosLembretes(token),
    vapid: PropertiesService.getScriptProperties().getProperty('VAPID_PUBLICA') || null,
    horaPadrao: HORA_PADRAO
  });
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

// ===================== 3. Leitura das abas =====================

// Lê uma aba como tabela. Se faltar alguma coluna (aba de uma versão anterior), acrescenta no fim.
// colunasTexto: colunas novas que devem ficar como texto puro.
function tabela(nomeAba, colunas, criar, colunasTexto) {
  const planilha = SpreadsheetApp.getActive();
  let aba = planilha.getSheetByName(nomeAba);
  if (!aba) {
    if (!criar) throw new Error('Aba "' + nomeAba + '" não encontrada. Rode a função configurar primeiro.');
    aba = criar(planilha);
  }
  const valores = aba.getDataRange().getValues();
  let cabecalho = valores[0].map(function (c) { return String(c).trim().toLowerCase(); });
  if (cabecalho.every(function (c) { return !c; })) cabecalho = [];

  const faltam = colunas.filter(function (c) { return cabecalho.indexOf(c) < 0; });
  if (faltam.length) {
    aba.getRange(1, cabecalho.length + 1, 1, faltam.length).setValues([faltam]).setFontWeight('bold');
    faltam.forEach(function (c, i) {
      if (colunasTexto && colunasTexto.indexOf(c) >= 0) formatarComoTexto(aba, cabecalho.length + 1 + i);
    });
    cabecalho = cabecalho.concat(faltam);
  }
  const col = {};
  colunas.forEach(function (c) { col[c] = cabecalho.indexOf(c); });
  return { aba: aba, col: col, largura: cabecalho.length, linhas: valores.slice(1) };
}

function formatarComoTexto(aba, coluna) {
  aba.getRange(1, coluna, aba.getMaxRows(), 1).setNumberFormat('@');
}

function lerAba() {
  return tabela(NOME_ABA, COLUNAS, null, ['hora']);
}

// A aba Pessoas é criada sozinha na primeira vez, já com quem se escalou antes dela existir.
function criarAbaPessoas(planilha) {
  const aba = planilha.insertSheet(NOME_ABA_PESSOAS);
  formatarComoTexto(aba, 2);
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
  const t = tabela(NOME_ABA_PESSOAS, COLUNAS_PESSOAS, criarAbaPessoas);
  const linhas = [];
  t.linhas.forEach(function (l, i) {
    const nome = texto(l[t.col.nome]);
    if (!nome) return;
    linhas.push({
      nome: nome,
      tokens: texto(l[t.col.token]).split(/[\s,;]+/).filter(Boolean),
      desde: l[t.col.desde],
      codigo: texto(l[t.col.codigo]),
      validade: l[t.col.validade],
      tentativas: Number(l[t.col.tentativas]) || 0,
      numero: i + 2
    });
  });
  return { aba: t.aba, col: t.col, linhas: linhas };
}

function texto(valor) {
  if (valor instanceof Date) return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(valor == null ? '' : valor).trim();
}

// Hora digitada direto na planilha vira um horário (Date); aqui volta a ser "HH:mm".
function textoHora(valor) {
  if (valor instanceof Date) return Utilities.formatDate(valor, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'HH:mm');
  const h = String(valor == null ? '' : valor).trim();
  const m = h.match(/^(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}

// "Ígor  ferraz" e "Igor Ferraz" contam como o mesmo nome.
function chave(nome) {
  return String(nome).normalize('NFD').replace(ACENTOS, '').replace(/\s+/g, ' ').trim().toLowerCase();
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

function tarefaDaLinha(d, l) {
  return {
    id: texto(l[d.col.id]),
    data: texto(l[d.col.data]),
    hora: textoHora(l[d.col.hora]),
    tipo: texto(l[d.col.tipo]),
    tarefa: texto(l[d.col.tarefa]),
    detalhe: texto(l[d.col.detalhe]),
    marca: texto(l[d.col.marca]),
    nome: texto(l[d.col.nome]),
    token: texto(l[d.col.token])
  };
}

function tarefasValidas(d) {
  return d.linhas
    .map(function (l, i) { const t = tarefaDaLinha(d, l); t.numero = i + 2; return t; })
    .filter(function (t) { return t.id && t.data; });
}

// ===================== 4. Escala e nomes =====================

function ehMinha(t, pessoas, token) {
  return !!token && !!t.nome && (t.token === token || ehDoAparelho(acharPessoa(pessoas, t.nome), token));
}

function listar(token, pessoas) {
  return tarefasValidas(lerAba()).map(function (t) {
    return {
      id: t.id, data: t.data, hora: t.hora, tipo: t.tipo, tarefa: t.tarefa,
      detalhe: t.detalhe, marca: t.marca, nome: t.nome,
      seu: ehMinha(t, pessoas, token)
    };
  });
}

// Só o nome e se é deste aparelho. Os códigos dos aparelhos nunca saem da planilha.
function listarPessoas(token, pessoas) {
  return pessoas.linhas
    .map(function (p) { return { nome: p.nome, seu: ehDoAparelho(p, token) }; })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt'); });
}

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

function limparNome(nome) {
  return String(nome || '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

function escalar(id, nome, token) {
  nome = limparNome(nome);
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
  const t = tarefaDaLinha(d, d.linha);
  if (!ehMinha(t, lerPessoas(), token)) return { erro: 'nao_e_seu' };
  limparInscricao(d.aba, d.col, d.numero);
  return {};
}

function limparInscricao(aba, col, numero) {
  aba.getRange(numero, col.nome + 1).clearContent();
  aba.getRange(numero, col.token + 1).clearContent();
  aba.getRange(numero, col.quando + 1).clearContent();
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

// ===================== 5. Administração =====================

// A senha fica nas Propriedades do script; a sessão vale HORAS_SESSAO_ADMIN horas.
function admEntrar(pedido) {
  const senha = PropertiesService.getScriptProperties().getProperty('SENHA_ADMIN');
  if (!senha) return { erro: 'senha_nao_configurada' };
  const cache = CacheService.getScriptCache();
  const falhas = Number(cache.get('adm-falhas')) || 0;
  if (falhas >= MAX_FALHAS_ADMIN) return { erro: 'bloqueado' };
  if (String(pedido.senha || '') !== senha) {
    cache.put('adm-falhas', String(falhas + 1), 15 * 60);
    return { erro: 'senha_errada' };
  }
  cache.remove('adm-falhas');
  const sessao = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  cache.put('adm-sessao-' + sessao, '1', HORAS_SESSAO_ADMIN * 3600);
  return { sessao: sessao, adm: dadosAdmin() };
}

function admSair(pedido) {
  if (typeof pedido.sessao === 'string' && pedido.sessao.length <= 80) {
    CacheService.getScriptCache().remove('adm-sessao-' + pedido.sessao);
  }
  return {};
}

function sessaoValida(sessao) {
  return typeof sessao === 'string' && /^[0-9a-f]{64}$/.test(sessao) &&
    CacheService.getScriptCache().get('adm-sessao-' + sessao) === '1';
}

// Tudo o que a tela de administração mostra. Sem os códigos dos aparelhos.
function dadosAdmin() {
  const d = lerAba();
  const pessoas = lerPessoas();
  const lembretes = tabela(NOME_ABA_LEMBRETES, COLUNAS_LEMBRETES, criarAbaLembretes);
  return {
    tarefas: tarefasValidas(d).map(function (t) {
      return { id: t.id, data: t.data, hora: t.hora, tipo: t.tipo, tarefa: t.tarefa, detalhe: t.detalhe, marca: t.marca, nome: t.nome };
    }),
    pessoas: pessoas.linhas.map(function (p) {
      return {
        nome: p.nome,
        aparelhos: p.tokens.length,
        desde: p.desde instanceof Date ? Utilities.formatDate(p.desde, Session.getScriptTimeZone(), 'yyyy-MM-dd') : ''
      };
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt'); }),
    lembretes: {
      configurado: !!PropertiesService.getScriptProperties().getProperty('VAPID_PRIVADA'),
      gatilho: gatilhoAtivo(),
      aparelhos: lembretes.linhas.filter(function (l) { return texto(l[lembretes.col.token]); }).length
    },
    horaPadrao: HORA_PADRAO
  };
}

// "2026-02-30" tem o formato certo, mas não existe: confere o dia contra o mês.
function dataValida(data) {
  const m = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const ano = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= new Date(ano, mes, 0).getDate();
}

// Confere e limpa os campos de uma tarefa vinda da tela de administração.
function validarTarefa(t) {
  if (!t || typeof t !== 'object') return null;
  const limpa = {
    data: String(t.data || '').trim(),
    hora: String(t.hora || '').trim(),
    tipo: String(t.tipo || '').trim().toLowerCase(),
    tarefa: String(t.tarefa || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    detalhe: String(t.detalhe || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    marca: String(t.marca || '').replace(/\s+/g, ' ').trim().slice(0, 30),
    nome: limparNome(t.nome)
  };
  if (!dataValida(limpa.data)) return null;
  if (limpa.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(limpa.hora)) return null;
  if (TIPOS.indexOf(limpa.tipo) < 0 || !limpa.tarefa) return null;
  return limpa;
}

// Cria (sem id) ou edita (com id) uma tarefa. Se o responsável escrever um nome,
// a pessoa é escalada; o aparelho dela passa a reconhecer a tarefa pelo nome.
function admSalvarTarefa(pedido) {
  const t = validarTarefa(pedido.tarefa);
  if (!t) return { erro: 'tarefa_invalida' };
  const d = lerAba();
  const id = String((pedido.tarefa && pedido.tarefa.id) || '').trim();

  let numero;
  let nomeAntes = '';
  if (id) {
    const i = d.linhas.findIndex(function (l) { return texto(l[d.col.id]) === id; });
    if (i < 0) return { erro: 'tarefa_nao_existe' };
    numero = i + 2;
    nomeAntes = texto(d.linhas[i][d.col.nome]);
  } else {
    const maior = d.linhas.reduce(function (m, l) { return Math.max(m, Number(texto(l[d.col.id])) || 0); }, 0);
    const nova = new Array(d.largura).fill('');
    nova[d.col.id] = String(maior + 1);
    d.aba.appendRow(nova);
    numero = d.aba.getLastRow();
  }

  const campos = { data: t.data, hora: t.hora, tipo: t.tipo, tarefa: seguro(t.tarefa), detalhe: seguro(t.detalhe), marca: seguro(t.marca) };
  Object.keys(campos).forEach(function (c) { d.aba.getRange(numero, d.col[c] + 1).setValue(campos[c]); });

  if (chave(t.nome) !== chave(nomeAntes)) {
    if (!t.nome) {
      limparInscricao(d.aba, d.col, numero);
    } else {
      const pessoas = lerPessoas();
      const p = acharPessoa(pessoas, t.nome);
      if (!p) pessoas.aba.appendRow([seguro(t.nome), '', new Date(), '', '', '']);
      d.aba.getRange(numero, d.col.nome + 1).setValue(seguro(p ? p.nome : t.nome));
      d.aba.getRange(numero, d.col.token + 1).clearContent();
      d.aba.getRange(numero, d.col.quando + 1).setValue(new Date());
    }
  }
  return {};
}

function admExcluirTarefa(pedido) {
  const d = acharLinha(pedido.id);
  if (d.indice < 0) return { erro: 'tarefa_nao_existe' };
  d.aba.deleteRow(d.numero);
  return {};
}

function admTirarPessoa(pedido) {
  const d = acharLinha(pedido.id);
  if (d.indice < 0) return { erro: 'tarefa_nao_existe' };
  limparInscricao(d.aba, d.col, d.numero);
  return {};
}

// Tira todo mundo de todas as tarefas (as tarefas continuam).
function admLimparInscricoes() {
  const d = lerAba();
  if (d.linhas.length) {
    ['nome', 'token', 'quando'].forEach(function (c) {
      d.aba.getRange(2, d.col[c] + 1, d.linhas.length, 1).clearContent();
    });
  }
  return {};
}

// Apaga todas as tarefas, para montar um mês novo do zero.
function admApagarTarefas() {
  const d = lerAba();
  if (d.linhas.length) d.aba.deleteRows(2, d.linhas.length);
  return {};
}

// Desliga todos os aparelhos de um nome: o próximo aparelho que usar o nome fica com ele.
function admLiberarPessoa(pedido) {
  const pessoas = lerPessoas();
  const p = acharPessoa(pessoas, pedido.nome || '');
  if (!p) return { erro: 'nome_nao_existe' };
  gravarPessoa(pessoas, p, { token: '', codigo: '', validade: '', tentativas: '' });
  return {};
}

// Apaga o nome da lista. As tarefas em que ele está continuam com o nome escrito.
function admExcluirPessoa(pedido) {
  const pessoas = lerPessoas();
  const p = acharPessoa(pessoas, pedido.nome || '');
  if (!p) return { erro: 'nome_nao_existe' };
  pessoas.aba.deleteRow(p.numero);
  return {};
}

// ===================== 6. Lembretes =====================
//
// Como funciona:
//   - Cada aparelho que ativa os lembretes manda a "inscrição" do navegador e as regras escolhidas.
//   - A cada 5 minutos, enviarLembretes() calcula quais avisos caem nesse intervalo, guarda o texto
//     em "pendentes" e cutuca o navegador (push sem conteúdo).
//   - O service worker da página (sw.js) acorda, busca os pendentes e mostra as notificações.

// Rode esta função uma vez, pelo editor, para ligar os lembretes:
// cria as chaves de assinatura e o gatilho que roda a cada 5 minutos.
function configurarLembretes() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('VAPID_PRIVADA')) {
    const chaves = ecGerarChaves();
    props.setProperty('VAPID_PRIVADA', chaves.privada);
    props.setProperty('VAPID_PUBLICA', chaves.publica);
  }
  if (!gatilhoAtivo()) ScriptApp.newTrigger('enviarLembretes').timeBased().everyMinutes(5).create();
  props.setProperty('LEMBRETES_ULTIMA', String(Date.now()));
  tabela(NOME_ABA_LEMBRETES, COLUNAS_LEMBRETES, criarAbaLembretes);
  Logger.log('Lembretes ligados. Chave pública: ' + props.getProperty('VAPID_PUBLICA'));
}

function gatilhoAtivo() {
  try {
    return ScriptApp.getProjectTriggers().some(function (g) { return g.getHandlerFunction() === 'enviarLembretes'; });
  } catch (e) {
    return false;
  }
}

function criarAbaLembretes(planilha) {
  const aba = planilha.insertSheet(NOME_ABA_LEMBRETES);
  formatarComoTexto(aba, 1);
  aba.getRange(1, 1, 1, COLUNAS_LEMBRETES.length).setValues([COLUNAS_LEMBRETES]).setFontWeight('bold');
  aba.setFrozenRows(1);
  return aba;
}

function lerLembretes() {
  const t = tabela(NOME_ABA_LEMBRETES, COLUNAS_LEMBRETES, criarAbaLembretes);
  t.itens = [];
  t.linhas.forEach(function (l, i) {
    const token = texto(l[t.col.token]);
    if (!token) return;
    let regras = [];
    try { regras = JSON.parse(texto(l[t.col.regras]) || '[]'); } catch (e) { regras = []; }
    t.itens.push({ token: token, endpoint: texto(l[t.col.endpoint]), regras: regras, site: texto(l[t.col.site]), pendentes: texto(l[t.col.pendentes]), numero: i + 2 });
  });
  return t;
}

function dadosLembretes(token) {
  if (!token) return { ativo: false, regras: [] };
  const item = lerLembretes().itens.find(function (i) { return i.token === token; });
  return item ? { ativo: true, regras: item.regras } : { ativo: false, regras: [] };
}

// Regras aceitas:
//   { tipo: 'dias', dias: 0..14, hora: 'HH:mm' }              N dias antes, num horário (0 = no próprio dia)
//   { tipo: 'antes', quantidade: N, unidade: 'minutos'|'horas' } tanto tempo antes do prazo
//   { tipo: 'semanal', dia: 0..6, hora: 'HH:mm' }             toda semana, resumo dos próximos 7 dias
function validarRegras(regras) {
  if (!Array.isArray(regras) || regras.length > MAX_REGRAS) return null;
  const hora = function (h) { return typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h); };
  const inteiro = function (n, min, max) { return Number.isInteger(n) && n >= min && n <= max; };
  const limpas = [];
  for (let i = 0; i < regras.length; i++) {
    const r = regras[i] || {};
    if (r.tipo === 'dias' && inteiro(r.dias, 0, 14) && hora(r.hora)) {
      limpas.push({ tipo: 'dias', dias: r.dias, hora: r.hora });
    } else if (r.tipo === 'antes' && (r.unidade === 'minutos' ? inteiro(r.quantidade, 5, 1440) : r.unidade === 'horas' && inteiro(r.quantidade, 1, 72))) {
      limpas.push({ tipo: 'antes', quantidade: r.quantidade, unidade: r.unidade });
    } else if (r.tipo === 'semanal' && inteiro(r.dia, 0, 6) && hora(r.hora)) {
      limpas.push({ tipo: 'semanal', dia: r.dia, hora: r.hora });
    } else {
      return null;
    }
  }
  return limpas;
}

function salvarLembretes(pedido, token) {
  const insc = pedido.inscricao || {};
  const endpoint = String(insc.endpoint || '');
  if (!SERVICOS_PUSH.test(endpoint) || endpoint.length > 1000) return { erro: 'inscricao_invalida' };
  const regras = validarRegras(pedido.regras);
  if (!regras) return { erro: 'regras_invalidas' };
  const site = /^https?:\/\/[^\s]{1,200}$/.test(String(pedido.site || '')) ? String(pedido.site) : '';

  const t = lerLembretes();
  const item = t.itens.find(function (i) { return i.token === token; });
  const linha = new Array(t.largura).fill('');
  linha[t.col.token] = token;
  linha[t.col.endpoint] = endpoint;
  linha[t.col.regras] = JSON.stringify(regras);
  linha[t.col.site] = site;
  linha[t.col.atualizado] = new Date();
  if (item) {
    linha[t.col.pendentes] = item.pendentes;
    t.aba.getRange(item.numero, 1, 1, t.largura).setValues([linha]);
  } else {
    t.aba.appendRow(linha);
  }
  return {};
}

function removerLembretes(pedido, token) {
  const t = lerLembretes();
  const item = t.itens.find(function (i) { return i.token === token; });
  if (item) t.aba.deleteRow(item.numero);
  return {};
}

function testarLembrete(pedido, token) {
  const t = lerLembretes();
  const item = t.itens.find(function (i) { return i.token === token; });
  if (!item) return { erro: 'lembretes_desligados' };
  guardarPendentes(t, item, [{ titulo: 'Lembretes funcionando', corpo: 'Você vai receber os avisos da escala neste aparelho.', tag: 'escala-teste' }]);
  const status = enviarPush(item.endpoint, item.site);
  if (status === 404 || status === 410) {
    t.aba.deleteRow(item.numero);
    return { erro: 'inscricao_vencida' };
  }
  return status >= 200 && status < 300 ? {} : { erro: 'push_falhou', status: status };
}

// Guarda as mensagens que o service worker vai buscar. Mantém só as últimas 24 horas.
function guardarPendentes(t, item, mensagens) {
  let atuais = [];
  try { atuais = JSON.parse(item.pendentes || '[]'); } catch (e) { atuais = []; }
  const agora = Date.now();
  const lista = atuais
    .filter(function (m) { return agora - (m.em || 0) < 24 * 3600000; })
    .concat(mensagens.map(function (m) { return Object.assign({ em: agora }, m); }))
    .slice(-10);
  item.pendentes = JSON.stringify(lista);
  t.aba.getRange(item.numero, t.col.pendentes + 1).setValue(item.pendentes);
}

// Chamado pelo service worker: devolve e apaga as mensagens pendentes do aparelho.
function buscarPendentes(endpoint) {
  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    const t = lerLembretes();
    const item = t.itens.find(function (i) { return i.endpoint === endpoint; });
    if (!item || !item.pendentes) return { mensagens: [] };
    let mensagens = [];
    try { mensagens = JSON.parse(item.pendentes); } catch (e) { mensagens = []; }
    t.aba.getRange(item.numero, t.col.pendentes + 1).clearContent();
    return { mensagens: mensagens.map(function (m) { return { titulo: m.titulo, corpo: m.corpo, tag: m.tag }; }) };
  } finally {
    trava.releaseLock();
  }
}

// Roda sozinho a cada 5 minutos (gatilho criado por configurarLembretes).
// Olha o intervalo entre a última execução e agora, para nenhum aviso sair duas vezes nem ficar para trás.
function enviarLembretes() {
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(20000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const agora = Date.now();
    const ultima = Number(props.getProperty('LEMBRETES_ULTIMA')) || 0;
    if (!ultima) { props.setProperty('LEMBRETES_ULTIMA', String(agora)); return; }
    const inicio = Math.max(ultima, agora - 6 * 3600000); // depois de uma pausa longa, não despeja avisos velhos

    const t = lerLembretes();
    if (t.itens.length) {
      const tarefas = tarefasValidas(lerAba()).filter(function (x) { return x.nome; });
      const pessoas = lerPessoas();
      const tz = Session.getScriptTimeZone();
      const vencidos = [];
      t.itens.forEach(function (item) {
        const minhas = tarefas.filter(function (x) { return ehMinha(x, pessoas, item.token); });
        const mensagens = calcularMensagens(minhas, item.regras, inicio, agora, tz);
        if (!mensagens.length) return;
        guardarPendentes(t, item, mensagens);
        const status = enviarPush(item.endpoint, item.site);
        if (status === 404 || status === 410) vencidos.push(item.numero);
      });
      // Inscrições que o navegador cancelou: apaga de baixo para cima para não bagunçar os números.
      vencidos.sort(function (a, b) { return b - a; }).forEach(function (n) { t.aba.deleteRow(n); });
    }
    props.setProperty('LEMBRETES_ULTIMA', String(agora));
  } finally {
    trava.releaseLock();
  }
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function momento(data, hora, tz) {
  try { return Utilities.parseDate(data + ' ' + hora, tz, 'yyyy-MM-dd HH:mm').getTime(); } catch (e) { return null; }
}

function somarDias(data, n, tz) {
  const meioDia = momento(data, '12:00', tz);
  return Utilities.formatDate(new Date(meioDia + n * 86400000), tz, 'yyyy-MM-dd');
}

function diaDaSemana(data, tz) {
  return Number(Utilities.formatDate(new Date(momento(data, '12:00', tz)), tz, 'u')) % 7; // 0 = domingo
}

function dataCurta(data, tz) {
  const p = data.split('-');
  return DIAS_CURTOS[diaDaSemana(data, tz)] + ', ' + Number(p[2]) + ' ' + MESES_CURTOS[Number(p[1]) - 1];
}

function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

// Quais avisos caem no intervalo (inicio, fim] para estas tarefas e regras.
function calcularMensagens(tarefas, regras, inicio, fim, tz) {
  const dentro = function (m) { return m !== null && m > inicio && m <= fim; };
  const mensagens = [];
  regras.forEach(function (r, ri) {
    if (r.tipo === 'semanal') {
      // O intervalo é curto (no máximo 6 horas), então basta olhar o dia do começo e o do fim.
      const dias = [Utilities.formatDate(new Date(inicio), tz, 'yyyy-MM-dd'), Utilities.formatDate(new Date(fim), tz, 'yyyy-MM-dd')]
        .filter(function (d, i, a) { return a.indexOf(d) === i; });
      dias.forEach(function (dia) {
        if (diaDaSemana(dia, tz) !== r.dia) return;
        const m = momento(dia, r.hora, tz);
        if (!dentro(m)) return;
        const proximas = tarefas
          .map(function (x) { return { x: x, prazo: momento(x.data, x.hora || HORA_PADRAO, tz) }; })
          .filter(function (o) { return o.prazo > m && o.prazo <= m + 7 * 86400000; })
          .sort(function (a, b) { return a.prazo - b.prazo; });
        if (!proximas.length) return;
        const linhas = proximas.slice(0, 6).map(function (o) { return dataCurta(o.x.data, tz) + ' · ' + o.x.tarefa; });
        if (proximas.length > 6) linhas.push('e mais ' + (proximas.length - 6));
        mensagens.push({ titulo: 'Suas tarefas nos próximos 7 dias', corpo: linhas.join('\n'), tag: 'escala-semana-' + dia });
      });
      return;
    }
    tarefas.forEach(function (x) {
      const hora = x.hora || HORA_PADRAO;
      const prazo = momento(x.data, hora, tz);
      if (prazo === null) return;
      let quando;
      let titulo;
      if (r.tipo === 'dias') {
        quando = momento(somarDias(x.data, -r.dias, tz), r.hora, tz);
        titulo = (r.dias === 0 ? 'Hoje' : r.dias === 1 ? 'Amanhã' : 'Em ' + r.dias + ' dias') + ': ' + x.tarefa;
      } else {
        quando = prazo - r.quantidade * (r.unidade === 'horas' ? 3600000 : 60000);
        titulo = (r.quantidade === 1 ? 'Falta ' : 'Faltam ') +
          (r.unidade === 'horas' ? plural(r.quantidade, 'hora', 'horas') : plural(r.quantidade, 'minuto', 'minutos')) + ': ' + x.tarefa;
      }
      if (!dentro(quando) || quando >= prazo) return;
      mensagens.push({
        titulo: titulo,
        corpo: dataCurta(x.data, tz) + ' · prazo ' + hora + (x.detalhe ? ' · ' + x.detalhe : ''),
        tag: 'escala-' + x.id + '-' + ri
      });
    });
  });
  return mensagens;
}

// Cutuca o navegador. Devolve o código HTTP (201 = entregue ao serviço; 404/410 = inscrição cancelada).
function enviarPush(endpoint, site) {
  const props = PropertiesService.getScriptProperties();
  const privada = props.getProperty('VAPID_PRIVADA');
  const publica = props.getProperty('VAPID_PUBLICA');
  if (!privada || !publica || !SERVICOS_PUSH.test(endpoint)) return 0;
  const origem = endpoint.match(/^https:\/\/[^\/]+/)[0];
  const resposta = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    headers: { Authorization: 'vapid t=' + jwtVapid(origem, site, privada) + ', k=' + publica, TTL: '43200', Urgency: 'high' },
    muteHttpExceptions: true
  });
  return resposta.getResponseCode();
}

// Token que prova ao serviço de push que o aviso veio de quem tem a chave. Vale 12 horas;
// fica guardado 6 horas para não assinar de novo a cada envio.
function jwtVapid(origem, site, privada) {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get('vapid-jwt-' + origem);
  if (guardado) return guardado;
  const cabecalho = b64u(Utilities.newBlob(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).getBytes());
  const dados = b64u(Utilities.newBlob(JSON.stringify({
    aud: origem,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: /^https:\/\//.test(site) ? site : 'https://github.com/'
  })).getBytes());
  const jwt = cabecalho + '.' + dados + '.' + b64u(ecAssinar(privada, cabecalho + '.' + dados));
  cache.put('vapid-jwt-' + origem, jwt, 6 * 3600);
  return jwt;
}

function b64u(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

// ===================== 7. Assinatura ECDSA P-256 =====================
//
// O Apps Script não tem ECDSA pronto, então a conta é feita aqui, com BigInt.
// O número aleatório de cada assinatura segue a RFC 6979 (derivado da chave e da mensagem),
// que evita o erro clássico de vazar a chave por um aleatório fraco.
// Tudo fica dentro de funções: se algum dia o BigInt faltar, só os lembretes param.

let CURVA = null;
function ecCurva() {
  if (CURVA) return CURVA;
  const h = function (x) { return BigInt('0x' + x); };
  CURVA = {
    p: h('ffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
    n: h('ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
    gx: h('6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
    gy: h('4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'),
    _0: BigInt(0), _1: BigInt(1), _2: BigInt(2), _3: BigInt(3), _4: BigInt(4), _8: BigInt(8)
  };
  CURVA.a = CURVA.p - CURVA._3;
  return CURVA;
}

function ecMod(a, m) {
  const r = a % m;
  return r < ecCurva()._0 ? r + m : r;
}

// Inverso modular pelo algoritmo de Euclides estendido.
function ecInverso(a, m) {
  const c = ecCurva();
  let t = c._0, novoT = c._1, r = m, novoR = ecMod(a, m);
  while (novoR !== c._0) {
    const q = r / novoR;
    const t2 = t - q * novoT; t = novoT; novoT = t2;
    const r2 = r - q * novoR; r = novoR; novoR = r2;
  }
  return ecMod(t, m);
}

// Pontos em coordenadas jacobianas [X, Y, Z]; null é o ponto no infinito.
function ecDobrar(P) {
  const c = ecCurva();
  if (P === null || P[1] === c._0) return null;
  const X = P[0], Y = P[1], Z = P[2], p = c.p;
  const YY = Y * Y % p;
  const S = c._4 * X * YY % p;
  const ZZ = Z * Z % p;
  const M = (c._3 * X * X + c.a * ZZ * ZZ) % p;
  const X3 = ecMod(M * M - c._2 * S, p);
  const Y3 = ecMod(M * (S - X3) - c._8 * YY * YY, p);
  const Z3 = c._2 * Y * Z % p;
  return [X3, Y3, Z3];
}

function ecSomar(P, Q) {
  if (P === null) return Q;
  if (Q === null) return P;
  const c = ecCurva(), p = c.p;
  const Z1Z1 = P[2] * P[2] % p, Z2Z2 = Q[2] * Q[2] % p;
  const U1 = P[0] * Z2Z2 % p, U2 = Q[0] * Z1Z1 % p;
  const S1 = P[1] * Z2Z2 * Q[2] % p, S2 = Q[1] * Z1Z1 * P[2] % p;
  if (U1 === U2) return S1 === S2 ? ecDobrar(P) : null;
  const H = ecMod(U2 - U1, p), R = ecMod(S2 - S1, p);
  const HH = H * H % p, HHH = HH * H % p;
  const X3 = ecMod(R * R - HHH - c._2 * U1 * HH, p);
  const Y3 = ecMod(R * (U1 * HH - X3) - S1 * HHH, p);
  const Z3 = H * P[2] * Q[2] % p;
  return [X3, Y3, Z3];
}

function ecMultiplicar(k, P) {
  const bits = k.toString(2);
  let R = null;
  for (let i = 0; i < bits.length; i++) {
    R = ecDobrar(R);
    if (bits[i] === '1') R = ecSomar(R, P);
  }
  return R;
}

function ecAfim(P) {
  const c = ecCurva();
  const zi = ecInverso(P[2], c.p);
  const zi2 = zi * zi % c.p;
  return { x: P[0] * zi2 % c.p, y: P[1] * zi2 * zi % c.p };
}

// Bytes do Apps Script vêm com sinal (-128..127).
function bytesParaHex(bytes) {
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function hexParaBytes(hex) {
  const r = [];
  for (let i = 0; i < hex.length; i += 2) {
    const v = parseInt(hex.substr(i, 2), 16);
    r.push(v > 127 ? v - 256 : v);
  }
  return r;
}
function ecHex32(x) {
  const h = x.toString(16);
  return '0'.repeat(64 - h.length) + h;
}
function ecHmac(chave, dados) {
  return Utilities.computeHmacSha256Signature(dados, chave);
}

// Número aleatório determinístico da RFC 6979 (seção 3.2) para SHA-256.
function ecNonce(d, hash) {
  const c = ecCurva();
  const x = hexParaBytes(ecHex32(d));
  const h1 = hexParaBytes(ecHex32(ecMod(BigInt('0x' + bytesParaHex(hash)), c.n)));
  let V = new Array(32).fill(1);
  let K = new Array(32).fill(0);
  K = ecHmac(K, V.concat([0], x, h1)); V = ecHmac(K, V);
  K = ecHmac(K, V.concat([1], x, h1)); V = ecHmac(K, V);
  for (;;) {
    V = ecHmac(K, V);
    const k = BigInt('0x' + bytesParaHex(V));
    if (k >= c._1 && k < c.n) return k;
    K = ecHmac(K, V.concat([0])); V = ecHmac(K, V);
  }
}

// Assina o texto com a chave privada (hex). Devolve r||s (64 bytes), o formato do ES256.
function ecAssinar(privadaHex, mensagem) {
  const c = ecCurva();
  const d = BigInt('0x' + privadaHex);
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, mensagem, Utilities.Charset.UTF_8);
  const z = BigInt('0x' + bytesParaHex(hash));
  const k = ecNonce(d, hash);
  const R = ecAfim(ecMultiplicar(k, [c.gx, c.gy, c._1]));
  const r = ecMod(R.x, c.n);
  const s = ecMod(ecInverso(k, c.n) * (z + r * d), c.n);
  return hexParaBytes(ecHex32(r) + ecHex32(s));
}

function ecGerarChaves() {
  const c = ecCurva();
  let semente = '';
  for (let i = 0; i < 4; i++) semente += Utilities.getUuid();
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, semente + Date.now(), Utilities.Charset.UTF_8);
  const d = ecMod(BigInt('0x' + bytesParaHex(hash)), c.n - c._1) + c._1;
  const Q = ecAfim(ecMultiplicar(d, [c.gx, c.gy, c._1]));
  return {
    privada: ecHex32(d),
    publica: b64u(hexParaBytes('04' + ecHex32(Q.x) + ecHex32(Q.y)))
  };
}
