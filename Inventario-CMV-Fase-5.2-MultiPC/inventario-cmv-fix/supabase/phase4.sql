-- Inventario CMV — Fase 4
-- Control trazable de impresión de etiquetas.
-- Requiere phase1.sql + phase2.sql.
-- Ejecutar una sola vez después de phase2.sql.

begin;

-- Registra un intento de impresión individual. Una etiqueta anulada no puede imprimirse.
create or replace function public.record_label_print(
  p_label_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.label_status;
begin
  if not public.can_manage_inventory() then
    raise exception 'No autorizado para imprimir etiquetas.';
  end if;

  select status
    into v_status
  from public.asset_labels
  where id = p_label_id
  for update;

  if not found then
    raise exception 'Etiqueta no encontrada.';
  end if;

  if v_status = 'voided' then
    raise exception 'Una etiqueta anulada no puede imprimirse.';
  end if;

  update public.asset_labels
  set print_count = print_count + 1
  where id = p_label_id;
end;
$$;

revoke all on function public.record_label_print(uuid) from public;
grant execute on function public.record_label_print(uuid) to authenticated;

-- Registra un intento de impresión de tanda e incrementa el contador de todas
-- sus etiquetas disponibles. Las asignadas se reimprimen individualmente y las
-- anuladas nunca se imprimen.
create or replace function public.record_label_batch_print(
  p_batch_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.can_manage_inventory() then
    raise exception 'No autorizado para imprimir tandas de etiquetas.';
  end if;

  perform 1
  from public.label_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'Tanda de etiquetas no encontrada.';
  end if;

  select count(*)::integer
    into v_count
  from public.asset_labels
  where batch_id = p_batch_id
    and status = 'available';

  if v_count = 0 then
    raise exception 'La tanda no tiene etiquetas disponibles para imprimir.';
  end if;

  update public.label_batches
  set print_count = print_count + 1,
      last_printed_at = now(),
      last_printed_by = auth.uid()
  where id = p_batch_id;

  update public.asset_labels
  set print_count = print_count + 1
  where batch_id = p_batch_id
    and status = 'available';

  return v_count;
end;
$$;

revoke all on function public.record_label_batch_print(uuid) from public;
grant execute on function public.record_label_batch_print(uuid) to authenticated;

-- Desde esta fase la impresión se registra exclusivamente mediante RPC.
-- Esto impide que el navegador pueda escribir contadores arbitrarios.
revoke update (print_count, last_printed_at, last_printed_by)
on public.asset_labels
from authenticated;

commit;
