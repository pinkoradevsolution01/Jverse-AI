import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { app } from "electron";

import { DesktopRuntimeManager } from "./runtime-manager";
import type { DesktopLocalAgentStatus } from "../shared/ipc";

const LOCAL_HOST = "127.0.0.1";
const LOCAL_PORT = 8788;
const MODEL = "en_US-ryan-high";

type ProgressListener = (message: string) => void;

function run(command: string, args: string[], cwd: string, timeoutMs = 20 * 60 * 1000, onOutput?: ProgressListener) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false });
    let output = "";
    const append = (chunk: Buffer) => {
      output = `${output}${chunk.toString()}`.slice(-6_000);
      const last = chunk.toString().trim();
      if (last) onOutput?.(last.slice(-400));
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Local Agent setup timed out. Please try again."));
    }, timeoutMs);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(output || `Setup command exited with code ${code ?? "unknown"}.`));
    });
  });
}

export class LocalAgentManager {
  private child: ChildProcess | null = null;
  private readonly token = randomBytes(32).toString("base64url");
  private readonly listeners = new Set<ProgressListener>();
  private lastError = "";

  constructor(private readonly runtime: DesktopRuntimeManager) {}

  onProgress(listener: ProgressListener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private progress(message: string) { this.listeners.forEach((listener) => listener(message)); }

  private runtimeDir() { return path.join(app.getPath("userData"), "runtime"); }
  private venvDir() { return path.join(this.runtimeDir(), "venv"); }
  private python() { return process.platform === "win32" ? path.join(this.venvDir(), "Scripts", "python.exe") : path.join(this.venvDir(), "bin", "python"); }
  private modelDir() { return path.join(this.runtimeDir(), "models"); }
  private modelPath() { return path.join(this.modelDir(), `${MODEL}.onnx`); }
  private readyFile() { return path.join(this.runtimeDir(), ".agent-ready"); }
  private brainDir() { return app.isPackaged ? path.join(process.resourcesPath, "brain") : path.resolve(app.getAppPath(), "..", "services", "brain"); }
  private installed() { return fs.existsSync(this.python()) && fs.existsSync(this.readyFile()) && fs.existsSync(this.modelPath()) && fs.existsSync(path.join(this.brainDir(), "pyproject.toml")); }
  private url(pathname: string) { return `http://${LOCAL_HOST}:${LOCAL_PORT}${pathname}`; }

  async status(): Promise<DesktopLocalAgentStatus> {
    if (await this.healthy()) return { status: "ready", detail: "Local JVerse Agent is running privately on this computer." };
    if (this.installed()) return { status: "stopped", detail: this.lastError || "Local Agent is prepared. Start it to enable chat and voice." };
    return { status: "setup_required", detail: "Prepare the local Python Agent after installing Python, Ollama, and Qwen." };
  }

  async prepare() {
    if (this.installed()) {
      this.progress("Local Python Agent is already prepared.");
      return;
    }
    if (fs.existsSync(this.python()) && fs.existsSync(this.readyFile())) {
      fs.mkdirSync(this.modelDir(), { recursive: true });
      this.progress("Downloading the JVerse Ryan voice…");
      await run(this.python(), ["-m", "piper.download_voices", "--download-dir", this.modelDir(), MODEL], this.runtimeDir(), undefined, (line) => this.progress(line));
      this.progress("JVerse Ryan voice is ready. Starting the local Agent…");
      await this.start();
      return;
    }
    const systemPython = this.runtime.pythonExecutable();
    fs.mkdirSync(this.runtimeDir(), { recursive: true });
    await run(systemPython, ["-c", "import sys; assert sys.version_info >= (3, 12), 'Python 3.12 or newer is required'"], this.runtimeDir(), 10_000);
    this.progress("Creating a private JVerse Python environment…");
    await run(systemPython, ["-m", "venv", this.venvDir()], this.runtimeDir(), 60_000, (line) => this.progress(line));
    this.progress("Installing the local JVerse Agent and voice runtime…");
    await run(this.python(), ["-m", "pip", "install", "--upgrade", "pip"], this.runtimeDir(), undefined, (line) => this.progress(line));
    await run(this.python(), ["-m", "pip", "install", this.brainDir()], this.runtimeDir(), undefined, (line) => this.progress(line));
    fs.mkdirSync(this.modelDir(), { recursive: true });
    this.progress("Downloading the open-source Piper voice…");
    await run(this.python(), ["-m", "piper.download_voices", "--download-dir", this.modelDir(), MODEL], this.runtimeDir(), undefined, (line) => this.progress(line));
    this.progress("Preparing the Faster-Whisper speech model…");
    await run(this.python(), ["-c", "from faster_whisper import WhisperModel; WhisperModel('base.en', device='cpu', compute_type='int8'); print('ready')"], this.runtimeDir(), undefined, (line) => this.progress(line));
    fs.writeFileSync(this.readyFile(), "ready\n", "utf8");
    this.progress("Local JVerse Agent is ready. Starting it now…");
    await this.start();
  }

  async start() {
    if (await this.healthy()) return;
    if (!this.installed()) throw new Error("Prepare the local Python Agent before starting it.");
    this.stop();
    this.lastError = "";
    this.progress("Starting local JVerse Agent…");
    this.child = spawn(this.python(), ["-m", "uvicorn", "app.main:app", "--host", LOCAL_HOST, "--port", String(LOCAL_PORT)], {
      cwd: this.brainDir(), windowsHide: true, shell: false,
      env: {
        ...process.env,
        JVERSE_LOCAL_MODE: "true",
        JVERSE_LOCAL_AGENT_TOKEN: this.token,
        JVERSE_COMPAT_LOCAL_OLLAMA: "true",
        COMPAT_LOCAL_OLLAMA: "true",
        JVERSE_OLLAMA_URL: "http://127.0.0.1:11434",
        PIPER_MODEL_PATH: this.modelPath(),
        WHISPER_MODEL: "base.en",
        WHISPER_DEVICE: "cpu",
        WHISPER_COMPUTE_TYPE: "int8",
      },
    });
    this.child.stderr?.on("data", (data: Buffer) => { this.lastError = data.toString().slice(-500); });
    this.child.once("exit", () => { this.child = null; });
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await this.healthy()) { this.progress("Local JVerse Agent is online."); return; }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    this.stop();
    throw new Error(this.lastError || "The local JVerse Agent did not start.");
  }

  stop() {
    if (this.child && !this.child.killed) this.child.kill();
    this.child = null;
  }

  private async healthy() {
    try {
      const response = await fetch(this.url("/health"), { signal: AbortSignal.timeout(800) });
      return response.ok;
    } catch { return false; }
  }

  private async request(pathname: string, init: RequestInit) {
    const response = await fetch(this.url(pathname), {
      ...init,
      headers: { "X-JVerse-Local-Token": this.token, ...(init.headers ?? {}) },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { detail?: string } | null;
      throw new Error(body?.detail || "The local Agent request failed.");
    }
    return response;
  }

  async chat(message: string, emit: (event: unknown) => void) {
    await this.start();
    const response = await this.request("/v1/local/chat/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, model: "qwen2.5:1.5b" }) });
    if (!response.body) throw new Error("The local Agent did not open a response stream.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const data = block.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
        if (data) { try { emit(JSON.parse(data)); } catch { /* malformed sidecar frame is ignored */ } }
      }
    }
  }

  async transcribe(audio: Uint8Array) {
    await this.start();
    if (audio.byteLength > 16 * 1024 * 1024) throw new Error("Voice recordings must be 16 MB or smaller.");
    const form = new FormData();
    const copy = new Uint8Array(audio.byteLength);
    copy.set(audio);
    form.append("audio", new Blob([copy.buffer], { type: "audio/webm" }), "jverse-voice.webm");
    const response = await this.request("/v1/local/voice/transcribe", { method: "POST", body: form });
    return response.json() as Promise<{ transcript: string; wake_word_detected: boolean; command?: string }>;
  }

  async speak(text: string) {
    await this.start();
    const response = await this.request("/v1/local/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    return new Uint8Array(await response.arrayBuffer());
  }
}
