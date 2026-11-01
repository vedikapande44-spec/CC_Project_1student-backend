
import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/api/students`

const blankForm = {
  studentId: '',
  name: '',
  email: '',
  department: '',
  semester: '1',
}

const navItems = [
  { label: 'Home', icon: '⌂' },
  { label: 'Add Student', icon: '+' },
  { label: 'Student List', icon: '▤' },
  { label: 'Search Student', icon: '⌕' },
  { label: 'Edit Student', icon: '✎' },
  { label: 'Delete Student', icon: '×' },
]

function App() {
  const [page, setPage] = useState('Home')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  async function loadStudents() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error('Could not load student records.')
      const data = await res.json()
      setStudents(Array.isArray(data) ? data : data.students || [])
    } catch {
      setError('Could not connect to the API. Check your backend URL and make sure the server is running.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStudents()
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return students.filter(s =>
      [s.studentId, s.name, s.email, s.department, s.semester]
        .some(value => String(value ?? '').toLowerCase().includes(term))
    )
  }, [students, query])

  const departments = new Set(students.map(s => s.department).filter(Boolean)).size
  const semesters = new Set(students.map(s => s.semester).filter(Boolean)).size

  function navigate(nextPage) {
    setPage(nextPage)
    setNotice('')
    setQuery('')
    if (nextPage === 'Add Student') {
      setEditingId(null)
      setForm(blankForm)
    }
  }

  function startEdit(student) {
    setEditingId(student._id)
    setForm({
      studentId: student.studentId || '',
      name: student.name || '',
      email: student.email || '',
      department: student.department || '',
      semester: String(student.semester || 1),
    })
    setPage('Edit Student')
    setNotice('')
  }

  async function saveStudent(event) {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    try {
      const url = editingId ? `${API}/${editingId}` : API
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, semester: Number(form.semester) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || data.error || 'Unable to save this student.')
      await loadStudents()
      setNotice(editingId ? 'Student updated successfully ✨' : 'Student added successfully ✨')
      setEditingId(null)
      setForm(blankForm)
      setPage('Student List')
    } catch (err) {
      setNotice(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteStudent(student) {
    if (!window.confirm(`Delete the record for ${student.name}? This cannot be undone.`)) return
    setNotice('')
    try {
      const res = await fetch(`${API}/${student._id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not delete this student.')
      setStudents(current => current.filter(s => s._id !== student._id))
      setNotice(`${student.name}'s record has been deleted.`)
    } catch (err) {
      setNotice(err.message || 'Delete failed.')
    }
  }

  const title = page === 'Home' ? 'A little room to grow' : page
  const recentStudents = [...students].slice(-4).reverse()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('Home')} aria-label="Go to home">
          <span className="brand-mark">s<span>✳</span></span>
          <span className="brand-name">student<span>hub</span><small>YOUR CAMPUS, ORGANIZED</small></span>
        </button>

        <div className="nav-caption">YOUR WORKSPACE</div>
        <nav className="side-nav">
          {navItems.map(item => (
            <button key={item.label}
              className={`nav-link ${page === item.label ? 'is-active' : ''}`}
              onClick={() => navigate(item.label)}>
              <span className="nav-symbol">{item.icon}</span>
              <span>{item.label}</span>
              {item.label === 'Student List' && <span className="nav-count">{students.length}</span>}
              {page === item.label && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <div className="note-flower">✳</div>
          <p>Small steps make<br />big <em>stories.</em></p>
          <span>A SPACE FOR EVERY STUDENT</span>
          <div className="note-decoration">✦</div>
        </div>

        <div className="sidebar-bottom">
          <span className="status-dot" />
          <span>Student Management</span>
          <small>Made with care · v1.0</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="crumb">Workspace <span>/</span> <strong>{title}</strong></div>
          <div className="topbar-right"><span className="top-live-dot" /> <span>Student records</span><div className="profile-chip">S</div></div>
        </header>

        <div className="content-area">
          {notice && <div className="notice"><span>✳</span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
          {error && <div className="error-banner">{error}<button onClick={loadStudents}>Try again ↗</button></div>}

          {page === 'Home' && (
            <div className="dashboard">
              <section className="hero">
                <div className="hero-copy">
                  <span className="eyebrow"><span>✦</span> A BETTER WAY TO STAY ORGANIZED</span>
                  <h1>Good things grow<br />when students <span className="word-cycle">thrive.</span></h1>
                  <p className="hero-description">A thoughtful little space for managing student records, tracking details and keeping campus life in order.</p>
                  <div className="hero-actions">
                    <button className="primary-button" onClick={() => navigate('Add Student')}>＋ Add a student <span>↗</span></button>
                    <button className="text-button" onClick={() => navigate('Student List')}>Explore directory <span>→</span></button>
                  </div>
                  <div className="hero-footnote"><span>✳</span> Thoughtfully organized, just for you.</div>
                </div>

                <div className="hero-art" aria-label="Decorative illustration of books and a graduation cap">
                  <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
                  <span className="art-star star-one">✦</span><span className="art-star star-two">✧</span>
                  <span className="art-sprig">❋</span>
                  <div className="art-plant"><i /><i /><i /><b /></div>
                  <div className="illustration-books">
                    <div className="book-shape book-lilac" /><div className="book-shape book-cream" /><div className="book-shape book-peach" />
                  </div>
                  <div className="graduation-cap"><div className="cap-board" /><div className="cap-crown" /><div className="cap-string" /></div>
                  <div className="art-label">learn <span>·</span> grow <span>·</span> shine</div>
                </div>
              </section>

              <section className="section-heading">
                <div><span className="section-kicker">THE BIG PICTURE</span><h2>Your little overview <span>✳</span></h2><p>A fresh snapshot of your student community.</p></div>
                <span className="live-badge"><i /> LIVE RECORDS</span>
              </section>

              <section className="stats-grid">
                <article className="stat-card stat-lavender"><div className="stat-top"><span>Total students</span><span className="stat-icon">♧</span></div><strong>{loading ? '—' : students.length.toString().padStart(2, '0')}</strong><small>Records in your directory</small><span className="stat-scribble">✳</span></article>
                <article className="stat-card stat-peach"><div className="stat-top"><span>Departments</span><span className="stat-icon">✿</span></div><strong>{loading ? '—' : departments.toString().padStart(2, '0')}</strong><small>Fields of learning</small><span className="stat-scribble">✧</span></article>
                <article className="stat-card stat-mint"><div className="stat-top"><span>Semesters</span><span className="stat-icon">▤</span></div><strong>{loading ? '—' : semesters.toString().padStart(2, '0')}</strong><small>Learning in progress</small><span className="stat-scribble">⌁</span></article>
              </section>

              <section className="panel recent-panel">
                <div className="panel-heading"><div><span className="panel-icon">♧</span><div><h2>Recently added</h2><p>A little peek at your student directory.</p></div></div><button className="panel-link" onClick={() => navigate('Student List')}>View all <span>→</span></button></div>
                {loading ? <div className="empty-state">Gathering your records…</div> : recentStudents.length === 0 ? (
                  <div className="empty-state"><div className="empty-flower">✿</div><h3>A lovely blank page.</h3><p>Your first student record can start right here.</p><button className="text-button" onClick={() => navigate('Add Student')}>Add your first student ↗</button></div>
                ) : <StudentRows students={recentStudents} />}
              </section>
              <footer className="page-footer"><span>Made for a brighter campus <b>♡</b></span><span>STUDENTHUB · LEARN / GROW / SUCCEED</span></footer>
            </div>
          )}

          {page === 'Add Student' && (
            <StudentForm form={form} setForm={setForm} onSubmit={saveStudent} saving={saving} editing={false} onCancel={() => navigate('Home')} />
          )}

          {page === 'Edit Student' && (
            editingId ? <StudentForm form={form} setForm={setForm} onSubmit={saveStudent} saving={saving} editing onCancel={() => { setEditingId(null); navigate('Student List') }} />
              : <StudentDirectory students={students} loading={loading} query={query} setQuery={setQuery} onEdit={startEdit} onDelete={deleteStudent} mode="edit" />
          )}

          {page === 'Student List' && (
            <StudentDirectory students={filtered} loading={loading} query={query} setQuery={setQuery} onEdit={startEdit} onDelete={deleteStudent} mode="list" />
          )}

          {page === 'Search Student' && (
            <StudentDirectory students={filtered} loading={loading} query={query} setQuery={setQuery} onEdit={startEdit} onDelete={deleteStudent} mode="search" />
          )}

          {page === 'Delete Student' && (
            <StudentDirectory students={filtered} loading={loading} query={query} setQuery={setQuery} onEdit={startEdit} onDelete={deleteStudent} mode="delete" />
          )}
        </div>
      </main>
    </div>
  )
}

function StudentRows({ students, onEdit, onDelete }) {
  return (
    <div className="student-rows">
      {students.map((s, index) => (
        <div className="student-row" key={s._id || s.studentId}>
          <div className={`student-avatar avatar-${index % 4}`}>{(s.name || '?').trim().charAt(0).toUpperCase()}</div>
          <div className="student-identity"><strong>{s.name}</strong><small>{s.email}</small></div>
          <span className="department-pill">{s.department || 'No department'}</span>
          <span className="student-id">{s.studentId}</span>
          {onEdit && <button className="row-action" onClick={() => onEdit(s)} aria-label={`Edit ${s.name}`}>↗</button>}
          {onDelete && <button className="row-action delete-action" onClick={() => onDelete(s)} aria-label={`Delete ${s.name}`}>×</button>}
        </div>
      ))}
    </div>
  )
}

function StudentForm({ form, setForm, onSubmit, saving, editing, onCancel }) {
  const update = event => setForm({ ...form, [event.target.name]: event.target.value })
  return (
    <section className="page-view">
      <div className="page-intro"><span className="eyebrow"><span>✦</span> STUDENT DETAILS</span><h1>{editing ? 'A little update.' : 'A new beginning.'}</h1><p>{editing ? 'Keep this student’s information fresh and accurate.' : 'Add a student to your growing campus community.'}</p></div>
      <form className="panel form-panel" onSubmit={onSubmit}>
        <div className="form-heading"><span className="form-icon">✿</span><div><h2>{editing ? 'Edit student record' : 'Student information'}</h2><p>Fields marked with * are required.</p></div></div>
        <div className="form-grid">
          <label>Student ID *<input name="studentId" value={form.studentId} onChange={update} placeholder="e.g. STU001" required /></label>
          <label>Full name *<input name="name" value={form.name} onChange={update} placeholder="Student's full name" required /></label>
          <label>Email address *<input name="email" type="email" value={form.email} onChange={update} placeholder="name@college.edu" required /></label>
          <label>Department *<input name="department" value={form.department} onChange={update} placeholder="e.g. Computer Science" required /></label>
          <label className="semester-field">Semester *<select name="semester" value={form.semester} onChange={update} required>{[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>Semester {n}</option>)}</select></label>
        </div>
        <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes ↗' : 'Add student ↗'}</button></div>
      </form>
    </section>
  )
}

function StudentDirectory({ students, loading, query, setQuery, onEdit, onDelete, mode }) {
  const copy = {
    list: ['Your student directory', 'Every student, all in one thoughtful place.'],
    search: ['Find your person.', 'Search by name, ID, email, department or semester.'],
    edit: ['A little refresh.', 'Choose a student record to edit.'],
    delete: ['Manage records', 'Remove a record only when you’re sure.'],
  }[mode]
  return (
    <section className="page-view">
      <div className="page-intro"><span className="eyebrow"><span>✦</span> YOUR CAMPUS DIRECTORY</span><h1>{copy[0]}</h1><p>{copy[1]}</p></div>
      <div className="panel directory-panel">
        <div className="directory-toolbar"><div><h2>{mode === 'search' ? 'Search records' : 'Student records'}</h2><p>{students.length} {students.length === 1 ? 'student' : 'students'} found</p></div><label className="search-box"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search students..." /></label></div>
        {loading ? <div className="empty-state">Gathering your records…</div> : students.length === 0 ? <div className="empty-state"><div className="empty-flower">✿</div><h3>No students found just yet.</h3><p>Try another search or add a new student to your directory.</p></div> : (
          <div className="table-wrap"><table className="student-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>DEPARTMENT</th><th>SEMESTER</th><th>ACTIONS</th></tr></thead><tbody>{students.map((s, i) => <tr key={s._id || s.studentId}><td><div className="table-person"><span className={`student-avatar avatar-${i % 4}`}>{(s.name || '?').trim().charAt(0).toUpperCase()}</span><span><strong>{s.name}</strong><small>{s.email}</small></span></div></td><td>{s.studentId}</td><td><span className="department-pill">{s.department || '—'}</span></td><td>Semester {s.semester || '—'}</td><td><div className="table-actions">{mode !== 'delete' && <button onClick={() => onEdit(s)} title="Edit record">✎</button>}<button className="delete-action" onClick={() => onDelete(s)} title="Delete record">×</button></div></td></tr>)}</tbody></table></div>
        )}
      </div>
      <footer className="page-footer"><span>One record at a time <b>♡</b></span><span>STUDENTHUB · YOUR WORKSPACE</span></footer>
    </section>
  )
}

export default App
