import { NavLink, Outlet } from 'react-router-dom'
import { Boxes, ClipboardCheck, Gauge, Settings, Tags, TriangleAlert, LogOut, ScanLine } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'

const items = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/inventario', label: 'Inventario', icon: Boxes },
  { to: '/etiquetas', label: 'Etiquetas', icon: Tags },
  { to: '/recorridos', label: 'Recorridos', icon: ClipboardCheck },
  { to: '/pendientes', label: 'Pendientes', icon: TriangleAlert },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

export function AppShell() {
  const { profile, user, signOut } = useAuth()
  const displayName = profile?.full_name || user?.email || 'Usuario'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <img src="/brand/cmv-escudo.png" alt="Escudo CMV" />
          <div>
            <strong>Inventario CMV</strong>
            <span>Colegio Manso de Velasco</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="Navegación principal">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{displayName}</strong>
              <small>{profile?.role === 'superadmin' ? 'Superadmin' : profile?.role === 'inventory_admin' ? 'Administrador de inventario' : 'Usuario'}</small>
            </div>
          </div>
          <button className="ghost-button" onClick={() => signOut()}>
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="mobile-header">
        <div className="brand-lockup compact">
          <img src="/brand/cmv-escudo.png" alt="CMV" />
          <strong>Inventario CMV</strong>
        </div>
        <NavLink className="scan-button" to="/escanear"><ScanLine size={20} /> Escanear</NavLink>
      </header>

      <main className="main-content"><Outlet /></main>

      <nav className="bottom-nav" aria-label="Navegación móvil">
        {items.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'bottom-link active' : 'bottom-link'}>
            <Icon size={20} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
