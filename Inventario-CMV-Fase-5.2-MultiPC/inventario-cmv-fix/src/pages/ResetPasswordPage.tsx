import { FormEvent, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../services/supabase/client'
import { useAuth } from '../features/auth/AuthProvider'

export function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)

  if (finished) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(''); setMessage('')
    if (password.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) setError('No fue posible actualizar la contraseña. Solicita un nuevo enlace de recuperación.')
    else {
      setMessage('Contraseña actualizada correctamente.')
      window.setTimeout(() => setFinished(true), 900)
    }
    setBusy(false)
  }

  return <div className="login-page">
    <section className="login-brand-panel">
      <img src="/brand/cmv-escudo-extendido.jpg" alt="Colegio Manso de Velasco" />
      <div><p className="eyebrow light">Inventario CMV</p><h1>Nueva contraseña</h1><p>Acceso institucional protegido.</p></div>
    </section>
    <section className="login-form-panel">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">Recuperación de acceso</p>
        <h2>Restablecer contraseña</h2>
        {!isSupabaseConfigured && <div className="notice warning">Supabase aún no está configurado.</div>}
        {!loading && !session && <div className="notice warning">Abre esta pantalla desde el enlace enviado a tu correo. Si el enlace venció, solicita uno nuevo.</div>}
        <label>Nueva contraseña<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <label>Confirmar contraseña<input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>
        {error && <div className="notice error">{error}</div>}
        {message && <div className="notice success">{message}</div>}
        <button className="primary-button" disabled={busy || !session}>{busy ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
        <Link className="text-button center-text" to="/login">Volver al inicio de sesión</Link>
      </form>
    </section>
  </div>
}
