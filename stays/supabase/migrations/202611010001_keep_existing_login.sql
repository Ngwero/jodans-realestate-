-- Run after 202610300001_supabase.sql. Keeps existing app logins and IDs.
-- Existing cloud data is preserved; Supabase Auth accounts are left untouched.
begin;
drop trigger if exists app_auth_profile_created on auth.users;
alter table public.app_listings drop constraint if exists app_listings_host_id_fkey;
alter table public.app_profiles drop constraint if exists app_profiles_id_fkey;
alter table public.app_profiles alter column id type text using id::text;
alter table public.app_listings alter column host_id type text using host_id::text;
alter table public.app_listings add constraint app_listings_host_id_fkey
  foreign key(host_id) references public.app_profiles(id);
create unique index if not exists app_profiles_email_unique on public.app_profiles(lower(email));
create table if not exists public.app_credentials (
  profile_id text primary key references public.app_profiles(id) on delete cascade,
  password_hash text not null
);
alter table public.app_credentials enable row level security;
revoke all on public.app_credentials from anon, authenticated;
grant all on public.app_credentials to service_role;

create or replace function public.app_read_state()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'email', p.email, 'name', p.name, 'role', p.role,
      'active', p.active, 'createdAt', p.created_at, 'password', c.password_hash) order by p.id)
      from public.app_profiles p left join public.app_credentials c on c.profile_id=p.id), '[]'::jsonb),
    'listings', coalesce((select jsonb_agg(data order by data->>'createdAt' desc, id) from public.app_listings), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(data order by data->>'at' desc, id) from public.app_activity), '[]'::jsonb)
  );
$$;
revoke all on function public.app_read_state() from public, anon, authenticated;
grant execute on function public.app_read_state() to service_role;

create or replace function public.app_apply_changes(changes jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare item jsonb;
begin
  for item in select value from jsonb_array_elements(coalesce(changes->'profiles', '[]')) loop
    if coalesce((item->>'insert')::boolean, false) then
      insert into public.app_profiles(id,email,name,role,active,created_at)
      values(item->>'id', item->>'email', item->>'name', item->>'role',
        (item->>'active')::boolean, (item->>'createdAt')::timestamptz);
    else
      update public.app_profiles set name=item->>'name', active=(item->>'active')::boolean
      where id=item->>'id' and name=item->>'expectedName'
        and active=(item->>'expectedActive')::boolean;
      if not found then raise exception using errcode='40001', message='Profile changed; reload and retry'; end if;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(changes->'credentials', '[]')) loop
    if item->'expected' = 'null'::jsonb then
      insert into public.app_credentials(profile_id,password_hash) values(item->>'id',item->>'password');
    else
      update public.app_credentials set password_hash=item->>'password'
      where profile_id=item->>'id' and password_hash=item->>'expected';
      if not found then raise exception using errcode='40001', message='Password changed; reload and retry'; end if;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(changes->'listings', '[]')) loop
    if item->'expected' = 'null'::jsonb then
      insert into public.app_listings(id, host_id, data)
      values(item->>'id', item->'data'->>'hostId', item->'data')
      on conflict(id) do nothing;
    else
      update public.app_listings set data=item->'data', host_id=item->'data'->>'hostId'
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


commit;
