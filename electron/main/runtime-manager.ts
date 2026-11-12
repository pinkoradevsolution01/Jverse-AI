import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { shell } from "electron";

import type { DesktopRuntimeComponent, DesktopRuntimeStatus } from "../shared/ipc";

const QWEN_MODEL = "qwen2.5:7b";
const OFFICIAL_INSTALLERS = {
  ollama: "https://ollama.com/download",
  python: "https://www.python.org/downloads/windows/",
} as const;

type RuntimeId = "ollama" | "python" | "qwen" | "voice";

function executableExists(candidate: string | undefined) {
  return Boolean(candidate && fs.existsSync(candidate));
}

async function execute(command: string, args: string[], timeoutMs = 10_000): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true, shell: false });
    let output = "";
    const append = (chunk: Buffer) => { output = `${output}${chunk.toString()}`.slice(-8_000); };
    child.stdout.on("data", append); child.stderr.on("data", append);
    const timeout = setTimeout(() => { child.kill(); resolve({ ok: false, output: "Timed out while checking runtime." }); }, timeoutMs);
    child.on("error", () => { clearTimeout(timeout); resolve({ ok: false, output: "Runtime not found." }); });
    child.on("close", (code) => { clearTimeout(timeout); resolve({ ok: code === 0, output }); });
  });
}

export class DesktopRuntimeManager {
  private progressListeners = new Set<(message: string) => void>();

  onProgress(listener: (message: string) => void) { this.progressListeners.add(listener); return () => this.progressListeners.delete(listener); }
  private progress(message: string) { this.progressListeners.forEach((listener) => listener(message)); }

  private ollamaPath() {
    const local = process.env.LOCALAPPDATA;
    const candidates = [process.env.JVERSE_OLLAMA_EXECUTABLE, local && path.join(local, "Programs", "Ollama", "ollama.exe"), "ollama"];
    return candidates.find((candidate) => candidate === "ollama" || executableExists(candidate)) ?? "ollama";
  }

  pythonExecutable() {
    const local = process.env.LOCALAPPDATA;
    const candidates = [process.env.JVERSE_PYTHON_EXECUTABLE, local && path.join(local, "Programs", "Python", "Python312", "python.exe"), "python"];
    return candidates.find((candidate) => candidate === "python" || executableExists(candidate)) ?? "python";
  }

  async status(): Promise<DesktopRuntimeStatus> {
    const ollama = await execute(this.ollamaPath(), ["--version"]);
    const python = await execute(this.pythonExecutable(), ["--version"]);
    const model = ollama.ok ? await execute(this.ollamaPath(), ["list"], 15_000) : { ok: false, output: "" };
    const voice = python.ok ? await execute(this.pythonExecutable(), ["-c", "import faster_whisper, piper; print('ready')"]) : { ok: false, output: "" };
    const components: DesktopRuntimeComponent[] = [
      { id: "ollama", label: "Ollama", status: ollama.ok ? "ready" : "missing", detail: ollama.ok ? ollama.output.trim() : "Install the local model runtime." },
      { id: "qwen", label: "Qwen 2.5", status: model.ok && model.output.includes(QWEN_MODEL) ? "ready" : "missing", detail: model.ok && model.output.includes(QWEN_MODEL) ? "Local model available." : "Download required model." },
      { id: "python", label: "Python Agent", status: python.ok ? "ready" : "missing", detail: python.ok ? python.output.trim() : "Install Python 3.12+ to run local voice and agent services." },
      { id: "voice", label: "Whisper + Piper", status: voice.ok ? "ready" : python.ok ? "setup_required" : "missing", detail: voice.ok ? "Open-source speech runtime available." : "Complete the local Python Agent setup." },
    ];
    return { components };
  }

  async openInstaller(id: RuntimeId) {
    if (id === "ollama") return shell.openExternal(OFFICIAL_INSTALLERS.ollama);
    if (id === "python") return shell.openExternal(OFFICIAL_INSTALLERS.python);
    throw new Error("No installer is available for this component.");
  }

  async installQwen() {
    const check = await execute(this.ollamaPath(), ["--version"]);
    if (!check.ok) throw new Error("Install Ollama before downloading Qwen.");
    this.progress("Downloading Qwen 2.5. This may take several minutes.");
    const result = await execute(this.ollamaPath(), ["pull", QWEN_MODEL], 60 * 60 * 1000);
    if (!result.ok) throw new Error(result.output || "Qwen download failed.");
    this.progress("Qwen 2.5 is ready for JVerse.");
  }
}
