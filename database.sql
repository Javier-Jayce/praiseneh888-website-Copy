-- Run this whole script in Supabase > SQL Editor > New query.
create table if not exists public.amulets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  master text,
  category text,
  description text,
  price_mode text not null default 'pm' check (price_mode in ('price','pm')),
  price numeric(10,2),
  status text not null default 'available' check (status in ('available','reserved','sold')),
  images text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.amulets enable row level security;
drop policy if exists "Public can view catalogue" on public.amulets;
create policy "Public can view catalogue" on public.amulets for select using (true);
drop policy if exists "Authenticated admins can insert" on public.amulets;
create policy "Authenticated admins can insert" on public.amulets for insert to authenticated with check (true);
drop policy if exists "Authenticated admins can update" on public.amulets;
create policy "Authenticated admins can update" on public.amulets for update to authenticated using (true) with check (true);
drop policy if exists "Authenticated admins can delete" on public.amulets;
create policy "Authenticated admins can delete" on public.amulets for delete to authenticated using (true);

-- Public image bucket. Upload, update and delete are restricted to signed-in users.
insert into storage.buckets (id, name, public) values ('amulet-photos','amulet-photos',true)
on conflict (id) do update set public=true;
drop policy if exists "Public can view amulet photos" on storage.objects;
create policy "Public can view amulet photos" on storage.objects for select using (bucket_id='amulet-photos');
drop policy if exists "Admins can upload amulet photos" on storage.objects;
create policy "Admins can upload amulet photos" on storage.objects for insert to authenticated with check (bucket_id='amulet-photos');
drop policy if exists "Admins can update amulet photos" on storage.objects;
create policy "Admins can update amulet photos" on storage.objects for update to authenticated using (bucket_id='amulet-photos') with check (bucket_id='amulet-photos');
drop policy if exists "Admins can delete amulet photos" on storage.objects;
create policy "Admins can delete amulet photos" on storage.objects for delete to authenticated using (bucket_id='amulet-photos');
