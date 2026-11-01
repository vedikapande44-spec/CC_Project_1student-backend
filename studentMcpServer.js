require('dotenv').config();

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const Student = require('./models/Student');
const mongoose = require('mongoose');

const server = new McpServer({
  name: 'student-management-mcp',
  version: '1.0.0'
});

// 1. Get all students
server.tool(
  'get_all_students',
  'Get all student records from MongoDB',
  {},
  async () => {
    const students = await Student.find().sort({ createdAt: -1 });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(students, null, 2)
      }]
    };
  }
);

// 2. Get student by studentId or MongoDB ID
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
        text: student
          ? JSON.stringify(student, null, 2)
          : 'Student not found'
      }]
    };
  }
);

// 3. Add student
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
        text: JSON.stringify({
          message: 'Student added successfully',
          student
        }, null, 2)
      }]
    };
  }
);

// 4. Update student
server.tool(
  'update_student',
  'Update an existing student using studentId or MongoDB ID',
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
      { studentId: id },
      updates,
      { new: true, runValidators: true }
    );

    if (!student && mongoose.isValidObjectId(id)) {
      student = await Student.findByIdAndUpdate(
        id,
        updates,
        { new: true, runValidators: true }
      );
    }

    return {
      content: [{
        type: 'text',
        text: student
          ? JSON.stringify({
              message: 'Student updated successfully',
              student
            }, null, 2)
          : 'Student not found'
      }]
    };
  }
);

// 5. Delete student
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
        text: student
          ? 'Student deleted successfully'
          : 'Student not found'
      }]
    };
  }
);

async function main() {
  await mongoose.connect(
    process.env.MONGO_URI || process.env.MONGODB_URI
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Student MCP Server Error:', error.message);
  process.exit(1);
});
