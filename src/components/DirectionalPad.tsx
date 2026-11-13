import React, { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square } from 'lucide-react';

interface DirectionalPadProps {
  enabled: boolean;
  onDriveCommand: (left: number, right: number) => void;
  onStop: () => void;
}

export const DirectionalPad: React.FC<DirectionalPadProps> = ({
  enabled,
  onDriveCommand,
  onStop,
}) => {
  const [activeBtn, setActiveBtn] = useState<string | null>(null);

  const startMove = (direction: 'forward' | 'backward' | 'left' | 'right') => {
    if (!enabled) return;
    setActiveBtn(direction);

    switch (direction) {
      case 'forward':
        onDriveCommand(90, 90);
        break;
      case 'backward':
        onDriveCommand(-80, -80);
        break;
      case 'left':
        onDriveCommand(-80, 80); // Spin in place left
        break;
      case 'right':
        onDriveCommand(80, -80); // Spin in place right
        break;
    }
  };

  const endMove = () => {
    setActiveBtn(null);
    onStop();
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 mb-2">
        <span className="font-semibold uppercase tracking-wider">Tasti Direzionali</span>
      </div>

      <div className="grid grid-cols-3 gap-2 w-36 h-36 sm:w-40 sm:h-40">
        {/* Row 1: Forward in center */}
        <div />
        <button
          type="button"
          disabled={!enabled}
          onPointerDown={() => startMove('forward')}
          onPointerUp={endMove}
          onPointerCancel={endMove}
          onPointerLeave={endMove}
          className={`rounded-xl border flex flex-col items-center justify-center transition active:scale-95 touch-none select-none cursor-pointer ${
            activeBtn === 'forward'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/40'
              : enabled
              ? 'bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border-slate-700'
              : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
          }`}
          title="Avanti"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
        <div />

        {/* Row 2: Left, Stop/Center, Right */}
        <button
          type="button"
          disabled={!enabled}
          onPointerDown={() => startMove('left')}
          onPointerUp={endMove}
          onPointerCancel={endMove}
          onPointerLeave={endMove}
          className={`rounded-xl border flex flex-col items-center justify-center transition active:scale-95 touch-none select-none cursor-pointer ${
            activeBtn === 'left'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/40'
              : enabled
              ? 'bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border-slate-700'
              : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
          }`}
          title="Ruota Sinistra"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <button
          type="button"
          disabled={!enabled}
          onClick={endMove}
          className={`rounded-xl border flex flex-col items-center justify-center transition active:scale-95 touch-none select-none ${
            enabled
              ? 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 border-rose-800/60 cursor-pointer'
              : 'bg-slate-900/50 text-slate-700 border-slate-800 cursor-not-allowed'
          }`}
          title="Stop Motori"
        >
          <Square className="w-5 h-5 fill-current" />
        </button>

        <button
          type="button"
          disabled={!enabled}
          onPointerDown={() => startMove('right')}
          onPointerUp={endMove}
          onPointerCancel={endMove}
          onPointerLeave={endMove}
          className={`rounded-xl border flex flex-col items-center justify-center transition active:scale-95 touch-none select-none cursor-pointer ${
            activeBtn === 'right'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/40'
              : enabled
              ? 'bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border-slate-700'
              : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
          }`}
          title="Ruota Destra"
        >
          <ArrowRight className="w-6 h-6" />
        </button>

        {/* Row 3: Backward in center */}
        <div />
        <button
          type="button"
          disabled={!enabled}
          onPointerDown={() => startMove('backward')}
          onPointerUp={endMove}
          onPointerCancel={endMove}
          onPointerLeave={endMove}
          className={`rounded-xl border flex flex-col items-center justify-center transition active:scale-95 touch-none select-none cursor-pointer ${
            activeBtn === 'backward'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/40'
              : enabled
              ? 'bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border-slate-700'
              : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
          }`}
          title="Indietro"
        >
          <ArrowDown className="w-6 h-6" />
        </button>
        <div />
      </div>

      <span className="text-[11px] font-mono text-slate-500 mt-2">
        {enabled ? 'Tieni premuto per muovere' : 'Comandi in standby'}
      </span>
    </div>
  );
};
