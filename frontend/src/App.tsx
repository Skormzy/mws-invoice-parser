import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Navbar from './components/Navbar'
import UploadPage from './pages/UploadPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'

type Page = 'upload' | 'dashboard'

export default function App() {
  const [page, setPage] = useState<Page>('upload')
  const [user, setUser] = useState<User | null | undefined>(undefined) // undefined = loading

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    // Listen for auth state changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Loading state — don't flash login page before session check completes
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    )
  }

  // Not authenticated
  if (user === null) {
    return (
      <>
        <LoginPage />
        <Toaster position="bottom-right" richColors />
      </>
    )
  }

  // Authenticated
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar page={page} onNavigate={setPage} user={user} />
      {page === 'upload' ? <UploadPage /> : <DashboardPage />}
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
