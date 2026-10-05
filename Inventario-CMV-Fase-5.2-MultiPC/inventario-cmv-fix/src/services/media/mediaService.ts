import { supabase } from '../supabase/client'

export type AssetPhoto = {
  id: string
  asset_id: string
  storage_bucket: string
  storage_path: string
  original_filename: string
  mime_type: 'image/jpeg' | 'image/png'
  size_bytes: number | null
  description: string | null
  created_at: string
  signedUrl: string
}

const PHOTO_BUCKET = 'inventory-files'
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png'])

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function extensionForMime(mime: string) {
  return mime === 'image/png' ? 'png' : 'jpg'
}

export function validatePhotoFile(file: File) {
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
    throw new Error(`“${file.name}” no es JPG ni PNG.`)
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error(`“${file.name}” supera el máximo de 10 MB.`)
  }
}

export async function uploadAssetPhoto(assetId: string, file: File, description?: string) {
  validatePhotoFile(file)

  const extension = extensionForMime(file.type)
  const objectName = `${crypto.randomUUID()}.${extension}`
  const storagePath = `assets/${assetId}/photos/${objectName}`

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })

  assertNoError(uploadError)

  const { error: metadataError } = await supabase.from('attachments').insert({
    kind: 'photo',
    asset_id: assetId,
    storage_bucket: PHOTO_BUCKET,
    storage_path: storagePath,
    original_filename: file.name || objectName,
    mime_type: file.type,
    size_bytes: file.size,
    description: description?.trim() || null,
  })

  if (metadataError) {
    throw new Error(`La fotografía se subió al almacenamiento, pero no pudo vincularse al bien: ${metadataError.message}`)
  }
}

export async function uploadAssetPhotos(assetId: string, files: File[]) {
  const failures: string[] = []
  let uploaded = 0

  for (const file of files) {
    try {
      await uploadAssetPhoto(assetId, file)
      uploaded += 1
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `No se pudo subir ${file.name}`)
    }
  }

  return { uploaded, failures }
}

export async function listAssetPhotos(assetId: string): Promise<AssetPhoto[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('id,asset_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes,description,created_at')
    .eq('asset_id', assetId)
    .eq('kind', 'photo')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  assertNoError(error)

  const rows = (data ?? []) as Omit<AssetPhoto, 'signedUrl'>[]
  return Promise.all(rows.map(async (row) => {
    const { data: signed, error: signedError } = await supabase.storage
      .from(row.storage_bucket)
      .createSignedUrl(row.storage_path, 60 * 60)

    assertNoError(signedError)
    return { ...row, signedUrl: signed.signedUrl }
  }))
}
