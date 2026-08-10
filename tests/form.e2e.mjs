/**
 * Teste de ponta a ponta do formulário, num navegador de verdade.
 *
 *   npm run test:e2e
 *
 * Sobe um servidor estático local, serve o index.html e intercepta
 * /api/lead e /api/config para simular as respostas do backend.
 * Requer Playwright: npm i -D playwright  (ou PLAYWRIGHT_CHROMIUM=/caminho/chrome)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const TIPOS = { '.html': 'text/html', '.png': 'image/png', '.webp': 'image/webp', '.js': 'text/javascript' };

let playwright;
try {
  playwright = await import('playwright');
} catch {
  console.error('Playwright não instalado. Rode: npm i -D playwright');
  process.exit(1);
}

const servidor = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const arquivo = path.join(raiz, url === '/' ? 'index.html' : url);
  if (!arquivo.startsWith(path.resolve(raiz)) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404).end('nao encontrado');
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});
await new Promise((r) => servidor.listen(0, r));
const BASE = `http://127.0.0.1:${servidor.address().port}`;

const casos = [];
const teste = (nome, fn) => casos.push({ nome, fn });
const eq = (a, b, m) => {
  if (a !== b) throw new Error(`${m || ''}\n  esperado: ${JSON.stringify(b)}\n  recebido: ${JSON.stringify(a)}`);
};

const exe = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const navegador = await playwright.chromium.launch(
  fs.existsSync(exe) ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] }
);

/** Abre a página com /api/lead mockado. Devolve { pg, chamadas } */
async function abrir({ resposta = { status: 201, body: { ok: true, stored: true } }, atraso = 0, query = '' } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const chamadas = [];
  await pg.route('**/api/config', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ metaPixelId: null, whatsappNumber: '5551991580526' }) })
  );
  await pg.route('**/api/lead', async (r) => {
    chamadas.push({ metodo: r.request().method(), corpo: JSON.parse(r.request().postData() || '{}') });
    if (atraso) await new Promise((x) => setTimeout(x, atraso));
    await r.fulfill({ status: resposta.status, contentType: 'application/json', body: JSON.stringify(resposta.body) });
  });
  await pg.goto(BASE + '/' + query, { waitUntil: 'load' });
  await pg.waitForTimeout(250);
  return { pg, chamadas, ctx };
}

teste('envia por POST, com JSON, e nunca por GET', async () => {
  const { pg, chamadas, ctx } = await abrir();
  await pg.fill('#ig', '@mxdigital.ia');
  await pg.fill('#wa', '(51) 98888-7777');
  await pg.click('#submit');
  await pg.waitForTimeout(400);
  eq(chamadas.length, 1, 'deveria ter feito 1 chamada');
  eq(chamadas[0].metodo, 'POST', 'método deve ser POST');
  eq(chamadas[0].corpo.instagram, '@mxdigital.ia');
  eq(chamadas[0].corpo.whatsapp, '(51) 98888-7777');
  await ctx.close();
});

teste('dado pessoal não aparece na URL nem no histórico', async () => {
  const { pg, ctx } = await abrir();
  await pg.fill('#ig', '@mxdigital.ia');
  await pg.fill('#wa', '(51) 98888-7777');
  await pg.click('#submit');
  await pg.waitForTimeout(400);
  const url = pg.url();
  if (url.includes('98888') || url.toLowerCase().includes('mxdigital')) {
    throw new Error('dado pessoal vazou para a URL: ' + url);
  }
  const wa = await pg.getAttribute('#wa-open', 'href');
  if (wa.includes('98888') || wa.toLowerCase().includes('mxdigital')) {
    throw new Error('dado pessoal vazou para o link do WhatsApp: ' + wa);
  }
  await ctx.close();
});

teste('sucesso mostra a mensagem combinada e o botão do WhatsApp', async () => {
  const { pg, ctx } = await abrir();
  await pg.fill('#ig', '@fulano');
  await pg.fill('#wa', '51991580526');
  await pg.click('#submit');
  await pg.waitForSelector('#ok:not([hidden])', { timeout: 3000 });
  const txt = await pg.innerText('.ok-msg');
  eq(
    txt.trim(),
    'Recebido. Vamos analisar seu perfil e chamar você no WhatsApp com a prévia ainda hoje.'
  );
  eq(await pg.isVisible('#wa-open'), true, 'botão do WhatsApp deve aparecer');
  eq(await pg.isVisible('.fields'), false, 'campos devem sumir após sucesso');
  await ctx.close();
});

teste('erro de validação do servidor volta no campo certo', async () => {
  const { pg, ctx } = await abrir({
    resposta: { status: 422, body: { ok: false, error: 'validation', errors: { whatsapp: 'WhatsApp inválido. Confira o DDD e o número.' } } },
  });
  await pg.fill('#ig', '@fulano');
  await pg.fill('#wa', '123');
  await pg.click('#submit');
  await pg.waitForSelector('#wa-err:not([hidden])', { timeout: 3000 });
  eq(await pg.getAttribute('#wa', 'aria-invalid'), 'true', 'campo deve ficar aria-invalid');
  eq(await pg.isVisible('#ok'), false, 'não pode mostrar sucesso');
  eq(await pg.isDisabled('#submit'), false, 'botão deve voltar a funcionar');
  await ctx.close();
});

teste('erro de rede mostra recado e mantém o WhatsApp como saída', async () => {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await pg.route('**/api/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**/api/lead', (r) => r.abort());
  await pg.goto(BASE + '/', { waitUntil: 'load' });
  await pg.fill('#ig', '@fulano');
  await pg.fill('#wa', '51991580526');
  await pg.click('#submit');
  await pg.waitForSelector('#form-err:not([hidden])', { timeout: 3000 });
  eq(await pg.isDisabled('#submit'), false, 'botão deve destravar para tentar de novo');
  await ctx.close();
});

teste('duplo clique não gera dois leads', async () => {
  const { pg, chamadas, ctx } = await abrir({ atraso: 600 });
  await pg.fill('#ig', '@fulano');
  await pg.fill('#wa', '51991580526');
  await pg.click('#submit');
  eq(await pg.isDisabled('#submit'), true, 'botão deve travar durante o envio');
  await pg.click('#submit', { force: true }).catch(() => {});
  await pg.click('#submit', { force: true }).catch(() => {});
  await pg.waitForTimeout(1200);
  eq(chamadas.length, 1, 'deveria existir só 1 chamada');
  await ctx.close();
});

teste('UTMs da URL vão junto no POST', async () => {
  const q = '?utm_source=meta&utm_medium=cpc&utm_campaign=lp-agosto&utm_content=v2&utm_term=site&fbclid=IwAR9';
  const { pg, chamadas, ctx } = await abrir({ query: q });
  await pg.fill('#ig', '@fulano');
  await pg.fill('#wa', '51991580526');
  await pg.click('#submit');
  await pg.waitForTimeout(400);
  const utm = chamadas[0].corpo.utm;
  eq(utm.utm_source, 'meta');
  eq(utm.utm_medium, 'cpc');
  eq(utm.utm_campaign, 'lp-agosto');
  eq(utm.utm_content, 'v2');
  eq(utm.utm_term, 'site');
  eq(utm.fbclid, 'IwAR9');
  await ctx.close();
});

teste('UTM sobrevive à navegação interna e não volta pra URL', async () => {
  const { pg, chamadas, ctx } = await abrir({ query: '?utm_source=meta&utm_campaign=lp-agosto' });
  await pg.click('.js-cta');            // CTA do topo, que limpa a query
  await pg.waitForTimeout(600);
  if (pg.url().includes('utm_source')) throw new Error('UTM ficou na URL depois do CTA');
  await pg.fill('#ig', '@fulano');
  await pg.fill('#wa', '51991580526');
  await pg.click('#submit');
  await pg.waitForTimeout(400);
  eq(chamadas[0].corpo.utm.utm_source, 'meta', 'UTM deveria ter sido preservada');
  eq(chamadas[0].corpo.utm.utm_campaign, 'lp-agosto');
  await ctx.close();
});

teste('stored:false não dispara o evento Lead', async () => {
  const { pg, ctx } = await abrir({ resposta: { status: 200, body: { ok: true, stored: false, reason: 'storage_not_configured' } } });
  await pg.evaluate(() => { window.__ev = []; window.dataLayer = { push: (o) => window.__ev.push(o.event) }; });
  await pg.fill('#ig', '@fulano');
  await pg.fill('#wa', '51991580526');
  await pg.click('#submit');
  await pg.waitForSelector('#ok:not([hidden])', { timeout: 3000 });
  const evs = await pg.evaluate(() => window.__ev);
  if (evs.includes('Lead')) throw new Error('Lead não pode disparar quando o backend não gravou');
  await ctx.close();
});

teste('campo vazio é barrado no cliente, sem bater no servidor', async () => {
  const { pg, chamadas, ctx } = await abrir();
  await pg.click('#submit');
  await pg.waitForTimeout(300);
  eq(chamadas.length, 0, 'não deveria chamar a API com campo vazio');
  eq(await pg.isVisible('#ig-err'), true);
  await ctx.close();
});

let falhas = 0;
for (const c of casos) {
  try {
    await c.fn();
    console.log('  ok   ' + c.nome);
  } catch (err) {
    falhas++;
    console.error('  FALHA ' + c.nome + '\n    ' + String(err.message).replace(/\n/g, '\n    '));
  }
}
await navegador.close();
servidor.close();
console.log(`\n${casos.length - falhas}/${casos.length} passaram`);
process.exit(falhas ? 1 : 0);
