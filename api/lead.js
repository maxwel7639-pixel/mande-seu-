'use strict';

const { buildLead } = require('./_lib/lead.js');

/**
 * POST /api/lead — recebe o lead do formulário e grava no Supabase.
 *
 * Roda como Serverless Function da Vercel. A service role fica em variável
 * de ambiente e NUNCA sai daqui: o browser só fala com este endpoint, no
 * mesmo domínio, e nunca com o Supabase direto.
 *
 * Privacidade: @ e telefone não vão para log em nenhum caminho, nem no de
 * erro. O que se registra é status, motivo e UTM, que não identificam pessoa.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABLE = 'funil_leads';

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    const tooLarge = err && err.message === 'payload_too_large';
    return res
      .status(tooLarge ? 413 : 400)
      .json({ ok: false, error: tooLarge ? 'payload_too_large' : 'invalid_json' });
  }

  const { ok, errors, lead } = buildLead(body);
  if (!ok) {
    // erro de validação: não loga nada, o conteúdo é dado pessoal
    return res.status(422).json({ ok: false, error: 'validation', errors });
  }

  // Sem credencial configurada o lead não é gravado, mas o usuário NÃO fica
  // travado: a página segue oferecendo o WhatsApp, que é o fluxo que já
  // funcionava antes. stored:false faz o frontend não disparar o evento Lead.
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.warn('[lead] storage nao configurado: definir SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
    return res.status(200).json({ ok: true, stored: false, reason: 'storage_not_configured' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(lead),
    });

    if (!r.ok) {
      // status e código do PostgREST não carregam dado pessoal
      let code = '';
      try {
        code = (await r.json()).code || '';
      } catch (_) {}
      console.error('[lead] insert falhou', { status: r.status, code });
      return res.status(200).json({ ok: true, stored: false, reason: 'storage_error' });
    }

    console.info('[lead] gravado', { utm_source: lead.utm_source || null });
    return res.status(201).json({ ok: true, stored: true });
  } catch (err) {
    console.error('[lead] erro de rede no insert', { name: err && err.name });
    return res.status(200).json({ ok: true, stored: false, reason: 'storage_error' });
  }
};
