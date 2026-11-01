begin;
alter table public.app_profiles add column if not exists email_verified boolean not null default true;
alter table public.app_credentials add column if not exists session_version integer not null default 0;
create table if not exists public.app_auth_tokens (
  profile_id text not null references public.app_profiles(id) on delete cascade,
  kind text not null check(kind in ('verify','reset')),
  token_hash text not null unique check(length(token_hash)=64),
  expires_at timestamptz not null,
  primary key(profile_id,kind)
);
create table if not exists public.app_mail_outbox (
  id uuid primary key default gen_random_uuid(),
  payload text not null,
  token_hash text,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists app_mail_pending_idx on public.app_mail_outbox(available_at) where sent_at is null and failed_at is null;
create table if not exists public.app_auth_limits (
  key_hash text primary key,
  hits integer not null,
  window_start timestamptz not null
);
alter table public.app_auth_tokens enable row level security;
alter table public.app_mail_outbox enable row level security;
alter table public.app_auth_limits enable row level security;
revoke all on public.app_auth_tokens, public.app_mail_outbox, public.app_auth_limits from anon,authenticated;
grant all on public.app_auth_tokens, public.app_mail_outbox, public.app_auth_limits to service_role;

create or replace function public.app_auth_identity(p_id text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',p.id,'email',p.email,'name',p.name,'role',p.role,
    'active',p.active,'emailVerified',p.email_verified,'sessionVersion',c.session_version)
  from public.app_profiles p join public.app_credentials c on c.profile_id=p.id where p.id=p_id;
$$;

create or replace function public.app_auth_take_limit(p_key text,p_max integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare hits_now integer;
begin
  delete from public.app_auth_limits where window_start < now()-interval '2 days';
  insert into public.app_auth_limits(key_hash,hits,window_start) values(p_key,1,now())
  on conflict(key_hash) do update set
    hits=case when app_auth_limits.window_start < now()-make_interval(secs=>p_seconds) then 1 else app_auth_limits.hits+1 end,
    window_start=case when app_auth_limits.window_start < now()-make_interval(secs=>p_seconds) then now() else app_auth_limits.window_start end
  returning hits into hits_now;
  return hits_now <= p_max;
end;
$$;

create or replace function public.app_register_pending(p_id text,p_email text,p_name text,p_password text,p_hash text,p_payload text)
returns void language plpgsql security invoker set search_path='' as $$
declare owner_id text; verified boolean; enabled boolean; event_id uuid:=gen_random_uuid();
begin
  insert into public.app_profiles(id,email,name,role,active,email_verified)
  values(p_id,lower(p_email),p_name,'host',true,false) on conflict do nothing returning id into owner_id;
  if owner_id is not null then
    insert into public.app_credentials(profile_id,password_hash) values(owner_id,p_password);
    insert into public.app_activity(id,data) values(event_id,jsonb_build_object('id',event_id,
      'at',now(),'actor',lower(p_email),'action','host_registered','detail','Host registered; awaiting email confirmation'));
  else
    select id,email_verified,active into owner_id,verified,enabled from public.app_profiles
      where lower(email)=lower(p_email) for update;
    if owner_id is null or verified or not enabled then return; end if;
  end if;
  insert into public.app_auth_tokens(profile_id,kind,token_hash,expires_at) values(owner_id,'verify',p_hash,now()+interval '24 hours')
  on conflict(profile_id,kind) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
  insert into public.app_mail_outbox(payload,token_hash) values(p_payload,p_hash);
end;
$$;

create or replace function public.app_request_account_email(p_email text,p_kind text,p_hash text,p_payload text)
returns void language plpgsql security invoker set search_path='' as $$
declare owner_id text; verified boolean;
begin
  if p_kind not in ('verify','reset') then raise exception 'Invalid email type'; end if;
  select id,email_verified into owner_id,verified from public.app_profiles
    where lower(email)=lower(p_email) and active for update;
  if owner_id is null or (p_kind='verify' and verified) then return; end if;
  insert into public.app_auth_tokens(profile_id,kind,token_hash,expires_at)
  values(owner_id,p_kind,p_hash,now()+case when p_kind='reset' then interval '30 minutes' else interval '24 hours' end)
  on conflict(profile_id,kind) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
  insert into public.app_mail_outbox(payload,token_hash) values(p_payload,p_hash);
end;
$$;

create or replace function public.app_consume_account_token(p_hash text,p_kind text,p_password text default null,p_payload text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare owner_id text; account public.app_profiles; token public.app_auth_tokens;
begin
  select profile_id into owner_id from public.app_auth_tokens where token_hash=p_hash and kind=p_kind;
  if owner_id is null then return false; end if;
  select * into account from public.app_profiles where id=owner_id for update;
  select * into token from public.app_auth_tokens where profile_id=owner_id and kind=p_kind and token_hash=p_hash for update;
  if not found or token.expires_at<=now() or not account.active then return false; end if;
  if p_kind='reset' then
    if p_password is null then return false; end if;
    update public.app_credentials set password_hash=p_password,session_version=session_version+1 where profile_id=owner_id;
    if not found then return false; end if;
    delete from public.app_auth_tokens where profile_id=owner_id;
    if p_payload is not null then insert into public.app_mail_outbox(payload) values(p_payload); end if;
  elsif p_kind='verify' then
    delete from public.app_auth_tokens where profile_id=owner_id and kind='verify';
  else return false;
  end if;
  update public.app_profiles set email_verified=true where id=owner_id;
  return true;
end;
$$;

create or replace function public.app_account_token_email(p_hash text)
returns text language sql stable security invoker set search_path='' as $$
  select p.email from public.app_profiles p join public.app_auth_tokens t on t.profile_id=p.id
  where t.token_hash=p_hash and t.kind='reset' and t.expires_at>now() and p.active;
$$;

create or replace function public.app_claim_email()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item public.app_mail_outbox;
begin
  update public.app_mail_outbox m set failed_at=now(),error_code='expired_or_replaced'
    where m.sent_at is null and m.failed_at is null and m.token_hash is not null
      and not exists(select 1 from public.app_auth_tokens t where t.token_hash=m.token_hash and t.expires_at>now());
  select * into item from public.app_mail_outbox where sent_at is null and failed_at is null
    and attempts<6 and available_at<=now() and (lease_until is null or lease_until<now())
    order by available_at,created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.app_mail_outbox set attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes'
    where id=item.id returning * into item;
  return jsonb_build_object('id',item.id,'payload',item.payload,'lease',item.lease_id);
end;
$$;

create or replace function public.app_finish_email(p_id uuid,p_lease uuid,p_success boolean,p_error text)
returns void language sql security invoker set search_path='' as $$
  update public.app_mail_outbox set
    sent_at=case when p_success then now() else null end,
    failed_at=case when not p_success and attempts>=6 then now() else null end,
    available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),
    lease_until=null,lease_id=null,error_code=case when p_success then null else left(p_error,60) end
  where id=p_id and lease_id=p_lease;
$$;

revoke all on function public.app_auth_identity(text),public.app_auth_take_limit(text,integer,integer),
 public.app_register_pending(text,text,text,text,text,text),public.app_request_account_email(text,text,text,text),
 public.app_consume_account_token(text,text,text,text),public.app_account_token_email(text),
 public.app_claim_email(),public.app_finish_email(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.app_auth_identity(text),public.app_auth_take_limit(text,integer,integer),
 public.app_register_pending(text,text,text,text,text,text),public.app_request_account_email(text,text,text,text),
 public.app_consume_account_token(text,text,text,text),public.app_account_token_email(text),
 public.app_claim_email(),public.app_finish_email(uuid,uuid,boolean,text) to service_role;
commit;
