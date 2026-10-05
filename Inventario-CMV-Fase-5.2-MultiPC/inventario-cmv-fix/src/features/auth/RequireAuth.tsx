import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, configured } = useAuth()
  const location = useLocation()

  if (!configured) {
    return (
      <div className="setup-screen">
        <img src="/brand/cmv-escudo.png" alt="CMV" className="setup-logo" />
        <h1>Inventario CMV</h1>
        <p>Falta conectar el proyecto con Supabase.</p>
        <code>Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env</code>
      </div>
    )
  }

  if (loading) return <div className="center-screen">Cargando…</div>
  if (!session) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  if (!profile) return <div className="setup-screen"><h1>Acceso sin perfil</h1><p>La cuenta existe en autenticación, pero no tiene un perfil de Inventario CMV. Debe revisarlo un Superadmin.</p></div>
  if (!profile.is_active) return <Navigate to="/login" replace />
  return <>{children}</>
}
