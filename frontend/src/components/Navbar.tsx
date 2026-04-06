type Page = 'upload' | 'dashboard'

interface Props {
  page: Page
  onNavigate: (p: Page) => void
}

export default function Navbar({ page, onNavigate }: Props) {
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
