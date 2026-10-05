import { supabase } from '../supabase/client'
import type {
  AssetCurrentView,
  AssetLabel,
  AssetCondition,
  AssetOperationalStatus,
  AssetOrigin,
  AssetOwnerType,
  Category,
  Custodian,
  Location,
} from '../../types/inventory'

export type NewAssetInput = {
  labelCode: string
  name: string
  categoryId: string
  locationId: string
  physicalCondition: AssetCondition
  operationalStatus: AssetOperationalStatus
  description?: string
  custodianId?: string | null
  brand?: string
  model?: string
  serialNumber?: string
  ownerType: AssetOwnerType
  ownerName?: string
  origin: AssetOrigin
  notes?: string
}

export type AssetMovementRow = {
  id: string
  movement_type: string
  event_at: string
  reason: string
  notes: string | null
  from_location_id: string | null
  to_location_id: string | null
  from_custodian_id: string | null
  to_custodian_id: string | null
  from_operational_status: string | null
  to_operational_status: string | null
  created_by: string
}

export type DashboardSummary = {
  total: number
  active: number
  pending: number
  inRepair: number
  disposed: number
  availableLabels: number
  byCategory: Array<{ name: string; count: number }>
}

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function listAssets(): Promise<AssetCurrentView[]> {
  const { data, error } = await supabase
    .from('v_assets_current')
    .select('*')
    .order('created_at', { ascending: false })

  assertNoError(error)
  return (data ?? []) as AssetCurrentView[]
}

export async function findAssetByCode(code: string): Promise<AssetCurrentView | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  const { data, error } = await supabase
    .from('v_assets_current')
    .select('*')
    .eq('code', normalized)
    .maybeSingle()

  assertNoError(error)
  return (data as AssetCurrentView | null) ?? null
}

export async function getAsset(assetId: string): Promise<AssetCurrentView | null> {
  const { data, error } = await supabase
    .from('v_assets_current')
    .select('*')
    .eq('id', assetId)
    .maybeSingle()

  assertNoError(error)
  return (data as AssetCurrentView | null) ?? null
}

export async function getAssetMovements(assetId: string): Promise<AssetMovementRow[]> {
  const { data, error } = await supabase
    .from('asset_movements')
    .select('id,movement_type,event_at,reason,notes,from_location_id,to_location_id,from_custodian_id,to_custodian_id,from_operational_status,to_operational_status,created_by')
    .eq('asset_id', assetId)
    .order('event_at', { ascending: false })

  assertNoError(error)
  return (data ?? []) as AssetMovementRow[]
}

export async function listCategories(includeInactive = false): Promise<Category[]> {
  let query = supabase.from('categories').select('id,name,description,is_active').order('name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  assertNoError(error)
  return (data ?? []) as Category[]
}

export async function listLocations(includeInactive = false): Promise<Location[]> {
  let query = supabase.from('locations').select('id,name,parent_id,description,is_active').order('name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  assertNoError(error)
  return (data ?? []) as Location[]
}

export async function listCustodians(includeInactive = false): Promise<Custodian[]> {
  let query = supabase.from('custodians').select('id,full_name,email,notes,is_active').order('full_name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  assertNoError(error)
  return (data ?? []) as Custodian[]
}

export async function listAvailableLabels(limit = 50): Promise<AssetLabel[]> {
  const { data, error } = await supabase
    .from('asset_labels')
    .select('id,batch_id,sequence_number,code,status,created_at,assigned_at,voided_at,void_reason,print_count,last_printed_at,last_printed_by')
    .eq('status', 'available')
    .order('sequence_number', { ascending: true })
    .limit(limit)

  assertNoError(error)
  return (data ?? []) as AssetLabel[]
}

export async function getLabelByCode(code: string): Promise<AssetLabel | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null

  const { data, error } = await supabase
    .from('asset_labels')
    .select('id,batch_id,sequence_number,code,status,created_at,assigned_at,voided_at,void_reason,print_count,last_printed_at,last_printed_by')
    .eq('code', normalized)
    .maybeSingle()

  assertNoError(error)
  return (data as AssetLabel | null) ?? null
}

export async function registerAsset(input: NewAssetInput): Promise<string> {
  const { data, error } = await supabase.rpc('register_asset_from_label', {
    p_label_code: input.labelCode.trim().toUpperCase(),
    p_name: input.name.trim(),
    p_category_id: input.categoryId,
    p_location_id: input.locationId,
    p_physical_condition: input.physicalCondition,
    p_operational_status: input.operationalStatus,
    p_description: input.description?.trim() || null,
    p_custodian_id: input.custodianId || null,
    p_brand: input.brand?.trim() || null,
    p_model: input.model?.trim() || null,
    p_serial_number: input.serialNumber?.trim() || null,
    p_owner_type: input.ownerType,
    p_owner_name: input.ownerName?.trim() || null,
    p_origin: input.origin,
    p_notes: input.notes?.trim() || null,
  })

  assertNoError(error)
  if (!data) throw new Error('El servidor no devolvió el identificador del bien creado.')
  return data as string
}

export async function createCategory(name: string, description?: string) {
  const { error } = await supabase.from('categories').insert({
    name: name.trim(),
    description: description?.trim() || null,
  })
  assertNoError(error)
}

export async function createLocation(name: string, parentId?: string | null, description?: string) {
  const { error } = await supabase.from('locations').insert({
    name: name.trim(),
    parent_id: parentId || null,
    description: description?.trim() || null,
  })
  assertNoError(error)
}

export async function createCustodian(fullName: string, email?: string, notes?: string) {
  const { error } = await supabase.from('custodians').insert({
    full_name: fullName.trim(),
    email: email?.trim() || null,
    notes: notes?.trim() || null,
  })
  assertNoError(error)
}

export async function setEntityActive(
  table: 'categories' | 'locations' | 'custodians',
  id: string,
  isActive: boolean,
  reason?: string,
) {
  const payload: Record<string, unknown> = { is_active: isActive }
  if (!isActive) payload.deactivation_reason = reason?.trim() || 'Desactivación administrativa'
  const { error } = await supabase.from(table).update(payload).eq('id', id)
  assertNoError(error)
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [assetsResult, labelsResult] = await Promise.all([
    supabase.from('v_assets_current').select('id,category_name,lifecycle_status,operational_status,last_verified_at'),
    supabase.from('asset_labels').select('id', { count: 'exact', head: true }).eq('status', 'available'),
  ])

  assertNoError(assetsResult.error)
  assertNoError(labelsResult.error)

  const assets = (assetsResult.data ?? []) as Array<{
    id: string
    category_name: string
    lifecycle_status: string
    operational_status: string
    last_verified_at: string | null
  }>

  const categoryCounts = new Map<string, number>()
  for (const asset of assets) {
    categoryCounts.set(asset.category_name, (categoryCounts.get(asset.category_name) ?? 0) + 1)
  }

  return {
    total: assets.length,
    active: assets.filter((asset) => asset.lifecycle_status === 'active').length,
    pending: assets.filter((asset) => asset.lifecycle_status === 'active' && !asset.last_verified_at).length,
    inRepair: assets.filter((asset) => asset.lifecycle_status === 'active' && asset.operational_status === 'in_repair').length,
    disposed: assets.filter((asset) => asset.lifecycle_status === 'disposed').length,
    availableLabels: labelsResult.count ?? 0,
    byCategory: Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  }
}
