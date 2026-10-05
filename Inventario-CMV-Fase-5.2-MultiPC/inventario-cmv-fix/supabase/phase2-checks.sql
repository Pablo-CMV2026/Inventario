-- Inventario CMV — Fase 2
-- Consultas de verificación no destructivas para ejecutar después de phase2.sql.

-- 1. Tablas esperadas
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'categories', 'locations', 'custodians', 'funding_sources',
    'label_batches', 'asset_labels', 'assets', 'acquisitions',
    'acquisition_items', 'asset_movements', 'verification_sessions',
    'verification_items', 'attachments', 'audit_log'
  )
order by table_name;

-- 2. RLS habilitado
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'categories', 'locations', 'custodians', 'funding_sources',
    'label_batches', 'asset_labels', 'assets', 'acquisitions',
    'acquisition_items', 'asset_movements', 'verification_sessions',
    'verification_items', 'attachments', 'audit_log'
  )
order by c.relname;

-- 3. Funciones atómicas esperadas
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('create_label_batch', 'void_label', 'register_asset_from_label')
order by routine_name;

-- 4. Bucket privado
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'inventory-files';

-- 5. La vista principal debe existir
select table_name
from information_schema.views
where table_schema = 'public'
  and table_name = 'v_assets_current';

-- 6. Resumen de políticas RLS
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname in ('public', 'storage')
  and (
    tablename in (
      'categories', 'locations', 'custodians', 'funding_sources',
      'label_batches', 'asset_labels', 'assets', 'acquisitions',
      'acquisition_items', 'asset_movements', 'verification_sessions',
      'verification_items', 'attachments', 'audit_log'
    )
    or (schemaname = 'storage' and tablename = 'objects')
  )
order by schemaname, tablename, policyname;
