-- v5.12.9 drill_game cloud sync (saved EDM sites + custom rigs). Project tryfecta-dome. Approved by Titto 1 Nov 2026 11:16 AEST (card t299s997).
-- Additive: new tables + functions in drill_game only; no existing table or auth setting touched. RLS on, no policies: anon reaches data only via the RPCs below.
-- Pairing: each device keeps a random 64-hex token (hashed with drill_game._tok); a space has a 10-char code; devices join with the code.
create table drill_game.sync_spaces (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  created_at timestamptz not null default now(),
  last_used timestamptz not null default now());
create table drill_game.sync_devices (
  token_hash bytea primary key,
  space_id uuid not null references drill_game.sync_spaces(id) on delete cascade,
  created_at timestamptz not null default now());
create index on drill_game.sync_devices(space_id);
create table drill_game.sync_items (
  space_id uuid not null references drill_game.sync_spaces(id) on delete cascade,
  kind text not null check (kind in ('site','rig')),
  item_id text not null check (char_length(item_id) between 1 and 80),
  name text check (char_length(name) <= 120),
  updated_at timestamptz not null,
  payload jsonb not null,
  deleted boolean not null default false,
  primary key (space_id, kind, item_id));
alter table drill_game.sync_spaces enable row level security;
alter table drill_game.sync_devices enable row level security;
alter table drill_game.sync_items enable row level security;
revoke all on drill_game.sync_spaces, drill_game.sync_devices, drill_game.sync_items from public, anon, authenticated;

create function drill_game._sync_secret(j jsonb) returns boolean language plpgsql immutable set search_path to '' as $$
declare k text; v jsonb;
begin
  if jsonb_typeof(j) = 'object' then
    for k, v in select * from jsonb_each(j) loop
      if k ~* '(witsml|passw|secret|token|credential|auth|username|apikey|api_key|cookie|session)' then return true; end if;
      if drill_game._sync_secret(v) then return true; end if;
    end loop;
  elsif jsonb_typeof(j) = 'array' then
    for v in select * from jsonb_array_elements(j) loop if drill_game._sync_secret(v) then return true; end if; end loop;
  end if;
  return false;
end $$;

create function drill_game._sync_space(p_token text) returns uuid language plpgsql security definer set search_path to '' as $$
declare sid uuid;
begin
  select space_id into sid from drill_game.sync_devices where token_hash = drill_game._tok(p_token);
  if sid is null then raise exception 'device not paired' using errcode = '42501'; end if;
  update drill_game.sync_spaces set last_used = now() where id = sid;
  return sid;
end $$;

create function drill_game.sync_create_space(p_token text) returns text language plpgsql security definer set search_path to '' as $$
declare h bytea := drill_game._tok(p_token); c text; sid uuid; i int;
begin
  for i in 1..20 loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, n) % 32), 1), '') into c
      from (select extensions.gen_random_bytes(10) b) r, generate_series(0, 9) n;
    begin insert into drill_game.sync_spaces(code) values (c) returning id into sid; exit;
    exception when unique_violation then sid := null; end;
  end loop;
  if sid is null then raise exception 'try again'; end if;
  insert into drill_game.sync_devices(token_hash, space_id) values (h, sid)
    on conflict (token_hash) do update set space_id = excluded.space_id, created_at = now();
  return c;
end $$;

create function drill_game.sync_join_space(p_code text, p_token text) returns uuid language plpgsql security definer set search_path to '' as $$
declare h bytea := drill_game._tok(p_token); sid uuid;
begin
  select id into sid from drill_game.sync_spaces where code = upper(btrim(p_code));
  if sid is null then raise exception 'no such pairing code' using errcode = 'P0002'; end if;
  if (select count(*) from drill_game.sync_devices where space_id = sid and token_hash <> h) >= 10 then raise exception 'too many devices'; end if;
  insert into drill_game.sync_devices(token_hash, space_id) values (h, sid)
    on conflict (token_hash) do update set space_id = excluded.space_id, created_at = now();
  return sid;
end $$;

create function drill_game.sync_put(p_token text, p_kind text, p_id text, p_name text, p_updated timestamptz, p_payload jsonb) returns boolean
language plpgsql security definer set search_path to '' as $$
declare sid uuid := drill_game._sync_space(p_token); n int;
begin
  if p_payload is null or pg_column_size(p_payload) > 2000000 then raise exception 'payload too big'; end if;
  if drill_game._sync_secret(p_payload) then raise exception 'credential-like keys are not allowed' using errcode = '22023'; end if;
  if p_updated is null or p_updated > now() + interval '1 day' then raise exception 'bad updated time'; end if;
  if not exists (select 1 from drill_game.sync_items where space_id = sid and kind = p_kind and item_id = p_id)
     and (select count(*) from drill_game.sync_items where space_id = sid) >= 1000 then raise exception 'space full'; end if;
  insert into drill_game.sync_items(space_id, kind, item_id, name, updated_at, payload)
    values (sid, p_kind, p_id, left(p_name, 120), p_updated, p_payload)
    on conflict (space_id, kind, item_id) do update set name = excluded.name, updated_at = excluded.updated_at, payload = excluded.payload, deleted = false
    where drill_game.sync_items.updated_at < excluded.updated_at;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create function drill_game.sync_get(p_token text)
returns table(kind text, item_id text, name text, updated_at timestamptz, payload jsonb)
language plpgsql security definer set search_path to '' as $$
declare sid uuid := drill_game._sync_space(p_token);
begin
  return query select i.kind, i.item_id, i.name, i.updated_at, i.payload from drill_game.sync_items i where i.space_id = sid and not i.deleted order by i.kind, i.item_id;
end $$;

revoke all on function drill_game._sync_secret(jsonb), drill_game._sync_space(text), drill_game.sync_create_space(text), drill_game.sync_join_space(text,text),
  drill_game.sync_put(text,text,text,text,timestamptz,jsonb), drill_game.sync_get(text) from public, anon, authenticated;
grant execute on function drill_game.sync_create_space(text), drill_game.sync_join_space(text,text),
  drill_game.sync_put(text,text,text,text,timestamptz,jsonb), drill_game.sync_get(text) to anon, authenticated;
