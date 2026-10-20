// Ambiente de mentira do Google Apps Script para rodar o Codigo.gs no Node.
// Imita a planilha, as propriedades do script, o cache, os gatilhos e as funções de Utilities.
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const comSinal = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
const semSinal = (arr) => Buffer.from(arr.map((b) => (b + 256) % 256));
const paraBuffer = (v) => (typeof v === 'string' ? Buffer.from(v, 'utf8') : semSinal(v));

function deslocamento(tz, ms) {
  const nome = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName').value; // "GMT-03:00"
  const m = nome.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

function formatar(data, tz, padrao) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23'
  }).formatToParts(data).map((p) => [p.type, p.value]));
  const u = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[partes.weekday];
  return padrao.replace('yyyy', partes.year).replace('MM', partes.month).replace('dd', partes.day)
    .replace('HH', partes.hour).replace('mm', partes.minute).replace('u', String(u));
}

function criarAba() {
  const dados = [];
  const norm = (v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v);
  return {
    dados,
    getDataRange: () => {
      const w = Math.max(1, ...dados.map((l) => l.length));
      const linhas = dados.length ? dados : [[]];
      return { getValues: () => linhas.map((l) => Array.from({ length: w }, (_, i) => (l[i] === undefined ? '' : l[i]))) };
    },
    getLastRow: () => dados.length,
    getMaxRows: () => 1000,
    getRange: (a, b, c, d) => {
      if (typeof a === 'string') return { setNumberFormat() {} };
      const nl = c || 1, nc = d || 1;
      return {
        setValues(v) { for (let i = 0; i < nl; i++) { dados[a - 1 + i] = dados[a - 1 + i] || []; for (let j = 0; j < nc; j++) dados[a - 1 + i][b - 1 + j] = norm(v[i][j]); } return this; },
        setValue(v) { dados[a - 1] = dados[a - 1] || []; dados[a - 1][b - 1] = norm(v); return this; },
        clearContent() { for (let i = 0; i < nl; i++) for (let j = 0; j < nc; j++) if (dados[a - 1 + i]) dados[a - 1 + i][b - 1 + j] = ''; return this; },
        setFontWeight() { return this; },
        setNumberFormat() { return this; }
      };
    },
    appendRow(l) { dados.push(l.map(norm)); },
    deleteRow(n) { dados.splice(n - 1, 1); },
    deleteRows(n, q) { dados.splice(n - 1, q); },
    setFrozenRows() {}, autoResizeColumns() {}, hideColumns() {}
  };
}

// opcoes.push: 'curl' faz o envio de verdade (síncrono, como o UrlFetchApp); um número devolve esse código.
function criarAmbiente(caminho, opcoes = {}) {
  const abas = {};
  const props = {};
  const cache = {};
  const gatilhos = [];
  const envios = [];
  const TZ = 'America/Sao_Paulo';

  const ctx = {
    console,
    SpreadsheetApp: {
      getActive: () => ({
        getSheetByName: (n) => abas[n] || null,
        insertSheet: (n) => (abas[n] = criarAba()),
        getSpreadsheetTimeZone: () => TZ
      })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
    ContentService: { createTextOutput: (t) => ({ setMimeType() { return t; } }), MimeType: { JSON: 'json' } },
    Session: { getScriptTimeZone: () => TZ },
    Logger: { log: (m) => opcoes.silencioso || console.log('[Logger]', m) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = String(v); },
        deleteProperty: (k) => { delete props[k]; }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache[k] && cache[k].ate > Date.now() ? cache[k].v : null),
        put: (k, v, s) => { cache[k] = { v: String(v), ate: Date.now() + (s || 600) * 1000 }; },
        remove: (k) => { delete cache[k]; }
      })
    },
    ScriptApp: {
      getProjectTriggers: () => gatilhos.map((g) => ({ getHandlerFunction: () => g })),
      newTrigger: (fn) => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => gatilhos.push(fn) }) }) })
    },
    UrlFetchApp: {
      fetch: (url, o) => {
        envios.push({ url, headers: o.headers });
        if (opcoes.push === 'curl') {
          const args = ['-s', '-o', '-', '-w', '\n%{http_code}', '-X', 'POST', '-H', 'Content-Length: 0'];
          Object.entries(o.headers).forEach(([k, v]) => args.push('-H', k + ': ' + v));
          args.push(url);
          const saida = execFileSync('curl', args, { encoding: 'utf8' });
          const codigo = Number(saida.trim().split('\n').pop());
          envios[envios.length - 1].resposta = saida;
          return { getResponseCode: () => codigo };
        }
        const codigo = typeof opcoes.push === 'function' ? opcoes.push(url) : (opcoes.push || 201);
        return { getResponseCode: () => codigo };
      }
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, v) => comSinal(crypto.createHash('sha256').update(paraBuffer(v)).digest()),
      computeHmacSha256Signature: (v, k) => comSinal(crypto.createHmac('sha256', paraBuffer(k)).update(paraBuffer(v)).digest()),
      base64EncodeWebSafe: (v) => paraBuffer(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      newBlob: (s) => ({ getBytes: () => comSinal(Buffer.from(s, 'utf8')) }),
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, tz, p) => formatar(d, tz, p),
      parseDate: (s, tz) => {
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
        if (!m) throw new Error('data inválida: ' + s);
        const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
        return new Date(utc - deslocamento(tz, utc) * 60000);
      }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(caminho, 'utf8'), ctx);
  ctx.configurar();
  return { ctx, abas, props, cache, gatilhos, envios, TZ, formatar };
}

module.exports = { criarAmbiente };
