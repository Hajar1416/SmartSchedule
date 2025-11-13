'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, role: string) => Promise<void>
  signOut: () => Promise<void>
  userRole: string | null
  requestPasswordReset?: (email: string) => Promise<void>
  updatePassword?: (newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth loading timeout - setting loading to false')
        setLoading(false)
      }
    }, 10000) // 10 second timeout

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          if (mounted) {
            setLoading(false)
          }
          return
        }

        if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
          // Do not block UI on role fetch
          if (session?.user) {
            fetchUserRole(session.user.id)
          }
          setLoading(false)
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('Auth state changed:', event, session?.user?.email)
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // Fire and forget; don't block loading or UI transitions
        fetchUserRole(session.user.id)
      } else {
        setUserRole(null)
      }
      
      setLoading(false)
    })

    return () => {
      mounted = false
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const fetchUserRole = async (userId: string) => {
    try {
      console.log('🔍 Fetching role for user:', userId)
      
      // Check localStorage first for cached role
      const cachedRole = localStorage.getItem(`user_role_${userId}`)
      if (cachedRole) {
        console.log('✅ Using cached role:', cachedRole)
        setUserRole(cachedRole)
        return
      }

      console.log('🔄 Fetching role from database...')
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      console.log('📊 Database response:', { data, error })

      if (error) {
        console.error('❌ Error fetching user role:', error)
        
        // Fallback: try auth user metadata/email to infer role
        try {
          const { data: u } = await supabase.auth.getUser()
          const metaRole = (u.user?.user_metadata as any)?.role
          const email = u.user?.email || ''
          const inferredRole = metaRole || (email.startsWith('admin@') ? 'admin' : 'student')
          setUserRole(inferredRole)
          localStorage.setItem(`user_role_${userId}`, inferredRole)
        } catch (e) {
          // Final fallback
          setUserRole('student')
          localStorage.setItem(`user_role_${userId}`, 'student')
        }
        return
      }

      const role = data?.role || 'student'
      console.log('✅ Setting user role to:', role)
      setUserRole(role)
      localStorage.setItem(`user_role_${userId}`, role)
      console.log('✅ User role set successfully. Current role:', role)
    } catch (error) {
      console.error('Error fetching user role:', error)
      // Set default role to prevent infinite loading
      setUserRole('student')
      localStorage.setItem(`user_role_${userId}`, 'student')
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, role: string) => {
    // Only allow admin to create accounts
    throw new Error('Account creation is restricted. Please contact administrator to create your account.')
  }

  const signOut = async () => {
    // Clear localStorage cache
    if (user?.id) {
      localStorage.removeItem(`user_role_${user.id}`)
    }
    
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const requestPasswordReset = async (email: string) => {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    })
    if (error) throw error
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    userRole,
    requestPasswordReset,
    updatePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
