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
          if (session?.user) {
            await fetchUserRole(session.user.id)
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
        await fetchUserRole(session.user.id)
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
        
        // If user doesn't exist in public.users, they need to be created by admin
        if (error.code === 'PGRST116') {
          console.log('User not found in public.users. Please contact administrator to create your account.')
          setUserRole(null) // No role - user needs admin to create account
          setLoading(false)
          return
        } else {
          // For other errors, set a default role to prevent infinite loading
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

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    userRole,
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
