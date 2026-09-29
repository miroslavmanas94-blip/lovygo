begin;

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, bio)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'bio'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles as profile
set
  display_name = coalesce(profile.display_name, nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), '')),
  bio = coalesce(profile.bio, nullif(btrim(auth_user.raw_user_meta_data ->> 'bio'), ''))
from auth.users as auth_user
where auth_user.id = profile.id
  and (profile.display_name is null or profile.bio is null);

commit;