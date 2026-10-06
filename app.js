(function () {
  'use strict';

  const API = ((window.ESCALA_CONFIG && window.ESCALA_CONFIG.urlPlanilha) || '').trim();
  const DEMO = !API;

  const CORES = {
    culto: '#2563EB',
    resumo: '#10B981',
    musica: '#EC4899',
    devocional: '#F59E0B',
    oracao: '#8B5CF6',
    momento: '#F97316',
    aviso: '#9CA3AF'
  };
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  // Usado só no modo demonstração. A versão de verdade vem da planilha.
  const TAREFAS_DEMO = [
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

  const el = (id) => document.getElementById(id);
  const campoNome = el('nome');
  const erroNome = el('erro-nome');
  const lista = el('lista');
  const botaoAtualizar = el('atualizar');

  let tarefas = [];
  let filtro = 'todos';
  let jaRolou = false;
  let ocupado = false;

  // ---------- Armazenamento no aparelho ----------

  function ler(chave) {
    try { return localStorage.getItem(chave); } catch (e) { return null; }
  }
  function gravar(chave, valor) {
    try { localStorage.setItem(chave, valor); } catch (e) { /* sem armazenamento: segue sem lembrar */ }
  }

  function criarToken() {
    const bytes = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return 't' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  let token = ler('escala-token');
  if (!token) {
    token = criarToken();
    gravar('escala-token', token);
  }

  campoNome.value = ler('escala-nome') || '';
  campoNome.addEventListener('input', () => {
    erroNome.textContent = '';
    gravar('escala-nome', campoNome.value.trim());
  });

  // ---------- Comunicação com a planilha ----------

  async function buscar() {
    if (DEMO) return demoListar();
    const resposta = await fetch(API + '?token=' + encodeURIComponent(token), { cache: 'no-store' });
    return resposta.json();
  }

  async function enviar(acao, dados) {
    if (DEMO) return demoAcao(acao, dados);
    // Sem cabeçalho de JSON de propósito: o Google Apps Script recusa a checagem prévia que o navegador faria.
    const resposta = await fetch(API, {
      method: 'POST',
      body: JSON.stringify(Object.assign({ acao: acao, token: token }, dados))
    });
    return resposta.json();
  }

  function demoBase() {
    try {
      const salvo = JSON.parse(ler('escala-demo'));
      if (Array.isArray(salvo)) return salvo;
    } catch (e) { /* recomeça */ }
    return TAREFAS_DEMO.map((t) => ({ id: t[0], data: t[1], tipo: t[2], tarefa: t[3], detalhe: t[4], marca: t[5], nome: '', token: '' }));
  }
  function demoListar() {
    const base = demoBase();
    return {
      ok: true,
      tarefas: base.map((t) => ({ id: t.id, data: t.data, tipo: t.tipo, tarefa: t.tarefa, detalhe: t.detalhe, marca: t.marca, nome: t.nome, seu: t.token === token }))
    };
  }
  function demoAcao(acao, dados) {
    const base = demoBase();
    const t = base.find((x) => x.id === dados.id);
    let erro = null;
    if (!t) erro = 'tarefa_nao_existe';
    else if (acao === 'escalar') {
      if (t.nome) erro = 'ocupada';
      else { t.nome = dados.nome; t.token = token; }
    } else if (acao === 'desfazer') {
      if (t.token !== token) erro = 'nao_e_seu';
      else { t.nome = ''; t.token = ''; }
    }
    gravar('escala-demo', JSON.stringify(base));
    return Object.assign(demoListar(), { ok: !erro, erro: erro });
  }

  // ---------- Datas ----------

  function paraData(texto) {
    const p = String(texto).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function hoje() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function inicioDaSemana(d) {
    const s = new Date(d);
    s.setDate(d.getDate() - d.getDay());
    return s;
  }

  // ---------- Desenho da página ----------

  function esc(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function botaoDaTarefa(t, passou) {
    if (t.seu) {
      return '<button type="button" class="voce" data-acao="desfazer" data-id="' + esc(t.id) + '" aria-label="Você está nesta tarefa. Toque para sair">Você ✓</button>';
    }
    if (t.nome) return '<span class="quem" title="' + esc(t.nome) + '">' + esc(t.nome) + '</span>';
    if (passou) return '<span class="sem-ninguem">Sem ninguém</span>';
    return '<button type="button" class="quero" data-acao="escalar" data-id="' + esc(t.id) + '">Quero</button>';
  }

  function linhaDaTarefa(t, agora) {
    const d = paraData(t.data);
    const passou = d < agora;
    const ehHoje = d.getTime() === agora.getTime();
    const cor = CORES[t.tipo] || CORES.aviso;
    return '<div class="linha' + (passou ? ' passado' : '') + (ehHoje ? ' hoje' : '') + '">' +
      '<div class="data"><b>' + d.getDate() + '</b><small>' + (ehHoje ? 'hoje' : DIAS[d.getDay()]) + '</small></div>' +
      '<div class="info"><div class="titulo"><span class="ponto" style="background:' + cor + '"></span>' + esc(t.tarefa) + '</div>' +
      (t.detalhe ? '<div class="detalhe">' + esc(t.detalhe) + '</div>' : '') + '</div>' +
      '<div class="acao">' + botaoDaTarefa(t, passou) + '</div></div>';
  }

  function render() {
    const agora = hoje();
    const ordenadas = tarefas.slice().sort((a, b) => a.data.localeCompare(b.data) || Number(a.id) - Number(b.id));

    if (ordenadas.length) {
      const primeira = paraData(ordenadas[0].data);
      el('mes').textContent = MESES[primeira.getMonth()].replace(/^./, (c) => c.toUpperCase()) + ' ' + primeira.getFullYear();
    }

    const preenchidas = ordenadas.filter((t) => t.nome).length;
    const minhas = ordenadas.filter((t) => t.seu).length;
    el('preenchidas').textContent = ordenadas.length ? preenchidas + ' de ' + ordenadas.length + ' vagas preenchidas' : '';
    el('minhas').textContent = minhas ? 'Você: ' + minhas : '';
    el('barra').style.width = ordenadas.length ? Math.round((preenchidas / ordenadas.length) * 100) + '%' : '0';

    // Semanas numeradas pela lista completa, para o número não mudar quando um filtro esconde uma semana.
    const semanas = [];
    const porChave = {};
    ordenadas.forEach((t) => {
      const ini = inicioDaSemana(paraData(t.data));
      const chave = ini.getTime();
      if (!porChave[chave]) {
        porChave[chave] = { numero: semanas.length + 1, inicio: ini, tarefas: [] };
        semanas.push(porChave[chave]);
      }
      porChave[chave].tarefas.push(t);
    });

    const visivel = (t) => filtro === 'livres' ? (!t.nome && paraData(t.data) >= agora)
      : filtro === 'minhas' ? t.seu
      : true;

    let html = '';
    let alvo = null;
    semanas.forEach((s) => {
      const mostrar = s.tarefas.filter(visivel);
      if (!mostrar.length) return;
      const fim = new Date(s.inicio);
      fim.setDate(fim.getDate() + 6);
      const marcas = Array.from(new Set(s.tarefas.map((t) => t.marca).filter(Boolean)));
      const ultimoDia = paraData(s.tarefas[s.tarefas.length - 1].data);
      if (!alvo && ultimoDia >= agora) alvo = 'semana-' + s.numero;
      html += '<section class="semana" id="semana-' + s.numero + '">' +
        '<div class="semana-titulo">Semana ' + s.numero + ' · ' + s.inicio.getDate() + ' a ' + fim.getDate() + ' ' + MESES[fim.getMonth()].slice(0, 3) +
        marcas.map((m) => '<span class="marca">' + esc(m) + '</span>').join('') + '</div>' +
        mostrar.map((t) => linhaDaTarefa(t, agora)).join('') + '</section>';
    });

    if (!html) {
      html = '<p class="vazio">' + (
        !ordenadas.length ? 'Nenhuma tarefa na planilha ainda.'
          : filtro === 'minhas' ? 'Você ainda não se escalou. Escolha uma tarefa em Todos.'
          : 'Todas as vagas que faltam já têm alguém.'
      ) + '</p>';
    }
    lista.innerHTML = html;

    if (!jaRolou && filtro === 'todos' && alvo && ordenadas.length) {
      jaRolou = true;
      const alvoEl = el(alvo);
      if (alvoEl && alvo !== 'semana-1') alvoEl.scrollIntoView({ block: 'start' });
    }
  }

  // ---------- Avisos ----------

  let tempoToast;
  function avisar(texto) {
    const t = el('toast');
    t.textContent = texto;
    t.classList.add('ver');
    clearTimeout(tempoToast);
    tempoToast = setTimeout(() => t.classList.remove('ver'), 3200);
  }

  function descrever(t) {
    const d = paraData(t.data);
    return t.tarefa + ' (' + DIAS[d.getDay()] + ', ' + d.getDate() + ')';
  }

  // ---------- Ações ----------

  async function carregar(mostrarGiro) {
    if (ocupado) return;
    if (mostrarGiro) botaoAtualizar.classList.add('girando');
    try {
      const r = await buscar();
      if (r && r.ok) {
        tarefas = r.tarefas;
        render();
      } else {
        throw new Error((r && r.erro) || 'resposta');
      }
    } catch (e) {
      if (!tarefas.length) lista.innerHTML = '<p class="vazio">Não deu para carregar a escala. Confira a internet e toque em atualizar.</p>';
      else if (mostrarGiro) avisar('Não deu para atualizar. Confira a internet.');
    } finally {
      botaoAtualizar.classList.remove('girando');
    }
  }

  lista.addEventListener('click', async (ev) => {
    const botao = ev.target.closest('button[data-acao]');
    if (!botao || ocupado) return;
    const tarefa = tarefas.find((t) => String(t.id) === botao.dataset.id);
    if (!tarefa) return;
    const acao = botao.dataset.acao;
    const nome = campoNome.value.replace(/\s+/g, ' ').trim();

    if (acao === 'escalar' && !nome) {
      erroNome.textContent = 'Escreva seu nome antes de escolher uma tarefa.';
      campoNome.scrollIntoView({ block: 'center', behavior: 'smooth' });
      campoNome.focus({ preventScroll: true });
      return;
    }
    if (acao === 'desfazer' && !window.confirm('Sair de ' + descrever(tarefa) + '?')) return;

    ocupado = true;
    botao.disabled = true;
    botao.textContent = 'Salvando…';
    try {
      const r = await enviar(acao, { id: String(tarefa.id), nome: nome });
      if (r && Array.isArray(r.tarefas)) tarefas = r.tarefas;
      if (r && r.ok) {
        avisar(acao === 'escalar' ? 'Pronto, você ficou com ' + descrever(tarefa) + '.' : 'Você saiu de ' + descrever(tarefa) + '.');
      } else if (r && r.erro === 'ocupada') {
        avisar('Alguém pegou essa vaga antes de você.');
      } else if (r && r.erro === 'nao_e_seu') {
        avisar('Só dá para sair pelo mesmo aparelho em que você se escalou.');
      } else {
        avisar('Não deu para salvar. Tente de novo.');
      }
    } catch (e) {
      avisar('Não deu para salvar. Confira a internet e tente de novo.');
    } finally {
      ocupado = false;
      render();
    }
  });

  el('filtros').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-filtro]');
    if (!b) return;
    filtro = b.dataset.filtro;
    document.querySelectorAll('.filtro').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  });

  botaoAtualizar.addEventListener('click', () => carregar(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) carregar(false); });
  setInterval(() => { if (!document.hidden) carregar(false); }, 60000);

  if (DEMO) el('aviso-demo').hidden = false;
  carregar(false);
})();
