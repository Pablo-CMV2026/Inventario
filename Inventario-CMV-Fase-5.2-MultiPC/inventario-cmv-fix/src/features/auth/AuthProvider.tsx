import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../../services/supabase/client'
import type { UserProfile } from '../../types/auth'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    const loadProfile = async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('id,email,full_name,role,is_active')
        .eq('id', userId)
        .maybeSingle()

      setProfile((data as UserProfile | null) ?? null)
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user) {
        await loadProfile(nextSession.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    configured: isSupabaseConfigured,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error?.message ?? null
    },
    async signOut() {
      await supabase.auth.signOut()
    },
    async sendPasswordReset(email) {
      const redirectTo = `${window.location.origin}/restablecer-clave`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      return error?.message ?? null
    },
  }), [session, profile, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider')
  return context
}
