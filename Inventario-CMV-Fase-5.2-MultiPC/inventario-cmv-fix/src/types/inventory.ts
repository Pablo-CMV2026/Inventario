export type LabelStatus = 'available' | 'assigned' | 'voided'
export type AssetCondition = 'good' | 'worn' | 'damaged'
export type AssetOperationalStatus = 'in_use' | 'stored' | 'loaned' | 'in_repair' | 'not_located'
export type AssetLifecycleStatus = 'active' | 'disposed'
export type AssetOrigin = 'purchase' | 'donation' | 'loan_comodato' | 'transfer' | 'historical_unknown'
export type AssetOwnerType = 'corporation' | 'school' | 'third_party' | 'other' | 'unknown'
export type MovementType =
  | 'initial_registration'
  | 'transfer'
  | 'loan_out'
  | 'loan_return'
  | 'repair_out'
  | 'repair_return'
  | 'marked_not_located'
  | 'located'
  | 'disposed'
export type VerificationSessionStatus = 'open' | 'closed' | 'cancelled'
export type VerificationResult = 'pending' | 'verified_expected' | 'found_other_location' | 'not_verified'
export type AttachmentKind = 'photo' | 'document'

export interface Category {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

export interface Location {
  id: string
  name: string
  parent_id: string | null
  description: string | null
  is_active: boolean
}

export interface Custodian {
  id: string
  full_name: string
  email: string | null
  notes: string | null
  is_active: boolean
}

export interface FundingSource {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

export interface LabelBatch {
  id: string
  quantity: number
  first_number: number
  last_number: number
  notes: string | null
  created_at: string
  created_by: string
  print_count: number
  last_printed_at: string | null
  last_printed_by: string | null
}

export interface AssetLabel {
  id: string
  batch_id: string
  sequence_number: number
  code: string
  status: LabelStatus
  created_at: string
  assigned_at: string | null
  voided_at: string | null
  void_reason: string | null
  print_count: number
  last_printed_at: string | null
  last_printed_by: string | null
}

export interface Asset {
  id: string
  label_id: string
  name: string
  description: string | null
  category_id: string
  location_id: string
  custodian_id: string | null
  physical_condition: AssetCondition
  operational_status: AssetOperationalStatus
  lifecycle_status: AssetLifecycleStatus
  brand: string | null
  model: string | null
  serial_number: string | null
  owner_type: AssetOwnerType
  owner_name: string | null
  origin: AssetOrigin
  notes: string | null
  last_verified_at: string | null
  disposed_at: string | null
  disposal_reason: string | null
  created_at: string
  updated_at: string
}

export interface AssetCurrentView {
  id: string
  code: string
  name: string
  description: string | null
  category_id: string
  category_name: string
  location_id: string
  location_name: string
  custodian_id: string | null
  custodian_name: string | null
  physical_condition: AssetCondition
  operational_status: AssetOperationalStatus
  lifecycle_status: AssetLifecycleStatus
  brand: string | null
  model: string | null
  serial_number: string | null
  owner_type: AssetOwnerType
  owner_name: string | null
  origin: AssetOrigin
  individual_value_clp: number | null
  acquisition_id: string | null
  acquisition_date: string | null
  supplier_name: string | null
  document_type: string | null
  document_number: string | null
  funding_source_name: string | null
  last_verified_at: string | null
  created_at: string
  updated_at: string
  disposed_at: string | null
}

export const assetConditionLabels: Record<AssetCondition, string> = {
  good: 'Bueno',
  worn: 'Con desgaste',
  damaged: 'Dañado',
}

export const assetOperationalStatusLabels: Record<AssetOperationalStatus, string> = {
  in_use: 'En uso',
  stored: 'Guardado',
  loaned: 'Prestado',
  in_repair: 'En reparación',
  not_located: 'No ubicado',
}

export const assetLifecycleStatusLabels: Record<AssetLifecycleStatus, string> = {
  active: 'Activo',
  disposed: 'Dado de baja',
}

export const assetOriginLabels: Record<AssetOrigin, string> = {
  purchase: 'Compra',
  donation: 'Donación',
  loan_comodato: 'Comodato / préstamo',
  transfer: 'Traspaso',
  historical_unknown: 'Desconocido / histórico',
}
