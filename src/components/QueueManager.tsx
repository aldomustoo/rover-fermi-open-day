import React from 'react';
import { Clock, UserCheck, Users, ArrowRight, UserX, Award } from 'lucide-react';
import type { QueueState } from '../types';

interface QueueManagerProps {
  queueState: QueueState;
  myId: string;
  myTabletName: string;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
}

export const QueueManager: React.FC<QueueManagerProps> = ({
  queueState,
  myId,
  myTabletName,
  onJoinQueue,
  onLeaveQueue,
}) => {
  const isMyTurn = queueState.activePilotId === myId;
  const queueIndex = queueState.queue.findIndex((q) => q.id === myId);
  const isInQueue = queueIndex !== -1;

  const totalTime = queueState.slotDurationSec || 45;
  const progressPercent = Math.max(0, Math.min(100, (queueState.timeRemainingSec / totalTime) * 100));

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl flex flex-col justify-between gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-sm sm:text-base text-slate-100">
            Gestione Turni Pilota (6 Tablet)
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-950/60 px-2.5 py-1 rounded-full border border-slate-800">
          <Users className="w-3.5 h-3.5 text-cyan-400" />
          <span>In coda: {queueState.queue.length}</span>
        </div>
      </div>

      {/* Main Status Display */}
      {isMyTurn ? (
        <div className="bg-gradient-to-r from-emerald-950/60 to-teal-950/60 border border-emerald-500/50 rounded-xl p-4 flex flex-col gap-3 shadow-lg shadow-emerald-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black animate-bounce shadow-md">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Accesso Esclusivo Ai Comandi
                </span>
                <h4 className="font-extrabold text-base sm:text-lg text-white">
                  Tocca a te! ({myTabletName})
                </h4>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-emerald-300">
                {queueState.timeRemainingSec}s
              </span>
              <p className="text-[10px] font-mono text-emerald-400/80">rimanenti</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden border border-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <button
            onClick={onLeaveQueue}
            className="w-full py-2.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-900/70 border border-emerald-600/50 text-emerald-200 text-xs font-bold transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            <UserX className="w-4 h-4" />
            <span>Cedi Turno Al Prossimo Studente</span>
          </button>
        </div>
      ) : isInQueue ? (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold text-sm">
                #{queueIndex + 1}
              </div>
              <div>
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                  Sei in coda
                </span>
                <p className="text-sm font-bold text-slate-100">
                  Tocca a te tra circa ~{(queueIndex * totalTime) + queueState.timeRemainingSec}s
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300">
            Attualmente guida:{' '}
            <span className="font-bold text-amber-300">
              {queueState.activePilotName || 'Nessuno'}
            </span>
            . Il tuo tablet riceverà il controllo automaticamente al termine del turno!
          </p>

          <button
            onClick={onLeaveQueue}
            className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
          >
            Esci Dalla Coda
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Active pilot status */}
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-slate-400">Pilota in carica:</span>
              <span className="font-bold text-cyan-300">
                {queueState.activePilotName || 'Nessuno (Rover fermo)'}
              </span>
            </div>
            {queueState.activePilotId && (
              <span className="font-mono text-slate-400">
                {queueState.timeRemainingSec}s rimasti
              </span>
            )}
          </div>

          {/* Join Queue CTA Button */}
          <button
            onClick={onJoinQueue}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-sm tracking-wide shadow-lg shadow-cyan-500/25 transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 border border-cyan-400/40"
          >
            <UserCheck className="w-5 h-5 text-white" />
            <span>PRENOTA TURNO DI GUIDA ({totalTime}s)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Visual Queue list */}
      <div className="border-t border-slate-800 pt-3">
        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
          Postazioni Tablet in Linea:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {queueState.activePilotName && (
            <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              {queueState.activePilotName} (Guida)
            </span>
          )}
          {queueState.queue.map((item, idx) => (
            <span
              key={item.id}
              className={`text-xs px-2.5 py-1 rounded-md border font-mono ${
                item.id === myId
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
              }`}
            >
              #{idx + 1} {item.name}
            </span>
          ))}
          {!queueState.activePilotName && queueState.queue.length === 0 && (
            <span className="text-xs text-slate-500 italic">
              Nessun tablet in coda al momento.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
