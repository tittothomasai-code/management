-- Drilling World saved-site sync (v5.12.1). Additive only. NOT APPLIED: needs a free Supabase project for the drilling game.
-- Devices sign in anonymously; a pairing code joins devices to one sync space. RLS on every table: members see only their space.
-- No WITSML credentials are ever stored (client strips credential-like keys; check constraint below rejects them too).
create table if not exists public.dw_sync_spaces(id uuid primary key default gen_random_uuid(),code_hash text not null unique,created_at timestamptz not null default now());
create table if not exists public.dw_sync_members(space_id uuid not null references public.dw_sync_spaces(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,joined_at timestamptz not null default now(),primary key(space_id,user_id));
create table if not exists public.dw_sync_sites(space_id uuid not null references public.dw_sync_spaces(id) on delete cascade,site_id text not null,name text,updated_at timestamptz not null,payload jsonb not null,deleted boolean not null default false,
 primary key(space_id,site_id),constraint dw_sync_no_secrets check (payload::text !~* '"[^"]*(witsml|passw|secret|token|credential)[^"]*"\s*:'),constraint dw_sync_size check (pg_column_size(payload) < 5000000));
alter table public.dw_sync_spaces enable row level security;
alter table public.dw_sync_members enable row level security;
alter table public.dw_sync_sites enable row level security;
create policy dw_sync_spaces_member on public.dw_sync_spaces for select to authenticated using (exists(select 1 from public.dw_sync_members m where m.space_id=id and m.user_id=auth.uid()));
create policy dw_sync_members_self on public.dw_sync_members for select to authenticated using (user_id=auth.uid());
create policy dw_sync_sites_member_sel on public.dw_sync_sites for select to authenticated using (exists(select 1 from public.dw_sync_members m where m.space_id=dw_sync_sites.space_id and m.user_id=auth.uid()));
create policy dw_sync_sites_member_upd on public.dw_sync_sites for update to authenticated using (exists(select 1 from public.dw_sync_members m where m.space_id=dw_sync_sites.space_id and m.user_id=auth.uid()));
-- writes go through security definer functions with a fixed search_path
create or replace function public.dw_sync_create_space() returns text language plpgsql security definer set search_path=public,extensions as $$
declare c text; s uuid; begin if auth.uid() is null then raise exception 'login required'; end if;
 c:=upper(substr(encode(gen_random_bytes(8),'hex'),1,10)); insert into dw_sync_spaces(code_hash) values (encode(digest(c,'sha256'),'hex')) returning id into s;
 insert into dw_sync_members(space_id,user_id) values (s,auth.uid()); return c; end $$;
create or replace function public.dw_sync_join_space(p_code text) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare s uuid; begin if auth.uid() is null then raise exception 'login required'; end if;
 select id into s from dw_sync_spaces where code_hash=encode(digest(upper(p_code),'sha256'),'hex'); if s is null then raise exception 'unknown code'; end if;
 insert into dw_sync_members(space_id,user_id) values (s,auth.uid()) on conflict do nothing; return s; end $$;
create or replace function public.dw_sync_put_site(p_site_id text,p_name text,p_updated timestamptz,p_payload jsonb) returns void language plpgsql security definer set search_path=public as $$
declare s uuid; begin select space_id into s from dw_sync_members where user_id=auth.uid() order by joined_at desc limit 1; if s is null then raise exception 'not paired'; end if;
 insert into dw_sync_sites(space_id,site_id,name,updated_at,payload) values (s,p_site_id,p_name,p_updated,p_payload)
 on conflict(space_id,site_id) do update set name=excluded.name,updated_at=excluded.updated_at,payload=excluded.payload,deleted=false where dw_sync_sites.updated_at<excluded.updated_at; end $$;
revoke all on function public.dw_sync_create_space() from public,anon; grant execute on function public.dw_sync_create_space() to authenticated;
revoke all on function public.dw_sync_join_space(text) from public,anon; grant execute on function public.dw_sync_join_space(text) to authenticated;
revoke all on function public.dw_sync_put_site(text,text,timestamptz,jsonb) from public,anon; grant execute on function public.dw_sync_put_site(text,text,timestamptz,jsonb) to authenticated;
