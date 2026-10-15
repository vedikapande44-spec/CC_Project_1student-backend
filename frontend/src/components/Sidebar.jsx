
const items = [
  { label: 'Home', icon: '⌂' },
  { label: 'Add Student', icon: '+' },
  { label: 'Student List', icon: '▤' },
  { label: 'Search Student', icon: '⌕' },
  { label: 'Edit Student', icon: '✎' },
  { label: 'Delete Student', icon: '♧' },
]

export default function Sidebar({ page, onNavigate }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#home" onClick={e => {
        e.preventDefault()
        onNavigate('Home')
      }}>
        <span className="brand-icon">✦</span>
        <span>
          student<span className="brand-accent">hub</span>
          <small>LEARN · GROW · SUCCEED</small>
        </span>
      </a>

      <p className="sidebar-label">YOUR WORKSPACE</p>

      <nav className="sidebar-nav">
        {items.map(item => (
          <button
            key={item.label}
            className={`sidebar-link ${page === item.label ? 'active' : ''}`}
            onClick={() => onNavigate(item.label)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
            {page === item.label && <span className="active-dot" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-quote">
        <span className="quote-star">✳</span>
        <p>“Every student has a story worth growing.”</p>
        <small>YOUR CAMPUS, YOUR COMMUNITY</small>
      </div>

      <div className="sidebar-footer">
        <span className="footer-dot" />
        Student Management System
        <small>Version 1.0</small>
      </div>
    </aside>
  )
}
