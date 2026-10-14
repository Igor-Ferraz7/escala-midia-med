// Teste de ponta a ponta dos lembretes: abre um Chrome separado (perfil temporário, sem janela),
// libera notificações para o site de teste, ativa os lembretes pela própria página e confere
// se o serviço de push aceita o envio e se a notificação aparece.
// Uso: com "node testes/servidor-falso.js" rodando, execute "node testes/teste-push-chrome.js".
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PERFIL = path.join(os.tmpdir(), 'escala-perfil-chrome-teste');
const PORTA = 9333;
const SITE = 'http://localhost:8767';

fs.rmSync(PERFIL, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  '--user-data-dir=' + PERFIL, '--remote-debugging-port=' + PORTA, '--no-first-run', '--no-default-browser-check',
  '--headless=new', 'about:blank'
], { stdio: 'ignore' });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function conectar(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pendentes = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pendentes[d.id]) { pendentes[d.id](d); delete pendentes[d.id]; } };
  return {
    enviar: (method, params = {}, sessionId) => new Promise((r) => { const n = ++id; pendentes[n] = r; ws.send(JSON.stringify({ id: n, method, params, sessionId })); }),
    fechar: () => ws.close()
  };
}

(async () => {
  let versao;
  for (let i = 0; i < 40 && !versao; i++) {
    try { versao = await (await fetch('http://127.0.0.1:' + PORTA + '/json/version')).json(); } catch (e) { await espera(250); }
  }
  const cdp = await conectar(versao.webSocketDebuggerUrl);
  await cdp.enviar('Browser.grantPermissions', { origin: SITE, permissions: ['notifications'] });
  const { result: { targetId } } = await cdp.enviar('Target.createTarget', { url: SITE + '/' });
  const { result: { sessionId } } = await cdp.enviar('Target.attachToTarget', { targetId, flatten: true });
  const avaliar = async (expr) => {
    const r = await cdp.enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
    return r.result.exceptionDetails ? { erro: r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description } : r.result.result.value;
  };
  await espera(2500);

  console.log('página:', await avaliar(`({ linhas: document.querySelectorAll('.linha').length, permissao: Notification.permission, vapid: !!(Escala.ultimo && Escala.ultimo.vapid) })`));

  console.log('ativar:', await avaliar(`(async () => {
    const n = document.getElementById('nome'); n.value = 'Teste Push'; n.dispatchEvent(new Event('input'));
    document.querySelector('button[data-acao="escalar"]:not([disabled])').click();
    await new Promise(r => setTimeout(r, 800));
    document.getElementById('abrir-lembretes').click();
    document.getElementById('lembretes-salvar').click();
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 250));
      const ok = document.getElementById('lembretes-ok').textContent, erro = document.getElementById('lembretes-erro').textContent;
      if (ok || erro) return { ok, erro };
    }
    return 'sem resposta';
  })()`));

  console.log('teste:', await avaliar(`(async () => {
    document.getElementById('lembretes-testar').click();
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 250));
      const ok = document.getElementById('lembretes-ok').textContent, erro = document.getElementById('lembretes-erro').textContent;
      if (ok.startsWith('Teste') || erro) return { ok, erro };
    }
    return 'sem resposta';
  })()`));

  const envios = await (await fetch(SITE + '/_envios')).json();
  const ultimo = envios[envios.length - 1];
  console.log('resposta do serviço de push (201 = aceito):', ultimo && JSON.stringify(ultimo.resposta));

  let notificacoes = [];
  for (let i = 0; i < 30 && !notificacoes.length; i++) {
    await espera(1000);
    notificacoes = await avaliar(`navigator.serviceWorker.ready.then(r => r.getNotifications()).then(l => l.map(n => ({ titulo: n.title, corpo: n.body })))`);
  }
  console.log('notificações mostradas:', JSON.stringify(notificacoes));

  cdp.fechar();
  chrome.kill();
  await espera(800);
  try { fs.rmSync(PERFIL, { recursive: true, force: true }); } catch (e) { /* o Chrome ainda soltando arquivos */ }
  process.exit(notificacoes.length ? 0 : 1);
})().catch((e) => { console.error('ERRO', e); chrome.kill(); process.exit(1); });
