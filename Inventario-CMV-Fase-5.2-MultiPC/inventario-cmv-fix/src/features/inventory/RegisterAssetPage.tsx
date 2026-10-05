import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Camera, CheckCircle2, Search, Tag } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { PhotoPicker } from '../../components/media/PhotoPicker'
import {
  getLabelByCode,
  listAvailableLabels,
  listCategories,
  listCustodians,
  listLocations,
  registerAsset,
} from '../../services/inventory/inventoryService'
import { uploadAssetPhotos } from '../../services/media/mediaService'
import type { AssetLabel, Category, Custodian, Location } from '../../types/inventory'

export function RegisterAssetPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [custodians, setCustodians] = useState<Custodian[]>([])
  const [availableLabels, setAvailableLabels] = useState<AssetLabel[]>([])
  const [labelCode, setLabelCode] = useState(searchParams.get('codigo')?.toUpperCase() || '')
  const [label, setLabel] = useState<AssetLabel | null>(null)
  const [labelMessage, setLabelMessage] = useState('')
  const [loadingLookups, setLoadingLookups] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitStage, setSubmitStage] = useState('')
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [custodianId, setCustodianId] = useState('')
  const [condition, setCondition] = useState<'good' | 'worn' | 'damaged'>('good')
  const [operationalStatus, setOperationalStatus] = useState<'in_use' | 'stored' | 'loaned' | 'in_repair' | 'not_located'>('in_use')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [origin, setOrigin] = useState<'purchase' | 'donation' | 'loan_comodato' | 'transfer' | 'historical_unknown'>('historical_unknown')
  const [ownerType, setOwnerType] = useState<'corporation' | 'school' | 'third_party' | 'other' | 'unknown'>('corporation')
  const [ownerName, setOwnerName] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [continueWithoutPhoto, setContinueWithoutPhoto] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([listCategories(), listLocations(), listCustodians(), listAvailableLabels(30)])
      .then(([categoryData, locationData, custodianData, labelData]) => {
        if (!active) return
        setCategories(categoryData)
        setLocations(locationData)
        setCustodians(custodianData)
        setAvailableLabels(labelData)
        if (categoryData[0]) setCategoryId(categoryData[0].id)
        if (locationData[0]) setLocationId(locationData[0].id)
      })
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoadingLookups(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (searchParams.get('codigo')) void validateLabel()
    // only initial query-param validation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (photos.length > 0) setContinueWithoutPhoto(false)
  }, [photos.length])

  const setupMissing = !loadingLookups && (categories.length === 0 || locations.length === 0)
  const requiresOwnerName = ownerType === 'third_party' || ownerType === 'other'
  const photoRequirementMet = photos.length > 0 || continueWithoutPhoto
  const canSubmit = Boolean(
    label?.status === 'available'
    && name.trim()
    && categoryId
    && locationId
    && (!requiresOwnerName || ownerName.trim())
    && photoRequirementMet,
  )

  const suggestedLabels = useMemo(() => availableLabels.slice(0, 8), [availableLabels])

  async function validateLabel() {
    setError('')
    setLabelMessage('')
    setLabel(null)
    if (!labelCode.trim()) {
      setLabelMessage('Ingresa el código de una etiqueta disponible.')
      return
    }
    try {
      const found = await getLabelByCode(labelCode)
      if (!found) {
        setLabelMessage('Ese código no existe.')
        return
      }
      setLabel(found)
      if (found.status === 'available') setLabelMessage('Etiqueta disponible. Puedes registrar el bien.')
      if (found.status === 'assigned') setLabelMessage('Esta etiqueta ya está asignada a un bien.')
      if (found.status === 'voided') setLabelMessage('Esta etiqueta fue anulada y no puede reutilizarse.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible validar la etiqueta.')
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit || !label) return
    setSubmitting(true)
    setError('')
    setSubmitStage('Registrando bien y asignando etiqueta…')

    try {
      const assetId = await registerAsset({
        labelCode: label.code,
        name,
        description,
        categoryId,
        locationId,
        custodianId: custodianId || null,
        physicalCondition: condition,
        operationalStatus,
        brand,
        model,
        serialNumber,
        origin,
        ownerType,
        ownerName,
        notes,
      })

      let photoPending = false
      if (photos.length > 0) {
        setSubmitStage(`Bien registrado. Subiendo ${photos.length} fotografía${photos.length === 1 ? '' : 's'}…`)
        const result = await uploadAssetPhotos(assetId, photos)
        photoPending = result.failures.length > 0
      }

      const params = new URLSearchParams({ creado: '1' })
      if (photoPending || continueWithoutPhoto) params.set('fotoPendiente', '1')
      navigate(`/inventario/${assetId}?${params.toString()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar el bien.')
      setSubmitting(false)
      setSubmitStage('')
    }
  }

  return <div className="page narrow-form-page">
    <PageHeader eyebrow="Alta de bien" title="Registrar bien" description="La etiqueta debe estar disponible. El servidor confirmará la asignación antes de considerar el registro finalizado." />

    {error && <div className="notice error">{error}</div>}
    {setupMissing && <div className="notice warning">Antes de registrar el primer bien debes crear al menos una categoría y una dependencia en Configuración.</div>}

    <form className="form-stack" onSubmit={submit}>
      <section className="panel form-section">
        <div className="panel-header"><h2><Tag size={18} /> 1. Etiqueta CMV</h2></div>
        <div className="inline-field">
          <input value={labelCode} onChange={(event) => { setLabelCode(event.target.value.toUpperCase()); setLabel(null); setLabelMessage('') }} placeholder="CMV-000001" />
          <button type="button" className="secondary-button" onClick={() => void validateLabel()}><Search size={17} /> Validar</button>
        </div>
        {labelMessage && <div className={`notice ${label?.status === 'available' ? 'success' : 'warning'}`}>{label?.status === 'available' && <CheckCircle2 size={16} />} {labelMessage}</div>}
        {suggestedLabels.length > 0 && !label && <div className="label-suggestions"><span>Disponibles:</span>{suggestedLabels.map((item) => <button type="button" key={item.id} onClick={() => { setLabelCode(item.code); setLabel(item); setLabelMessage('Etiqueta disponible. Puedes registrar el bien.') }}>{item.code}</button>)}</div>}
        {!loadingLookups && availableLabels.length === 0 && <p className="muted">No hay etiquetas disponibles. Genera una tanda desde Etiquetas.</p>}
      </section>

      <section className="panel form-section">
        <div className="panel-header"><h2>2. Identificación mínima</h2><span className="badge">Obligatorio</span></div>
        <div className="form-grid two">
          <label>Nombre del bien<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Notebook Lenovo ThinkPad" /></label>
          <label>Categoría<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Seleccionar…</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Dependencia<select required value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Seleccionar…</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Responsable<select value={custodianId} onChange={(event) => setCustodianId(event.target.value)}><option value="">Sin responsable específico</option>{custodians.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label>
          <label>Estado físico<select value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)}><option value="good">Bueno</option><option value="worn">Con desgaste</option><option value="damaged">Dañado</option></select></label>
          <label>Situación operativa<select value={operationalStatus} onChange={(event) => setOperationalStatus(event.target.value as typeof operationalStatus)}><option value="in_use">En uso</option><option value="stored">Guardado</option><option value="loaned">Prestado</option><option value="in_repair">En reparación</option><option value="not_located">No ubicado</option></select></label>
        </div>
        <label>Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripción breve opcional" /></label>
      </section>

      <section className="panel form-section">
        <div className="panel-header"><h2><Camera size={18} /> 3. Fotografías</h2><span className="badge">Requerida por defecto</span></div>
        <p className="muted form-intro">Toma una fotografía identificable del bien antes de pegar la etiqueta. Puedes adjuntar hasta cinco.</p>
        <PhotoPicker files={photos} onChange={setPhotos} disabled={submitting} />
        {photos.length === 0 && <label className="override-check">
          <input type="checkbox" checked={continueWithoutPhoto} onChange={(event) => setContinueWithoutPhoto(event.target.checked)} />
          <span>Continuar sin fotografía y dejarla pendiente para completar después.</span>
        </label>}
      </section>

      <section className="panel form-section">
        <div className="panel-header"><h2>4. Antecedentes opcionales</h2><span className="badge">Se pueden completar después</span></div>
        <div className="form-grid two">
          <label>Marca<input value={brand} onChange={(event) => setBrand(event.target.value)} /></label>
          <label>Modelo<input value={model} onChange={(event) => setModel(event.target.value)} /></label>
          <label>N.º de serie<input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} /></label>
          <label>Origen<select value={origin} onChange={(event) => setOrigin(event.target.value as typeof origin)}><option value="purchase">Compra</option><option value="donation">Donación</option><option value="loan_comodato">Comodato / préstamo</option><option value="transfer">Traspaso</option><option value="historical_unknown">Desconocido / histórico</option></select></label>
          <label>Propietario<select value={ownerType} onChange={(event) => setOwnerType(event.target.value as typeof ownerType)}><option value="corporation">Corporación</option><option value="school">Colegio</option><option value="third_party">Tercero</option><option value="other">Otro</option><option value="unknown">Desconocido</option></select></label>
          {requiresOwnerName && <label>Nombre del propietario<input required value={ownerName} onChange={(event) => setOwnerName(event.target.value)} /></label>}
        </div>
        <label>Observaciones<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      </section>

      <div className="form-actions">
        <button type="submit" className="primary-button wide" disabled={!canSubmit || submitting || setupMissing}>{submitting ? (submitStage || 'Registrando…') : 'Confirmar y asignar etiqueta'}</button>
        <span className="muted">No pegues físicamente la etiqueta hasta recibir la confirmación del sistema.</span>
      </div>
    </form>
  </div>
}
