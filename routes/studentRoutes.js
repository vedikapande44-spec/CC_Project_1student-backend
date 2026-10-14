const express = require('express');
const router = express.Router();
const Student = require('../models/Student');

// 1. Get All Students
router.get('/', async (req, res) => {
  try {
    const students = await Student.find({});
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch students', error: error.message });
  }
});

// 2. Add Student
router.post('/', async (req, res) => {
  try {
    const student = await Student.create(req.body);
    res.status(201).json({ message: 'Student added successfully', student });
  } catch (error) {
    res.status(400).json({ message: 'Failed to add student', error: error.message });
  }
});

// 3. Delete Student (by studentId or _id)
router.delete('/:id', async (req, res) => {
  try {
    const paramId = req.params.id;
    
    // First try deleting by custom studentId, if not found try by Mongo _id
    let student = await Student.findOneAndDelete({ studentId: paramId });
    if (!student && paramId.match(/^[0-9a-fA-F]{24}$/)) {
      student = await Student.findByIdAndDelete(paramId);
    }

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({ message: 'Student deleted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete student', error: error.message });
  }
});

module.exports = router;