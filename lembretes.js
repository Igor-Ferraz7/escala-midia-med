// Lembretes: janela onde a pessoa escolhe quando quer ser avisada e ativa as notificações
// deste aparelho. Usa window.Escala (app.js) para falar com a planilha.
(function () {
  'use strict';

  const E = window.Escala;
  const el = (id) => document.getElementById(id);
  const dialogo = el('dialogo-lembretes');
  const listaRegras = el('lembretes-regras');
  const erro = el('lembretes-erro');
  const sucesso = el('lembretes-ok'); // dentro da janela: o aviso flutuante ficaria escondido atrás dela
  const status = el('lembretes-status');
  const botaoSalvar = el('lembretes-salvar');
  const botaoTestar = el('lembretes-testar');
  const botaoDesligar = el('lembretes-desligar');
  const botaoAbrir = el('abrir-lembretes');

  const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const MAX_REGRAS = 5;
  const PADRAO = [
    { tipo: 'dias', dias: 1, hora: '20:00' },
    { tipo: 'antes', quantidade: 2, unidade: 'horas' }
  ];

  let vapid = null;          // chave pública da planilha (null = lembretes não ligados pelo responsável)
  let ativo = false;         // este aparelho já está inscrito
  let regras = PADRAO.map((r) => Object.assign({}, r));
  let editando = false;      // enquanto a janela está aberta, a atualização automática não mexe nas regras
  let ocupado = false;

  // ---------- O que o navegador permite ----------

  const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const naTelaDeInicio = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const suportado = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function situacao() {
    if (!suportado) {
      return ehIOS && !naTelaDeInicio
        ? { texto: 'No iPhone e no iPad, os lembretes só funcionam com a escala na Tela de Início. Veja o passo abaixo.', tipo: 'alerta', bloqueia: true }
        : { texto: 'Este navegador não aceita notificações. Tente pelo Chrome, Safari, Firefox ou Edge.', tipo: 'alerta', bloqueia: true };
    }
    if (!vapid) return { texto: 'Os lembretes ainda não foram ligados pelo responsável da escala.', tipo: 'alerta', bloqueia: true };
    if (Notification.permission === 'denied') {
      return { texto: 'As notificações estão bloqueadas para este site. Libere nas configurações do navegador (no cadeado ao lado do endereço, ou em Configurações → Notificações) e volte aqui.', tipo: 'alerta', bloqueia: true };
    }
    if (ativo) return { texto: 'Lembretes ativos neste aparelho.', tipo: 'ok', bloqueia: false };
    return { texto: 'Lembretes desligados neste aparelho.', tipo: '', bloqueia: false };
  }

  // ---------- Desenho ----------

  function esc(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function opcoes(lista, atual) {
    return lista.map((o) => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(atual) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('');
  }

  function camposDaRegra(r, i) {
    if (r.tipo === 'dias') {
      return '<input type="number" inputmode="numeric" min="0" max="14" value="' + r.dias + '" data-i="' + i + '" data-campo="dias" aria-label="Dias antes">' +
        '<span>dia(s) antes, às</span>' +
        '<input type="time" value="' + esc(r.hora) + '" data-i="' + i + '" data-campo="hora" aria-label="Horário">' +
        '<small>0 = no próprio dia</small>';
    }
    if (r.tipo === 'antes') {
      return '<input type="number" inputmode="numeric" min="1" max="1440" value="' + r.quantidade + '" data-i="' + i + '" data-campo="quantidade" aria-label="Quantidade">' +
        '<select data-i="' + i + '" data-campo="unidade" aria-label="Unidade">' + opcoes([['minutos', 'minutos'], ['horas', 'horas']], r.unidade) + '</select>' +
        '<span>antes do prazo</span>';
    }
    return '<span>Toda</span>' +
      '<select data-i="' + i + '" data-campo="dia" aria-label="Dia da semana">' + opcoes(DIAS_SEMANA.map((d, n) => [n, d]), r.dia) + '</select>' +
      '<span>às</span>' +
      '<input type="time" value="' + esc(r.hora) + '" data-i="' + i + '" data-campo="hora" aria-label="Horário">' +
      '<small>resumo das suas tarefas dos próximos 7 dias</small>';
  }

  function desenharRegras() {
    listaRegras.innerHTML = regras.map((r, i) =>
      '<div class="regra">' +
        '<div class="regra-topo">' +
          '<select data-i="' + i + '" data-campo="tipo" aria-label="Tipo de lembrete">' +
            opcoes([['dias', 'Dias antes, num horário'], ['antes', 'Horas ou minutos antes'], ['semanal', 'Toda semana, num dia fixo']], r.tipo) +
          '</select>' +
          '<button type="button" class="icone pequeno" data-remover="' + i + '" aria-label="Remover lembrete">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="regra-campos">' + camposDaRegra(r, i) + '</div>' +
      '</div>'
    ).join('') || '<p class="dica">Nenhum lembrete. Adicione pelo menos um.</p>';
    el('lembrete-adicionar').hidden = regras.length >= MAX_REGRAS;
  }

  function desenharSituacao() {
    const s = situacao();
    status.textContent = s.texto;
    status.className = 'status' + (s.tipo ? ' ' + s.tipo : '');
    botaoSalvar.disabled = s.bloqueia;
    botaoSalvar.textContent = ativo ? 'Salvar lembretes' : 'Ativar lembretes';
    botaoTestar.hidden = !ativo || s.bloqueia;
    botaoDesligar.hidden = !ativo;
    botaoAbrir.classList.toggle('ativo', ativo);
    botaoAbrir.setAttribute('aria-label', ativo ? 'Lembretes (ativos)' : 'Lembretes');
  }

  // ---------- Dados vindos da planilha ----------

  function receber(r) {
    if (!r) return;
    vapid = r.vapid || null;
    const l = r.lembretes || { ativo: false, regras: [] };
    ativo = !!l.ativo;
    if (!editando && ativo && l.regras.length) regras = l.regras.map((x) => Object.assign({}, x));
    if (r.horaPadrao) el('hora-padrao').textContent = r.horaPadrao;
    desenharSituacao();
  }
  document.addEventListener('escala:dados', (ev) => receber(ev.detail));
  receber(E.ultimo);

  // ---------- Edição das regras ----------

  function regraNova(tipo) {
    if (tipo === 'antes') return { tipo: 'antes', quantidade: 1, unidade: 'horas' };
    if (tipo === 'semanal') return { tipo: 'semanal', dia: 0, hora: '18:00' };
    return { tipo: 'dias', dias: 1, hora: '20:00' };
  }

  listaRegras.addEventListener('change', (ev) => {
    const campo = ev.target.dataset.campo;
    if (!campo) return;
    const i = Number(ev.target.dataset.i);
    erro.textContent = '';
    sucesso.textContent = '';
    if (campo === 'tipo') {
      regras[i] = regraNova(ev.target.value);
      desenharRegras();
      return;
    }
    regras[i][campo] = ['dias', 'quantidade', 'dia'].includes(campo) ? Number(ev.target.value) : ev.target.value;
  });
  listaRegras.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-remover]');
    if (!b) return;
    regras.splice(Number(b.dataset.remover), 1);
    desenharRegras();
  });
  el('lembrete-adicionar').addEventListener('click', () => {
    if (regras.length >= MAX_REGRAS) return;
    regras.push(regraNova('dias'));
    desenharRegras();
  });

  // Mesmos limites da planilha, para avisar antes de enviar.
  function conferirRegras() {
    if (!regras.length) return 'Adicione pelo menos um lembrete.';
    const hora = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h || '');
    for (const r of regras) {
      if (r.tipo === 'dias' && !(Number.isInteger(r.dias) && r.dias >= 0 && r.dias <= 14 && hora(r.hora))) return 'Em "dias antes", use de 0 a 14 dias e um horário.';
      if (r.tipo === 'antes') {
        const max = r.unidade === 'horas' ? 72 : 1440;
        const min = r.unidade === 'horas' ? 1 : 5;
        if (!(Number.isInteger(r.quantidade) && r.quantidade >= min && r.quantidade <= max)) {
          return r.unidade === 'horas' ? 'Em "horas antes", use de 1 a 72 horas.' : 'Em "minutos antes", use de 5 a 1440 minutos.';
        }
      }
      if (r.tipo === 'semanal' && !hora(r.hora)) return 'Escolha o horário do resumo semanal.';
    }
    return '';
  }

  // ---------- Ativar, testar, desligar ----------

  function chaveEmBytes(b64) {
    const base = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base), (c) => c.charCodeAt(0));
  }

  async function inscrever() {
    const registro = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    const chave = chaveEmBytes(vapid);
    let inscricao = await registro.pushManager.getSubscription();
    // Inscrição feita com outra chave (o responsável refez a configuração): troca.
    if (inscricao && inscricao.options && inscricao.options.applicationServerKey) {
      const atual = new Uint8Array(inscricao.options.applicationServerKey);
      if (atual.length !== chave.length || atual.some((b, i) => b !== chave[i])) {
        await inscricao.unsubscribe();
        inscricao = null;
      }
    }
    return inscricao || registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
  }

  const ERROS = {
    inscricao_invalida: 'Este navegador usa um serviço de notificação que a escala não reconhece.',
    regras_invalidas: 'Algum lembrete está fora dos limites. Confira os números.',
    lembretes_desligados: 'Os lembretes não estão ativos neste aparelho.',
    inscricao_vencida: 'O navegador cancelou as notificações deste aparelho. Toque em "Ativar lembretes" de novo.',
    push_falhou: 'O serviço de notificação não aceitou o envio. Tente de novo mais tarde.'
  };

  async function comBotao(botao, textoEspera, tarefa) {
    if (ocupado) return;
    ocupado = true;
    const original = botao.textContent;
    botao.disabled = true;
    botao.textContent = textoEspera;
    erro.textContent = '';
    sucesso.textContent = '';
    try {
      await tarefa();
    } catch (e) {
      erro.textContent = (e && e.mensagem) || 'Não deu certo. Confira a internet e tente de novo.';
    } finally {
      ocupado = false;
      botao.textContent = original;
      desenharSituacao();
    }
  }

  async function pedir(acao, dados) {
    const r = await E.enviar(acao, dados || {});
    if (r && Array.isArray(r.tarefas)) E.publicar(r);
    if (!r || !r.ok) throw { mensagem: ERROS[r && r.erro] || 'Não deu certo. Tente de novo.' };
    return r;
  }

  botaoSalvar.addEventListener('click', () => comBotao(botaoSalvar, 'Ativando…', async () => {
    const problema = conferirRegras();
    if (problema) throw { mensagem: problema };
    // O pedido de permissão precisa sair direto do toque no botão.
    const permissao = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permissao !== 'granted') {
      throw { mensagem: 'Sem permissão, o navegador não mostra os lembretes. Se você tocou em Bloquear, libere nas configurações do navegador.' };
    }
    let inscricao;
    try {
      inscricao = await inscrever();
    } catch (e) {
      throw { mensagem: 'O navegador não conseguiu ativar as notificações. ' + (ehIOS ? 'No iPhone, abra a escala pelo ícone da Tela de Início.' : 'Tente pelo Chrome ou Firefox.') };
    }
    const eraAtivo = ativo;
    await pedir('salvar_lembretes', { inscricao: inscricao.toJSON(), regras: regras, site: location.origin });
    sucesso.textContent = eraAtivo ? 'Lembretes salvos.' : 'Lembretes ativos neste aparelho. Use "Enviar teste" para conferir.';
  }));

  botaoTestar.addEventListener('click', () => comBotao(botaoTestar, 'Enviando…', async () => {
    await pedir('testar_lembrete');
    sucesso.textContent = 'Teste enviado. A notificação deve aparecer em alguns segundos.';
  }));

  botaoDesligar.addEventListener('click', () => comBotao(botaoDesligar, 'Desligando…', async () => {
    await pedir('remover_lembretes');
    try {
      const registro = await navigator.serviceWorker.getRegistration();
      const inscricao = registro && await registro.pushManager.getSubscription();
      if (inscricao) await inscricao.unsubscribe();
    } catch (e) { /* a planilha já não envia mais nada; o resto é limpeza */ }
    regras = PADRAO.map((r) => Object.assign({}, r));
    desenharRegras();
    sucesso.textContent = 'Lembretes desligados neste aparelho.';
  }));

  // ---------- Abrir e fechar ----------

  botaoAbrir.addEventListener('click', () => {
    editando = true;
    erro.textContent = '';
    sucesso.textContent = '';
    desenharRegras();
    desenharSituacao();
    dialogo.showModal();
  });
  dialogo.addEventListener('close', () => { editando = false; });
  dialogo.addEventListener('click', (ev) => {
    // Toque fora da caixa (no fundo escurecido) ou no X fecha.
    if (ev.target === dialogo || ev.target.closest('[data-fechar]')) dialogo.close();
  });
})();
