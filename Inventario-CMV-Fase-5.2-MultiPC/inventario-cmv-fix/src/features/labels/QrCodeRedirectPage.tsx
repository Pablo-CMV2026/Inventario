import { useEffect, useState } from 'react'
import { ScanLine } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { findAssetByCode, getLabelByCode } from '../../services/inventory/inventoryService'

export function QrCodeRedirectPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function resolve() {
      try {
        const normalized = code.trim().toUpperCase()
        const label = await getLabelByCode(normalized)
        if (!active) return

        if (!label) {
          setError('Este código no existe en Inventario CMV.')
          return
        }

        if (label.status === 'voided') {
          setError('Esta etiqueta fue anulada y no puede utilizarse.')
          return
        }

        if (label.status === 'available') {
          navigate(`/inventario/nuevo?codigo=${encodeURIComponent(label.code)}`, { replace: true })
          return
        }

        const asset = await findAssetByCode(label.code)
        if (!active) return
        if (!asset) {
          setError('La etiqueta figura asignada, pero no fue posible resolver el bien relacionado.')
          return
        }

        navigate(`/inventario/${asset.id}`, { replace: true })
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'No fue posible resolver el código QR.')
      }
    }

    void resolve()
    return () => { active = false }
  }, [code, navigate])

  return <div className="page narrow">
    <div className="panel qr-resolver-card">
      <ScanLine size={38} />
      <h1>Abriendo etiqueta CMV</h1>
      {!error && <p className="muted">Resolviendo {code.toUpperCase()}…</p>}
      {error && <div className="notice error">{error}</div>}
    </div>
  </div>
}
