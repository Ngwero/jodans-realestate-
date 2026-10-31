begin;

create table if not exists public.app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default 'Host',
  role text not null default 'host' check (role in ('admin', 'host')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.app_listings (
  id text primary key,
  host_id uuid not null references public.app_profiles(id),
  data jsonb not null,
  constraint listing_identity check (data->>'id' = id and data->>'hostId' = host_id::text),
  constraint listing_approval check (data->>'approval' in ('approved','pending','rejected','hidden'))
);
create index if not exists app_listings_host_idx on public.app_listings(host_id);
create table if not exists public.app_activity (
  id uuid primary key,
  data jsonb not null
);

alter table public.app_profiles enable row level security;
alter table public.app_listings enable row level security;
alter table public.app_activity enable row level security;
-- Access goes through the Express API, which verifies users, roles and ownership.
-- No browser role has direct table access, including to private profiles/drafts.
revoke all on public.app_profiles, public.app_listings, public.app_activity from anon, authenticated;
grant all on public.app_profiles, public.app_listings, public.app_activity to service_role;

create or replace function public.app_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_profiles(id, email, name)
  values(new.id, coalesce(new.email, ''), coalesce(nullif(new.raw_user_meta_data->>'name',''), 'Host'));
  -- User-supplied metadata can never grant an admin role.
  return new;
end;
$$;
revoke all on function public.app_create_profile() from public, anon, authenticated;
drop trigger if exists app_auth_profile_created on auth.users;
create trigger app_auth_profile_created after insert on auth.users
for each row execute function public.app_create_profile();

insert into public.app_profiles(id, email, name)
select id, coalesce(email,''), coalesce(nullif(raw_user_meta_data->>'name',''), 'Host')
from auth.users on conflict(id) do nothing;

-- A consistent snapshot preserves the existing dashboard calculations. Returned
-- only to the backend. This also avoids the Data API's default 1,000-row limit.
create or replace function public.app_read_state()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'email', email, 'name', name, 'role', role,
      'active', active, 'createdAt', created_at) order by id) from public.app_profiles), '[]'::jsonb),
    'listings', coalesce((select jsonb_agg(data order by data->>'createdAt' desc, id) from public.app_listings), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(data order by data->>'at' desc, id) from public.app_activity), '[]'::jsonb)
  );
$$;
revoke all on function public.app_read_state() from public, anon, authenticated;
grant execute on function public.app_read_state() to service_role;

-- Apply only changed records, in one transaction. Expected values prevent two
-- servers from silently overwriting each other's edits. Conflicts return 409.
create or replace function public.app_apply_changes(changes jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare item jsonb;
begin
  for item in select value from jsonb_array_elements(coalesce(changes->'profiles', '[]')) loop
    update public.app_profiles set name=item->>'name', active=(item->>'active')::boolean
    where id=(item->>'id')::uuid and name=item->>'expectedName'
      and active=(item->>'expectedActive')::boolean;
    if not found then raise exception using errcode='40001', message='Profile changed; reload and retry'; end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(changes->'listings', '[]')) loop
    if item->'expected' = 'null'::jsonb then
      insert into public.app_listings(id, host_id, data)
      values(item->>'id', (item->'data'->>'hostId')::uuid, item->'data')
      on conflict(id) do nothing;
    else
      update public.app_listings set data=item->'data', host_id=(item->'data'->>'hostId')::uuid
      where id=item->>'id' and data=item->'expected';
    end if;
    if not found then raise exception using errcode='40001', message='Listing changed; reload and retry'; end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(changes->'deletedListings', '[]')) loop
    delete from public.app_listings where id=item->>'id' and data=item->'expected';
    if not found then raise exception using errcode='40001', message='Listing changed; reload and retry'; end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(changes->'activity', '[]')) loop
    insert into public.app_activity(id, data) values((item->>'id')::uuid, item) on conflict(id) do nothing;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(changes->'deletedActivity', '[]')) loop
    delete from public.app_activity where id=(item#>>'{}')::uuid;
  end loop;
end;
$$;
revoke all on function public.app_apply_changes(jsonb) from public, anon, authenticated;
grant execute on function public.app_apply_changes(jsonb) to service_role;

-- Property photos are public; only the backend can upload or delete objects.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('property-photos', 'property-photos', true, 8388608,
  array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true, file_size_limit=8388608,
  allowed_mime_types=excluded.allowed_mime_types;

commit;
