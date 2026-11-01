require('dotenv').config();

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const mongoose = require('mongoose');
const { z } = require('zod');

const Student = require('./models/Student');

const server = new McpServer({
  name: 'mongodb-mcp-server',
  version: '1.0.0'
});

// 1. Check MongoDB connection
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

// 2. Get database statistics
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

// 3. Search students by department
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

// 4. Count students by semester
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

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MongoDB URI is missing from .env');
  }

  await mongoose.connect(mongoUri);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MongoDB MCP Server Error:', error.message);
  process.exit(1);
});