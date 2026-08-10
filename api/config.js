'use strict';

/**
 * GET /api/config — configuração PÚBLICA lida de variável de ambiente.
 *
 * Existe porque o site é estático e não tem etapa de build pra injetar valor
 * nenhum no HTML. Assim o ID do Pixel fica fora do repositório e pode mudar
 * por ambiente sem tocar no código.
 *
 * Só entra aqui o que pode ser público. Token, segredo e service role NUNCA:
 * o ID do Pixel já é visível pra qualquer um que abra o site, uma access
 * token da Conversions API não é.
 */

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // 5 min no CDN: muda raramente e evita uma ida ao servidor a cada visita
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');

  return res.status(200).json({
    metaPixelId: process.env.META_PIXEL_ID || null,
    whatsappNumber: process.env.WHATSAPP_NUMBER || '5551991580526',
  });
};
