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

## Efeitos e interações

Tudo em CSS + JS puro, sem biblioteca. Todos desligam sozinhos em
`prefers-reduced-motion: reduce`.

- **Sticky stack no mobile** (até 759px) — os 4 cards de "Como funciona" e os 3 da
  vitrine grudam no topo em degraus de 12px e vão se empilhando conforme você rola.
  Dois detalhes que fazem isso funcionar e que é bom não desfazer sem querer:
  - `body` usa `overflow-x: clip`, não `hidden`. `hidden` transforma o body em
    container de rolagem e o `position: sticky` para de funcionar.
  - o `.grid` tem uma linha-fantasma (`grid-template-rows: repeat(4,1fr) 150px` +
    `:after`). O retângulo que limita o sticky é o *content box* do grid, então
    `padding-bottom` não estenderia o alcance — a linha extra estende. Sem ela os
    4 cards ficam empilhados por 0px de rolagem em vez de 170px.
  - `grid-auto-rows`/`1fr` iguala a altura dos cards. Com alturas diferentes o card
    de trás aparece por baixo do da frente e a pilha fica suja.
- **Tilt 3D** — cards giram até 6°/8° seguindo o cursor, com um brilho que acompanha.
  Só liga em `(hover:hover) and (pointer:fine)`, ou seja, nunca em touch.
- **Reveal no scroll** — IntersectionObserver com stagger (`.rv`, `.d1`–`.d3`).
- **Barra de progresso** no topo e **parallax** no brilho do hero, ambos num único
  listener de scroll com `requestAnimationFrame` e `passive: true`.
- **FAQ acordeão** — um aberto por vez, `aria-expanded` no botão e `inert` nos
  painéis fechados (para o leitor de tela e o Tab pularem o conteúdo escondido).
  A altura anima com `grid-template-rows: 0fr → 1fr`, sem medir nada em JS.

## Número de destino

O formulário aponta para `wa.me/5551991580526`. Para trocar, é o único lugar no
`index.html` — no `<script>` no fim do arquivo.
