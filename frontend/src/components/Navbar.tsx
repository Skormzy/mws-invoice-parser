import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Page = 'upload' | 'dashboard'

interface Props {
  page: Page
  onNavigate: (p: Page) => void
  user: User
}

export default function Navbar({ page, onNavigate, user }: Props) {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  // Display name: prefer email local part over full email
  const displayName = user.email?.split('@')[0] ?? user.email ?? 'User'
  // Friendly version: capitalize and replace dots/underscores
  const friendlyName = displayName
    .split(/[._]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')

  return (
    <nav className="bg-white border-b border-gray-200 h-14 flex items-center px-6 gap-8 sticky top-0 z-40">
      <span className="font-semibold text-gray-800 text-sm tracking-wide">
        MWS Invoice Parser
      </span>

      <div className="flex gap-1">
        <NavBtn active={page === 'upload'} onClick={() => onNavigate('upload')}>
          Upload
        </NavBtn>
        <NavBtn active={page === 'dashboard'} onClick={() => onNavigate('dashboard')}>
          Dashboard
        </NavBtn>
      </div>

      {/* User info + sign out — pushed to the right */}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm text-gray-500">{friendlyName}</span>
        <button
          onClick={handleSignOut}
          className="px-3 py-1.5 rounded text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}

function NavBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}
