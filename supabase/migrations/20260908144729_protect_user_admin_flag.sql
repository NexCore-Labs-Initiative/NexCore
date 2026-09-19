-- Preserve profile editing while preventing client self-promotion.
begin;
create function public.protect_users_admin_flag() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') then
    if (tg_op = 'INSERT' and coalesce(new.is_admin,false)) then
      raise exception 'admin_flag_is_managed_by_server' using errcode='42501';
    elsif tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
      raise exception 'admin_flag_is_managed_by_server' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.protect_users_admin_flag() from public, anon, authenticated;
create trigger protect_users_admin_flag before insert or update on public.users
  for each row execute function public.protect_users_admin_flag();
commit;
