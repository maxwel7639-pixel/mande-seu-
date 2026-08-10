# LP "Manda seu @" — MX Digital

Landing page de captação para psicólogos e terapeutas. O lead deixa o `@` do Instagram
e o WhatsApp, e o formulário abre uma conversa no WhatsApp da MX Digital já com os
dados preenchidos.

Implementação do arquivo `LP Manda seu @.html` do projeto Claude Design.

## Estrutura

```
index.html               a landing page inteira (HTML + CSS + JS inline, sem build)
assets/logo-mx.png       logo da MX Digital (header + favicon + og:image)
sites-imagens/           miniaturas da vitrine de sites entregues
  gabriela.webp
  solange.webp
  cristiana.webp
```

Site 100% estático, sem dependências e sem etapa de build. As únicas requisições
externas são as fontes do Google Fonts (Cormorant Garamond, Inter, JetBrains Mono).

## Deploy na Vercel

Framework: **Other**. Build Command e Output Directory **vazios**.
O `index.html` está na **raiz** do repositório, então o Root Directory fica no padrão
(não precisa apontar para subpasta — aquele 404 clássico não acontece aqui).

## Imagens da vitrine

Os três arquivos em `sites-imagens/` são prints reais dos sites entregues, todos em
WebP com 806 px de largura (2× o tamanho em que o card aparece, para ficar nítido em
tela retina). Juntos somam cerca de 63 KB.

Para trocar ou acrescentar um print: os cards recortam com `object-fit: cover` a
partir do topo, então print de página inteira também funciona — o que aparece no card
é a faixa de cima. Mantendo o mesmo nome de arquivo, não precisa mexer no HTML.

## Ajustes feitos em cima do design

O HTML é fiel ao design. Além dele, foram incluídos:

- `<meta name="description">`, Open Graph e Twitter Card — para o link ter preview
  decente ao ser compartilhado no WhatsApp e no Instagram;
- favicon e apple-touch-icon apontando para o logo;
- `scroll-margin-top` nas seções, para o link "Saiba mais" não parar embaixo do
  header fixo;
- `width`/`height` nas imagens, evitando o pulo de layout enquanto carregam;
- `@media (prefers-reduced-motion: reduce)`, desligando scroll suave e transições
  para quem configurou isso no sistema;
- a mensagem do WhatsApp agora é codificada inteira com `encodeURIComponent`. O texto
  que chega é exatamente o mesmo, mas sem espaços e acentos crus na URL, que alguns
  navegadores embutidos (Instagram, Facebook) tratam mal.

## Número de destino

O formulário aponta para `wa.me/5551991580526`. Para trocar, é o único lugar no
`index.html` — no `<script>` no fim do arquivo.
