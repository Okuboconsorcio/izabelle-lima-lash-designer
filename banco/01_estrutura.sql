-- =====================================================================
-- Izabelle Lima: estrutura completa do banco (Supabase / Postgres)
-- Aplicado em 27/10/2026 no Moka-pd e, em 06/11/2026, no Data-NTO (projeto atual) como migração "izabelle_schema".
-- Rodar inteiro de uma vez (SQL Editor do Supabase) para recriar do zero.
-- ATENÇÃO: o final deste arquivo mexe na lista de schemas expostos da API.
--          Confira a lista atual antes de rodar em outro projeto.
-- =====================================================================

-- Schema próprio, separado dos demais apps do projeto
create schema if not exists izabelle;
create schema if not exists izabelle_private;  -- funções internas, não ficam expostas na API

-- ---------- tabelas ----------
create table izabelle.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table izabelle.settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table izabelle.services (
  id uuid primary key default gen_random_uuid(),
  cat text not null check (cat in ('sobrancelha','buco','cilios')),
  name text not null check (length(name) between 1 and 120),
  price numeric(10,2) not null default 0 check (price >= 0),
  duration int not null check (duration between 5 and 600),
  note text not null default '',
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table izabelle.appointments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references izabelle.services(id) on delete set null,
  service_name text not null,
  cat text not null,
  price numeric(10,2) not null default 0,
  duration int not null check (duration between 5 and 600),
  date date not null,
  time text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  client text not null check (length(client) between 1 and 120),
  phone text not null default '',
  notes text not null default '',
  status text not null default 'agendado' check (status in ('agendado','concluido','cancelado','faltou')),
  paid numeric(10,2) not null default 0,
  payment text not null default '',
  source text not null default 'site',
  created_at timestamptz not null default now()
);
create index appointments_date_idx on izabelle.appointments (date);
create index appointments_service_id_idx on izabelle.appointments (service_id);

create table izabelle.blocks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  reason text not null default '',
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index blocks_date_idx on izabelle.blocks (date);

create table izabelle.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cat text not null default '',
  unit text not null default 'unidade',
  stock numeric(10,2) not null default 0,
  min_stock numeric(10,2) not null default 1,
  last_price numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table izabelle.purchases (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references izabelle.materials(id) on delete set null,
  material_name text not null default '',
  date date not null,
  qty numeric(10,2) not null check (qty > 0),
  total numeric(10,2) not null check (total >= 0),
  supplier text not null default '',
  created_at timestamptz not null default now()
);
create index purchases_material_id_idx on izabelle.purchases (material_id);
create index purchases_date_idx on izabelle.purchases (date);

create table izabelle.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  cat text not null default 'Outros',
  value numeric(10,2) not null check (value >= 0),
  created_at timestamptz not null default now()
);
create index expenses_date_idx on izabelle.expenses (date);

-- ---------- funções internas (schema não exposto) ----------
create function izabelle_private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from izabelle.admins where user_id = (select auth.uid())) $$;

create function izabelle_private.to_min(t text) returns int
language sql immutable set search_path = ''
as $$ select split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int $$;

-- impede dois atendimentos (ou atendimento + bloqueio) no mesmo horário
create function izabelle_private.check_overlap() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare s int; e int;
begin
  if new.status = 'cancelado' then return new; end if;
  if tg_op = 'UPDATE' and new.date = old.date and new.time = old.time
     and new.duration = old.duration and old.status <> 'cancelado' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('izabelle:' || new.date::text));
  s := izabelle_private.to_min(new.time);
  e := s + new.duration;
  if e > 24 * 60 then
    raise exception 'Esse atendimento passaria da meia-noite.';
  end if;
  if exists (
    select 1 from izabelle.appointments a
    where a.date = new.date and a.id <> new.id and a.status <> 'cancelado'
      and s < izabelle_private.to_min(a.time) + a.duration
      and e > izabelle_private.to_min(a.time)
  ) or exists (
    select 1 from izabelle.blocks b
    where b.date = new.date
      and s < izabelle_private.to_min(b.end_time)
      and e > izabelle_private.to_min(b.start_time)
  ) then
    raise exception 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.';
  end if;
  return new;
end $$;

create trigger appointments_no_overlap
before insert or update on izabelle.appointments
for each row execute function izabelle_private.check_overlap();

-- ---------- funções públicas (API) ----------
-- horários ocupados, sem nenhum dado pessoal
create function izabelle.busy_ranges(p_from date, p_to date)
returns table (date date, start_min int, end_min int)
language sql stable security definer set search_path = ''
as $$
  select a.date, izabelle_private.to_min(a.time), izabelle_private.to_min(a.time) + a.duration
  from izabelle.appointments a
  where a.status <> 'cancelado' and a.date between p_from and least(p_to, p_from + 120)
  union all
  select b.date, izabelle_private.to_min(b.start_time), izabelle_private.to_min(b.end_time)
  from izabelle.blocks b
  where b.date between p_from and least(p_to, p_from + 120)
$$;

-- agendamento feito pela cliente no site (valida todas as regras no servidor)
create function izabelle.book_appointment(
  p_service_id uuid, p_date date, p_time text, p_client text, p_phone text, p_notes text default ''
) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  sv izabelle.services;
  cfg jsonb;
  h jsonb;
  local_now timestamp := now() at time zone 'America/Sao_Paulo';
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  s int; e int;
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  rec izabelle.appointments;
begin
  select * into sv from izabelle.services where id = p_service_id and active;
  if not found then raise exception 'Serviço não encontrado.'; end if;
  if length(trim(coalesce(p_client, ''))) < 2 or length(p_client) > 80 then raise exception 'Digite seu nome, por favor.'; end if;
  if length(digits) not between 10 and 13 then raise exception 'Digite um WhatsApp válido com DDD.'; end if;
  if length(coalesce(p_notes, '')) > 500 then raise exception 'A observação está muito longa.'; end if;
  if p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horário inválido.'; end if;

  select data into cfg from izabelle.settings where id = 1;
  h := cfg -> 'hours' -> extract(dow from p_date)::int::text;
  if h is null or not coalesce((h ->> 'on')::boolean, false) then raise exception 'Não há atendimento neste dia.'; end if;
  if p_date < today or p_date > today + coalesce((cfg ->> 'windowDays')::int, 45) then
    raise exception 'Esta data não está disponível para agendamento.';
  end if;

  s := izabelle_private.to_min(p_time);
  e := s + sv.duration;
  if s < izabelle_private.to_min(h ->> 'open') or e > izabelle_private.to_min(h ->> 'close') then
    raise exception 'Fora do horário de atendimento.';
  end if;
  if coalesce((cfg -> 'lunch' ->> 'on')::boolean, false)
     and s < izabelle_private.to_min(cfg -> 'lunch' ->> 'end')
     and e > izabelle_private.to_min(cfg -> 'lunch' ->> 'start') then
    raise exception 'Esse horário cai no intervalo de almoço.';
  end if;
  if p_date = today and s < extract(hour from local_now)::int * 60 + extract(minute from local_now)::int
       + coalesce((cfg ->> 'minNoticeHours')::int, 0) * 60 then
    raise exception 'Esse horário já passou ou está muito em cima da hora.';
  end if;
  if (select count(*) from izabelle.appointments a
      where a.status = 'agendado' and a.date >= today
        and regexp_replace(a.phone, '\D', '', 'g') = digits) >= 3 then
    raise exception 'Você já tem 3 horários marcados. Fale com a gente pelo WhatsApp para marcar mais.';
  end if;

  insert into izabelle.appointments (service_id, service_name, cat, price, duration, date, time, client, phone, notes, source)
  values (sv.id, sv.name, sv.cat, sv.price, sv.duration, p_date, p_time, trim(p_client), trim(p_phone), coalesce(trim(p_notes), ''), 'site')
  returning * into rec;
  return row_to_json(rec);
end $$;

-- o primeiro login no painel vira dona do painel; depois disso fica travado
create function izabelle.claim_admin() returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return false; end if;
  if not exists (select 1 from izabelle.admins) then
    insert into izabelle.admins (user_id) values ((select auth.uid()));
  end if;
  return exists (select 1 from izabelle.admins where user_id = (select auth.uid()));
end $$;

-- ---------- permissões ----------
revoke all on all functions in schema izabelle from public;
revoke all on all functions in schema izabelle_private from public;
grant usage on schema izabelle to anon, authenticated, service_role;
grant usage on schema izabelle_private to anon, authenticated;
grant execute on function izabelle_private.is_admin() to anon, authenticated;
grant execute on function izabelle_private.to_min(text) to anon, authenticated;
grant execute on function izabelle.busy_ranges(date, date) to anon, authenticated;
grant execute on function izabelle.book_appointment(uuid, date, text, text, text, text) to anon, authenticated;
grant execute on function izabelle.claim_admin() to authenticated;

grant select on izabelle.settings, izabelle.services to anon;
grant select, insert, update, delete on all tables in schema izabelle to authenticated;
grant all on all tables in schema izabelle to service_role;

-- ---------- RLS (quem vê o quê) ----------
alter table izabelle.admins enable row level security;
alter table izabelle.settings enable row level security;
alter table izabelle.services enable row level security;
alter table izabelle.appointments enable row level security;
alter table izabelle.blocks enable row level security;
alter table izabelle.materials enable row level security;
alter table izabelle.purchases enable row level security;
alter table izabelle.expenses enable row level security;

create policy "ver o próprio acesso" on izabelle.admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy "todos leem os ajustes" on izabelle.settings for select to anon, authenticated using (true);
create policy "dona altera os ajustes" on izabelle.settings for update to authenticated
  using ((select izabelle_private.is_admin())) with check ((select izabelle_private.is_admin()));

create policy "todos leem serviços ativos" on izabelle.services for select to anon, authenticated
  using (active or (select izabelle_private.is_admin()));
create policy "dona cria serviços" on izabelle.services for insert to authenticated
  with check ((select izabelle_private.is_admin()));
create policy "dona altera serviços" on izabelle.services for update to authenticated
  using ((select izabelle_private.is_admin())) with check ((select izabelle_private.is_admin()));
create policy "dona apaga serviços" on izabelle.services for delete to authenticated
  using ((select izabelle_private.is_admin()));

do $$
declare t text;
begin
  foreach t in array array['appointments','blocks','materials','purchases','expenses'] loop
    execute format('create policy "somente a dona" on izabelle.%I for all to authenticated using ((select izabelle_private.is_admin())) with check ((select izabelle_private.is_admin()))', t);
  end loop;
end $$;

-- avisos em tempo real de novos agendamentos no painel
alter publication supabase_realtime add table izabelle.appointments;

-- ---------- dados iniciais ----------
insert into izabelle.settings (id, data) values (1, '{
  "studio": "Izabelle Lima", "subtitle": "Lash Designer", "whatsapp": "", "address": "", "instagram": "",
  "hours": {
    "0": {"on": false, "open": "09:00", "close": "19:00"},
    "1": {"on": true, "open": "09:00", "close": "19:00"},
    "2": {"on": true, "open": "09:00", "close": "19:00"},
    "3": {"on": true, "open": "09:00", "close": "19:00"},
    "4": {"on": true, "open": "09:00", "close": "19:00"},
    "5": {"on": true, "open": "09:00", "close": "19:00"},
    "6": {"on": true, "open": "09:00", "close": "14:00"}
  },
  "lunch": {"on": true, "start": "12:00", "end": "13:00"},
  "step": 30, "minNoticeHours": 2, "windowDays": 45
}'::jsonb);

insert into izabelle.services (cat, name, price, duration, note, position) values
  ('sobrancelha', 'Design de sobrancelha', 25, 30, '', 1),
  ('sobrancelha', 'Design com henna', 45, 45, '', 2),
  ('sobrancelha', 'Diagnose com tintura', 50, 45, '', 3),
  ('buco', 'Depilação de buço', 10, 15, '', 4),
  ('cilios', 'Brasileiro — colocação', 115, 120, '', 5),
  ('cilios', 'Brasileiro — manutenção', 70, 90, 'Manutenção de 15 a 21 dias', 6),
  ('cilios', 'Egípcio — colocação', 125, 120, '', 7),
  ('cilios', 'Egípcio — manutenção', 75, 90, 'Manutenção de 15 a 21 dias', 8),
  ('cilios', 'Mega (Capping) — colocação', 130, 120, '', 9),
  ('cilios', 'Mega (Capping) — manutenção', 80, 90, 'Manutenção de 15 a 21 dias', 10),
  ('cilios', '5D — colocação', 135, 120, '', 11),
  ('cilios', '5D — manutenção', 85, 90, 'Manutenção de 15 a 21 dias', 12),
  ('cilios', 'Fox — colocação', 140, 120, '', 13),
  ('cilios', 'Fox — manutenção', 90, 90, 'Manutenção de 15 a 21 dias', 14);

-- ---------- expor o schema na API ----------
-- Mantém os schemas que os outros apps do Data-NTO já usavam e acrescenta "izabelle".
-- Em outro projeto, troque a lista pelos schemas daquele projeto + izabelle.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, financeiro_nick, izabelle';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
