-- Inventario CMV — comprobaciones no destructivas de Fase 4
-- Ejecutar después de phase4.sql.

-- 1. Las RPC de impresión deben existir.
select
  to_regprocedure('public.record_label_print(uuid)') is not null as record_label_print_exists,
  to_regprocedure('public.record_label_batch_print(uuid)') is not null as record_label_batch_print_exists;

-- 2. Resumen de etiquetas y contadores de impresión.
select
  status,
  count(*) as etiquetas,
  coalesce(sum(print_count), 0) as intentos_impresion
from public.asset_labels
group by status
order by status;

-- 3. Ningún código debe estar duplicado.
select code, count(*)
from public.asset_labels
group by code
having count(*) > 1;

-- 4. Una tanda debe conservar rangos consistentes.
select id, quantity, first_number, last_number
from public.label_batches
where last_number - first_number + 1 <> quantity;

-- 5. El rol authenticated ya no debe tener UPDATE directo sobre print_count.
select has_column_privilege('authenticated', 'public.asset_labels', 'print_count', 'UPDATE')
  as authenticated_can_update_print_count_directly;
