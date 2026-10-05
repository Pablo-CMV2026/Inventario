import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarClock, Camera, MapPin, PackageSearch, UserRound } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { PhotoPicker } from '../../components/media/PhotoPicker'
import { StatusBadge } from '../../components/StatusBadge'
import { getAsset, getAssetMovements, type AssetMovementRow } from '../../services/inventory/inventoryService'
import { listAssetPhotos, uploadAssetPhotos, type AssetPhoto } from '../../services/media/mediaService'
import type { AssetCurrentView } from '../../types/inventory'
import { assetOriginLabels } from '../../types/inventory'

const movementLabels: Record<string, string> = {
  initial_registration: 'Registro inicial',
  transfer: 'Traslado',
  loan_out: 'Préstamo',
  loan_return: 'Devolución',
  repair_out: 'Salida a reparación',
  repair_return: 'Retorno de reparación',
  marked_not_located: 'Marcado como no ubicado',
  located: 'Ubicado',
  disposed: 'Baja',
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sin registro'
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatClp(value: number | null) {
  if (value == null) return 'Pendiente / desconocido'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value)
}

export function AssetDetailPage() {
  const { assetId } = useParams()
  const [searchParams] = useSearchParams()
  const [asset, setAsset] = useState<AssetCurrentView | null>(null)
  const [movements, setMovements] = useState<AssetMovementRow[]>([])
  const [photos, setPhotos] = useState<AssetPhoto[]>([])
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [photoSuccess, setPhotoSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refreshPhotos(currentAssetId: string) {
    const photoData = await listAssetPhotos(currentAssetId)
    setPhotos(photoData)
  }

  useEffect(() => {
    if (!assetId) return
    let active = true
    Promise.all([
      getAsset(assetId),
      getAssetMovements(assetId),
      listAssetPhotos(assetId).catch(() => [] as AssetPhoto[]),
    ])
      .then(([assetData, movementData, photoData]) => {
        if (!active) return
        setAsset(assetData)
        setMovements(movementData)
        setPhotos(photoData)
      })
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [assetId])

  async function addPhotos() {
    if (!assetId || newPhotos.length === 0) return
    setUploadingPhotos(true)
    setPhotoError('')
    setPhotoSuccess('')
    try {
      const result = await uploadAssetPhotos(assetId, newPhotos)
      if (result.failures.length > 0) {
        setPhotoError(`${result.uploaded} fotografía(s) guardada(s). ${result.failures.join(' ')}`)
      } else {
        setPhotoSuccess(`${result.uploaded} fotografía${result.uploaded === 1 ? '' : 's'} guardada${result.uploaded === 1 ? '' : 's'} correctamente.`)
      }
      setNewPhotos([])
      await refreshPhotos(assetId)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'No fue posible subir las fotografías.')
    } finally {
      setUploadingPhotos(false)
    }
  }

  if (loading) return <div className="page"><div className="empty-state">Cargando ficha…</div></div>
  if (error) return <div className="page"><div className="notice error">{error}</div></div>
  if (!asset) return <div className="page"><div className="empty-state">El bien solicitado no existe o no está disponible.</div></div>

  return <div className="page">
    <Link to="/inventario" className="back-link"><ArrowLeft size={16} /> Volver al inventario</Link>
    <PageHeader eyebrow={asset.code} title={asset.name} description="Ficha actual y trazabilidad del bien." />

    {searchParams.get('creado') === '1' && <div className="notice success asset-created-notice">Bien registrado y etiqueta asignada correctamente. Ya puedes pegar físicamente la etiqueta.</div>}
    {searchParams.get('fotoPendiente') === '1' && photos.length === 0 && <div className="notice warning">Este bien quedó sin fotografía. Puedes completarla desde esta misma ficha.</div>}

    <div className="detail-status-row">
      <StatusBadge kind="condition" value={asset.physical_condition} />
      <StatusBadge kind="operational" value={asset.operational_status} />
      <StatusBadge kind="lifecycle" value={asset.lifecycle_status} />
    </div>

    <section className="panel asset-photos-panel">
      <div className="panel-header"><h2><Camera size={18} /> Fotografías</h2><span className="badge">{photos.length}</span></div>
      {photos.length > 0 ? <div className="asset-photo-grid">
        {photos.map((photo, index) => <a href={photo.signedUrl} target="_blank" rel="noreferrer" className="asset-photo-card" key={photo.id}>
          <img src={photo.signedUrl} alt={`Fotografía ${index + 1} de ${asset.name}`} />
          <span>{photo.original_filename}</span>
        </a>)}
      </div> : <div className="empty-state compact"><strong>Sin fotografías</strong><span>La ficha puede seguir utilizándose, pero queda como antecedente pendiente.</span></div>}

      <div className="asset-photo-upload">
        <strong>Agregar fotografías</strong>
        <PhotoPicker files={newPhotos} onChange={setNewPhotos} disabled={uploadingPhotos} />
        {photoError && <div className="notice error">{photoError}</div>}
        {photoSuccess && <div className="notice success">{photoSuccess}</div>}
        {newPhotos.length > 0 && <button type="button" className="primary-button upload-photo-button" onClick={() => void addPhotos()} disabled={uploadingPhotos}>{uploadingPhotos ? 'Subiendo…' : `Guardar ${newPhotos.length} fotografía${newPhotos.length === 1 ? '' : 's'}`}</button>}
      </div>
    </section>

    <section className="detail-grid">
      <article className="panel detail-card">
        <div className="panel-header"><h2><PackageSearch size={18} /> Identificación</h2></div>
        <dl className="detail-list">
          <div><dt>Categoría</dt><dd>{asset.category_name}</dd></div>
          <div><dt>Marca</dt><dd>{asset.brand || 'Pendiente'}</dd></div>
          <div><dt>Modelo</dt><dd>{asset.model || 'Pendiente'}</dd></div>
          <div><dt>N.º de serie</dt><dd>{asset.serial_number || 'Pendiente'}</dd></div>
          <div><dt>Origen</dt><dd>{assetOriginLabels[asset.origin]}</dd></div>
          <div><dt>Propietario</dt><dd>{asset.owner_name || (asset.owner_type === 'corporation' ? 'Corporación' : asset.owner_type === 'school' ? 'Colegio' : 'Sin detalle')}</dd></div>
        </dl>
        {asset.description && <p className="detail-note">{asset.description}</p>}
      </article>

      <article className="panel detail-card">
        <div className="panel-header"><h2><MapPin size={18} /> Ubicación y custodia</h2></div>
        <dl className="detail-list">
          <div><dt>Dependencia</dt><dd>{asset.location_name}</dd></div>
          <div><dt>Responsable</dt><dd>{asset.custodian_name || 'Sin responsable asignado'}</dd></div>
          <div><dt>Última verificación física</dt><dd>{formatDateTime(asset.last_verified_at)}</dd></div>
        </dl>
      </article>

      <article className="panel detail-card">
        <div className="panel-header"><h2><CalendarClock size={18} /> Adquisición</h2></div>
        <dl className="detail-list">
          <div><dt>Valor individual</dt><dd>{formatClp(asset.individual_value_clp)}</dd></div>
          <div><dt>Fecha de adquisición</dt><dd>{asset.acquisition_date || 'Pendiente'}</dd></div>
          <div><dt>Proveedor</dt><dd>{asset.supplier_name || 'Pendiente'}</dd></div>
          <div><dt>Documento</dt><dd>{[asset.document_type, asset.document_number].filter(Boolean).join(' ') || 'Pendiente'}</dd></div>
          <div><dt>Financiamiento</dt><dd>{asset.funding_source_name || 'Pendiente'}</dd></div>
        </dl>
      </article>

      <article className="panel detail-card">
        <div className="panel-header"><h2><UserRound size={18} /> Registro</h2></div>
        <dl className="detail-list">
          <div><dt>Registrado</dt><dd>{formatDateTime(asset.created_at)}</dd></div>
          <div><dt>Última modificación</dt><dd>{formatDateTime(asset.updated_at)}</dd></div>
          <div><dt>Baja</dt><dd>{asset.disposed_at ? formatDateTime(asset.disposed_at) : 'No'}</dd></div>
        </dl>
      </article>
    </section>

    <section className="panel timeline-panel">
      <div className="panel-header"><h2>Historial de movimientos</h2><span className="badge">{movements.length}</span></div>
      {movements.length === 0 ? <div className="empty-state">No hay movimientos registrados.</div> : <div className="timeline">
        {movements.map((movement) => <article key={movement.id} className="timeline-item">
          <span className="timeline-dot" />
          <div>
            <strong>{movementLabels[movement.movement_type] || movement.movement_type}</strong>
            <p>{movement.reason}</p>
            {movement.notes && <p className="muted">{movement.notes}</p>}
            <small>{formatDateTime(movement.event_at)}</small>
          </div>
        </article>)}
      </div>}
    </section>
  </div>
}
