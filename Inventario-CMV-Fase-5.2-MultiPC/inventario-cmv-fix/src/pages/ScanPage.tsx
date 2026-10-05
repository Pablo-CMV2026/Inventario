import { FormEvent, useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { Camera, CameraOff, Keyboard, ScanLine, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { findAssetByCode, getLabelByCode } from '../services/inventory/inventoryService'

type ScannerControls = { stop: () => void }

function extractInventoryCode(rawValue: string) {
  const value = rawValue.trim()
  const direct = value.toUpperCase().match(/^CMV-\d{6}$/)
  if (direct) return direct[0]

  try {
    const url = new URL(value)
    const pathMatch = decodeURIComponent(url.pathname).toUpperCase().match(/\/Q\/(CMV-\d{6})(?:\/|$)/)
    if (pathMatch) return pathMatch[1]
  } catch {
    // El contenido puede no ser una URL; se intenta el patrón general debajo.
  }

  const embedded = value.toUpperCase().match(/\bCMV-\d{6}\b/)
  return embedded?.[0] ?? null
}

export function ScanPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<ScannerControls | null>(null)
  const processingRef = useRef(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [scanMessage, setScanMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)

  useEffect(() => () => {
    controlsRef.current?.stop()
    controlsRef.current = null
  }, [])

  async function resolveCode(normalized: string) {
    setLoading(true)
    setError('')
    try {
      const label = await getLabelByCode(normalized)
      if (!label) {
        setError('El código no existe en Inventario CMV.')
        return
      }
      if (label.status === 'voided') {
        setError('La etiqueta está anulada y no puede utilizarse.')
        return
      }
      if (label.status === 'available') {
        navigate(`/inventario/nuevo?codigo=${encodeURIComponent(label.code)}`)
        return
      }
      const asset = await findAssetByCode(label.code)
      if (!asset) {
        setError('La etiqueta figura asignada, pero no fue posible resolver su bien. Revisa la integridad de los datos.')
        return
      }
      navigate(`/inventario/${asset.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible consultar el código.')
    } finally {
      setLoading(false)
      processingRef.current = false
    }
  }

  async function startCamera() {
    if (!videoRef.current) return
    setError('')
    setScanMessage('')

    if (!window.isSecureContext) {
      setError('La cámara requiere HTTPS. En desarrollo también funciona desde localhost.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite acceder a la cámara. Usa el ingreso manual del código.')
      return
    }

    controlsRef.current?.stop()
    controlsRef.current = null
    processingRef.current = false
    setCameraStarting(true)

    try {
      const reader = new BrowserQRCodeReader()
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result, scanError, scannerControls) => {
          if (result && !processingRef.current) {
            const found = extractInventoryCode(result.getText())
            if (!found) {
              setScanMessage('QR detectado, pero no corresponde a una etiqueta de Inventario CMV.')
              return
            }
            processingRef.current = true
            scannerControls.stop()
            controlsRef.current = null
            setCameraActive(false)
            setScanMessage(`Código detectado: ${found}`)
            setCode(found)
            void resolveCode(found)
            return
          }

          if (scanError && scanError.name !== 'NotFoundException') {
            // Los fallos de lectura entre cuadros son normales; solo se mantiene la cámara activa.
          }
        },
      )
      controlsRef.current = controls
      setCameraActive(true)
      setScanMessage('Apunta la cámara al QR de una etiqueta CMV.')
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError') {
        setError('No se concedió permiso para usar la cámara. Habilítalo en Safari o usa el código manual.')
      } else if (name === 'NotFoundError') {
        setError('No se encontró una cámara disponible en este dispositivo.')
      } else {
        setError(err instanceof Error ? err.message : 'No fue posible iniciar la cámara.')
      }
    } finally {
      setCameraStarting(false)
    }
  }

  function stopCamera() {
    controlsRef.current?.stop()
    controlsRef.current = null
    processingRef.current = false
    setCameraActive(false)
    setScanMessage('Cámara detenida.')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = code.trim().toUpperCase()
    if (!normalized) return
    await resolveCode(normalized)
  }

  return <div className="page narrow">
    <PageHeader eyebrow="Acceso por código" title="Escanear etiqueta" description="Usa la cámara del iPhone o escribe el código. Ambos caminos resuelven exactamente la misma etiqueta." />

    <section className={`qr-camera-panel ${cameraActive ? 'active' : ''}`}>
      <div className="camera-preview-wrap">
        <video ref={videoRef} className="camera-preview" muted playsInline />
        {!cameraActive && !cameraStarting && <div className="camera-idle"><ScanLine size={54} /><strong>Cámara QR</strong><span>Actívala cuando estés frente al bien.</span></div>}
        {cameraStarting && <div className="camera-idle"><Camera size={46} /><strong>Abriendo cámara…</strong></div>}
        {cameraActive && <div className="camera-reticle" aria-hidden="true" />}
      </div>
      <div className="camera-controls">
        {!cameraActive
          ? <button type="button" className="primary-button camera-button" onClick={() => void startCamera()} disabled={cameraStarting || loading}><Camera size={18} /> {cameraStarting ? 'Abriendo…' : 'Usar cámara'}</button>
          : <button type="button" className="secondary-button camera-button" onClick={stopCamera}><CameraOff size={18} /> Detener cámara</button>}
        <p>{scanMessage || 'La cámara necesita permiso y una conexión HTTPS cuando la aplicación esté publicada.'}</p>
      </div>
    </section>

    {error && <div className="notice error scan-notice">{error}</div>}

    <form className="panel code-lookup" onSubmit={submit}>
      <div className="panel-header"><h2><Keyboard size={18} /> Ingreso manual</h2></div>
      <div className="inline-field"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="CMV-000001" autoCapitalize="characters" /><button className="primary-button lookup-button" disabled={loading}><Search size={17} /> {loading ? 'Buscando…' : 'Abrir'}</button></div>
      <p className="field-help">Úsalo si el QR está deteriorado, destiñó o la cámara no está disponible.</p>
    </form>
  </div>
}
