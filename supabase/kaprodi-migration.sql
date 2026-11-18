-- Jalankan file SQL ini di Supabase Dashboard -> SQL Editor

-- 1. Tabel role pengguna (hanya dapat dibaca oleh pemilik; diubah via SQL Editor/admin)
create table if not exists public.gradpath_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'kaprodi')),
  created_at timestamptz not null default now()
);

alter table public.gradpath_roles enable row level security;
grant select on public.gradpath_roles to authenticated;

drop policy if exists "Users can read own role" on public.gradpath_roles;
create policy "Users can read own role"
  on public.gradpath_roles for select
  using (auth.uid() = user_id);

drop policy if exists "Kaprodi can read roles" on public.gradpath_roles;
create policy "Kaprodi can read roles"
  on public.gradpath_roles for select
  using (public.is_kaprodi());

-- 2. Helper untuk mengecek apakah user saat ini adalah Kaprodi
create or replace function public.is_kaprodi()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gradpath_roles
    where user_id = auth.uid()
      and role = 'kaprodi'
  );
$$;

grant execute on function public.is_kaprodi() to authenticated;

-- 3. Izinkan Kaprodi membaca profil & rencana mahasiswa (read-only)
drop policy if exists "Kaprodi can view all profiles" on public.gradpath_profiles;
create policy "Kaprodi can view all profiles"
  on public.gradpath_profiles for select
  using (public.is_kaprodi());

drop policy if exists "Kaprodi can view all plans" on public.gradpath_plans;
create policy "Kaprodi can view all plans"
  on public.gradpath_plans for select
  using (public.is_kaprodi());

-- 4. Tabel masukan Kaprodi -> Notifikasi Mahasiswa
create table if not exists public.gradpath_feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  kaprodi_id uuid not null references auth.users(id) on delete cascade,
  kaprodi_name text not null,
  plan_id uuid references public.gradpath_plans(id) on delete set null,
  plan_name text,
  message text not null check (char_length(trim(message)) between 1 and 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists gradpath_feedback_student_idx
  on public.gradpath_feedback(student_id, created_at desc);

alter table public.gradpath_feedback enable row level security;
grant select, insert, update on public.gradpath_feedback to authenticated;

drop policy if exists "Students and kaprodi can view feedback" on public.gradpath_feedback;
create policy "Students and kaprodi can view feedback"
  on public.gradpath_feedback for select
  using (auth.uid() = student_id or public.is_kaprodi());

drop policy if exists "Students can mark own feedback read" on public.gradpath_feedback;
create policy "Students can mark own feedback read"
  on public.gradpath_feedback for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

drop policy if exists "Kaprodi can insert feedback" on public.gradpath_feedback;
create policy "Kaprodi can insert feedback"
  on public.gradpath_feedback for insert
  with check (public.is_kaprodi() and auth.uid() = kaprodi_id);

-- 5. Jadikan akun tertentu sebagai Kaprodi (ganti email sesuai akun Kaprodi lalu jalankan):
-- insert into public.gradpath_roles (user_id, role)
-- select id, 'kaprodi' from auth.users where email = 'olanrantung@gmail.com'
-- on conflict (user_id) do update set role = 'kaprodi';
