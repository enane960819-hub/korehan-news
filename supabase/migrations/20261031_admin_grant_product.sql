-- auto-apply
-- Admin test grants for the Special shop (owner 2026-10-31): the admin can take any product
-- (draft or on sale) without paying, and take it back again to re-test. Each grant is a
-- normal cash_orders row with amount 0 (so sales totals skip it) granted by kh_grant_cash_order;
-- the reset revokes the admin's 0-amount orders for that product with kh_revoke_cash_order.
-- Only is_admin_email() passes. Idempotent.
create or replace function public.kh_admin_grant_product(p_product text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  p public.cash_products%rowtype;
  v_id uuid;
begin
  if not coalesce(public.is_admin_email(), false) then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  select * into p from public.cash_products where id = p_product;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_PRODUCT'); end if;
  insert into public.cash_orders (user_id, product_id, items, amount_cents, currency)
  values (auth.uid(), p.id, p.items, 0, 'usd') returning id into v_id;
  return public.kh_grant_cash_order(v_id);
end;
$function$;

create or replace function public.kh_admin_reset_product(p_product text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o record;
  n int := 0;
begin
  if not coalesce(public.is_admin_email(), false) then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  for o in select id from public.cash_orders
            where user_id = auth.uid() and product_id = p_product and status = 'paid' and amount_cents = 0 loop
    perform public.kh_revoke_cash_order(o.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'reset', n);
end;
$function$;

revoke execute on function public.kh_admin_grant_product(text) from public, anon;
revoke execute on function public.kh_admin_reset_product(text) from public, anon;
grant execute on function public.kh_admin_grant_product(text) to authenticated;
grant execute on function public.kh_admin_reset_product(text) to authenticated;
