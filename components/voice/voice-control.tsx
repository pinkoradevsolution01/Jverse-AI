"use client";

import { Mic, MicOff, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { VoiceOrb, type VoiceState } from "./voice-orb";

type RecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEventLike = { results: ArrayLike<RecognitionResultLike>; resultIndex: number };
type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};
type RecognitionConstructor = new () => RecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

function supportedRecognition() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

function LegacyVoiceControl({ onTranscript, speakText }: { onTranscript(text: string): void; speakText?: string }) {
  const recognition = useRef<RecognitionLike | null>(null);
  const listening = useRef(false);
  const [state, setState] = useState<VoiceState>("idle");
  const [notice, setNotice] = useState("");
  const [wakeWordOnly, setWakeWordOnly] = useState(false);

  useEffect(() => () => {
    listening.current = false;
    recognition.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  async function startListening() {
    const Recognition = supportedRecognition();
    if (!Recognition) {
      setState("error");
      setNotice("Speech recognition is not supported in this browser. Use Chrome or the JVerse desktop app.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setState("error");
      setNotice("Microphone permission is required for voice input.");
      return;
    }
    const instance = new Recognition();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = navigator.language || "en-US";
    instance.onresult = (event) => {
      let finalText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
      }
      if (!finalText.trim()) return;
      const cleaned = finalText.trim().replace(/^\s*(hey\s+)?jverse[\s,.:!-]*/i, "");
      if (wakeWordOnly && cleaned === finalText.trim()) {
        setNotice('Say “Hey JVerse” before your request.');
        return;
      }
      if (cleaned) onTranscript(cleaned);
      setNotice("");
    };
    instance.onerror = (event) => {
      if (event.error !== "aborted") {
        listening.current = false;
        setState("error");
        setNotice(`Voice input stopped: ${event.error}.`);
      }
    };
    instance.onend = () => {
      if (listening.current) {
        try { instance.start(); } catch { /* recognition is already restarting */ }
      } else setState("idle");
    };
    recognition.current = instance;
    listening.current = true;
    setState("listening");
    setNotice(wakeWordOnly ? 'Listening for “Hey JVerse”…' : "Listening…");
    instance.start();
  }

  function stopListening() {
    listening.current = false;
    recognition.current?.stop();
    setState("idle");
    setNotice("");
  }

  function speak() {
    if (!speakText?.trim() || !("speechSynthesis" in window)) {
      setNotice("There is no assistant response available to read.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speakText);
    utterance.lang = navigator.language || "en-US";
    utterance.onstart = () => setState("speaking");
    utterance.onend = () => setState("idle");
    utterance.onerror = () => { setState("error"); setNotice("Text-to-speech could not start."); };
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="flex items-center gap-2" aria-label="Voice assistant controls">
      <VoiceOrb state={state} compact />
      <button type="button" onClick={listening.current ? stopListening : () => void startListening()} aria-label={listening.current ? "Stop voice input" : "Start voice input"} className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 text-cyan-100 transition hover:bg-cyan-300/10">
        {listening.current ? <MicOff size={17} /> : <Mic size={17} />}
      </button>
      <button type="button" onClick={speak} aria-label="Read last response aloud" className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 text-cyan-100 transition hover:bg-cyan-300/10"><Volume2 size={17} /></button>
      <button type="button" onClick={() => setWakeWordOnly((current) => !current)} className={`hidden rounded-lg px-2 py-1 text-[10px] font-semibold sm:block ${wakeWordOnly ? "bg-violet-400/20 text-violet-100" : "text-slate-500"}`}>Wake word</button>
      {notice ? <span role="status" className="hidden max-w-44 text-[10px] text-slate-400 lg:block">{notice}</span> : null}
    </div>
  );
}

/** Open-source voice client: audio is transcribed by Faster-Whisper and read by Piper. */
export function VoiceControl({ onTranscript, speakText, isThinking = false, onStateChange }: { onTranscript(text: string): void; speakText?: string; isThinking?: boolean; onStateChange?: (state: VoiceState) => void }) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const activityFrame = useRef<number | null>(null);
  const wasThinking = useRef(isThinking);
  const [state, setState] = useState<VoiceState>("idle");
  const [notice, setNotice] = useState("");
  const [wakeWordOnly, setWakeWordOnly] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);

  useEffect(() => () => {
    recorder.current?.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    if (activityFrame.current !== null) cancelAnimationFrame(activityFrame.current);
    void audioContext.current?.close();
    audio.current?.pause();
  }, []);

  useEffect(() => {
    setAutoSpeak(Boolean(window.jverseDesktop?.localAgent));
  }, []);

  async function transcribe(recording: Blob) {
    setState("processing");
    setNotice("Transcribing locally with Whisper…");
    try {
      const result = window.jverseDesktop?.localAgent
        ? await window.jverseDesktop.localAgent.transcribe(new Uint8Array(await recording.arrayBuffer()))
        : await (async () => {
          const body = new FormData();
          body.append("audio", recording, "jverse-voice.webm");
          const response = await fetch("/api/voice/transcribe", { method: "POST", body });
          const responseBody = await response.json().catch(() => null) as { transcript?: string; wake_word_detected?: boolean; command?: string; detail?: string; error?: { message?: string } } | null;
          if (!response.ok) throw new Error(responseBody?.detail ?? responseBody?.error?.message ?? "Voice transcription could not start.");
          return responseBody;
        })();
      const transcript = result?.transcript?.trim() ?? "";
      const command = result?.command?.trim();
      if (wakeWordOnly && !result?.wake_word_detected) {
        setNotice('Say “Hey JVerse” followed by your request.');
      } else if (wakeWordOnly && command) {
        onTranscript(command);
        setNotice("Command captured.");
      } else if (transcript) {
        onTranscript(transcript.replace(/^\s*(hey\s+)?jverse[\s,.:!-]*/i, ""));
        setNotice("Voice command captured.");
      } else {
        setNotice("I could not hear a command.");
      }
      setState("idle");
    } catch (error) {
      setState("error");
      setNotice(error instanceof Error ? error.message : "Voice transcription failed.");
    }
  }

  async function startListening() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setState("error"); setNotice("Voice recording requires the JVerse desktop app or a modern browser."); return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      chunks.current = [];
      const instance = new MediaRecorder(stream.current, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream.current).connect(analyser);
      audioContext.current = context;
      instance.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      instance.onstop = () => {
        if (activityFrame.current !== null) cancelAnimationFrame(activityFrame.current);
        activityFrame.current = null;
        void audioContext.current?.close();
        audioContext.current = null;
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
        void transcribe(new Blob(chunks.current, { type: instance.mimeType || "audio/webm" }));
      };
      recorder.current = instance;
      instance.start();
      setState("listening");
      // After speech is detected, a short pause ends the recording and sends it.
      const samples = new Uint8Array(analyser.fftSize);
      let heardSpeech = false;
      let quietSince: number | null = null;
      const watchActivity = () => {
        if (instance.state !== "recording") return;
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) {
          const centered = (sample - 128) / 128;
          energy += centered * centered;
        }
        const level = Math.sqrt(energy / samples.length);
        const now = performance.now();
        if (level > 0.018) {
          heardSpeech = true;
          quietSince = null;
        } else if (heardSpeech) {
          quietSince ??= now;
          if (now - quietSince >= 1200) {
            instance.stop();
            return;
          }
        }
        activityFrame.current = requestAnimationFrame(watchActivity);
      };
      activityFrame.current = requestAnimationFrame(watchActivity);
      setNotice(wakeWordOnly ? 'Listening for “Hey JVerse”…' : "Listening…");
    } catch {
      setState("error"); setNotice("Microphone permission is required for voice input.");
    }
  }

  function stopListening() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  const speak = useCallback(async () => {
    if (!speakText?.trim()) { setNotice("There is no assistant response available to read."); return; }
    setState("speaking"); setNotice("Speaking with Piper…");
    try {
      const localAudio = window.jverseDesktop?.localAgent ? await window.jverseDesktop.localAgent.speak(speakText) : null;
      const audioBlob = localAudio
        ? (() => {
          const copy = new Uint8Array(localAudio.byteLength);
          copy.set(localAudio);
          return new Blob([copy.buffer], { type: "audio/wav" });
        })()
        : await (async () => {
          const response = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: speakText }) });
          if (!response.ok) {
            const result = await response.json().catch(() => null) as { detail?: string; error?: { message?: string } } | null;
            throw new Error(result?.detail ?? result?.error?.message ?? "Piper speech could not start.");
          }
          return response.blob();
        })();
      const url = URL.createObjectURL(audioBlob);
      audio.current?.pause();
      const player = new Audio(url);
      audio.current = player;
      player.onended = () => { URL.revokeObjectURL(url); setState("idle"); setNotice(""); };
      player.onerror = () => { URL.revokeObjectURL(url); setState("error"); setNotice("Piper audio could not be played."); };
      await player.play();
    } catch (error) {
      setState("error"); setNotice(error instanceof Error ? error.message : "Piper speech could not start.");
    }
  }, [speakText]);

  useEffect(() => {
    const completedGeneration = wasThinking.current && !isThinking;
    wasThinking.current = isThinking;
    if (autoSpeak && completedGeneration && speakText?.trim()) void speak();
  }, [autoSpeak, isThinking, speak, speakText]);

  const visualState: VoiceState = state === "idle" && isThinking ? "thinking" : state;
  useEffect(() => { onStateChange?.(visualState); }, [onStateChange, visualState]);
  return <div className="flex items-center gap-2" aria-label="JVerse voice assistant controls">
    <VoiceOrb state={visualState} compact />
    <button type="button" onClick={state === "listening" ? stopListening : () => void startListening()} aria-label={state === "listening" ? "Stop voice input" : "Start voice input"} className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 text-cyan-100 transition hover:bg-cyan-300/10">
      {state === "listening" ? <MicOff size={17} /> : <Mic size={17} />}
    </button>
    <button type="button" onClick={() => void speak()} aria-label="Read last response aloud with Piper" className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 text-cyan-100 transition hover:bg-cyan-300/10"><Volume2 size={17} /></button>
    <button type="button" onClick={() => setAutoSpeak((current) => !current)} className={`hidden rounded-lg px-2 py-1 text-[10px] font-semibold sm:block ${autoSpeak ? "bg-cyan-300/20 text-cyan-100" : "text-slate-500"}`}>Auto voice</button>
    <button type="button" onClick={() => setWakeWordOnly((current) => !current)} className={`hidden rounded-lg px-2 py-1 text-[10px] font-semibold sm:block ${wakeWordOnly ? "bg-violet-400/20 text-violet-100" : "text-slate-500"}`}>Hey JVerse</button>
    {notice ? <span role="status" className="hidden max-w-44 text-[10px] text-slate-400 lg:block">{notice}</span> : null}
  </div>;
}
