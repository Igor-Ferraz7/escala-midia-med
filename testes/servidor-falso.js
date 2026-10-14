// Servidor de teste: roda o Codigo.gs de verdade sobre uma planilha de mentira e serve a página.
// Uso (na pasta do projeto): node testes/servidor-falso.js   → http://localhost:8767
// localhost:8767 e 127.0.0.1:8767 são origens diferentes, então funcionam como dois aparelhos.
// Senha da área do responsável neste servidor: senha-de-teste-123 (só existe aqui).
// Os pushes saem de verdade (curl), para conferir se o serviço do navegador aceita a assinatura.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { criarAmbiente } = require('./ambiente-gs');

const PROJETO = path.join(__dirname, '..');
const amb = criarAmbiente(path.join(PROJETO, 'apps-script', 'Codigo.gs'), { push: 'curl' });
amb.props.SENHA_ADMIN = 'senha-de-teste-123';
amb.ctx.configurarLembretes();

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (obj) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(typeof obj === 'string' ? obj : JSON.stringify(obj));
  };
  if (url.pathname === '/api') {
    let corpo = '';
    req.on('data', (c) => (corpo += c));
    req.on('end', () => {
      try {
        json(req.method === 'POST'
          ? amb.ctx.doPost({ postData: { contents: corpo } })
          : amb.ctx.doGet({ parameter: Object.fromEntries(url.searchParams) }));
      } catch (e) {
        console.error(e);
        res.writeHead(500); res.end(String(e));
      }
    });
    return;
  }
  // Ferramentas de teste
  if (url.pathname === '/_abas') return json(Object.fromEntries(Object.entries(amb.abas).map(([k, v]) => [k, v.dados])));
  if (url.pathname === '/_envios') return json(amb.envios);
  if (url.pathname === '/_disparar') {
    amb.props.LEMBRETES_ULTIMA = String(Number(url.searchParams.get('desde')) || Date.now() - 5 * 60000);
    amb.ctx.enviarLembretes();
    return json({ envios: amb.envios.length });
  }
  if (url.pathname === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
    return res.end("window.ESCALA_CONFIG = { urlPlanilha: '/api' };");
  }
  const arquivo = path.join(PROJETO, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!arquivo.startsWith(path.normalize(PROJETO))) { res.writeHead(403); return res.end(); }
  fs.readFile(arquivo, (erro, dados) => {
    if (erro) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
}).listen(8767, () => console.log('servidor de teste em http://localhost:8767'));
