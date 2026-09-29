create extension if not exists pgcrypto;

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  user_one uuid not null references auth.users(id) on delete cascade,
  user_two uuid references auth.users(id) on delete set null,
  relationship_start date,
  created_at timestamptz not null default now(),
  constraint distinct_members check (user_two is null or user_one <> user_two)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text,
  image_url text,
  created_at timestamptz not null default now(),
  constraint message_has_content check (content is not null or image_url is not null)
);

create table public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  note_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (couple_id, note_date)
);

create table public.love_pet (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null unique references public.couples(id) on delete cascade,
  name text not null default 'LovePet',
  hunger integer not null default 65 check (hunger between 0 and 100),
  happiness integer not null default 75 check (happiness between 0 and 100),
  energy integer not null default 80 check (energy between 0 and 100),
  updated_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  game_type text not null,
  state jsonb not null default '{}'::jsonb,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  image_path text not null,
  memory_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.bucket_list (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.love_letters (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  unlock_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mood text not null,
  note text,
  created_at timestamptz not null default now()
);

create index profiles_couple_id_idx on public.profiles(couple_id);
create index messages_couple_created_idx on public.messages(couple_id, created_at);
create index games_couple_updated_idx on public.games(couple_id, updated_at desc);
create index memories_couple_date_idx on public.memories(couple_id, memory_date desc);
create index bucket_list_couple_created_idx on public.bucket_list(couple_id, created_at desc);
create index letters_couple_unlock_idx on public.love_letters(couple_id, unlock_at);
create index moods_couple_created_idx on public.mood_entries(couple_id, created_at desc);

create or replace function public.is_couple_member(target_couple uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.couple_id = target_couple
) $$;

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
    new_code := 'LOVE-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 5));
    exit when not exists(select 1 from public.couples where invite_code = new_code);
  end loop;
  insert into public.couples(invite_code, user_one, relationship_start)
    values(new_code, auth.uid(), relationship_date) returning id into new_id;
  update public.profiles set couple_id = new_id where id = auth.uid();
  insert into public.love_pet(couple_id) values(new_id);
  return new_id;
end;
$$;

create or replace function public.join_couple(code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.profiles where id = auth.uid() and couple_id is not null) then
    raise exception 'Already connected to a couple';
  end if;
  select id into target_id from public.couples
    where invite_code = upper(trim(code)) and user_two is null for update;
  if target_id is null then raise exception 'Invite code is invalid or already used'; end if;
  update public.couples set user_two = auth.uid() where id = target_id;
  update public.profiles set couple_id = target_id where id = auth.uid();
  return target_id;
end;
$$;

create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles(id, display_name)
  values(new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.create_profile_for_user();

grant execute on function public.create_couple(date) to authenticated;
grant execute on function public.join_couple(text) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['couples','profiles','messages','daily_notes','love_pet','games','memories','bucket_list','love_letters','mood_entries'] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "profiles select own or partner" on public.profiles for select to authenticated
using (id = auth.uid() or (couple_id is not null and public.is_couple_member(couple_id)));
revoke update on public.profiles from authenticated;
grant update (display_name, bio, avatar_url) on public.profiles to authenticated;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles insert own" on public.profiles for insert to authenticated
with check (id = auth.uid() and couple_id is null);
create policy "couples select member" on public.couples for select to authenticated
using (public.is_couple_member(id) or user_one = auth.uid() or user_two = auth.uid());
create policy "couple data read" on public.messages for select to authenticated using (public.is_couple_member(couple_id));
create policy "couple data insert" on public.messages for insert to authenticated with check (public.is_couple_member(couple_id) and sender_id = auth.uid());
create policy "own message delete" on public.messages for delete to authenticated using (sender_id = auth.uid() and public.is_couple_member(couple_id));
create policy "daily notes read" on public.daily_notes for select to authenticated using (public.is_couple_member(couple_id));
create policy "daily notes write" on public.daily_notes for insert to authenticated with check (public.is_couple_member(couple_id) and author_id = auth.uid());
create policy "daily notes update" on public.daily_notes for update to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "pet read" on public.love_pet for select to authenticated using (public.is_couple_member(couple_id));
create policy "pet update" on public.love_pet for update to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));

create policy "games read" on public.games for select to authenticated using (public.is_couple_member(couple_id));
create policy "games create" on public.games for insert to authenticated with check (public.is_couple_member(couple_id) and created_by = auth.uid());
create policy "games update" on public.games for update to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "games delete" on public.games for delete to authenticated using (public.is_couple_member(couple_id));

create policy "memories read" on public.memories for select to authenticated using (public.is_couple_member(couple_id));
create policy "memories create" on public.memories for insert to authenticated with check (public.is_couple_member(couple_id) and author_id = auth.uid());
create policy "own memories delete" on public.memories for delete to authenticated using (public.is_couple_member(couple_id) and author_id = auth.uid());
create policy "bucket read" on public.bucket_list for select to authenticated using (public.is_couple_member(couple_id));
create policy "bucket create" on public.bucket_list for insert to authenticated with check (public.is_couple_member(couple_id) and created_by = auth.uid());
create policy "bucket update" on public.bucket_list for update to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy "bucket delete" on public.bucket_list for delete to authenticated using (public.is_couple_member(couple_id));

create policy "letters read after unlock" on public.love_letters for select to authenticated using (public.is_couple_member(couple_id) and unlock_at <= now());
create policy "letters create" on public.love_letters for insert to authenticated with check (public.is_couple_member(couple_id) and author_id = auth.uid());
create policy "moods read" on public.mood_entries for select to authenticated using (public.is_couple_member(couple_id));
create policy "moods create own" on public.mood_entries for insert to authenticated with check (public.is_couple_member(couple_id) and user_id = auth.uid());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('memories', 'memories', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
create policy "couple members read memories storage" on storage.objects for select to authenticated
using (bucket_id = 'memories' and public.is_couple_member((storage.foldername(name))[1]::uuid));
create policy "couple members upload memories storage" on storage.objects for insert to authenticated
with check (bucket_id = 'memories' and public.is_couple_member((storage.foldername(name))[1]::uuid));
create policy "owners remove own memory files" on storage.objects for delete to authenticated
using (bucket_id = 'memories' and owner_id = auth.uid()::text);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('avatars', 'avatars', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "profile owners upload avatars" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "profile owners update avatars" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "couple can read profile avatars" on storage.objects for select to authenticated
using (bucket_id = 'avatars' and exists (
  select 1 from public.profiles p where p.id::text = (storage.foldername(name))[1]
  and (p.id = auth.uid() or public.is_couple_member(p.couple_id))
));
create policy "profile owners delete avatars" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "couple members read private broadcasts" on realtime.messages for select to authenticated
using (extension = 'broadcast' and exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.couple_id::text = split_part(realtime.topic(), ':', 2)
    and split_part(realtime.topic(), ':', 1) in ('call', 'watch')
));
create policy "couple members send private broadcasts" on realtime.messages for insert to authenticated
with check (extension = 'broadcast' and exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.couple_id::text = split_part(realtime.topic(), ':', 2)
    and split_part(realtime.topic(), ':', 1) in ('call', 'watch')
));

create or replace function public.start_ttt_game(target_couple uuid)
returns public.games language plpgsql security definer set search_path = public
as $$
declare created_game public.games;
begin
  if not public.is_couple_member(target_couple) then raise exception 'Not a member of this couple'; end if;
  insert into public.games(couple_id, game_type, state, status, created_by)
  values(target_couple, 'tic-tac-toe', jsonb_build_object(
    'board', jsonb_build_array('', '', '', '', '', '', '', '', ''),
    'player_x', auth.uid(), 'player_o', null, 'turn', 'x', 'winner', null
  ), 'waiting', auth.uid()) returning * into created_game;
  return created_game;
end $$;

create or replace function public.join_ttt_game(target_game uuid)
returns public.games language plpgsql security definer set search_path = public
as $$
declare current_game public.games; updated_game public.games; current_state jsonb;
begin
  select * into current_game from public.games where id = target_game for update;
  if current_game.id is null or current_game.game_type <> 'tic-tac-toe' then raise exception 'Game not found'; end if;
  if not public.is_couple_member(current_game.couple_id) then raise exception 'Not a member of this couple'; end if;
  current_state := current_game.state;
  if current_state->>'player_x' = auth.uid()::text then raise exception 'The creator is already in this game'; end if;
  if current_state->>'player_o' is not null and current_state->>'player_o' <> auth.uid()::text then raise exception 'Game is full'; end if;
  current_state := jsonb_set(current_state, '{player_o}', to_jsonb(auth.uid()::text), true);
  update public.games set state = current_state, status = 'active', updated_at = now()
    where id = target_game returning * into updated_game;
  return updated_game;
end $$;

create or replace function public.make_ttt_move(target_game uuid, cell_index integer)
returns public.games language plpgsql security definer set search_path = public
as $$
declare current_game public.games; updated_game public.games; current_state jsonb;
board text[]; mark text; next_mark text; victor text; pos integer;
begin
  if cell_index < 0 or cell_index > 8 then raise exception 'Invalid cell'; end if;
  select * into current_game from public.games where id = target_game for update;
  if current_game.id is null or current_game.game_type <> 'tic-tac-toe' then raise exception 'Game not found'; end if;
  if not public.is_couple_member(current_game.couple_id) then raise exception 'Not a member of this couple'; end if;
  current_state := current_game.state;
  mark := current_state->>'turn';
  if current_game.status <> 'active' then raise exception 'Game is not active'; end if;
  if (mark = 'x' and current_state->>'player_x' <> auth.uid()::text) or (mark = 'o' and current_state->>'player_o' <> auth.uid()::text) then
    raise exception 'It is not your turn';
  end if;
  select array_agg(value order by ord) into board from jsonb_array_elements_text(current_state->'board') with ordinality as cells(value, ord);
  pos := cell_index + 1;
  if board[pos] <> '' then raise exception 'Cell is already taken'; end if;
  board[pos] := mark;
  victor := null;
  if (board[1] <> '' and board[1] = board[2] and board[2] = board[3]) or
     (board[4] <> '' and board[4] = board[5] and board[5] = board[6]) or
     (board[7] <> '' and board[7] = board[8] and board[8] = board[9]) or
     (board[1] <> '' and board[1] = board[4] and board[4] = board[7]) or
     (board[2] <> '' and board[2] = board[5] and board[5] = board[8]) or
     (board[3] <> '' and board[3] = board[6] and board[6] = board[9]) or
     (board[1] <> '' and board[1] = board[5] and board[5] = board[9]) or
     (board[3] <> '' and board[3] = board[5] and board[5] = board[7]) then victor := mark; end if;
  next_mark := case when mark = 'x' then 'o' else 'x' end;
  current_state := jsonb_set(current_state, '{board}', to_jsonb(board), true);
  current_state := jsonb_set(current_state, '{turn}', to_jsonb(next_mark), true);
  current_state := jsonb_set(current_state, '{winner}', coalesce(to_jsonb(victor), 'null'::jsonb), true);
  update public.games set state = current_state,
    status = case when victor is not null or not ('' = any(board)) then 'finished' else 'active' end,
    updated_at = now() where id = target_game returning * into updated_game;
  return updated_game;
end $$;

create or replace function public.restart_ttt_game(target_game uuid)
returns public.games language plpgsql security definer set search_path = public
as $$
declare current_game public.games; updated_game public.games;
begin
  select * into current_game from public.games where id = target_game for update;
  if current_game.id is null or current_game.game_type <> 'tic-tac-toe' then raise exception 'Game not found'; end if;
  if not public.is_couple_member(current_game.couple_id) then raise exception 'Not a member of this couple'; end if;
  update public.games set state = jsonb_build_object(
    'board', jsonb_build_array('', '', '', '', '', '', '', '', ''),
    'player_x', current_game.state->'player_x', 'player_o', current_game.state->'player_o',
    'turn', 'x', 'winner', null
  ), status = case when current_game.state->>'player_o' is null then 'waiting' else 'active' end,
  updated_at = now() where id = target_game returning * into updated_game;
  return updated_game;
end $$;

grant execute on function public.start_ttt_game(uuid) to authenticated;
grant execute on function public.join_ttt_game(uuid) to authenticated;
grant execute on function public.make_ttt_move(uuid, integer) to authenticated;
grant execute on function public.restart_ttt_game(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.messages;
  alter publication supabase_realtime add table public.daily_notes;
  alter publication supabase_realtime add table public.love_pet;
  alter publication supabase_realtime add table public.games;
  alter publication supabase_realtime add table public.memories;
  alter publication supabase_realtime add table public.bucket_list;
  alter publication supabase_realtime add table public.love_letters;
  alter publication supabase_realtime add table public.mood_entries;
  alter publication supabase_realtime add table public.profiles;
  alter publication supabase_realtime add table public.couples;
exception when duplicate_object then null;
end $$;