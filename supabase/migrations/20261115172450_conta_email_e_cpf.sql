begin;

create extension if not exists pgcrypto with schema extensions;

create table shop_private.customer_cpf_key (
  singleton boolean primary key default true check (singleton),
  secret bytea not null check (octet_length(secret) = 32)
);
create table shop_private.customer_cpf (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fingerprint bytea not null unique check (octet_length(fingerprint) = 32),
  last_digits text not null check (last_digits ~ '^[0-9]{2}$')
);
alter table shop_private.customer_cpf_key enable row level security;
alter table shop_private.customer_cpf enable row level security;
revoke all on table shop_private.customer_cpf_key, shop_private.customer_cpf from public, anon, authenticated;
insert into shop_private.customer_cpf_key (secret) values (extensions.gen_random_bytes(32));

create function shop_private.customer_profile() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', coalesce(p.name, ''),
    'email', case when u.email like 'shop-%@accounts.example.com' then coalesce(p.email, '') else u.email end,
    'phone', coalesce(p.phone, ''),
    'cep', coalesce(p.cep, ''),
    'cpfLastDigits', ident.last_digits
  )
  from auth.users u
  left join public.shop_profiles p on p.user_id = u.id
  left join shop_private.customer_cpf ident on ident.user_id = u.id
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null and u.email is not null;
$$;

create function shop_private.save_customer_profile(
  p_name text, p_email text, p_phone text, p_cep text, p_cpf text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  customer uuid := auth.uid();
  verified_email text;
  profile_email text;
  first_digit integer;
  second_digit integer;
begin
  if customer is null then raise exception 'login_required'; end if;
  select email into verified_email from auth.users
    where id = customer and email_confirmed_at is not null;
  if verified_email is null then raise exception 'login_required'; end if;

  profile_email := case when verified_email like 'shop-%@accounts.example.com' then trim(p_email) else verified_email end;
  if p_name is null or char_length(trim(p_name)) > 100
    or (verified_email not like 'shop-%@accounts.example.com' and char_length(trim(p_name)) < 2)
    or profile_email is null or char_length(profile_email) > 180
    or (profile_email <> '' and profile_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
    or p_phone is null or p_phone !~ '^[0-9+() -]{0,24}$'
    or p_cep is null or (p_cep <> '' and p_cep !~ '^[0-9]{8}$')
  then raise exception 'invalid_profile'; end if;

  if p_cpf is not null then
    if p_cpf !~ '^[0-9]{11}$' or p_cpf = repeat(left(p_cpf, 1), 11) then
      raise exception 'invalid_cpf';
    end if;
    select ((sum(substring(p_cpf, n, 1)::integer * (11 - n)) * 10) % 11) % 10
      into first_digit from generate_series(1, 9) n;
    select ((sum(substring(p_cpf, n, 1)::integer * (12 - n)) * 10) % 11) % 10
      into second_digit from generate_series(1, 10) n;
    if first_digit <> substring(p_cpf, 10, 1)::integer or second_digit <> substring(p_cpf, 11, 1)::integer then
      raise exception 'invalid_cpf';
    end if;
    begin
      insert into shop_private.customer_cpf (user_id, fingerprint, last_digits)
        select customer, extensions.hmac(convert_to(p_cpf, 'UTF8'), secret, 'sha256'), right(p_cpf, 2)
        from shop_private.customer_cpf_key where singleton
        on conflict (user_id) do update set fingerprint = excluded.fingerprint, last_digits = excluded.last_digits;
    exception when unique_violation then
      raise exception 'cpf_em_uso';
    end;
  end if;

  insert into public.shop_profiles (user_id, name, email, phone, cep)
    values (customer, trim(p_name), profile_email, p_phone, p_cep)
    on conflict (user_id) do update set
      name = excluded.name, email = excluded.email, phone = excluded.phone, cep = excluded.cep;

  return shop_private.customer_profile();
end;
$$;

create function public.shop_customer_profile() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select shop_private.customer_profile() $$;

create function public.shop_save_customer_profile(
  p_name text, p_email text, p_phone text, p_cep text, p_cpf text
) returns jsonb
language sql security invoker set search_path = ''
as $$ select shop_private.save_customer_profile(p_name, p_email, p_phone, p_cep, p_cpf) $$;

revoke all on function shop_private.customer_profile(), public.shop_customer_profile()
  from public, anon, authenticated;
revoke all on function shop_private.save_customer_profile(text, text, text, text, text),
  public.shop_save_customer_profile(text, text, text, text, text) from public, anon, authenticated;
grant execute on function shop_private.customer_profile(), public.shop_customer_profile(),
  shop_private.save_customer_profile(text, text, text, text, text),
  public.shop_save_customer_profile(text, text, text, text, text) to authenticated;

commit;
