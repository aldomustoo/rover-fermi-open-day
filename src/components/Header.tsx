import React from 'react';
import { Wifi, WifiOff, Cpu, Tablet, ShieldAlert, Lock, BookOpen } from 'lucide-react';
import type { RobotState } from '../types';

interface HeaderProps {
  wsConnected: boolean;
  pingMs: number;
  robotState: RobotState;
  tabletsCount: number;
  myTabletName: string;
  onSelectTabletName: (name: string) => void;
  onOpenDocs: () => void;
  onOpenTeacherModal: () => void;
  onEmergencyStop: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  wsConnected,
  pingMs,
  robotState,
  tabletsCount,
  myTabletName,
  onSelectTabletName,
  onOpenDocs,
  onOpenTeacherModal,
  onEmergencyStop,
}) => {
  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 px-3 py-2 sm:px-6 sm:py-3 sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-cyan-500/20 border border-cyan-400/30">
            EF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                I.S. ENRICO FERMI
              </span>
              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 uppercase tracking-wider">
                Mantova
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 font-mono tracking-tight flex items-center gap-1.5">
              <span>Telecomunicazioni & Robotica</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-semibold">Open Day 2025</span>
            </p>
          </div>
        </div>

        {/* Status Indicators Pill */}
        <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
          {/* Server & Ping */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
            {wsConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300">LAN</span>
                <span className="text-cyan-400 font-bold">{pingMs}ms</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-400 font-semibold">Server Offline</span>
              </>
            )}
          </div>

          {/* Robot Connection */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors ${
              robotState.connected
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-amber-950/30 border-amber-800/50 text-amber-300'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>ROBOT:</span>
            <span className="font-bold">
              {robotState.connected ? 'ONLINE' : 'ATTESA PI'}
            </span>
            {robotState.connected && (
              <span className="text-[10px] text-emerald-400/80 hidden sm:inline">
                ({robotState.cpuTemp}°C)
              </span>
            )}
          </div>

          {/* Connected Tablets count */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
            <Tablet className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={myTabletName}
              onChange={(e) => onSelectTabletName(e.target.value)}
              className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer text-xs"
              title="Seleziona la postazione di questo tablet"
            >
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <option key={num} value={`Tablet #${num}`} className="bg-slate-900 text-white">
                  Tablet #{num}
                </option>
              ))}
            </select>
            <span className="text-slate-500 hidden sm:inline">({tabletsCount} attivi)</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Docs / Wiring guide */}
          <button
            onClick={onOpenDocs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition active:scale-95 cursor-pointer shadow-sm"
            title="Guida cablaggio L298N, codice Python e schema elettrico"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Guida Hardware</span>
          </button>

          {/* Teacher Unlock */}
          <button
            onClick={onOpenTeacherModal}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95 cursor-pointer"
            title="Pannello Docenti / Supervisori (PIN protetto)"
          >
            <Lock className="w-4 h-4 text-amber-400" />
          </button>

          {/* Emergency Stop Button */}
          <button
            onClick={onEmergencyStop}
            className="flex items-center gap-1.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider border border-red-500/50 shadow-md shadow-rose-900/40 transition active:scale-90 cursor-pointer animate-pulse"
          >
            <ShieldAlert className="w-4 h-4 text-white" />
            <span className="hidden xs:inline">E-STOP</span>
          </button>
        </div>
      </div>
    </header>
  );
};
