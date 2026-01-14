import React, { useState, useEffect, useRef } from 'react';
import { Loader2, X, Terminal, SquareTerminal, Sparkles, StopCircle, Check } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  isProcessing: boolean;
  onCancel: () => void;
  onClose: () => void;
  logs: string[];
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
}

const FLAVOR_TEXTS = [
  "Consulting the Oracle...",
  "Aligning vectors...",
  "Diffusion in progress...",
  "Mixing pixels...",
  "Teaching the AI to dream...",
  "Applying cinematic lighting...",
  "Rasterizing thoughts...",
  "Calculating aesthetics...",
  "Adding serendipity...",
  "Polishing pixels..."
];

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
    isVisible, 
    isProcessing,
    onCancel,
    onClose,
    logs,
    showDebug,
    setShowDebug
}) => {
  const [flavorText, setFlavorText] = useState(FLAVOR_TEXTS[0]);
  const [elapsed, setElapsed] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  // Cycle flavor text and manage timer
  useEffect(() => {
    if (!isVisible || !isProcessing) {
        if (!isVisible) setElapsed(0);
        return;
    }
    
    // Set start time for accurate wall-clock measurement
    startTimeRef.current = Date.now();
    setFlavorText(FLAVOR_TEXTS[Math.floor(Math.random() * FLAVOR_TEXTS.length)]);

    const textInterval = setInterval(() => {
      setFlavorText(FLAVOR_TEXTS[Math.floor(Math.random() * FLAVOR_TEXTS.length)]);
    }, 2500);

    const timerInterval = setInterval(() => {
        // Calculate exact elapsed time based on system clock
        // This prevents the timer from pausing/drifting if the tab is backgrounded
        const now = Date.now();
        setElapsed((now - startTimeRef.current) / 1000);
    }, 100);

    return () => {
      clearInterval(textInterval);
      clearInterval(timerInterval);
    };
  }, [isVisible, isProcessing]);

  // Auto-scroll logs
  useEffect(() => {
    if (showDebug && logEndRef.current) {
        logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showDebug]);

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-lg p-6 flex flex-col items-center">
        
        {isProcessing ? (
            <>
                {/* Visual Loader */}
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-pink-500 blur-xl opacity-20 animate-pulse"></div>
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <Loader2 className="w-16 h-16 text-pink-500 animate-spin" strokeWidth={1.5} />
                        <Sparkles className="absolute w-6 h-6 text-white animate-pulse" />
                    </div>
                </div>

                {/* Status Text */}
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500 mb-2 text-center transition-all duration-500 min-h-[1.75rem]">
                    {flavorText}
                </h2>
                <p className="text-neutral-500 text-xs font-mono mb-8">
                    {elapsed.toFixed(1)}s elapsed
                </p>

                {/* Cancel Button */}
                <button 
                    onClick={onCancel}
                    className="group flex items-center gap-2 px-6 py-2 bg-neutral-900 border border-neutral-800 hover:border-red-500/50 hover:bg-red-500/10 rounded-full transition-all duration-300 mb-8"
                >
                    <StopCircle size={16} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
                    <span className="text-sm font-medium text-neutral-300 group-hover:text-red-400">Stop Generation</span>
                </button>
            </>
        ) : (
            <>
                {/* Success State */}
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-green-500 blur-xl opacity-20"></div>
                    <div className="relative w-16 h-16 rounded-full bg-neutral-900 border border-green-500/30 flex items-center justify-center">
                        <Check className="w-8 h-8 text-green-500" strokeWidth={3} />
                    </div>
                </div>

                <h2 className="text-xl font-bold text-white mb-2 text-center">
                    Generation Complete
                </h2>
                <p className="text-neutral-500 text-xs mb-8 text-center max-w-xs">
                    The image has been generated successfully. Review debug logs below or close to continue.
                </p>

                <button 
                    onClick={onClose}
                    className="flex items-center gap-2 px-8 py-3 bg-neutral-200 hover:bg-white text-black font-bold rounded-full transition-all duration-300 mb-8 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] transform hover:scale-105"
                >
                    <X size={18} /> Close Overlay
                </button>
            </>
        )}

        {/* Debug Toggle */}
        <div className="w-full">
            <button 
                onClick={() => setShowDebug(!showDebug)}
                className="flex items-center gap-2 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors mx-auto mb-2"
            >
                <SquareTerminal size={12} />
                {showDebug ? 'Hide' : 'Show'} Debug Console
            </button>

            {/* Console Output */}
            {showDebug && (
                <div className="w-full bg-black border border-neutral-800 rounded-md p-3 shadow-2xl animate-in slide-in-from-bottom-2 fade-in">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-neutral-900">
                        <span className="text-[10px] font-bold text-neutral-400 flex items-center gap-1">
                            <Terminal size={10} /> API LOGS
                        </span>
                        <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500/20"></div>
                            <div className="w-2 h-2 rounded-full bg-yellow-500/20"></div>
                            <div className="w-2 h-2 rounded-full bg-green-500/20"></div>
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar font-mono text-[9px] leading-relaxed text-green-500/90 whitespace-pre-wrap">
                        {logs.length === 0 ? "// Waiting for logs..." : logs.map((log, i) => (
                            <div key={i} className="mb-1">{log}</div>
                        ))}
                        <div ref={logEndRef} />
                        <div className="animate-pulse mt-1 inline-block w-2 h-3 bg-green-500/50"></div>
                    </div>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default LoadingOverlay;