/**
 * tts.js — 语音合成（Text-to-Speech）封装
 * 使用浏览器 Web Speech API 的 speechSynthesis
 * 处理 Chrome 异步加载语音列表的问题
 */

const TTS = (() => {
    let voices = [];
    let voicesLoaded = false;
    let isLoading = false;

    /**
     * 获取英文语音列表
     * Chrome 中语音列表异步加载，需要轮询等待
     */
    async function getVoices() {
        if (voicesLoaded && voices.length > 0) {
            return voices;
        }

        // 尝试同步获取
        const synth = window.speechSynthesis;
        const available = synth.getVoices();
        if (available && available.length > 0) {
            voices = available.filter(v => v.lang.startsWith('en'));
            if (voices.length > 0) {
                voicesLoaded = true;
                return voices;
            }
        }

        // 异步等待加载
        return new Promise((resolve) => {
            // Chrome 的 voiceschanged 事件
            const onVoicesChanged = () => {
                const all = synth.getVoices();
                voices = all.filter(v => v.lang.startsWith('en'));
                if (voices.length > 0) {
                    voicesLoaded = true;
                }
                resolve(voices);
            };

            synth.addEventListener('voiceschanged', onVoicesChanged, { once: true });

            // 超时兜底（5秒）
            setTimeout(() => {
                const all = synth.getVoices();
                voices = all.filter(v => v.lang.startsWith('en'));
                voicesLoaded = true;
                resolve(voices);
            }, 5000);
        });
    }

    /**
     * 朗读文本
     * @param {string} text - 要朗读的文本
     * @param {object} options - { rate, voiceIndex, onStart, onEnd, onError }
     * @returns {Promise} 朗读完成后 resolve
     */
    async function speak(text, options = {}) {
        const {
            rate = null,
            voiceIndex = null,
            onStart = null,
            onEnd = null,
            onError = null,
        } = options;

        // 停止当前正在播放的语音
        stop();

        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);

        // 设置语速
        const settings = Storage.getSettings();
        utterance.rate = rate !== null ? rate : (settings.ttsRate || 1.0);
        utterance.lang = 'en-US';

        // 设置语音
        const allVoices = await getVoices();
        const idx = voiceIndex !== null ? voiceIndex : (settings.ttsVoiceIndex || 0);
        if (allVoices.length > 0) {
            utterance.voice = allVoices[Math.min(idx, allVoices.length - 1)];
        }

        return new Promise((resolve, reject) => {
            utterance.onstart = () => {
                if (onStart) onStart();
            };

            utterance.onend = () => {
                if (onEnd) onEnd();
                resolve();
            };

            utterance.onerror = (e) => {
                // "interrupted" 不算错误（用户主动停止或被新的 speak 打断）
                if (e.error === 'interrupted' || e.error === 'canceled') {
                    resolve();
                    return;
                }
                if (onError) onError(e);
                reject(e);
            };

            synth.speak(utterance);
        });
    }

    /**
     * 停止朗读
     */
    function stop() {
        window.speechSynthesis.cancel();
    }

    /**
     * 是否正在朗读
     */
    function isSpeaking() {
        return window.speechSynthesis.speaking;
    }

    /**
     * 获取可用的英文语音列表（用于设置面板）
     */
    async function getEnglishVoices() {
        const allVoices = await getVoices();
        return allVoices.map((v, i) => ({
            index: i,
            name: v.name,
            lang: v.lang,
        }));
    }

    /**
     * 检查 TTS 是否可用
     */
    function isSupported() {
        return 'speechSynthesis' in window;
    }

    return {
        speak,
        stop,
        isSpeaking,
        getVoices: getEnglishVoices,
        isSupported,
    };
})();
