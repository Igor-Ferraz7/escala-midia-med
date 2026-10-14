// Área do responsável. A senha é conferida pela planilha (Propriedades do script),
// que devolve uma sessão de algumas horas. A página nunca conhece a senha guardada.
(function () {
  'use strict';

  const API = ((window.ESCALA_CONFIG && window.ESCALA_CONFIG.urlPlanilha) || '').trim();
  const CORES = { culto: '#2563EB', resumo: '#10B981', musica: '#EC4899', devocional: '#F59E0B', oracao: '#8B5CF6', momento: '#F97316', aviso: '#9CA3AF' };
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const el = (id) => document.getElementById(id);
  const formEntrar = el('form-entrar');
  const painel = el('painel-adm');
  const dialogo = el('dialogo-tarefa');

  let dados = null;   // { tarefas, pessoas, lembretes, horaPadrao }
  let editandoId = '';
  const selecionadas = new Set(); // ids das tarefas marcadas para ação em massa
  let ocupado = false;

  // ---------- Armazenamento ----------

  function ler(k, s) { try { return (s || localStorage).getItem(k); } catch (e) { return null; } }
  function gravar(k, v, s) { try { (s || localStorage).setItem(k, v); } catch (e) { /* segue sem lembrar */ } }
  function apagar(k, s) { try { (s || localStorage).removeItem(k); } catch (e) { /* nada */ } }

  // O mesmo código de aparelho da página principal (a planilha exige um em todo pedido).
  let token = ler('escala-token');
  if (!token) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    token = 't' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    gravar('escala-token', token);
  }
  // A sessão fica só nesta aba do navegador: fechou, precisa entrar de novo.
  let sessao = ler('escala-adm-sessao', sessionStorage) || '';

  // ---------- Comunicação ----------

  const ERROS = {
    senha_errada: 'Senha errada.',
    bloqueado: 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.',
    senha_nao_configurada: 'A senha ainda não foi cadastrada. No Apps Script, em Configurações do projeto → Propriedades do script, crie SENHA_ADMIN.',
    tarefa_invalida: 'Confira a data, o horário e o nome da tarefa.',
    tarefa_nao_existe: 'Essa tarefa não existe mais. A lista foi atualizada.',
    nome_nao_existe: 'Esse nome não existe mais. A lista foi atualizada.'
  };

  async function pedir(acao, extra) {
    if (!API) throw { mensagem: 'Coloque o endereço da planilha no config.js para usar esta área.' };
    let r;
    try {
      const resposta = await fetch(API, {
        method: 'POST',
        body: JSON.stringify(Object.assign({ acao: acao, token: token, sessao: sessao }, extra || {}))
      });
      r = await resposta.json();
    } catch (e) {
      throw { mensagem: 'Não deu para falar com a planilha. Confira a internet e tente de novo.' };
    }
    if (r.erro === 'sessao_expirada') {
      encerrar();
      throw { mensagem: 'Sua sessão terminou. Entre de novo.' };
    }
    if (r.adm) dados = r.adm;
    if (!r.ok) {
      if (r.adm || r.erro === 'tarefa_nao_existe' || r.erro === 'nome_nao_existe') desenhar();
      throw { mensagem: ERROS[r.erro] || 'Não deu certo. Tente de novo.', codigo: r.erro };
    }
    return r;
  }

  // ---------- Entrar e sair ----------

  function mostrar(qual) {
    el('carregando').hidden = qual !== 'carregando';
    formEntrar.hidden = qual !== 'entrar';
    painel.hidden = qual !== 'painel';
    el('sair').hidden = qual !== 'painel';
    if (qual === 'entrar') el('senha').focus();
  }

  function encerrar() {
    sessao = '';
    dados = null;
    apagar('escala-adm-sessao', sessionStorage);
    if (dialogo.open) dialogo.close();
    mostrar('entrar');
  }

  formEntrar.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const campo = el('senha');
    const erro = el('erro-entrar');
    erro.textContent = '';
    if (!campo.value) { erro.textContent = 'Digite a senha.'; return; }
    const botao = formEntrar.querySelector('button');
    botao.disabled = true;
    try {
      const r = await pedir('adm_entrar', { senha: campo.value });
      sessao = r.sessao;
      gravar('escala-adm-sessao', sessao, sessionStorage);
      campo.value = '';
      mostrar('painel');
      desenhar();
    } catch (e) {
      erro.textContent = e.mensagem;
      campo.select();
    } finally {
      botao.disabled = false;
    }
  });
  el('senha').addEventListener('input', () => { el('erro-entrar').textContent = ''; });

  el('sair').addEventListener('click', async () => {
    try { await pedir('adm_sair'); } catch (e) { /* sai do mesmo jeito */ }
    encerrar();
  });

  // ---------- Desenho ----------

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function paraData(texto) {
    const p = String(texto).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function dataCurta(texto) {
    const d = paraData(texto);
    return DIAS[d.getDay()] + ', ' + d.getDate() + ' ' + MESES[d.getMonth()];
  }

  function desenhar() {
    if (!dados) return;
    desenharTarefas();
    desenharPessoas();
    desenharGeral();
    el('nomes-adm').innerHTML = dados.pessoas.map((p) => '<option value="' + esc(p.nome) + '">').join('');
  }

  // Ícones dos botões: lápis (editar), pessoa saindo (tirar) e lixeira (excluir).
  const svg = (d) => '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const ICONE = {
    editar: svg('<path d="M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/>'),
    tirar: svg('<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 11h6"/>'),
    excluir: svg('<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>')
  };

  function semanaDe(texto) {
    const d = paraData(texto);
    const ini = new Date(d); ini.setDate(d.getDate() - d.getDay());
    const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
    return { chave: ini.getFullYear() + '-' + (ini.getMonth() + 1) + '-' + ini.getDate(), ini: ini, fim: fim };
  }

  function desenharTarefas() {
    const tarefas = dados.tarefas.slice().sort((a, b) => a.data.localeCompare(b.data) || Number(a.id) - Number(b.id));
    // Tarefa que sumiu (excluída por outra pessoa, ou nesta ação) sai da seleção.
    const existentes = new Set(tarefas.map((t) => t.id));
    Array.from(selecionadas).forEach((id) => { if (!existentes.has(id)) selecionadas.delete(id); });

    const preenchidas = tarefas.filter((t) => t.nome).length;
    el('resumo-tarefas').textContent = tarefas.length
      ? tarefas.length + ' tarefas · ' + preenchidas + ' com alguém · ' + (tarefas.length - preenchidas) + ' livres'
      : 'Nenhuma tarefa ainda.';

    const semanas = [];
    tarefas.forEach((t) => {
      const s = semanaDe(t.data);
      if (!semanas.length || semanas[semanas.length - 1].chave !== s.chave) semanas.push(Object.assign(s, { tarefas: [] }));
      semanas[semanas.length - 1].tarefas.push(t);
    });

    el('lista-adm').innerHTML = semanas.map((s) => {
      const marcas = Array.from(new Set(s.tarefas.map((x) => x.marca).filter(Boolean)));
      return '<section class="adm-semana" data-semana="' + s.chave + '">' +
        '<div class="semana-titulo">' + s.ini.getDate() + ' ' + MESES[s.ini.getMonth()] + ' a ' + s.fim.getDate() + ' ' + MESES[s.fim.getMonth()] +
          marcas.map((m) => '<span class="marca">' + esc(m) + '</span>').join('') +
          '<label class="marcar-semana"><input type="checkbox" data-marcar-semana="' + s.chave + '"> Marcar todos</label>' +
        '</div>' +
        s.tarefas.map((t) => {
          const d = paraData(t.data);
          const detalhe = [t.detalhe, t.hora ? 'até ' + t.hora : ''].filter(Boolean).join(' · ');
          return '<div class="adm-linha" data-linha="' + esc(t.id) + '">' +
            '<label class="sel-tarefa"><input type="checkbox" data-sel="' + esc(t.id) + '"' + (selecionadas.has(t.id) ? ' checked' : '') +
              ' aria-label="Marcar ' + esc(t.tarefa) + ', ' + dataCurta(t.data) + '"></label>' +
            '<div class="data"><b>' + d.getDate() + '</b><small>' + DIAS[d.getDay()] + '</small></div>' +
            '<div class="info">' +
              '<div class="titulo"><span class="ponto" style="background:' + (CORES[t.tipo] || CORES.aviso) + '"></span>' + esc(t.tarefa) + '</div>' +
              (detalhe ? '<div class="detalhe">' + esc(detalhe) + '</div>' : '') +
              '<div class="quem-adm' + (t.nome ? '' : ' vazio-adm') + '">' + (t.nome ? esc(t.nome) : 'Sem ninguém') + '</div>' +
            '</div>' +
            '<div class="adm-acoes">' +
              '<button type="button" class="mini editar" data-editar="' + esc(t.id) + '">' + ICONE.editar + 'Editar</button>' +
              (t.nome ? '<button type="button" class="mini tirar" data-tirar="' + esc(t.id) + '">' + ICONE.tirar + 'Tirar pessoa</button>' : '') +
              '<button type="button" class="mini perigo" data-excluir="' + esc(t.id) + '">' + ICONE.excluir + 'Excluir</button>' +
            '</div></div>';
        }).join('') +
        '</section>';
    }).join('');
    atualizarSelecao();
  }

  // Marca de cada semana (cheia, parcial ou vazia), destaque das linhas e barra de ações em massa.
  function atualizarSelecao() {
    document.querySelectorAll('.adm-semana').forEach((sec) => {
      const caixas = Array.from(sec.querySelectorAll('[data-sel]'));
      const marcadas = caixas.filter((c) => selecionadas.has(c.dataset.sel)).length;
      const todas = sec.querySelector('[data-marcar-semana]');
      todas.checked = marcadas > 0 && marcadas === caixas.length;
      todas.indeterminate = marcadas > 0 && marcadas < caixas.length;
      caixas.forEach((c) => {
        c.checked = selecionadas.has(c.dataset.sel);
        c.closest('.adm-linha').classList.toggle('selecionada', c.checked);
      });
    });
    const marcadas = dados ? dados.tarefas.filter((t) => selecionadas.has(t.id)) : [];
    const comPessoa = marcadas.filter((t) => t.nome).length;
    el('barra-massa').hidden = !marcadas.length;
    el('qtd-sel').textContent = marcadas.length === 1 ? '1 tarefa marcada' : marcadas.length + ' tarefas marcadas';
    el('massa-tirar').hidden = !comPessoa;
    el('massa-tirar').innerHTML = ICONE.tirar + 'Tirar ' + (comPessoa === 1 ? 'a pessoa' : comPessoa + ' pessoas');
    el('massa-excluir').innerHTML = ICONE.excluir + 'Excluir ' + (marcadas.length === 1 ? 'a tarefa' : marcadas.length + ' tarefas');
  }

  function desenharPessoas() {
    el('lista-pessoas').innerHTML = dados.pessoas.length ? dados.pessoas.map((p) => {
      const desde = p.desde ? ' · desde ' + p.desde.split('-').reverse().slice(0, 2).join('/') : '';
      const aparelhos = p.aparelhos === 0 ? 'nenhum aparelho' : p.aparelhos === 1 ? '1 aparelho' : p.aparelhos + ' aparelhos';
      return '<div class="adm-linha">' +
        '<div class="info"><div class="titulo">' + esc(p.nome) + '</div><div class="detalhe">' + aparelhos + desde + '</div></div>' +
        '<div class="adm-acoes">' +
          (p.aparelhos ? '<button type="button" class="mini tirar" data-liberar="' + esc(p.nome) + '">Desligar aparelhos</button>' : '') +
          '<button type="button" class="mini perigo" data-excluir-pessoa="' + esc(p.nome) + '">' + ICONE.excluir + 'Excluir</button>' +
        '</div></div>';
    }).join('') : '<p class="vazio">Ninguém se escalou ainda.</p>';
  }

  function desenharGeral() {
    const l = dados.lembretes;
    let html;
    if (l.configurado && l.gatilho) {
      html = '<p class="status ok">Ligados. ' + (l.aparelhos === 1 ? '1 aparelho recebe' : l.aparelhos + ' aparelhos recebem') + ' lembretes.</p>' +
        '<p>Cada pessoa ativa e escolhe os horários no sino da página da escala.</p>';
    } else {
      html = '<p class="status alerta">' + (l.configurado ? 'O gatilho que envia os lembretes a cada 5 minutos não está ativo.' : 'Os lembretes ainda não foram ligados.') + '</p>' +
        '<ol><li>Abra a planilha → Extensões → Apps Script.</li>' +
        '<li>Na barra de cima, escolha a função <code>configurarLembretes</code> e clique em Executar.</li>' +
        '<li>Autorize quando o Google pedir. Basta fazer isso uma vez.</li></ol>';
    }
    el('estado-lembretes').innerHTML = html;
  }

  // ---------- Abas ----------

  document.querySelector('.adm-abas').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-aba]');
    if (!b) return;
    document.querySelectorAll('[data-aba]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ['tarefas', 'pessoas', 'geral'].forEach((a) => { el('aba-' + a).hidden = a !== b.dataset.aba; });
  });

  // ---------- Avisos ----------

  let tempoToast;
  function avisar(texto) {
    const t = el('toast');
    t.textContent = texto;
    t.classList.add('ver');
    clearTimeout(tempoToast);
    tempoToast = setTimeout(() => t.classList.remove('ver'), 3200);
  }

  // Roda uma ação com o botão em espera; erros viram aviso.
  async function acao(botao, nome, extra, mensagemOk) {
    if (ocupado) return false;
    ocupado = true;
    const texto = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Aguarde…';
    try {
      await pedir(nome, extra);
      desenhar();
      if (mensagemOk) avisar(mensagemOk);
      return true;
    } catch (e) {
      avisar(e.mensagem);
      return false;
    } finally {
      ocupado = false;
      if (document.body.contains(botao)) { botao.disabled = false; botao.textContent = texto; }
    }
  }

  const acharTarefa = (id) => dados.tarefas.find((t) => t.id === id);

  el('lista-adm').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.editar) return abrirTarefa(acharTarefa(b.dataset.editar));
    if (b.dataset.tirar) {
      const t = acharTarefa(b.dataset.tirar);
      if (t && confirm('Tirar ' + t.nome + ' de ' + t.tarefa + ' (' + dataCurta(t.data) + ')?')) {
        acao(b, 'adm_tirar_pessoa', { id: t.id }, 'Vaga liberada.');
      }
    }
    if (b.dataset.excluir) {
      const t = acharTarefa(b.dataset.excluir);
      if (t && confirm('Excluir a tarefa ' + t.tarefa + ' (' + dataCurta(t.data) + ')?' + (t.nome ? ' ' + t.nome + ' está nela.' : ''))) {
        acao(b, 'adm_excluir_tarefa', { id: t.id }, 'Tarefa excluída.');
      }
    }
  });

  // ---------- Seleção e ações em massa ----------

  el('lista-adm').addEventListener('change', (ev) => {
    const c = ev.target;
    if (c.dataset.sel) {
      if (c.checked) selecionadas.add(c.dataset.sel); else selecionadas.delete(c.dataset.sel);
    } else if (c.dataset.marcarSemana) {
      c.closest('.adm-semana').querySelectorAll('[data-sel]').forEach((x) => {
        if (c.checked) selecionadas.add(x.dataset.sel); else selecionadas.delete(x.dataset.sel);
      });
    } else {
      return;
    }
    atualizarSelecao();
  });

  el('massa-limpar').addEventListener('click', () => { selecionadas.clear(); atualizarSelecao(); });

  // Tenta a ação em massa; se o script da planilha ainda for da versão anterior
  // (não conhece a ação), faz uma por uma.
  async function emMassa(botao, acaoMassa, acaoUma, ids, mensagemOk) {
    if (ocupado || !ids.length) return;
    ocupado = true;
    botao.disabled = true;
    botao.textContent = 'Aguarde…';
    try {
      try {
        await pedir(acaoMassa, { ids: ids });
      } catch (e) {
        if (e.codigo !== 'acao_invalida') throw e;
        for (const id of ids) await pedir(acaoUma, { id: id });
      }
      selecionadas.clear();
      desenhar();
      avisar(mensagemOk);
    } catch (e) {
      avisar(e.mensagem);
    } finally {
      ocupado = false;
      botao.disabled = false;
      atualizarSelecao();
    }
  }

  el('massa-tirar').addEventListener('click', (ev) => {
    const ids = dados.tarefas.filter((t) => selecionadas.has(t.id) && t.nome).map((t) => t.id);
    if (!ids.length) return;
    if (!confirm('Tirar as pessoas de ' + (ids.length === 1 ? '1 tarefa' : ids.length + ' tarefas') + '? As tarefas continuam, com a vaga livre.')) return;
    emMassa(ev.currentTarget, 'adm_tirar_pessoas', 'adm_tirar_pessoa', ids, ids.length === 1 ? 'Vaga liberada.' : ids.length + ' vagas liberadas.');
  });

  el('massa-excluir').addEventListener('click', (ev) => {
    const marcadas = dados.tarefas.filter((t) => selecionadas.has(t.id));
    if (!marcadas.length) return;
    const comPessoa = marcadas.filter((t) => t.nome).length;
    const texto = 'Excluir ' + (marcadas.length === 1 ? '1 tarefa' : marcadas.length + ' tarefas') + '?' +
      (comPessoa ? ' ' + (comPessoa === 1 ? '1 delas tem' : comPessoa + ' delas têm') + ' alguém escalado.' : '') + ' Não dá para desfazer.';
    if (!confirm(texto)) return;
    emMassa(ev.currentTarget, 'adm_excluir_tarefas', 'adm_excluir_tarefa', marcadas.map((t) => t.id),
      marcadas.length === 1 ? 'Tarefa excluída.' : marcadas.length + ' tarefas excluídas.');
  });

  el('lista-pessoas').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.liberar && confirm('Desligar os aparelhos de ' + b.dataset.liberar + '? O próximo aparelho que usar esse nome fica com ele.')) {
      acao(b, 'adm_liberar_pessoa', { nome: b.dataset.liberar }, 'Aparelhos desligados.');
    }
    if (b.dataset.excluirPessoa && confirm('Excluir ' + b.dataset.excluirPessoa + ' da lista de nomes? As tarefas em que o nome está continuam com ele.')) {
      acao(b, 'adm_excluir_pessoa', { nome: b.dataset.excluirPessoa }, 'Nome excluído.');
    }
  });

  el('limpar-inscricoes').addEventListener('click', (ev) => {
    if (confirm('Tirar todo mundo de todas as tarefas? As tarefas continuam.')) {
      acao(ev.currentTarget, 'adm_limpar_inscricoes', {}, 'Todas as vagas estão livres.');
    }
  });
  el('apagar-tarefas').addEventListener('click', (ev) => {
    const n = dados.tarefas.length;
    const resposta = prompt('Isso apaga as ' + n + ' tarefas e quem estava nelas, sem volta. Para confirmar, digite APAGAR:');
    if (resposta === null) return;
    if (resposta.trim().toUpperCase() !== 'APAGAR') { avisar('Nada foi apagado.'); return; }
    acao(ev.currentTarget, 'adm_apagar_tarefas', {}, 'Todas as tarefas foram apagadas.');
  });

  // ---------- Criar e editar tarefa ----------

  function hojeTexto() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function abrirTarefa(t) {
    editandoId = t ? t.id : '';
    el('titulo-tarefa').textContent = t ? 'Editar tarefa' : 'Nova tarefa';
    el('t-data').value = t ? t.data : hojeTexto();
    el('t-hora').value = t ? t.hora : '';
    el('t-tipo').value = t ? t.tipo : 'culto';
    el('t-tarefa').value = t ? t.tarefa : '';
    el('t-detalhe').value = t ? t.detalhe : '';
    el('t-marca').value = t ? t.marca : '';
    el('t-nome').value = t ? t.nome : '';
    el('dica-hora').textContent = 'Sem horário, o prazo da tarefa é ' + (dados.horaPadrao || '09:00') + ' (usado nos lembretes).';
    el('erro-tarefa').textContent = '';
    dialogo.showModal();
  }
  el('nova-tarefa').addEventListener('click', () => abrirTarefa(null));

  el('form-tarefa').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erro = el('erro-tarefa');
    const tarefa = {
      id: editandoId,
      data: el('t-data').value,
      hora: el('t-hora').value,
      tipo: el('t-tipo').value,
      tarefa: el('t-tarefa').value.trim(),
      detalhe: el('t-detalhe').value.trim(),
      marca: el('t-marca').value.trim(),
      nome: el('t-nome').value.trim()
    };
    if (!tarefa.data) { erro.textContent = 'Escolha a data.'; return; }
    if (!tarefa.tarefa) { erro.textContent = 'Escreva o nome da tarefa.'; el('t-tarefa').focus(); return; }
    if (ocupado) return;
    // Erros aparecem dentro da janela: o aviso flutuante ficaria escondido atrás dela.
    const botao = el('salvar-tarefa');
    ocupado = true;
    botao.disabled = true;
    try {
      await pedir('adm_salvar_tarefa', { tarefa: tarefa });
      desenhar();
      dialogo.close();
      avisar(editandoId ? 'Tarefa salva.' : 'Tarefa criada.');
    } catch (e) {
      erro.textContent = e.mensagem;
    } finally {
      ocupado = false;
      botao.disabled = false;
    }
  });
  el('form-tarefa').addEventListener('input', () => { el('erro-tarefa').textContent = ''; });
  dialogo.addEventListener('click', (ev) => {
    if (ev.target === dialogo || ev.target.closest('[data-fechar]')) dialogo.close();
  });

  // ---------- Início ----------

  (async function iniciar() {
    if (!API) {
      el('carregando').textContent = 'Coloque o endereço da planilha no config.js para usar esta área.';
      return;
    }
    if (!sessao) return mostrar('entrar');
    try {
      await pedir('adm_dados');
      mostrar('painel');
      desenhar();
    } catch (e) {
      mostrar('entrar');
    }
  })();
})();
