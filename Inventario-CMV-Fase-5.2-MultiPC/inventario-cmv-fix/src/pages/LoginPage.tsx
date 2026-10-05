import { FormEvent, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

export function LoginPage() {
  const { session, signIn, sendPasswordReset, configured } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    const loginError = await signIn(email.trim(), password)
    if (loginError) setError('No fue posible iniciar sesión. Revisa tus credenciales.')
    setBusy(false)
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError('Ingresa tu correo para recuperar la contraseña.')
      return
    }
    setBusy(true); setError(''); setMessage('')
    const resetError = await sendPasswordReset(email.trim())
    if (resetError) setError('No fue posible enviar el correo de recuperación.')
    else setMessage('Si el correo está habilitado, recibirás instrucciones para restablecer tu contraseña.')
    setBusy(false)
  }

  return (
    <div className="login-page">
      <section className="login-brand-panel">
        <img src="/brand/cmv-escudo-extendido.jpg" alt="Colegio Manso de Velasco" />
        <div>
          <p className="eyebrow light">Corporación Educacional Los Nepar de Cauquenes</p>
          <h1>Inventario CMV</h1>
          <p>Control institucional de bienes, ubicación e historial.</p>
        </div>
      </section>
      <section className="login-form-panel">
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">Acceso autorizado</p>
          <h2>Iniciar sesión</h2>
          <p className="muted">Solo pueden ingresar usuarios creados por la administración.</p>
          {!configured && <div className="notice warning">Supabase aún no está configurado en este entorno.</div>}
          <label>Correo institucional<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
          {error && <div className="notice error">{error}</div>}
          {message && <div className="notice success">{message}</div>}
          <button className="primary-button" disabled={busy || !configured}>{busy ? 'Procesando…' : 'Ingresar'}</button>
          <button className="text-button" type="button" onClick={resetPassword} disabled={busy || !configured}>¿Olvidaste tu contraseña?</button>
        </form>
      </section>
    </div>
  )
}
