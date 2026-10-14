const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Student = require('../models/Student');

// 1. Get all students
router.get('/', async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    return res.status(200).json(students);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch students',
      error: error.message
    });
  }
});

// 2. Get one student by studentId
router.get('/:id', async (req, res) => {
  try {
    const paramId = req.params.id;
    let student = await Student.findOne({ studentId: paramId });

    // If not found, also allow searching by MongoDB _id
    if (!student && mongoose.isValidObjectId(paramId)) {
      student = await Student.findById(paramId);
    }

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.status(200).json(student);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch student',
      error: error.message
    });
  }
});

// 3. Add a student
router.post('/', async (req, res) => {
  try {
    const { studentId, name, email, department, semester } = req.body;

    if (
      !studentId?.trim() ||
      !name?.trim() ||
      !email?.trim() ||
      !department?.trim() ||
      semester === undefined ||
      semester === null ||
      semester === ''
    ) {
      return res.status(400).json({
        message: 'All fields are required: studentId, name, email, department, semester'
      });
    }

    const student = await Student.create({
      studentId: studentId.trim(),
      name: name.trim(),
      email: email.trim(),
      department: department.trim(),
      semester: Number(semester)
    });

    return res.status(201).json({
      message: 'Student added successfully',
      student
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'A student with this studentId already exists'
      });
    }

    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid student data',
        error: error.message
      });
    }

    return res.status(500).json({
      message: 'Failed to add student',
      error: error.message
    });
  }
});

// 4. Update a student by studentId or MongoDB _id
router.put('/:id', async (req, res) => {
  try {
    const paramId = req.params.id;
    const allowedFields = [
      'studentId',
      'name',
      'email',
      'department',
      'semester'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'Provide at least one field to update'
      });
    }

    for (const field of ['studentId', 'name', 'email', 'department']) {
      if (updates[field] !== undefined) {
        if (
          typeof updates[field] !== 'string' ||
          !updates[field].trim()
        ) {
          return res.status(400).json({
            message: `${field} must be a non-empty string`
          });
        }
        updates[field] = updates[field].trim();
      }
    }

    if (updates.semester !== undefined) {
      updates.semester = Number(updates.semester);
      if (!Number.isInteger(updates.semester) || updates.semester < 1) {
        return res.status(400).json({
          message: 'Semester must be a positive integer'
        });
      }
    }

    let student = await Student.findOneAndUpdate(
      { studentId: paramId },
      updates,
      { new: true, runValidators: true }
    );

    if (!student && mongoose.isValidObjectId(paramId)) {
      student = await Student.findByIdAndUpdate(
        paramId,
        updates,
        { new: true, runValidators: true }
      );
    }

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.status(200).json({
      message: 'Student updated successfully',
      student
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'That studentId is already in use'
      });
    }

    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid student data',
        error: error.message
      });
    }

    return res.status(500).json({
      message: 'Failed to update student',
      error: error.message
    });
  }
});

// 5. Delete a student by studentId or MongoDB _id
router.delete('/:id', async (req, res) => {
  try {
    const paramId = req.params.id;
    let student = await Student.findOneAndDelete({
      studentId: paramId
    });

    if (!student && mongoose.isValidObjectId(paramId)) {
      student = await Student.findByIdAndDelete(paramId);
    }

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.status(200).json({
      message: 'Student deleted successfully',
      student
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete student',
      error: error.message
    });
  }
});

module.exports = router;