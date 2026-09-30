begin;

create or replace function public.create_couple(relationship_date date default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid; new_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.profiles where id = auth.uid() and couple_id is not null) then
    raise exception 'Already connected to a couple';
  end if;
  loop
    new_code := 'LOVE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    exit when not exists(select 1 from public.couples where invite_code = new_code);
  end loop;
  insert into public.couples(invite_code, user_one, relationship_start)
    values(new_code, auth.uid(), relationship_date) returning id into new_id;
  update public.profiles set couple_id = new_id where id = auth.uid();
  insert into public.love_pet(couple_id) values(new_id);
  return new_id;
end;
$$;

commit;