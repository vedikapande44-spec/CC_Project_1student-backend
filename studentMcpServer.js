
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
    await mongoose.connect(
      process.env.MONGO_URI || process.env.MONGODB_URI
    );
    console.log('MongoDB connected successfully');
  }
}

function createMcpServer() {
  const server = new McpServer({
    name: 'student-management-mcp',
    version: '1.0.0'
  });

  server.tool(
    'get_all_students',
    'Get all student records from MongoDB',
    {},
    async () => {
      const students = await Student.find().sort({ createdAt: -1 });
      return {
        content: [{ type: 'text', text: JSON.stringify(students, null, 2) }]
      };
    }
  );

  server.tool(
    'get_student',
    'Find a student using studentId or MongoDB ID',
    { id: z.string() },
    async ({ id }) => {
      let student = await Student.findOne({ studentId: id });

      if (!student && mongoose.isValidObjectId(id)) {
        student = await Student.findById(id);
      }

      return {
        content: [{
          type: 'text',
          text: student ? JSON.stringify(student, null, 2) : 'Student not found'
        }]
      };
    }
  );

  server.tool(
    'add_student',
    'Add a new student to MongoDB',
    {
      studentId: z.string(),
      name: z.string(),
      email: z.string().email(),
      department: z.string(),
      semester: z.number().int().min(1)
    },
    async (data) => {
      const student = await Student.create(data);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ message: 'Student added successfully', student }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'update_student',
    'Update an existing student',
    {
      id: z.string(),
      updates: z.object({
        studentId: z.string().optional(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        department: z.string().optional(),
        semester: z.number().int().min(1).optional()
      })
    },
    async ({ id, updates }) => {
      let student = await Student.findOneAndUpdate(
        { studentId: id }, updates, { new: true, runValidators: true }
      );

      if (!student && mongoose.isValidObjectId(id)) {
        student = await Student.findByIdAndUpdate(
          id, updates, { new: true, runValidators: true }
        );
      }

      return {
        content: [{
          type: 'text',
          text: student
            ? JSON.stringify({ message: 'Student updated successfully', student }, null, 2)
            : 'Student not found'
        }]
      };
    }
  );

  server.tool(
    'delete_student',
    'Delete a student using studentId or MongoDB ID',
    { id: z.string() },
    async ({ id }) => {
      let student = await Student.findOneAndDelete({ studentId: id });

      if (!student && mongoose.isValidObjectId(id)) {
        student = await Student.findByIdAndDelete(id);
      }

      return {
        content: [{
          type: 'text',
          text: student ? 'Student deleted successfully' : 'Student not found'
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
    console.error('MCP request error:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP server error' });
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

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Student MCP Server running on port ${PORT}`);
});
