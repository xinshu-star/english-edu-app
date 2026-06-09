/**
 * storage.js — 数据持久化层
 * 所有数据存储在浏览器 localStorage 中
 * 提供单词管理、进度追踪、数据导入导出等功能
 */

const Storage = (() => {
    // localStorage key 前缀
    const KEYS = {
        WORDS: 'vocab_words',
        PROGRESS: 'vocab_progress',
        SPELLING: 'spelling_history',
        INTERVIEW: 'interview_history',
        INTERVIEW_QUEUE: 'interview_queue',
        SETTINGS: 'app_settings',
    };

    // ===== 默认设置 =====
    const DEFAULT_SETTINGS = {
        dailyWordCount: 10,
        scoringThreshold: 60,
        ttsVoiceIndex: 0,
        ttsRate: 1.0,
        apiKey: '',
    };

    // ===== 通用读写 =====
    function load(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error(`Storage: 读取 ${key} 失败`, e);
            return null;
        }
    }

    function save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error(`Storage: 写入 ${key} 失败`, e);
            return false;
        }
    }

    // ===== 单词管理 =====
    function getWords() {
        let words = load(KEYS.WORDS);
        if (!words || !Array.isArray(words) || words.length === 0) {
            words = [];
            save(KEYS.WORDS, words);
        }
        return words;
    }

    function saveWords(words) {
        return save(KEYS.WORDS, words);
    }

    /**
     * 初始化预置单词（如果本地没有单词数据，就从服务器加载）
     */
    async function initWords() {
        let words = getWords();
        // 总是从服务器获取最新词库，检测是否有更新
        try {
            const resp = await fetch('/data/vocabulary.json');
            if (resp.ok) {
                const data = await resp.json();
                const serverWords = data.map((w, i) => ({
                    ...w,
                    id: w.id || `w${String(i + 1).padStart(3, '0')}`,
                    source: 'preloaded',
                }));
                // 如果服务器词库比本地多（或有不同），合并更新
                if (serverWords.length > words.length) {
                    // 保留用户的 progress 数据，只更新单词本身
                    const existingMap = {};
                    words.forEach(w => { existingMap[w.id] = w; });
                    const merged = serverWords.map(sw => {
                        // 保留本地已有的单词（可能用户修改过）
                        if (existingMap[sw.id]) {
                            return { ...sw, ...existingMap[sw.id], id: sw.id };
                        }
                        return sw;
                    });
                    words = merged;
                    saveWords(words);
                } else if (words.length === 0) {
                    words = serverWords;
                    saveWords(words);
                }
            }
        } catch (e) {
            console.error('Storage: 加载预置单词失败', e);
        }
        return words;
    }

    /**
     * 添加用户自定义单词
     */
    function addWord(english, chinese, category, phonetic, example) {
        const words = getWords();
        // 检查重复
        if (words.some(w => w.word.toLowerCase() === english.toLowerCase().trim())) {
            return { success: false, error: `单词 "${english}" 已存在` };
        }
        const maxId = words.reduce((max, w) => {
            const num = parseInt(w.id.replace('w', ''), 10);
            return num > max ? num : max;
        }, 0);
        const newWord = {
            id: `w${String(maxId + 1).padStart(3, '0')}`,
            word: english.trim(),
            chinese: chinese.trim(),
            pronunciation: phonetic?.trim() || '',
            category: category || 'other',
            example: example?.trim() || '',
            source: 'user',
        };
        words.push(newWord);
        saveWords(words);
        return { success: true, word: newWord };
    }

    /**
     * 批量导入单词（CSV/逐行格式: "english, chinese"）
     */
    function batchImportWords(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const results = { added: [], skipped: [] };
        for (const line of lines) {
            const parts = line.split(/[,，]/);
            if (parts.length >= 2) {
                const english = parts[0].trim();
                const chinese = parts.slice(1).join(',').trim();
                if (english && chinese) {
                    const result = addWord(english, chinese, 'other', '', '');
                    if (result.success) {
                        results.added.push(english);
                    } else {
                        results.skipped.push(english);
                    }
                }
            }
        }
        return results;
    }

    // ===== 进度管理 =====
    function getProgress() {
        let progress = load(KEYS.PROGRESS);
        if (!progress) {
            progress = {};
            save(KEYS.PROGRESS, progress);
        }
        return progress;
    }

    function saveProgress(progress) {
        return save(KEYS.PROGRESS, progress);
    }

    /**
     * 获取单词进度，如果没有则返回默认值
     */
    function getWordProgress(wordId) {
        const progress = getProgress();
        if (!progress[wordId]) {
            progress[wordId] = {
                remembered: null,
                lastReviewed: null,
                timesCorrect: 0,
                timesWrong: 0,
                reviewDue: null,
                mastered: false,
                reviewRememberedCount: 0,
            };
        }
        // 补充缺失的字段（兼容旧数据）
        if (progress[wordId].mastered === undefined) progress[wordId].mastered = false;
        if (progress[wordId].reviewRememberedCount === undefined) progress[wordId].reviewRememberedCount = 0;
        return progress[wordId];
    }

    /**
     * 标记单词为"记住了"（普通练习模式）
     */
    function markRemembered(wordId) {
        const progress = getProgress();
        const today = getToday();
        const tomorrow = getTomorrow();
        if (!progress[wordId]) {
            progress[wordId] = { timesCorrect: 0, timesWrong: 0 };
        }
        progress[wordId].remembered = today;
        progress[wordId].lastReviewed = today;
        progress[wordId].timesCorrect = (progress[wordId].timesCorrect || 0) + 1;
        progress[wordId].reviewDue = tomorrow;
        saveProgress(progress);
    }

    /**
     * 标记单词为"记住了"（复习模式）
     * 累积 2 次 → 标记为已掌握
     */
    function markRememberedInReview(wordId) {
        const progress = getProgress();
        const today = getToday();
        const tomorrow = getTomorrow();
        if (!progress[wordId]) {
            progress[wordId] = { timesCorrect: 0, timesWrong: 0, reviewRememberedCount: 0 };
        }
        progress[wordId].lastReviewed = today;
        progress[wordId].timesCorrect = (progress[wordId].timesCorrect || 0) + 1;
        progress[wordId].reviewRememberedCount = (progress[wordId].reviewRememberedCount || 0) + 1;
        progress[wordId].reviewDue = tomorrow;

        // 累积 2 次记住 → 已掌握
        if (progress[wordId].reviewRememberedCount >= 2) {
            progress[wordId].mastered = true;
            progress[wordId].remembered = today;
        }
        saveProgress(progress);
    }

    /**
     * 标记单词为"没记住"或"记不清"
     */
    function markNotRemembered(wordId) {
        const progress = getProgress();
        const today = getToday();
        if (!progress[wordId]) {
            progress[wordId] = { timesCorrect: 0, timesWrong: 0 };
        }
        progress[wordId].remembered = null;
        progress[wordId].lastReviewed = today;
        progress[wordId].timesWrong = (progress[wordId].timesWrong || 0) + 1;
        progress[wordId].reviewDue = today; // 当天重新练习
        // 复习计数重置（在复习模式下点没记住，重新计数）
        progress[wordId].reviewRememberedCount = 0;
        progress[wordId].mastered = false;
        saveProgress(progress);
    }

    /**
     * 获取今天需要复习的单词 + 新单词（普通练习模式）
     * 排除已掌握的单词
     */
    function getDueWords(count) {
        const words = getWords();
        const progress = getProgress();
        const today = getToday();

        if (words.length === 0) return [];

        const dueList = [];   // 到期需要复习的
        const newList = [];   // 从未见过的
        const seenList = [];  // 见过但不到期的（填充用）

        for (const word of words) {
            const p = progress[word.id];
            // 跳过已掌握的
            if (p && p.mastered) continue;
            if (!p || (!p.lastReviewed && !p.reviewDue)) {
                newList.push({ word, isReview: false });
            } else if (p.reviewDue && p.reviewDue <= today) {
                dueList.push({ word, isReview: true, progress: p });
            } else {
                seenList.push({ word, isReview: false, progress: p });
            }
        }

        // 打乱各组
        shuffle(dueList);
        shuffle(newList);
        shuffle(seenList);

        // 优先：到期的 > 新词 > 见过的
        let result = [...dueList, ...newList, ...seenList];

        // 截取需要的数量
        return result.slice(0, count || getSettings().dailyWordCount);
    }

    /**
     * 获取新词（从未见过的单词）
     * 用于"开始练习"模式
     */
    function getNewWords(count) {
        const words = getWords();
        const progress = getProgress();

        if (words.length === 0) return [];

        const newList = [];
        for (const word of words) {
            const p = progress[word.id];
            // 跳过已掌握
            if (p && p.mastered) continue;
            // 只要从未见过的
            if (!p || (!p.lastReviewed && !p.reviewDue)) {
                newList.push({ word, isReview: false });
            }
        }

        shuffle(newList);
        return newList.slice(0, count || getSettings().dailyWordCount);
    }

    /**
     * 获取今日复习的单词（所有标记为记住了但未掌握的）
     */
    function getReviewWords() {
        const words = getWords();
        const progress = getProgress();
        const reviewWords = [];

        for (const word of words) {
            const p = progress[word.id];
            if (p && p.remembered && !p.mastered) {
                reviewWords.push({ word, progress: p, isReview: true });
            }
        }

        shuffle(reviewWords);
        return reviewWords;
    }

    /**
     * 获取所有"记住了"的单词（不含已掌握的）
     */
    function getRememberedWords() {
        const words = getWords();
        const progress = getProgress();
        return words.filter(w => {
            const p = progress[w.id];
            return p && p.remembered && !p.mastered;
        });
    }

    /**
     * 获取"记住了"的单词数量（不含已掌握的）
     */
    function getRememberedCount() {
        return getRememberedWords().length;
    }

    /**
     * 获取所有已掌握的单词
     */
    function getMasteredWords() {
        const words = getWords();
        const progress = getProgress();
        return words.filter(w => {
            const p = progress[w.id];
            return p && p.mastered;
        });
    }

    /**
     * 获取已掌握的单词数量
     */
    function getMasteredCount() {
        return getMasteredWords().length;
    }

    /**
     * 获取总体学习统计
     */
    function getVocabStats() {
        const progress = getProgress();
        const words = getWords();
        let remembered = 0;
        let mastered = 0;
        let totalReviewed = 0;
        for (const w of words) {
            const p = progress[w.id];
            if (p && p.mastered) mastered++;
            else if (p && p.remembered) remembered++;
            if (p) totalReviewed += (p.timesCorrect || 0) + (p.timesWrong || 0);
        }
        return {
            total: words.length,
            remembered,
            mastered,
            remaining: words.length - remembered - mastered,
            totalReviewed,
        };
    }

    // ===== 拼写历史 =====
    function getSpellingHistory() {
        let history = load(KEYS.SPELLING);
        if (!history) {
            history = [];
            save(KEYS.SPELLING, history);
        }
        return history;
    }

    function addSpellingRecord(wordId, correct, userInput) {
        const history = getSpellingHistory();
        history.push({
            wordId,
            date: getNow(),
            correct,
            userInput,
        });
        save(KEYS.SPELLING, history);
    }

    function getSpellingStats() {
        const history = getSpellingHistory();
        const today = getToday();
        const todayRecords = history.filter(r => r.date.startsWith(today));
        const correctToday = todayRecords.filter(r => r.correct).length;
        const totalToday = todayRecords.length;

        // 计算连续正确次数
        let streak = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].correct) streak++;
            else break;
        }
        return { correctToday, totalToday, streak };
    }

    // ===== 面试历史 =====
    function getInterviewHistory() {
        let history = load(KEYS.INTERVIEW);
        if (!history) {
            history = [];
            save(KEYS.INTERVIEW, history);
        }
        return history;
    }

    function addInterviewRecord(question, answer, score, feedback, strengths, weaknesses) {
        const history = getInterviewHistory();
        const record = {
            id: `intv_${Date.now()}`,
            date: getNow(),
            question,
            answer,
            score,
            feedback,
            strengths: strengths || [],
            weaknesses: weaknesses || [],
            needsRetry: score < getSettings().scoringThreshold,
        };
        history.push(record);
        save(KEYS.INTERVIEW, history);

        // 不及格的加入复习队列
        if (record.needsRetry) {
            addToInterviewQueue(record);
        }
        return record;
    }

    function getInterviewStats() {
        const history = getInterviewHistory();
        const today = getToday();
        const todayRecords = history.filter(r => r.date.startsWith(today));
        if (history.length === 0) return { total: 0, avgScore: 0, todayCount: 0 };

        const totalScore = history.reduce((sum, r) => sum + r.score, 0);
        return {
            total: history.length,
            avgScore: Math.round(totalScore / history.length),
            todayCount: todayRecords.length,
        };
    }

    // ===== 面试复习队列 =====
    function getInterviewQueue() {
        let queue = load(KEYS.INTERVIEW_QUEUE);
        if (!queue) {
            queue = [];
            save(KEYS.INTERVIEW_QUEUE, queue);
        }
        return queue;
    }

    function addToInterviewQueue(record) {
        const queue = getInterviewQueue();
        // 避免重复
        if (!queue.some(q => q.id === record.id)) {
            queue.push({
                id: record.id,
                question: record.question,
                score: record.score,
                date: record.date,
            });
            save(KEYS.INTERVIEW_QUEUE, queue);
        }
    }

    function removeFromInterviewQueue(recordId) {
        let queue = getInterviewQueue();
        queue = queue.filter(q => q.id !== recordId);
        save(KEYS.INTERVIEW_QUEUE, queue);
    }

    // ===== 设置 =====
    function getSettings() {
        let settings = load(KEYS.SETTINGS);
        if (!settings) {
            settings = { ...DEFAULT_SETTINGS };
            save(KEYS.SETTINGS, settings);
        }
        // 补充缺失的默认值
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
            if (settings[key] === undefined) {
                settings[key] = DEFAULT_SETTINGS[key];
            }
        }
        return settings;
    }

    function saveSettings(settings) {
        return save(KEYS.SETTINGS, settings);
    }

    function updateSetting(key, value) {
        const settings = getSettings();
        settings[key] = value;
        return saveSettings(settings);
    }

    // ===== 数据导入导出 =====
    function exportAllData() {
        const data = {
            version: 1,
            exportedAt: getNow(),
            words: getWords(),
            progress: getProgress(),
            spellingHistory: getSpellingHistory(),
            interviewHistory: getInterviewHistory(),
            interviewQueue: getInterviewQueue(),
            settings: getSettings(),
        };
        return data;
    }

    function importAllData(data) {
        if (!data || !data.version) {
            return { success: false, error: '无效的数据文件格式' };
        }
        try {
            if (data.words) save(KEYS.WORDS, data.words);
            if (data.progress) save(KEYS.PROGRESS, data.progress);
            if (data.spellingHistory) save(KEYS.SPELLING, data.spellingHistory);
            if (data.interviewHistory) save(KEYS.INTERVIEW, data.interviewHistory);
            if (data.interviewQueue) save(KEYS.INTERVIEW_QUEUE, data.interviewQueue);
            if (data.settings) save(KEYS.SETTINGS, data.settings);
            return { success: true };
        } catch (e) {
            return { success: false, error: `导入失败: ${e.message}` };
        }
    }

    function resetAllData() {
        for (const key of Object.values(KEYS)) {
            localStorage.removeItem(key);
        }
        return { success: true };
    }

    // ===== 工具函数 =====
    function getToday() {
        return new Date().toISOString().split('T')[0];
    }

    function getTomorrow() {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    }

    function getNow() {
        return new Date().toISOString();
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    // ===== 设置 API Key（存在 localStorage 中，不是 .env） =====
    function getApiKey() {
        const settings = getSettings();
        return settings.apiKey || '';
    }

    function saveApiKey(key) {
        return updateSetting('apiKey', key.trim());
    }

    // ===== 公开 API =====
    return {
        // 单词
        getWords,
        saveWords,
        initWords,
        addWord,
        batchImportWords,
        // 进度
        getProgress,
        saveProgress,
        getWordProgress,
        markRemembered,
        markRememberedInReview,
        markNotRemembered,
        getDueWords,
        getNewWords,
        getReviewWords,
        getRememberedWords,
        getRememberedCount,
        getMasteredWords,
        getMasteredCount,
        getVocabStats,
        // 拼写
        getSpellingHistory,
        addSpellingRecord,
        getSpellingStats,
        // 面试
        getInterviewHistory,
        addInterviewRecord,
        getInterviewStats,
        getInterviewQueue,
        addToInterviewQueue,
        removeFromInterviewQueue,
        // 设置
        getSettings,
        saveSettings,
        updateSetting,
        getApiKey,
        saveApiKey,
        // 导入导出
        exportAllData,
        importAllData,
        resetAllData,
        // 工具
        getToday,
        getNow,
        shuffle,
        KEYS,
    };
})();
