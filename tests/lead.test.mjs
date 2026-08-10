import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeInstagram, normalizePhone, pickUtms, buildLead } = require('../api/_lib/lead.js');

test('instagram: tira @, URL e query string', () => {
  assert.equal(normalizeInstagram('@gabriela.kanaan').value, 'gabriela.kanaan');
  assert.equal(normalizeInstagram('  @@Fulano_1 ').value, 'fulano_1');
  assert.equal(normalizeInstagram('instagram.com/mxdigital.ia/').value, 'mxdigital.ia');
  assert.equal(
    normalizeInstagram('https://www.instagram.com/mxdigital.ia?igsh=abc123').value,
    'mxdigital.ia'
  );
});

test('instagram: nome completo passa como texto, sem virar handle', () => {
  const r = normalizeInstagram('Maria Eduarda Menezes');
  assert.equal(r.isHandle, false);
  assert.equal(r.value, 'Maria Eduarda Menezes'); // preserva maiúsculas do nome
});

test('telefone: BR sem país ganha +55', () => {
  assert.equal(normalizePhone('(51) 99158-0526').value, '+5551991580526');
  assert.equal(normalizePhone('51991580526').value, '+5551991580526');
  assert.equal(normalizePhone('5551991580526').value, '+5551991580526');
  assert.equal(normalizePhone('51 3714-0000').value, '+555137140000'); // fixo, 10 dígitos
});

test('telefone: código de país explícito é preservado', () => {
  assert.equal(normalizePhone('+351 912 345 678').value, '+351912345678');
  assert.equal(normalizePhone('+1 (415) 555-0132').value, '+14155550132');
  assert.equal(normalizePhone('00351912345678').value, '+351912345678');
});

test('telefone: rejeita inválidos', () => {
  for (const bad of ['', '   ', 'abc', '12345', '019991580526']) {
    assert.equal(normalizePhone(bad).ok, false, `deveria rejeitar: ${JSON.stringify(bad)}`);
  }
  // 11 dígitos sem o 9 de celular
  assert.equal(normalizePhone('51811580526').ok, false);
  // DDD fora da faixa
  assert.equal(normalizePhone('09991580526').ok, false);
});

test('telefone: leniente com sujeira em volta dos dígitos (é de propósito)', () => {
  // gente cola "(51) 99158-0526 (WhatsApp)" o tempo todo; rejeitar isso custa lead.
  // só os dígitos importam, o resto é descartado.
  assert.equal(normalizePhone('(51) 99158-0526 (WhatsApp)').value, '+5551991580526');
  assert.equal(normalizePhone('meu zap: 51 99158 0526').value, '+5551991580526');
});

test('utm: só as chaves conhecidas entram, e truncadas', () => {
  const out = pickUtms({
    utm_source: 'meta',
    utm_medium: 'cpc',
    utm_campaign: 'lp-manda-seu-arroba',
    fbclid: 'IwAR123',
    lixo: 'nao deve entrar',
    utm_term: '  ',
    utm_content: 'x'.repeat(400),
  });
  assert.deepEqual(Object.keys(out).sort(), [
    'fbclid',
    'utm_campaign',
    'utm_content',
    'utm_medium',
    'utm_source',
  ]);
  assert.equal(out.utm_content.length, 255);
  assert.equal(out.lixo, undefined);
  assert.equal(out.utm_term, undefined, 'string em branco não vira coluna');
});

test('buildLead: sucesso monta a linha da tabela com status new', () => {
  const r = buildLead({
    instagram: '@mxdigital.ia',
    whatsapp: '(51) 99158-0526',
    utm: { utm_source: 'meta', fbclid: 'abc' },
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.lead, {
    instagram_handle: 'mxdigital.ia',
    whatsapp: '+5551991580526',
    status: 'new',
    utm_source: 'meta',
    fbclid: 'abc',
  });
});

test('buildLead: campos obrigatórios são validados no servidor', () => {
  const vazio = buildLead({});
  assert.equal(vazio.ok, false);
  assert.ok(vazio.errors.instagram);
  assert.ok(vazio.errors.whatsapp);
  assert.equal(vazio.lead, null);

  const soIg = buildLead({ instagram: '@fulano' });
  assert.equal(soIg.ok, false);
  assert.ok(soIg.errors.whatsapp);
  assert.equal(soIg.errors.instagram, undefined);

  const telRuim = buildLead({ instagram: '@fulano', whatsapp: '123' });
  assert.equal(telRuim.ok, false);
  assert.match(telRuim.errors.whatsapp, /inválido/i);
});

test('buildLead: corpo não-objeto não derruba o handler', () => {
  for (const b of [null, undefined, 'string', 42, []]) {
    assert.equal(buildLead(b).ok, false);
  }
});

test('buildLead: o telefone gravado bate com o CHECK de E.164 da migração', () => {
  const re = /^\+[1-9][0-9]{7,14}$/;
  for (const t of ['(51) 99158-0526', '+351912345678', '5551991580526']) {
    const r = buildLead({ instagram: '@mxdigital.ia', whatsapp: t });
    assert.equal(r.ok, true);
    assert.match(r.lead.whatsapp, re);
  }
});
