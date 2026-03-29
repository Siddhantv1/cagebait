import React, { useState, useEffect, useRef } from 'react';

const ScamHoneypot = () => {
  const [sessionActive, setSessionActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Murf TTS playing
  const [isListening, setIsListening] = useState(false); // Browser Mic recording
  const [callDuration, setCallDuration] = useState(0);
  const [extractedData, setExtractedData] = useState([]);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [activePersona, setActivePersona] = useState(null);
  const [activeVoice, setActiveVoice] = useState(null);
  const [fallbackText, setFallbackText] = useState('');

  const sessionIdRef = useRef('');
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const retryCountRef = useRef(0);
  const isProcessingRef = useRef(false);

  const sessionPausedRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const micStreamRef = useRef(null);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const updateIntelligenceCards = (intel) => {
    if (!intel) return;
    const newCards = [];
    let idCounter = 1;

    // Remove 'emails', 'passwords', 'names' mapping if empty, keep only actual items
    Object.keys(intel).forEach(key => {
      if (Array.isArray(intel[key]) && intel[key].length > 0) {
        intel[key].forEach(val => {
          newCards.push({
            id: idCounter++,
            type: key.replace(/([A-Z])/g, '_$1').toUpperCase(),
            value: val,
            confidence: 'HIGH'
          });
        });
      }
    });

    setExtractedData(newCards.reverse());
  };

  const visualizeTargetAudio = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const draw = () => {
      // Terminate visualizer logically if mic is functionally off
      if (sessionPausedRef.current || isProcessingRef.current || (audioRef.current && !audioRef.current.paused)) {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        const rects = document.querySelectorAll('.scammer-wave rect');
        rects.forEach(rect => rect.style.transform = `scaleY(0.2)`);
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArray);

      const rects = document.querySelectorAll('.scammer-wave rect');
      if (rects.length === 5) {
        rects.forEach((rect, i) => {
          const value = dataArray[i * 4] || 0;
          const scaleY = Math.max(0.1, value / 255);
          rect.style.transform = `scaleY(${scaleY})`;
        });
      }
      animationFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const startListening = () => {
    if (!recognitionRef.current || isSpeaking || sessionPausedRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);

      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 64;

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          micStreamRef.current = stream;
          const source = audioContextRef.current.createMediaStreamSource(stream);
          source.connect(analyserRef.current);
          visualizeTargetAudio();
        }).catch(err => console.error('Mic permission denied for visualization', err));
      } else if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
        visualizeTargetAudio();
      } else {
        visualizeTargetAudio();
      }
    } catch (e) {
      // Already started or errored
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const sendMessage = async (text) => {
    if (!text.trim()) {
      startListening();
      return;
    }
    stopListening();

    const payload = {
      sessionId: sessionIdRef.current || 'SESSION_' + Date.now(),
      text
    };

    isProcessingRef.current = true; // Block STT polling during fetch

    try {
      const res = await fetch('http://localhost:8000/api/voice-honeypot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'API failed');

      if (data.extractedIntelligence) {
        updateIntelligenceCards(data.extractedIntelligence);
      }
      if (data.conversationHistory) {
        setChatHistory(data.conversationHistory);
      }
      if (data.persona) {
        setActivePersona(data.persona.toUpperCase());
      }
      if (data.voiceUsed) {
        let finalVoice = typeof data.voiceUsed === 'string'
          ? data.voiceUsed
          : (data.voiceUsed.voice_id || data.voiceUsed.voiceId || "UNKNOWN");
        setActiveVoice(finalVoice.toUpperCase());
      }

      if (data.audioUrl) {
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;

        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => {
          setIsSpeaking(false);
          isProcessingRef.current = false;
          startListening();
        };
        audio.play();
      } else {
        isProcessingRef.current = false;
        startListening();
      }

    } catch (error) {
      console.error(error);
      isProcessingRef.current = false;
      startListening();
    }
  };

  const handleStartSession = async () => {
    try {
      // Explicitly request microphone access first
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Microphone access is required to use the voice honeypot.");
      return;
    }

    const id = 'SESSION_' + Date.now();
    sessionIdRef.current = id;
    setSessionActive(true);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Send per sentence 
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        sendMessage(transcript);
        retryCountRef.current = 0;
      };

      recognition.onerror = (event) => {
        console.log("Speech recognition error", event.error);
        setIsListening(false);
        // If no-speech error, restart automatically if the app is active
        if ((event.error === 'no-speech' || event.error === 'network') && !isProcessingRef.current) {
          retryCountRef.current++;
          if (retryCountRef.current < 5) {
            setTimeout(startListening, 500);
          }
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Auto-resume if the agent isn't talking or fetching or user paused
        if (!isSpeaking && !isProcessingRef.current && !sessionPausedRef.current && audioRef.current?.paused !== false) {
          setTimeout(startListening, 500);
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }

    timerRef.current = setInterval(() => {
      if (!sessionPausedRef.current) {
        setCallDuration(prev => prev + 1);
      }
    }, 1000);

    // Required small timeout to ensure refs are set
    setTimeout(startListening, 100);
  };

  const handleFallbackSubmit = (e) => {
    e.preventDefault();
    sendMessage(fallbackText);
    setFallbackText('');
  };

  const handleTerminateSession = async () => {
    // Immediate override state to kill STT loop
    setSessionPaused(true);
    sessionPausedRef.current = true;
    stopListening();
    if (audioRef.current) audioRef.current.pause();
    setIsSpeaking(false);
    isProcessingRef.current = true;

    try {
      const res = await fetch('http://localhost:8000/api/voice-honeypot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          text: "[SYSTEM_OVERRIDE: MANUAL_TERMINATION]",
          forceEnd: true
        })
      });

      const data = await res.json();

      // Play final exit message if returned, then refresh
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.onended = () => window.location.reload();
        audio.play();
      } else {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      console.error("Termination error:", error);
      window.location.reload();
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  // 1) Overlay Screen to accept Microphone permissions
  if (!sessionActive) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden text-[#E0E0E0]">
        <style>{`
                  @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:ital,wght@0,400;0,700;0,800;1,400&display=swap');
                  .font-display { font-family: 'Anton', sans-serif; text-transform: uppercase; letter-spacing: 0.02em; }
                  .font-mono-data { font-family: 'JetBrains Mono', monospace; }
                  .hard-shadow-acid { box-shadow: 6px 6px 0px 0px #CCFF00; border: 2px solid #333; }
                  .noise-overlay {
                      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                      pointer-events: none; z-index: 50; opacity: 0.04;
                      background: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
                  }
                  .scanlines {
                      background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1));
                      background-size: 100% 4px;
                      position: absolute; inset: 0; pointer-events: none; z-index: 40;
                  }
                `}</style>
        <div className="noise-overlay"></div>
        <div className="scanlines"></div>

        <div className="relative z-50 max-w-2xl text-center flex flex-col items-center">
          <div className="flex items-center gap-3 flex-nowrap">
            <h1 className="font-display text-6xl md:text-7xl lg:text-8xl tracking-tighter text-[#CCFF00] leading-none mb-5">
              CAGEBAIT
            </h1>
            <img
              src="./imagebait.png" // put your image in /public
              alt="Cagebait logo"
              className="h-[3.5rem] md:h-[4.5rem] lg:h-[5.5rem] xl:h-[6.5rem] w-auto object-contain mb-5"
            />
          </div>
          <div className="bg-[#111] border border-[#333] p-4 lg:p-6 text-left font-mono-data text-xs lg:text-sm space-y-4 hard-shadow-acid max-w-xl w-full">
            <p className="font-bold text-[#FF3300] tracking-widest text-[10px] lg:text-xs">/// SYSTEM BRIEFING</p>
            <p>CageBait is an autonomous, voice-driven AI Agent designed to waste scammers' time and extract actionable threat intelligence.</p>
            <ul className="list-disc pl-5 space-y-1 text-[#888]">
              <li><span className="text-[#E0E0E0]">Real-time audio responses</span> mapped to distinct personas.</li>
              <li><span className="text-[#E0E0E0]">Continuous browser STT</span> for seamless conversation.</li>
              <li><span className="text-[#E0E0E0]">Automated intel scraping</span> (phones, bank accounts, links).</li>
            </ul>
            <p className="text-[10px] text-[#666] mt-4 border-t border-[#333] pt-4 leading-tight">By initiating protocol, you agree to grant microphone access for local voice transcription. Your audio connects via API.</p>
          </div>

          <button
            onClick={handleStartSession}
            className="mt-8 px-6 py-3 bg-[#CCFF00] text-black font-display text-xl md:text-2xl lg:text-3xl hover:bg-white transition-colors box-content hard-shadow-acid cursor-pointer"
          >
            🎙ALLOW MIC & INITIATE🎙
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="h-screen w-screen bg-[#050505] text-[#E0E0E0] flex flex-col relative overflow-hidden selection:bg-[#CCFF00] selection:text-black">
      {/* Custom Fonts CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:ital,wght@0,400;0,700;0,800;1,400&display=swap');
        
        .font-display { font-family: 'Anton', sans-serif; text-transform: uppercase; letter-spacing: 0.02em; }
        .font-mono-data { font-family: 'JetBrains Mono', monospace; }
        
        /* CRT & Noise Textures */
        .noise-overlay {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          pointer-events: none; z-index: 50; opacity: 0.04;
          background: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
        }
        .scanlines {
          background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1));
          background-size: 100% 4px;
          position: absolute; inset: 0; pointer-events: none; z-index: 40;
        }

        /* Brutalist Hard Shadows */
        .hard-shadow-acid { box-shadow: 4px 4px 0px 0px #CCFF00; border: 2px solid #333; }

        /* Abstract Monkey Animations */
        @keyframes jaw-talk {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(12px); }
        }
        @keyframes eye-glitch {
          0%, 96%, 100% { transform: scaleY(1); opacity: 1; }
          98% { transform: scaleY(0.1); opacity: 0.8; }
        }
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes tape-scroll {
          from { transform: translateX(100%); }
          to { transform: translateX(-100%); }
        }
        @keyframes card-enter {
          from { opacity: 0; transform: translateX(30px) skewX(-5deg); }
          to { opacity: 1; transform: translateX(0) skewX(0); }
        }

        .anim-talk { animation: jaw-talk 0.15s infinite alternate; }
        .anim-blink { transform-box: fill-box; transform-origin: center; animation: eye-glitch 4s infinite; }
        .anim-spin-slow { animation: orbit-spin 20s linear infinite; }
        .anim-spin-reverse { animation: orbit-spin 15s linear infinite reverse; }
        
        .data-card {
          animation: card-enter 0.3s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
        }

        /* Scammer Waveform modified directly via JS inline transforms for zero latency */
        .scammer-wave rect {
          transform-origin: bottom;
          transition: transform 0.05s ease-out;
        }

        /* Custom styling for conversation stream scrollbar */
        .chat-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .chat-scroll::-webkit-scrollbar-track {
          background: #0A0A0A;
          border-left: 1px solid #222;
        }
        .chat-scroll::-webkit-scrollbar-thumb {
          background: #333;
        }
        .chat-scroll::-webkit-scrollbar-thumb:hover {
          background: #CCFF00;
        }

        /* Utility to hide scrollbar but keep functionality */
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="noise-overlay"></div>
      <div className="scanlines"></div>

      {/* Main Grid: min-h-0 prevents it from overflowing the strictly sized flex container */}
      <div className="relative z-10 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 p-4 gap-4 lg:gap-6">

        {/* LEFT PANEL: Telemetry & Status */}
        <div className="lg:col-span-3 flex flex-col justify-between border-l-2 border-[#333] pl-4 py-2 min-h-0">
          <div className="flex flex-col min-h-0">
            <div className="flex items-center gap-3 flex-nowrap">
              <h1 className="font-display text-3xl lg:text-4xl xl:text-5xl tracking-tighter text-[#CCFF00] mb-2 leading-none">
                CAGEBAIT
              </h1>
              {/* <img
              src="./imagebait.png" // put your image in /public
              alt="Cagebait logo"
              className="h-11 w-auto object-contain lg:h-12 xl:h-14"
            /> */}
            </div>
            <div className="inline-block bg-[#FF3300] text-black font-display px-2 py-0.5 text-xs mb-4 uppercase tracking-widest self-start">
              Honeypot Active
            </div>

            <div className="space-y-4 font-mono-data text-xs xl:text-sm">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <div className="text-[#666]">TARGET STATUS</div>
                  {sessionActive && (
                    <div className="flex flex-col items-end gap-1 relative">
                      <button
                        onClick={() => {
                          const st = !sessionPaused;
                          setSessionPaused(st);
                          sessionPausedRef.current = st;
                          if (st) stopListening();
                          else startListening();
                        }}
                        className={`text-[9px] px-1.5 py-0.5 border transition-colors cursor-pointer ${sessionPaused ? 'bg-[#FF3300] text-black border-[#FF3300] hover:bg-white hover:border-white' : 'border-[#444] text-[#444] hover:bg-[#222]'}`}
                      >
                        {sessionPaused ? 'RESUME SESSION' : 'PAUSE SESSION'}
                      </button>
                      <button
                        onClick={handleTerminateSession}
                        className="text-[8px] px-1.5 py-0.5 border border-[#FF3300] text-[#FF3300] opacity-50 hover:opacity-100 transition-opacity absolute top-6 right-0 whitespace-nowrap bg-[#050505] z-50 cursor-pointer"
                      >
                        [KILL_SESSION]
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 xl:w-3 xl:h-3 ${sessionPaused ? 'bg-[#FF3300]' : isSpeaking ? 'bg-[#CCFF00]' : 'bg-[#FF3300] animate-pulse'}`}></div>
                  <span className={sessionPaused ? 'text-[#FF3300]' : !isSpeaking ? 'text-[#FF3300]' : ''}>
                    {sessionPaused ? '[ SESSION_PAUSED ]' : isSpeaking ? 'AGENT_RESPONDING' : 'LISTENING'}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-[#666] mb-1">TIME ELAPSED</div>
                <div className="font-display text-3xl xl:text-4xl text-white tracking-widest">
                  {formatTime(callDuration)}
                </div>
              </div>

              <div className="flex flex-col min-h-0 flex-1">
                <div className="text-[#666] mb-1">CONVERSATION STREAM</div>
                <div className="flex-1 overflow-y-auto border border-[#222] bg-[#0A0A0A] p-2 flex flex-col gap-2 font-mono chat-scroll text-xs mt-1 min-h-[80px] max-h-[220px]">
                  {chatHistory.length === 0 && <span className="text-[#444] italic text-[10px]">Conversation will appear here</span>}
                  {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.sender === 'agent' ? 'items-end' : 'items-start'}`}>
                      <span className={`text-[9px] mb-0.5 ${msg.sender === 'agent' ? 'text-[#CCFF00]' : 'text-[#FF3300]'}`}>
                        {msg.sender === 'agent' ? 'AGENT' : 'TARGET'}
                      </span>
                      <div className={`p-1.5 border max-w-[90%] break-words ${msg.sender === 'agent' ? 'border-[#CCFF00]/30 text-white text-right' : 'border-[#FF3300]/30 text-gray-300'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleFallbackSubmit} className="mt-2 flex border border-[#333]">
                  <input
                    type="text"
                    value={fallbackText}
                    onChange={e => setFallbackText(e.target.value)}
                    className="bg-[#111] text-[#E0E0E0] flex-1 px-2 py-1.5 font-mono-data text-xs outline-none focus:bg-[#222]"
                    placeholder="Send Scammy Text..."
                  />
                  <button type="submit" className="bg-[#333] hover:bg-[#CCFF00] hover:text-black text-white px-3 font-mono-data text-xs transition-colors">
                    TX
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Target Audio Visualizer (Left Bottom) */}
          <div className="mt-4 lg:mt-auto shrink-0">
            <div className="text-[#666] font-mono-data text-[10px] xl:text-xs mb-1">TARGET AUDIO FEED</div>
            <div className="h-12 lg:h-16 border border-[#333] bg-[#0A0A0A] p-2 flex items-end gap-1">
              {isListening && !isSpeaking ? (
                <svg className="w-full h-full scammer-wave" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <rect x="5" y="0" width="12" height="40" fill="#FF3300" />
                  <rect x="25" y="0" width="12" height="40" fill="#FF3300" />
                  <rect x="45" y="0" width="12" height="40" fill="#FF3300" />
                  <rect x="65" y="0" width="12" height="40" fill="#FF3300" />
                  <rect x="85" y="0" width="12" height="40" fill="#FF3300" />
                </svg>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#444] font-mono-data text-xs" style={{ whiteSpace: "pre-wrap" }}>
                  [ SILENT ]
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CENTER PANEL: The Abstract Constructivist Monkey */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center relative border-l-2 border-r-2 border-[#222] min-h-0">

          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
          </div>

          <div className="relative w-full h-full flex items-center justify-center mix-blend-screen overflow-hidden p-4 min-h-0">
            {/* SVG purely bound to container without forcing massive arbitrary max-heights */}
            <svg viewBox="0 0 400 400" className="w-full h-full max-h-full object-contain drop-shadow-2xl">

              <g className="anim-spin-slow origin-center opacity-40">
                <circle cx="200" cy="200" r="180" fill="none" stroke="#666" strokeWidth="2" strokeDasharray="10 20" />
                <path d="M 200 20 A 180 180 0 0 1 380 200" fill="none" stroke="#CCFF00" strokeWidth="4" />
              </g>
              <g className="anim-spin-reverse origin-center opacity-40">
                <circle cx="200" cy="200" r="160" fill="none" stroke="#666" strokeWidth="1" />
                <rect x="195" y="30" width="10" height="20" fill="#FF3300" />
                <rect x="195" y="350" width="10" height="20" fill="#FF3300" />
              </g>

              {/* Constructivist Monkey Base */}
              <g className="origin-center transform scale-90">
                {/* Radar Dishes */}
                <path d="M 120 150 Q 40 150 40 200 Q 40 250 120 250" fill="none" stroke="#E0E0E0" strokeWidth="16" />
                <path d="M 280 150 Q 360 150 360 200 Q 360 250 280 250" fill="none" stroke="#E0E0E0" strokeWidth="16" />

                {/* Internal Ear Geometry */}
                <rect x="60" y="180" width="40" height="40" fill="#FF3300" className={!isSpeaking ? "animate-pulse" : ""} />
                <rect x="300" y="180" width="40" height="40" fill="#FF3300" className={!isSpeaking ? "animate-pulse" : ""} />

                {/* Main Head */}
                <polygon points="120,80 280,80 320,180 280,320 120,320 80,180" fill="#0A0A0A" stroke="#E0E0E0" strokeWidth="12" />

                {/* Forehead */}
                <line x1="160" y1="110" x2="240" y2="110" stroke="#444" strokeWidth="6" />
                <line x1="170" y1="125" x2="230" y2="125" stroke="#444" strokeWidth="6" />

                {/* Eyes */}
                <rect x="100" y="160" width="200" height="60" fill="#1A1A1A" stroke="#E0E0E0" strokeWidth="8" />
                <g className="anim-blink">
                  <rect x="120" y="175" width="60" height="30" fill={isSpeaking ? "#CCFF00" : "#444"} />
                  <circle cx="150" cy="190" r="6" fill="#000" />
                  <rect x="220" y="175" width="60" height="30" fill={isSpeaking ? "#CCFF00" : "#444"} />
                  <circle cx="250" cy="190" r="6" fill="#000" />
                </g>

                {/* Muzzle */}
                <defs>
                  <clipPath id="muzzleClip">
                    <polygon points="144,244 256,244 236,298 164,298" />
                  </clipPath>
                </defs>
                <path d="M 140 240 L 260 240 L 240 300 L 160 300 Z" fill="none" stroke="#E0E0E0" strokeWidth="8" />

                {/* Jaw / Teeth (Animates when speaking) */}
                <g className={isSpeaking ? "anim-talk" : ""}>
                  <g clipPath="url(#muzzleClip)">
                    <rect x="150" y="248" width="16" height="52" fill={isSpeaking ? "#E0E0E0" : "#333"} />
                    <rect x="175" y="248" width="16" height="52" fill={isSpeaking ? "#E0E0E0" : "#333"} />
                    <rect x="200" y="248" width="16" height="52" fill={isSpeaking ? "#E0E0E0" : "#333"} />
                    <rect x="225" y="248" width="16" height="52" fill={isSpeaking ? "#E0E0E0" : "#333"} />
                  </g>
                  <line x1="140" y1="300" x2="260" y2="300" stroke="#CCFF00" strokeWidth="12" strokeLinecap="square" />
                </g>
              </g>

            </svg>
          </div>

          <div className="absolute bottom-0 text-center font-mono-data shrink-0">
            <div className="text-[10px] xl:text-xs tracking-[0.4em] text-[#666]">SYSTEM_STATE</div>
            <div className="text-lg xl:text-xl font-bold text-white tracking-wider">
              {isSpeaking ? 'ENGAGING_TARGET' : 'ANALYZING_INPUT'}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Extracted Data Feed */}
        <div className="lg:col-span-3 flex flex-col min-h-0 pr-2 overflow-hidden">
          <div className="flex justify-between items-end mb-2 border-b-2 border-[#333] pb-2 shrink-0">
            <h2 className="font-display text-xl lg:text-2xl text-white">DATA_EXTRACTION</h2>
            <span className="font-mono-data text-[10px] lg:text-xs text-[#CCFF00] animate-pulse">LIVE_FEED.REC</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide pb-4 min-h-0">
            {extractedData.length === 0 && (
              <div className="text-[#444] text-xs text-center mt-6 border border-dashed border-[#333] py-6">
                AWAITING INTEL...
              </div>
            )}

            {extractedData.map((data, index) => (
              <div key={data.id} className={`data-card bg-[#111] p-3 ${index === 0 ? 'hard-shadow-acid' : 'border border-[#333]'}`}>
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-[#888] text-[10px]">ID:{data.id.toString().padStart(4, '0')}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-none font-bold ${data.confidence === 'CRITICAL' ? 'bg-[#FF3300] text-white' : 'bg-[#CCFF00] text-black'
                    }`}>
                    {data.type}
                  </span>
                </div>
                <div className="text-[#E0E0E0] text-xs lg:text-sm break-words font-bold mb-2">
                  {data.value}
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-[#555]">CONF:</span>
                  <span className="text-white bg-[#222] px-1.5 py-0.5">
                    {data.confidence}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activePersona && (
        <div className="absolute bottom-4 right-4 lg:right-8 bg-[#111] border border-[#333] p-2 text-right z-50">
          <div className="text-[9px] text-[#666] tracking-widest mb-1">ACTIVE_PERSONA</div>
          <div className="text-xs text-[#CCFF00] font-bold">{activePersona}</div>
          {activeVoice && <div className="text-[10px] text-[#888] mt-0.5">V_ID: {activeVoice}</div>}
        </div>
      )}

    </div>
  );
};

export default ScamHoneypot;