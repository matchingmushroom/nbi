import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const studentLinks = [
  { to: '/dashboard', icon: 'dashboard', label: 'Home' },
  { to: '/quiz/select', icon: 'list_alt', label: 'Exam' },
  { to: '/results', icon: 'insights', label: 'Stats' },
  { to: '/leaderboard', icon: 'leaderboard', label: 'Rank' },
  { to: '/profile', icon: 'person', label: 'Profile' },
]

const adminLinks = [
  { to: '/dashboard', icon: 'dashboard', label: 'Home' },
  { to: '/admin/users', icon: 'group', label: 'Users' },
  { to: '/admin/questions', icon: 'quiz', label: 'Questions' },
  { to: '/admin/courses', icon: 'school', label: 'Courses' },
  { to: '/admin/settings', icon: 'tune', label: 'Settings' },
  { to: '/admin/analytics', icon: 'bar_chart', label: 'Analytics' },
]

const moderatorLinks = [
  { to: '/dashboard', icon: 'dashboard', label: 'Home' },
  { to: '/quiz/select', icon: 'list_alt', label: 'Exam' },
  { to: '/results', icon: 'insights', label: 'Stats' },
  { to: '/admin/questions', icon: 'quiz', label: 'Questions' },
  { to: '/admin/courses', icon: 'school', label: 'Courses' },
  { to: '/profile', icon: 'person', label: 'Profile' },
]

export default function Navbar() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = profile?.role === 'admin'
  const isModerator = profile?.role === 'moderator'
  const links = isAdmin ? adminLinks : isModerator ? moderatorLinks : studentLinks

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface border-r border-outline-variant z-50 py-6">
        <div className="px-6 mb-8">
          <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-primary">BankMastery</h1>
          <p className="text-xs text-on-surface-variant mt-0.5 font-medium tracking-wide uppercase">Learn. Practice. Master.</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive(link.to)
                  ? 'text-primary bg-[#f0f3ff] border-r-4 border-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-lowest'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>
        <div className="px-4 mt-auto space-y-2">
          <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface-variant border-t border-outline-variant pt-4 hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer text-left">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                {(profile?.displayName || profile?.email || '?')[0].toUpperCase()}
              </div>
              {profile?.level > 1 && (
                <span className="absolute -top-1.5 -right-1.5 bg-warning text-white text-[8px] font-bold px-1 py-0.5 rounded-full leading-none">Lv{profile.level}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-on-surface truncate">{profile?.displayName || 'User'}</p>
              <p className="text-xs truncate">{profile?.role === 'moderator' ? 'moderator' : profile?.role} · {profile?.xp || 0} XP</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-surface border-b border-outline-variant sticky top-0 z-40">
        <h1 className="font-['Hanken_Grotesk'] text-lg font-bold text-primary">BankMastery</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/profile')} className="relative cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">
              {(profile?.displayName || profile?.email || '?')[0].toUpperCase()}
            </div>
            {profile?.level > 1 && (
              <span className="absolute -top-1.5 -right-1.5 bg-warning text-white text-[7px] font-bold px-0.5 py-0.5 rounded-full leading-none">Lv{profile.level}</span>
            )}
          </button>
          <button onClick={handleLogout} className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-surface border-t border-outline-variant shadow-lg">
        <div className="flex justify-around items-center px-2 py-1.5">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
                isActive(link.to)
                  ? 'bg-[#f0f3ff] text-primary'
                  : 'text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]" style={isActive(link.to) ? { fontVariationSettings: "'FILL' 1" } : {}}>
                {link.icon}
              </span>
              <span className="text-[10px] font-medium leading-tight">{link.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
