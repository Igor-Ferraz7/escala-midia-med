// Testes do Codigo.gs numa planilha de mentira.
// Uso (na pasta do projeto): node testes/teste-gs.js
const path = require('path');
const crypto = require('crypto');
const { criarAmbiente } = require('./ambiente-gs');

const CAMINHO = process.argv[2] || path.join(__dirname, '..', 'apps-script', 'Codigo.gs');
let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); if (!cond) falhas++; };
const secao = (t) => console.log('\n--- ' + t);

const A = 'tAAAAAAAAAAAAAAAAAAAAAAAA', B = 'tBBBBBBBBBBBBBBBBBBBBBBBB', C = 'tCCCCCCCCCCCCCCCCCCCCCCCC', D = 'tDDDDDDDDDDDDDDDDDDDDDDDD';
const SENHA_TESTE = 'senha-de-teste-123'; // só existe aqui, na planilha de mentira

// ======================================================================
secao('Escala e nomes');
{
  const { ctx, abas } = criarAmbiente(CAMINHO, { silencioso: true });
  const post = (o) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(o) } }));
  const get = (p) => JSON.parse(ctx.doGet({ parameter: p }));

  ok(abas.Escala.dados[0].join() === 'id,data,tipo,tarefa,detalhe,marca,nome,token,quando,hora,grupo', 'configurar cria as colunas hora e grupo');
  abas.Escala.dados[1][6] = 'Ana Souza'; abas.Escala.dados[1][7] = B;
  let r = get({ token: A });
  ok(abas.Pessoas && abas.Pessoas.dados.length === 2, 'aba Pessoas criada com quem já estava escalado');
  ok(r.pessoas.length === 1 && r.pessoas[0].seu === false, 'pessoas sem token, seu=false para outro aparelho');
  ok(!JSON.stringify(r).includes(B), 'token de outro aparelho não sai na resposta');
  ok(r.vapid === null && r.lembretes.ativo === false, 'sem lembretes configurados: vapid null');
  ok(r.tarefas[0].hora === '', 'tarefa sem hora vem com hora vazia');

  r = post({ acao: 'escalar', id: '5', nome: 'Igor Ferraz', token: A });
  ok(r.ok, 'escalar nome novo');
  r = post({ acao: 'escalar', id: '6', nome: 'igor  FERRAZ', token: B });
  ok(r.erro === 'nome_de_outro', 'outro aparelho não usa o nome (maiúsculas e espaços não enganam)');
  r = post({ acao: 'gerar_codigo', nome: 'Igor Ferraz', token: A });
  const cod = r.codigo;
  ok(/^\d{6}$/.test(cod), 'dono do nome gera código de 6 números');
  r = post({ acao: 'usar_codigo', nome: 'Igor Ferraz', codigo: '000000', token: D });
  ok(r.erro === 'codigo_errado', 'código errado é recusado');
  r = post({ acao: 'usar_codigo', nome: 'Igor Ferraz', codigo: cod.slice(0, 3) + ' ' + cod.slice(3), token: D });
  ok(r.ok, 'código certo (mesmo com espaço) liga o aparelho D');
  r = post({ acao: 'usar_codigo', nome: 'Igor Ferraz', codigo: cod, token: C });
  ok(r.erro === 'codigo_expirado', 'código já usado não vale de novo');
  r = post({ acao: 'desfazer', id: '5', token: D });
  ok(r.ok, 'D tira a tarefa que A marcou');
  r = post({ acao: 'desfazer', id: '1', token: D });
  ok(r.erro === 'nao_e_seu', 'não tira tarefa de outra pessoa');
  r = post({ acao: 'constructor', token: A });
  ok(r.erro === 'acao_invalida', 'ação "constructor" não chama nada');
  r = post({ acao: 'adm_apagar_tarefas', token: A });
  ok(r.erro === 'sessao_expirada' && abas.Escala.dados.length === 31, 'ação de admin sem sessão é recusada e não apaga nada');
}

// ======================================================================
secao('Administração');
{
  const { ctx, abas, props } = criarAmbiente(CAMINHO, { silencioso: true });
  const post = (o) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ token: A }, o)) } }));

  let r = post({ acao: 'adm_entrar', senha: 'qualquer' });
  ok(r.erro === 'senha_nao_configurada', 'sem SENHA_ADMIN nas propriedades: avisa');
  props.SENHA_ADMIN = SENHA_TESTE;
  r = post({ acao: 'adm_entrar', senha: 'errada' });
  ok(r.erro === 'senha_errada' && !r.sessao && !r.adm, 'senha errada não abre sessão nem devolve dados');
  r = post({ acao: 'adm_entrar', senha: SENHA_TESTE });
  ok(r.ok && /^[0-9a-f]{64}$/.test(r.sessao) && r.adm.tarefas.length === 30, 'senha certa abre sessão e traz os dados');
  const s = r.sessao;
  ok(!JSON.stringify(r).includes(SENHA_TESTE), 'a senha não volta na resposta');

  r = post({ acao: 'adm_salvar_tarefa', sessao: s, tarefa: { data: '2026-11-03', hora: '19:30', tipo: 'culto', tarefa: 'Culto', detalhe: 'Postagem', marca: '', nome: '' } });
  const nova = r.adm && r.adm.tarefas.find((t) => t.data === '2026-11-03');
  ok(r.ok && nova && nova.id === '31' && nova.hora === '19:30', 'cria tarefa nova com id 31 e hora');

  r = post({ acao: 'adm_salvar_tarefa', sessao: s, tarefa: { id: '31', data: '2026-11-04', hora: '', tipo: 'musica', tarefa: 'Música do dia', detalhe: '', marca: 'Feriado', nome: 'Maria Lima' } });
  const ed = r.adm.tarefas.find((t) => t.id === '31');
  ok(ed.data === '2026-11-04' && ed.tipo === 'musica' && ed.marca === 'Feriado' && ed.nome === 'Maria Lima', 'edita a tarefa e escala um nome');
  ok(r.adm.pessoas.some((p) => p.nome === 'Maria Lima' && p.aparelhos === 0), 'nome escalado pelo admin entra em Pessoas sem aparelho');

  r = post({ acao: 'escalar', id: '20', nome: 'maria lima', token: C });
  ok(r.ok && r.tarefas.find((t) => t.id === '31').seu === true, 'o primeiro aparelho a usar o nome pega também a tarefa do admin');

  r = post({ acao: 'adm_salvar_tarefa', sessao: s, tarefa: { data: '2026-13-40', tipo: 'culto', tarefa: 'x' } });
  ok(r.erro === 'tarefa_invalida', 'data com mês 13 é recusada');
  r = post({ acao: 'adm_salvar_tarefa', sessao: s, tarefa: { data: '2026-02-30', tipo: 'culto', tarefa: 'x' } });
  ok(r.erro === 'tarefa_invalida', '30 de fevereiro é recusado');
  r = post({ acao: 'adm_salvar_tarefa', sessao: s, tarefa: { data: '2026-11-05', tipo: 'outro', tarefa: 'x' } });
  ok(r.erro === 'tarefa_invalida', 'tipo desconhecido é recusado');
  r = post({ acao: 'adm_salvar_tarefa', sessao: s, tarefa: { data: '2026-11-05', hora: '25:00', tipo: 'culto', tarefa: 'x' } });
  ok(r.erro === 'tarefa_invalida', 'hora inválida é recusada');
  r = post({ acao: 'adm_salvar_tarefa', sessao: s, tarefa: { data: '2026-11-05', tipo: 'culto', tarefa: '=IMPORTXML("x")' } });
  ok(r.ok && abas.Escala.dados.some((l) => l[3] === '=IMPORTXML("x")'), 'texto começando com = vai como texto (seguro)');

  // Planilha que já estava no ar (sem ULTIMO_ID): excluir a de id mais alto antes de criar qualquer
  // tarefa também não pode liberar o id.
  {
    const amb = criarAmbiente(CAMINHO, { silencioso: true });
    amb.props.SENHA_ADMIN = SENHA_TESTE;
    const p2 = (o) => JSON.parse(amb.ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ token: A }, o)) } }));
    const s2 = p2({ acao: 'adm_entrar', senha: SENHA_TESTE }).sessao;
    p2({ acao: 'adm_excluir_tarefas', sessao: s2, ids: ['29', '30'] });
    let q = p2({ acao: 'adm_salvar_tarefa', sessao: s2, tarefa: { data: '2026-11-02', tipo: 'aviso', tarefa: 'Aviso' } });
    ok(q.ok && q.adm.tarefas.some((t) => t.id === '31') && !q.adm.tarefas.some((t) => t.id === '29' || t.id === '30'),
      'sem ULTIMO_ID: excluir as últimas antes de criar não reaproveita os ids');
    p2({ acao: 'adm_apagar_tarefas', sessao: s2 });
    q = p2({ acao: 'adm_salvar_tarefa', sessao: s2, tarefa: { data: '2026-12-01', tipo: 'aviso', tarefa: 'Aviso' } });
    ok(q.ok && q.adm.tarefas.length === 1 && q.adm.tarefas[0].id === '32', 'apagar tudo e criar continua depois do último id');
  }

  r = post({ acao: 'adm_tirar_pessoa', sessao: s, id: '31' });
  ok(r.adm.tarefas.find((t) => t.id === '31').nome === '', 'tira a pessoa de uma tarefa');
  r = post({ acao: 'adm_excluir_tarefa', sessao: s, id: '31' });
  ok(!r.adm.tarefas.some((t) => t.id === '31'), 'exclui uma tarefa');
  // A 31 era a de id mais alto: a próxima não pode herdar o id, senão uma tela desatualizada
  // (outra aba do responsável, com a 31 marcada) apagaria a tarefa nova.
  r = post({ acao: 'adm_salvar_tarefa', sessao: s, tarefa: { data: '2026-11-06', tipo: 'musica', tarefa: 'Música do dia' } });
  ok(r.ok && !r.adm.tarefas.some((t) => t.id === '31') && r.adm.tarefas.some((t) => t.id === '33'), 'id de tarefa excluída não é reaproveitado');

  r = post({ acao: 'adm_liberar_pessoa', sessao: s, nome: 'Maria Lima' });
  ok(r.adm.pessoas.find((p) => p.nome === 'Maria Lima').aparelhos === 0, 'libera os aparelhos de um nome');
  r = post({ acao: 'adm_excluir_pessoa', sessao: s, nome: 'maria lima' });
  ok(!r.adm.pessoas.some((p) => p.nome === 'Maria Lima'), 'exclui um nome');

  // Em massa: escala três tarefas e tira duas de uma vez; depois exclui três tarefas de uma vez.
  post({ acao: 'escalar', id: '1', nome: 'Ana', token: A });
  post({ acao: 'escalar', id: '2', nome: 'Ana', token: A });
  post({ acao: 'escalar', id: '3', nome: 'Ana', token: A });
  r = post({ acao: 'adm_tirar_pessoas', sessao: s, ids: ['1', '3', '4'] });
  const porId = (id) => r.adm.tarefas.find((t) => t.id === id);
  ok(r.ok && !porId('1').nome && porId('2').nome === 'Ana' && !porId('3').nome, 'em massa: tira as pessoas só das tarefas marcadas');
  const total = r.adm.tarefas.length;
  r = post({ acao: 'adm_excluir_tarefas', sessao: s, ids: ['2', '5', '30'] });
  ok(r.ok && r.adm.tarefas.length === total - 3 && !r.adm.tarefas.some((t) => ['2', '5', '30'].includes(t.id)) && r.adm.tarefas.some((t) => t.id === '6'),
    'em massa: exclui só as tarefas marcadas');
  r = post({ acao: 'adm_excluir_tarefas', sessao: s, ids: [] });
  ok(r.erro === 'selecao_invalida', 'em massa: seleção vazia é recusada');
  r = post({ acao: 'adm_excluir_tarefas', ids: ['6'] });
  const depois = JSON.parse(ctx.doGet({ parameter: { token: A } }));
  ok(r.erro === 'sessao_expirada' && depois.tarefas.some((t) => t.id === '6'), 'em massa: sem sessão é recusado e nada some');

  r = post({ acao: 'adm_limpar_inscricoes', sessao: s });
  ok(r.adm.tarefas.every((t) => !t.nome) && r.adm.tarefas.length === total - 3, 'limpa todas as inscrições e mantém as tarefas');
  r = post({ acao: 'adm_apagar_tarefas', sessao: s });
  ok(r.adm.tarefas.length === 0 && abas.Escala.dados.length === 1, 'apaga todas as tarefas e mantém o cabeçalho');
  r = post({ acao: 'adm_salvar_tarefa', sessao: s, tarefa: { data: '2026-12-01', tipo: 'culto', tarefa: 'Culto' } });
  ok(r.adm.tarefas.length === 1 && Number(r.adm.tarefas[0].id) > 33, 'depois de apagar tudo, os ids continuam de onde pararam');

  post({ acao: 'adm_sair', sessao: s });
  r = post({ acao: 'adm_dados', sessao: s });
  ok(r.erro === 'sessao_expirada', 'depois de sair, a sessão não vale');
  r = post({ acao: 'adm_dados', sessao: 'a'.repeat(64) });
  ok(r.erro === 'sessao_expirada', 'sessão inventada não vale');

  for (let i = 0; i < 8; i++) post({ acao: 'adm_entrar', senha: 'chute' + i });
  r = post({ acao: 'adm_entrar', senha: SENHA_TESTE });
  ok(r.erro === 'bloqueado', 'depois de 8 erros, bloqueia até a senha certa por 15 minutos');
}

// ======================================================================
secao('Culto dividido em três funções');
{
  const { ctx, abas, props, gatilhos } = criarAmbiente(CAMINHO, { silencioso: true });
  const post = (o) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ token: A }, o)) } }));
  props.SENHA_ADMIN = SENHA_TESTE;
  const s = post({ acao: 'adm_entrar', senha: SENHA_TESTE }).sessao;

  // Planilha de antes: aba Escala sem a coluna grupo.
  abas.Escala.dados.forEach((l) => { l.length = 10; });
  let r = post({ acao: 'adm_dados', sessao: s });
  ok(abas.Escala.dados[0][10] === 'grupo', 'aba antiga ganha a coluna grupo sozinha');
  ok(r.adm.cultosSemDividir.total === 7 && r.adm.cultosSemDividir.comPessoa === 0, 'conta os 7 cultos de outubro ainda sem dividir');

  post({ acao: 'escalar', id: '20', nome: 'Ana', token: B });
  r = post({ acao: 'adm_dados', sessao: s });
  ok(r.adm.cultosSemDividir.comPessoa === 1, 'avisa quantos cultos sem dividir têm alguém');

  r = post({ acao: 'adm_dividir_cultos', sessao: s });
  const cultos = r.adm.tarefas.filter((t) => t.tipo === 'culto');
  ok(r.ok && r.divididos === 7 && cultos.length === 21 && r.adm.tarefas.length === 30 - 7 + 21, 'divide: 7 cultos viram 21 funções');
  ok(cultos.every((t) => t.grupo) && new Set(cultos.map((t) => t.grupo)).size === 7, 'cada culto tem um grupo, com 3 funções');
  const dia20 = cultos.filter((t) => t.data === '2026-10-20');
  ok(dia20.map((t) => t.tarefa).join('|') === 'Vídeo de divulgação|Arte de divulgação|Gravações e fotos do MED' &&
    dia20.every((t) => t.detalhe === 'Postagem no insta e whats' && !t.nome), 'funções certas, detalhe mantido e quem estava fica livre');
  ok(r.adm.cultosSemDividir.total === 0, 'depois de dividir, nenhum culto fica sem dividir');
  r = post({ acao: 'adm_dividir_cultos', sessao: s });
  ok(r.ok && r.adm.tarefas.length === 44, 'dividir de novo não faz nada');

  // Culto novo já nasce com as três funções e prazos próprios.
  r = post({ acao: 'adm_criar_culto', sessao: s, culto: { data: '2026-11-05', detalhe: 'Culto de jovens', marca: 'Novembro', horas: { video: '12:00', arte: '09:00', fotos: '' } } });
  const novo = r.adm.tarefas.filter((t) => t.data === '2026-11-05');
  ok(r.ok && novo.length === 3 && new Set(novo.map((t) => t.grupo)).size === 1 && novo.map((t) => t.hora).join('|') === '12:00|09:00|',
    'culto novo: três funções no mesmo grupo, cada uma com seu prazo');
  r = post({ acao: 'adm_criar_culto', sessao: s, culto: { data: '2026-11-31', horas: {} } });
  ok(r.erro === 'tarefa_invalida', 'culto com data impossível é recusado');
  r = post({ acao: 'adm_criar_culto', sessao: s, culto: { data: '2026-11-06', horas: { arte: '9h' } } });
  ok(r.erro === 'tarefa_invalida', 'culto com prazo inválido é recusado');

  // Mudar a data de uma função muda a das três; o tipo continua culto.
  const video = novo[0];
  r = post({ acao: 'adm_salvar_tarefa', sessao: s, tarefa: Object.assign({}, video, { data: '2026-11-07', tipo: 'musica', hora: '13:00' }) });
  const depois = r.adm.tarefas.filter((t) => t.grupo === video.grupo);
  ok(depois.every((t) => t.data === '2026-11-07' && t.tipo === 'culto') && depois[0].hora === '13:00' && depois[1].hora === '09:00',
    'editar uma função: a data vale para as três, o prazo é só dela, o tipo continua culto');

  // Cada função tem a própria vaga.
  r = post({ acao: 'escalar', id: depois[0].id, nome: 'Bia', token: C });
  const r2 = post({ acao: 'escalar', id: depois[1].id, nome: 'Caio', token: D });
  ok(r.ok && r2.ok && r2.tarefas.find((t) => t.id === depois[0].id).nome === 'Bia' && r2.tarefas.find((t) => t.id === depois[1].id).nome === 'Caio' &&
    r2.tarefas.find((t) => t.id === depois[0].id).grupo === video.grupo, 'cada função tem a própria vaga, e a página recebe o grupo');

  // Avisos com o nome completo.
  const m = ctx.calcularMensagens([{ id: '9', data: '2026-11-07', hora: '13:00', tipo: 'culto', tarefa: 'Vídeo de divulgação', grupo: 'culto-50', detalhe: '' }],
    [{ tipo: 'dias', dias: 1, hora: '20:00' }],
    ctx.Utilities.parseDate('2026-11-06 19:58', 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm').getTime(),
    ctx.Utilities.parseDate('2026-11-06 20:02', 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm').getTime(), 'America/Sao_Paulo');
  ok(m.length === 1 && m[0].titulo === 'Amanhã: Culto · Vídeo de divulgação', 'aviso diz "Culto · Vídeo de divulgação"');

  // Ligar lembretes pela área do responsável.
  r = post({ acao: 'adm_ligar_lembretes', sessao: s });
  ok(r.ok && r.vapid && r.adm.lembretes.configurado && r.adm.lembretes.gatilho && gatilhos.length === 1, 'botão "Ligar lembretes" cria chave e gatilho');
  r = post({ acao: 'adm_ligar_lembretes' });
  ok(r.erro === 'sessao_expirada', '"Ligar lembretes" sem sessão é recusado');
  const amb2 = criarAmbiente(CAMINHO, { silencioso: true });
  amb2.props.SENHA_ADMIN = SENHA_TESTE;
  amb2.ctx.ScriptApp.newTrigger = () => { throw new Error('Você não tem permissão para chamar ScriptApp.newTrigger'); };
  const post2 = (o) => JSON.parse(amb2.ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ token: A }, o)) } }));
  const s2 = post2({ acao: 'adm_entrar', senha: SENHA_TESTE }).sessao;
  r = post2({ acao: 'adm_ligar_lembretes', sessao: s2 });
  ok(r.erro === 'lembretes_falhou' && r.detalhe.includes('permissão'), 'se o Google recusar, devolve o motivo para a tela mostrar');
  ok(r.vapid === null && !amb2.props.VAPID_PRIVADA && !amb2.props.VAPID_PUBLICA &&
    post2({ acao: 'adm_dados', sessao: s2 }).adm.lembretes.configurado === false,
    'sem o gatilho, a chave criada é desfeita: a página não oferece lembretes que nunca sairiam');
  delete amb2.ctx.ScriptApp.newTrigger;
  amb2.ctx.ScriptApp.newTrigger = (fn) => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => amb2.gatilhos.push(fn) }) }) });
  r = post2({ acao: 'adm_ligar_lembretes', sessao: s2 });
  ok(r.ok && r.vapid && amb2.gatilhos.length === 1, 'depois de autorizar, ligar de novo funciona');
}

// ======================================================================
secao('Assinatura ECDSA (RFC 6979, P-256, SHA-256)');
{
  const { ctx } = criarAmbiente(CAMINHO, { silencioso: true });
  // Vetor de teste A.2.5 da RFC 6979, mensagem "sample".
  const d = 'c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721';
  const assinatura = Buffer.from(ctx.ecAssinar(d, 'sample').map((b) => (b + 256) % 256)).toString('hex');
  ok(assinatura === 'efd48b2aacb6a8fd1140dd9cd45e81d69d2c877b56aaf991c34d0ea84eaf3716' +
    'f7cb1c942d657c41d436c7a1b6e29f65f3e900dbb9aff4064dc4ab2f843acda8', 'assinatura igual à da RFC 6979');
  const c = ctx.ecCurva();
  const Q = ctx.ecAfim(ctx.ecMultiplicar(BigInt('0x' + d), [c.gx, c.gy, c._1]));
  ok(ctx.ecHex32(Q.x) === '60fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb6' &&
    ctx.ecHex32(Q.y) === '7903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299', 'chave pública igual à da RFC 6979');

  for (let i = 0; i < 5; i++) {
    const chaves = ctx.ecGerarChaves();
    const pub = Buffer.from(chaves.publica, 'base64url');
    const jwk = { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') };
    const chave = crypto.createPublicKey({ key: jwk, format: 'jwk' }); // falha se o ponto não estiver na curva
    const jwt = ctx.jwtVapid('https://fcm.googleapis.com', 'https://exemplo.github.io', chaves.privada);
    const [h, p, sig] = jwt.split('.');
    const valido = crypto.verify('sha256', Buffer.from(h + '.' + p), { key: chave, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
    const corpo = JSON.parse(Buffer.from(p, 'base64url').toString());
    ok(pub.length === 65 && pub[0] === 4 && valido && corpo.aud === 'https://fcm.googleapis.com' && corpo.exp > Date.now() / 1000,
      'chave gerada #' + (i + 1) + ': ponto válido e JWT verificado pelo Node');
    ctx.CacheService.getScriptCache().remove('vapid-jwt-https://fcm.googleapis.com');
  }
}

// ======================================================================
secao('Lembretes');
{
  const { ctx, props, gatilhos, envios, TZ, formatar } = criarAmbiente(CAMINHO, { silencioso: true });
  const post = (o) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(o) } }));
  const get = (p) => JSON.parse(ctx.doGet({ parameter: p }));
  const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

  ctx.configurarLembretes();
  ok(props.VAPID_PRIVADA && props.VAPID_PUBLICA && gatilhos.join() === 'enviarLembretes', 'configurarLembretes cria chaves e o gatilho');
  ctx.configurarLembretes();
  ok(gatilhos.length === 1 && props.VAPID_PUBLICA === get({}).vapid, 'rodar de novo não duplica o gatilho nem troca a chave');

  post({ acao: 'escalar', id: '5', nome: 'Igor', token: A });
  let r = post({ acao: 'salvar_lembretes', token: A, inscricao: { endpoint: 'https://atacante.com/x' }, regras: [], site: 'https://x.github.io' });
  ok(r.erro === 'inscricao_invalida', 'endereço que não é serviço de push é recusado');
  r = post({ acao: 'salvar_lembretes', token: A, inscricao: { endpoint: ENDPOINT }, regras: [{ tipo: 'dias', dias: 99, hora: '20:00' }] });
  ok(r.erro === 'regras_invalidas', 'regra fora dos limites é recusada');
  r = post({ acao: 'salvar_lembretes', token: A, inscricao: { endpoint: ENDPOINT }, regras: new Array(6).fill({ tipo: 'antes', quantidade: 1, unidade: 'horas' }) });
  ok(r.erro === 'regras_invalidas', 'mais de 5 regras é recusado');

  // Uma tarefa com prazo daqui a 55 minutos (fuso de São Paulo), para a regra "1 hora antes" cair agora.
  const agora = Date.now();
  const prazo = new Date(Math.ceil((agora + 55 * 60000) / 60000) * 60000);
  const data = formatar(prazo, TZ, 'yyyy-MM-dd');
  const hora = formatar(prazo, TZ, 'HH:mm');
  props.SENHA_ADMIN = SENHA_TESTE;
  const s = post({ acao: 'adm_entrar', token: A, senha: SENHA_TESTE }).sessao;
  post({ acao: 'adm_salvar_tarefa', token: A, sessao: s, tarefa: { data, hora, tipo: 'culto', tarefa: 'Culto teste', detalhe: 'Postagem', nome: 'Igor' } });

  r = post({ acao: 'salvar_lembretes', token: A, inscricao: { endpoint: ENDPOINT }, site: 'https://x.github.io',
    regras: [{ tipo: 'antes', quantidade: 1, unidade: 'horas' }, { tipo: 'antes', quantidade: 30, unidade: 'minutos' }] });
  ok(r.ok && r.lembretes.ativo && r.lembretes.regras.length === 2, 'salva as regras do aparelho');
  ok(get({ token: A }).lembretes.regras[0].unidade === 'horas' && !get({ token: B }).lembretes.ativo, 'cada aparelho só vê as próprias regras');

  post({ acao: 'salvar_lembretes', token: B, inscricao: { endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/zzz' }, regras: [{ tipo: 'antes', quantidade: 1, unidade: 'horas' }] });

  props.LEMBRETES_ULTIMA = String(agora - 10 * 60000);
  envios.length = 0;
  ctx.enviarLembretes();
  ok(envios.length === 1 && envios[0].url === ENDPOINT, 'na janela: envia push só para o aparelho com a tarefa');
  ok(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/.test(envios[0].headers.Authorization) && envios[0].headers.TTL, 'cabeçalho VAPID no formato certo');
  r = get({ pendentes: ENDPOINT });
  ok(r.mensagens.length === 1 && r.mensagens[0].titulo === 'Falta 1 hora: Culto teste' && r.mensagens[0].corpo.includes('prazo ' + hora), 'service worker recebe a mensagem certa');
  ok(get({ pendentes: ENDPOINT }).mensagens.length === 0, 'depois de buscar, as pendentes somem');
  envios.length = 0;
  ctx.enviarLembretes();
  ok(envios.length === 0, 'rodar de novo logo em seguida não repete o aviso');

  const msgs = ctx.calcularMensagens([{ id: '9', data, hora, tarefa: 'Culto teste', detalhe: '' }],
    [{ tipo: 'antes', quantidade: 30, unidade: 'minutos' }], prazo.getTime() - 32 * 60000, prazo.getTime() - 27 * 60000, TZ);
  ok(msgs.length === 1 && msgs[0].titulo === 'Faltam 30 minutos: Culto teste', 'regra em minutos');

  const t1 = [{ id: '1', data: '2026-10-08', hora: '', tarefa: 'Culto', detalhe: 'Postagem' }, { id: '2', data: '2026-10-10', hora: '15:00', tarefa: 'Música', detalhe: '' }];
  const ms = (x) => ctx.Utilities.parseDate(x, TZ, 'yyyy-MM-dd HH:mm').getTime();
  let m = ctx.calcularMensagens(t1, [{ tipo: 'dias', dias: 1, hora: '20:00' }], ms('2026-10-07 19:57'), ms('2026-10-07 20:02'), TZ);
  ok(m.length === 1 && m[0].titulo === 'Amanhã: Culto' && m[0].corpo === 'qui, 8 out · prazo 09:00 · Postagem', '1 dia antes às 20:00 (prazo padrão 09:00)');
  m = ctx.calcularMensagens(t1, [{ tipo: 'dias', dias: 0, hora: '10:00' }], ms('2026-10-08 09:58'), ms('2026-10-08 10:03'), TZ);
  ok(m.length === 0, 'no dia às 10:00, depois do prazo das 09:00: não avisa');
  m = ctx.calcularMensagens(t1, [{ tipo: 'dias', dias: 3, hora: '08:00' }], ms('2026-10-07 07:58'), ms('2026-10-07 08:03'), TZ);
  ok(m.length === 1 && m[0].titulo === 'Em 3 dias: Música', '3 dias antes');
  m = ctx.calcularMensagens(t1, [{ tipo: 'semanal', dia: 0, hora: '18:00' }], ms('2026-10-04 17:58'), ms('2026-10-04 18:03'), TZ);
  ok(m.length === 1 && m[0].corpo === 'qui, 8 out · Culto\nsáb, 10 out · Música', 'resumo semanal no domingo às 18:00');
  m = ctx.calcularMensagens(t1, [{ tipo: 'semanal', dia: 1, hora: '18:00' }], ms('2026-10-04 17:58'), ms('2026-10-04 18:03'), TZ);
  ok(m.length === 0, 'resumo semanal não sai em outro dia da semana');

  envios.length = 0;
  r = post({ acao: 'testar_lembrete', token: A });
  ok(r.ok && envios.length === 1 && get({ pendentes: ENDPOINT }).mensagens[0].titulo === 'Lembretes funcionando', 'botão de teste envia na hora');
  r = post({ acao: 'testar_lembrete', token: C });
  ok(r.erro === 'lembretes_desligados', 'teste num aparelho sem lembretes avisa');

  const amb2 = criarAmbiente(CAMINHO, { silencioso: true, push: 410 });
  const post2 = (o) => JSON.parse(amb2.ctx.doPost({ postData: { contents: JSON.stringify(o) } }));
  amb2.ctx.configurarLembretes();
  post2({ acao: 'salvar_lembretes', token: A, inscricao: { endpoint: ENDPOINT }, regras: [] });
  r = post2({ acao: 'testar_lembrete', token: A });
  ok(r.erro === 'inscricao_vencida' && amb2.abas.Lembretes.dados.length === 1, 'inscrição cancelada pelo navegador (410) é apagada');

  r = post({ acao: 'remover_lembretes', token: A });
  ok(!r.lembretes.ativo, 'desligar os lembretes apaga a linha do aparelho');
}

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'Tudo certo.'));
process.exitCode = falhas ? 1 : 0;
