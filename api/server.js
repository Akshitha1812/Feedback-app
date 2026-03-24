import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { networkInterfaces } from 'os';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import { runQuery, getQuery } from './db.js';
import { initGemini, runSynthesisEngine, generateQuizFromContext } from './gemini.js';

const upload = multer({ storage: multer.memoryStorage() });

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large payloads

const PORT = process.env.PORT || 5001;
const genAI = initGemini(process.env.GEMINI_API_KEY);

// Debug Middleware (commented out for production as Vercel has read-only filesystem)
/*
app.use((req, res, next) => {
    fs.appendFileSync('server_debug.log', `[${new Date().toISOString()}] ${req.method} ${req.url}\n`);
    next();
});
*/

// Health & Debug Route
app.get('/api/health', async (req, res) => {
    try {
        const dbStatus = await getQuery("SELECT 1 as connected");
        const dbUrl = process.env.TURSO_DATABASE_URL || '';
        res.json({
            status: 'ok',
            database: dbStatus.length > 0 ? 'connected' : 'error',
            turso: !!process.env.TURSO_DATABASE_URL,
            is_dashboard_url: dbUrl.includes('turso.tech/organizations') || dbUrl.includes('turso.tech/databases'),
            turso_prefix: dbUrl ? dbUrl.substring(0, 10) : 'none',
            gemini: !!process.env.GEMINI_API_KEY,
            node_env: process.env.NODE_ENV
        });
    } catch (e) {
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            details: e.message,
            turso_set: !!process.env.TURSO_DATABASE_URL
        });
    }
});

// Default Route
app.get('/api/status', (req, res) => {
    res.json({ status: 'Server is running', ai_initialized: !!process.env.GEMINI_API_KEY });
});

// Network IPs Route
app.get('/api/network', (req, res) => {
    const interfaces = networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({ name, ip: iface.address });
            }
        }
    }
    // Fallback if no external IP found
    if (ips.length === 0) ips.push({ name: 'Localhost', ip: 'localhost' });
    res.json(ips);
});

// List all sessions/questions
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await getQuery('SELECT id, question, question_type, created_at FROM sessions ORDER BY created_at DESC');
        res.json(sessions);
    } catch (error) {
        console.error("GET /api/sessions error:", error);
        res.status(500).json({ error: "Failed to fetch sessions", details: error.message });
    }
});
// AI Assistant Quiz Generation
app.post('/api/ai/generate', async (req, res) => {
    try {
        const { contextText, constraints, types, count, difficulty, focus } = req.body;
        const genAI = initGemini(process.env.GEMINI_API_KEY);
        const quiz = await generateQuizFromContext(genAI, contextText, constraints, types, count, difficulty, focus);
        res.json(quiz);
    } catch (error) {
        console.error("Quiz Gen API Error:", error);
        res.status(500).json({ error: "Failed to generate AI quiz" });
    }
});

// PDF Content Extraction
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        console.log("Parsing PDF:", req.file.originalname, "Size:", req.file.buffer.length);

        try {
            const data = await pdfParse(req.file.buffer);
            if (!data || !data.text) {
                throw new Error("PDF parsing returned empty or invalid data");
            }
            res.json({ text: data.text });
        } catch (parseError) {
            console.error('Inner PDF Parse Error:', parseError);
            res.status(500).json({
                error: 'Internal PDF Parser Error',
                details: parseError.message,
                tip: 'The PDF might be encrypted or using an unsupported format.'
            });
        }
    } catch (error) {
        console.error('Outer Upload Error:', error);
        res.status(500).json({
            error: 'Failed to process upload',
            details: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
    }
});

// Create a new session (Question)
app.post('/api/sessions', async (req, res) => {
    try {
        const { question, question_type = 'open_ended', options = [] } = req.body;
        if (!question) return res.status(400).json({ error: "Question is required" });

        const sessionId = uuidv4();
        const optionsString = JSON.stringify(options);
        await runQuery('INSERT INTO sessions (id, question, question_type, options) VALUES (?, ?, ?, ?)', [sessionId, question, question_type, optionsString]);

        // Base URL for QR codes
        let baseUrl = process.env.FRONTEND_URL;

        if (!baseUrl) {
            if (process.env.NODE_ENV === 'production') {
                const host = req.get('host');
                const protocol = req.protocol;
                baseUrl = `${protocol}://${host}`;
            } else {
                let localIp = 'localhost';
                try {
                    const interfaces = networkInterfaces();
                    for (const name of Object.keys(interfaces)) {
                        for (const iface of interfaces[name]) {
                            if (iface.family === 'IPv4' && !iface.internal) {
                                localIp = iface.address;
                            }
                        }
                    }
                } catch (e) { }
                baseUrl = `http://${localIp}:5173`;
            }
        }

        const submitUrl = `${baseUrl}/submit/${sessionId}`;

        const qrCodeDataUrl = await QRCode.toDataURL(submitUrl);

        res.json({ sessionId, question, question_type, options, qrCodeUrl: qrCodeDataUrl, submitUrl });
    } catch (error) {
        console.error("POST /api/sessions error:", error);
        res.status(500).json({ error: "Failed to create session", details: error.message, stack: error.stack });
    }
});

// Get session details (for student rendering the correct poll UI)
app.get('/api/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const sessions = await getQuery('SELECT id, question, question_type, options FROM sessions WHERE id = ?', [sessionId]);
        if (sessions.length === 0) return res.status(404).json({ error: "Session not found" });

        const session = sessions[0];
        if (session.options) {
            try { session.options = JSON.parse(session.options); } catch (e) { session.options = []; }
        }
        res.json(session);
    } catch (error) {
        console.error("GET /api/sessions/:id error:", error);
        res.status(500).json({ error: "Failed to fetch session metadata", details: error.message });
    }
});

// Delete a session (clear all data for a session)
app.delete('/api/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        await runQuery('DELETE FROM answers WHERE session_id = ?', [sessionId]);
        await runQuery('DELETE FROM history_log WHERE session_id = ?', [sessionId]);
        await runQuery('DELETE FROM sessions WHERE id = ?', [sessionId]);
        res.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/sessions/:id error:", error);
        res.status(500).json({ error: "Failed to delete session", details: error.message });
    }
});

// Submit a single answer (e.g., Student scanning QR Code)
app.post('/api/sessions/:sessionId/answers', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { text, studentName } = req.body;

        if (!text) return res.status(400).json({ error: "Answer text is required" });

        await runQuery('INSERT INTO answers (session_id, text, student_name) VALUES (?, ?, ?)', [sessionId, text, studentName || null]);
        res.json({ success: true });
    } catch (error) {
        console.error("POST /answers error:", error);
        res.status(500).json({ error: "Failed to submit answer", details: error.message });
    }
});

// Bulk submit answers (Prof pasting 100+ answers in raw input module)
app.post('/api/sessions/:sessionId/answers/bulk', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { answers } = req.body; // Array of strings or objects {text: ""}

        if (!answers || !Array.isArray(answers)) return res.status(400).json({ error: "Answers array is required" });

        for (const ans of answers) {
            const text = typeof ans === 'string' ? ans : ans.text;
            if (text) {
                await runQuery('INSERT INTO answers (session_id, text) VALUES (?, ?)', [sessionId, text]);
            }
        }
        res.json({ success: true, count: answers.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to bulk submit answers" });
    }
});

// Get all answers for a session
app.get('/api/sessions/:sessionId/answers', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const answers = await getQuery('SELECT id, text, student_name, created_at FROM answers WHERE session_id = ? ORDER BY created_at DESC', [sessionId]);
        res.json(answers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch answers" });
    }
});

// Run// Analysis Engine (Triggers Gemini Synthesis)
app.post('/api/sessions/:sessionId/analyze', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const config = req.body; // should contain includeExplanations, summaryMode, identifyTraits

        const answers = await getQuery('SELECT text, student_name FROM answers WHERE session_id = ?', [sessionId]);
        if (answers.length === 0) return res.status(400).json({ error: "No answers to analyze" });

        const sessions = await getQuery('SELECT question, question_type, options FROM sessions WHERE id = ?', [sessionId]);
        const sessionMeta = sessions.length > 0 ? sessions[0] : { question: "Unknown", question_type: "open_ended", options: "[]" };

        const genAI = initGemini(process.env.GEMINI_API_KEY);
        const synthesis = await runSynthesisEngine(genAI, answers, config, sessionMeta);

        // Store in History Log
        await runQuery(
            'INSERT INTO history_log (session_id, markdown_synthesis, answer_count) VALUES (?, ?, ?)',
            [sessionId, synthesis, answers.length]
        );

        res.json({ markdown_synthesis: synthesis, answer_count: answers.length });
    } catch (error) {
        console.error("POST /analyze error:", error);
        res.status(500).json({ error: "Failed to run analysis", details: error.message });
    }
});

// View History Log for a session
app.get('/api/sessions/:sessionId/history', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const history = await getQuery('SELECT id, markdown_synthesis, answer_count, created_at FROM history_log WHERE session_id = ? ORDER BY created_at DESC', [sessionId]);
        res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Global Error Handler Catch:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
});

export default app;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
