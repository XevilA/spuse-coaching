-- Fix infinite recursion in group_members RLS by replacing self-referential subqueries with SECURITY DEFINER helpers

-- 1) Helper function to check leader status without RLS recursion
create or replace function public.is_group_leader(_user_id uuid, _group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where student_id = _user_id
      and group_id = _group_id
      and is_leader = true
  );
$$;

-- get_user_group_id already exists per project config, but ensure correct definer & search_path
create or replace function public.get_user_group_id(user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select group_id
  from public.group_members
  where student_id = get_user_group_id.user_id
  limit 1;
$$;

-- 2) Replace problematic policies on group_members
-- Note: Using IF EXISTS to avoid errors on repeated runs

-- INSERT (leaders can add members)
drop policy if exists "Group leaders can add members" on public.group_members;
create policy "Group leaders can add members"
on public.group_members
for insert
with check (
  public.is_group_leader(auth.uid(), group_id)
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'super_admin')
);

-- DELETE (leaders can remove members)
drop policy if exists "Group leaders can remove members" on public.group_members;
create policy "Group leaders can remove members"
on public.group_members
for delete
using (
  public.is_group_leader(auth.uid(), group_id)
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'super_admin')
);

-- SELECT (leaders can view their members)
drop policy if exists "Group leaders can view their group members" on public.group_members;
create policy "Group leaders can view their group members"
on public.group_members
for select
using (
  auth.uid() = student_id
  or public.is_group_leader(auth.uid(), group_id)
  or public.has_role(auth.uid(), 'teacher')
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'super_admin')
);

-- SELECT (students can view members of their group)
drop policy if exists "Students can view group members" on public.group_members;
create policy "Students can view group members"
on public.group_members
for select
using (
  auth.uid() = student_id
  or group_id = public.get_user_group_id(auth.uid())
  or public.has_role(auth.uid(), 'teacher')
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'super_admin')
);
