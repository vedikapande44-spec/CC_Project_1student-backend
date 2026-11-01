
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
    console.log('MongoDB connected successfully');
  }
}

function createMcpServer() {
  const server = new McpServer({
    name: 'mongodb-mcp-server',
    version: '1.0.0'
  });

  server.tool(
    'check_mongodb_connection',
    'Check whether MongoDB is connected',
    {},
    async () => ({
      content: [{
        type: 'text',
        text: `MongoDB connection state: ${mongoose.connection.readyState}`
      }]
    })
  );

  server.tool(
    'get_database_stats',
    'Get student collection statistics',
    {},
    async () => {
      const totalStudents = await Student.countDocuments();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ totalStudents }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'search_students_by_department',
    'Find students belonging to a department',
    { department: z.string() },
    async ({ department }) => {
      const students = await Student.find({
        department: { $regex: department, $options: 'i' }
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(students, null, 2)
        }]
      };
    }
  );

  server.tool(
    'count_students_by_semester',
    'Count students in a particular semester',
    { semester: z.number().int().min(1) },
    async ({ semester }) => {
      const count = await Student.countDocuments({ semester });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ semester, count }, null, 2)
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

app.listen(PORT, () => {
  console.log(`MongoDB MCP Server running on port ${PORT}`);
});
