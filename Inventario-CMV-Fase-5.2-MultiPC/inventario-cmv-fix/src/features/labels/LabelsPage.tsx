import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, Clock3, Plus, Printer, RefreshCw, Search, Tags } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { createLabelBatch, listLabelBatches, listLabels, voidLabel } from '../../services/labels/labelService'
import type { AssetLabel, LabelBatch, LabelStatus } from '../../types/inventory'

const statusLabels: Record<LabelStatus, string> = {
  available: 'Disponible',
  assigned: 'Asignada',
  voided: 'Anulada',
}

export function LabelsPage() {
  const [batches, setBatches] = useState<LabelBatch[]>([])
  const [labels, setLabels] = useState<AssetLabel[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [quantity, setQuantity] = useState(20)
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | LabelStatus>('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [voidCandidate, setVoidCandidate] = useState<AssetLabel | null>(null)
  const [voidReason, setVoidReason] = useState('')

  async function refresh(preferredBatchId?: string) {
    setLoading(true)
    setError('')
    try {
      const [batchData, labelData] = await Promise.all([listLabelBatches(), listLabels()])
      setBatches(batchData)
      setLabels(labelData)
      setSelectedBatchId((current) => {
        if (preferredBatchId && batchData.some((batch) => batch.id === preferredBatchId)) return preferredBatchId
        if (current && batchData.some((batch) => batch.id === current)) return current
        return batchData[0]?.id ?? ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las etiquetas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const totals = useMemo(() => ({
    total: labels.length,
    available: labels.filter((item) => item.status === 'available').length,
    assigned: labels.filter((item) => item.status === 'assigned').length,
    voided: labels.filter((item) => item.status === 'voided').length,
  }), [labels])

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) ?? null
  const selectedLabels = useMemo(() => labels.filter((item) => item.batch_id === selectedBatchId), [labels, selectedBatchId])
  const filteredLabels = useMemo(() => {
    const term = search.trim().toUpperCase()
    return selectedLabels.filter((item) => {
      if (status !== 'all' && item.status !== status) return false
      if (term && !item.code.includes(term)) return false
      return true
    })
  }, [selectedLabels, search, status])

  const selectedCounts = useMemo(() => ({
    available: selectedLabels.filter((item) => item.status === 'available').length,
    assigned: selectedLabels.filter((item) => item.status === 'assigned').length,
    voided: selectedLabels.filter((item) => item.status === 'voided').length,
  }), [selectedLabels])

  async function generate(event: FormEvent) {
    event.preventDefault()
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      setError('La cantidad debe estar entre 1 y 500.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const batchId = await createLabelBatch(quantity, notes)
      setNotes('')
      setMessage(`Tanda generada correctamente: ${quantity} etiquetas reservadas y 0 bienes creados.`)
      await refresh(batchId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible generar la tanda.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmVoid(event: FormEvent) {
    event.preventDefault()
    if (!voidCandidate || !voidReason.trim()) return
    setBusy(true)
    setError('')
    try {
      await voidLabel(voidCandidate.code, voidReason)
      setMessage(`${voidCandidate.code} fue anulada permanentemente y nunca podrá reutilizarse.`)
      setVoidCandidate(null)
      setVoidReason('')
      await refresh(selectedBatchId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible anular la etiqueta.')
    } finally {
      setBusy(false)
    }
  }

  function batchCodeRange(batch: LabelBatch) {
    return `CMV-${String(batch.first_number).padStart(6, '0')} — CMV-${String(batch.last_number).padStart(6, '0')}`
  }

  return <div className="page">
    <PageHeader eyebrow="Identificación patrimonial" title="Etiquetas CMV" description="Genera códigos permanentes, imprime tandas y controla etiquetas disponibles, asignadas y anuladas." />

    {error && <div className="notice error">{error}</div>}
    {message && <div className="notice success"><CheckCircle2 size={17} /> {message}</div>}

    <section className="metric-grid label-metrics">
      <div className="metric-card"><span>Total generadas</span><strong>{totals.total}</strong><small>{batches.length} tandas</small></div>
      <div className="metric-card"><span>Disponibles</span><strong>{totals.available}</strong><small>Sin bien asignado</small></div>
      <div className="metric-card"><span>Asignadas</span><strong>{totals.assigned}</strong><small>Vinculadas a bienes</small></div>
      <div className="metric-card"><span>Anuladas</span><strong>{totals.voided}</strong><small>Nunca reutilizables</small></div>
    </section>

    <div className="labels-layout">
      <section className="panel label-generator-card">
        <div className="panel-header"><h2><Plus size={18} /> Generar tanda</h2><span className="badge">No crea bienes</span></div>
        <form className="form-stack" onSubmit={generate}>
          <label>Cantidad<input type="number" min={1} max={500} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
          <label>Nota opcional<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. Levantamiento inicial oficinas administrativas" /></label>
          <div className="notice info">Generar una tanda solo reserva códigos correlativos. El inventario seguirá aumentando únicamente cuando una etiqueta sea asignada a un bien.</div>
          <button className="primary-button" disabled={busy}>{busy ? 'Procesando…' : `Generar ${quantity || 0} etiquetas`}</button>
        </form>
      </section>

      <section className="panel batches-card">
        <div className="panel-header"><h2><Tags size={18} /> Tandas</h2><button className="icon-text-button" onClick={() => void refresh(selectedBatchId)} disabled={loading}><RefreshCw size={15} /> Actualizar</button></div>
        {loading && <p className="muted">Cargando…</p>}
        {!loading && batches.length === 0 && <div className="empty-state"><strong>Aún no hay tandas.</strong><span>Genera la primera desde el formulario.</span></div>}
        <div className="batch-list">
          {batches.map((batch) => {
            const batchLabels = labels.filter((item) => item.batch_id === batch.id)
            const available = batchLabels.filter((item) => item.status === 'available').length
            const assigned = batchLabels.filter((item) => item.status === 'assigned').length
            const voided = batchLabels.filter((item) => item.status === 'voided').length
            return <button key={batch.id} className={batch.id === selectedBatchId ? 'batch-item active' : 'batch-item'} onClick={() => { setSelectedBatchId(batch.id); setSearch(''); setStatus('all') }}>
              <div><strong>{batchCodeRange(batch)}</strong><span>{new Date(batch.created_at).toLocaleString('es-CL')}</span></div>
              <div className="batch-counts"><span>{available} disp.</span><span>{assigned} asig.</span>{voided > 0 && <span>{voided} anul.</span>}</div>
            </button>
          })}
        </div>
      </section>
    </div>

    {selectedBatch && <section className="panel labels-detail-panel">
      <div className="labels-detail-header">
        <div>
          <p className="eyebrow">Tanda seleccionada</p>
          <h2>{batchCodeRange(selectedBatch)}</h2>
          <p className="muted">{selectedBatch.quantity} códigos · {selectedCounts.available} disponibles · {selectedCounts.assigned} asignadas · {selectedCounts.voided} anuladas · {selectedBatch.print_count} intentos de impresión de tanda</p>
          {selectedBatch.notes && <p className="batch-note">{selectedBatch.notes}</p>}
        </div>
        {selectedCounts.available > 0
          ? <Link className="primary-button labels-print-link" to={`/etiquetas/${selectedBatch.id}/imprimir`} target="_blank" rel="noreferrer"><Printer size={17} /> Imprimir disponibles</Link>
          : <button className="primary-button labels-print-link" disabled><Printer size={17} /> Sin disponibles</button>}
      </div>

      {voidCandidate && <form className="void-panel" onSubmit={confirmVoid}>
        <div><strong>Anular {voidCandidate.code}</strong><p>Esta acción es permanente. El código quedará en el historial y jamás volverá a estar disponible.</p></div>
        <label>Motivo de anulación<textarea autoFocus required value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Ej. Etiqueta dañada durante la impresión" /></label>
        <div className="void-actions"><button type="button" className="secondary-button" onClick={() => { setVoidCandidate(null); setVoidReason('') }} disabled={busy}>Cancelar</button><button className="danger-button" disabled={busy || !voidReason.trim()}><Ban size={16} /> Confirmar anulación</button></div>
      </form>}

      <div className="label-filter-row">
        <div className="search-field compact"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value.toUpperCase())} placeholder="Buscar CMV-000123" /></div>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Todos los estados</option><option value="available">Disponibles</option><option value="assigned">Asignadas</option><option value="voided">Anuladas</option></select>
      </div>

      <div className="labels-table" role="table">
        <div className="labels-table-head" role="row"><span>Código</span><span>Estado</span><span>Impresiones</span><span>Última impresión</span><span>Acciones</span></div>
        {filteredLabels.map((label) => <div className="labels-table-row" role="row" key={label.id}>
          <strong className="asset-code">{label.code}</strong>
          <span className={`label-status ${label.status}`}>{statusLabels[label.status]}</span>
          <span>{label.print_count}</span>
          <span className="muted">{label.last_printed_at ? new Date(label.last_printed_at).toLocaleString('es-CL') : 'Nunca'}</span>
          <div className="label-row-actions">
            {label.status !== 'voided' && <Link className="small-action" to={`/etiquetas/${selectedBatch.id}/imprimir?codigo=${encodeURIComponent(label.code)}`} target="_blank" rel="noreferrer"><Printer size={14} /> {label.print_count > 0 ? 'Reimprimir' : 'Imprimir'}</Link>}
            {label.status === 'available' && <button className="small-action danger" onClick={() => { setVoidCandidate(label); setVoidReason('') }}><Ban size={14} /> Anular</button>}
            {label.status === 'assigned' && <span className="row-note"><CheckCircle2 size={14} /> Permanente</span>}
            {label.status === 'voided' && <span className="row-note"><Clock3 size={14} /> Conservada</span>}
          </div>
        </div>)}
        {filteredLabels.length === 0 && <div className="empty-state table-empty"><strong>No hay etiquetas para este filtro.</strong></div>}
      </div>
    </section>}
  </div>
}
