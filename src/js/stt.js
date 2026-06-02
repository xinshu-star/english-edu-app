/**
 * stt.js — 语音识别（Speech-to-Text）封装
 * 使用浏览器 Web Speech API 的 SpeechRecognition
 * 仅在 Chrome/Edge 中可用，Firefox 不支持
 */

const STT = (() => {
    let recognition = null;
    let isListening = false;
    let onResultCallback = null;
    let onEndCallback = null;

    /**
     * 获取 SpeechRecognition 实例
     */
    function getRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return null;

        if (!recognition) {
            recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = true;    // 实时显示识别过程
            recognition.continuous = true;         // 持续监听
            recognition.maxAlternatives = 1;
        }
        return recognition;
    }

    /**
     * 开始语音识别
     * @param {function} onResult - 回调(transcript, isFinal)
     * @param {function} onEnd - 识别结束回调
     * @param {function} onError - 错误回调
     * @returns {boolean} 是否成功启动
     */
    function start(onResult, onEnd, onError) {
        const recog = getRecognition();
        if (!recog) {
            if (onError) onError(new Error('浏览器不支持语音识别'));
            return false;
        }

        // 如果正在监听，先停止
        if (isListening) {
            try { recog.stop(); } catch (e) { /* ignore */ }
        }

        onResultCallback = onResult;
        onEndCallback = onEnd;

        recog.onresult = (event) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcript + ' ';
                } else {
                    interim += transcript;
                }
            }
            if (onResultCallback) {
                onResultCallback((final + interim).trim(), !!final);
            }
        };

        recog.onerror = (event) => {
            isListening = false;
            if (event.error === 'no-speech') {
                // 没有检测到语音，不算错误，继续监听
                return;
            }
            if (event.error === 'aborted') {
                return;
            }
            if (onError) {
                onError(new Error(`语音识别错误: ${event.error}`));
            }
        };

        recog.onend = () => {
            isListening = false;
            if (onEndCallback) onEndCallback();
        };

        try {
            recog.start();
            isListening = true;
            return true;
        } catch (e) {
            isListening = false;
            if (onError) onError(e);
            return false;
        }
    }

    /**
     * 停止语音识别
     */
    function stop() {
        if (recognition && isListening) {
            try {
                recognition.stop();
            } catch (e) {
                /* ignore */
            }
            isListening = false;
        }
        return getCurrentTranscript();
    }

    /**
     * 获取当前已识别的文本（用于停止时获取最终结果）
     */
    let _currentTranscript = '';
    function setCurrentTranscript(text) {
        _currentTranscript = text;
    }
    function getCurrentTranscript() {
        return _currentTranscript;
    }

    /**
     * 重置识别器状态
     */
    function reset() {
        stop();
        _currentTranscript = '';
        recognition = null;
    }

    /**
     * 是否正在监听
     */
    function isActive() {
        return isListening;
    }

    /**
     * 检查浏览器是否支持语音识别
     */
    function isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    return {
        start,
        stop,
        reset,
        isActive,
        isSupported,
        setCurrentTranscript,
    };
})();
