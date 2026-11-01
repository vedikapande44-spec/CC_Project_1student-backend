import './Dashboard.css'
export default function Dashboard({ students, loading, onNavigate }) {
  const departments = new Set(
    students.map(s => s.department).filter(Boolean)
  ).size

  const semesters = new Set(
    students.map(s => s.semester).filter(Boolean)
  ).size

  return (
    <div className="dashboard">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">A LITTLE SPACE TO GROW ✦</span>
          <h1>Manage students,<br /><em>with a little more ease.</em></h1>
          <p className="welcome-text">
            All your student records, thoughtfully organized in one place.
          </p>
          <div className="welcome-actions">
            <button className="primary-btn" onClick={() => onNavigate('Add Student')}>
              <span>＋</span> Add a student
            </button>
            <button className="text-btn" onClick={() => onNavigate('Student List')}>
              Explore directory <span>↗</span>
            </button>
          </div>
        </div>

        <div className="education-art" aria-label="Graduation cap and books illustration">
          <div className="art-halo" />
          <div className="art-spark spark-a">✦</div>
          <div className="art-spark spark-b">✧</div>
          <div className="art-plant">♧</div>
          <div className="book book-bottom" />
          <div className="book book-middle" />
          <div className="book book-top" />
          <div className="grad-cap">
            <div className="cap-top" />
            <div className="cap-base" />
            <div className="cap-tassel" />
          </div>
          <div className="art-caption">Learn <span>·</span> Grow <span>·</span> Succeed</div>
        </div>
      </div>

      <div className="section-title">
        <div>
          <h2>Your overview <span>✳</span></h2>
          <p>A small snapshot of your student community.</p>
        </div>
        <span className="live-label"><i /> LIVE RECORDS</span>
      </div>

      <div className="stats-row">
        <article className="overview-card lilac-card">
          <div className="overview-top">
            <span>Total students</span>
            <span className="overview-icon">♧</span>
          </div>
          <strong>{loading ? '…' : students.length}</strong>
          <small>Student records in the system</small>
        </article>

        <article className="overview-card peach-card">
          <div className="overview-top">
            <span>Departments</span>
            <span className="overview-icon">✳</span>
          </div>
          <strong>{loading ? '…' : departments}</strong>
          <small>Departments represented</small>
        </article>

        <article className="overview-card mint-card">
          <div className="overview-top">
            <span>Semesters</span>
            <span className="overview-icon">▤</span>
          </div>
          <strong>{loading ? '…' : semesters}</strong>
          <small>Semesters with students</small>
        </article>
      </div>

      <div className="directory-preview">
        <div className="preview-heading">
          <div>
            <span className="preview-icon">♧</span>
            <div>
              <h2>Recent students</h2>
              <p>A glimpse of your directory.</p>
            </div>
          </div>
          <button onClick={() => onNavigate('Student List')}>
            View all <span>→</span>
          </button>
        </div>

        {loading ? (
          <div className="preview-empty">Loading your student records…</div>
        ) : students.length === 0 ? (
          <div className="preview-empty">
            <div className="empty-flower">✿</div>
            <h3>A fresh start!</h3>
            <p>Your student directory is waiting for its first record.</p>
            <button className="text-btn" onClick={() => onNavigate('Add Student')}>
              Add your first student ↗
            </button>
          </div>
        ) : (
          <div className="recent-list">
            {students.slice(0, 4).map((student, index) => (
              <div className="recent-row" key={student._id || student.studentId}>
                <span className={`recent-avatar recent-${index % 4}`}>
                  {(student.name || '?').trim().charAt(0).toUpperCase()}
                </span>
                <div className="recent-person">
                  <strong>{student.name}</strong>
                  <small>{student.email}</small>
                </div>
                <span className="recent-department">{student.department || '—'}</span>
                <span className="recent-id">{student.studentId}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="dashboard-footer">
        <span>Made for a brighter campus <b>♡</b></span>
        <span>STUDENTHUB · STUDENT MANAGEMENT</span>
      </footer>
    </div>
  )
}
