import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// If the authenticated user has a full_name in their auth signup metadata
// but their public.users row doesn't have one yet, copy it across. This
// is what actually fixes the "name missing on Roles tab" problem at the
// source — it runs the moment anyone becomes authenticated (fresh signup
// with email confirmation off, OR first login after confirming by email),
// so it works regardless of which path a user takes. It's a no-op for
// anyone who already has a name recorded.
async function syncFullNameIfMissing(sessionUser) {
  if (!sessionUser) return
  const metaName = sessionUser.user_metadata?.full_name?.trim()
  if (!metaName) return // nothing to copy — e.g. registered before this fix existed

  try {
    const { data: existing, error: readErr } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', sessionUser.id)
      .maybeSingle()
    if (readErr) { console.error('syncFullNameIfMissing read error:', readErr); return }
    if (existing?.full_name?.trim()) return // already has a name — don't overwrite

    const { error: upsertErr } = await supabase
      .from('users')
      .upsert({ id: sessionUser.id, email: sessionUser.email, full_name: metaName })
    if (upsertErr) console.error('syncFullNameIfMissing upsert error:', upsertErr)
  } catch (err) {
    console.error('syncFullNameIfMissing unexpected error:', err)
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      syncFullNameIfMissing(session?.user)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      syncFullNameIfMissing(session?.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    if (error) throw error
    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
