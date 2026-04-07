import { useState } from 'react'
import { Toaster } from 'sonner'
import Navbar from './components/Navbar'
import UploadPage from './pages/UploadPage'
import DashboardPage from './pages/DashboardPage'

type Page = 'upload' | 'dashboard'

export default function App() {
  const [page, setPage] = useState<Page>('upload')

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar page={page} onNavigate={setPage} />
      {page === 'upload' ? <UploadPage /> : <DashboardPage />}
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
