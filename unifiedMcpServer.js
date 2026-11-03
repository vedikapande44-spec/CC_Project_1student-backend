require('dotenv').config();

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');

const Student = require('./models/Student');

const DEFAULT_OWNER = process.env.DEFAULT_GITHUB_OWNER || 'vedikapande44-spec';
const DEFAULT_REPO = process.env.DEFAULT_GITHUB_REPO || 'CC_Project_1student-backend';

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (mongoUri) {
      await mongoose.connect(mongoUri);
    }
  }
}

function githubHeaders() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is missing');
  }
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function createUnifiedServer() {
  const server = new McpServer({
    name: 'student-mgmt-unified-mcp',
    version: '2.0.0'
  });

  // ==================== APPLICATION TOOLS ====================
  server.tool(
    'app_get_system_status',
    'Get overall application health, database status, and student record counts',
    {},
    async () => {
      await connectDB();
      const count = await Student.countDocuments().catch(() => 0);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'operational',
            database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            totalStudents: count,
            uptimeSeconds: Math.floor(process.uptime()),
            memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            defaultGithubRepo: `${DEFAULT_OWNER}/${DEFAULT_REPO}`
          }, null, 2)
        }]
      };
    }
  );

  // ==================== STUDENT TOOLS ====================
  server.tool(
    'student_get_all_students',
    'Get all student records from MongoDB database',
    {},
    async () => {
      await connectDB();
      const students = await Student.find().sort({ createdAt: -1 });
      return {
        content: [{ type: 'text', text: JSON.stringify(students, null, 2) }]
      };
    }
  );

  server.tool(
    'student_get_student',
    'Find a student record by studentId or MongoDB _id',
    { id: z.string().describe('studentId or MongoDB _id') },
    async ({ id }) => {
      await connectDB();
      let s = await Student.findOne({ studentId: id });
      if (!s && mongoose.isValidObjectId(id)) {
        s = await Student.findById(id);
      }
      return {
        content: [{
          type: 'text',
          text: s ? JSON.stringify(s, null, 2) : `Student not found with ID ${id}`
        }]
      };
    }
  );

  server.tool(
    'student_add_student',
    'Add a new student to MongoDB database',
    {
      studentId: z.string().describe('Unique student ID code (e.g. ST101)'),
      name: z.string().describe("Student's full name"),
      email: z.string().email().describe("Student's email address"),
      department: z.string().describe('Department / branch of study'),
      semester: z.number().int().min(1).max(8).describe('Current semester (1-8)')
    },
    async (data) => {
      await connectDB();
      const student = await Student.create({
        studentId: data.studentId.trim(),
        name: data.name.trim(),
        email: data.email.trim(),
        department: data.department.trim(),
        semester: Number(data.semester)
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ message: 'Student added successfully to database', student }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'student_batch_add_students',
    'Add multiple students to MongoDB in a batch',
    {
      students: z.array(z.object({
        studentId: z.string(),
        name: z.string(),
        email: z.string().email(),
        department: z.string(),
        semester: z.number().int().min(1).max(8)
      }))
    },
    async ({ students }) => {
      await connectDB();
      const created = [];
      const errors = [];
      for (const s of students) {
        try {
          const doc = await Student.create({
            studentId: s.studentId.trim(),
            name: s.name.trim(),
            email: s.email.trim(),
            department: s.department.trim(),
            semester: Number(s.semester)
          });
          created.push(doc);
        } catch (err) {
          errors.push({ studentId: s.studentId, error: err.message });
        }
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ message: `Batch completed: ${created.length} added, ${errors.length} errors`, created, errors }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'student_update_student',
    'Update an existing student record in MongoDB',
    {
      id: z.string().describe('The studentId or MongoDB _id'),
      updates: z.object({
        studentId: z.string().optional(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        department: z.string().optional(),
        semester: z.number().int().min(1).max(8).optional()
      })
    },
    async ({ id, updates }) => {
      await connectDB();
      let s = await Student.findOneAndUpdate({ studentId: id }, updates, { new: true, runValidators: true });
      if (!s && mongoose.isValidObjectId(id)) {
        s = await Student.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
      }
      return {
        content: [{
          type: 'text',
          text: s ? JSON.stringify({ message: 'Student updated successfully', student: s }, null, 2) : `Student not found with ID ${id}`
        }]
      };
    }
  );

  server.tool(
    'student_delete_student',
    'Delete a student from MongoDB database',
    { id: z.string().describe('studentId or MongoDB _id to delete') },
    async ({ id }) => {
      await connectDB();
      let s = await Student.findOneAndDelete({ studentId: id });
      if (!s && mongoose.isValidObjectId(id)) {
        s = await Student.findByIdAndDelete(id);
      }
      return {
        content: [{
          type: 'text',
          text: s ? `Student '${s.name}' (${s.studentId}) successfully deleted` : `Student not found with ID ${id}`
        }]
      };
    }
  );

  // ==================== MONGODB ANALYTICS TOOLS ====================
  server.tool(
    'mongodb_get_database_stats',
    'Get database statistics including counts, department breakdown and semester distributions',
    {},
    async () => {
      await connectDB();
      const totalStudents = await Student.countDocuments();
      const departments = await Student.distinct('department');
      const departmentBreakdown = await Student.aggregate([
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      const semesterBreakdown = await Student.aggregate([
        { $group: { _id: '$semester', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalStudents,
            totalDepartments: departments.length,
            departments: departmentBreakdown.map(d => ({ department: d._id || 'Unassigned', count: d.count })),
            semesters: semesterBreakdown.map(s => ({ semester: s._id, count: s.count }))
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'mongodb_search_students_by_department',
    'Find all students in a specific department',
    { department: z.string().describe('Department name or part of name') },
    async ({ department }) => {
      await connectDB();
      const list = await Student.find({ department: { $regex: department, $options: 'i' } });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: list.length, students: list }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'mongodb_count_students_by_semester',
    'Count and list students in a specific semester',
    { semester: z.number().int().min(1).max(8) },
    async ({ semester }) => {
      await connectDB();
      const list = await Student.find({ semester });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ semester, count: list.length, students: list }, null, 2)
        }]
      };
    }
  );

  // ==================== GITHUB TOOLS ====================
  server.tool(
    'github_check_connection',
    'Verify GitHub API authentication and view current user',
    {},
    async () => {
      const res = await fetch('https://api.github.com/user', { headers: githubHeaders() });
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
      const user = await res.json();
      return {
        content: [{ type: 'text', text: `Authenticated as ${user.login} (${user.html_url})` }]
      };
    }
  );

  server.tool(
    'github_list_repositories',
    'List repositories of the authenticated GitHub user',
    {},
    async () => {
      const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=15', { headers: githubHeaders() });
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
      const repos = await res.json();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(repos.map(r => ({ name: r.name, full_name: r.full_name, private: r.private, url: r.html_url })), null, 2)
        }]
      };
    }
  );

  server.tool(
    'github_create_issue',
    'Create an issue in a GitHub repository',
    {
      title: z.string().describe('Title of the issue'),
      body: z.string().optional().describe('Description / body of the issue'),
      owner: z.string().optional().describe(`Repo owner (default: ${DEFAULT_OWNER})`),
      repo: z.string().optional().describe(`Repo name (default: ${DEFAULT_REPO})`)
    },
    async ({ title, body, owner, repo }) => {
      const o = owner || DEFAULT_OWNER;
      const r = repo || DEFAULT_REPO;
      const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/issues`, {
        method: 'POST',
        headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`GitHub error (${res.status}): ${errText}`);
      }
      const issue = await res.json();
      return {
        content: [{ type: 'text', text: `Issue #${issue.number} created: ${issue.html_url}` }]
      };
    }
  );

  server.tool(
    'github_list_issues',
    'List issues in a GitHub repository',
    {
      owner: z.string().optional().describe(`Repo owner (default: ${DEFAULT_OWNER})`),
      repo: z.string().optional().describe(`Repo name (default: ${DEFAULT_REPO})`),
      state: z.enum(['open', 'closed', 'all']).optional()
    },
    async ({ owner, repo, state = 'open' }) => {
      const o = owner || DEFAULT_OWNER;
      const r = repo || DEFAULT_REPO;
      const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/issues?state=${state}&per_page=15`, {
        headers: githubHeaders()
      });
      if (!res.ok) throw new Error(`GitHub error: ${res.status}`);
      const issues = await res.json();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(issues.map(i => ({ number: i.number, title: i.title, state: i.state, url: i.html_url })), null, 2)
        }]
      };
    }
  );

  server.tool(
    'github_close_issue',
    'Close an issue in a GitHub repository',
    {
      issue_number: z.number().int().positive(),
      owner: z.string().optional().describe(`Repo owner (default: ${DEFAULT_OWNER})`),
      repo: z.string().optional().describe(`Repo name (default: ${DEFAULT_REPO})`)
    },
    async ({ issue_number, owner, repo }) => {
      const o = owner || DEFAULT_OWNER;
      const r = repo || DEFAULT_REPO;
      const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/issues/${issue_number}`, {
        method: 'PATCH',
        headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'closed' })
      });
      if (!res.ok) throw new Error(`GitHub error: ${res.status}`);
      const issue = await res.json();
      return {
        content: [{ type: 'text', text: `Issue #${issue.number} closed: ${issue.html_url}` }]
      };
    }
  );

  return server;
}

// Support running via STDIO transport (for Antigravity CLI / AI desktop agents)
if (process.argv.includes('--stdio') || process.env.MCP_TRANSPORT === 'stdio') {
  (async () => {
    await connectDB();
    const server = createUnifiedServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Unified MCP Server connected via stdio');
  })().catch(err => {
    console.error('Failed to start stdio MCP server:', err);
    process.exit(1);
  });
} else if (require.main === module) {
  // Support running via HTTP transport
  const app = express();
  app.use(express.json());

  app.post('/mcp', async (req, res) => {
    let transport;
    let server;
    try {
      await connectDB();
      server = createUnifiedServer();
      transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('Unified MCP request error:', err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    } finally {
      if (transport) await transport.close();
      if (server) await server.close();
    }
  });

  const PORT = process.env.UNIFIED_MCP_PORT || 3004;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Unified MCP Server running on port ${PORT}`);
  });
}

module.exports = { createUnifiedServer };
