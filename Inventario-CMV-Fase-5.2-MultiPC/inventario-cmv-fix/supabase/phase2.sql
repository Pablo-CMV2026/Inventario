-- Inventario CMV — Fase 2
-- Modelo de datos, integridad, trazabilidad y permisos del inventario.
-- Requiere haber ejecutado previamente supabase/phase1.sql.
--
-- Principio rector:
--   Los registros históricos no se eliminan. Cambian de estado o se desactivan.
--   Los códigos CMV son permanentes y nunca se reutilizan.

begin;

-- ============================================================
-- 1. ENUMS DE DOMINIO
-- ============================================================

create type public.label_status as enum ('available', 'assigned', 'voided');
create type public.asset_condition as enum ('good', 'worn', 'damaged');
create type public.asset_operational_status as enum ('in_use', 'stored', 'loaned', 'in_repair', 'not_located');
create type public.asset_lifecycle_status as enum ('active', 'disposed');
create type public.asset_origin as enum ('purchase', 'donation', 'loan_comodato', 'transfer', 'historical_unknown');
create type public.asset_owner_type as enum ('corporation', 'school', 'third_party', 'other', 'unknown');
create type public.movement_type as enum (
  'initial_registration',
  'transfer',
  'loan_out',
  'loan_return',
  'repair_out',
  'repair_return',
  'marked_not_located',
  'located',
  'disposed'
);
create type public.verification_session_status as enum ('open', 'closed', 'cancelled');
create type public.verification_result as enum ('pending', 'verified_expected', 'found_other_location', 'not_verified');
create type public.attachment_kind as enum ('photo', 'document');

-- ============================================================
-- 2. HELPERS DE AUTORIZACIÓN
-- ============================================================

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.can_manage_inventory()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('superadmin', 'inventory_admin'), false);
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'superadmin', false);
$$;

revoke all on function public.is_active_user() from public;
revoke all on function public.can_manage_inventory() from public;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.can_manage_inventory() to authenticated;
grant execute on function public.is_superadmin() to authenticated;

-- ============================================================
-- 3. TABLAS CONFIGURABLES
-- ============================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles(id) on delete restrict,
  deactivation_reason text,
  constraint categories_deactivation_consistency check (
    (is_active = true and deactivated_at is null and deactivated_by is null)
    or
    (is_active = false and deactivated_at is not null and deactivated_by is not null)
  )
);

create unique index categories_name_unique_ci on public.categories (lower(trim(name)));

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  parent_id uuid references public.locations(id) on delete restrict,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles(id) on delete restrict,
  deactivation_reason text,
  constraint locations_not_own_parent check (parent_id is null or parent_id <> id),
  constraint locations_deactivation_consistency check (
    (is_active = true and deactivated_at is null and deactivated_by is null)
    or
    (is_active = false and deactivated_at is not null and deactivated_by is not null)
  )
);

create unique index locations_root_name_unique_ci
  on public.locations (lower(trim(name)))
  where parent_id is null;
create unique index locations_child_name_unique_ci
  on public.locations (parent_id, lower(trim(name)))
  where parent_id is not null;

create table public.custodians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  email text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles(id) on delete restrict,
  deactivation_reason text,
  constraint custodians_deactivation_consistency check (
    (is_active = true and deactivated_at is null and deactivated_by is null)
    or
    (is_active = false and deactivated_at is not null and deactivated_by is not null)
  )
);

create index custodians_name_idx on public.custodians (lower(full_name));

create table public.funding_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles(id) on delete restrict,
  deactivation_reason text,
  constraint funding_sources_deactivation_consistency check (
    (is_active = true and deactivated_at is null and deactivated_by is null)
    or
    (is_active = false and deactivated_at is not null and deactivated_by is not null)
  )
);

create unique index funding_sources_name_unique_ci on public.funding_sources (lower(trim(name)));

-- ============================================================
-- 4. ETIQUETAS Y TANDAS
-- ============================================================

create table public.system_counters (
  counter_key text primary key,
  next_value bigint not null check (next_value > 0),
  updated_at timestamptz not null default now()
);

insert into public.system_counters (counter_key, next_value)
values ('asset_label_number', 1);

-- Tabla técnica: no se expone al cliente.
revoke all on table public.system_counters from anon, authenticated;

create table public.label_batches (
  id uuid primary key default gen_random_uuid(),
  quantity integer not null check (quantity > 0),
  first_number bigint not null check (first_number > 0),
  last_number bigint not null check (last_number >= first_number),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  print_count integer not null default 0 check (print_count >= 0),
  last_printed_at timestamptz,
  last_printed_by uuid references public.profiles(id) on delete restrict,
  constraint label_batches_range_matches_quantity check (last_number - first_number + 1 = quantity)
);

create table public.asset_labels (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.label_batches(id) on delete restrict,
  sequence_number bigint not null unique check (sequence_number > 0),
  code text not null unique,
  status public.label_status not null default 'available',
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete restrict,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete restrict,
  void_reason text,
  print_count integer not null default 0 check (print_count >= 0),
  last_printed_at timestamptz,
  last_printed_by uuid references public.profiles(id) on delete restrict,
  constraint asset_labels_code_format check (code ~ '^CMV-[0-9]{6,}$'),
  constraint asset_labels_code_matches_sequence check (code = 'CMV-' || lpad(sequence_number::text, 6, '0')),
  constraint asset_labels_status_consistency check (
    (status = 'available' and assigned_at is null and assigned_by is null and voided_at is null and voided_by is null and void_reason is null)
    or
    (status = 'assigned' and assigned_at is not null and assigned_by is not null and voided_at is null and voided_by is null and void_reason is null)
    or
    (status = 'voided' and assigned_at is null and assigned_by is null and voided_at is not null and voided_by is not null and coalesce(length(trim(void_reason)), 0) > 0)
  )
);

create index asset_labels_status_idx on public.asset_labels (status);
create index asset_labels_batch_idx on public.asset_labels (batch_id);

-- ============================================================
-- 5. BIENES
-- ============================================================

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null unique references public.asset_labels(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  description text,
  category_id uuid not null references public.categories(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  custodian_id uuid references public.custodians(id) on delete restrict,
  physical_condition public.asset_condition not null,
  operational_status public.asset_operational_status not null default 'in_use',
  lifecycle_status public.asset_lifecycle_status not null default 'active',
  brand text,
  model text,
  serial_number text,
  owner_type public.asset_owner_type not null default 'corporation',
  owner_name text,
  origin public.asset_origin not null default 'historical_unknown',
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  last_verified_at timestamptz,
  last_verified_by uuid references public.profiles(id) on delete restrict,
  disposed_at timestamptz,
  disposed_by uuid references public.profiles(id) on delete restrict,
  disposal_reason text,
  constraint assets_owner_consistency check (
    owner_type not in ('third_party', 'other')
    or (owner_name is not null and length(trim(owner_name)) > 0)
  ),
  constraint assets_lifecycle_consistency check (
    (lifecycle_status = 'active' and disposed_at is null and disposed_by is null and disposal_reason is null)
    or
    (lifecycle_status = 'disposed' and disposed_at is not null and disposed_by is not null and coalesce(length(trim(disposal_reason)), 0) > 0)
  )
);

create index assets_category_idx on public.assets (category_id);
create index assets_location_idx on public.assets (location_id);
create index assets_custodian_idx on public.assets (custodian_id);
create index assets_lifecycle_idx on public.assets (lifecycle_status);
create index assets_operational_idx on public.assets (operational_status);
create index assets_name_idx on public.assets (lower(name));
create index assets_serial_idx on public.assets (lower(serial_number)) where serial_number is not null;

-- ============================================================
-- 6. ADQUISICIONES
-- ============================================================

create table public.acquisitions (
  id uuid primary key default gen_random_uuid(),
  supplier_name text,
  acquisition_date date,
  document_type text,
  document_number text,
  total_paid_clp bigint check (total_paid_clp is null or total_paid_clp >= 0),
  funding_source_id uuid references public.funding_sources(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict
);

create index acquisitions_document_idx on public.acquisitions (lower(document_type), lower(document_number));
create index acquisitions_date_idx on public.acquisitions (acquisition_date);

create table public.acquisition_items (
  id uuid primary key default gen_random_uuid(),
  acquisition_id uuid not null references public.acquisitions(id) on delete restrict,
  asset_id uuid not null unique references public.assets(id) on delete restrict,
  individual_value_clp bigint check (individual_value_clp is null or individual_value_clp >= 0),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict
);

create index acquisition_items_acquisition_idx on public.acquisition_items (acquisition_id);

-- ============================================================
-- 7. MOVIMIENTOS
-- ============================================================

create table public.asset_movements (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  movement_type public.movement_type not null,
  event_at timestamptz not null default now(),
  from_location_id uuid references public.locations(id) on delete restrict,
  to_location_id uuid references public.locations(id) on delete restrict,
  from_custodian_id uuid references public.custodians(id) on delete restrict,
  to_custodian_id uuid references public.custodians(id) on delete restrict,
  from_operational_status public.asset_operational_status,
  to_operational_status public.asset_operational_status,
  reason text not null check (length(trim(reason)) > 0),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict
);

create index asset_movements_asset_date_idx on public.asset_movements (asset_id, event_at desc);
create index asset_movements_type_idx on public.asset_movements (movement_type);

-- ============================================================
-- 8. VERIFICACIONES / RECORRIDOS
-- ============================================================

create table public.verification_sessions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete restrict,
  status public.verification_session_status not null default 'open',
  expected_count integer not null default 0 check (expected_count >= 0),
  started_at timestamptz not null default now(),
  started_by uuid not null references public.profiles(id) on delete restrict,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete restrict,
  notes text,
  constraint verification_sessions_status_consistency check (
    (status = 'open' and closed_at is null and closed_by is null)
    or
    (status in ('closed', 'cancelled') and closed_at is not null and closed_by is not null)
  )
);

create index verification_sessions_location_date_idx on public.verification_sessions (location_id, started_at desc);
create index verification_sessions_status_idx on public.verification_sessions (status);

create table public.verification_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.verification_sessions(id) on delete restrict,
  asset_id uuid not null references public.assets(id) on delete restrict,
  was_expected boolean not null,
  registered_location_id uuid not null references public.locations(id) on delete restrict,
  observed_location_id uuid references public.locations(id) on delete restrict,
  result public.verification_result not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  unique (session_id, asset_id),
  constraint verification_items_result_consistency check (
    (result in ('pending', 'not_verified') and verified_at is null and verified_by is null)
    or
    (result in ('verified_expected', 'found_other_location') and verified_at is not null and verified_by is not null and observed_location_id is not null)
  )
);

create index verification_items_session_result_idx on public.verification_items (session_id, result);
create index verification_items_asset_idx on public.verification_items (asset_id);

-- ============================================================
-- 9. ARCHIVOS Y FOTOGRAFÍAS
-- ============================================================

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  kind public.attachment_kind not null,
  asset_id uuid references public.assets(id) on delete restrict,
  acquisition_id uuid references public.acquisitions(id) on delete restrict,
  movement_id uuid references public.asset_movements(id) on delete restrict,
  storage_bucket text not null default 'inventory-files',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles(id) on delete restrict,
  deactivation_reason text,
  constraint attachments_exactly_one_parent check (num_nonnulls(asset_id, acquisition_id, movement_id) = 1),
  constraint attachments_kind_mime check (
    (kind = 'photo' and mime_type in ('image/jpeg', 'image/png'))
    or
    (kind = 'document' and mime_type in ('application/pdf', 'image/jpeg', 'image/png'))
  ),
  constraint attachments_deactivation_consistency check (
    (is_active = true and deactivated_at is null and deactivated_by is null)
    or
    (is_active = false and deactivated_at is not null and deactivated_by is not null)
  )
);

create index attachments_asset_idx on public.attachments (asset_id) where asset_id is not null;
create index attachments_acquisition_idx on public.attachments (acquisition_id) where acquisition_id is not null;
create index attachments_movement_idx on public.attachments (movement_id) where movement_id is not null;

-- Bucket privado de archivos de Inventario CMV.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-files',
  'inventory-files',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- 10. AUDITORÍA INMUTABLE
-- ============================================================

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE')),
  changed_at timestamptz not null default now(),
  changed_by uuid references public.profiles(id) on delete restrict,
  changed_fields text[],
  old_data jsonb,
  new_data jsonb
);

create index audit_log_record_idx on public.audit_log (table_name, record_id, changed_at desc);
create index audit_log_actor_idx on public.audit_log (changed_by, changed_at desc);

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id uuid;
  v_changed_fields text[];
begin
  if tg_op = 'INSERT' then
    v_record_id := (to_jsonb(new) ->> 'id')::uuid;
    select array_agg(k.key order by k.key)
      into v_changed_fields
    from jsonb_object_keys(to_jsonb(new)) as k(key);

    insert into public.audit_log (
      table_name, record_id, action, changed_by, changed_fields, old_data, new_data
    ) values (
      tg_table_name, v_record_id, 'INSERT', auth.uid(), v_changed_fields, null, to_jsonb(new)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_record_id := (to_jsonb(new) ->> 'id')::uuid;

    select array_agg(k.key order by k.key)
      into v_changed_fields
    from jsonb_object_keys(to_jsonb(new)) as k(key)
    where (to_jsonb(old) -> k.key) is distinct from (to_jsonb(new) -> k.key);

    if coalesce(array_length(v_changed_fields, 1), 0) > 0 then
      insert into public.audit_log (
        table_name, record_id, action, changed_by, changed_fields, old_data, new_data
      ) values (
        tg_table_name, v_record_id, 'UPDATE', auth.uid(), v_changed_fields, to_jsonb(old), to_jsonb(new)
      );
    end if;
    return new;
  end if;

  raise exception 'Operación de auditoría no soportada: %', tg_op;
end;
$$;

revoke all on function public.audit_row_change() from public;

-- Fuerza la identidad del usuario autenticado en altas realizadas desde la aplicación.
-- Evita que un cliente pueda atribuir una acción a otra persona enviando otro UUID.
create or replace function public.force_created_actor()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'La operación requiere un usuario autenticado.';
  end if;
  new.created_by := auth.uid();
  return new;
end;
$$;

create or replace function public.force_created_and_updated_actor()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'La operación requiere un usuario autenticado.';
  end if;
  new.created_by := auth.uid();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.force_verification_session_actor()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'La operación requiere un usuario autenticado.';
  end if;
  new.started_by := auth.uid();
  return new;
end;
$$;

-- Mantiene automáticamente quién hizo la última edición en tablas que lo requieren.
create or replace function public.touch_updated_actor()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

-- Completa metadatos al desactivar y permite reactivar conservando el cambio en auditoría.
create or replace function public.manage_soft_deactivation()
returns trigger
language plpgsql
as $$
begin
  if old.is_active = true and new.is_active = false then
    new.deactivated_at := now();
    new.deactivated_by := auth.uid();
  elsif old.is_active = false and new.is_active = true then
    new.deactivated_at := null;
    new.deactivated_by := null;
    new.deactivation_reason := null;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 11. REGLAS DE INTEGRIDAD / NO BORRADO
-- ============================================================

create or replace function public.block_hard_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Inventario CMV no permite eliminar registros históricos. Desactive o cambie el estado del registro.';
end;
$$;

create or replace function public.guard_label_transition()
returns trigger
language plpgsql
as $$
begin
  if new.sequence_number <> old.sequence_number
     or new.code <> old.code
     or new.batch_id <> old.batch_id then
    raise exception 'La identidad de una etiqueta CMV es inmutable.';
  end if;

  if old.status = 'assigned' and new.status <> 'assigned' then
    raise exception 'Una etiqueta asignada es permanente y no puede volver a otro estado.';
  end if;

  if old.status = 'voided' and new.status <> 'voided' then
    raise exception 'Una etiqueta anulada nunca puede reutilizarse.';
  end if;

  if new.print_count is distinct from old.print_count then
    if new.print_count < old.print_count then
      raise exception 'El contador de impresión de una etiqueta no puede disminuir.';
    end if;
    new.last_printed_at := now();
    new.last_printed_by := auth.uid();
  end if;

  if old.status = 'available' and new.status = 'assigned' then
    new.assigned_at := coalesce(new.assigned_at, now());
    new.assigned_by := coalesce(new.assigned_by, auth.uid());
    new.voided_at := null;
    new.voided_by := null;
    new.void_reason := null;
  elsif old.status = 'available' and new.status = 'voided' then
    if new.void_reason is null or length(trim(new.void_reason)) = 0 then
      raise exception 'Debe indicar el motivo de anulación de la etiqueta.';
    end if;
    new.voided_at := coalesce(new.voided_at, now());
    new.voided_by := coalesce(new.voided_by, auth.uid());
    new.assigned_at := null;
    new.assigned_by := null;
  end if;

  return new;
end;
$$;

create or replace function public.guard_record_identity()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
     or new.created_at <> old.created_at
     or new.created_by <> old.created_by then
    raise exception 'La identidad y autoría original del registro son inmutables.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_asset_update()
returns trigger
language plpgsql
as $$
declare
  v_transition_allowed boolean := coalesce(current_setting('cmv.allow_asset_state_transition', true), '') = 'on';
begin
  if new.label_id <> old.label_id
     or new.created_at <> old.created_at
     or new.created_by <> old.created_by then
    raise exception 'La identidad y creación de un bien son inmutables.';
  end if;

  if old.lifecycle_status = 'disposed' and new.lifecycle_status <> 'disposed' then
    raise exception 'Un bien dado de baja no puede volver al estado activo.';
  end if;

  if (
    new.location_id is distinct from old.location_id
    or new.custodian_id is distinct from old.custodian_id
    or new.operational_status is distinct from old.operational_status
    or new.lifecycle_status is distinct from old.lifecycle_status
    or new.disposed_at is distinct from old.disposed_at
    or new.disposed_by is distinct from old.disposed_by
    or new.disposal_reason is distinct from old.disposal_reason
    or new.last_verified_at is distinct from old.last_verified_at
    or new.last_verified_by is distinct from old.last_verified_by
  ) and not v_transition_allowed then
    raise exception 'Este cambio operacional debe realizarse mediante una acción trazable del sistema.';
  end if;

  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create or replace function public.guard_verification_session_update()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
     or new.location_id <> old.location_id
     or new.expected_count <> old.expected_count
     or new.started_at <> old.started_at
     or new.started_by <> old.started_by then
    raise exception 'La identidad y alcance inicial de una revisión son inmutables.';
  end if;

  if old.status in ('closed', 'cancelled') and new.status <> old.status then
    raise exception 'Una revisión cerrada o cancelada no puede reabrirse.';
  end if;

  if old.status = 'open' and new.status in ('closed', 'cancelled') then
    new.closed_at := now();
    new.closed_by := auth.uid();
  elsif old.status = new.status then
    new.closed_at := old.closed_at;
    new.closed_by := old.closed_by;
  end if;

  return new;
end;
$$;

create or replace function public.guard_verification_item_update()
returns trigger
language plpgsql
as $$
declare
  v_session_status public.verification_session_status;
begin
  if new.id <> old.id
     or new.session_id <> old.session_id
     or new.asset_id <> old.asset_id
     or new.was_expected <> old.was_expected
     or new.registered_location_id <> old.registered_location_id
     or new.created_at <> old.created_at
     or new.created_by <> old.created_by then
    raise exception 'La identidad y contexto inicial de un ítem de verificación son inmutables.';
  end if;

  select status into v_session_status
  from public.verification_sessions
  where id = old.session_id;

  if v_session_status <> 'open' and (
    new.result is distinct from old.result
    or new.observed_location_id is distinct from old.observed_location_id
    or new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
  ) then
    raise exception 'No se puede alterar el resultado operativo de una revisión cerrada o cancelada.';
  end if;

  if new.result is distinct from old.result then
    if new.result in ('verified_expected', 'found_other_location') then
      new.verified_at := now();
      new.verified_by := auth.uid();
    elsif new.result in ('pending', 'not_verified') then
      new.verified_at := null;
      new.verified_by := null;
      if new.result = 'not_verified' then
        new.observed_location_id := null;
      end if;
    end if;
  end if;

  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.guard_location_cycle()
returns trigger
language plpgsql
as $$
declare
  v_parent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Una dependencia no puede depender de sí misma.';
  end if;

  v_parent := new.parent_id;
  while v_parent is not null loop
    if v_parent = new.id then
      raise exception 'La jerarquía de dependencias no puede contener ciclos.';
    end if;
    select parent_id into v_parent from public.locations where id = v_parent;
  end loop;

  return new;
end;
$$;

create trigger asset_labels_guard_transition
before update on public.asset_labels
for each row execute procedure public.guard_label_transition();

create trigger assets_guard_update
before update on public.assets
for each row execute procedure public.guard_asset_update();

create trigger locations_guard_cycle
before insert or update of parent_id on public.locations
for each row execute procedure public.guard_location_cycle();

-- Actor real en altas: nunca confiar en un UUID enviado por el cliente.
create trigger categories_force_created_actor before insert on public.categories for each row execute procedure public.force_created_actor();
create trigger locations_force_created_actor before insert on public.locations for each row execute procedure public.force_created_actor();
create trigger custodians_force_created_actor before insert on public.custodians for each row execute procedure public.force_created_actor();
create trigger funding_sources_force_created_actor before insert on public.funding_sources for each row execute procedure public.force_created_actor();
create trigger label_batches_force_created_actor before insert on public.label_batches for each row execute procedure public.force_created_actor();
create trigger asset_labels_force_created_actor before insert on public.asset_labels for each row execute procedure public.force_created_actor();
create trigger assets_force_created_and_updated_actor before insert on public.assets for each row execute procedure public.force_created_and_updated_actor();
create trigger acquisitions_force_created_and_updated_actor before insert on public.acquisitions for each row execute procedure public.force_created_and_updated_actor();
create trigger acquisition_items_force_created_and_updated_actor before insert on public.acquisition_items for each row execute procedure public.force_created_and_updated_actor();
create trigger asset_movements_force_created_actor before insert on public.asset_movements for each row execute procedure public.force_created_actor();
create trigger verification_sessions_force_started_actor before insert on public.verification_sessions for each row execute procedure public.force_verification_session_actor();
create trigger verification_items_force_created_and_updated_actor before insert on public.verification_items for each row execute procedure public.force_created_and_updated_actor();
create trigger attachments_force_created_actor before insert on public.attachments for each row execute procedure public.force_created_actor();

create trigger categories_guard_identity before update on public.categories for each row execute procedure public.guard_record_identity();
create trigger locations_guard_identity before update on public.locations for each row execute procedure public.guard_record_identity();
create trigger custodians_guard_identity before update on public.custodians for each row execute procedure public.guard_record_identity();
create trigger funding_sources_guard_identity before update on public.funding_sources for each row execute procedure public.guard_record_identity();
create trigger acquisitions_guard_identity before update on public.acquisitions for each row execute procedure public.guard_record_identity();
create trigger acquisition_items_guard_identity before update on public.acquisition_items for each row execute procedure public.guard_record_identity();
create trigger attachments_guard_identity before update on public.attachments for each row execute procedure public.guard_record_identity();

create trigger verification_sessions_guard_update before update on public.verification_sessions for each row execute procedure public.guard_verification_session_update();
create trigger verification_items_guard_update before update on public.verification_items for each row execute procedure public.guard_verification_item_update();

-- Touch updated_at para tablas editables.
create trigger categories_touch_updated_at before update on public.categories for each row execute procedure public.touch_updated_at();
create trigger locations_touch_updated_at before update on public.locations for each row execute procedure public.touch_updated_at();
create trigger custodians_touch_updated_at before update on public.custodians for each row execute procedure public.touch_updated_at();
create trigger funding_sources_touch_updated_at before update on public.funding_sources for each row execute procedure public.touch_updated_at();
create trigger acquisitions_touch_updated_actor before update on public.acquisitions for each row execute procedure public.touch_updated_actor();
create trigger acquisition_items_touch_updated_actor before update on public.acquisition_items for each row execute procedure public.touch_updated_actor();
create trigger verification_items_touch_updated_actor before update on public.verification_items for each row execute procedure public.touch_updated_actor();

create trigger categories_manage_soft_deactivation before update of is_active on public.categories for each row execute procedure public.manage_soft_deactivation();
create trigger locations_manage_soft_deactivation before update of is_active on public.locations for each row execute procedure public.manage_soft_deactivation();
create trigger custodians_manage_soft_deactivation before update of is_active on public.custodians for each row execute procedure public.manage_soft_deactivation();
create trigger funding_sources_manage_soft_deactivation before update of is_active on public.funding_sources for each row execute procedure public.manage_soft_deactivation();
create trigger attachments_manage_soft_deactivation before update of is_active on public.attachments for each row execute procedure public.manage_soft_deactivation();

-- Ninguna de estas tablas puede eliminarse físicamente desde la aplicación.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'system_counters',
    'categories',
    'locations',
    'custodians',
    'funding_sources',
    'label_batches',
    'asset_labels',
    'assets',
    'acquisitions',
    'acquisition_items',
    'asset_movements',
    'verification_sessions',
    'verification_items',
    'attachments',
    'audit_log'
  ] loop
    execute format(
      'create trigger %I before delete on public.%I for each row execute procedure public.block_hard_delete()',
      t || '_block_delete',
      t
    );
  end loop;
end $$;

-- Auditoría de altas y modificaciones.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'categories',
    'locations',
    'custodians',
    'funding_sources',
    'label_batches',
    'asset_labels',
    'assets',
    'acquisitions',
    'acquisition_items',
    'asset_movements',
    'verification_sessions',
    'verification_items',
    'attachments'
  ] loop
    execute format(
      'create trigger %I after insert or update on public.%I for each row execute procedure public.audit_row_change()',
      t || '_audit_change',
      t
    );
  end loop;
end $$;

-- ============================================================
-- 12. FUNCIONES ATÓMICAS FUNDAMENTALES
-- ============================================================

-- Genera una tanda contigua de códigos CMV sin crear bienes.
create or replace function public.create_label_batch(
  p_quantity integer,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_first bigint;
  v_last bigint;
begin
  if not public.can_manage_inventory() then
    raise exception 'No autorizado para generar etiquetas.';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 500 then
    raise exception 'La cantidad debe estar entre 1 y 500 etiquetas por tanda.';
  end if;

  -- Contador transaccional: bloquea una sola fila y evita duplicados o saltos
  -- invisibles si una generación de tanda falla y se revierte.
  select next_value
    into v_first
  from public.system_counters
  where counter_key = 'asset_label_number'
  for update;

  if v_first is null then
    raise exception 'No existe el contador de etiquetas CMV.';
  end if;

  v_last := v_first + p_quantity - 1;

  update public.system_counters
  set next_value = v_last + 1,
      updated_at = now()
  where counter_key = 'asset_label_number';

  insert into public.label_batches (
    id, quantity, first_number, last_number, notes, created_by
  ) values (
    v_batch_id, p_quantity, v_first, v_last, p_notes, auth.uid()
  );

  insert into public.asset_labels (
    batch_id, sequence_number, code, status, created_by
  )
  select
    v_batch_id,
    n,
    'CMV-' || lpad(n::text, 6, '0'),
    'available'::public.label_status,
    auth.uid()
  from generate_series(v_first, v_last) as n;

  return v_batch_id;
end;
$$;

revoke all on function public.create_label_batch(integer, text) from public;
grant execute on function public.create_label_batch(integer, text) to authenticated;

-- Anula una etiqueta disponible. Nunca permite anular una ya asignada.
create or replace function public.void_label(
  p_code text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label public.asset_labels%rowtype;
begin
  if not public.can_manage_inventory() then
    raise exception 'No autorizado para anular etiquetas.';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Debe indicar un motivo de anulación.';
  end if;

  select * into v_label
  from public.asset_labels
  where code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'Etiqueta % no encontrada.', p_code;
  end if;

  if v_label.status <> 'available' then
    raise exception 'Solo una etiqueta disponible puede anularse. Estado actual: %.', v_label.status;
  end if;

  update public.asset_labels
  set status = 'voided',
      void_reason = trim(p_reason),
      voided_at = now(),
      voided_by = auth.uid()
  where id = v_label.id;
end;
$$;

revoke all on function public.void_label(text, text) from public;
grant execute on function public.void_label(text, text) to authenticated;

-- Registro atómico del bien + asignación permanente de etiqueta.
create or replace function public.register_asset_from_label(
  p_label_code text,
  p_name text,
  p_category_id uuid,
  p_location_id uuid,
  p_physical_condition public.asset_condition,
  p_operational_status public.asset_operational_status default 'in_use',
  p_description text default null,
  p_custodian_id uuid default null,
  p_brand text default null,
  p_model text default null,
  p_serial_number text default null,
  p_owner_type public.asset_owner_type default 'corporation',
  p_owner_name text default null,
  p_origin public.asset_origin default 'historical_unknown',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label public.asset_labels%rowtype;
  v_asset_id uuid := gen_random_uuid();
  v_user uuid := auth.uid();
begin
  if not public.can_manage_inventory() then
    raise exception 'No autorizado para registrar bienes.';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre del bien es obligatorio.';
  end if;

  select * into v_label
  from public.asset_labels
  where code = upper(trim(p_label_code))
  for update;

  if not found then
    raise exception 'Etiqueta % no encontrada.', p_label_code;
  end if;

  if v_label.status <> 'available' then
    raise exception 'La etiqueta % no está disponible. Estado actual: %.', v_label.code, v_label.status;
  end if;

  if not exists (select 1 from public.categories where id = p_category_id and is_active = true) then
    raise exception 'La categoría indicada no existe o está inactiva.';
  end if;

  if not exists (select 1 from public.locations where id = p_location_id and is_active = true) then
    raise exception 'La dependencia indicada no existe o está inactiva.';
  end if;

  if p_custodian_id is not null and not exists (
    select 1 from public.custodians where id = p_custodian_id and is_active = true
  ) then
    raise exception 'El responsable indicado no existe o está inactivo.';
  end if;

  insert into public.assets (
    id,
    label_id,
    name,
    description,
    category_id,
    location_id,
    custodian_id,
    physical_condition,
    operational_status,
    lifecycle_status,
    brand,
    model,
    serial_number,
    owner_type,
    owner_name,
    origin,
    notes,
    created_by,
    updated_by
  ) values (
    v_asset_id,
    v_label.id,
    trim(p_name),
    nullif(trim(p_description), ''),
    p_category_id,
    p_location_id,
    p_custodian_id,
    p_physical_condition,
    p_operational_status,
    'active',
    nullif(trim(p_brand), ''),
    nullif(trim(p_model), ''),
    nullif(trim(p_serial_number), ''),
    p_owner_type,
    nullif(trim(p_owner_name), ''),
    p_origin,
    nullif(trim(p_notes), ''),
    v_user,
    v_user
  );

  update public.asset_labels
  set status = 'assigned',
      assigned_at = now(),
      assigned_by = v_user
  where id = v_label.id;

  insert into public.asset_movements (
    asset_id,
    movement_type,
    to_location_id,
    to_custodian_id,
    to_operational_status,
    reason,
    created_by
  ) values (
    v_asset_id,
    'initial_registration',
    p_location_id,
    p_custodian_id,
    p_operational_status,
    'Registro inicial del bien',
    v_user
  );

  return v_asset_id;
end;
$$;

revoke all on function public.register_asset_from_label(
  text, text, uuid, uuid, public.asset_condition, public.asset_operational_status,
  text, uuid, text, text, text, public.asset_owner_type, text, public.asset_origin, text
) from public;
grant execute on function public.register_asset_from_label(
  text, text, uuid, uuid, public.asset_condition, public.asset_operational_status,
  text, uuid, text, text, text, public.asset_owner_type, text, public.asset_origin, text
) to authenticated;

-- ============================================================
-- 13. VISTA DE CONSULTA PRINCIPAL
-- ============================================================

create or replace view public.v_assets_current
with (security_invoker = true)
as
select
  a.id,
  l.code,
  a.name,
  a.description,
  a.category_id,
  c.name as category_name,
  a.location_id,
  loc.name as location_name,
  a.custodian_id,
  cu.full_name as custodian_name,
  a.physical_condition,
  a.operational_status,
  a.lifecycle_status,
  a.brand,
  a.model,
  a.serial_number,
  a.owner_type,
  a.owner_name,
  a.origin,
  ai.individual_value_clp,
  acq.id as acquisition_id,
  acq.acquisition_date,
  acq.supplier_name,
  acq.document_type,
  acq.document_number,
  fs.name as funding_source_name,
  a.last_verified_at,
  a.created_at,
  a.updated_at,
  a.disposed_at
from public.assets a
join public.asset_labels l on l.id = a.label_id
join public.categories c on c.id = a.category_id
join public.locations loc on loc.id = a.location_id
left join public.custodians cu on cu.id = a.custodian_id
left join public.acquisition_items ai on ai.asset_id = a.id
left join public.acquisitions acq on acq.id = ai.acquisition_id
left join public.funding_sources fs on fs.id = acq.funding_source_id;

-- ============================================================
-- 14. RLS
-- ============================================================

alter table public.categories enable row level security;
alter table public.locations enable row level security;
alter table public.custodians enable row level security;
alter table public.funding_sources enable row level security;
alter table public.label_batches enable row level security;
alter table public.asset_labels enable row level security;
alter table public.assets enable row level security;
alter table public.acquisitions enable row level security;
alter table public.acquisition_items enable row level security;
alter table public.asset_movements enable row level security;
alter table public.verification_sessions enable row level security;
alter table public.verification_items enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_log enable row level security;

-- Lectura para cualquier usuario activo.
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'locations', 'custodians', 'funding_sources',
    'label_batches', 'asset_labels', 'assets', 'acquisitions',
    'acquisition_items', 'asset_movements', 'verification_sessions',
    'verification_items', 'attachments'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_active_user())',
      t || '_active_users_select',
      t
    );
  end loop;
end $$;

-- Escritura de tablas operativas para Superadmin y Administrador de inventario.
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'locations', 'custodians', 'funding_sources',
    'acquisitions', 'acquisition_items',
    'verification_sessions', 'verification_items', 'attachments'
  ] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_manage_inventory())',
      t || '_managers_insert',
      t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_manage_inventory()) with check (public.can_manage_inventory())',
      t || '_managers_update',
      t
    );
  end loop;
end $$;

-- Las etiquetas/bienes nacen preferentemente a través de RPC atómicas.
-- Se permite actualizar metadatos de etiquetas (impresión) y datos descriptivos de bienes,
-- pero los triggers protegen transiciones sensibles.
create policy asset_labels_managers_update
on public.asset_labels for update
to authenticated
using (public.can_manage_inventory())
with check (public.can_manage_inventory());

create policy assets_managers_update
on public.assets for update
to authenticated
using (public.can_manage_inventory())
with check (public.can_manage_inventory());

-- No hay políticas INSERT directas para label_batches, asset_labels ni assets:
-- create_label_batch() y register_asset_from_label() son las rutas seguras.

-- Auditoría visible solo para Superadmin en V1.
create policy audit_log_superadmin_select
on public.audit_log for select
to authenticated
using (public.is_superadmin());

-- Storage privado: lectura para usuarios activos, escritura para gestores, sin DELETE.
create policy "Inventario CMV - leer archivos"
on storage.objects for select
to authenticated
using (bucket_id = 'inventory-files' and public.is_active_user());

create policy "Inventario CMV - subir archivos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'inventory-files' and public.can_manage_inventory());

create policy "Inventario CMV - actualizar archivos"
on storage.objects for update
to authenticated
using (bucket_id = 'inventory-files' and public.can_manage_inventory())
with check (bucket_id = 'inventory-files' and public.can_manage_inventory());

-- ============================================================
-- 15. PERMISOS EXPLÍCITOS
-- ============================================================

-- Evita acceso anónimo accidental.
revoke all on table public.categories from anon;
revoke all on table public.locations from anon;
revoke all on table public.custodians from anon;
revoke all on table public.funding_sources from anon;
revoke all on table public.label_batches from anon;
revoke all on table public.asset_labels from anon;
revoke all on table public.assets from anon;
revoke all on table public.acquisitions from anon;
revoke all on table public.acquisition_items from anon;
revoke all on table public.asset_movements from anon;
revoke all on table public.verification_sessions from anon;
revoke all on table public.verification_items from anon;
revoke all on table public.attachments from anon;
revoke all on table public.audit_log from anon;

-- Authenticated necesita privilegios SQL además de RLS.
grant select on public.categories, public.locations, public.custodians, public.funding_sources,
  public.label_batches, public.asset_labels, public.assets, public.acquisitions,
  public.acquisition_items, public.asset_movements, public.verification_sessions,
  public.verification_items, public.attachments to authenticated;

grant insert, update on public.categories, public.locations, public.custodians, public.funding_sources,
  public.acquisitions, public.acquisition_items,
  public.verification_sessions, public.verification_items, public.attachments to authenticated;

-- Los movimientos son append-only y se crean mediante acciones/RPC trazables.
-- En Fase 2 solo register_asset_from_label() crea el movimiento inicial.
revoke insert, update, delete on public.asset_movements from authenticated;

-- El cliente no puede cambiar directamente el estado de una etiqueta. Solo puede
-- registrar metadatos de impresión; asignar/anular se hace mediante RPC.
revoke update on public.asset_labels from authenticated;
grant update (print_count, last_printed_at, last_printed_by) on public.asset_labels to authenticated;

-- El cliente puede corregir datos descriptivos del bien, pero no moverlo, prestarlo,
-- repararlo, verificarlo ni darlo de baja mediante un UPDATE libre.
revoke update on public.assets from authenticated;
grant update (
  name, description, category_id, physical_condition, brand, model, serial_number,
  owner_type, owner_name, origin, notes
) on public.assets to authenticated;
grant select on public.audit_log to authenticated;
grant select on public.v_assets_current to authenticated;

commit;

-- ============================================================
-- NOTAS POSTERIORES A LA MIGRACIÓN
-- ============================================================
-- 1) No crear políticas DELETE. Los triggers además bloquean el borrado físico.
-- 2) No exponer public.system_counters a clientes autenticados.
-- 3) La generación de etiquetas debe llamar public.create_label_batch().
-- 4) El alta de un bien debe llamar public.register_asset_from_label().
-- 5) Traslados, préstamos, reparación, verificación y bajas tendrán sus RPC
--    específicas en fases posteriores para preservar la trazabilidad atómica.
