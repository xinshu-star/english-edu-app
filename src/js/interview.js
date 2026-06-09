/**
 * interview.js — 模块3：模拟面试问答
 * AI 生成问题 + 语音问答 + AI 智能评分
 * 仅 AI 不可用时降级为离线模式
 */

const Interview = (() => {
    let currentQuestion = null;
    let userAnswer = '';
    let isRecording = false;
    let isSubmitting = false;
    let aiOk = true;  // AI 是否可用
    let els = {};

    const FALLBACK = [
        "Can you tell us about your research interests and why you chose this particular area?",
        "What research methodology are you most familiar with, and how would you apply it?",
        "How would you describe the relationship between educational theory and practice?",
        "What do you think are the biggest challenges facing education research today?",
        "Can you discuss a piece of research that has significantly influenced your thinking?",
        "How do you plan to contribute to the existing body of knowledge in your field?",
        "How would you ensure the validity and reliability of your research findings?",
        "Why do you believe a doctoral degree is important for your career goals?",
        "What ethical considerations do you think are most important in educational research?",
        "How do you see your research making a practical contribution to education?",
    ];
    let fbIdx = 0;

    function init(elementMap) {
        els = elementMap;
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

    // ===== 开始面试 =====

    async function startSession() {
        els.interviewEmpty.style.display = 'none';
        els.scoreResult.style.display = 'none';
        els.btnNextQuestion.style.display = 'none';
        resetUI();
        updateStatsRow();

        await loadQuestion();
    }

    async function loadQuestion() {
        // 显示加载
        els.btnPlayQuestion.disabled = true;
        els.btnPlayQuestion.innerHTML = '<span class="spinner"></span> AI 正在出题...';

        if (!aiOk) {
            showFallbackQuestion();
            return;
        }

        try {
            const learned = Storage.getRememberedWords();
            const result = await API.generateQuestion(learned);
            currentQuestion = result.question;
            renderQuestion();
        } catch (e) {
            aiOk = false;
            els.interviewEmptyDesc.textContent = '⚠️ AI 暂时不可用（' + (e.message || '网络超时') + '），使用备用题库。';
            showFallbackQuestion();
        }
    }

    function showFallbackQuestion() {
        currentQuestion = FALLBACK[fbIdx % FALLBACK.length];
        fbIdx++;
        renderQuestion();
    }

    function renderQuestion() {
        resetUI();
        els.btnPlayQuestion.disabled = false;
        els.btnPlayQuestion.innerHTML = '🔊 播放问题';
        els.questionText.textContent = currentQuestion;
        els.questionText.style.display = 'none';
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
        userAnswer = '';
        isRecording = false;
        STT.reset();
    }

    // ===== 问题操作 =====

    function playQuestion() {
        if (!currentQuestion) return;
        els.btnPlayQuestion.innerHTML = '🔊 播放中...';
        TTS.speak(currentQuestion)
            .then(() => { els.btnPlayQuestion.innerHTML = '🔊 重新播放'; })
            .catch(() => { els.btnPlayQuestion.innerHTML = '🔊 播放问题'; });
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
            els.transcriptBox.textContent = '⚠️ 浏览器不支持语音识别，请使用下方文本框输入。';
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
            els.btnRecord.textContent = '🎤 录音中...';
            els.recordingIndicator.style.display = 'inline-block';
            els.recordingActions.style.display = 'flex';
            els.transcriptBox.textContent = '聆听中...';
            els.transcriptBox.style.color = 'var(--text-muted)';
            els.textAnswer.style.display = 'none';
        } else {
            els.transcriptBox.textContent = '⚠️ 无法启动语音识别，请使用文字输入。';
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

    // ===== AI 评分 =====

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

        let scoreResult = null;
        let refAnswer = '';

        try {
            if (aiOk) {
                scoreResult = await API.scoreAnswer(currentQuestion, userAnswer);
                // 同时生成参考答案
                try {
                    const ref = await API.generateReferenceAnswer(currentQuestion);
                    refAnswer = ref.answer;
                } catch (e) { /* 参考答案生成失败不影响主流程 */ }
            }
        } catch (e) {
            aiOk = false;
        }

        if (scoreResult) {
            showResult(scoreResult, refAnswer);
            const t = Storage.getSettings().scoringThreshold;
            Storage.addInterviewRecord(currentQuestion, userAnswer, scoreResult.score, scoreResult.feedback, scoreResult.strengths, scoreResult.weaknesses, refAnswer);
            if (scoreResult.score < t) updateRetryBadge();
        } else {
            showFallbackResult();
            Storage.addInterviewRecord(currentQuestion, userAnswer, 0, '自评模式', [], [], '');
        }

        updateStatsRow();
        isSubmitting = false;
        els.btnSubmitAnswer.style.display = 'none';
        els.btnNextQuestion.style.display = '';
    }

    function showResult(result, refAnswer) {
        const { score, feedback, strengths, weaknesses } = result;
        const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--primary)' : 'var(--danger)';
        const label = score >= 80 ? '优秀' : score >= 60 ? '良好' : '需要改进';
        let html = `
            <div class="score-number" style="color:${color}">${score}</div>
            <div class="score-label">评级: ${label}</div>
            <div class="feedback-text">${esc(feedback)}</div>`;
        if (strengths?.length) html += `<div class="strength-item">💪 亮点: ${esc(strengths[0])}</div>`;
        if (weaknesses?.length) html += `<div class="weakness-item">📝 改进: ${esc(weaknesses[0])}</div>`;
        // 参考答案
        if (refAnswer) {
            html += `<div class="reference-answer">
                <div class="ref-label">📝 AI 参考答案</div>
                <div class="ref-text">${esc(refAnswer)}</div>
            </div>`;
        }
        const t = Storage.getSettings().scoringThreshold;
        if (score < t) html += `<div class="retry-notice">⚠️ 低于 ${t} 分，已加入错题库。</div>`;
        els.scoreResult.innerHTML = html;
        els.scoreResult.style.display = '';
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
    }

    function nextQuestion() {
        resetUI();
        updateStatsRow();
        updateRetryBadge();
        loadQuestion();
    }

    function reviewFromQueue() {
        const queue = Storage.getInterviewQueue();
        if (queue.length === 0) { els.transcriptBox.textContent = '错题库为空，继续练习新题吧！'; return; }
        const item = queue[0];
        currentQuestion = item.question;
        // 显示错题信息
        els.scoreResult.style.display = '';
        els.scoreResult.innerHTML = `
            <div class="reference-answer">
                <div class="ref-label">🔄 错题复习（得分: ${item.score}）</div>
                ${item.referenceAnswer ? `<div class="ref-text"><strong>📝 参考答案：</strong><br>${esc(item.referenceAnswer)}</div>` : ''}
            </div>`;
        Storage.removeFromInterviewQueue(item.id);
        renderQuestion();
        updateRetryBadge();
    }

    function updateStatsRow() {
        const s = Storage.getInterviewStats();
        els.interviewStats.innerHTML = `
            <span class="stat-chip neutral">📊 ${s.total} 题</span>
            <span class="stat-chip ${s.avgScore >= 60 ? 'success' : 'danger'}">📈 均分: ${s.avgScore}</span>
            <span class="stat-chip neutral">📅 今日: ${s.todayCount}</span>`;
    }

    function updateRetryBadge() {
        const q = Storage.getInterviewQueue();
        const span = document.getElementById('retryCount');
        if (span) span.textContent = q.length;
        els.btnRetryQueue.style.display = q.length > 0 ? '' : 'none';
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function onShow() {
        updateStatsRow();
        updateRetryBadge();
    }

    return { init, onShow };
})();
