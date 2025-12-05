

import React, { useState, useRef, useEffect } from 'react';
import { X, MousePointer2, Settings, Cloud, Key, Check, Loader2, Terminal } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onSettingsChange 
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'services'>('general');
  
  // Validation State
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [validationMsg, setValidationMsg] = useState('');
  
  // Debug State
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugLog, setDebugLog] = useState('');
  
  // Input State
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isInputFocused && inputRef.current) {
        inputRef.current.focus();
    }
  }, [isInputFocused]);

  if (!isOpen) return null;

  const toggleZoom = () => {
    onSettingsChange({ ...settings, enableZoom: !settings.enableZoom });
  };

  const updateApiKey = (key: string) => {
    onSettingsChange({ ...settings, googleApiKey: key });
    setValidationStatus('idle');
    setValidationMsg('');
  };

  const handleValidateKey = async () => {
    if (!settings.googleApiKey.trim()) return;

    setIsValidating(true);
    setValidationStatus('idle');
    setValidationMsg('');
    setDebugLog('');

    const logs: string[] = [];
    const addLog = (msg: string) => logs.push(msg);
    const timestamp = new Date().toISOString();

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.googleApiKey}`;
        addLog(`[${timestamp}] Initiating Validation Request...`);
        addLog(`POST ${endpoint.replace(settings.googleApiKey, 'API_KEY_HIDDEN')}`);
        
        const payload = { 
            contents: [{ parts: [{ text: "ping" }] }],
            generationConfig: { maxOutputTokens: 1 }
        };
        addLog(`Payload: ${JSON.stringify(payload, null, 2)}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        addLog(`Status: ${response.status} ${response.statusText}`);
        
        const responseText = await response.text();
        let responseData;
        try {
            responseData = JSON.parse(responseText);
            addLog(`Response Body: ${JSON.stringify(responseData, null, 2)}`);
        } catch (e) {
            addLog(`Response Body (Raw): ${responseText}`);
        }

        if (!response.ok) {
            const errorMsg = responseData?.error?.message || `API returned ${response.status}`;
            throw new Error(errorMsg);
        }

        setValidationStatus('success');
        setIsInputFocused(false); // Obfuscate on success
        addLog(`Validation Successful.`);
    } catch (error: any) {
        console.error("API Validation Failed:", error);
        addLog(`Error: ${error.message}`);
        setValidationStatus('error');
        setValidationMsg(error.message || "Validation failed. Check console for details.");
    } finally {
        setIsValidating(false);
        setDebugLog(logs.join('\n\n'));
    }
  };

  const getMaskedKey = (key: string) => {
      if (!key) return '';
      if (key.length <= 8) return '••••••••';
      return `${key.slice(0, 3)}••••••••••••••••••••••••${key.slice(-3)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-sm shadow-2xl transform transition-all scale-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">Studio Settings</h2>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/50">
            <button
                onClick={() => setActiveTab('general')}
                className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                    activeTab === 'general' 
                    ? 'text-white bg-neutral-800 border-b-2 border-pink-500' 
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
                }`}
            >
                <Settings size={14} /> General
            </button>
            <button
                onClick={() => setActiveTab('services')}
                className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                    activeTab === 'services' 
                    ? 'text-white bg-neutral-800 border-b-2 border-pink-500' 
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
                }`}
            >
                <Cloud size={14} /> AI Services
            </button>
        </div>

        {/* Body */}
        <div className="p-6 h-[22rem] overflow-y-auto custom-scrollbar">
          
          {activeTab === 'general' && (
            <div className="space-y-6 animate-in slide-in-from-left-2 fade-in duration-200">
                {/* Option: Mouse Wheel Zoom */}
                <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-[3px] ${settings.enableZoom ? 'bg-pink-500/10 text-pink-500' : 'bg-neutral-800 text-neutral-500'}`}>
                            <MousePointer2 size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-white">Canvas Zoom</h3>
                            <p className="text-xs text-neutral-500">Use scroll wheel to zoom in/out</p>
                        </div>
                    </div>
                    
                    {/* Toggle Switch */}
                    <button 
                        onClick={toggleZoom}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${settings.enableZoom ? 'bg-pink-500' : 'bg-neutral-700'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${settings.enableZoom ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-6 animate-in slide-in-from-right-2 fade-in duration-200">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                        <Key size={14} /> Gemini API Key
                    </label>
                    
                    <div className="relative">
                        {isInputFocused || !settings.googleApiKey ? (
                            <input 
                                ref={inputRef}
                                type="text"
                                value={settings.googleApiKey}
                                onChange={(e) => updateApiKey(e.target.value)}
                                onFocus={() => setIsInputFocused(true)}
                                placeholder="Enter your API Key..."
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2.5 text-sm text-white focus:outline-none focus:border-pink-500 transition-colors placeholder:text-neutral-700 font-mono"
                            />
                        ) : (
                            <div 
                                onClick={() => setIsInputFocused(true)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2.5 text-sm text-neutral-300 font-mono cursor-text hover:border-neutral-700 transition-colors select-none"
                            >
                                {getMaskedKey(settings.googleApiKey)}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex flex-col gap-3 mt-2">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleValidateKey}
                                disabled={!settings.googleApiKey || isValidating}
                                className={`px-3 py-1.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wide border transition-all ${
                                    !settings.googleApiKey 
                                    ? 'bg-neutral-900 border-neutral-800 text-neutral-600 cursor-not-allowed' 
                                    : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:text-white'
                                }`}
                            >
                                {isValidating ? 'Validating...' : 'Check API Key'}
                            </button>
                            
                            {isValidating && <Loader2 size={16} className="text-neutral-500 animate-spin" />}
                            {!isValidating && validationStatus === 'success' && <Check size={16} className="text-green-500" />}
                            {!isValidating && validationStatus === 'error' && <X size={16} className="text-red-500" />}
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsDebugMode(!isDebugMode)}
                                className={`w-3 h-3 rounded-[2px] border flex items-center justify-center transition-colors ${isDebugMode ? 'bg-pink-500 border-pink-500' : 'border-neutral-700 bg-neutral-900'}`}
                            >
                                {isDebugMode && <Check size={10} className="text-white" />}
                            </button>
                            <label onClick={() => setIsDebugMode(!isDebugMode)} className="text-[10px] text-neutral-500 cursor-pointer select-none hover:text-neutral-300 transition-colors flex items-center gap-1">
                                <Terminal size={10} /> Debug Mode
                            </label>
                        </div>
                    </div>

                    {validationStatus === 'error' && !isDebugMode && (
                        <p className="text-[10px] text-red-500 mt-1 break-words leading-tight">{validationMsg}</p>
                    )}

                    {isDebugMode && (
                        <div className="mt-2 relative">
                             <div className="absolute top-0 right-0 p-1">
                                <span className="text-[9px] text-neutral-600 bg-neutral-900 border border-neutral-800 px-1 rounded">LOG</span>
                             </div>
                             <pre className="w-full h-32 bg-black border border-neutral-800 rounded-[3px] p-2 text-[9px] font-mono text-green-500/90 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                                {debugLog || "// Waiting for validation request..."}
                             </pre>
                        </div>
                    )}

                    {!isDebugMode && (
                        <p className="text-[10px] text-neutral-500 leading-relaxed mt-2 pt-2 border-t border-neutral-800/50">
                            Leave blank to use the default system key. Providing your own key allows for personal quota usage.
                        </p>
                    )}
                </div>
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 text-center">
            <p className="text-[10px] text-neutral-600">///textrot studio v1.1</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;