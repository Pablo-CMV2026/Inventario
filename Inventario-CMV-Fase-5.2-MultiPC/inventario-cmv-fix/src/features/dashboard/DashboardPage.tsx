import { useEffect, useState } from 'react'
import { Archive, Boxes, CircleCheck, ClipboardCheck, Hammer, Plus, ScanLine, Tags, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { getDashboardSummary, type DashboardSummary } from '../../services/inventory/inventoryService'

const emptySummary: DashboardSummary = {
  total: 0,
  active: 0,
  pending: 0,
  inRepair: 0,
  disposed: 0,
  availableLabels: 0,
  byCategory: [],
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getDashboardSummary()
      .then((data) => active && setSummary(data))
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const metrics = [
    { label: 'Bienes inventariados', value: summary.total, icon: Boxes },
    { label: 'Activos', value: summary.active, icon: CircleCheck },
    { label: 'Pendientes de verificar', value: summary.pending, icon: TriangleAlert },
    { label: 'En reparación', value: summary.inRepair, icon: Hammer },
    { label: 'Dados de baja', value: summary.disposed, icon: Archive },
    { label: 'Etiquetas disponibles', value: summary.availableLabels, icon: Tags },
  ]

  return <div className="page">
    <PageHeader eyebrow="Vista general" title="Dashboard" description="Resumen operativo del inventario institucional." />
    <section className="quick-actions">
      <Link to="/escanear" className="primary-action"><ScanLine /> Escanear / ingresar código</Link>
      <Link to="/inventario/nuevo" className="secondary-action"><Plus /> Registrar bien</Link>
      <Link to="/recorridos" className="secondary-action"><ClipboardCheck /> Nueva revisión</Link>
    </section>
    {error && <div className="notice error">{error}</div>}
    <section className="metric-grid">
      {metrics.map(({ label, value, icon: Icon }) => <article className="metric-card" key={label}><span className="metric-icon"><Icon size={20} /></span><div><span>{label}</span><strong>{loading ? '—' : value}</strong></div></article>)}
    </section>
    <section className="content-grid">
      <article className="panel">
        <div className="panel-header"><h2>Por categoría</h2><span className="badge">{summary.byCategory.length} categorías</span></div>
        {summary.byCategory.length === 0 ? <div className="empty-state">Las categorías aparecerán cuando comencemos a registrar bienes.</div> : <div className="category-summary">
          {summary.byCategory.map((item) => <div key={item.name}><span>{item.name}</span><strong>{item.count}</strong></div>)}
        </div>}
      </article>
      <article className="panel">
        <div className="panel-header"><h2>Pendientes prioritarios</h2></div>
        {summary.pending === 0 && summary.inRepair === 0 ? <div className="empty-state">Sin pendientes prioritarios.</div> : <div className="pending-summary">
          {summary.pending > 0 && <Link to="/inventario"><span>Pendientes de primera verificación</span><strong>{summary.pending}</strong></Link>}
          {summary.inRepair > 0 && <Link to="/inventario"><span>Bienes en reparación</span><strong>{summary.inRepair}</strong></Link>}
        </div>}
      </article>
    </section>
  </div>
}
