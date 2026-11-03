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
    console.log('MongoDB connected successfully in Student MCP');
  }
}

function createMcpServer() {
  const server = new McpServer({
    name: 'student-management-mcp',
    version: '1.0.0'
  });

  server.tool(
    'get_all_students',
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
    'get_student',
    'Find a student using studentId (e.g. ST2026) or MongoDB ObjectId',
    { id: z.string().describe('The studentId or MongoDB _id') },
    async ({ id }) => {
      await connectDB();
      let student = await Student.findOne({ studentId: id });

      if (!student && mongoose.isValidObjectId(id)) {
        student = await Student.findById(id);
      }

      return {
        content: [{
          type: 'text',
          text: student ? JSON.stringify(student, null, 2) : `Student not found with ID: ${id}`
        }]
      };
    }
  );

  server.tool(
    'add_student',
    'Add a new student to MongoDB database',
    {
      studentId: z.string().describe('Unique Student ID code, e.g. ST101'),
      name: z.string().describe("Student's full name"),
      email: z.string().email().describe("Student's valid email address"),
      department: z.string().describe('Department or branch of study, e.g. Computer Science, IT, Mechanical'),
      semester: z.number().int().min(1).max(8).describe('Semester number (1-8)')
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
    'batch_add_students',
    'Add multiple students to the database in a single operation',
    {
      students: z.array(z.object({
        studentId: z.string(),
        name: z.string(),
        email: z.string().email(),
        department: z.string(),
        semester: z.number().int().min(1).max(8)
      })).describe('Array of student objects to create')
    },
    async ({ students }) => {
      await connectDB();
      const created = [];
      const errors = [];

      for (const s of students) {
        try {
          const item = await Student.create({
            studentId: s.studentId.trim(),
            name: s.name.trim(),
            email: s.email.trim(),
            department: s.department.trim(),
            semester: Number(s.semester)
          });
          created.push(item);
        } catch (err) {
          errors.push({ studentId: s.studentId, error: err.message });
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Created ${created.length} students with ${errors.length} errors`,
            created,
            errors
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'update_student',
    'Update an existing student record in MongoDB',
    {
      id: z.string().describe('studentId or MongoDB _id of the student to update'),
      updates: z.object({
        studentId: z.string().optional().describe('New studentId if updating'),
        name: z.string().optional().describe('Updated name'),
        email: z.string().email().optional().describe('Updated email'),
        department: z.string().optional().describe('Updated department'),
        semester: z.number().int().min(1).max(8).optional().describe('Updated semester')
      }).describe('Fields to update')
    },
    async ({ id, updates }) => {
      await connectDB();
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
            : `Student with ID ${id} not found`
        }]
      };
    }
  );

  server.tool(
    'delete_student',
    'Delete a student from MongoDB using studentId or MongoDB _id',
    { id: z.string().describe('The studentId or MongoDB _id to delete') },
    async ({ id }) => {
      await connectDB();
      let student = await Student.findOneAndDelete({ studentId: id });

      if (!student && mongoose.isValidObjectId(id)) {
        student = await Student.findByIdAndDelete(id);
      }

      return {
        content: [{
          type: 'text',
          text: student
            ? JSON.stringify({ message: `Student '${student.name}' (ID: ${student.studentId}) deleted successfully` })
            : `Student not found with ID: ${id}`
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

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Student MCP Server running on port ${PORT}`);
  });
}

module.exports = { createMcpServer };
