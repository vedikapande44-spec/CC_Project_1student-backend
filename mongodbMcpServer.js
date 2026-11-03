require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

const Student = require('./models/Student');

const app = express();
app.use(express.json());

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MongoDB URI is missing');
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully in MongoDB MCP');
  }
}

function createMcpServer() {
  const server = new McpServer({
    name: 'mongodb-mcp-server',
    version: '1.0.0'
  });

  server.tool(
    'check_mongodb_connection',
    'Check whether MongoDB database connection is active and healthy',
    {},
    async () => {
      await connectDB();
      const stateMap = {
        0: 'Disconnected',
        1: 'Connected',
        2: 'Connecting',
        3: 'Disconnecting'
      };
      const state = mongoose.connection.readyState;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: state === 1 ? 'healthy' : 'degraded',
            connectionState: stateMap[state] || 'Unknown',
            host: mongoose.connection.host,
            database: mongoose.connection.name
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'get_database_stats',
    'Get comprehensive student database metrics and collection statistics',
    {},
    async () => {
      await connectDB();
      const totalStudents = await Student.countDocuments();
      const departments = await Student.distinct('department');
      const semesters = await Student.distinct('semester');

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
            distinctDepartments: departments.length,
            distinctSemesters: semesters.length,
            departmentBreakdown: departmentBreakdown.map(d => ({ department: d._id || 'Unassigned', count: d.count })),
            semesterBreakdown: semesterBreakdown.map(s => ({ semester: s._id, count: s.count }))
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'search_students_by_department',
    'Find all students belonging to a particular department or branch',
    { department: z.string().describe('Department name or substring to match, case-insensitive') },
    async ({ department }) => {
      await connectDB();
      const students = await Student.find({
        department: { $regex: department, $options: 'i' }
      }).sort({ name: 1 });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            queryDepartment: department,
            totalFound: students.length,
            students
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'count_students_by_semester',
    'Count how many students are currently enrolled in a specific semester',
    { semester: z.number().int().min(1).max(8).describe('Semester number (1 to 8)') },
    async ({ semester }) => {
      await connectDB();
      const count = await Student.countDocuments({ semester });
      const students = await Student.find({ semester }).select('studentId name department email');

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ semester, count, students }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'delete_students_by_department',
    'Delete all student records belonging to a specified department (caution: irreversible)',
    {
      department: z.string().describe('Exact department name to delete students from'),
      confirm: z.boolean().describe('Must be explicitly true to confirm bulk deletion')
    },
    async ({ department, confirm }) => {
      if (!confirm) {
        return {
          content: [{
            type: 'text',
            text: 'Bulk deletion aborted: confirm flag was false.'
          }]
        };
      }
      await connectDB();
      const result = await Student.deleteMany({
        department: { $regex: `^${department}$`, $options: 'i' }
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Deleted ${result.deletedCount} students from department '${department}'`,
            deletedCount: result.deletedCount
          }, null, 2)
        }]
      };
    }
  );

  return server;
}

app.post('/mcp', async (req, res) => {
  let transport;
  let server;

  try {
    await connectDB();
    server = createMcpServer();

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MongoDB MCP request error:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'MongoDB MCP server error' });
    }
  } finally {
    if (transport) await transport.close();
    if (server) await server.close();
  }
});

app.get('/mcp', (req, res) => {
  res.status(405).send('Method not allowed');
});

app.delete('/mcp', (req, res) => {
  res.status(405).send('Method not allowed');
});

const PORT = process.env.PORT || 3002;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MongoDB MCP Server running on port ${PORT}`);
  });
}

module.exports = { createMcpServer };
