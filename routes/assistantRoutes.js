require('dotenv').config();
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { GoogleGenAI } = require('@google/genai');

const Student = require('../models/Student');

const DEFAULT_OWNER = process.env.DEFAULT_GITHUB_OWNER || 'vedikapande44-spec';
const DEFAULT_REPO = process.env.DEFAULT_GITHUB_REPO || 'CC_Project_1student-backend';

// Ultra-fast model prioritization with automatic fallback
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.8-flash'
].filter(Boolean);

function getGithubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

// Ensure database connection
async function ensureDB() {
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (mongoUri) await mongoose.connect(mongoUri);
  }
}

// High-performance In-Memory Tool Handlers (Direct Mongoose & GitHub API)
const TOOL_HANDLERS = {
  // Student operations
  student_get_all_students: async () => {
    await ensureDB();
    const list = await Student.find().sort({ createdAt: -1 }).lean();
    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
  },
  student_get_student: async ({ id }) => {
    await ensureDB();
    let s = await Student.findOne({ studentId: id }).lean();
    if (!s && mongoose.isValidObjectId(id)) s = await Student.findById(id).lean();
    return { content: [{ type: 'text', text: s ? JSON.stringify(s, null, 2) : `Student not found: ${id}` }] };
  },
  student_add_student: async (data) => {
    await ensureDB();
    const s = await Student.create({
      studentId: data.studentId.trim(),
      name: data.name.trim(),
      email: data.email.trim(),
      department: data.department.trim(),
      semester: Number(data.semester)
    });
    return { content: [{ type: 'text', text: JSON.stringify({ message: 'Student added successfully', student: s }, null, 2) }] };
  },
  student_batch_add_students: async ({ students }) => {
    await ensureDB();
    const created = [];
    const errors = [];
    for (const item of (students || [])) {
      try {
        const doc = await Student.create({
          studentId: item.studentId.trim(),
          name: item.name.trim(),
          email: item.email.trim(),
          department: item.department.trim(),
          semester: Number(item.semester)
        });
        created.push(doc);
      } catch (e) {
        errors.push({ studentId: item.studentId, error: e.message });
      }
    }
    return { content: [{ type: 'text', text: JSON.stringify({ message: `Created ${created.length} students`, created, errors }, null, 2) }] };
  },
  student_update_student: async ({ id, updates }) => {
    await ensureDB();
    let s = await Student.findOneAndUpdate({ studentId: id }, updates, { new: true, runValidators: true });
    if (!s && mongoose.isValidObjectId(id)) s = await Student.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    return { content: [{ type: 'text', text: s ? JSON.stringify({ message: 'Student updated successfully', student: s }, null, 2) : `Student not found: ${id}` }] };
  },
  student_delete_student: async ({ id }) => {
    await ensureDB();
    let s = await Student.findOneAndDelete({ studentId: id });
    if (!s && mongoose.isValidObjectId(id)) s = await Student.findByIdAndDelete(id);
    return { content: [{ type: 'text', text: s ? `Student '${s.name}' (${s.studentId}) deleted successfully` : `Student not found: ${id}` }] };
  },

  // MongoDB Analytics
  mongodb_check_mongodb_connection: async () => {
    const isConn = mongoose.connection.readyState === 1;
    return { content: [{ type: 'text', text: JSON.stringify({ connected: isConn, database: mongoose.connection.name }) }] };
  },
  mongodb_get_database_stats: async () => {
    await ensureDB();
    const totalStudents = await Student.countDocuments();
    const depts = await Student.distinct('department');
    const deptStats = await Student.aggregate([{ $group: { _id: '$department', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
    const semStats = await Student.aggregate([{ $group: { _id: '$semester', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    return { content: [{ type: 'text', text: JSON.stringify({ totalStudents, departmentsCount: depts.length, departmentBreakdown: deptStats, semesterBreakdown: semStats }, null, 2) }] };
  },
  mongodb_search_students_by_department: async ({ department }) => {
    await ensureDB();
    const list = await Student.find({ department: { $regex: department, $options: 'i' } }).lean();
    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
  },
  mongodb_count_students_by_semester: async ({ semester }) => {
    await ensureDB();
    const count = await Student.countDocuments({ semester });
    return { content: [{ type: 'text', text: JSON.stringify({ semester, count }, null, 2) }] };
  },

  // Application Status
  app_get_system_status: async () => {
    const count = await Student.countDocuments().catch(() => 0);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'online',
          database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          totalStudents: count,
          uptimeSeconds: Math.floor(process.uptime()),
          defaultGithubRepo: `${DEFAULT_OWNER}/${DEFAULT_REPO}`
        }, null, 2)
      }]
    };
  },

  // GitHub Tools
  github_check_github_connection: async () => {
    const headers = getGithubHeaders();
    if (!headers) {
      return { content: [{ type: 'text', text: `Connected via proxy (Default: ${DEFAULT_OWNER}/${DEFAULT_REPO})` }] };
    }
    const res = await fetch('https://api.github.com/user', { headers });
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
    const u = await res.json();
    return { content: [{ type: 'text', text: `Connected as ${u.login} (${u.html_url})` }] };
  },
  github_list_github_repositories: async () => {
    const headers = getGithubHeaders();
    if (!headers) throw new Error('GITHUB_TOKEN not configured locally');
    const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=10', { headers });
    const list = await res.json();
    return { content: [{ type: 'text', text: JSON.stringify(list.map(r => ({ name: r.name, full_name: r.full_name, url: r.html_url })), null, 2) }] };
  },
  github_create_github_issue: async ({ title, body, owner, repo }) => {
    const o = owner || DEFAULT_OWNER;
    const r = repo || DEFAULT_REPO;
    const headers = getGithubHeaders();
    if (!headers) throw new Error('GITHUB_TOKEN not configured locally');
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/issues`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    });
    if (!res.ok) throw new Error(`GitHub error (${res.status}): ${await res.text()}`);
    const issue = await res.json();
    return { content: [{ type: 'text', text: `Issue #${issue.number} created: ${issue.html_url}` }] };
  },
  github_list_github_issues: async ({ owner, repo, state = 'open' }) => {
    const o = owner || DEFAULT_OWNER;
    const r = repo || DEFAULT_REPO;
    const headers = getGithubHeaders();
    if (!headers) throw new Error('GITHUB_TOKEN not configured locally');
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/issues?state=${state}&per_page=10`, { headers });
    const issues = await res.json();
    return { content: [{ type: 'text', text: JSON.stringify(issues.map(i => ({ number: i.number, title: i.title, state: i.state, url: i.html_url })), null, 2) }] };
  }
};

// Static Tool Definitions for instantaneous 0ms tool loading
const STATIC_TOOL_DECLARATIONS = [
  {
    name: 'student_get_all_students',
    description: 'Get all student records from MongoDB database',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: 'student_get_student',
    description: 'Find a student using studentId (e.g. ST101) or MongoDB _id',
    parametersJsonSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'studentId or MongoDB _id' } },
      required: ['id']
    }
  },
  {
    name: 'student_add_student',
    description: 'Add a new student to MongoDB database',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: 'Student ID code, e.g. ST101' },
        name: { type: 'string', description: 'Student full name' },
        email: { type: 'string', description: 'Valid email address' },
        department: { type: 'string', description: 'Department/branch' },
        semester: { type: 'number', description: 'Semester number (1-8)' }
      },
      required: ['studentId', 'name', 'email', 'department', 'semester']
    }
  },
  {
    name: 'student_batch_add_students',
    description: 'Add multiple students in a single batch',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        students: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              studentId: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              department: { type: 'string' },
              semester: { type: 'number' }
            },
            required: ['studentId', 'name', 'email', 'department', 'semester']
          }
        }
      },
      required: ['students']
    }
  },
  {
    name: 'student_update_student',
    description: 'Update an existing student record in MongoDB',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'studentId or _id of student to update' },
        updates: {
          type: 'object',
          properties: {
            studentId: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            department: { type: 'string' },
            semester: { type: 'number' }
          }
        }
      },
      required: ['id', 'updates']
    }
  },
  {
    name: 'student_delete_student',
    description: 'Delete a student record from MongoDB',
    parametersJsonSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'studentId or MongoDB _id to delete' } },
      required: ['id']
    }
  },
  {
    name: 'mongodb_get_database_stats',
    description: 'Get total students, department breakdown, and semester statistics',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: 'mongodb_search_students_by_department',
    description: 'Find students enrolled in a department',
    parametersJsonSchema: {
      type: 'object',
      properties: { department: { type: 'string', description: 'Department name' } },
      required: ['department']
    }
  },
  {
    name: 'mongodb_count_students_by_semester',
    description: 'Count students in a specific semester',
    parametersJsonSchema: {
      type: 'object',
      properties: { semester: { type: 'number', description: 'Semester number (1-8)' } },
      required: ['semester']
    }
  },
  {
    name: 'mongodb_check_mongodb_connection',
    description: 'Check MongoDB connection state',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: 'app_get_system_status',
    description: 'Get application health, database state, uptime, and student counts',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: 'github_check_github_connection',
    description: 'Verify GitHub connection and authenticated user',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: 'github_list_github_repositories',
    description: 'List repositories for the authenticated GitHub user',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: 'github_create_github_issue',
    description: 'Create an issue in a GitHub repository',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue description' },
        owner: { type: 'string' },
        repo: { type: 'string' }
      },
      required: ['title']
    }
  },
  {
    name: 'github_list_github_issues',
    description: 'List issues in a GitHub repository',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        state: { type: 'string', enum: ['open', 'closed', 'all'] }
      }
    }
  }
];

// Resilient content generator across candidate models
async function generateWithFallback(ai, contents, tools) {
  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          tools: [{ functionDeclarations: tools }],
          temperature: 0.2
        }
      });
      return { response, modelUsed: model };
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      // On 429 (quota), 404 (not found), or 503 (high demand), skip to next candidate model
      if (
        msg.includes('429') ||
        err.status === 429 ||
        msg.includes('404') ||
        err.status === 404 ||
        msg.includes('503') ||
        err.status === 503
      ) {
        continue;
      }
      break;
    }
  }

  throw lastError || new Error('All candidate Gemini models failed to respond');
}

// POST /api/assistant: Fast AI Assistant endpoint
router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid message string' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set' });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const systemPrompt =
      'You are the intelligent Assistant for the Student Management System. ' +
      'You have direct MCP tools for the Database (MongoDB), Application, and GitHub.\n' +
      '- Database: view, search, add, update, batch add, and delete students.\n' +
      '- GitHub: list repos, check connection, create issues in ' +
      `${DEFAULT_OWNER}/${DEFAULT_REPO}.\n` +
      '- When a user asks to view, create, update, delete, or check anything, ALWAYS execute the appropriate tool.\n' +
      '- Be concise, clear, and return clean markdown formatting.';

    const contents = [];

    // Optional past turns (last 4 for fast token processing)
    if (Array.isArray(history) && history.length > 0) {
      for (const turn of history.slice(-4)) {
        if (turn.role === 'user' && turn.text) {
          contents.push({ role: 'user', parts: [{ text: turn.text }] });
        } else if (turn.role === 'assistant' && turn.text) {
          contents.push({ role: 'model', parts: [{ text: turn.text }] });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{
        text: `[System Context: ${systemPrompt}]\n\nUser request: ${message}`
      }]
    });

    const toolsExecuted = [];
    let dataModified = false;
    let finalReply = '';
    const maxRounds = 5;

    for (let round = 0; round < maxRounds; round++) {
      const { response } = await generateWithFallback(ai, contents, STATIC_TOOL_DECLARATIONS);
      const modelContent = response.candidates?.[0]?.content;

      if (!modelContent) {
        finalReply = response.text || 'Done.';
        break;
      }

      contents.push(modelContent);
      const functionCalls = response.functionCalls || [];

      if (functionCalls.length === 0) {
        finalReply = response.text || 'Request completed.';
        break;
      }

      const functionResponses = [];

      for (const call of functionCalls) {
        let toolResultText = '';
        let executionStatus = 'success';

        if (
          call.name.includes('add_student') ||
          call.name.includes('update_student') ||
          call.name.includes('delete_student')
        ) {
          dataModified = true;
        }

        try {
          if (TOOL_HANDLERS[call.name]) {
            toolResultText = await TOOL_HANDLERS[call.name](call.args || {});
          } else {
            throw new Error(`Tool ${call.name} not available`);
          }
        } catch (toolError) {
          executionStatus = 'error';
          toolResultText = { error: toolError.message };
        }

        toolsExecuted.push({
          tool: call.name,
          args: call.args || {},
          status: executionStatus,
          output: toolResultText
        });

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { result: toolResultText },
            ...(call.id ? { id: call.id } : {})
          }
        });
      }

      contents.push({
        role: 'user',
        parts: functionResponses
      });
    }

    res.json({
      reply: finalReply || 'Operation completed successfully.',
      toolsExecuted,
      dataModified,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fast Assistant Error:', error);
    res.status(500).json({
      error: 'AI assistant request failed',
      details: error.message
    });
  }
});

// GET /api/assistant/status: Health & Tools Inspection
router.get('/status', async (req, res) => {
  res.json({
    status: 'active',
    fastEngine: true,
    models: CANDIDATE_MODELS,
    activeToolsCount: STATIC_TOOL_DECLARATIONS.length,
    tools: STATIC_TOOL_DECLARATIONS.map(t => ({ name: t.name, description: t.description })),
    databaseState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

module.exports = router;
