import React, { useState } from 'react';
import { Lightbulb, Zap, Power, Radio } from 'lucide-react';
import type { ShellyState } from '../types';
import { playRelayClick } from '../services/sound';

interface ShellyCardProps {
  shellyState: ShellyState;
  onToggle: () => Promise<void>;
}

export const ShellyCard: React.FC<ShellyCardProps> = ({ shellyState, onToggle }) => {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    if (isToggling) return;
    setIsToggling(true);
    playRelayClick(!shellyState.isOn);
    try {
      await onToggle();
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl flex flex-col justify-between gap-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              shellyState.isOn
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
              <span>Lampada Stand Shelly 1</span>
            </h3>
            <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <span>Pannello Dimostrativo</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400">{shellyState.ip}</span>
            </p>
          </div>
        </div>

        {/* Live sync pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border ${
            shellyState.reachable
              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
              : 'bg-blue-950/50 text-cyan-300 border-cyan-800/60'
          }`}
        >
          <Radio className="w-3 h-3 text-current animate-pulse" />
          <span>{shellyState.reachable ? 'ONLINE (LAN)' : 'SYNC ATTIVO'}</span>
        </div>
      </div>

      {/* Center Visual Lamp Status */}
      <div className="flex items-center justify-center py-2 sm:py-3">
        <div
          className={`relative rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-center transition-all duration-300 w-full max-w-xs ${
            shellyState.isOn
              ? 'bg-gradient-to-b from-amber-500/20 to-amber-950/20 border border-amber-500/40 shadow-2xl shadow-amber-500/15'
              : 'bg-slate-950/60 border border-slate-800/80 shadow-inner'
          }`}
        >
          {/* Glowing Halo */}
          {shellyState.isOn && (
            <div className="absolute w-32 h-32 rounded-full bg-amber-400/25 blur-2xl pointer-events-none animate-pulse" />
          )}

          <div
            className={`relative z-10 transition-transform duration-300 ${
              shellyState.isOn ? 'scale-110 drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]' : 'scale-100 opacity-60'
            }`}
          >
            <Lightbulb
              className={`w-16 h-16 sm:w-20 sm:h-20 transition-colors ${
                shellyState.isOn ? 'text-amber-300 fill-amber-300' : 'text-slate-600 fill-slate-800'
              }`}
            />
          </div>

          <div className="mt-3 text-center z-10">
            <span
              className={`text-xs sm:text-sm font-black tracking-widest uppercase font-mono px-3 py-1 rounded-full border ${
                shellyState.isOn
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {shellyState.isOn ? '⚡ ACCESA' : 'SPENTA'}
            </span>
            <p className="text-[11px] font-mono text-slate-400 mt-1.5">
              Relè Shelly 1 • Contatto Pulito 230V
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Large Push Toggle Button */}
      <button
        onClick={handleToggle}
        disabled={isToggling}
        className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 transition active:scale-[0.98] cursor-pointer shadow-lg select-none ${
          shellyState.isOn
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/25 border border-amber-300'
            : 'bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-slate-100 shadow-slate-950/50 border border-slate-600'
        }`}
      >
        <Power className={`w-5 h-5 ${shellyState.isOn ? 'text-slate-950' : 'text-cyan-400'}`} />
        <span>
          {isToggling
            ? 'Invio segnale...'
            : shellyState.isOn
            ? 'SPEGNI LAMPADA'
            : 'ACCENDI LAMPADA'}
        </span>
      </button>
    </div>
  );
};
