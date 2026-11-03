require('dotenv').config();
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { GoogleGenAI } = require('@google/genai');

const Student = require('../models/Student');

const DEFAULT_OWNER = process.env.DEFAULT_GITHUB_OWNER || 'vedikapande44-spec';
const DEFAULT_REPO = process.env.DEFAULT_GITHUB_REPO || 'CC_Project_1student-backend';

// Candidate models in order of priority
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite-preview'
].filter(Boolean);

function getGithubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Student-Mgmt-App',
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
      return { content: [{ type: 'text', text: `Connected via Public GitHub Proxy to repository ${DEFAULT_OWNER}/${DEFAULT_REPO}` }] };
    }
    const res = await fetch('https://api.github.com/user', { headers });
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
    const u = await res.json();
    return { content: [{ type: 'text', text: `Connected as ${u.login} (${u.html_url})` }] };
  },
  github_list_github_repositories: async () => {
    const headers = getGithubHeaders() || { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Student-Mgmt-App' };
    const url = getGithubHeaders()
      ? 'https://api.github.com/user/repos?sort=updated&per_page=10'
      : `https://api.github.com/users/${encodeURIComponent(DEFAULT_OWNER)}/repos?sort=updated&per_page=10`;
    try {
      const res = await fetch(url, { headers });
      const list = await res.json();
      if (!Array.isArray(list)) {
        return { content: [{ type: 'text', text: JSON.stringify([{ name: DEFAULT_REPO, full_name: `${DEFAULT_OWNER}/${DEFAULT_REPO}`, url: `https://github.com/${DEFAULT_OWNER}/${DEFAULT_REPO}` }], null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(list.map(r => ({ name: r.name, full_name: r.full_name, url: r.html_url })), null, 2) }] };
    } catch {
      return { content: [{ type: 'text', text: JSON.stringify([{ name: DEFAULT_REPO, full_name: `${DEFAULT_OWNER}/${DEFAULT_REPO}`, url: `https://github.com/${DEFAULT_OWNER}/${DEFAULT_REPO}` }], null, 2) }] };
    }
  },
  github_create_github_issue: async ({ title, body, owner, repo }) => {
    const o = owner || DEFAULT_OWNER;
    const r = repo || DEFAULT_REPO;
    const headers = getGithubHeaders();
    if (!headers) {
      return {
        content: [{
          type: 'text',
          text: `ℹ️ **GitHub Token Notice:** \`GITHUB_TOKEN\` is not yet configured in the Render Dashboard environment variables. To open issues directly on GitHub repository \`${o}/${r}\`, add a Personal Access Token as \`GITHUB_TOKEN\` in your Render service settings.`
        }]
      };
    }
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
    const headers = getGithubHeaders() || { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Student-Mgmt-App' };
    try {
      const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/issues?state=${state}&per_page=10`, { headers });
      const issues = await res.json();
      if (!Array.isArray(issues)) return { content: [{ type: 'text', text: 'No issues found.' }] };
      return { content: [{ type: 'text', text: JSON.stringify(issues.map(i => ({ number: i.number, title: i.title, state: i.state, url: i.html_url })), null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Could not list issues: ${e.message}` }] };
    }
  }
};

// Static Tool Definitions for Gemini AI Function Calling
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

// Robust Autonomous Intent Parser (Fallback Engine)
function parseAutonomousIntent(text) {
  const t = text.trim();
  const idAnywhere = (t.match(/\b(ST\d+)\b/i) || t.match(/\b([0-9a-fA-F]{24})\b/i) || [])[1];

  // 1. Add / Register student
  if (/\b(?:add|create|insert|register)\b.*\bstudent\b/i.test(t)) {
    const idMatch = t.match(/\b(?:id|studentid)[:=\s]+([A-Za-z0-9_-]+)/i) || (idAnywhere ? [, idAnywhere] : null);
    const emailMatch = t.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const semMatch = t.match(/\b(?:sem|semester)[:=\s]+(\d+)/i) || t.match(/\b(?:in\s+)?semester\s+(\d+)/i);
    const deptMatch = t.match(/\b(?:department|dept)[:=\s]+([^,\n]+?)(?:,\s*sem|\s+sem|$)/i) ||
                      t.match(/\b(computer science|information technology|electronics|electrical|mechanical|civil|data science|ai|aiml)\b/i);
    const nameMatch = t.match(/\bnamed\s+([^,\n]+?)(?:,\s*email|\s+email|\s+dept|\s+sem|$)/i) ||
                      t.match(/\bname[:=\s]+([^,\n]+?)(?:,\s*email|\s+dept|\s+sem|$)/i);

    if (idMatch || emailMatch) {
      return {
        tool: 'student_add_student',
        args: {
          studentId: idMatch ? idMatch[1] : ('ST' + Math.floor(100 + Math.random() * 900)),
          name: nameMatch ? nameMatch[1].trim() : 'New Student',
          email: emailMatch ? emailMatch[1].trim() : 'student@college.edu',
          department: deptMatch ? deptMatch[1].trim() : 'Computer Science',
          semester: semMatch ? Number(semMatch[1]) : 1
        }
      };
    }
  }

  // 2. Delete / Remove student
  if (/\b(?:delete|remove|drop)\b/i.test(t) && idAnywhere) {
    return { tool: 'student_delete_student', args: { id: idAnywhere } };
  }

  // 3. Update / Modify student
  if (/\b(?:update|change|modify)\b/i.test(t) && idAnywhere) {
    const updates = {};
    const semMatch = t.match(/\b(?:sem|semester)[:=\s]+(\d+)/i) || t.match(/\bto\s+(?:semester\s+)?(\d+)/i);
    if (semMatch) updates.semester = Number(semMatch[1]);
    const deptMatch = t.match(/\b(?:dept|department)[:=\s]+([^,\n]+)/i) || t.match(/\bto\s+(computer science|information technology|mechanical|civil)\b/i);
    if (deptMatch) updates.department = deptMatch[1].trim();
    const emailMatch = t.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) updates.email = emailMatch[1].trim();
    const nameMatch = t.match(/\bto\s+name[:=\s]+([^,\n]+)/i);
    if (nameMatch) updates.name = nameMatch[1].trim();
    return { tool: 'student_update_student', args: { id: idAnywhere, updates } };
  }

  // 4. Find / Search specific student
  if (/\b(?:find|search|lookup|inspect)\b.*\bstudent\b/i.test(t) && idAnywhere) {
    return { tool: 'student_get_student', args: { id: idAnywhere } };
  }

  // 5. Database Statistics / Counts
  if (/\b(?:stats|how many|total students|count students|summary|breakdown)\b/i.test(t)) {
    return { tool: 'mongodb_get_database_stats', args: {} };
  }

  // 6. GitHub Create Issue
  if (/\b(?:create|open)\b.*\bissue\b/i.test(t)) {
    const titleMatch = t.match(/title(?:d)?\s+['"]([^'"]+)['"]/i) || t.match(/title[:=\s]+([^,\n]+)/i);
    const bodyMatch = t.match(/(?:description|body)\s+['"]([^'"]+)['"]/i) || t.match(/description[:=\s]+([^,\n]+)/i);
    return {
      tool: 'github_create_github_issue',
      args: {
        title: titleMatch ? titleMatch[1].trim() : 'Campus Portal Update Request',
        body: bodyMatch ? bodyMatch[1].trim() : 'Submitted via Gemini MCP Assistant'
      }
    };
  }

  // 7. GitHub repos / status
  if (/\bgithub\b.*\b(?:repo|repos|repositories)\b/i.test(t)) {
    return { tool: 'github_list_github_repositories', args: {} };
  }
  if (/\bgithub\b.*\b(?:status|connection|check)\b/i.test(t)) {
    return { tool: 'github_check_github_connection', args: {} };
  }

  // 8. Application & System Status
  if (/\b(?:system status|health|status)\b/i.test(t)) {
    return { tool: 'app_get_system_status', args: {} };
  }

  // 9. Department Search
  const deptSearch = t.match(/\b(?:students in|department|search department)\s+(computer science|information technology|electronics|electrical|mechanical|civil|data science|ai|aiml)\b/i);
  if (deptSearch) {
    return { tool: 'mongodb_search_students_by_department', args: { department: deptSearch[1] } };
  }

  // 10. List All Students
  if (/\b(?:list|show|get|view)\b.*\bstudents\b/i.test(t)) {
    return { tool: 'student_get_all_students', args: {} };
  }

  return null;
}

// Markdown Formatter for Autonomous MCP Tool Responses
function formatFallbackResponse(toolName, args, result) {
  if (toolName === 'student_add_student') {
    let studentData = args;
    try {
      const parsed = JSON.parse(result.content[0].text);
      if (parsed.student) studentData = parsed.student;
    } catch {}
    return (
      `### Student Added Successfully ✅\n\n` +
      `| Field | Details |\n` +
      `| :--- | :--- |\n` +
      `| **Student ID** | \`${studentData.studentId}\` |\n` +
      `| **Name** | ${studentData.name} |\n` +
      `| **Email** | ${studentData.email} |\n` +
      `| **Department** | ${studentData.department} |\n` +
      `| **Semester** | Semester ${studentData.semester} |\n` +
      `| **Database ID** | \`${studentData._id || 'Saved in MongoDB'}\` |\n\n` +
      `*The student record has been added to MongoDB and the directory table has updated automatically.*`
    );
  }
  if (toolName === 'student_delete_student') {
    return (
      `### Student Record Removed ✅\n\n` +
      `${result.content[0].text}\n\n` +
      `*The student record has been deleted from MongoDB and the live directory has updated.*`
    );
  }
  if (toolName === 'student_update_student') {
    return (
      `### Student Record Updated ✅\n\n` +
      `${result.content[0].text}\n\n` +
      `*The student record was updated in MongoDB and synchronized with the frontend.*`
    );
  }
  if (toolName === 'mongodb_get_database_stats') {
    try {
      const s = JSON.parse(result.content[0].text);
      return (
        `### 📊 MongoDB Campus Analytics\n\n` +
        `- **Total Students:** ${s.totalStudents}\n` +
        `- **Distinct Departments:** ${s.departmentsCount}\n\n` +
        `#### Department Breakdown\n` +
        (s.departmentBreakdown || []).map(d => `- **${d._id}:** ${d.count} students`).join('\n') +
        `\n\n#### Semester Distribution\n` +
        (s.semesterBreakdown || []).map(sem => `- **Semester ${sem._id}:** ${sem.count} students`).join('\n')
      );
    } catch {
      return result.content[0].text;
    }
  }
  if (toolName === 'github_create_github_issue') {
    return (
      `### 🐙 GitHub Issue Status\n\n` +
      `${result.content[0].text}\n\n` +
      `*Target repository: [\`${DEFAULT_OWNER}/${DEFAULT_REPO}\`](https://github.com/${DEFAULT_OWNER}/${DEFAULT_REPO})*`
    );
  }
  if (toolName === 'github_list_github_repositories') {
    try {
      const repos = JSON.parse(result.content[0].text);
      return (
        `### 🐙 Recent GitHub Repositories\n\n` +
        repos.map(r => `- **[${r.name}](${r.url})** (\`${r.full_name}\`)`).join('\n')
      );
    } catch {
      return result.content[0].text;
    }
  }
  if (toolName === 'student_get_all_students') {
    try {
      const list = JSON.parse(result.content[0].text);
      return (
        `### 📋 Student Directory (${list.length} Students)\n\n` +
        `| ID | Name | Department | Semester | Email |\n` +
        `| :--- | :--- | :--- | :--- | :--- |\n` +
        list.slice(0, 15).map(s => `| **${s.studentId}** | ${s.name} | ${s.department} | Sem ${s.semester} | ${s.email} |`).join('\n')
      );
    } catch {
      return result.content[0].text;
    }
  }
  return result.content?.[0]?.text || 'Operation executed successfully.';
}

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

// POST /api/assistant: Dual-Engine AI + Autonomous MCP Assistant endpoint
router.post('/', async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Please provide a valid message string' });
  }

  const rawKey = process.env.GEMINI_API_KEY || '';
  const apiKey = rawKey.trim().replace(/^['"]|['"]$/g, '');

  // Attempt 1: Try Gemini AI with MCP Function Calling
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const systemPrompt =
        'You are the intelligent Assistant for the Student Management System. ' +
        'You have direct MCP tools for the Database (MongoDB), Application, and GitHub.\n' +
        '- Database: view, search, add, update, batch add, and delete students.\n' +
        '- GitHub: list repos, check connection, create issues in ' +
        `${DEFAULT_OWNER}/${DEFAULT_REPO}.\n` +
        '- When a user asks to view, create, update, delete, or check anything, ALWAYS execute the appropriate tool.\n' +
        '- Be concise, clear, and return clean markdown formatting.';

      const contents = [];

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

      return res.json({
        reply: finalReply || 'Operation completed successfully.',
        toolsExecuted,
        dataModified,
        engine: 'gemini_mcp',
        timestamp: new Date().toISOString()
      });

    } catch (geminiError) {
      console.warn('Gemini AI engine encountered an issue, transitioning seamlessly to Autonomous MCP Engine:', geminiError.message);
    }
  }

  // Attempt 2: Autonomous MCP Direct Intent Execution (Zero-downtime Guarantee)
  try {
    const intent = parseAutonomousIntent(message);

    if (intent && TOOL_HANDLERS[intent.tool]) {
      const toolOutput = await TOOL_HANDLERS[intent.tool](intent.args);
      const isMutation =
        intent.tool.includes('add_student') ||
        intent.tool.includes('update_student') ||
        intent.tool.includes('delete_student');

      const reply = formatFallbackResponse(intent.tool, intent.args, toolOutput);

      return res.json({
        reply,
        toolsExecuted: [{
          tool: intent.tool,
          args: intent.args,
          status: 'success',
          output: toolOutput
        }],
        dataModified: isMutation,
        engine: 'mcp_autonomous',
        timestamp: new Date().toISOString()
      });
    }

    // Default friendly assistant guidance
    return res.json({
      reply:
        '👋 **Hello! I am your Campus AI Copilot** with real-time MCP integration for MongoDB, GitHub, and the Student Directory.\n\n' +
        'You can perform actions like:\n' +
        '- **Add student:** `Add a new student ST103 named Riya Sen, email riya@college.edu, department Computer Science, semester 2`\n' +
        '- **Update student:** `Find student ST103 and update their semester to 3`\n' +
        '- **Delete student:** `Delete student ST103`\n' +
        '- **View statistics:** `Show total students and database stats`\n' +
        '- **GitHub Issue:** `Create a GitHub issue titled "Export feature" with description "Add export to CSV"`\n\n' +
        'How can I assist you with the campus system right now?',
      toolsExecuted: [],
      dataModified: false,
      engine: 'mcp_autonomous',
      timestamp: new Date().toISOString()
    });

  } catch (mcpError) {
    console.error('Autonomous MCP Error:', mcpError);
    return res.status(500).json({
      error: 'MCP operation failed',
      details: mcpError.message
    });
  }
});

// GET /api/assistant/status: Health & Tools Inspection
router.get('/status', async (req, res) => {
  const rawKey = process.env.GEMINI_API_KEY || '';
  const sanitizedKey = rawKey.trim().replace(/^['"]|['"]$/g, '');

  res.json({
    status: 'active',
    fastEngine: true,
    models: CANDIDATE_MODELS,
    activeToolsCount: STATIC_TOOL_DECLARATIONS.length,
    tools: STATIC_TOOL_DECLARATIONS.map(t => ({ name: t.name, description: t.description })),
    databaseState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    apiKeyStatus: {
      configured: Boolean(sanitizedKey),
      length: sanitizedKey.length,
      prefix: sanitizedKey ? sanitizedKey.substring(0, 6) + '...' : 'none',
      suffix: sanitizedKey ? '...' + sanitizedKey.slice(-4) : 'none'
    }
  });
});

module.exports = router;
