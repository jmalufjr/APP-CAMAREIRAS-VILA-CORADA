"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Volume2, Repeat, RotateCcw } from "lucide-react";

type Who = "camareira" | "hospede";
type Phase = "idle" | "listening" | "processing" | "speaking";

// Ajustes de gravação pensados para falas com pausas e ritmo irregular.
const VOICE_LEVEL = 0.02; // volume mínimo para considerar que alguém está falando
const SILENCE_STOP_MS = 8000; // silêncio depois de começar a falar que encerra sozinho
const NO_SPEECH_STOP_MS = 15000; // ninguém falou nada
const MAX_RECORD_MS = 40000; // limite de segurança por fala
const MIN_RECORD_MS = 700;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
}

function beep(freq: number, ms = 130) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, ms);
  } catch {
    /* sem som de aviso, tudo bem */
  }
}

interface Recording {
  who: Who;
  recorder: MediaRecorder;
  stream: MediaStream;
  ctx: AudioContext;
  timer: ReturnType<typeof setInterval>;
  startedAt: number;
  hasSpoken: boolean;
  lastVoiceAt: number;
  discard: boolean;
}

export function TranslatorClient({ canSeeText }: { canSeeText: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [who, setWho] = useState<Who | null>(null);
  const [lang, setLang] = useState<string | null>(null); // idioma do hóspede, descoberto sozinho
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState(0);
  const [last, setLast] = useState<{ heard: string; said: string } | null>(null);
  const [detail, setDetail] = useState("");

  const langRef = useRef<string | null>(null);
  const rec = useRef<Recording | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const lastAudio = useRef<string | null>(null);
  const inviteAudio = useRef<string | null>(null);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // Já deixa pronta a frase de convite em inglês, para o primeiro toque ser rápido.
  useEffect(() => {
    const fd = new FormData();
    fd.append("mode", "convite");
    fetch("/api/translator", { method: "POST", body: fd })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.audio) inviteAudio.current = j.audio as string;
      })
      .catch(() => {});
  }, []);

  const releaseRecording = useCallback(() => {
    const r = rec.current;
    if (!r) return;
    clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx.close().catch(() => {});
    rec.current = null;
    setLevel(0);
  }, []);

  useEffect(
    () => () => {
      const r = rec.current;
      if (r) {
        r.discard = true;
        try {
          r.recorder.stop();
        } catch {
          /* já parado */
        }
      }
      releaseRecording();
      audioEl.current?.pause();
    },
    [releaseRecording]
  );

  function play(base64: string): Promise<boolean> {
    return new Promise((resolve) => {
      audioEl.current?.pause();
      const a = new Audio(`data:audio/mpeg;base64,${base64}`);
      audioEl.current = a;
      a.onended = () => resolve(true);
      a.onerror = () => resolve(false);
      a.play().catch(() => resolve(false));
    });
  }

  async function speak(base64: string) {
    setPhase("speaking");
    const ok = await play(base64);
    if (!ok) setMessage("Se não ouviu, toque em REPETIR.");
    setPhase("idle");
  }

  async function send(from: Who, blob: Blob, ms: number) {
    setPhase("processing");
    setMessage("");
    setDetail("");
    try {
      const fd = new FormData();
      fd.append("audio", blob, "fala");
      fd.append("mode", from);
      fd.append("lang", langRef.current ?? "");
      fd.append("ms", String(ms));
      const res = await fetch("/api/translator", { method: "POST", body: fd });
      const json = await res.json();

      if (json.ok) {
        if (from === "hospede" && json.lang) setLang(json.lang as string);
        lastAudio.current = json.audio as string;
        setLast({ heard: json.heard as string, said: json.said as string });
        await speak(json.audio as string);
        return;
      }

      beep(300, 220);
      const texts: Record<string, string> = {
        nao_entendi: "Não entendi. Toque e fale de novo.",
        idioma: "Não consegui reconhecer o idioma. Peça ao hóspede para falar de novo.",
        sem_idioma: "Primeiro toque em HÓSPEDE FALA.",
        limite: "O limite de hoje acabou. Fale com o gerente.",
        erro: "Algo deu errado. Toque e tente de novo.",
      };
      setMessage(texts[json.reason as string] ?? texts.erro);
      setDetail(canSeeText && json.detail ? String(json.detail) : "");
      if (json.audio) await speak(json.audio as string);
      else setPhase("idle");
    } catch {
      beep(300, 220);
      setMessage("Sem conexão. Veja a internet e tente de novo.");
      setPhase("idle");
    }
  }

  async function startListening(from: Who) {
    setMessage("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setMessage("Não consegui usar o microfone. Permita o microfone nesta página.");
      setPhase("idle");
      return;
    }

    const mime = pickMime();
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    const now = Date.now();
    const state: Recording = {
      who: from,
      recorder,
      stream,
      ctx,
      startedAt: now,
      hasSpoken: false,
      lastVoiceAt: now,
      discard: false,
      timer: setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length);
        setLevel(Math.min(1, rms * 8));
        const t = Date.now();
        if (rms > VOICE_LEVEL) {
          state.hasSpoken = true;
          state.lastVoiceAt = t;
        }
        const tooLong = t - state.startedAt > MAX_RECORD_MS;
        const longSilence = state.hasSpoken && t - state.lastVoiceAt > SILENCE_STOP_MS;
        const nobody = !state.hasSpoken && t - state.startedAt > NO_SPEECH_STOP_MS;
        if (tooLong || longSilence || nobody) stopListening();
      }, 100),
    };
    rec.current = state;

    recorder.onstop = () => {
      const heardSomething = state.hasSpoken;
      const ms = Date.now() - state.startedAt;
      const type = recorder.mimeType || mime || "audio/webm";
      const discard = state.discard;
      releaseRecording();
      if (discard) return;
      beep(520, 110);
      if (!heardSomething || ms < MIN_RECORD_MS) {
        setMessage("Não ouvi nada. Toque e fale de novo.");
        setPhase("idle");
        return;
      }
      void send(from, new Blob(chunks, { type }), ms);
    };

    setWho(from);
    setPhase("listening");
    beep(880);
    // Pequena espera para o som de aviso não entrar na gravação.
    setTimeout(() => {
      if (rec.current === state && recorder.state === "inactive") recorder.start();
    }, 250);
  }

  function stopListening() {
    const r = rec.current;
    if (!r) return;
    if (r.recorder.state === "recording") r.recorder.stop();
    else {
      // Parou antes de começar a gravar (toque muito rápido).
      r.discard = true;
      releaseRecording();
      setPhase("idle");
    }
  }

  async function handleGuest() {
    if (phase === "listening" && who === "hospede") return stopListening();
    if (phase !== "idle") return;
    // Início da conversa: o app convida o hóspede a falar (em inglês) e já fica ouvindo.
    if (!langRef.current && inviteAudio.current) {
      setPhase("speaking");
      await play(inviteAudio.current);
    }
    await startListening("hospede");
  }

  function handleCamareira() {
    if (phase === "listening" && who === "camareira") return stopListening();
    if (phase !== "idle" || !lang) return;
    void startListening("camareira");
  }

  function handleRepeat() {
    if (phase !== "idle" || !lastAudio.current) return;
    void speak(lastAudio.current);
  }

  function handleReset() {
    audioEl.current?.pause();
    setLang(null);
    setLast(null);
    lastAudio.current = null;
    setMessage("");
    setPhase("idle");
  }

  const listening = phase === "listening";
  const busy = phase === "processing" || phase === "speaking";
  const camActive = listening && who === "camareira";
  const guestActive = listening && who === "hospede";

  const status = listening
    ? "Ouvindo… fale com calma. Quando terminar, toque no botão vermelho."
    : phase === "processing"
      ? "Traduzindo…"
      : phase === "speaking"
        ? "Falando…"
        : lang
          ? "Pronto. Toque em quem vai falar."
          : "Para começar, toque em HÓSPEDE FALA.";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 text-center">
        <div className="flex items-center gap-3 text-xl font-semibold">
          {phase === "processing" && <Loader2 className="animate-spin" size={28} />}
          {phase === "speaking" && <Volume2 size={28} className="animate-pulse" />}
          {listening && <Mic size={28} className="text-red-600" />}
          <span>{status}</span>
        </div>
        {listening && (
          <div className="h-3 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <div className="h-3 rounded-full bg-red-500 transition-all duration-100" style={{ width: `${Math.max(6, level * 100)}%` }} />
          </div>
        )}
        {message && <p className="text-lg font-medium text-amber-700 dark:text-amber-300">{message}</p>}
        {detail && <p className="break-words text-xs text-muted-foreground">Detalhe técnico: {detail}</p>}
      </div>

      <button
        type="button"
        onClick={handleCamareira}
        disabled={(busy || guestActive || !lang) && !camActive}
        className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-3xl px-4 text-3xl font-bold text-white shadow-[0_6px_0_0_rgb(0_0_0/0.25)] transition active:translate-y-1 active:shadow-none disabled:opacity-40 ${
          camActive ? "animate-pulse bg-red-600 ring-8 ring-red-300/60" : "bg-emerald-600 hover:bg-emerald-700"
        }`}
      >
        {camActive ? <Square size={48} fill="currentColor" /> : <Mic size={48} />}
        {camActive ? "TERMINAR" : "EU FALO"}
      </button>

      <button
        type="button"
        onClick={() => void handleGuest()}
        disabled={(busy || camActive) && !guestActive}
        className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-3xl px-4 text-3xl font-bold text-white shadow-[0_6px_0_0_rgb(0_0_0/0.25)] transition active:translate-y-1 active:shadow-none disabled:opacity-40 ${
          guestActive ? "animate-pulse bg-red-600 ring-8 ring-red-300/60" : "bg-blue-700 hover:bg-blue-800"
        }`}
      >
        {guestActive ? <Square size={48} fill="currentColor" /> : <Mic size={48} />}
        {guestActive ? "TERMINAR" : "HÓSPEDE FALA"}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleRepeat}
          disabled={phase !== "idle" || !last}
          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-xl font-semibold disabled:opacity-40"
        >
          <Repeat size={24} /> REPETIR
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={phase === "listening"}
          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-xl font-semibold disabled:opacity-40"
        >
          <RotateCcw size={24} /> NOVA CONVERSA
        </button>
      </div>

      {canSeeText && last && (
        <details className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium">Ver o que foi entendido (só gerente e administrador)</summary>
          <p className="mt-2">
            <strong>Ouvido:</strong> {last.heard}
          </p>
          <p>
            <strong>Dito:</strong> {last.said}
          </p>
          {lang && (
            <p>
              <strong>Idioma do hóspede:</strong> {lang}
            </p>
          )}
        </details>
      )}
    </div>
  );
}
