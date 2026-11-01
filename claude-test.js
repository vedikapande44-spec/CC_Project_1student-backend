
require('dotenv').config();

async function main() {
  try {
    const { GoogleGenAI } = await import('@google/genai');

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Reply with exactly: Gemini API is working!',
    });

    console.log(response.text);
  } catch (error) {
    console.error('Gemini API test failed:', error.message);
  }
}

main();
