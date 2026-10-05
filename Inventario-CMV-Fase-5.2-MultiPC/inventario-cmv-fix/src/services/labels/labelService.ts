import { supabase } from '../supabase/client'
import type { AssetLabel, LabelBatch } from '../../types/inventory'

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function listLabelBatches(): Promise<LabelBatch[]> {
  const { data, error } = await supabase
    .from('label_batches')
    .select('id,quantity,first_number,last_number,notes,created_at,created_by,print_count,last_printed_at,last_printed_by')
    .order('created_at', { ascending: false })

  assertNoError(error)
  return (data ?? []) as LabelBatch[]
}

export async function getLabelBatch(batchId: string): Promise<LabelBatch | null> {
  const { data, error } = await supabase
    .from('label_batches')
    .select('id,quantity,first_number,last_number,notes,created_at,created_by,print_count,last_printed_at,last_printed_by')
    .eq('id', batchId)
    .maybeSingle()

  assertNoError(error)
  return (data as LabelBatch | null) ?? null
}

export async function listLabels(batchId?: string): Promise<AssetLabel[]> {
  let query = supabase
    .from('asset_labels')
    .select('id,batch_id,sequence_number,code,status,created_at,assigned_at,voided_at,void_reason,print_count,last_printed_at,last_printed_by')
    .order('sequence_number', { ascending: true })

  if (batchId) query = query.eq('batch_id', batchId)

  const { data, error } = await query
  assertNoError(error)
  return (data ?? []) as AssetLabel[]
}

export async function createLabelBatch(quantity: number, notes?: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_label_batch', {
    p_quantity: quantity,
    p_notes: notes?.trim() || null,
  })

  assertNoError(error)
  if (!data) throw new Error('El servidor no devolvió la tanda creada.')
  return data as string
}

export async function voidLabel(code: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_label', {
    p_code: code.trim().toUpperCase(),
    p_reason: reason.trim(),
  })
  assertNoError(error)
}

export async function recordBatchPrint(batchId: string): Promise<number> {
  const { data, error } = await supabase.rpc('record_label_batch_print', {
    p_batch_id: batchId,
  })
  assertNoError(error)
  return Number(data ?? 0)
}

export async function recordLabelPrint(labelId: string): Promise<void> {
  const { error } = await supabase.rpc('record_label_print', {
    p_label_id: labelId,
  })
  assertNoError(error)
}

export function getQrDestination(code: string): string {
  const configuredBase = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim().replace(/\/$/, '')
  const base = configuredBase || window.location.origin
  return `${base}/q/${encodeURIComponent(code.trim().toUpperCase())}`
}

export function hasPermanentQrBaseUrl(): boolean {
  return Boolean((import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim())
}
