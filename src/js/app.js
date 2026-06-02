/**
 * app.js — 应用入口
 * 标签导航、设置面板、模块初始化、全局协调
 */

(function () {
    'use strict';

    // ===== DOM 元素 =====
    // 标签导航
    const tabBtns = document.querySelectorAll('.tab-btn');
    const modules = {
        vocab: document.getElementById('module-vocab'),
        spelling: document.getElementById('module-spelling'),
        interview: document.getElementById('module-interview'),
    };

    // 设置面板
    const btnSettings = document.getElementById('btnSettings');
    const settingsModal = document.getElementById('settingsModal');
    const btnSettingsClose = document.getElementById('btnSettingsClose');
    const btnTestConnection = document.getElementById('btnTestConnection');
    const apiKeyStatus = document.getElementById('apiKeyStatus');
    const settingApiKey = document.getElementById('settingApiKey');
    const settingDailyCount = document.getElementById('settingDailyCount');
    const settingThreshold = document.getElementById('settingThreshold');
    const settingVoice = document.getElementById('settingVoice');
    const settingRate = document.getElementById('settingRate');
    const dailyCountLabel = document.getElementById('dailyCountLabel');
    const thresholdLabel = document.getElementById('thresholdLabel');
    const rateLabel = document.getElementById('rateLabel');
    const btnExportData = document.getElementById('btnExportData');
    const btnImportData = document.getElementById('btnImportData');
    const importFileInput = document.getElementById('importFileInput');
    const btnResetData = document.getElementById('btnResetData');

    // 确认对话框
    const confirmModal = document.getElementById('confirmModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const btnConfirmYes = document.getElementById('btnConfirmYes');
    const btnConfirmNo = document.getElementById('btnConfirmNo');
    let confirmCallback = null;

    // ===== 初始化 =====

    async function init() {
        console.log('📚 英语单词学习助手 启动中...');

        // 检查浏览器兼容性
        checkBrowserCompatibility();

        // 初始化单词数据
        await Storage.initWords();

        // 初始化各模块
        initModules();

        // 加载设置
        loadSettings();
        updateAllSettingsUI();

        // 绑定全局事件
        bindGlobalEvents();

        // 默认显示第一个标签
        showTab('vocab');

        // 检查是否首次使用
        checkFirstRun();
    }

    function initModules() {
        // 单词记忆模块 DOM 引用
        Vocabulary.init({
            // 返回按钮 & 进度
            btnVocabBack: document.getElementById('btnVocabBack'),
            vocabProgressArea: document.getElementById('vocabProgressArea'),
            vocabProgressFill: document.getElementById('vocabProgressFill'),
            vocabProgressText: document.getElementById('vocabProgressText'),
            vocabStats: document.getElementById('vocabStats'),
            vocabCard: document.getElementById('vocabCard'),
            // 分类选择
            categoryView: document.getElementById('categoryView'),
            categoryGrid: document.getElementById('categoryGrid'),
            btnCategoryAll: document.getElementById('btnCategoryAll'),
            btnVocabPronounce: document.getElementById('btnVocabPronounce'),
            vocabWord: document.getElementById('vocabWord'),
            vocabPhonetic: document.getElementById('vocabPhonetic'),
            vocabOptions: document.getElementById('vocabOptions'),
            vocabFeedback: document.getElementById('vocabFeedback'),
            vocabActionBar: document.getElementById('vocabActionBar'),
            btnUnsure: document.getElementById('btnUnsure'),
            btnWrong: document.getElementById('btnWrong'),
            btnCorrect: document.getElementById('btnCorrect'),
            vocabEmpty: document.getElementById('vocabEmpty'),
            vocabEmptyTitle: document.getElementById('vocabEmptyTitle'),
            vocabEmptyDesc: document.getElementById('vocabEmptyDesc'),
            // 欢迎面板
            vocabWelcome: document.getElementById('vocabWelcome'),
            vocabWelcomeStats: document.getElementById('vocabWelcomeStats'),
            btnVocabStart: document.getElementById('btnVocabStart'),
            btnVocabReview: document.getElementById('btnVocabReview'),
            reviewBtnDesc: document.getElementById('reviewBtnDesc'),
            btnShowMastered: document.getElementById('btnShowMastered'),
            masteredCountBadge: document.getElementById('masteredCountBadge'),
            // 已掌握视图
            masteredView: document.getElementById('masteredView'),
            btnMasteredBack: document.getElementById('btnMasteredBack'),
            masteredTotalLabel: document.getElementById('masteredTotalLabel'),
            masteredList: document.getElementById('masteredList'),
            masteredEmpty: document.getElementById('masteredEmpty'),
            // 添加单词
            btnAddWord: document.getElementById('btnAddWord'),
            addWordPanel: document.getElementById('addWordPanel'),
            addWordEnglish: document.getElementById('addWordEnglish'),
            addWordChinese: document.getElementById('addWordChinese'),
            addWordCategory: document.getElementById('addWordCategory'),
            addWordPhonetic: document.getElementById('addWordPhonetic'),
            addWordExample: document.getElementById('addWordExample'),
            btnAddWordSubmit: document.getElementById('btnAddWordSubmit'),
            btnAddWordCancel: document.getElementById('btnAddWordCancel'),
            btnBatchImport: document.getElementById('btnBatchImport'),
            batchImportArea: document.getElementById('batchImportArea'),
            batchImportText: document.getElementById('batchImportText'),
            btnBatchImportSubmit: document.getElementById('btnBatchImportSubmit'),
            // 例句和跟读录音
            vocabExampleSection: document.getElementById('vocabExampleSection'),
            vocabExampleText: document.getElementById('vocabExampleText'),
            btnExamplePronounce: document.getElementById('btnExamplePronounce'),
            btnExampleRecord: document.getElementById('btnExampleRecord'),
            btnExamplePlay: document.getElementById('btnExamplePlay'),
            exampleRecordingStatus: document.getElementById('exampleRecordingStatus'),
            exampleAudioPlayer: document.getElementById('exampleAudioPlayer'),
        });

        // 拼写模块 DOM 引用
        Spelling.init({
            spellingEmpty: document.getElementById('spellingEmpty'),
            spellingStats: document.getElementById('spellingStats'),
            btnSpellingPronounce: document.getElementById('btnSpellingPronounce'),
            spellingInput: document.getElementById('spellingInput'),
            btnSpellingSubmit: document.getElementById('btnSpellingSubmit'),
            spellingResult: document.getElementById('spellingResult'),
            btnSpellingNext: document.getElementById('btnSpellingNext'),
        });

        // 面试模块 DOM 引用
        Interview.init({
            interviewEmpty: document.getElementById('interviewEmpty'),
            interviewEmptyDesc: document.getElementById('interviewEmptyDesc'),
            btnInterviewStart: document.getElementById('btnInterviewStart'),
            interviewStats: document.getElementById('interviewStats'),
            btnPlayQuestion: document.getElementById('btnPlayQuestion'),
            btnShowQuestion: document.getElementById('btnShowQuestion'),
            questionText: document.getElementById('questionText'),
            btnRecord: document.getElementById('btnRecord'),
            recordingIndicator: document.getElementById('recordingIndicator'),
            transcriptBox: document.getElementById('transcriptBox'),
            recordingActions: document.getElementById('recordingActions'),
            btnStopRecord: document.getElementById('btnStopRecord'),
            btnReRecord: document.getElementById('btnReRecord'),
            textAnswer: document.getElementById('textAnswer'),
            btnSubmitAnswer: document.getElementById('btnSubmitAnswer'),
            scoreResult: document.getElementById('scoreResult'),
            btnNextQuestion: document.getElementById('btnNextQuestion'),
            btnRetryQueue: document.getElementById('btnRetryQueue'),
        });
    }

    function checkBrowserCompatibility() {
        const issues = [];

        if (!('speechSynthesis' in window)) {
            issues.push('语音合成');
        }

        if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
            issues.push('语音识别');
        }

        if (issues.length > 0) {
            console.warn(`⚠️ 以下功能不可用: ${issues.join('、')}。推荐使用 Chrome 或 Edge 浏览器。`);
        }
    }

    async function checkFirstRun() {
        const settings = Storage.getSettings();
        if (!settings.apiKey) {
            // 首次使用，可以在这里显示引导
            console.log('💡 提示: 在设置中配置 DeepSeek API Key 可启用 AI 面试评分功能');
        }
    }

    // ===== 标签切换 =====

    function bindGlobalEvents() {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                showTab(tab);
            });
        });

        // 设置面板
        btnSettings.addEventListener('click', openSettings);
        btnSettingsClose.addEventListener('click', closeSettings);
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettings();
        });

        // 设置面板内部事件
        btnTestConnection.addEventListener('click', handleTestConnection);
        settingDailyCount.addEventListener('input', () => {
            dailyCountLabel.textContent = settingDailyCount.value;
            Storage.updateSetting('dailyWordCount', parseInt(settingDailyCount.value));
        });
        settingThreshold.addEventListener('input', () => {
            thresholdLabel.textContent = settingThreshold.value;
            Storage.updateSetting('scoringThreshold', parseInt(settingThreshold.value));
        });
        settingRate.addEventListener('input', () => {
            rateLabel.textContent = parseFloat(settingRate.value).toFixed(1);
            Storage.updateSetting('ttsRate', parseFloat(settingRate.value));
        });
        settingVoice.addEventListener('change', () => {
            Storage.updateSetting('ttsVoiceIndex', parseInt(settingVoice.value));
        });
        settingApiKey.addEventListener('change', () => {
            Storage.saveApiKey(settingApiKey.value);
            updateApiKeyStatus();
        });

        // 数据管理
        btnExportData.addEventListener('click', handleExportData);
        btnImportData.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', handleImportData);
        btnResetData.addEventListener('click', handleResetData);

        // 确认对话框
        btnConfirmNo.addEventListener('click', closeConfirm);
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) closeConfirm();
        });
    }

    function showTab(tab) {
        // 更新标签按钮
        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // 切换模块显示
        Object.keys(modules).forEach(key => {
            modules[key].style.display = key === tab ? '' : 'none';
        });

        // 通知模块可见
        if (tab === 'vocab') Vocabulary.onShow();
        if (tab === 'spelling') Spelling.onShow();
        if (tab === 'interview') Interview.onShow();
    }

    // ===== 设置面板 =====

    function openSettings() {
        loadSettings();
        updateAllSettingsUI();
        settingsModal.style.display = '';
        document.body.style.overflow = 'hidden';
    }

    function closeSettings() {
        settingsModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function loadSettings() {
        const settings = Storage.getSettings();
        settingApiKey.value = settings.apiKey || '';
        settingDailyCount.value = settings.dailyWordCount || 10;
        settingThreshold.value = settings.scoringThreshold || 60;
        settingRate.value = settings.ttsRate || 1.0;
        updateApiKeyStatus();
    }

    async function updateAllSettingsUI() {
        const settings = Storage.getSettings();

        dailyCountLabel.textContent = settings.dailyWordCount;
        thresholdLabel.textContent = settings.scoringThreshold;
        rateLabel.textContent = settings.ttsRate.toFixed(1);

        // 加载语音列表
        try {
            const voices = await TTS.getVoices();
            settingVoice.innerHTML = '';
            if (voices.length === 0) {
                const opt = document.createElement('option');
                opt.value = '0';
                opt.textContent = '使用默认语音';
                settingVoice.appendChild(opt);
            } else {
                voices.forEach((v, i) => {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = `${v.name} (${v.lang})`;
                    if (i === settings.ttsVoiceIndex) opt.selected = true;
                    settingVoice.appendChild(opt);
                });
            }
        } catch (e) {
            settingVoice.innerHTML = '<option value="0">使用默认语音</option>';
        }
    }

    function updateApiKeyStatus() {
        const key = settingApiKey.value.trim();
        if (!key) {
            apiKeyStatus.textContent = '未配置 API Key，AI 面试评分不可用';
            apiKeyStatus.style.color = 'var(--text-muted)';
        } else {
            apiKeyStatus.textContent = 'API Key 已设置';
            apiKeyStatus.style.color = 'var(--success)';
        }
    }

    async function handleTestConnection() {
        const key = settingApiKey.value.trim();
        if (!key) {
            apiKeyStatus.textContent = '⚠️ 请先输入 API Key';
            apiKeyStatus.style.color = 'var(--danger)';
            return;
        }

        // 保存到设置
        Storage.saveApiKey(key);

        btnTestConnection.disabled = true;
        btnTestConnection.innerHTML = '<span class="spinner"></span> 测试中...';

        const ok = await API.testConnection();

        if (ok) {
            apiKeyStatus.textContent = '✅ 连接成功！API 可用';
            apiKeyStatus.style.color = 'var(--success)';
        } else {
            apiKeyStatus.textContent = '❌ 连接失败。请检查 API Key 是否正确，以及网络是否通畅';
            apiKeyStatus.style.color = 'var(--danger)';
        }

        btnTestConnection.disabled = false;
        btnTestConnection.textContent = '测试连接';
    }

    // ===== 数据管理 =====

    function handleExportData() {
        const data = Storage.exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `英语单词学习助手_备份_${Storage.getToday()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function handleImportData() {
        const file = importFileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                showConfirm(
                    `确认导入数据？这将覆盖当前所有学习进度。\n\n备份信息:\n- 单词数: ${data.words?.length || 0}\n- 导出时间: ${data.exportedAt || '未知'}`,
                    () => {
                        const result = Storage.importAllData(data);
                        if (result.success) {
                            alert('数据导入成功！页面将刷新。');
                            location.reload();
                        } else {
                            alert(result.error);
                        }
                    }
                );
            } catch (err) {
                alert('文件格式不正确，无法导入。');
            }
        };
        reader.readAsText(file);
        importFileInput.value = '';
    }

    function handleResetData() {
        showConfirm(
            '⚠️ 确认重置所有学习进度？\n\n此操作将删除：\n- 所有单词学习记录\n- 拼写练习历史\n- 面试答题记录\n\n单词库本身不会被删除。\n\n此操作不可撤销！',
            () => {
                const words = Storage.getWords(); // 保留单词库
                Storage.resetAllData();
                Storage.saveWords(words);
                alert('所有进度已重置。页面将刷新。');
                location.reload();
            }
        );
    }

    // ===== 确认对话框 =====

    function showConfirm(message, callback) {
        confirmMessage.textContent = message;
        confirmCallback = callback;
        confirmModal.style.display = '';
        btnConfirmYes.addEventListener('click', () => {
            closeConfirm();
            if (confirmCallback) confirmCallback();
        }, { once: true });
    }

    function closeConfirm() {
        confirmModal.style.display = 'none';
        confirmCallback = null;
    }

    // ===== 键盘快捷键 =====

    document.addEventListener('keydown', (e) => {
        // ESC 关闭弹窗
        if (e.key === 'Escape') {
            closeSettings();
            closeConfirm();
        }

        // Ctrl+1/2/3 切换标签
        if (e.ctrlKey && e.key >= '1' && e.key <= '3') {
            e.preventDefault();
            const tabs = ['vocab', 'spelling', 'interview'];
            showTab(tabs[parseInt(e.key) - 1]);
        }
    });

    // ===== 启动 =====
    document.addEventListener('DOMContentLoaded', init);

})();
