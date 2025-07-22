const axios = require('axios');
require('dotenv').config();

// --- Core Gemini API Function ---
async function callGemini(prompt) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not defined in the .env file.");
    }
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    };
    try {
        const response = await axios.post(API_URL, payload, { headers: { 'Content-Type': 'application/json' } });
        if (response.data.candidates && response.data.candidates.length > 0) {
            const rawResponse = response.data.candidates[0].content.parts[0].text;
            return JSON.parse(rawResponse);
        } else {
            throw new Error("API returned no candidates. The prompt may have been blocked.");
        }
    } catch (error) {
        console.error('Gemini API Error:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// --- Language Processing Function ---
const processMultilingualMessage = async (userMessage) => {
    const prompt = `Analyze the following user message. First, detect if the language is English, Hindi (Devanagari script), or Hinglish (Hindi written in Latin script).
Second, if the language is Hindi or Hinglish, translate it to English.

User Message: "${userMessage}"

Return a JSON object with two keys:
1. "language": The detected language code ('en' for English, 'hi' for Hindi/Hinglish).
2. "translatedMessage": The English translation of the message. If the original message was in English, this will be the same as the original message.

Your response MUST be ONLY the valid JSON object.

Example 1:
User Message: "Flights from Mumbai to Delhi tomorrow"
Response: {"language": "en", "translatedMessage": "Flights from Mumbai to Delhi tomorrow"}

Example 2:
User Message: "मुंबई से दिल्ली के लिए कल की फ्लाइट दिखाओ"
Response: {"language": "hi", "translatedMessage": "Show me flights from Mumbai to Delhi for tomorrow"}

Example 3:
User Message: "kal ke liye delhi ki flight chahiye"
Response: {"language": "hi", "translatedMessage": "I need a flight to Delhi for tomorrow"}
`;
    try {
        return await callGemini(prompt);
    } catch (err) {
        // Fallback in case of detection failure
        return { language: 'en', translatedMessage: userMessage };
    }
};

// --- Function to translate bot's response back ---
const translateText = async (text, targetLanguage) => {
    if (targetLanguage === 'en') {
        return text; 
    }
    const prompt = `Translate the following English text to ${targetLanguage} (Hindi).
English Text: "${text}"

Return a JSON object with one key: "translatedText".

Your response MUST be ONLY the valid JSON object.`;
    try {
        const result = await callGemini(prompt);
        return result.translatedText;
    } catch (err) {
        return text; 
    }
};


const extractFlightDetails = async (userMessage, chatHistory = []) => {
    const currentDate = new Date().toISOString().slice(0, 10);
    const historyString = chatHistory.map(turn => `${turn.role}: ${turn.content}`).join('\n');
    const systemPrompt = `You are a stateful, conversational flight booking assistant. Your job is to fill three slots: 'from', 'to', and 'date'. The current date is ${currentDate}.

CONTEXT:
${historyString}

USER'S LATEST MESSAGE (in English):
"${userMessage}"

CRITICAL INSTRUCTIONS:
1.  Analyze the user's latest message in the context of the conversation history.
2.  Your goal is to have a value for 'from', 'to', and 'date'.
3.  If the user's latest message provides all three values, return a JSON with "from", "to", and "date".
4.  If any values are missing, ask a clear, single follow-up question for the MOST important missing piece. Return a JSON with a "followUpQuestion" key.
5.  Always return dates in "YYYY-MM-DD" format. Interpret relative dates like "tomorrow" based on the current date (${currentDate}).
6.  Your entire response MUST be only the JSON object.`;

    try {
        return await callGemini(systemPrompt);
    } catch (err) {
        return { followUpQuestion: "I'm sorry, I'm having a little trouble understanding. Could you please rephrase?" };
    }
};

const generateFakeFlight = async ({ from, to, date, count = 1 }) => {
    const generationPrompt = `Create a JSON array containing ${count} plausible, fake flight objects for a flight from ${from} to ${to} on ${date}.
    
    Each JSON object in the array MUST have these exact keys: "id", "airline", "from", "to", "date", "departure", "arrival", "duration", "stops", "price".
    - "id" should be a string starting with "AI-", followed by random letters/numbers.
    - "airline" should be a realistic but fake airline name.
    - "stops" should be 0 or 1.
    - "price" should be a reasonable number for a domestic flight in INR, and each flight should have a slightly different price.

    Your response MUST be ONLY the valid JSON array.`;

    try {
        return await callGemini(generationPrompt);
    } catch (err) {
        return [];
    }
};

module.exports = {
    processMultilingualMessage,
    translateText,
    extractFlightDetails,
    generateFakeFlight
};
