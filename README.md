# LP "Manda seu @" — MX Digital

Landing page de captação. O lead deixa o `@` do Instagram e o WhatsApp, o lead é
gravado no Supabase por um endpoint server-side, e a MX responde no WhatsApp com
a prévia do site.

Implementação do arquivo `LP Manda seu @.html` do projeto Claude Design.

## Estrutura

```
index.html                          a landing page (HTML + CSS + JS inline, sem build)
privacidade.html                    política de privacidade e tratamento de dados
assets/logo-mx.png                  logo (header, favicon, og:image)
sites-imagens/                      prints da vitrine (gabriela, solange, cristiana)
api/lead.js                         POST /api/lead — grava o lead no Supabase
api/config.js                       GET /api/config — config pública (Pixel, WhatsApp)
api/_lib/lead.js                    validação e normalização (puro, testável)
supabase/migrations/0001_...sql     tabela funil_leads + RLS
tests/lead.test.mjs                 testes unitários (node:test, sem dependência)
tests/form.e2e.mjs                  teste de ponta a ponta no navegador (Playwright)
```

Site estático. **Não existe etapa de build** — o `index.html` é servido direto e
os arquivos em `api/` viram Serverless Functions da Vercel automaticamente.

## Rodar localmente

```bash
npm test              # unitários — não precisa instalar nada
npm i -D playwright   # só para o e2e
npm run test:e2e      # sobe servidor local, mocka /api/lead e testa no navegador
```

Para exercitar as functions localmente: `npx vercel dev`.

## Variáveis de ambiente

Configurar em **Vercel → Project Settings → Environment Variables**.
Modelo comentado em `.env.example`. Nenhuma delas vai versionada.

| Variável | Onde é lida | Público? |
|---|---|---|
| `SUPABASE_URL` | `api/lead.js` | não |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/lead.js` | **NUNCA** — só servidor |
| `META_PIXEL_ID` | `api/config.js` | sim (o ID já é visível no navegador) |
| `WHATSAPP_NUMBER` | `api/config.js` | sim |

Sem `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` o formulário **continua
funcionando**: responde sucesso, mostra o botão do WhatsApp e devolve
`stored:false` — mas **o lead não é gravado** e o evento `Lead` não dispara.
É degradação proposital, para nunca derrubar o fluxo que já estava no ar.

## Banco de dados

Migração em `supabase/migrations/0001_funil_leads.sql`. Aplicar no projeto da MX
Digital (ref `ydbzqpkwfxybrdmadckm`):

```bash
supabase link --project-ref ydbzqpkwfxybrdmadckm
supabase db push
```

### Policy de RLS aplicada

RLS habilitado (e `force`) junto com a criação da tabela. O modelo é
**gravação só server-side**:

- **Nenhuma policy de insert.** A escrita acontece pelo `/api/lead` com a
  `service_role`, que por natureza ignora RLS. Como não existe policy de insert
  para `anon`, a chave anônima não escreve nada mesmo se vazar — e ela é pública
  por definição, já que viveria no frontend.
- **`select` e `update` só para `authenticated`** (o painel/CRM da MX).
- **`anon` não lê, não escreve, não atualiza e não apaga** (`revoke all`).
- Sem policy de `delete`: exclusão só pelo dono do projeto.

O caminho alternativo — `anon` com policy insert-only — foi descartado: a policy
impediria leitura, mas não impediria alguém rodar um script contra a tabela e
inundar o funil de leads falsos, já que não há captcha nem rate limit.

## Eventos de conversão

Camada única em `window.mxTrack(evento, dados)`. Envia para o Meta Pixel (quando
`META_PIXEL_ID` está configurado) e para o `dataLayer`. Sem Pixel configurado
vira no-op silencioso — nenhum ID falso, nada quebra.

| Evento | Quando |
|---|---|
| `PageView` | carregamento, depois do Pixel iniciar |
| `ViewContent` | carregamento, com `content_name: oferta-previa-gratis` |
| `FormStart` | primeiro caractere digitado em qualquer campo |
| `Lead` | **só** depois do backend confirmar `stored: true` |
| `PreviewSent` | preparado — chamar `mxTrack('PreviewSent')` quando a prévia for enviada |
| `ActivationPaid` | preparado — chamar `mxTrack('ActivationPaid')` na ativação paga |

Nenhum token no frontend. A Conversions API do Meta (server-side) não está
implementada — precisa de access token e ficaria em `api/`, nunca no navegador.

## Depoimentos

A seção existe e está `hidden`. Para publicar, preencha `DEPOIMENTOS` no
`<script>` do fim do `index.html` com falas **reais e autorizadas**:

```js
var DEPOIMENTOS = [
  { texto: 'fala do cliente', nome: 'Nome', contexto: 'Cidade/UF' }
];
```

O JS mostra a seção sozinho quando houver ao menos um item. Não há depoimento
de exemplo no arquivo de propósito.

## Deploy na Vercel

Framework **Other**. Build Command e Output Directory **vazios**. Root Directory
no padrão — o `index.html` está na raiz.

O `package.json` existe só para rodar teste; **não tem dependência de produção e
não tem script `build`**. Se a Vercel passar a detectar o projeto como Node e
tentar buildar, deixe o Build Command explicitamente vazio.

## Efeitos e interações

Tudo em CSS + JS puro, sem biblioteca. Todos desligam em
`prefers-reduced-motion: reduce`.

- **Sticky stack no mobile** (até 759px) — cards de "Como funciona" e da vitrine
  empilham em degraus de 12px. Dois detalhes que sustentam isso:
  - `body` usa `overflow-x: clip`, não `hidden` — `hidden` transforma o body em
    container de rolagem e mata o `position: sticky`.
  - o `.grid` tem uma linha-fantasma (`grid-template-rows: repeat(4,1fr) 150px`
    + `:after`): o retângulo que limita o sticky é o *content box*, então
    `padding-bottom` não estenderia o alcance. Sem ela, a pilha completa dura
    0px de rolagem em vez de 170px.
  - `grid-auto-rows: 1fr` iguala a altura dos cards; com alturas diferentes o
    card de trás aparece por baixo do da frente.
- **Tilt 3D** — até 6°/8° seguindo o cursor, só em `(hover:hover) and (pointer:fine)`.
- **Reveal no scroll** — IntersectionObserver com stagger (`.rv`, `.d1`–`.d3`).
- **Barra de progresso** e **parallax** do brilho do hero, num único listener
  com `requestAnimationFrame` e `passive: true`.
- **FAQ acordeão** — um aberto por vez, `aria-expanded` no botão e `inert` nos
  painéis fechados. Altura anima com `grid-template-rows: 0fr → 1fr`.

## Privacidade

Só dois campos, o mínimo para montar a prévia: `@` e WhatsApp. Mais as UTMs de
campanha, que não identificam pessoa.

- O `@` e o telefone **nunca** vão para a URL, nem para o histórico, nem para o
  link do WhatsApp — a mensagem do botão é genérica de propósito.
- `api/lead.js` **não registra dado pessoal em log** em nenhum caminho, nem no
  de erro: loga status, código do PostgREST e `utm_source`.
- Política em `privacidade.html`, linkada abaixo do formulário.
