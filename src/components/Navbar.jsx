import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { onSnapshot, collection, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { markAsRead, markAllAsRead } from '../lib/notificationService'
import { getQuizSettings } from '../lib/quizSettings'

const NAV_MAP = {
  dashboard: 'home', '/dashboard': 'home',
  mylearn: 'learn', '/mylearn': 'learn',
  'quiz/select': 'exam', '/quiz/select': 'exam',
  contests: 'contest', '/contests': 'contest',
  leaderboard: 'rank', '/leaderboard': 'rank',
  profile: 'profile', '/profile': 'profile',
  'admin/users': 'users', '/admin/users': 'users',
  'admin/questions': 'questions', '/admin/questions': 'questions',
  'admin/courses': 'courses', '/admin/courses': 'courses',
  'admin/settings': 'settings', '/admin/settings': 'settings',
  'admin/analytics': 'analytics', '/admin/analytics': 'analytics',
}

const studentLinks = [
  { to: '/dashboard', icon: 'dashboard', label: 'Home' },
  { to: '/mylearn', icon: 'school', label: 'Learn' },
  { to: '/quiz/select', icon: 'list_alt', label: 'Exam' },
  { to: '/contests', icon: 'emoji_events', label: 'Contest' },
  { to: '/leaderboard', icon: 'leaderboard', label: 'Rank' },
  { to: '/profile', icon: 'person', label: 'Profile' },
]

const adminLinks = [
  { to: '/dashboard', icon: 'dashboard', label: 'Home' },
  { to: '/contests', icon: 'emoji_events', label: 'Contest' },
  { to: '/admin/users', icon: 'group', label: 'Users' },
  { to: '/admin/questions', icon: 'quiz', label: 'Questions' },
  { to: '/admin/courses', icon: 'school', label: 'Courses' },
  { to: '/admin/settings', icon: 'tune', label: 'Settings' },
  { to: '/admin/analytics', icon: 'bar_chart', label: 'Analytics' },
]

const moderatorLinks = [
  { to: '/dashboard', icon: 'dashboard', label: 'Home' },
  { to: '/mylearn', icon: 'school', label: 'Learn' },
  { to: '/quiz/select', icon: 'list_alt', label: 'Exam' },
  { to: '/contests', icon: 'emoji_events', label: 'Contest' },
  { to: '/admin/questions', icon: 'quiz', label: 'Questions' },
  { to: '/admin/courses', icon: 'school', label: 'Courses' },
  { to: '/profile', icon: 'person', label: 'Profile' },
]

function NotificationBell({ profile, navigate, dropdownUp }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!profile?.uid) return
    const q = query(collection(db, 'notifications'), where('userId', '==', profile.uid))
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      setNotifications(data.slice(0, 20))
      setUnreadCount(data.filter((n) => !n.read).length)
    })
    return unsub
  }, [profile?.uid])

  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    if (showDropdown) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showDropdown])

  const handleClick = async (n) => {
    if (!n.read) await markAsRead(n.id)
    setShowDropdown(false)
    if (n.data?.path) navigate(n.data.path)
  }

  const handleMarkAll = async () => {
    await markAllAsRead(profile?.uid)
    setShowDropdown(false)
  }

  const getIcon = (type) => {
    if (type === 'contest_invite') return 'mail'
    if (type === 'contest_start') return 'play_arrow'
    if (type === 'contest_result') return 'emoji_events'
    return 'notifications'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-1.5 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer text-on-surface-variant hover:text-on-surface">
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-error text-white text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 leading-none border-2 border-surface">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className={`absolute ${dropdownUp ? 'left-full bottom-full mb-1' : 'right-0 top-full mt-1'} w-80 bg-surface border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
            <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAll} className="text-[10px] text-primary font-semibold hover:underline cursor-pointer">Mark all read</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-on-surface-variant">No notifications</div>
            ) : (
              notifications.map((n) => (
                <button key={n.id} onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-container-low transition-colors cursor-pointer border-b border-outline-variant/30 last:border-0 ${
                    !n.read ? 'bg-primary-fixed/5' : ''
                  }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    n.type === 'contest_result' ? 'bg-amber-100 text-amber-600' :
                    n.type === 'contest_start' ? 'bg-green-100 text-green-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings: "'FILL' 1"}}>{getIcon(n.type)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${!n.read ? 'font-bold text-on-surface' : 'font-medium text-on-surface'}`}>{n.title}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[9px] text-on-surface-variant/60 mt-1">
                      {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [navAccess, setNavAccess] = useState(null)
  const isAdmin = profile?.role === 'admin'
  const isModerator = profile?.role === 'moderator'

  useEffect(() => {
    getQuizSettings().then((s) => setNavAccess(s.navAccess || {}))
  }, [])

  const role = profile?.role || 'student'
  const allLinks = isAdmin ? adminLinks : isModerator ? moderatorLinks : studentLinks
  const links = navAccess
    ? allLinks.filter((l) => {
        const key = NAV_MAP[l.to] || null
        if (!key) return true
        const sec = navAccess[key]
        return sec?.[role] !== false
      })
    : allLinks

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
          <div className="flex items-center justify-between pt-4 border-t border-outline-variant">
            <NotificationBell profile={profile} navigate={navigate} dropdownUp />
            <button onClick={() => navigate('/profile')} className="flex items-center gap-2 px-1 py-1 hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer text-left">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                  {(profile?.displayName || profile?.email || '?')[0].toUpperCase()}
                </div>
                {profile?.level > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-warning text-white text-[8px] font-bold px-1 py-0.5 rounded-full leading-none">Lv{profile.level}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-on-surface text-xs truncate">{profile?.displayName || 'User'}</p>
                <p className="text-[10px] truncate text-on-surface-variant">{profile?.role === 'moderator' ? 'moderator' : profile?.role} · {profile?.xp || 0} XP{(profile?.streak || 0) > 0 && <span className="ml-1 text-orange-500">🔥{profile.streak}</span>}</p>
              </div>
            </button>
          </div>
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
          <NotificationBell profile={profile} navigate={navigate} />
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
