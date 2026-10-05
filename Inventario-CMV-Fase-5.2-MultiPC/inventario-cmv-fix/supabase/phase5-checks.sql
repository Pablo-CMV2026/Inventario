-- Inventario CMV — comprobaciones no destructivas de Fase 5
-- Fase 5 no agrega una migración: reutiliza attachments + Storage creados en phase2.sql.

-- 1. El bucket debe existir y ser privado, con límite de 10 MB.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'inventory-files';

-- 2. Deben existir políticas de lectura/escritura para el bucket privado.
select policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'Inventario CMV%'
order by policyname;

-- 3. No deben existir rutas de archivo duplicadas en metadatos.
select storage_path, count(*)
from public.attachments
group by storage_path
having count(*) > 1;

-- 4. Las fotografías activas deben estar asociadas a un bien y ser JPG/PNG.
select id, asset_id, mime_type, storage_path
from public.attachments
where kind = 'photo'
  and is_active = true
  and (asset_id is null or mime_type not in ('image/jpeg', 'image/png'));

-- 5. Resumen práctico de bienes con y sin fotografía activa.
select
  count(*) filter (where exists (
    select 1 from public.attachments a
    where a.asset_id = b.id and a.kind = 'photo' and a.is_active = true
  )) as bienes_con_foto,
  count(*) filter (where not exists (
    select 1 from public.attachments a
    where a.asset_id = b.id and a.kind = 'photo' and a.is_active = true
  )) as bienes_sin_foto
from public.assets b
where b.lifecycle_status = 'active';
