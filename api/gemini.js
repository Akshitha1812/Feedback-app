import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini SDK
// Note: We need to pass the API key from environment variables.
export const initGemini = (apiKey) => {
    if (!apiKey) {
        console.warn("WARNING: GEMINI_API_KEY is not set. Synthesis will fail.");
    }
    return new GoogleGenerativeAI(apiKey);
};

const TA_SYSTEM_INSTRUCTION = `
Act as an expert Teaching Assistant and engaging pedagogical consultant.
Task: Analyze the provided student responses to identify learning gaps and clarify overall class comprehension.
Tone: Be enthusiastic, engaging, highly readable, and professional. Avoid being dry or boring. Use simple, human-readable explanations.
Constraint: Do not repeat what the students said verbatim; synthesize it into clear, engaging insights.
Constraint: Ensure the output is anonymous and contains no student names.
Constraint: DO NOT use markdown bolding (**) or italics (*) anywhere in your paragraph bodies or bullet points. Write naturally.

Based on the prompt parameters, format the output cleanly.
Always use exactly these Headers (##) and simple bullet points for structure:
## Top Recurring Themes
(Identify 3-5 main ideas and start with stats if applicable)
## Points of Confusion
(Flag specific misconceptions clearly and empathetically)
## Insightful Outliers
(Extract unique perspectives)
`;

export async function runSynthesisEngine(genAI, rawAnswersArray, config = {}, sessionContext = { question: "Unknown", question_type: "open_ended", options: "[]" }) {
    try {
        const { includeExplanations, summaryMode, identifyTraits } = config;

        // Step 1: Pre-process and Scrub PII
        const scrubbedData = rawAnswersArray.map((answer, index) => {
            const cleanText = scrubStudentIdentifier(answer.text || answer);
            return `Student ${index + 1}: ${cleanText}`;
        });

        const combinedCorpus = scrubbedData.join('\n---NEXT_RESPONSE---\n');
        if (!combinedCorpus.trim()) return "No answers provided for synthesis.";

        // Step 2: Initialize Model
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: TA_SYSTEM_INSTRUCTION,
            generationConfig: { temperature: 0.2 }
        });

        // Step 3: Construct Dynamic Prompt based on Sidebar Config
        let specificInstructions = `- The original question asked to students was: "${sessionContext.question}"\n`;

        let parsedOptions = [];
        try { parsedOptions = JSON.parse(sessionContext.options || "[]"); } catch (e) { }

        if (sessionContext.question_type === 'multi_question') {
            specificInstructions += `- This was a full MULTI-QUESTION QUIZ. The questions in the quiz were exactly: ${JSON.stringify(parsedOptions)}.\n`;
            specificInstructions += `- CRITICAL REQUIREMENT: The student responses are formatted as JSON where the keys correspond to the question index in the array above.\n`;
            specificInstructions += `- CRITICAL REQUIREMENT: For the 'Top Recurring Themes' section, you MUST analyze each question sequentially. For any multiple choice or true/false questions, you MUST precisely state the statistical distribution (e.g. 'For Question 1: 8 students chose X, 2 chose Y').\n`;
        } else if (sessionContext.question_type === 'multiple_choice' || sessionContext.question_type === 'true_false') {
            specificInstructions += `- This was a ${sessionContext.question_type.replace('_', ' ')} question. The choices were: ${parsedOptions.join(', ')}.\n`;
            specificInstructions += `- CRITICAL REQUIREMENT: In your 'Top Recurring Themes' section, you MUST precisely state the statistical distribution of the answers (e.g. '8 students chose X, while 2 students chose Y'). Clearly articulate how many students selected which option.\n`;
        }

        specificInstructions += "- CRITICAL: Ignore trivial spelling errors, typos, brevity, or abbreviations. Focus strictly on the core semantic meaning in relation to the question.\n";
        specificInstructions += "- CRITICAL: Give proper human readable explanations that are clear, engaging, and easy to read. Write like you are genuinely helping a professor understand their class without using any stars or markdown formatting in your sentences.\n";

        if (summaryMode === 'three_main_ideas') specificInstructions += "- Summarize the data into exactly THREE main ideas.\n";
        if (summaryMode === 'two_main_ideas') specificInstructions += "- Summarize the data into exactly TWO main ideas.\n";

        if (identifyTraits === 'most_interesting') specificInstructions += "- Specifically highlight what is the MOST INTERESTING aspect of the feedback.\n";
        if (identifyTraits === 'most_fun') specificInstructions += "- Specifically highlight what is the MOST FUN aspect of the feedback.\n";
        if (identifyTraits === 'quality_of_decision') specificInstructions += "- Specifically analyze responses related to the QUALITY OF DECISON found in the text.\n";

        if (includeExplanations) specificInstructions += "- Include a one-sentence explanation for each point.\n";

        const finalPrompt = `Analyze the student responses with the following focus:\n${specificInstructions}\n\nDATASET:\n${combinedCorpus}`;

        const result = await model.generateContent(finalPrompt);
        return result.response.text();
    } catch (error) {
        console.error("Synthesis Engine Error:", error);
        throw new Error("Failed to synthesize classroom data.");
    }
}

const QUIZ_GEN_SYSTEM_INSTRUCTION = `
Act as an expert instructional designer. 
Task: Generate a set of quiz questions based on the provided text context.
Output Format: You MUST return a JSON object with a "questions" array.
Each question object must have:
- "question": The question text.
- "type": "multiple_choice", "true_false", or "open_ended".
- "options": An array of strings (required for MCQ and T/F).

Constraint: Be pedagogically sound. Focus on key concepts and potential misconceptions.
`;

export async function generateQuizFromContext(genAI, contextText, userConstraints = "", types = [], count = 3, difficulty = "Medium", focus = "Concept Understanding") {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: QUIZ_GEN_SYSTEM_INSTRUCTION,
            generationConfig: {
                temperature: 0.7,
                responseMimeType: "application/json",
            }
        });

        const typeConstraint = types.length > 0
            ? `ONLY use the following question types: ${types.join(', ')}.`
            : "Use a mix of multiple_choice, true_false, and open_ended questions.";

        const prompt = `Based on the following text context, generate exactly ${count} quiz questions.
        Question Type Constraints: ${typeConstraint}
        Difficulty Level: ${difficulty}
        Test Focus: ${focus}
        Instructor Constraints: ${userConstraints}
        
        CONTEXT:
        ${contextText}`;

        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("Quiz Generation Error:", error);
        throw new Error("Failed to generate quiz from context.");
    }
}

function scrubStudentIdentifier(text) {
    return text.trim();
}
