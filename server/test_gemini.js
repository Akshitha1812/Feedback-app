import dotenv from 'dotenv';
dotenv.config();
import { initGemini, runSynthesisEngine } from './gemini.js';

async function test() {
    try {
        console.log("Key available:", !!process.env.GEMINI_API_KEY);
        const genAI = initGemini(process.env.GEMINI_API_KEY);
        const res = await runSynthesisEngine(genAI, ["this is a test answer"]);
        console.log("SUCCESS:", res.substring(0, 100));
    } catch (e) {
        console.error("DEBUG ERROR:", e);
    }
}
test();
