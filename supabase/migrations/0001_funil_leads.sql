-- =====================================================================
-- funil_leads — leads do formulário da landing "Manda seu @"
--
-- Projeto de destino: MX Digital (ref ydbzqpkwfxybrdmadckm).
-- Tabela nova e exclusiva desta landing: não reaproveita tabela existente.
--
-- Como aplicar:
--   supabase link --project-ref ydbzqpkwfxybrdmadckm
--   supabase db push
-- ou colar este arquivo no SQL Editor do projeto.
-- =====================================================================

create extension if not exists "pgcrypto";

create table if not exists public.funil_leads (
  id                uuid primary key default gen_random_uuid(),
  instagram_handle  text        not null check (length(btrim(instagram_handle)) between 2 and 100),
  whatsapp          text        not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  status            text        not null default 'new'
                                check (status in ('new','contacted','preview_sent','activated','lost')),
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  utm_term          text,
  fbclid            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.funil_leads is
  'Leads da landing "Manda seu @". Gravação exclusivamente via endpoint server-side (/api/lead) com service role.';
comment on column public.funil_leads.whatsapp is 'Telefone normalizado em E.164, ex: +5551991580526.';

-- atendimento trabalha a fila por status e por data
create index if not exists funil_leads_status_created_at_idx
  on public.funil_leads (status, created_at desc);

-- updated_at sempre coerente, mesmo em update feito direto no painel
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists funil_leads_set_updated_at on public.funil_leads;
create trigger funil_leads_set_updated_at
  before update on public.funil_leads
  for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS — habilitado junto com a criação da tabela
--
-- Modelo adotado: gravação SOMENTE server-side, com service role.
-- A service role ignora RLS por natureza, então NÃO existe policy de
-- insert para anon. Isso é proposital: sem policy de insert pública,
-- ninguém consegue escrever na tabela com a chave anon, mesmo que ela
-- vaze — e ela é pública por definição, já que vive no frontend.
--
-- Leitura fica restrita a usuário autenticado (o painel/CRM da MX).
-- anon não lê, não escreve, não atualiza e não apaga.
-- =====================================================================

alter table public.funil_leads enable row level security;
alter table public.funil_leads force row level security;

drop policy if exists funil_leads_select_authenticated on public.funil_leads;
create policy funil_leads_select_authenticated
  on public.funil_leads
  for select
  to authenticated
  using (true);

drop policy if exists funil_leads_update_authenticated on public.funil_leads;
create policy funil_leads_update_authenticated
  on public.funil_leads
  for update
  to authenticated
  using (true)
  with check (true);

-- sem policy de insert e sem policy de delete de propósito:
-- insert só pela service role no /api/lead, delete só pelo dono do projeto.

revoke all on public.funil_leads from anon;
grant select, update on public.funil_leads to authenticated;
