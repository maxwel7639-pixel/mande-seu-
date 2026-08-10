'use strict';

/**
 * Regras puras de validação e normalização do lead.
 * Fica separado do handler pra poder ser testado sem subir servidor,
 * e é o mesmo código que roda em produção — teste e produção não divergem.
 */

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
];

const STATUS = ['new', 'contacted', 'preview_sent', 'activated', 'lost'];

/**
 * Aceita "@fulano", "fulano", "instagram.com/fulano/", "https://instagram.com/fulano?igsh=..."
 * e também nome completo, porque o campo aceita as duas coisas.
 * Devolve { value, isHandle }.
 */
function normalizeInstagram(raw) {
  if (typeof raw !== 'string') return { value: '', isHandle: false };
  let v = raw.trim();
  if (!v) return { value: '', isHandle: false };

  // tira o wrapper de URL, com ou sem protocolo/www, e a query string
  const url = v.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/i);
  if (url) v = url[1];

  v = v.replace(/^@+/, '').trim();

  // handle do Instagram: letras, números, ponto e underline, até 30 chars
  const isHandle = /^[A-Za-z0-9._]{1,30}$/.test(v) && !v.includes(' ');
  return { value: isHandle ? v.toLowerCase() : v, isHandle };
}

/**
 * Normaliza para E.164 preservando o código do país quando dá pra saber.
 * Sem "+" explícito assume Brasil, que é o público da página.
 * Devolve { value, ok, reason }.
 */
function normalizePhone(raw) {
  if (typeof raw !== 'string') return { value: '', ok: false, reason: 'missing' };

  const trimmed = raw.trim();
  if (!trimmed) return { value: '', ok: false, reason: 'missing' };

  const hadPlus = trimmed.startsWith('+');
  let d = trimmed.replace(/\D/g, '');
  if (!d) return { value: '', ok: false, reason: 'no_digits' };

  // 00 como prefixo internacional equivale a "+"
  let explicitCountry = hadPlus;
  if (!hadPlus && d.startsWith('00')) {
    d = d.slice(2);
    explicitCountry = true;
  }

  if (explicitCountry) {
    // já veio com país: só valida tamanho plausível de E.164
    if (d.length < 8 || d.length > 15) {
      return { value: '', ok: false, reason: 'length' };
    }
    return { value: '+' + d, ok: true, reason: '' };
  }

  // sem país explícito: trata como Brasil
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    return validateBR(d.slice(2));
  }
  return validateBR(d);
}

function validateBR(national) {
  // DDD (2) + 8 ou 9 dígitos
  if (national.length !== 10 && national.length !== 11) {
    return { value: '', ok: false, reason: 'length' };
  }
  const ddd = Number(national.slice(0, 2));
  if (ddd < 11 || ddd > 99) return { value: '', ok: false, reason: 'ddd' };

  // celular de 11 dígitos precisa do 9 na frente do número
  if (national.length === 11 && national[2] !== '9') {
    return { value: '', ok: false, reason: 'mobile_prefix' };
  }
  return { value: '+55' + national, ok: true, reason: '' };
}

/** Só as chaves conhecidas, como string curta — nada do que o cliente mandar além disso entra. */
function pickUtms(source) {
  const out = {};
  const src = source && typeof source === 'object' ? source : {};
  for (const k of UTM_KEYS) {
    const v = src[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 255);
  }
  return out;
}

/**
 * Valida o corpo inteiro. Devolve { ok, errors, lead }.
 * lead já sai no formato das colunas da tabela funil_leads.
 */
function buildLead(body) {
  const errors = {};
  const b = body && typeof body === 'object' ? body : {};

  const ig = normalizeInstagram(b.instagram);
  if (!ig.value) {
    errors.instagram = 'Informe seu @ do Instagram ou seu nome.';
  } else if (ig.value.length < 2) {
    errors.instagram = 'Informe seu @ do Instagram ou seu nome.';
  } else if (ig.value.length > 100) {
    errors.instagram = 'Nome muito longo.';
  }

  const phone = normalizePhone(b.whatsapp);
  if (!phone.ok) {
    errors.whatsapp =
      phone.reason === 'missing'
        ? 'Informe seu WhatsApp com DDD.'
        : 'WhatsApp inválido. Confira o DDD e o número.';
  }

  if (Object.keys(errors).length) return { ok: false, errors, lead: null };

  return {
    ok: true,
    errors: {},
    lead: Object.assign(
      {
        instagram_handle: ig.value,
        whatsapp: phone.value,
        status: 'new',
      },
      pickUtms(b.utm)
    ),
  };
}

module.exports = {
  UTM_KEYS,
  STATUS,
  normalizeInstagram,
  normalizePhone,
  pickUtms,
  buildLead,
};
