/**
 * stt.js — 语音识别（Speech-to-Text）封装
 * 处理浏览器自动暂停导致的识别中断：自动重启并累积文本
 */

const STT = (() => {
    let recognition = null;
    let isListening = false;
    let userStopped = false;      // 用户主动停止 vs 浏览器自动暂停
    let fullTranscript = '';      // 累积全部识别文本
    let onResultCallback = null;
    let onEndCallback = null;
    let onErrorCallback = null;

    function getRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return null;

        if (!recognition) {
            recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = true;
            recognition.continuous = true;
            recognition.maxAlternatives = 1;
        }
        return recognition;
    }

    function start(onResult, onEnd, onError) {
        const recog = getRecognition();
        if (!recog) {
            if (onError) onError(new Error('浏览器不支持语音识别'));
            return false;
        }

        stop();
        fullTranscript = '';
        userStopped = false;
        onResultCallback = onResult;
        onEndCallback = onEnd;
        onErrorCallback = onError;

        recog.onresult = (event) => {
            let newFinal = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    newFinal += event.results[i][0].transcript + ' ';
                }
            }
            // 累积最终结果
            if (newFinal) {
                fullTranscript += newFinal;
            }
            // 发送累积文本 + 当前临时结果
            if (onResultCallback) {
                const interim = Array.from(event.results)
                    .filter(r => !r.isFinal)
                    .map(r => r[0].transcript)
                    .join(' ');
                onResultCallback((fullTranscript + interim).trim(), !!newFinal);
            }
        };

        recog.onerror = (event) => {
            if (event.error === 'no-speech' || event.error === 'aborted') return;
            // 其他错误不自动重启
            userStopped = true;
            isListening = false;
            if (onErrorCallback) onErrorCallback(new Error(event.error));
        };

        recog.onend = () => {
            isListening = false;
            // 如果不是用户主动停止，自动重启继续监听
            if (!userStopped) {
                try {
                    recog.start();
                    isListening = true;
                } catch (e) {
                    // 重启失败，结束
                    if (onEndCallback) onEndCallback();
                }
            } else {
                // 用户主动停止
                if (onEndCallback) onEndCallback();
            }
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

    function stop() {
        userStopped = true;  // 标记为用户主动停止
        if (recognition && isListening) {
            try { recognition.stop(); } catch (e) {}
            isListening = false;
        }
    }

    function reset() {
        stop();
        fullTranscript = '';
        recognition = null;
    }

    function isActive() { return isListening; }

    function isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    return { start, stop, reset, isActive, isSupported };
})();
