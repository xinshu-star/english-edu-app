/**
 * api.js — AI API 调用封装
 * 通过本地 Flask 代理 (/api/chat) 调用 DeepSeek API
 */

const API = (() => {
    // 超时 fetch 封装
    async function fetchWithTimeout(url, options, timeoutMs = 30000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const resp = await fetch(url, { ...options, signal: controller.signal });
            return resp;
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * 通用聊天请求
     */
    async function chat(messages, options = {}) {
        const { temperature = 0.7, max_tokens = 1000, response_format = null, timeout = 30000 } = options;

        const body = { messages, temperature, max_tokens };
        if (response_format) {
            body.response_format = response_format;
        }

        const apiKey = Storage.getApiKey();
        if (apiKey) {
            body.api_key = apiKey;
        }

        const resp = await fetchWithTimeout('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }, timeout);

        const data = await resp.json();

        if (!resp.ok) {
            throw new Error(data.error || `请求失败 (${resp.status})`);
        }

        return { content: data.content, usage: data.usage };
    }

    /**
     * 从 AI 响应中提取 JSON（容错处理）
     * AI 有时会在 JSON 外面包 markdown 代码块或额外文字
     */
    function extractJSON(text) {
        // 尝试直接解析
        try {
            return JSON.parse(text);
        } catch (e) {
            // 提取 ```json ... ``` 中的内容
            const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
            if (codeBlock) {
                try {
                    return JSON.parse(codeBlock[1].trim());
                } catch (e2) { /* 继续尝试 */ }
            }
            // 提取第一个 { 到最后一个 } 之间的内容
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                try {
                    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
                } catch (e3) { /* 最后一次尝试失败 */ }
            }
            throw new Error('无法解析 AI 返回的 JSON 格式');
        }
    }

    /**
     * 生成面试问题
     * @param {Array} learnedWords - 用户已学的单词列表
     * @returns {Promise<{question: string}>}
     */
    async function generateQuestion(learnedWords, recentQuestions) {
        // 随机取 8 个已学单词（打乱增加多样性）
        const shuffled = [...learnedWords].sort(() => Math.random() - 0.5);
        const wordList = shuffled.slice(0, 8).map(w => w.word).join(', ');

        // 最近问过的问题（避免重复）
        const recentList = (recentQuestions || []).slice(-5).map(q => `"${q}"`).join(', ');
        const avoidHint = recentList
            ? `\nAVOID these recently asked questions: ${recentList}\nGenerate a COMPLETELY DIFFERENT question.`
            : '';

        const questionTypes = [
            'research interests and motivation',
            'methodology and research design',
            'theoretical framework and literature',
            'teaching experience and pedagogy',
            'academic writing and publication',
            'career goals and contribution',
            'ethical considerations',
            'interdisciplinary perspectives',
            'challenges in education',
            'personal experience as a learner',
        ];
        const randomType = questionTypes[Math.floor(Math.random() * questionTypes.length)];

        const systemPrompt = `You are an Education PhD admissions panel member interviewing an applicant.

Generate ONE interview question in English. Topic area: ${randomType}.
Reference vocabulary (optional): ${wordList || 'education research'}.${avoidHint}

Rules:
- Sound like a real professor asking a real interview question
- Vary your question style: sometimes ask "how would you...", sometimes "can you describe...", sometimes "what is your opinion on..."
- NOT a vocabulary quiz — the words should feel natural in context
- 1-2 minute answer length

Respond ONLY with JSON: {"question": "..."}`;

        const { content } = await chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Ask me an interview question.' },
        ], { temperature: 0.95, max_tokens: 200 });

        return extractJSON(content);
    }

    /**
     * 评分回答
     * @param {string} question - 面试问题
     * @param {string} answer - 用户回答
     * @returns {Promise<{score: number, feedback: string, strengths: string[], weaknesses: string[]}>}
     */
    async function scoreAnswer(question, answer) {
        const systemPrompt = `You are an Education PhD interview evaluator. Score this candidate's English answer to the interview question.

Question: "${question}"
Answer: "${answer}"

Evaluate on four dimensions:
1. Relevance to the question (30% of score)
2. Use of academic/education vocabulary (30% of score)
3. Clarity and organization (20% of score)
4. Depth of critical thinking (20% of score)

Respond ONLY with a JSON object:
{
  "score": <0-100 integer>,
  "feedback": "<2-3 sentences of constructive feedback in Chinese (简体中文)>",
  "strengths": ["<one specific strength in English>"],
  "weaknesses": ["<one specific area to improve in English>"]
}`;

        const { content } = await chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Please evaluate this answer.' },
        ], { temperature: 0.5, max_tokens: 500 });

        return extractJSON(content);
    }

    /**
     * 检查 API 连接是否正常
     * @returns {Promise<boolean>}
     */
    /**
     * 生成参考答案
     * @param {string} question - 面试问题
     * @returns {Promise<{answer: string}>}
     */
    async function generateReferenceAnswer(question) {
        const systemPrompt = `You are an excellent Education PhD candidate. Write a model answer (2-3 paragraphs, in English) to this interview question. Use academic vocabulary naturally. Sound confident but not arrogant. The answer should demonstrate critical thinking and subject knowledge.

Question: "${question}"

Respond ONLY with a JSON object: {"answer": "your model answer here"}`;

        const { content } = await chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Write a model answer.' },
        ], { temperature: 0.7, max_tokens: 400 });

        return extractJSON(content);
    }

    async function testConnection() {
        try {
            const apiKey = Storage.getApiKey();
            const body = apiKey ? { api_key: apiKey } : {};
            const resp = await fetchWithTimeout('/api/health', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }, 8000);
            const data = await resp.json();
            return data.apiKeyConfigured === true;
        } catch (e) {
            return false;
        }
    }

    return {
        chat,
        generateQuestion,
        scoreAnswer,
        generateReferenceAnswer,
        testConnection,
    };
})();
