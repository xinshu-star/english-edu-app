/**
 * vocabulary.js — 模块1：单词记忆练习
 * 模式：idle / category_select / practice / review / mastered
 * 复习模式下累积 2 次"记住了" → 标记为已掌握
 */

const Vocabulary = (() => {
    let session = null;
    let mode = 'idle';      // 'idle' | 'category_select' | 'practice' | 'review' | 'mastered'
    let answered = false;
    let currentCategory = null;  // 当前练习的分类（null = 全部）

    // 录音状态
    let mediaRecorder = null;
    let audioChunks = [];
    let recordedAudioUrl = null;

    let els = {};

    // 分类定义
    const CATEGORIES = [
        { key: 'research_methods', label: '研究方法论', icon: '🔬' },
        { key: 'education_theory', label: '教育理论', icon: '📖' },
        { key: 'academic_writing', label: '学术写作', icon: '✍️' },
        { key: 'statistics', label: '统计学', icon: '📊' },
        { key: 'interview_terms', label: '面试高频词', icon: '🎤' },
        { key: 'other', label: '其他', icon: '📌' },
    ];

    function init(elementMap) {
        els = elementMap;
        bindEvents();
    }

    function bindEvents() {
        els.btnVocabBack?.addEventListener('click', handleBack);
        els.btnVocabStart?.addEventListener('click', () => showCategoryView('practice'));
        els.btnVocabReview?.addEventListener('click', () => showCategoryView('review'));
        els.btnShowMastered?.addEventListener('click', showMasteredView);
        els.btnMasteredBack?.addEventListener('click', showWelcome);
        els.btnCategoryAll?.addEventListener('click', () => {
            if (currentCategory === 'review') startReview(null);
            else startPractice(null);
        });
        els.btnVocabPronounce?.addEventListener('click', pronounceCurrent);
        els.btnCorrect?.addEventListener('click', () => handleMark(true));
        els.btnWrong?.addEventListener('click', () => handleMark(false));
        els.btnUnsure?.addEventListener('click', () => handleMark(false));
        els.btnAddWord?.addEventListener('click', toggleAddPanel);
        els.btnAddWordCancel?.addEventListener('click', () => {
            els.addWordPanel.style.display = 'none';
            els.batchImportArea.style.display = 'none';
        });
        els.btnAddWordSubmit?.addEventListener('click', handleAddWord);
        els.btnBatchImport?.addEventListener('click', toggleBatchImport);
        els.btnBatchImportSubmit?.addEventListener('click', handleBatchImport);
        els.btnExamplePronounce?.addEventListener('click', pronounceExample);
        els.btnExampleRecord?.addEventListener('click', toggleRecording);
        els.btnExamplePlay?.addEventListener('click', playRecording);
    }

    // ===== UI 切换 =====

    function hideAll() {
        if (els.vocabWelcome) els.vocabWelcome.style.display = 'none';
        if (els.categoryView) els.categoryView.style.display = 'none';
        if (els.vocabCard) els.vocabCard.style.display = 'none';
        if (els.vocabActionBar) els.vocabActionBar.style.display = 'none';
        if (els.vocabFeedback) els.vocabFeedback.style.display = 'none';
        if (els.vocabEmpty) els.vocabEmpty.style.display = 'none';
        if (els.masteredView) els.masteredView.style.display = 'none';
        if (els.btnVocabBack) els.btnVocabBack.style.display = 'none';
        if (els.vocabProgressArea) els.vocabProgressArea.style.display = 'none';
        stopRecordingCleanup();
    }

    function showWelcome() {
        hideAll();
        mode = 'idle';
        session = null;
        currentCategory = null;
        updateWelcomePanel();
        if (els.vocabWelcome) els.vocabWelcome.style.display = '';
    }

    function updateWelcomePanel() {
        const stats = Storage.getVocabStats();
        const reviewWords = Storage.getReviewWords();
        const masteredCount = Storage.getMasteredCount();

        if (els.vocabWelcomeStats) {
            els.vocabWelcomeStats.innerHTML = `
                共 <strong>${stats.total}</strong> 个单词 |
                📝 待学 <strong>${stats.remaining}</strong> 个 |
                🔄 已记住 <strong>${stats.remembered}</strong> 个 |
                ⭐ 已掌握 <strong>${masteredCount}</strong> 个
            `;
        }

        const newWords = Storage.getNewWords(stats.total);
        const btnDesc = els.btnVocabStart?.querySelector('.btn-desc');
        if (btnDesc) btnDesc.textContent = newWords.length > 0 ? `${newWords.length} 个新词可学` : '暂无新词';
        if (els.reviewBtnDesc) els.reviewBtnDesc.textContent = reviewWords.length > 0 ? `${reviewWords.length} 个单词待复习` : '暂无待复习单词';
        if (els.btnVocabStart) els.btnVocabStart.disabled = newWords.length === 0;
        if (els.btnVocabReview) els.btnVocabReview.disabled = reviewWords.length === 0;
        if (els.masteredCountBadge) els.masteredCountBadge.textContent = masteredCount;
    }

    // ===== 分类选择 =====

    function showCategoryView(nextMode) {
        hideAll();
        currentCategory = nextMode; // 'practice' or 'review'
        mode = 'category_select';
        session = null;

        if (els.btnVocabBack) {
            els.btnVocabBack.style.display = '';
            els.btnVocabBack.textContent = '← 返回';
        }

        const words = Storage.getWords();
        if (els.categoryGrid) {
            els.categoryGrid.innerHTML = '';
            CATEGORIES.forEach(cat => {
                const count = words.filter(w => w.category === cat.key).length;
                const card = document.createElement('div');
                card.className = 'category-card';
                card.innerHTML = `
                    <span class="cat-name">${cat.icon} ${cat.label}</span>
                    <span class="cat-count">${count} 词</span>
                `;
                card.addEventListener('click', () => {
                    if (nextMode === 'review') startReview(cat.key);
                    else startPractice(cat.key);
                });
                els.categoryGrid.appendChild(card);
            });
        }

        if (els.btnCategoryAll) {
            const totalCount = nextMode === 'review'
                ? Storage.getReviewWords().length
                : Storage.getNewWords(999).length;
            els.btnCategoryAll.textContent = `或 全部单词（不限分类，${totalCount} 词）`;
        }

        if (els.categoryView) els.categoryView.style.display = '';
    }

    // ===== 普通练习 =====

    function startPractice(category) {
        const settings = Storage.getSettings();
        let pool = Storage.getNewWords(999); // 取所有新词

        // 按分类筛选
        if (category) {
            pool = pool.filter(w => w.word.category === category);
        }

        pool = pool.slice(0, settings.dailyWordCount);

        if (pool.length === 0) {
            alert(category
                ? `"${CATEGORIES.find(c => c.key === category)?.label}" 分类下没有新词了`
                : '没有新单词了！请去"今日复习"巩固已记住的单词。');
            return;
        }

        mode = 'practice';
        session = { words: pool, currentIndex: 0, remembered: 0, notRemembered: 0 };

        hideAll();
        showPracticeUI();
        renderCurrentWord();
    }

    // ===== 今日复习 =====

    function startReview(category) {
        let pool = Storage.getReviewWords();

        if (category) {
            pool = pool.filter(w => w.word.category === category);
        }

        if (pool.length === 0) {
            alert(category
                ? `"${CATEGORIES.find(c => c.key === category)?.label}" 分类下没有待复习的单词`
                : '还没有记住的单词需要复习。先去"开始练习"学习一些单词吧！');
            return;
        }

        mode = 'review';
        session = { words: pool, currentIndex: 0, remembered: 0, notRemembered: 0 };

        hideAll();
        showPracticeUI();
        renderCurrentWord();
    }

    function showPracticeUI() {
        if (els.btnVocabBack) els.btnVocabBack.style.display = '';
        if (els.vocabProgressArea) els.vocabProgressArea.style.display = '';
        if (els.vocabCard) els.vocabCard.style.display = '';
        if (els.btnVocabPronounce) els.btnVocabPronounce.style.display = '';
        if (els.vocabStats) els.vocabStats.style.display = '';
        updateProgress();
    }

    function handleBack() {
        if (mode === 'category_select') {
            showWelcome();
        } else if (mode === 'practice' || mode === 'review') {
            // 返回分类选择
            showCategoryView(mode);
        }
    }

    // ===== 渲染单词 =====

    function renderCurrentWord() {
        if (!session || session.currentIndex >= session.words.length) {
            endSession();
            return;
        }

        answered = false;
        const { word, isReview } = session.words[session.currentIndex];

        stopRecordingCleanup();
        updateProgress();

        els.vocabWord.textContent = word.word;
        els.vocabPhonetic.textContent = word.pronunciation || '';
        renderExample(word);

        const options = generateOptions(word);
        els.vocabOptions.innerHTML = '';
        options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span class="option-label">${String.fromCharCode(65 + i)}.</span> ${opt.chinese}`;
            btn.addEventListener('click', () => selectOption(i, opt.wordId, btn));
            els.vocabOptions.appendChild(btn);
        });

        els.vocabFeedback.style.display = 'none';
        els.vocabActionBar.style.display = 'none';

        if (mode === 'review') {
            const p = Storage.getWordProgress(word.id);
            const count = p.reviewRememberedCount || 0;
            els.vocabFeedback.style.display = '';
            els.vocabFeedback.className = 'feedback-area';
            els.vocabFeedback.innerHTML = `🔄 今日复习 (已连续记住 ${count}/2 次)`;
        } else if (isReview) {
            els.vocabFeedback.style.display = '';
            els.vocabFeedback.className = 'feedback-area';
            els.vocabFeedback.innerHTML = '🔄 复习单词';
        }

        updateSessionStatsRow();
        els.vocabCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function renderExample(word) {
        if (!word.example) {
            els.vocabExampleSection.style.display = 'none';
            return;
        }
        els.vocabExampleSection.style.display = '';
        els.vocabExampleText.textContent = `"${word.example}"`;
        els.btnExampleRecord.textContent = '🎤 跟读录音';
        els.btnExampleRecord.className = 'btn-sm btn-record';
        els.btnExampleRecord.disabled = false;
        els.btnExamplePlay.style.display = 'none';
        els.exampleRecordingStatus.style.display = 'none';
        els.exampleRecordingStatus.className = 'recording-status';
        els.exampleAudioPlayer.style.display = 'none';
        if (recordedAudioUrl) { URL.revokeObjectURL(recordedAudioUrl); recordedAudioUrl = null; }
    }

    function generateOptions(correctWord) {
        const allWords = Storage.getWords();
        const others = allWords.filter(w => w.id !== correctWord.id);
        Storage.shuffle(others);
        const distractors = others.slice(0, 3);
        const options = [
            { wordId: correctWord.id, chinese: correctWord.chinese, isCorrect: true },
            ...distractors.map(d => ({ wordId: d.id, chinese: d.chinese, isCorrect: false })),
        ];
        Storage.shuffle(options);
        return options;
    }

    function selectOption(index, wordId, btnElement) {
        if (answered) return;
        answered = true;

        const currentWord = session.words[session.currentIndex].word;
        const isCorrect = (wordId === currentWord.id);

        const allButtons = els.vocabOptions.querySelectorAll('.option-btn');
        allButtons.forEach(b => b.disabled = true);

        const correctChinese = currentWord.chinese;
        allButtons.forEach(btn => {
            if ((btn.textContent || '').includes(correctChinese)) btn.classList.add('correct-choice');
        });

        if (!isCorrect) btnElement.classList.add('wrong-choice');

        els.vocabFeedback.style.display = '';
        if (isCorrect) {
            els.vocabFeedback.className = 'feedback-area correct';
            els.vocabFeedback.innerHTML = '✅ 选择正确！';
        } else {
            els.vocabFeedback.className = 'feedback-area wrong';
            els.vocabFeedback.innerHTML = `❌ 选择错误！正确答案是：<strong>${currentWord.chinese}</strong>`;
        }

        els.vocabActionBar.style.display = 'flex';
    }

    function handleMark(remembered) {
        if (!session) return;
        const { word } = session.words[session.currentIndex];
        if (remembered) {
            if (mode === 'review') Storage.markRememberedInReview(word.id);
            else Storage.markRemembered(word.id);
            session.remembered++;
        } else {
            Storage.markNotRemembered(word.id);
            session.notRemembered++;
        }
        session.currentIndex++;
        answered = false;
        els.vocabActionBar.style.display = 'none';
        setTimeout(() => renderCurrentWord(), 200);
    }

    function endSession() {
        const stats = Storage.getVocabStats();
        els.vocabCard.style.display = 'none';
        els.vocabActionBar.style.display = 'none';
        els.vocabFeedback.style.display = 'none';
        if (els.btnVocabBack) els.btnVocabBack.style.display = 'none';
        if (els.vocabProgressArea) els.vocabProgressArea.style.display = 'none';
        stopRecordingCleanup();

        const masteredCount = Storage.getMasteredCount();
        let title, desc;
        if (mode === 'review') {
            title = '✅ 复习完成！';
            desc = `本次: 记住了 ${session.remembered} 个 | 没记住 ${session.notRemembered} 个`;
            if (masteredCount > 0) desc += `\n🏆 累计已掌握: ${masteredCount} 个单词`;
        } else {
            title = '✅ 本轮练习完成！';
            desc = `本次: 记住了 ${session.remembered} 个 | 没记住 ${session.notRemembered} 个 | 累计已掌握: ${masteredCount}/${stats.total}`;
        }
        showWelcome();
        alert(title + '\n\n' + desc);
        session = null;
    }

    // ===== 已掌握单词视图 =====

    function showMasteredView() {
        hideAll();
        mode = 'mastered';
        session = null;
        if (els.btnVocabBack) { els.btnVocabBack.style.display = ''; els.btnVocabBack.textContent = '← 返回'; }
        if (els.masteredView) els.masteredView.style.display = '';

        const mastered = Storage.getMasteredWords();
        if (els.masteredTotalLabel) els.masteredTotalLabel.textContent = `共 ${mastered.length} 个`;

        if (mastered.length === 0) {
            if (els.masteredList) els.masteredList.innerHTML = '';
            if (els.masteredEmpty) els.masteredEmpty.style.display = '';
            return;
        }

        if (els.masteredEmpty) els.masteredEmpty.style.display = 'none';
        if (els.masteredList) {
            els.masteredList.innerHTML = '';
            mastered.forEach(word => {
                const card = document.createElement('div');
                card.className = 'flip-card';
                card.addEventListener('click', () => card.classList.toggle('flipped'));
                card.innerHTML = `
                    <div class="flip-card-inner">
                        <div class="flip-card-front">
                            <span class="card-word">${escapeHtml(word.word)}</span>
                            <span class="card-phonetic">${escapeHtml(word.pronunciation || '')}</span>
                            <span class="card-hint">👆 点击翻转</span>
                        </div>
                        <div class="flip-card-back">
                            <span class="card-meaning">${escapeHtml(word.chinese)}</span>
                            <span class="card-example">"${escapeHtml(word.example || '')}"</span>
                        </div>
                    </div>
                `;
                els.masteredList.appendChild(card);
            });
        }
    }

    // ===== 例句 + 录音 =====

    function pronounceExample() {
        if (!session || !session.words[session.currentIndex]) return;
        const word = session.words[session.currentIndex].word;
        if (!word.example) return;
        els.btnExamplePronounce.innerHTML = '🔊 播放中...';
        els.btnExamplePronounce.disabled = true;
        TTS.speak(word.example).then(() => {
            els.btnExamplePronounce.innerHTML = '🔊 播放例句';
            els.btnExamplePronounce.disabled = false;
        }).catch(() => {
            els.btnExamplePronounce.innerHTML = '🔊 播放例句';
            els.btnExamplePronounce.disabled = false;
        });
    }

    function pronounceCurrent() {
        if (!session || !session.words[session.currentIndex]) return;
        TTS.speak(session.words[session.currentIndex].word.word).catch(() => {});
    }

    function toggleRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording();
        else startRecording();
    }

    async function startRecording() {
        if (!navigator.mediaDevices?.getUserMedia) {
            if (els.exampleRecordingStatus) {
                els.exampleRecordingStatus.style.display = '';
                els.exampleRecordingStatus.className = 'recording-status recording';
                els.exampleRecordingStatus.textContent = '⚠️ 浏览器不支持录音';
            }
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                if (audioChunks.length > 0) {
                    const blob = new Blob(audioChunks, { type: 'audio/webm' });
                    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
                    recordedAudioUrl = URL.createObjectURL(blob);
                    if (els.exampleRecordingStatus) {
                        els.exampleRecordingStatus.style.display = '';
                        els.exampleRecordingStatus.className = 'recording-status done';
                        els.exampleRecordingStatus.textContent = '✅ 录音完成！';
                    }
                    if (els.btnExampleRecord) { els.btnExampleRecord.textContent = '🔄 重新录音'; els.btnExampleRecord.className = 'btn-sm btn-record'; }
                    if (els.btnExamplePlay) els.btnExamplePlay.style.display = '';
                    if (els.exampleAudioPlayer) { els.exampleAudioPlayer.src = recordedAudioUrl; els.exampleAudioPlayer.style.display = ''; }
                }
            };
            mediaRecorder.start();
            if (els.btnExampleRecord) { els.btnExampleRecord.textContent = '⏹ 停止录音'; els.btnExampleRecord.className = 'btn-sm btn-record recording'; }
            if (els.exampleRecordingStatus) {
                els.exampleRecordingStatus.style.display = '';
                els.exampleRecordingStatus.className = 'recording-status recording';
                els.exampleRecordingStatus.textContent = '🔴 录音中...';
            }
            if (els.btnExamplePlay) els.btnExamplePlay.style.display = 'none';
            if (els.exampleAudioPlayer) els.exampleAudioPlayer.style.display = 'none';
        } catch (err) {
            if (els.exampleRecordingStatus) {
                els.exampleRecordingStatus.style.display = '';
                els.exampleRecordingStatus.className = 'recording-status recording';
                els.exampleRecordingStatus.textContent = '⚠️ 无法访问麦克风';
            }
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    }

    function stopRecordingCleanup() {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
        mediaRecorder = null;
        audioChunks = [];
        if (recordedAudioUrl) { URL.revokeObjectURL(recordedAudioUrl); recordedAudioUrl = null; }
    }

    function playRecording() {
        if (els.exampleAudioPlayer?.src) els.exampleAudioPlayer.play().catch(() => {});
    }

    // ===== UI 工具 =====

    function updateProgress() {
        if (!session) return;
        const total = session.words.length;
        const done = session.currentIndex;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        if (els.vocabProgressFill) els.vocabProgressFill.style.width = `${pct}%`;
        if (els.vocabProgressText) els.vocabProgressText.textContent = `${done} / ${total}`;
    }

    function updateSessionStatsRow() {
        const stats = Storage.getVocabStats();
        if (session && els.vocabStats) {
            const modeLabel = mode === 'review' ? '📋 今日复习' : '📝 普通练习';
            els.vocabStats.innerHTML = `
                <span class="stat-chip neutral">${modeLabel}</span>
                <span class="stat-chip success">✅ 记住: ${session.remembered}</span>
                <span class="stat-chip danger">❌ 没记住: ${session.notRemembered}</span>
                <span class="stat-chip neutral">⭐ 已掌握: ${stats.mastered}/${stats.total}</span>
            `;
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== 添加单词 =====

    function toggleAddPanel() {
        if (els.addWordPanel) els.addWordPanel.style.display = els.addWordPanel.style.display === 'none' ? '' : 'none';
        if (els.batchImportArea) els.batchImportArea.style.display = 'none';
    }

    function toggleBatchImport() {
        if (els.batchImportArea) els.batchImportArea.style.display = els.batchImportArea.style.display === 'none' ? '' : 'none';
    }

    function handleAddWord() {
        const english = els.addWordEnglish?.value?.trim();
        const chinese = els.addWordChinese?.value?.trim();
        const category = els.addWordCategory?.value || 'other';
        const phonetic = els.addWordPhonetic?.value?.trim() || '';
        const example = els.addWordExample?.value?.trim() || '';
        if (!english || !chinese) { alert('请填写英文单词和中文意思'); return; }
        const result = Storage.addWord(english, chinese, category, phonetic, example);
        if (result.success) {
            ['addWordEnglish','addWordChinese','addWordPhonetic','addWordExample'].forEach(k => { if (els[k]) els[k].value = ''; });
            if (els.addWordPanel) els.addWordPanel.style.display = 'none';
            alert(`单词 "${english}" 添加成功！`);
            updateWelcomePanel();
        } else { alert(result.error); }
    }

    function handleBatchImport() {
        const text = els.batchImportText?.value?.trim();
        if (!text) { alert('请粘贴要导入的单词'); return; }
        const results = Storage.batchImportWords(text);
        if (els.batchImportText) els.batchImportText.value = '';
        if (els.batchImportArea) els.batchImportArea.style.display = 'none';
        if (els.addWordPanel) els.addWordPanel.style.display = 'none';
        let msg = `导入完成！\n成功添加: ${results.added.length} 个`;
        if (results.skipped.length > 0) msg += `\n跳过（已存在）: ${results.skipped.length} 个`;
        alert(msg);
        updateWelcomePanel();
    }

    async function onShow() {
        await Storage.initWords();
        if (mode === 'idle' || !session) {
            showWelcome();
        }
    }

    return { init, onShow, showWelcome };
})();
