"use client";

import { Mic, MicOff, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

export function VoiceControl({ onTranscript, speakText }: { onTranscript(text: string): void; speakText?: string }) {
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
