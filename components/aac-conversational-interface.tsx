"use client";

import React, { useState, useEffect, useRef } from "react";
import BallStudy from "@/components/ui/ball-study";
import { Smiley } from "@/components/ui/smiley";
import { processSpeechWithGemini, CognitiveResult } from "@/src/services/GeminiCognitiveService";
import { Mic, MicOff, Volume2, Globe2, Sparkles, Send } from "lucide-react";

interface ActionOption {
  id: string;
  labelUser: string;
  labelClerk: string;
  payloadType?: "text" | "barcode" | "confirmation";
}

export function AACConversationalInterface() {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [translatedMeaning, setTranslatedMeaning] = useState("");
  const [clerkDisplay, setClerkDisplay] = useState("Waiting for staff...");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Default initial response cards
  const [options, setOptions] = useState<ActionOption[]>([
    { id: "1", labelUser: "Apple Pay, please", labelClerk: "Apple Pay" },
    { id: "2", labelUser: "No bag needed, thank you", labelClerk: "பை தேவையில்லை, நன்றி" },
    { id: "3", labelUser: "I have a point card", labelClerk: "உறுப்பினர் பார் குறியீடு" },
  ]);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);
  const accumulatedSpeechRef = useRef<string>("");
  const isProcessingRef = useRef<boolean>(false);

  const speakText = (text: string, lang: string = "ta-IN") => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const clearSilenceTimers = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdown(null);
  };

  const commitSpeechToGemini = async () => {
    clearSilenceTimers();
    const rawSpeech = accumulatedSpeechRef.current.trim();
    if (!rawSpeech || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsLoading(true);

    try {
      recognitionRef.current?.stop();
    } catch {}

    try {
      const result: CognitiveResult | null = await processSpeechWithGemini(
        rawSpeech,
        "convenience store",
        "Tamil",
        "English"
      );

      if (result) {
        setOptions(result.options);
        const translatedVoice = result.heardMeaningInUserLang || result.questionUser;
        setTranslatedMeaning(translatedVoice);
        speakText(translatedVoice, "en-US");
      }
    } catch (err) {
      console.error("Gemini cognitive translation failed:", err);
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
      accumulatedSpeechRef.current = "";
      setInterimText("");

      if (isListening) {
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch {}
        }, 1200);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "ta-IN"; // Target staff speech (Tamil)

        recognition.onresult = (event: any) => {
          let latest = "";
          for (let i = 0; i < event.results.length; i++) {
            latest += event.results[i][0].transcript + " ";
          }

          const cleaned = latest.trim();
          if (!cleaned || isProcessingRef.current) return;

          accumulatedSpeechRef.current = cleaned;
          setInterimText(cleaned);

          // Reset the 3-second silence timer on every new speech token
          clearSilenceTimers();
          let timeLeft = 3;
          setCountdown(timeLeft);

          countdownIntervalRef.current = setInterval(() => {
            timeLeft -= 1;
            if (timeLeft > 0) {
              setCountdown(timeLeft);
            } else {
              clearInterval(countdownIntervalRef.current);
            }
          }, 1000);

          silenceTimerRef.current = setTimeout(() => {
            commitSpeechToGemini();
          }, 3000);
        };

        recognition.onerror = (event: any) => {
          if (event.error !== "no-speech") {
            setIsListening(false);
            clearSilenceTimers();
          }
        };

        recognition.onend = () => {
          if (isListening && !isProcessingRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognitionRef.current = recognition;
      }
    }

    return () => clearSilenceTimers();
  }, [isListening]);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Microphone recognition requires Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      clearSilenceTimers();
      isProcessingRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
      setInterimText("");
    } else {
      accumulatedSpeechRef.current = "";
      setInterimText("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn("Recognition start failed:", err);
      }
    }
  };

  const selectResponse = (option: ActionOption) => {
    setClerkDisplay(option.labelClerk);
    speakText(option.labelClerk, "ta-IN");
  };

  return (
    <div className="flex h-screen w-full flex-col bg-neutral-950 text-white font-sans overflow-hidden">
      
      {/* 180° Inverted Clerk Display */}
      <section className="relative flex h-[35%] w-full flex-col items-center justify-center border-b border-orange-500/30 bg-neutral-900 px-6 rotate-180">
        <span className="absolute top-3 text-[11px] font-bold tracking-widest text-neutral-400">
          [ CLERK VIEW / FACING OPPOSITE ]
        </span>
        <h1 className="text-center text-4xl font-black text-orange-400 drop-shadow-sm transition-all duration-150">
          {clerkDisplay}
        </h1>
      </section>

      {/* Global Status Divider */}
      <div className="flex h-10 w-full items-center justify-between bg-orange-600 px-4 text-xs font-semibold text-black">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4" />
          <span>Listening: தமிழ் (Tamil) ➔ UI: English</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Tacit Cognitive Engine Active</span>
        </div>
      </div>

      {/* User Display: Kinetic Orb + Interactive Cards */}
      <section className="relative flex flex-1 flex-col justify-between p-4 max-w-lg mx-auto w-full">
        
        {/* Kinetic Listener Canvas */}
        <div className="relative h-40 w-full overflow-hidden rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
          {isListening ? (
            <BallStudy 
              mode="dark" 
              scale={1.05} 
              brightness={1.3} 
              className="h-full w-full pointer-events-none" 
            />
          ) : (
            <Smiley size={90} count={3} />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent pointer-events-none" />

          <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                {isListening ? "Listening..." : "Mic Idle"}
              </span>
              <p className="text-sm font-semibold text-green-400 truncate max-w-[260px]">
                {interimText || (isListening ? "Waiting for speech..." : "Tap mic to start")}
              </p>
            </div>
            <button
              onClick={toggleMic}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                isListening
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/40"
                  : "bg-neutral-800 text-neutral-300"
              }`}
            >
              {isListening ? <Mic className="h-5 w-5 animate-pulse" /> : <MicOff className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* 3-Second Silence Countdown Indicator */}
        {countdown !== null && (
          <div className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2 text-xs">
            <span className="font-semibold text-yellow-400">
              Silence detected. Translating in {countdown}s...
            </span>
            <button
              onClick={commitSpeechToGemini}
              className="flex items-center gap-1 rounded bg-orange-500 px-2.5 py-1 font-bold text-black hover:bg-orange-400"
            >
              <Send className="h-3 w-3" />
              <span>Translate Now</span>
            </button>
          </div>
        )}

        {/* Real-time Translated Meaning */}
        <div className="rounded-lg bg-neutral-900/90 border border-neutral-800 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400">Staff Spoke (Translated):</span>
            {translatedMeaning && (
              <button
                onClick={() => speakText(translatedMeaning, "en-US")}
                className="text-xs text-green-400 hover:underline flex items-center gap-1"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Replay</span>
              </button>
            )}
          </div>
          <p className="text-base font-bold text-white mt-1">
            {translatedMeaning || "Tap microphone and speak..."}
          </p>
        </div>

        {/* Dynamic Contextual Action Cards */}
        <div className="flex flex-col gap-2 pb-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => selectResponse(opt)}
              className="flex w-full flex-col rounded-xl border border-neutral-800 bg-neutral-900/80 p-3 text-left transition-all active:scale-[0.98] hover:border-orange-500/50 hover:bg-neutral-800"
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-orange-400">{opt.labelUser}</span>
                <Volume2 className="h-4 w-4 text-neutral-500" />
              </div>
              <span className="mt-0.5 text-xs text-neutral-400">
                Facing Staff (180°): &quot;{opt.labelClerk}&quot; 🔊
              </span>
            </button>
          ))}
        </div>

      </section>
    </div>
  );
}