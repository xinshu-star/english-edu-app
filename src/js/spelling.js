/**
 * spelling.js — 模块2：单词拼写练习
 * 从"记住了"的单词池中随机出题，听发音拼写
 */

const Spelling = (() => {
    let currentWord = null;
    let els = {};

    function init(elementMap) {
        els = elementMap;
        bindEvents();
    }

    function bindEvents() {
        els.btnSpellingPronounce?.addEventListener('click', pronounceCurrent);
        els.btnSpellingSubmit?.addEventListener('click', checkSpelling);
        els.btnSpellingNext?.addEventListener('click', nextWord);
        els.spellingInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') checkSpelling();
        });
    }

    // ===== 出题 =====

    function nextWord() {
        const remembered = Storage.getRememberedWords();
        if (remembered.length === 0) {
            showEmpty();
            return;
        }

        // 随机选择一个记住的单词
        const idx = Math.floor(Math.random() * remembered.length);
        currentWord = remembered[idx];

        // 重置 UI
        els.spellingEmpty.style.display = 'none';
        els.spellingInput.value = '';
        els.spellingInput.disabled = false;
        els.spellingInput.focus();
        els.spellingResult.style.display = 'none';
        els.btnSpellingSubmit.style.display = '';
        els.btnSpellingNext.style.display = 'none';
        els.btnSpellingPronounce.style.display = '';

        updateStatsRow();
    }

    function showEmpty() {
        els.spellingEmpty.style.display = '';
        els.spellingInput.style.display = 'none';
        els.btnSpellingSubmit.style.display = 'none';
        els.btnSpellingPronounce.style.display = 'none';
        els.spellingResult.style.display = 'none';
        els.btnSpellingNext.style.display = 'none';
    }

    // ===== 发音 =====

    function pronounceCurrent() {
        if (!currentWord) return;
        TTS.speak(currentWord.word).catch(() => {});
    }

    // ===== 拼写检查 =====

    function checkSpelling() {
        if (!currentWord) return;

        const userInput = els.spellingInput.value.trim();
        if (!userInput) {
            els.spellingInput.focus();
            return;
        }

        const isCorrect = userInput.toLowerCase() === currentWord.word.toLowerCase();

        // 记录历史
        Storage.addSpellingRecord(currentWord.id, isCorrect, userInput);

        // 显示结果
        els.spellingResult.style.display = '';
        els.spellingInput.disabled = true;
        els.btnSpellingSubmit.style.display = 'none';

        if (isCorrect) {
            els.spellingResult.className = 'spelling-result correct';
            els.spellingResult.innerHTML = `
                <div>✅ 拼写正确！</div>
                <div class="correct-word">${currentWord.word}</div>
                <div class="word-meaning">${currentWord.chinese}</div>
            `;
        } else {
            els.spellingResult.className = 'spelling-result wrong';
            els.spellingResult.innerHTML = `
                <div>❌ 拼写有误</div>
                <div style="margin-top:6px;font-size:14px;">
                    你写的是: <span style="text-decoration:line-through;color:var(--danger);">${escapeHtml(userInput)}</span>
                </div>
                <div class="correct-word">正确拼写: ${currentWord.word}</div>
                <div class="word-meaning">中文意思: ${currentWord.chinese}</div>
            `;
        }

        els.btnSpellingNext.style.display = '';
        els.btnSpellingNext.textContent = '下一题 →';
        els.btnSpellingNext.focus();

        updateStatsRow();
    }

    function updateStatsRow() {
        const stats = Storage.getSpellingStats();
        const accuracy = stats.totalToday > 0
            ? Math.round((stats.correctToday / stats.totalToday) * 100)
            : 0;

        els.spellingStats.innerHTML = `
            <span class="stat-chip success">✅ 今日正确: ${stats.correctToday}/${stats.totalToday} (${accuracy}%)</span>
            <span class="stat-chip neutral">🔥 连续正确: ${stats.streak} 次</span>
            <span class="stat-chip neutral">📚 可拼写单词: ${Storage.getRememberedCount()} 个</span>
        `;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * 模块可见时调用
     */
    function onShow() {
        const remembered = Storage.getRememberedWords();
        if (remembered.length === 0) {
            showEmpty();
            updateStatsRow();
            return;
        }

        // 显示输入框
        els.spellingInput.style.display = '';
        updateStatsRow();
        nextWord();
    }

    return { init, onShow };
})();
