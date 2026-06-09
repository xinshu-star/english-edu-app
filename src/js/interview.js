/**
 * interview.js — 模块3：模拟面试问答
 * AI 生成问题 + 语音播放 + 语音回答 + AI 评分
 */

const Interview = (() => {
    let currentQuestion = null;
    let userAnswer = '';
    let isRecording = false;
    let isSubmitting = false;
    let useFallback = false;
    let fallbackIndex = 0;
    // 内置备用题库（始终可用）
    const builtinQuestions = [
        { question: "Can you tell us about your research interests and why you chose this area?" },
        { question: "What research methodology are you most familiar with, and why do you prefer it?" },
        { question: "How do you think your research could contribute to the field of education?" },
        { question: "What challenges do you anticipate in your doctoral research?" },
        { question: "Can you describe a research article that has significantly influenced your thinking?" },
        { question: "How would you describe the relationship between educational theory and classroom practice?" },
        { question: "What role should quantitative methods play in educational research?" },
        { question: "Why do you believe a doctoral degree is important for your career goals?" },
        { question: "How do you plan to ensure the validity and reliability of your research?" },
        { question: "What do you think are the biggest challenges facing education today?" },
    ];
    let fallbackQuestions = [...builtinQuestions];
    let els = {};

    function init(elementMap) {
        els = elementMap;
        bindEvents();
        // 异步加载更多备用题（不阻塞）
        fetch('/data/interview_questions_fallback.json')
            .then(r => r.ok && r.json())
            .then(data => { if (data?.length) fallbackQuestions = data; })
            .catch(() => {});
    }

    function bindEvents() {
        els.btnInterviewStart?.addEventListener('click', startSession);
        els.btnPlayQuestion?.addEventListener('click', playQuestion);
        els.btnShowQuestion?.addEventListener('click', toggleQuestionText);
        els.btnRecord?.addEventListener('click', toggleRecording);
        els.btnStopRecord?.addEventListener('click', stopRecording);
        els.btnReRecord?.addEventListener('click', reRecord);
        els.btnSubmitAnswer?.addEventListener('click', submitAnswer);
        els.btnNextQuestion?.addEventListener('click', nextQuestion);
        els.btnRetryQueue?.addEventListener('click', reviewFromQueue);
    }

    // ===== 面试会话 =====

    async function startSession() {
        // 显示加载状态
        els.interviewEmpty.style.display = 'none';
        els.scoreResult.style.display = 'none';
        els.btnNextQuestion.style.display = 'none';
        els.btnPlayQuestion.innerHTML = '<span class="spinner"></span> 正在连接AI...';
        els.btnPlayQuestion.disabled = true;

        try {
            const hasApi = await API.testConnection();
            useFallback = !hasApi;
        } catch (e) {
            useFallback = true;
        }

        fallbackIndex = 0;
        resetUI();
        updateStatsRow();

        if (useFallback) {
            els.interviewEmptyDesc.textContent = '💡 使用离线模式。如需 AI 智能出题，请在设置中配置 DeepSeek API Key。';
            showOfflineQuestion();
        } else {
            await generateNewQuestion();
        }
    }

    async function generateNewQuestion() {
        els.btnPlayQuestion.disabled = true;
        els.btnPlayQuestion.innerHTML = '<span class="spinner"></span> AI 正在出题...';

        try {
            const learnedWords = Storage.getRememberedWords();
            const result = await API.generateQuestion(learnedWords);
            currentQuestion = result.question;
            renderQuestion();
        } catch (e) {
            console.error('生成问题失败:', e);
            useFallback = true;
            els.interviewEmptyDesc.textContent = '⚠️ AI 出题失败（' + (e.message || '网络错误') + '），使用备用题库。';
            showOfflineQuestion();
        }
    }

    function showOfflineQuestion() {
        currentQuestion = fallbackQuestions[fallbackIndex % fallbackQuestions.length].question;
        fallbackIndex++;
        renderQuestion();
    }

    function renderQuestion() {
        resetUI();
        els.btnPlayQuestion.disabled = false;
        els.btnPlayQuestion.innerHTML = '🔊 播放问题';
        els.questionText.textContent = currentQuestion;
        els.questionText.style.display = 'none';
        setTimeout(() => playQuestion(), 500);
    }

    function resetUI() {
        els.questionText.style.display = 'none';
        els.transcriptBox.textContent = '';
        els.textAnswer.value = '';
        els.scoreResult.style.display = 'none';
        els.btnNextQuestion.style.display = 'none';
        els.btnSubmitAnswer.style.display = '';
        els.recordingIndicator.style.display = 'none';
        els.recordingActions.style.display = 'none';
        els.btnRecord.style.display = '';
        els.btnRecord.className = 'btn-record';
        els.btnRecord.textContent = '🎤 点击开始录音';
        els.btnPlayQuestion.disabled = false;
        els.btnPlayQuestion.innerHTML = '🔊 播放问题';
        userAnswer = '';
        isRecording = false;
        STT.reset();
    }

    // ===== 问题交互 =====

    function playQuestion() {
        if (!currentQuestion) return;
        els.btnPlayQuestion.innerHTML = '🔊 播放中...';
        TTS.speak(currentQuestion).then(() => {
            els.btnPlayQuestion.innerHTML = '🔊 重新播放';
        }).catch(() => {
            els.btnPlayQuestion.innerHTML = '🔊 播放问题';
        });
    }

    function toggleQuestionText() {
        const isHidden = els.questionText.style.display === 'none';
        els.questionText.style.display = isHidden ? '' : 'none';
        els.btnShowQuestion.textContent = isHidden ? '🙈 隐藏文字' : '📋 显示文字';
    }

    // ===== 语音录制 =====

    function toggleRecording() {
        if (isRecording) { stopRecording(); return; }
        if (!STT.isSupported()) {
            els.transcriptBox.textContent = '⚠️ 浏览器不支持语音识别。请在下方文本框输入回答。（推荐 Chrome/Edge）';
            els.textAnswer.style.display = '';
            els.textAnswer.focus();
            return;
        }
        const started = STT.start(
            (transcript, isFinal) => {
                els.transcriptBox.textContent = transcript;
                userAnswer = transcript;
                els.transcriptBox.style.color = isFinal ? 'var(--text-primary)' : 'var(--text-muted)';
            },
            () => {
                isRecording = false;
                els.btnRecord.style.display = 'none';
                els.recordingIndicator.style.display = 'none';
                els.recordingActions.style.display = 'none';
                if (userAnswer) els.btnSubmitAnswer.disabled = false;
            },
            (err) => {
                isRecording = false;
                els.recordingIndicator.style.display = 'none';
                els.recordingActions.style.display = 'none';
                els.transcriptBox.textContent = '⚠️ 语音识别出错，请使用文字输入。';
                els.textAnswer.style.display = '';
            }
        );
        if (started) {
            isRecording = true;
            els.btnRecord.className = 'btn-record recording';
            els.btnRecord.textContent = '🎤 录音中...点击停止';
            els.recordingIndicator.style.display = 'inline-block';
            els.recordingActions.style.display = 'flex';
            els.transcriptBox.textContent = '聆听中...';
            els.transcriptBox.style.color = 'var(--text-muted)';
            els.textAnswer.style.display = 'none';
        } else {
            els.transcriptBox.textContent = '⚠️ 无法启动语音识别。请使用下方文本框输入回答。';
            els.textAnswer.style.display = '';
        }
    }

    function stopRecording() {
        if (!isRecording) return;
        STT.stop();
        isRecording = false;
        els.recordingIndicator.style.display = 'none';
        els.recordingActions.style.display = 'none';
        els.btnRecord.style.display = 'none';
        if (!userAnswer) els.transcriptBox.textContent = '(未识别到语音，请重新录音或使用文字输入)';
    }

    function reRecord() {
        STT.reset();
        userAnswer = '';
        els.transcriptBox.textContent = '';
        els.btnRecord.style.display = '';
        els.btnRecord.className = 'btn-record';
        els.btnRecord.textContent = '🎤 点击开始录音';
        els.recordingIndicator.style.display = 'none';
        els.recordingActions.style.display = 'none';
        isRecording = false;
    }

    // ===== 提交评分 =====

    async function submitAnswer() {
        const textAnswer = els.textAnswer.value.trim();
        if (textAnswer) userAnswer = textAnswer;
        if (!userAnswer) {
            els.transcriptBox.textContent = '⚠️ 请先录音或输入文字回答，再提交评分。';
            return;
        }
        if (isSubmitting) return;
        isSubmitting = true;
        els.btnSubmitAnswer.disabled = true;
        els.btnSubmitAnswer.innerHTML = '<span class="spinner"></span> AI 评分中...';

        try {
            if (useFallback) {
                showFallbackResult();
            } else {
                const result = await API.scoreAnswer(currentQuestion, userAnswer);
                showScoreResult(result);
            }
        } catch (e) {
            console.error('评分失败:', e);
            showFallbackResult();
        }
        isSubmitting = false;
        els.btnSubmitAnswer.style.display = 'none';
        els.btnNextQuestion.style.display = '';
    }

    function showScoreResult(result) {
        const { score, feedback, strengths, weaknesses } = result;
        let scoreColor = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--primary)' : 'var(--danger)';
        let scoreLabel = score >= 80 ? '优秀' : score >= 60 ? '良好' : '需要改进';
        let html = `
            <div class="score-number" style="color:${scoreColor}">${score}</div>
            <div class="score-label">评级: ${scoreLabel}</div>
            <div class="feedback-text">${escapeHtml(feedback)}</div>`;
        if (strengths?.length) html += `<div class="strength-item">💪 亮点: ${escapeHtml(strengths[0])}</div>`;
        if (weaknesses?.length) html += `<div class="weakness-item">📝 改进: ${escapeHtml(weaknesses[0])}</div>`;
        const threshold = Storage.getSettings().scoringThreshold;
        if (score < threshold) html += `<div class="retry-notice">⚠️ 此题得分低于 ${threshold} 分，已加入复习队列。</div>`;
        els.scoreResult.innerHTML = html;
        els.scoreResult.style.display = '';
        Storage.addInterviewRecord(currentQuestion, userAnswer, score, feedback, strengths, weaknesses);
        updateStatsRow();
        updateRetryBadge();
    }

    function showFallbackResult() {
        els.scoreResult.innerHTML = `
            <div style="text-align:center;padding:20px;">
                <h4>📋 自评模式</h4>
                <p style="color:var(--text-secondary);margin-top:8px;">AI 评分暂不可用，请参考以下标准自行评估：</p>
                <div style="text-align:left;margin-top:12px;font-size:14px;line-height:1.8;">
                    1. 回答是否切题？<br>2. 是否使用了学术术语？<br>3. 结构是否清晰？<br>4. 是否有深度思考？
                </div>
            </div>`;
        els.scoreResult.style.display = '';
        Storage.addInterviewRecord(currentQuestion, userAnswer, 0, '自评模式', [], []);
        updateStatsRow();
    }

    function nextQuestion() {
        resetUI();
        updateStatsRow();
        updateRetryBadge();
        if (useFallback) { showOfflineQuestion(); }
        else { generateNewQuestion(); }
    }

    function reviewFromQueue() {
        const queue = Storage.getInterviewQueue();
        if (queue.length === 0) { els.transcriptBox.textContent = '复习队列为空。'; return; }
        const next = queue[0];
        Storage.removeFromInterviewQueue(next.id);
        currentQuestion = next.question;
        renderQuestion();
        updateRetryBadge();
    }

    function updateStatsRow() {
        const stats = Storage.getInterviewStats();
        els.interviewStats.innerHTML = `
            <span class="stat-chip neutral">📊 总练习: ${stats.total} 题</span>
            <span class="stat-chip ${stats.avgScore >= 60 ? 'success' : 'danger'}">📈 平均分: ${stats.avgScore}</span>
            <span class="stat-chip neutral">📅 今日: ${stats.todayCount} 题</span>`;
    }

    function updateRetryBadge() {
        const queue = Storage.getInterviewQueue();
        const span = document.getElementById('retryCount');
        if (span) span.textContent = queue.length;
        els.btnRetryQueue.style.display = queue.length > 0 ? '' : 'none';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function onShow() {
        updateStatsRow();
        updateRetryBadge();
        const remembered = Storage.getRememberedCount();
        els.interviewEmptyDesc.textContent = remembered === 0
            ? '先去"单词记忆练习"学习一些单词吧，AI 会根据你学过的词出面试题。'
            : `已学单词: ${remembered} 个 | AI 将根据你学过的单词生成教育学面试问题`;
    }

    return { init, onShow };
})();
