/**
 * interview.js — 模块3：模拟面试问答
 * 即时出题（内置题库） + 后台 AI 增强
 */

const Interview = (() => {
    let currentQuestion = null;
    let userAnswer = '';
    let isRecording = false;
    let isSubmitting = false;
    let aiAvailable = null;  // null=未检测, true=可用, false=不可用
    let questionIndex = 0;
    let els = {};

    // 内置 15 道面试题
    const questions = [
        "Can you tell us about your research interests and why you chose this particular area of study?",
        "What research methodology are you most familiar with, and how would you apply it to your doctoral research?",
        "How would you describe the relationship between educational theory and classroom practice?",
        "What do you think are the biggest challenges facing education research today?",
        "Can you discuss a piece of research that has significantly influenced your academic thinking?",
        "How do you plan to contribute to the existing body of knowledge in your field?",
        "What role do you think mixed methods should play in educational research?",
        "How would you ensure the validity and reliability of your research findings?",
        "Can you describe your experience with academic writing and publication?",
        "Why do you believe a doctoral degree is important for your career goals?",
        "How do you understand the concept of equity in education, and how does it relate to your research?",
        "What is your understanding of triangulation and why is it important in qualitative research?",
        "How would you explain the difference between methodology and methods to someone outside academia?",
        "What ethical considerations do you think are most important in educational research?",
        "How do you see your research making a practical contribution to schools or teachers?",
    ];

    function init(elementMap) {
        els = elementMap;
        bindEvents();
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

    // ===== 核心流程：即时出题 + 后台检测 AI =====

    function startSession() {
        // 1. 立即显示题目（不等待任何请求）
        els.interviewEmpty.style.display = 'none';
        els.scoreResult.style.display = 'none';
        els.btnNextQuestion.style.display = 'none';
        questionIndex = 0;
        resetUI();
        updateStatsRow();
        showBuiltinQuestion();

        // 2. 后台悄悄检测 AI 是否可用
        checkAI();
    }

    function showBuiltinQuestion() {
        currentQuestion = questions[questionIndex % questions.length];
        questionIndex++;
        renderQuestion();
    }

    async function checkAI() {
        // 已经检测过就不重复
        if (aiAvailable !== null) return;

        try {
            const ok = await API.testConnection();
            aiAvailable = ok;
        } catch (e) {
            aiAvailable = false;
        }
    }

    function renderQuestion() {
        resetUI();
        els.btnPlayQuestion.disabled = false;
        els.btnPlayQuestion.innerHTML = '🔊 播放问题';
        els.questionText.textContent = currentQuestion;
        els.questionText.style.display = 'none';
        // 自动播放
        setTimeout(() => playQuestion(), 400);
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

    // ===== 问题操作 =====

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
        const hidden = els.questionText.style.display === 'none';
        els.questionText.style.display = hidden ? '' : 'none';
        els.btnShowQuestion.textContent = hidden ? '🙈 隐藏文字' : '📋 显示文字';
    }

    // ===== 语音录制 =====

    function toggleRecording() {
        if (isRecording) { stopRecording(); return; }
        if (!STT.isSupported()) {
            els.transcriptBox.textContent = '⚠️ 浏览器不支持语音识别。请在下方文本框输入回答。';
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
            () => {
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
        const text = els.textAnswer.value.trim();
        if (text) userAnswer = text;
        if (!userAnswer) {
            els.transcriptBox.textContent = '⚠️ 请先录音或输入文字回答。';
            return;
        }
        if (isSubmitting) return;
        isSubmitting = true;
        els.btnSubmitAnswer.disabled = true;
        els.btnSubmitAnswer.innerHTML = '<span class="spinner"></span> AI 评分中...';

        // 确保 AI 检测已完成
        if (aiAvailable === null) await checkAI();

        try {
            if (aiAvailable) {
                const result = await API.scoreAnswer(currentQuestion, userAnswer);
                showScoreResult(result);
            } else {
                showFallbackResult();
            }
        } catch (e) {
            showFallbackResult();
        }

        isSubmitting = false;
        els.btnSubmitAnswer.style.display = 'none';
        els.btnNextQuestion.style.display = '';
    }

    function showScoreResult(result) {
        const { score, feedback, strengths, weaknesses } = result;
        let color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--primary)' : 'var(--danger)';
        let label = score >= 80 ? '优秀' : score >= 60 ? '良好' : '需要改进';
        let html = `<div class="score-number" style="color:${color}">${score}</div>
            <div class="score-label">评级: ${label}</div>
            <div class="feedback-text">${escapeHtml(feedback)}</div>`;
        if (strengths?.length) html += `<div class="strength-item">💪 亮点: ${escapeHtml(strengths[0])}</div>`;
        if (weaknesses?.length) html += `<div class="weakness-item">📝 改进: ${escapeHtml(weaknesses[0])}</div>`;
        const t = Storage.getSettings().scoringThreshold;
        if (score < t) html += `<div class="retry-notice">⚠️ 低于 ${t} 分，已加入复习队列。</div>`;
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
                <p style="color:var(--text-secondary);margin-top:8px;">参考以下标准自我评估：</p>
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
        showBuiltinQuestion();
    }

    function reviewFromQueue() {
        const queue = Storage.getInterviewQueue();
        if (queue.length === 0) { els.transcriptBox.textContent = '复习队列为空。'; return; }
        currentQuestion = queue[0].question;
        Storage.removeFromInterviewQueue(queue[0].id);
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
    }

    return { init, onShow };
})();
