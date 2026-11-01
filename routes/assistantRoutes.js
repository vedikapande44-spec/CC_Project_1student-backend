
const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Please provide a message'
      });
    }

    const { GoogleGenAI } = await import('@google/genai');

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: message
    });

    res.json({
      reply: response.text
    });

  } catch (error) {
    console.error('Gemini Assistant Error:', error.message);

    res.status(500).json({
      error: 'AI assistant request failed'
    });
  }
});

module.exports = router;
