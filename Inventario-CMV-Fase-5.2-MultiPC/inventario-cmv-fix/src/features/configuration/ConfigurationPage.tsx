import { FormEvent, useEffect, useState } from 'react'
import { Building2, FolderTree, UserRoundPlus } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import {
  createCategory,
  createCustodian,
  createLocation,
  listCategories,
  listCustodians,
  listLocations,
  setEntityActive,
} from '../../services/inventory/inventoryService'
import type { Category, Custodian, Location } from '../../types/inventory'
import { useAuth } from '../auth/AuthProvider'

export function ConfigurationPage() {
  const { profile } = useAuth()
  const canManage = profile?.role === 'superadmin' || profile?.role === 'inventory_admin'
  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [custodians, setCustodians] = useState<Custodian[]>([])
  const [categoryName, setCategoryName] = useState('')
  const [locationName, setLocationName] = useState('')
  const [parentLocationId, setParentLocationId] = useState('')
  const [custodianName, setCustodianName] = useState('')
  const [custodianEmail, setCustodianEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const [categoryData, locationData, custodianData] = await Promise.all([
        listCategories(true),
        listLocations(true),
        listCustodians(true),
      ])
      setCategories(categoryData)
      setLocations(locationData)
      setCustodians(custodianData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar la configuración.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function run(action: () => Promise<void>, success: string) {
    setError(''); setMessage('')
    try {
      await action()
      setMessage(success)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible completar la operación.')
    }
  }

  async function submitCategory(event: FormEvent) {
    event.preventDefault()
    if (!categoryName.trim()) return
    await run(() => createCategory(categoryName), 'Categoría creada.')
    setCategoryName('')
  }

  async function submitLocation(event: FormEvent) {
    event.preventDefault()
    if (!locationName.trim()) return
    await run(() => createLocation(locationName, parentLocationId || null), 'Dependencia creada.')
    setLocationName(''); setParentLocationId('')
  }

  async function submitCustodian(event: FormEvent) {
    event.preventDefault()
    if (!custodianName.trim()) return
    await run(() => createCustodian(custodianName, custodianEmail), 'Responsable creado.')
    setCustodianName(''); setCustodianEmail('')
  }

  async function toggle(table: 'categories' | 'locations' | 'custodians', id: string, current: boolean, label: string) {
    let reason: string | undefined
    if (current) {
      reason = window.prompt(`Motivo para desactivar “${label}”:`) ?? undefined
      if (!reason?.trim()) return
    }
    await run(() => setEntityActive(table, id, !current, reason), current ? 'Registro desactivado sin eliminar su historia.' : 'Registro reactivado.')
  }

  return <div className="page">
    <PageHeader eyebrow="Base del inventario" title="Configuración" description="Crea categorías, dependencias y responsables antes del levantamiento físico." />
    {!canManage && <div className="notice warning">Tu rol es solo de consulta. Puedes ver esta configuración, pero no modificarla.</div>}
    {message && <div className="notice success">{message}</div>}
    {error && <div className="notice error">{error}</div>}

    <section className="config-grid">
      <article className="panel config-card">
        <div className="panel-header"><h2><FolderTree size={18} /> Categorías</h2><span className="badge">{categories.filter((item) => item.is_active).length} activas</span></div>
        {canManage && <form className="compact-form" onSubmit={submitCategory}><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ej. Informática" /><button className="primary-button" type="submit">Agregar</button></form>}
        <div className="config-list">{categories.map((item) => <div className={`config-item ${item.is_active ? '' : 'inactive'}`} key={item.id}><div><strong>{item.name}</strong><small>{item.is_active ? 'Activa' : 'Desactivada'}</small></div>{canManage && <button className="text-button" onClick={() => void toggle('categories', item.id, item.is_active, item.name)}>{item.is_active ? 'Desactivar' : 'Reactivar'}</button>}</div>)}</div>
      </article>

      <article className="panel config-card">
        <div className="panel-header"><h2><Building2 size={18} /> Dependencias</h2><span className="badge">{locations.filter((item) => item.is_active).length} activas</span></div>
        {canManage && <form className="compact-form stacked" onSubmit={submitLocation}><input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Ej. Finanzas" /><select value={parentLocationId} onChange={(event) => setParentLocationId(event.target.value)}><option value="">Sin dependencia superior</option>{locations.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="primary-button" type="submit">Agregar</button></form>}
        <div className="config-list">{locations.map((item) => <div className={`config-item ${item.is_active ? '' : 'inactive'}`} key={item.id}><div><strong>{item.name}</strong><small>{item.parent_id ? `Subdependencia · ${locations.find((candidate) => candidate.id === item.parent_id)?.name ?? '—'}` : 'Dependencia principal'} · {item.is_active ? 'Activa' : 'Desactivada'}</small></div>{canManage && <button className="text-button" onClick={() => void toggle('locations', item.id, item.is_active, item.name)}>{item.is_active ? 'Desactivar' : 'Reactivar'}</button>}</div>)}</div>
      </article>

      <article className="panel config-card">
        <div className="panel-header"><h2><UserRoundPlus size={18} /> Responsables</h2><span className="badge">{custodians.filter((item) => item.is_active).length} activos</span></div>
        {canManage && <form className="compact-form stacked" onSubmit={submitCustodian}><input value={custodianName} onChange={(event) => setCustodianName(event.target.value)} placeholder="Nombre completo" /><input value={custodianEmail} onChange={(event) => setCustodianEmail(event.target.value)} placeholder="Correo opcional" type="email" /><button className="primary-button" type="submit">Agregar</button></form>}
        <div className="config-list">{custodians.map((item) => <div className={`config-item ${item.is_active ? '' : 'inactive'}`} key={item.id}><div><strong>{item.full_name}</strong><small>{item.email || 'Sin correo'} · {item.is_active ? 'Activo' : 'Desactivado'}</small></div>{canManage && <button className="text-button" onClick={() => void toggle('custodians', item.id, item.is_active, item.full_name)}>{item.is_active ? 'Desactivar' : 'Reactivar'}</button>}</div>)}</div>
      </article>
    </section>

    {loading && <p className="muted">Actualizando configuración…</p>}
  </div>
}
