import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getLabelBatch, getQrDestination, hasPermanentQrBaseUrl, listLabels, recordBatchPrint, recordLabelPrint } from '../../services/labels/labelService'
import type { AssetLabel, LabelBatch } from '../../types/inventory'

export function PrintLabelsPage() {
  const { batchId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const requestedCode = searchParams.get('codigo')?.trim().toUpperCase() || null
  const [batch, setBatch] = useState<LabelBatch | null>(null)
  const [labels, setLabels] = useState<AssetLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getLabelBatch(batchId), listLabels(batchId)])
      .then(([batchData, labelData]) => {
        if (!active) return
        setBatch(batchData)
        setLabels(labelData)
      })
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [batchId])

  const printable = useMemo(() => {
    if (requestedCode) return labels.filter((label) => label.code === requestedCode && label.status !== 'voided')
    return labels.filter((label) => label.status === 'available')
  }, [labels, requestedCode])

  async function print() {
    if (!batch || printable.length === 0) return
    setPrinting(true)
    setError('')
    try {
      if (requestedCode) {
        await recordLabelPrint(printable[0].id)
      } else {
        await recordBatchPrint(batch.id)
      }
      window.print()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar el intento de impresión.')
    } finally {
      setPrinting(false)
    }
  }

  if (loading) return <div className="page"><p>Cargando etiquetas…</p></div>

  return <div className="page print-page">
    <div className="print-controls">
      <Link className="back-link" to="/etiquetas"><ArrowLeft size={16} /> Volver a etiquetas</Link>
      <div className="panel print-toolbar">
        <div>
          <p className="eyebrow">Impresión compacta</p>
          <h1>{requestedCode ? requestedCode : `Tanda ${batch ? `${String(batch.first_number).padStart(6, '0')}–${String(batch.last_number).padStart(6, '0')}` : ''}`}</h1>
          <p className="muted">Formato inicial: 50 × 30 mm por etiqueta. La impresión de tanda incluye solo etiquetas disponibles; las asignadas se reimprimen individualmente.</p>
        </div>
        <button className="primary-button print-action" onClick={() => void print()} disabled={printing || printable.length === 0}>
          <Printer size={18} /> {printing ? 'Preparando…' : 'Imprimir'}
        </button>
      </div>
      {!hasPermanentQrBaseUrl() && <div className="notice warning"><strong>Atención:</strong> VITE_PUBLIC_APP_URL aún no está configurada. Los QR usarán temporalmente la dirección actual del navegador. No imprimas etiquetas definitivas hasta fijar la URL pública estable.</div>}
      {requestedCode && labels.some((label) => label.code === requestedCode && label.status === 'voided') && <div className="notice error">La etiqueta solicitada está anulada. No se permite imprimirla.</div>}
      {error && <div className="notice error">{error}</div>}
      <p className="muted print-note">El contador registra intentos de impresión iniciados desde el sistema; la aplicación no puede confirmar si la impresora física terminó el trabajo.</p>
    </div>

    <section className="label-print-area" aria-label="Etiquetas listas para imprimir">
      {printable.length === 0 ? <div className="panel empty-state"><strong>No hay etiquetas imprimibles en esta selección.</strong></div> : <div className="print-sheet">
        {printable.map((label) => <article className="physical-label" key={label.id}>
          <QRCodeSVG value={getQrDestination(label.code)} level="M" marginSize={0} className="label-qr" />
          <strong>{label.code}</strong>
        </article>)}
      </div>}
    </section>
  </div>
}
