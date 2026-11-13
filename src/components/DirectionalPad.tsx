import React, { useState, useEffect, useRef } from 'react';
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
  const activePointerId = useRef<number | null>(null);

  const startMove = (
    direction: 'forward' | 'backward' | 'left' | 'right',
    e?: React.PointerEvent
  ) => {
    if (!enabled) return;
    if (e) {
      e.preventDefault();
      activePointerId.current = e.pointerId;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    setActiveBtn(direction);

    switch (direction) {
      case 'forward':
        onDriveCommand(100, 100);
        break;
      case 'backward':
        onDriveCommand(-90, -90);
        break;
      case 'left':
        onDriveCommand(-85, 85); // Spin in place left
        break;
      case 'right':
        onDriveCommand(85, -85); // Spin in place right
        break;
    }
  };

  const endMove = (e?: React.PointerEvent) => {
    if (e && activePointerId.current !== null && activePointerId.current !== e.pointerId) {
      return;
    }
    activePointerId.current = null;
    setActiveBtn(null);
    onStop();
  };

  // Keyboard support (WASD / Arrow keys) for PC/Mac testing
  useEffect(() => {
    if (!enabled) {
      setActiveBtn(null);
      return;
    }

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      switch (ev.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          ev.preventDefault();
          startMove('forward');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          ev.preventDefault();
          startMove('backward');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          ev.preventDefault();
          startMove('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          ev.preventDefault();
          startMove('right');
          break;
        case ' ':
          ev.preventDefault();
          endMove();
          break;
      }
    };

    const onKeyUp = (ev: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(
          ev.key
        )
      ) {
        endMove();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled]);

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
          onPointerDown={(e) => startMove('forward', e)}
          onPointerUp={endMove}
          onPointerCancel={endMove}
          className={`rounded-xl border flex flex-col items-center justify-center transition touch-none select-none cursor-pointer ${
            activeBtn === 'forward'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/40 scale-95'
              : enabled
              ? 'bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border-slate-700'
              : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
          }`}
          title="Avanti (W / ↑)"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
        <div />

        {/* Row 2: Left, Stop/Center, Right */}
        <button
          type="button"
          disabled={!enabled}
          onPointerDown={(e) => startMove('left', e)}
          onPointerUp={endMove}
          onPointerCancel={endMove}
          className={`rounded-xl border flex flex-col items-center justify-center transition touch-none select-none cursor-pointer ${
            activeBtn === 'left'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/40 scale-95'
              : enabled
              ? 'bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border-slate-700'
              : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
          }`}
          title="Ruota Sinistra (A / ←)"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <button
          type="button"
          disabled={!enabled}
          onClick={() => endMove()}
          className={`rounded-xl border flex flex-col items-center justify-center transition active:scale-95 touch-none select-none ${
            enabled
              ? 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 border-rose-800/60 cursor-pointer'
              : 'bg-slate-900/50 text-slate-700 border-slate-800 cursor-not-allowed'
          }`}
          title="Stop Motori (Spazio)"
        >
          <Square className="w-5 h-5 fill-current" />
        </button>

        <button
          type="button"
          disabled={!enabled}
          onPointerDown={(e) => startMove('right', e)}
          onPointerUp={endMove}
          onPointerCancel={endMove}
          className={`rounded-xl border flex flex-col items-center justify-center transition touch-none select-none cursor-pointer ${
            activeBtn === 'right'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/40 scale-95'
              : enabled
              ? 'bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border-slate-700'
              : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
          }`}
          title="Ruota Destra (D / →)"
        >
          <ArrowRight className="w-6 h-6" />
        </button>

        {/* Row 3: Backward in center */}
        <div />
        <button
          type="button"
          disabled={!enabled}
          onPointerDown={(e) => startMove('backward', e)}
          onPointerUp={endMove}
          onPointerCancel={endMove}
          className={`rounded-xl border flex flex-col items-center justify-center transition touch-none select-none cursor-pointer ${
            activeBtn === 'backward'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/40 scale-95'
              : enabled
              ? 'bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border-slate-700'
              : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
          }`}
          title="Indietro (S / ↓)"
        >
          <ArrowDown className="w-6 h-6" />
        </button>
        <div />
      </div>

      <span className="text-[11px] font-mono text-slate-500 mt-2">
        {enabled ? 'Tieni premuto (o WASD / Frecce)' : 'Comandi in standby'}
      </span>
    </div>
  );
};
