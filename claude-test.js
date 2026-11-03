require('dotenv').config();

async function main() {
  try {
    const { GoogleGenAI } = await import('@google/genai');

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    const response = await ai.models.generateContent({
      model: modelName,
      contents: 'Reply with exactly: Gemini API with MCP is working!',
    });

    console.log(`[Success using ${modelName}]: ${response.text?.trim()}`);
  } catch (error) {
    console.error('Gemini API test failed:', error.message);
  }
}

main();
