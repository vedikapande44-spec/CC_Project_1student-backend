import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import AssistantView from './components/AssistantView'

const BASE_API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
const API = `${BASE_API}/api/students`

const blankForm = {
  studentId: '',
  name: '',
  email: '',
  department: '',
  semester: '1',
}

const MOTIVATIONAL_QUOTES = [
  { text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", author: "Malcolm X", tag: "Vision" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King", tag: "Wisdom" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi", tag: "Growth" },
  { text: "Small steps taken consistently create monumental transformation over time.", author: "Campus Wisdom", tag: "Persistence" },
  { text: "Knowledge has to be improved, challenged, and increased constantly.", author: "Peter Drucker", tag: "Excellence" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch", tag: "Inspiration" },
]

// Soft pastel themes for student avatars
const AVATAR_PALETTES = [
  { grad: 'linear-gradient(135deg, #a5b4fc, #6366f1)', text: '#ffffff' },
  { grad: 'linear-gradient(135deg, #fbcfe8, #ec4899)', text: '#ffffff' },
  { grad: 'linear-gradient(135deg, #6ee7b7, #10b981)', text: '#ffffff' },
  { grad: 'linear-gradient(135deg, #fde68a, #f59e0b)', text: '#ffffff' },
  { grad: 'linear-gradient(135deg, #7dd3fc, #0284c7)', text: '#ffffff' },
  { grad: 'linear-gradient(135deg, #d8b4fe, #8b5cf6)', text: '#ffffff' },
  { grad: 'linear-gradient(135deg, #fed7aa, #ea580c)', text: '#ffffff' },
  { grad: 'linear-gradient(135deg, #99f6e4, #0d9488)', text: '#ffffff' },
]

function getAvatarStyle(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length]
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return { text: 'Good morning', icon: '☀️' }
  if (hour < 17) return { text: 'Good afternoon', icon: '🌤️' }
  return { text: 'Good evening', icon: '🌙' }
}

// Generalized Campus Administrator Profile (Personalized to Ms. Vedika Pande)
const adminProfile = {
  name: 'Ms. Vedika Pande',
  displayName: 'Ms. Vedika Pande',
  role: 'Campus Administrator',
  email: 'vedika.pande@campus.edu',
  staffId: 'ADM-CAMPUS-01',
  department: 'Office of Campus Administration',
  accessLevel: 'Campus Administrator',
  office: 'Central Administration Office, Main Campus',
  phone: '+1 (800) 555-CAMPUS',
  joined: 'Campus Operations',
  permissions: [
    'Student Directory Management',
    'Academic Records & Mutations',
    'Gemini AI Assistant & MCP Tools',
    'Department Directory Reports & CSV Exports',
    'System Health & Diagnostics'
  ]
}

export default function App() {
  const [activeTab, setActiveTab] = useState('Overview')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState('All')
  const [selectedSem, setSelectedSem] = useState('All')
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  // Authentication & Profile States
  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showSystemModal, setShowSystemModal] = useState(false)
  const [systemDiagnostics, setSystemDiagnostics] = useState(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const profileMenuRef = useRef(null)

  // Dynamic Live Clock
  const [currentTime, setCurrentTime] = useState(new Date())

  // Dynamic Quote Rotation
  const [quoteIdx, setQuoteIdx] = useState(0)
  const [quoteFading, setQuoteFading] = useState(false)

  // Live clock ticker
  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(clockTimer)
  }, [])

  // Auto-dismiss notice after 4.5 seconds
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  // Click outside listener for Administrator dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch students from API
  async function loadStudents() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error('Could not load student records.')
      const data = await res.json()
      setStudents(Array.isArray(data) ? data : data.students || [])
    } catch {
      setError('Could not connect to the backend API. Please make sure the server is running on port 5000.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      loadStudents()
    }
  }, [isLoggedIn])

  // Rotate quotes smoothly every 12 seconds
  useEffect(() => {
    const quoteTimer = setInterval(() => {
      rotateQuote()
    }, 12000)
    return () => clearInterval(quoteTimer)
  }, [])

  function rotateQuote() {
    setQuoteFading(true)
    setTimeout(() => {
      setQuoteIdx(prev => (prev + 1) % MOTIVATIONAL_QUOTES.length)
      setQuoteFading(false)
    }, 240)
  }

  // Open System Diagnostics
  async function openSystemDiagnostics() {
    setShowSystemModal(true)
    setShowProfileMenu(false)
    setDiagnosticsLoading(true)
    try {
      const res = await fetch(`${BASE_API}/api/assistant/status`)
      const data = await res.json()
      setSystemDiagnostics(data)
    } catch (err) {
      setSystemDiagnostics({
        status: 'error',
        message: 'Could not fetch diagnostics from backend API.',
        databaseState: 'unknown'
      })
    } finally {
      setDiagnosticsLoading(false)
    }
  }

  // Logout handler
  function handleLogout() {
    setIsLoggedIn(false)
    setShowProfileMenu(false)
    setNotice('✓ You have been logged out.')
  }

  // Login handler
  function handleLogin(e) {
    e?.preventDefault()
    setIsLoggedIn(true)
    setNotice(`✨ Welcome back, ${adminProfile.name}!`)
  }

  // Departments List & Counts
  const allDepartments = useMemo(() => {
    const set = new Set(students.map(s => s.department).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [students])

  // Department Stats for Visual Progress & Badges
  const departmentStats = useMemo(() => {
    const counts = {}
    students.forEach(s => {
      const d = (s.department || 'General').trim()
      counts[d] = (counts[d] || 0) + 1
    })
    const total = students.length || 1
    const colors = [
      { color: '#6366f1', soft: '#eef2ff', name: 'Indigo' },
      { color: '#ec4899', soft: '#fdf2f8', name: 'Rose' },
      { color: '#10b981', soft: '#ecfdf5', name: 'Emerald' },
      { color: '#f59e0b', soft: '#fffbeb', name: 'Amber' },
      { color: '#0ea5e9', soft: '#f0f9ff', name: 'Sky' },
      { color: '#8b5cf6', soft: '#faf5ff', name: 'Violet' },
    ]
    return Object.entries(counts).map(([name, count], idx) => ({
      name,
      count,
      percentage: Math.round((count / total) * 100),
      theme: colors[idx % colors.length]
    }))
  }, [students])

  // Filtered students (unified search + department filter + semester filter)
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return students.filter(s => {
      const matchesDept = selectedDept === 'All' || s.department?.toLowerCase() === selectedDept.toLowerCase()
      const matchesSem = selectedSem === 'All' || String(s.semester) === String(selectedSem)
      const matchesQuery = !query || [s.studentId, s.name, s.email, s.department, s.semester]
        .some(val => String(val ?? '').toLowerCase().includes(query))
      return matchesDept && matchesSem && matchesQuery
    })
  }, [students, searchQuery, selectedDept, selectedSem])

  const distinctDepartmentsCount = useMemo(() => {
    return new Set(students.map(s => s.department).filter(Boolean)).size
  }, [students])

  const distinctSemestersCount = useMemo(() => {
    return new Set(students.map(s => s.semester).filter(Boolean)).size
  }, [students])

  function navigateTo(tab) {
    setActiveTab(tab)
    if (tab === 'New Student') {
      setEditingId(null)
      setForm(blankForm)
    }
  }

  function handleStartEdit(student) {
    setEditingId(student._id)
    setForm({
      studentId: student.studentId || '',
      name: student.name || '',
      email: student.email || '',
      department: student.department || '',
      semester: String(student.semester || 1),
    })
    setActiveTab('Edit Student')
  }

  async function handleSaveStudent(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const url = editingId ? `${API}/${editingId}` : API
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, semester: Number(form.semester) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to save student record.')
      await loadStudents()
      setNotice(editingId ? `✓ Updated record for ${form.name}` : `✓ Registered ${form.name}`)
      setEditingId(null)
      setForm(blankForm)
      setActiveTab('Students')
    } catch (err) {
      setNotice(`⚠️ Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteStudent(student) {
    if (!window.confirm(`Are you sure you want to delete ${student.name} (${student.studentId})?`)) return
    try {
      const res = await fetch(`${API}/${student._id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete request failed.')
      setStudents(prev => prev.filter(s => s._id !== student._id))
      setNotice(`✓ Deleted ${student.name}'s record.`)
    } catch (err) {
      setNotice(`⚠️ Failed to delete student: ${err.message}`)
    }
  }

  // Export to CSV function
  function handleExportCSV() {
    if (students.length === 0) {
      alert('No student records to export.')
      return
    }
    const headers = ['Student ID', 'Full Name', 'Email', 'Department', 'Semester']
    const rows = students.map(s => [
      `"${s.studentId || ''}"`,
      `"${s.name || ''}"`,
      `"${s.email || ''}"`,
      `"${s.department || ''}"`,
      s.semester || '1'
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `student_directory_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setNotice('✓ Student directory exported as CSV')
  }

  const greeting = getGreeting()
  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const quote = MOTIVATIONAL_QUOTES[quoteIdx]

  // =========================================================================
  // IF LOGGED OUT: DISPLAY MODERN LOGIN SCREEN
  // =========================================================================
  if (!isLoggedIn) {
    return (
      <div className="login-screen-wrapper">
        <div className="login-frosted-card">
          <div className="login-brand-header">
            <div className="brand-logo-glow large">
              <span className="brand-symbol">S</span>
            </div>
            <h2>StudentHub Campus Portal</h2>
            <p>Campus Administration & Student System</p>
          </div>

          <div className="login-role-card">
            <div className="login-avatar-circle">V</div>
            <div className="login-admin-meta">
              <strong>{adminProfile.name}</strong>
              <span>{adminProfile.role}</span>
              <small>{adminProfile.email}</small>
            </div>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label>Administrator Email</label>
              <input
                type="text"
                value={adminProfile.email}
                readOnly
                className="aesthetic-input"
              />
            </div>

            <div className="login-field">
              <label>Security Credential</label>
              <input
                type="password"
                defaultValue="••••••••••••"
                className="aesthetic-input"
              />
            </div>

            <button type="submit" className="btn-aurora-primary login-btn">
              <span>🔐</span> Sign In as Administrator
            </button>
          </form>

          <div className="login-footer-note">
            <span>Secure Campus Administration Portal</span>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // MAIN APPLICATION LAYOUT (WHEN LOGGED IN)
  // =========================================================================
  return (
    <div className="layout-container">
      {/* Floating Dynamic Notice Toast */}
      {notice && (
        <div className="floating-toast">
          <span className="toast-icon">✨</span>
          <span className="toast-text">{notice}</span>
          <button className="toast-dismiss" onClick={() => setNotice('')}>×</button>
        </div>
      )}

      {/* ===================================================================
          MODAL 1: ADMINISTRATOR FULL PROFILE DETAILS MODAL
         =================================================================== */}
      {showProfileModal && (
        <div className="modal-backdrop-blur" onClick={() => setShowProfileModal(false)}>
          <div className="aesthetic-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div className="profile-circle large">V</div>
                <div>
                  <h3 className="modal-heading">{adminProfile.name}</h3>
                  <span className="modal-subheading">{adminProfile.role}</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowProfileModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="profile-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Campus Email</span>
                  <strong className="detail-value">{adminProfile.email}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Staff ID</span>
                  <strong className="detail-value">{adminProfile.staffId}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Access Level</span>
                  <span className="badge-super-admin">{adminProfile.accessLevel}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Campus Office</span>
                  <strong className="detail-value">{adminProfile.office}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Contact Number</span>
                  <strong className="detail-value">{adminProfile.phone}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Department</span>
                  <strong className="detail-value">{adminProfile.department}</strong>
                </div>
              </div>

              <div className="permissions-section">
                <h4 className="permissions-title">System & Operational Privileges</h4>
                <div className="permissions-list">
                  {adminProfile.permissions.map((perm, idx) => (
                    <div key={idx} className="permission-chip">
                      <span className="perm-check">✓</span>
                      <span>{perm}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-soft-secondary" onClick={() => setShowProfileModal(false)}>
                Close
              </button>
              <button
                className="btn-danger-outline"
                onClick={() => {
                  setShowProfileModal(false)
                  handleLogout()
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 2: SYSTEM HEALTH & TELEMETRY DIAGNOSTICS MODAL
         =================================================================== */}
      {showSystemModal && (
        <div className="modal-backdrop-blur" onClick={() => setShowSystemModal(false)}>
          <div className="aesthetic-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div className="diag-icon-circle">⚡</div>
                <div>
                  <h3 className="modal-heading">System Diagnostics & Health</h3>
                  <span className="modal-subheading">Database & Campus Engine Telemetry</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowSystemModal(false)}>×</button>
            </div>

            <div className="modal-body">
              {diagnosticsLoading ? (
                <div className="loading-state-box">
                  <div className="spinner-ring" />
                  <span>Checking campus server connectivity...</span>
                </div>
              ) : systemDiagnostics ? (
                <div className="diagnostics-content">
                  <div className="diag-status-banner">
                    <div className="diag-pulse-dot" />
                    <div>
                      <strong>All Systems Online</strong>
                      <p>Database and operational services are healthy and responsive.</p>
                    </div>
                  </div>

                  <div className="diag-grid">
                    <div className="diag-card">
                      <span className="diag-card-label">Database Status</span>
                      <strong className="diag-card-val text-emerald">
                        ● {systemDiagnostics.databaseState || 'Connected'}
                      </strong>
                    </div>

                    <div className="diag-card">
                      <span className="diag-card-label">Active Tools</span>
                      <strong className="diag-card-val">
                        {systemDiagnostics.activeToolsCount || 15} Tools Registered
                      </strong>
                    </div>

                    <div className="diag-card">
                      <span className="diag-card-label">Execution Engine</span>
                      <strong className="diag-card-val">
                        Direct Query (Sub-second)
                      </strong>
                    </div>

                    <div className="diag-card">
                      <span className="diag-card-label">GitHub Integration</span>
                      <strong className="diag-card-val text-indigo">
                        Connected (Active)
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <p>Could not retrieve diagnostic data.</p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-soft-primary" onClick={() => setShowSystemModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          SIDEBAR
         =================================================================== */}
      <aside className="app-sidebar">
        {/* Brand */}
        <div className="sidebar-brand" onClick={() => navigateTo('Overview')}>
          <div className="brand-logo-glow">
            <span className="brand-symbol">S</span>
          </div>
          <div className="brand-text">
            <span className="brand-title">StudentHub</span>
            <span className="brand-subtitle">CAMPUS PLATFORM</span>
          </div>
        </div>

        {/* AI Copilot Featured Primary Nav Button */}
        <div className="ai-highlight-card" onClick={() => navigateTo('AI Assistant')}>
          <div className="ai-card-content">
            <div className="ai-card-left">
              <span className="ai-card-sparkle">✦</span>
              <div>
                <strong>Gemini Copilot</strong>
                <small>Campus AI Assistant</small>
              </div>
            </div>
            <span className="ai-badge-pulse">Active</span>
          </div>
        </div>

        {/* Primary Navigation Menu */}
        <div className="nav-group-label">NAVIGATION</div>
        <nav className="nav-menu">
          <button
            className={`nav-item ${activeTab === 'Overview' ? 'is-active' : ''}`}
            onClick={() => navigateTo('Overview')}
          >
            <span className="nav-icon">⌂</span>
            <span className="nav-text">Overview</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'Students' ? 'is-active' : ''}`}
            onClick={() => navigateTo('Students')}
          >
            <span className="nav-icon">▤</span>
            <span className="nav-text">Student Directory</span>
            <span className="nav-pill-badge">{students.length}</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'New Student' ? 'is-active' : ''}`}
            onClick={() => navigateTo('New Student')}
          >
            <span className="nav-icon">＋</span>
            <span className="nav-text">Add Student</span>
          </button>
        </nav>

        {/* Aesthetic Dynamic Quote Card in Sidebar */}
        <div className="sidebar-quote-box">
          <div className="quote-header">
            <span className="quote-tag-chip">{quote.tag}</span>
            <button className="quote-refresh-btn" onClick={rotateQuote} title="Next Inspiration">
              ↻
            </button>
          </div>
          <p className={`quote-text-content ${quoteFading ? 'fade-out' : ''}`}>
            "{quote.text}"
          </p>
          <span className="quote-signature">— {quote.author}</span>
        </div>

        {/* Bottom System Status (Clickable to open diagnostics) */}
        <div
          className="sidebar-bottom-status clickable-status"
          onClick={openSystemDiagnostics}
          title="Click to view live system status"
        >
          <div className="status-indicator-row">
            <span className="pulse-dot" />
            <span className="status-label-text">Database Connected</span>
          </div>
          <div className="status-sync-meta">
            System Online • Status ↗
          </div>
        </div>
      </aside>

      {/* ===================================================================
          MAIN CONTENT AREA & FROSTED HEADER
         =================================================================== */}
      <main className="main-content">
        <header className="app-header">
          <div className="header-breadcrumbs">
            <span className="crumb-sub">Portal</span>
            <span className="crumb-separator">/</span>
            <strong className="crumb-current">{activeTab}</strong>
          </div>

          <div className="header-meta-actions">
            {/* Live Clock Badge */}
            <div className="header-clock-pill">
              <span className="clock-pulse" />
              <span>{formattedDate}</span>
              <span className="clock-divider">•</span>
              <span className="clock-time">{formattedTime}</span>
            </div>

            {/* Quick Gemini CTA */}
            {activeTab !== 'AI Assistant' && (
              <button
                className="header-ai-btn"
                onClick={() => navigateTo('AI Assistant')}
                title="Launch Gemini Assistant"
              >
                <span className="sparkle">✦</span>
                <span>Copilot</span>
              </button>
            )}

            <div className="header-divider" />

            {/* User Profile with Interactive Dropdown */}
            <div className="user-profile-wrapper" ref={profileMenuRef}>
              <div
                className={`user-profile-badge ${showProfileMenu ? 'menu-active' : ''}`}
                onClick={() => setShowProfileMenu(prev => !prev)}
                title="Account options & Administrator details"
              >
                <div className="profile-circle">V</div>
                <div className="profile-details">
                  <span className="profile-name">{adminProfile.name}</span>
                  <span className="profile-title">{adminProfile.role} ▾</span>
                </div>
              </div>

              {/* Administrator Dropdown Menu */}
              {showProfileMenu && (
                <div className="profile-dropdown-menu">
                  <div className="dropdown-profile-header">
                    <div className="profile-circle large">V</div>
                    <div className="dropdown-meta">
                      <strong>{adminProfile.name}</strong>
                      <span className="dropdown-email">{adminProfile.email}</span>
                      <span className="dropdown-badge-pill">{adminProfile.accessLevel}</span>
                    </div>
                  </div>

                  <div className="dropdown-divider" />

                  <div className="dropdown-info-list">
                    <div className="info-row">
                      <span className="info-label">Staff ID:</span>
                      <strong className="info-val">{adminProfile.staffId}</strong>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Office:</span>
                      <strong className="info-val">{adminProfile.office}</strong>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Contact:</span>
                      <strong className="info-val">{adminProfile.phone}</strong>
                    </div>
                  </div>

                  <div className="dropdown-divider" />

                  <div className="dropdown-actions-menu">
                    <button
                      className="dropdown-action-btn"
                      onClick={() => {
                        setShowProfileModal(true)
                        setShowProfileMenu(false)
                      }}
                    >
                      <span className="action-icon">👤</span>
                      <div className="action-text">
                        <strong>View Full Profile</strong>
                        <small>Staff credentials & permissions</small>
                      </div>
                    </button>

                    <button
                      className="dropdown-action-btn"
                      onClick={openSystemDiagnostics}
                    >
                      <span className="action-icon">⚡</span>
                      <div className="action-text">
                        <strong>System Health</strong>
                        <small>Service status & telemetry</small>
                      </div>
                    </button>

                    <button
                      className="dropdown-action-btn action-danger"
                      onClick={handleLogout}
                    >
                      <span className="action-icon">🚪</span>
                      <div className="action-text">
                        <strong>Sign Out</strong>
                        <small>End administrator session</small>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Moving Text Ticker */}
        <div className="campus-ticker-container">
          <div className="ticker-badge">
            <span className="ticker-pulse-dot" />
            <span>CAMPUS LIVE</span>
          </div>
          <div className="ticker-track-wrapper">
            <div className="ticker-track">
              <div className="ticker-item"><span>🎓</span> 2026 Academic Session In Progress</div>
              <div className="ticker-sep">•</div>
              <div className="ticker-item"><span>✦</span> Gemini Copilot Active</div>
              <div className="ticker-sep">•</div>
              <div className="ticker-item"><span>🏛️</span> Multi-Faculty Department Directory</div>
              <div className="ticker-sep">•</div>
              <div className="ticker-item"><span>📊</span> Real-Time Academic Analytics</div>
              <div className="ticker-sep">•</div>
              <div className="ticker-item"><span>📥</span> Instant CSV Directory Export</div>
              <div className="ticker-sep">•</div>
              <div className="ticker-item"><span>⚡</span> Automated Student Records</div>
              <div className="ticker-sep">•</div>
              {/* Duplicate set for seamless continuous marquee loop */}
              <div className="ticker-item"><span>🎓</span> 2026 Academic Session In Progress</div>
              <div className="ticker-sep">•</div>
              <div className="ticker-item"><span>✦</span> Gemini Copilot Active</div>
              <div className="ticker-sep">•</div>
              <div className="ticker-item"><span>🏛️</span> Multi-Faculty Department Directory</div>
              <div className="ticker-sep">•</div>
              <div className="ticker-item"><span>📊</span> Real-Time Academic Analytics</div>
              <div className="ticker-sep">•</div>
              <div className="ticker-item"><span>📥</span> Instant CSV Directory Export</div>
              <div className="ticker-sep">•</div>
              <div className="ticker-item"><span>⚡</span> Automated Student Records</div>
              <div className="ticker-sep">•</div>
            </div>
          </div>
        </div>

        {/* Page Body */}
        <div className="page-body">
          {error && (
            <div className="alert-error-banner">
              <span className="error-icon">⚠️</span>
              <div className="error-body">
                <strong>Connection Error:</strong> {error}
              </div>
              <button className="error-retry-btn" onClick={loadStudents}>Retry</button>
            </div>
          )}

          {/* VIEW 1: AESTHETIC OVERVIEW DASHBOARD */}
          {activeTab === 'Overview' && (
            <div className="overview-view">
              {/* Soft Aurora Hero Card with Design Pattern & Visual Graphics */}
              <section className="aurora-hero-card clean-hero">
                {/* Ambient Soft Glow Orbs */}
                <div className="hero-decor-orb orb-indigo" />
                <div className="hero-decor-orb orb-rose" />
                <div className="hero-decor-orb orb-emerald" />

                <div className="hero-content full-width">
                  <div className="hero-top-row">
                    <div className="hero-greeting-pill">
                      <span>{greeting.icon}</span>
                      <span>{greeting.text}</span>
                    </div>
                    <div className="hero-portal-badge">
                      <span className="badge-spark">✦</span>
                      <span>Academic Portal</span>
                    </div>
                  </div>

                  <h1 className="hero-title">
                    StudentHub Academic Portal
                  </h1>
                  <p className="hero-description">
                    Unified management for student enrollment, faculty records, and intelligent academic workflows.
                  </p>

                  <div className="hero-action-buttons">
                    <button className="btn-aurora-primary" onClick={() => navigateTo('New Student')}>
                      <span>＋</span> Register Student
                    </button>
                    <button className="btn-aurora-secondary" onClick={() => navigateTo('Students')}>
                      Student Directory <span>→</span>
                    </button>
                    <button className="btn-aurora-glass" onClick={() => navigateTo('AI Assistant')}>
                      <span>✦</span> Launch Copilot
                    </button>
                  </div>
                </div>

                {/* Campus Graphic Motif */}
                <div className="hero-visual-motif">
                  <div className="motif-badge-icon">🏛️</div>
                  <div className="motif-meta">
                    <strong>Central Campus Operations</strong>
                    <span>Academic Information System</span>
                  </div>
                </div>
              </section>

              {/* Dynamic Interactive Metrics Grid */}
              <div className="section-header-row">
                <div>
                  <h2 className="section-title">Academic Metrics</h2>
                </div>
                <div className="sync-badge" onClick={loadStudents} style={{ cursor: 'pointer' }} title="Click to refresh">
                  <span className="sync-dot" /> Live Data ↻
                </div>
              </div>

              <section className="aesthetic-metrics-grid">
                {/* Metric 1 */}
                <div className="metric-box box-indigo">
                  <div className="metric-top">
                    <div className="metric-icon-bubble bubble-indigo">👥</div>
                    <span className="metric-pill pill-indigo">Total Directory</span>
                  </div>
                  <div className="metric-val-row">
                    <span className="metric-huge-number">{loading ? '…' : students.length}</span>
                    <span className="metric-trend-positive">↑ Active</span>
                  </div>
                  <span className="metric-caption">Enrolled students</span>
                </div>

                {/* Metric 2 */}
                <div className="metric-box box-rose">
                  <div className="metric-top">
                    <div className="metric-icon-bubble bubble-rose">🏛️</div>
                    <span className="metric-pill pill-rose">Faculties</span>
                  </div>
                  <div className="metric-val-row">
                    <span className="metric-huge-number">{loading ? '…' : distinctDepartmentsCount}</span>
                    <span className="metric-trend-neutral">Disciplines</span>
                  </div>
                  <span className="metric-caption">Academic departments</span>
                </div>

                {/* Metric 3 */}
                <div className="metric-box box-emerald">
                  <div className="metric-top">
                    <div className="metric-icon-bubble bubble-emerald">🎓</div>
                    <span className="metric-pill pill-emerald">Active Terms</span>
                  </div>
                  <div className="metric-val-row">
                    <span className="metric-huge-number">{loading ? '…' : distinctSemestersCount}</span>
                    <span className="metric-trend-positive">Semesters 1-8</span>
                  </div>
                  <span className="metric-caption">Semesters in session</span>
                </div>
              </section>

              {/* Department Distribution Visualizer */}
              {departmentStats.length > 0 && (
                <section className="distribution-card">
                  <div className="distribution-header">
                    <div>
                      <h3 className="card-heading">Department Distribution</h3>
                    </div>
                    <button className="btn-text-action" onClick={() => navigateTo('Students')}>
                      Filter by Department →
                    </button>
                  </div>

                  {/* Multi-segmented color bar */}
                  <div className="segmented-bar">
                    {departmentStats.map((dept, i) => (
                      <div
                        key={i}
                        className="segment-bar-fill"
                        style={{
                          width: `${Math.max(dept.percentage, 5)}%`,
                          backgroundColor: dept.theme.color,
                        }}
                        title={`${dept.name}: ${dept.count} students (${dept.percentage}%)`}
                      />
                    ))}
                  </div>

                  {/* Department Chips with counts */}
                  <div className="department-pills-row">
                    {departmentStats.map((dept, i) => (
                      <div
                        key={i}
                        className="dept-stat-pill"
                        onClick={() => {
                          setSelectedDept(dept.name)
                          navigateTo('Students')
                        }}
                        title="Click to filter students in this department"
                      >
                        <span className="dept-color-dot" style={{ backgroundColor: dept.theme.color }} />
                        <span className="dept-name-text">{dept.name}</span>
                        <strong className="dept-count-text">{dept.count}</strong>
                        <span className="dept-percent-text">({dept.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Recent Students Table Card */}
              <section className="glass-panel-card">
                <div className="panel-header-row">
                  <div>
                    <h3 className="card-heading">Recent Enrollments</h3>
                  </div>
                  <div className="panel-header-buttons">
                    <button className="btn-soft-secondary" onClick={handleExportCSV}>
                      📥 Export CSV
                    </button>
                    <button className="btn-soft-primary" onClick={() => navigateTo('Students')}>
                      Full Directory ↗
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="loading-state-box">
                    <div className="spinner-ring" />
                    <span>Loading student records...</span>
                  </div>
                ) : students.length === 0 ? (
                  <div className="empty-state-box">
                    <span className="empty-icon">📂</span>
                    <h4>No student records found</h4>
                    <button className="btn-aurora-primary" onClick={() => navigateTo('New Student')}>
                      Add First Student
                    </button>
                  </div>
                ) : (
                  <div className="modern-table-container">
                    <table className="aesthetic-table">
                      <thead>
                        <tr>
                          <th>STUDENT NAME</th>
                          <th>STUDENT ID</th>
                          <th>DEPARTMENT</th>
                          <th>SEMESTER</th>
                          <th className="th-center">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.slice(0, 5).map(s => {
                          const avStyle = getAvatarStyle(s.name)
                          return (
                            <tr key={s._id || s.studentId} className="table-row-hover">
                              <td>
                                <div className="student-info-cell">
                                  <div
                                    className="student-avatar-badge"
                                    style={{ background: avStyle.grad, color: avStyle.text }}
                                  >
                                    {(s.name || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="student-name-meta">
                                    <strong className="student-name">{s.name}</strong>
                                    <span className="student-email">{s.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="id-code-badge">{s.studentId}</span>
                              </td>
                              <td>
                                <span className="department-tag">{s.department || 'General'}</span>
                              </td>
                              <td>
                                <span className="semester-pill-badge">
                                  Term {s.semester}
                                </span>
                              </td>
                              <td className="td-center">
                                <button
                                  className="action-icon-button"
                                  onClick={() => handleStartEdit(s)}
                                  title="Edit student record"
                                >
                                  ✎
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* VIEW 2: BEAUTIFUL UNIFIED STUDENT DIRECTORY */}
          {activeTab === 'Students' && (
            <div className="directory-view">
              <div className="glass-panel-card">
                <div className="panel-header-row">
                  <div>
                    <h2 className="card-heading">Student Directory</h2>
                  </div>

                  <div className="panel-header-buttons">
                    <button className="btn-soft-secondary" onClick={handleExportCSV}>
                      📥 Export CSV
                    </button>
                    <button className="btn-aurora-primary" onClick={() => navigateTo('New Student')}>
                      <span>＋</span> Add Student
                    </button>
                  </div>
                </div>

                {/* Aesthetic Filter & Search Bar */}
                <div className="search-filter-section">
                  <div className="aesthetic-search-box">
                    <span className="search-symbol">⌕</span>
                    <input
                      type="text"
                      placeholder="Search by student name, ID, email, or department..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                        ×
                      </button>
                    )}
                  </div>

                  <div className="filter-dropdowns-row">
                    <div className="select-pill-wrapper">
                      <span className="select-label">Semester:</span>
                      <select
                        value={selectedSem}
                        onChange={e => setSelectedSem(e.target.value)}
                        className="aesthetic-select"
                      >
                        <option value="All">All Semesters</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                          <option key={n} value={n}>Semester {n}</option>
                        ))}
                      </select>
                    </div>

                    <div className="select-pill-wrapper">
                      <span className="select-label">Department:</span>
                      <select
                        value={selectedDept}
                        onChange={e => setSelectedDept(e.target.value)}
                        className="aesthetic-select"
                      >
                        {allDepartments.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Quick Department Filter Chips */}
                <div className="quick-dept-chips-row">
                  {allDepartments.map(dept => {
                    const count = dept === 'All'
                      ? students.length
                      : students.filter(s => s.department?.toLowerCase() === dept.toLowerCase()).length
                    const isActive = selectedDept.toLowerCase() === dept.toLowerCase()
                    return (
                      <button
                        key={dept}
                        className={`filter-chip ${isActive ? 'is-active' : ''}`}
                        onClick={() => setSelectedDept(dept)}
                      >
                        <span>{dept}</span>
                        <span className="chip-count">{count}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Student Records Table */}
                {loading ? (
                  <div className="loading-state-box">
                    <div className="spinner-ring" />
                    <span>Loading student directory...</span>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="empty-state-box">
                    <span className="empty-icon">🔍</span>
                    <h4>No student records match your filters</h4>
                    <button
                      className="btn-soft-primary"
                      onClick={() => {
                        setSearchQuery('')
                        setSelectedDept('All')
                        setSelectedSem('All')
                      }}
                    >
                      Clear All Filters
                    </button>
                  </div>
                ) : (
                  <div className="modern-table-container">
                    <table className="aesthetic-table">
                      <thead>
                        <tr>
                          <th>STUDENT NAME</th>
                          <th>STUDENT ID</th>
                          <th>DEPARTMENT</th>
                          <th>SEMESTER</th>
                          <th className="th-center">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map(s => {
                          const avStyle = getAvatarStyle(s.name)
                          return (
                            <tr key={s._id || s.studentId} className="table-row-hover">
                              <td>
                                <div className="student-info-cell">
                                  <div
                                    className="student-avatar-badge"
                                    style={{ background: avStyle.grad, color: avStyle.text }}
                                  >
                                    {(s.name || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="student-name-meta">
                                    <strong className="student-name">{s.name}</strong>
                                    <span className="student-email">{s.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="id-code-badge">{s.studentId}</span>
                              </td>
                              <td>
                                <span className="department-tag">{s.department || 'General'}</span>
                              </td>
                              <td>
                                <span className="semester-pill-badge">
                                  Semester {s.semester}
                                </span>
                              </td>
                              <td className="td-center">
                                <div className="table-actions-cell">
                                  <button
                                    className="action-icon-button"
                                    onClick={() => handleStartEdit(s)}
                                    title="Edit student"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    className="action-icon-button btn-delete-action"
                                    onClick={() => handleDeleteStudent(s)}
                                    title="Delete student"
                                  >
                                    ×
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="directory-footer-meta">
                  <span>Showing <strong>{filteredStudents.length}</strong> of {students.length} students enrolled</span>
                  {(selectedDept !== 'All' || selectedSem !== 'All' || searchQuery) && (
                    <button
                      className="btn-clear-inline"
                      onClick={() => {
                        setSearchQuery('')
                        setSelectedDept('All')
                        setSelectedSem('All')
                      }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: ELEGANT REGISTER / EDIT STUDENT FORM */}
          {(activeTab === 'New Student' || activeTab === 'Edit Student') && (
            <div className="form-view-container">
              <div className="glass-panel-card form-box-card">
                <div className="form-header-bar">
                  <div className="form-icon-circle">
                    {editingId ? '✎' : '✨'}
                  </div>
                  <div>
                    <h2 className="card-heading">
                      {editingId ? 'Update Student Record' : 'Register New Student'}
                    </h2>
                  </div>
                </div>

                <form onSubmit={handleSaveStudent} className="aesthetic-form">
                  <div className="form-grid">
                    <div className="input-group">
                      <label className="input-label">Student ID <span className="req">*</span></label>
                      <input
                        className="aesthetic-input"
                        name="studentId"
                        value={form.studentId}
                        onChange={e => setForm({ ...form, studentId: e.target.value })}
                        placeholder="e.g. ST2026"
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Full Name <span className="req">*</span></label>
                      <input
                        className="aesthetic-input"
                        name="name"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Maya Sharma"
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Email Address <span className="req">*</span></label>
                      <input
                        className="aesthetic-input"
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="e.g. maya.sharma@college.edu"
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Department <span className="req">*</span></label>
                      <input
                        className="aesthetic-input"
                        name="department"
                        value={form.department}
                        onChange={e => setForm({ ...form, department: e.target.value })}
                        placeholder="e.g. Computer Science"
                        required
                      />
                    </div>

                    <div className="input-group full-width-field">
                      <label className="input-label">Semester <span className="req">*</span></label>
                      <select
                        className="aesthetic-input aesthetic-select-lg"
                        name="semester"
                        value={form.semester}
                        onChange={e => setForm({ ...form, semester: e.target.value })}
                        required
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                          <option key={n} value={n}>
                            Semester {n} {n <= 2 ? '(Year 1)' : n <= 4 ? '(Year 2)' : n <= 6 ? '(Year 3)' : '(Year 4)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-action-footer">
                    <button
                      type="button"
                      className="btn-soft-secondary"
                      onClick={() => navigateTo('Students')}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-aurora-primary"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <div className="button-spinner" />
                          <span>Saving Record...</span>
                        </>
                      ) : editingId ? (
                        'Save Updates'
                      ) : (
                        'Register Student'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* VIEW 4: GEMINI COPILOT ASSISTANT */}
          {activeTab === 'AI Assistant' && (
            <div className="assistant-container">
              <AssistantView
                onStudentModified={loadStudents}
                onNavigate={navigateTo}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
