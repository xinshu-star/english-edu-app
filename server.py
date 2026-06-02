"""
英语单词学习助手 — 本地服务器
功能: 提供静态文件服务 + 代理 AI API 请求（解决浏览器 CORS 限制）
"""
import os
import sys
import json
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
load_dotenv()

app = Flask(__name__, static_folder="src", static_url_path="")
CORS(app)

# 当前目录作为根目录
ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"


def get_api_key(request_data=None):
    """获取 API Key：优先使用浏览器传来的，其次用 .env 中的"""
    if request_data:
        key = request_data.get("api_key", "").strip()
        if key and key != "your_key_here":
            return key
    if DEEPSEEK_API_KEY and DEEPSEEK_API_KEY != "your_key_here":
        return DEEPSEEK_API_KEY
    return ""


# ===== 静态文件路由 =====

@app.route("/")
def index():
    """主页面"""
    return send_from_directory(str(ROOT / "src"), "index.html")


@app.route("/data/<path:filename>")
def serve_data(filename):
    """提供 data 目录下的 JSON 文件"""
    return send_from_directory(str(DATA_DIR), filename)


# ===== API 代理路由 =====

@app.route("/api/health", methods=["GET", "POST"])
def health_check():
    """健康检查 + API Key 状态"""
    data = request.get_json(silent=True) or {}
    api_key = get_api_key(data)
    has_key = bool(api_key)
    return jsonify({
        "ok": True,
        "apiKeyConfigured": has_key
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    """代理 AI 聊天请求到 DeepSeek"""
    data = request.get_json()
    if not data or "messages" not in data:
        return jsonify({"error": "请求格式错误，需要包含 messages 字段"}), 400

    api_key = get_api_key(data)
    if not api_key:
        return jsonify({"error": "API Key 未配置。请在设置面板中配置，或在 .env 文件中设置 DEEPSEEK_API_KEY"}), 400

    messages = data["messages"]
    temperature = data.get("temperature", 0.7)
    max_tokens = data.get("max_tokens", 1000)
    response_format = data.get("response_format", None)

    try:
        payload = {
            "model": "deepseek-chat",
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        resp = requests.post(
            DEEPSEEK_API_URL,
            json=payload,
            headers=headers,
            timeout=60,
        )

        if resp.status_code != 200:
            return jsonify({
                "error": f"AI API 返回错误 ({resp.status_code})",
                "detail": resp.text[:500]
            }), resp.status_code

        result = resp.json()
        content = result["choices"][0]["message"]["content"]

        return jsonify({
            "content": content,
            "usage": result.get("usage", {}),
        })

    except requests.exceptions.Timeout:
        return jsonify({"error": "AI API 请求超时，请检查网络连接后重试"}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "无法连接到 AI API，请检查网络连接"}), 502
    except Exception as e:
        return jsonify({"error": f"服务器内部错误: {str(e)}"}), 500


# ===== 启动 =====

def kill_existing_instances():
    """杀掉之前残留的 server.py 进程（避免多开）"""
    import subprocess
    try:
        # Windows: 查找并杀掉所有运行 server.py 的 python 进程
        result = subprocess.run(
            ['wmic', 'process', 'where', 'name="python.exe"', 'get', 'processid,commandline'],
            capture_output=True, text=True, timeout=10
        )
        current_pid = os.getpid()
        for line in result.stdout.split('\n'):
            if 'server.py' in line:
                parts = line.strip().split()
                pid_str = parts[-1] if parts else ''
                if pid_str and pid_str.isdigit():
                    pid = int(pid_str)
                    if pid != current_pid:
                        try:
                            subprocess.run(['taskkill', '/F', '/PID', str(pid)],
                                         capture_output=True, timeout=5)
                        except Exception:
                            pass
    except Exception:
        pass  # 清理失败不影响启动


def find_free_port(start=5000, max_port=5020):
    """查找可用端口"""
    import socket
    for port in range(start, max_port + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start


if __name__ == "__main__":
    kill_existing_instances()
    port = find_free_port()
    print("=" * 50)
    print("  英语单词学习助手 — Education PhD Prep")
    print("=" * 50)
    # 获取本机局域网 IP
    import socket as sock
    local_ip = "localhost"
    try:
        s = sock.socket(sock.AF_INET, sock.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    print(f"\n  电脑浏览器打开: http://localhost:{port}")
    if local_ip != "localhost":
        print(f"  手机浏览器打开: http://{local_ip}:{port}")
    print("\n  !! 不要关闭这个窗口，否则应用会停止运行。")
    print("  使用完毕后，按 Ctrl+C 退出。\n")

    has_key = bool(DEEPSEEK_API_KEY and DEEPSEEK_API_KEY != "your_key_here")
    if not has_key:
        print("  [提示] 尚未配置 API Key，面试评分功能暂时不可用。")
        print("     如需使用，请参考 .env.example 文件配置 DeepSeek API Key。\n")

    # 用系统默认浏览器打开应用
    import webbrowser
    webbrowser.open(f"http://localhost:{port}")

    app.run(host="0.0.0.0", port=port, debug=False)
