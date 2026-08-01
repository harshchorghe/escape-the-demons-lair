"use client";

import React, { useState } from "react";
import { pythonApi } from "@/lib/pythonApi";
import { Server, CheckCircle, AlertTriangle, X } from "lucide-react";

interface PythonConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonConfigModal: React.FC<PythonConfigModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [url, setUrl] = useState(pythonApi.getBaseUrl());
  const [status, setStatus] = useState<{ type: 'idle' | 'testing' | 'online' | 'offline'; message: string }>({
    type: 'idle',
    message: ''
  });

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setStatus({ type: 'testing', message: 'Testing connection to Python server...' });
    pythonApi.setBaseUrl(url);
    const result = await pythonApi.checkHealth();
    setStatus({ type: result.status, message: result.message });
  };

  const handleSave = () => {
    pythonApi.setBaseUrl(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-950 border border-red-900/60 rounded-2xl p-6 shadow-2xl text-zinc-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 text-red-500">
          <Server className="w-6 h-6" />
          <h3 className="text-xl font-mono font-bold tracking-wide">
            Python API Backend Sync
          </h3>
        </div>

        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
          Your team member can run the Python Backend API to serve dynamic puzzles, riddles, coding challenges, and verification logic.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-300 uppercase mb-1">
              Python API Server URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:5000"
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500 text-zinc-100 font-mono text-sm px-3 py-2 rounded-lg outline-none transition-all"
            />
          </div>

          {status.message && (
            <div
              className={`p-3 rounded-lg text-xs font-mono flex items-center gap-2 border ${
                status.type === 'online'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : status.type === 'offline'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300'
              }`}
            >
              {status.type === 'online' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : status.type === 'offline' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
              )}
              <span>{status.message}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTestConnection}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono py-2.5 rounded-lg font-semibold transition-colors"
            >
              Test Connection
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-red-700 hover:bg-red-600 text-white text-xs font-mono py-2.5 rounded-lg font-semibold transition-colors shadow-lg shadow-red-950/50"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
