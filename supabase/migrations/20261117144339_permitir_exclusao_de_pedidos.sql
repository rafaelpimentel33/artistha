begin;

grant delete on table public.shop_orders to authenticated;

create policy shop_orders_delete on public.shop_orders
for delete to authenticated
using ((select shop_private.is_admin()));

commit;
