/**
 * interview.js — 模块3：模拟面试问答
 * AI 生成问题 + 语音播放 + 语音回答 + AI 评分
 */

const Interview = (() => {
    let currentQuestion = null;
    let userAnswer = '';
    let isRecording = false;
    let isSubmitting = false;
    let useFallback = false;  // AI 不可用时使用离线题目
    let fallbackIndex = 0;
    let fallbackQuestions = [];
    let els = {};

    function init(elementMap) {
        els = elementMap;
        bindEvents();
        loadFallbackQuestions();
    }

    async function loadFallbackQuestions() {
        try {
            const resp = await fetch('/data/interview_questions_fallback.json');
            if (resp.ok) {
                fallbackQuestions = await resp.json();
            }
        } catch (e) {
            // 离线题目加载失败，使用硬编码备用
            fallbackQuestions = [
                { question: "Can you tell us about your research interests and why you chose this area?" },
                { question: "What research methodology are you most familiar with, and why do you prefer it?" },
                { question: "How do you think your research could contribute to the field of education?" },
                { question: "What challenges do you anticipate in your doctoral research, and how would you address them?" },
                { question: "Can you describe a research article that has significantly influenced your thinking?" },
            ];
        }
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
        // 检查 API 是否可用
        const hasApi = await API.testConnection();
        useFallback = !hasApi;
        fallbackIndex = 0;

        els.interviewEmpty.style.display = 'none';
        resetUI();
        updateStatsRow();

        if (useFallback && fallbackQuestions.length > 0) {
            els.interviewEmptyDesc.textContent = '💡 AI 服务未配置，正在使用离线备用题目。如需 AI 智能出题，请在设置中配置 API Key。';
            showOfflineQuestion();
        } else if (useFallback) {
            els.interviewEmpty.style.display = '';
            els.interviewEmptyDesc.textContent = 'AI 服务不可用，且没有离线题目。请检查网络或在设置中配置 API Key。';
            return;
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
            // 降级到离线题目
            useFallback = true;
            els.interviewEmptyDesc.textContent = '⚠️ AI 出题失败，已切换到离线备用题目。';
            showOfflineQuestion();
        }
    }

    function showOfflineQuestion() {
        if (fallbackQuestions.length === 0) return;
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

        // 自动播放问题
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
        if (isRecording) {
            stopRecording();
            return;
        }

        // 检查支持
        if (!STT.isSupported()) {
            els.transcriptBox.textContent = '⚠️ 你的浏览器不支持语音识别。请使用下方文本框输入回答。推荐使用 Chrome 或 Edge 浏览器。';
            els.textAnswer.style.display = '';
            els.textAnswer.focus();
            return;
        }

        // 开始录音
        const started = STT.start(
            // onResult
            (transcript, isFinal) => {
                els.transcriptBox.textContent = transcript;
                userAnswer = transcript;
                if (isFinal) {
                    els.transcriptBox.style.color = 'var(--text-primary)';
                } else {
                    els.transcriptBox.style.color = 'var(--text-muted)';
                }
            },
            // onEnd
            () => {
                isRecording = false;
                els.btnRecord.style.display = 'none';
                els.recordingIndicator.style.display = 'none';
                els.btnRecord.className = 'btn-record';
                els.recordingActions.style.display = 'none';
                if (userAnswer) {
                    els.btnSubmitAnswer.disabled = false;
                }
            },
            // onError
            (err) => {
                isRecording = false;
                els.recordingIndicator.style.display = 'none';
                els.btnRecord.className = 'btn-record';
                els.btnRecord.textContent = '🎤 点击开始录音';
                els.recordingActions.style.display = 'none';
                els.transcriptBox.textContent = `⚠️ 语音识别出错: ${err.message}\n请使用下方文本框输入回答。`;
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
        els.btnRecord.className = 'btn-record';

        if (!userAnswer) {
            els.transcriptBox.textContent = '(未识别到语音内容，请重新录音或使用文字输入)';
        }
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
        // 获取最终答案
        const textAnswer = els.textAnswer.value.trim();
        if (textAnswer) {
            userAnswer = textAnswer;
        }

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
                // 离线模式：显示自评指导
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

        let scoreColor;
        let scoreLabel;
        if (score >= 80) {
            scoreColor = 'var(--success)';
            scoreLabel = '优秀';
        } else if (score >= 60) {
            scoreColor = 'var(--primary)';
            scoreLabel = '良好';
        } else {
            scoreColor = 'var(--danger)';
            scoreLabel = '需要改进';
        }

        let html = `
            <div class="score-number" style="color:${scoreColor}">${score}</div>
            <div class="score-label">评级: ${scoreLabel}</div>
            <div class="feedback-text">${escapeHtml(feedback)}</div>
        `;

        if (strengths && strengths.length > 0) {
            html += `<div class="strength-item">💪 亮点: ${escapeHtml(strengths[0])}</div>`;
        }
        if (weaknesses && weaknesses.length > 0) {
            html += `<div class="weakness-item">📝 改进: ${escapeHtml(weaknesses[0])}</div>`;
        }

        // 不及格提醒
        const threshold = Storage.getSettings().scoringThreshold;
        if (score < threshold) {
            html += `<div class="retry-notice">⚠️ 此题得分低于 ${threshold} 分，已加入复习队列，请稍后重新练习。</div>`;
        }

        els.scoreResult.innerHTML = html;
        els.scoreResult.style.display = '';

        // 保存记录
        Storage.addInterviewRecord(currentQuestion, userAnswer, score, feedback, strengths, weaknesses);

        updateStatsRow();
        updateRetryBadge();
    }

    function showFallbackResult() {
        els.scoreResult.innerHTML = `
            <div style="text-align:center;padding:20px;">
                <h4>📋 自评模式</h4>
                <p style="color:var(--text-secondary);margin-top:8px;">AI 评分暂不可用，请根据以下标准自我评估：</p>
                <div style="text-align:left;margin-top:12px;font-size:14px;line-height:1.8;">
                    1. 回答是否切题？（相关度）<br>
                    2. 是否使用了学术/教育学术语？（词汇运用）<br>
                    3. 回答结构是否清晰？（逻辑性）<br>
                    4. 是否有深度思考？（批判性思维）
                </div>
                <p style="margin-top:12px;color:var(--text-muted);">你的回答: "${userAnswer.slice(0, 100)}${userAnswer.length > 100 ? '...' : ''}"</p>
            </div>
        `;
        els.scoreResult.style.display = '';

        // 保存记录（无 AI 评分）
        Storage.addInterviewRecord(currentQuestion, userAnswer, 0, '自评模式', [], []);
        updateStatsRow();
    }

    function nextQuestion() {
        resetUI();
        updateStatsRow();
        updateRetryBadge();

        if (useFallback) {
            showOfflineQuestion();
        } else {
            generateNewQuestion();
        }
    }

    function reviewFromQueue() {
        const queue = Storage.getInterviewQueue();
        if (queue.length === 0) {
            els.transcriptBox.textContent = '复习队列为空，继续练习新题吧！';
            return;
        }

        const next = queue[0];
        Storage.removeFromInterviewQueue(next.id);
        currentQuestion = next.question;
        renderQuestion();
        updateRetryBadge();
    }

    // ===== UI 更新 =====

    function updateStatsRow() {
        const stats = Storage.getInterviewStats();
        els.interviewStats.innerHTML = `
            <span class="stat-chip neutral">📊 总练习: ${stats.total} 题</span>
            <span class="stat-chip ${stats.avgScore >= 60 ? 'success' : 'danger'}">📈 平均分: ${stats.avgScore}</span>
            <span class="stat-chip neutral">📅 今日: ${stats.todayCount} 题</span>
        `;
    }

    function updateRetryBadge() {
        const queue = Storage.getInterviewQueue();
        const count = queue.length;
        const span = document.getElementById('retryCount');
        if (span) span.textContent = count;

        els.btnRetryQueue.style.display = count > 0 ? '' : 'none';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function onShow() {
        updateStatsRow();
        updateRetryBadge();

        const stats = Storage.getInterviewStats();
        const remembered = Storage.getRememberedCount();

        if (remembered === 0) {
            els.interviewEmptyDesc.textContent = '先去"单词记忆练习"学习一些单词吧，AI 会根据你学过的词出面试题。';
        } else {
            els.interviewEmptyDesc.textContent = `已学单词: ${remembered} 个 | AI 将根据你学过的单词生成教育学面试问题`;
        }
    }

    return { init, onShow };
})();
