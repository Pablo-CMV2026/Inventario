import { useEffect, useMemo, useState } from 'react'
import { Boxes, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { StatusBadge } from '../../components/StatusBadge'
import { listAssets } from '../../services/inventory/inventoryService'
import type { AssetCurrentView } from '../../types/inventory'

export function InventoryPage() {
  const [assets, setAssets] = useState<AssetCurrentView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [location, setLocation] = useState('all')
  const [lifecycle, setLifecycle] = useState('active')

  useEffect(() => {
    let active = true
    listAssets()
      .then((data) => active && setAssets(data))
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const categories = useMemo(() => Array.from(new Set(assets.map((asset) => asset.category_name))).sort(), [assets])
  const locations = useMemo(() => Array.from(new Set(assets.map((asset) => asset.location_name))).sort(), [assets])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return assets.filter((asset) => {
      const haystack = [asset.code, asset.name, asset.brand, asset.model, asset.serial_number, asset.custodian_name, asset.location_name, asset.category_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return (!term || haystack.includes(term))
        && (category === 'all' || asset.category_name === category)
        && (location === 'all' || asset.location_name === location)
        && (lifecycle === 'all' || asset.lifecycle_status === lifecycle)
    })
  }, [assets, query, category, location, lifecycle])

  return <div className="page">
    <PageHeader
      eyebrow="Inventario institucional"
      title="Inventario"
      description="Consulta el estado actual de cada bien sin perder su trazabilidad histórica."
      action={<Link to="/inventario/nuevo" className="primary-action"><Plus size={18} /> Registrar bien</Link>}
    />

    <section className="filter-panel">
      <label className="search-field">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, nombre, marca, serie, responsable…" />
      </label>
      <div className="filter-row">
        <span className="filter-label"><SlidersHorizontal size={16} /> Filtros</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">Todas las categorías</option>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={location} onChange={(event) => setLocation(event.target.value)}>
          <option value="all">Todas las dependencias</option>
          {locations.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)}>
          <option value="active">Activos</option>
          <option value="disposed">Dados de baja</option>
          <option value="all">Todos</option>
        </select>
      </div>
    </section>

    {error && <div className="notice error">{error}</div>}

    <section className="panel inventory-panel">
      <div className="panel-header">
        <h2><Boxes size={18} /> Bienes</h2>
        <span className="badge">{loading ? 'Cargando…' : `${filtered.length} de ${assets.length}`}</span>
      </div>

      {!loading && !error && filtered.length === 0 ? <div className="empty-state">
        {assets.length === 0 ? 'Aún no hay bienes registrados.' : 'No hay resultados para estos filtros.'}
      </div> : null}

      <div className="asset-list">
        {filtered.map((asset) => <Link className="asset-row" key={asset.id} to={`/inventario/${asset.id}`}>
          <div className="asset-code">{asset.code}</div>
          <div className="asset-primary">
            <strong>{asset.name}</strong>
            <span>{[asset.brand, asset.model].filter(Boolean).join(' · ') || asset.category_name}</span>
          </div>
          <div className="asset-meta">
            <span>{asset.location_name}</span>
            <small>{asset.custodian_name || 'Sin responsable asignado'}</small>
          </div>
          <div className="asset-statuses">
            <StatusBadge kind="operational" value={asset.operational_status} />
            <StatusBadge kind="lifecycle" value={asset.lifecycle_status} />
          </div>
        </Link>)}
      </div>
    </section>
  </div>
}
