import React, { useState, useRef, useEffect } from 'react'
import './AssistantView.css'

const STORAGE_KEY = 'sms_ai_chat_sessions_v2'
const ACTIVE_SESSION_KEY = 'sms_ai_active_session_id_v2'

const QUICK_SUGGESTIONS = [
  { label: '📊 Database summary', prompt: 'Show me total student counts and department breakdown.' },
  { label: '➕ Add a student', prompt: 'Add a new student ST103 named Riya Sen, email riya@college.edu, department Computer Science, semester 2.' },
  { label: '🔍 Find CS students', prompt: 'List all students currently enrolled in the Computer Science department.' },
  { label: '🐙 GitHub status & repos', prompt: 'Check my GitHub connection and show my recent repositories.' },
]

function createNewSession() {
  const id = `session_${Date.now()}`
  return {
    id,
    title: 'New conversation',
    updatedAt: Date.now(),
    messages: []
  }
}

export default function AssistantView({ onStudentModified, onNavigate }) {
  // Load sessions from localStorage
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (e) {
      console.warn('Could not read chat sessions from localStorage:', e)
    }
    return [createNewSession()]
  })

  // Active session ID
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const savedId = localStorage.getItem(ACTIVE_SESSION_KEY)
    return savedId || sessions[0]?.id || ''
  })

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [lastModifiedNotice, setLastModifiedNotice] = useState(null)
  const chatEndRef = useRef(null)

  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
  const assistantUrl = `${apiBase}/api/assistant`

  // Get current active session
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]

  // Persist sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    } catch (e) {
      console.warn('Could not save chat sessions:', e)
    }
  }, [sessions])

  // Persist active session ID
  useEffect(() => {
    try {
      if (activeSessionId) {
        localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId)
      }
    } catch (e) {
      console.warn('Could not save active session ID:', e)
    }
  }, [activeSessionId])

  // Scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages, loading])

  // Create a new chat session
  function handleNewChat() {
    const fresh = createNewSession()
    setSessions(prev => [fresh, ...prev])
    setActiveSessionId(fresh.id)
    setInput('')
    setLastModifiedNotice(null)
  }

  // Delete a chat session
  function handleDeleteSession(e, sessionId) {
    e.stopPropagation()
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId)
      if (filtered.length === 0) {
        const fresh = createNewSession()
        setActiveSessionId(fresh.id)
        return [fresh]
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(filtered[0].id)
      }
      return filtered
    })
  }

  // Send a user prompt
  async function handleSend(textToSend) {
    const promptText = (typeof textToSend === 'string' ? textToSend : input).trim()
    if (!promptText || loading) return

    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const currentMessages = activeSession?.messages || []
    const updatedMessages = [...currentMessages, userMsg]

    // Derive a clean short title from first prompt if needed
    let sessionTitle = activeSession?.title || 'New conversation'
    if (sessionTitle === 'New conversation' || currentMessages.length === 0) {
      sessionTitle = promptText.length > 28 ? promptText.slice(0, 28) + '…' : promptText
    }

    // Update session with user message
    setSessions(prev =>
      prev.map(s =>
        s.id === activeSession.id
          ? { ...s, title: sessionTitle, updatedAt: Date.now(), messages: updatedMessages }
          : s
      )
    )

    setInput('')
    setLoading(true)

    // Send recent conversation turns for context
    const history = updatedMessages.slice(-4).map(m => ({
      role: m.role,
      text: m.text
    }))

    try {
      const res = await fetch(assistantUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: promptText, history })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.details || data.error || 'AI request failed')

      const assistantMsg = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'Operation completed.',
        tools: data.toolsExecuted || [],
        dataModified: !!data.dataModified,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setSessions(prev =>
        prev.map(s =>
          s.id === activeSession.id
            ? { ...s, updatedAt: Date.now(), messages: [...updatedMessages, assistantMsg] }
            : s
        )
      )

      if (data.dataModified) {
        setLastModifiedNotice('Database updated. Directory synchronized.')
        if (onStudentModified) onStudentModified()
      }
    } catch (err) {
      const errorMsg = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        isError: true,
        text: `⚠️ **Error:** ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setSessions(prev =>
        prev.map(s =>
          s.id === activeSession.id
            ? { ...s, updatedAt: Date.now(), messages: [...updatedMessages, errorMsg] }
            : s
        )
      )
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Format inline Markdown (bold, code, links)
  function formatInline(str) {
    const tokens = []
    let keyCounter = 0
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g
    let match
    let lastIndex = 0

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        tokens.push(str.substring(lastIndex, match.index))
      }
      const val = match[0]
      if (val.startsWith('**') && val.endsWith('**')) {
        tokens.push(<strong key={keyCounter++}>{val.slice(2, -2)}</strong>)
      } else if (val.startsWith('`') && val.endsWith('`')) {
        tokens.push(<code key={keyCounter++} className="inline-code">{val.slice(1, -1)}</code>)
      } else if (val.startsWith('[')) {
        const linkText = val.substring(1, val.indexOf(']'))
        const linkUrl = val.substring(val.indexOf('(') + 1, val.indexOf(')'))
        tokens.push(
          <a key={keyCounter++} href={linkUrl} target="_blank" rel="noopener noreferrer" className="md-link">
            {linkText} ↗
          </a>
        )
      }
      lastIndex = regex.lastIndex
    }

    if (lastIndex < str.length) tokens.push(str.substring(lastIndex))
    return tokens.length > 0 ? tokens : str
  }

  function renderFormattedText(text) {
    if (!text) return ''
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) return <h4 key={idx} className="md-h4">{line.replace('### ', '')}</h4>
      if (line.startsWith('## ')) return <h3 key={idx} className="md-h3">{line.replace('## ', '')}</h3>
      if (line.trim() === '---') return <hr key={idx} className="md-hr" />
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return <li key={idx} className="md-li">{formatInline(line.trim().replace(/^[-*]\s+/, ''))}</li>
      }
      if (/^\d+\.\s/.test(line.trim())) {
        return <li key={idx} className="md-li-num">{formatInline(line.trim().replace(/^\d+\.\s+/, ''))}</li>
      }
      if (!line.trim()) return <div key={idx} className="md-spacing" />
      return <p key={idx} className="md-p">{formatInline(line)}</p>
    })
  }

  const messages = activeSession?.messages || []

  return (
    <div className="assistant-layout">
      {/* Collapsible History Sidebar */}
      <aside className={`history-sidebar ${showHistory ? 'is-open' : 'is-collapsed'}`}>
        <div className="history-top">
          <button className="new-chat-btn" onClick={handleNewChat}>
            <span>＋</span> New chat
          </button>
        </div>

        <div className="history-label">RECENT CONVERSATIONS</div>

        <div className="history-list">
          {sessions.map(s => (
            <button
              key={s.id}
              className={`history-item ${s.id === activeSession?.id ? 'is-active' : ''}`}
              onClick={() => {
                setActiveSessionId(s.id)
                setLastModifiedNotice(null)
              }}
            >
              <span className="history-icon">💬</span>
              <span className="history-title">{s.title || 'Conversation'}</span>
              {sessions.length > 1 && (
                <span
                  className="history-delete"
                  onClick={e => handleDeleteSession(e, s.id)}
                  title="Delete chat"
                >
                  ×
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Chat Panel */}
      <div className="chat-panel">
        {/* Minimal Header */}
        <header className="chat-topbar">
          <div className="topbar-left">
            <button
              className="toggle-sidebar-btn"
              onClick={() => setShowHistory(prev => !prev)}
              title={showHistory ? 'Hide history' : 'Show history'}
            >
              ☰
            </button>
            <h2 className="chat-heading">{activeSession?.title || 'AI Assistant'}</h2>
          </div>
          <div className="topbar-right">
            <span className="live-status-dot" />
            <span className="live-status-text">Connected</span>
          </div>
        </header>

        {/* Sync notification if record changed */}
        {lastModifiedNotice && (
          <div className="chat-sync-bar">
            <span>✓ {lastModifiedNotice}</span>
            <button onClick={() => onNavigate('Student List')}>View directory ↗</button>
            <span className="close-sync" onClick={() => setLastModifiedNotice(null)}>×</span>
          </div>
        )}

        {/* Messages Body */}
        <div className="chat-body">
          {messages.length === 0 ? (
            /* Minimalist Empty State */
            <div className="minimal-empty-view">
              <div className="empty-sparkle">✦</div>
              <h3>How can I help you today?</h3>
              <p>Ask about students, database records, or GitHub.</p>

              <div className="suggestion-grid">
                {QUICK_SUGGESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    className="suggestion-card"
                    onClick={() => handleSend(item.prompt)}
                    disabled={loading}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map(msg => (
                <div key={msg.id} className={`message-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}>
                  <div className="avatar">{msg.role === 'user' ? '👤' : '✦'}</div>
                  <div className="bubble">
                    <div className="bubble-text">{renderFormattedText(msg.text)}</div>

                    {msg.tools && msg.tools.length > 0 && (
                      <div className="tools-card">
                        <div className="tools-list">
                          {msg.tools.map((t, i) => (
                            <span key={i} className="tool-tag">
                              <code>{t.tool}</code>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message-row assistant-row">
                  <div className="avatar pulse-avatar">✦</div>
                  <div className="bubble loading-bubble">
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="chat-input-bar">
          <div className="input-box">
            <textarea
              className="chat-textarea"
              placeholder="Message your assistant..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button
              className="submit-button"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              aria-label="Send"
            >
              ↑
            </button>
          </div>
          <div className="input-footer-hint">
            Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line
          </div>
        </div>
      </div>
    </div>
  )
}
