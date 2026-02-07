import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const SessionContext = createContext()

export function SessionProvider({ children }) {
  const { user } = useAuth()
  const [activeSession, setActiveSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [lastEndedSession, setLastEndedSession] = useState(null)

  console.log('🔵 SessionContext - lastEndedSession state:', lastEndedSession)

  useEffect(() => {
    if (user) {
      loadActiveSession()
    } else {
      setActiveSession(null)
      setLoading(false)
    }
  }, [user])

  // Timer effect - update elapsed time every second
  useEffect(() => {
    if (!activeSession) {
      setElapsedTime(0)
      return
    }

    const updateElapsedTime = () => {
      const start = new Date(activeSession.start_time)
      const now = new Date()
      const elapsed = Math.floor((now - start) / 1000) // seconds
      setElapsedTime(elapsed)
    }

    updateElapsedTime()
    const interval = setInterval(updateElapsedTime, 1000)

    return () => clearInterval(interval)
  }, [activeSession])

  const loadActiveSession = async () => {
    try {
      const { data, error } = await supabase
        .from('fishing_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('start_time', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error
      }

      setActiveSession(data || null)
    } catch (error) {
      console.error('Error loading active session:', error)
    } finally {
      setLoading(false)
    }
  }

  const startSession = async (sessionData) => {
    try {
      const { data, error } = await supabase
        .from('fishing_sessions')
        .insert([
          {
            user_id: user.id,
            session_date: new Date().toISOString().split('T')[0],
            start_time: new Date().toISOString(),
            is_active: true,
            ...sessionData
          }
        ])
        .select()
        .single()

      if (error) throw error

      setActiveSession(data)
      return { success: true, session: data }
    } catch (error) {
      console.error('Error starting session:', error)
      return { success: false, error: error.message }
    }
  }

  const endSession = async (sessionId, endData = {}) => {
    console.log('🔵 endSession called with sessionId:', sessionId)
    
    try {
      const endTime = new Date().toISOString()
      
      const { data, error } = await supabase
        .from('fishing_sessions')
        .update({
          end_time: endTime,
          is_active: false,
          ...endData
        })
        .eq('id', sessionId)
        .select()
        .single()

      if (error) throw error
      console.log('🔵 Session updated in database:', data)

      // Calculate session stats
      console.log('🔵 Calling calculate_session_stats...')
      const { error: rpcError } = await supabase.rpc('calculate_session_stats', {
        session_uuid: sessionId
      })

      if (rpcError) {
        console.error('🔴 RPC error:', rpcError)
      } else {
        console.log('🔵 Stats calculation completed')
      }

      // Wait a moment for stats to be calculated
      await new Promise(resolve => setTimeout(resolve, 500))

      // Fetch the updated session WITH calculated stats
      console.log('🔵 Fetching updated session...')
      const { data: updatedSession, error: fetchError } = await supabase
        .from('fishing_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (fetchError) {
        console.error('🔴 Error fetching updated session:', fetchError)
      } else {
        console.log('🔵 Updated session fetched:', updatedSession)
      }

      // Clear active session
      console.log('🔵 Clearing activeSession...')
      setActiveSession(null)

      // Store the ended session for popup display
      if (updatedSession) {
        console.log('🟢 SETTING lastEndedSession:', updatedSession)
        setLastEndedSession(updatedSession)
        console.log('🟢 lastEndedSession state should now be set!')
      } else {
        console.log('🔴 No updatedSession to set')
      }

      return { success: true, session: updatedSession || data }
    } catch (error) {
      console.error('🔴 Error ending session:', error)
      return { success: false, error: error.message }
    }
  }

  const refreshActiveSession = async () => {
    if (activeSession) {
      await loadActiveSession()
    }
  }

  const clearSession = () => {
    setActiveSession(null)
  }

  const clearLastEndedSession = () => {
    console.log('🔵 Clearing lastEndedSession')
    setLastEndedSession(null)
  }

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const value = {
    activeSession,
    loading,
    elapsedTime,
    formatDuration,
    startSession,
    endSession,
    refreshActiveSession,
    clearSession,
    hasActiveSession: !!activeSession,
    lastEndedSession,
    clearLastEndedSession
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
