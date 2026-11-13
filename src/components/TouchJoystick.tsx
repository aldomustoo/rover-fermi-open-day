import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Navigation } from 'lucide-react';

interface TouchJoystickProps {
  enabled: boolean;
  onDriveCommand: (left: number, right: number) => void;
  onStop: () => void;
}

export const TouchJoystick: React.FC<TouchJoystickProps> = ({
  enabled,
  onDriveCommand,
  onStop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const maxRadius = 55; // pixels radius for joystick boundary

  const updatePosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;

      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > maxRadius) {
        dx = (dx / distance) * maxRadius;
        dy = (dy / distance) * maxRadius;
      }

      setKnobPos({ x: dx, y: dy });

      // Convert to normalized coordinates:
      // x: -1 (full left) to +1 (full right)
      // y: +1 (full forward) to -1 (full reverse) -> note screen Y is inverted
      const normX = dx / maxRadius;
      const normY = -dy / maxRadius;

      // Differential Drive equation (tank steering for L298N):
      // Left = Forward + Turn
      // Right = Forward - Turn
      let left = normY + normX * 0.85;
      let right = normY - normX * 0.85;

      // Normalize if exceeding 1.0
      const maxVal = Math.max(Math.abs(left), Math.abs(right));
      if (maxVal > 1.0) {
        left /= maxVal;
        right /= maxVal;
      }

      const leftPercent = Math.round(left * 100);
      const rightPercent = Math.round(right * 100);

      onDriveCommand(leftPercent, rightPercent);
    },
    [maxRadius, onDriveCommand]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!enabled) return;
    activePointerId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    updatePosition(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || activePointerId.current !== e.pointerId) return;
    updatePosition(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activePointerId.current === e.pointerId) {
      activePointerId.current = null;
      setIsDragging(false);
      setKnobPos({ x: 0, y: 0 });
      onStop();
    }
  };

  useEffect(() => {
    if (!enabled && isDragging) {
      setIsDragging(false);
      setKnobPos({ x: 0, y: 0 });
      onStop();
    }
  }, [enabled, isDragging, onStop]);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 mb-2">
        <Navigation className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-semibold uppercase tracking-wider">Joystick Tattile</span>
      </div>

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-36 h-36 sm:w-40 sm:h-40 rounded-full border-2 transition-all flex items-center justify-center touch-none select-none ${
          enabled
            ? isDragging
              ? 'border-emerald-400/80 bg-slate-900/90 shadow-lg shadow-emerald-500/20'
              : 'border-cyan-500/50 bg-slate-900/60 shadow-inner'
            : 'border-slate-800 bg-slate-950/80 opacity-50 cursor-not-allowed'
        }`}
      >
        {/* Crosshair guidelines */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-px bg-slate-800/80" />
          <div className="absolute h-full w-px bg-slate-800/80" />
        </div>

        {/* Center resting ring */}
        <div className="w-10 h-10 rounded-full border border-slate-700/60 pointer-events-none" />

        {/* Dynamic Draggable Knob */}
        <div
          className={`absolute w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center shadow-2xl transition-transform ${
            isDragging ? 'duration-0' : 'duration-200 ease-out'
          } ${
            enabled
              ? isDragging
                ? 'bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 shadow-emerald-500/40 scale-105'
                : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-500/30'
              : 'bg-slate-800 text-slate-500'
          }`}
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          }}
        >
          <div className="w-6 h-6 rounded-full border-2 border-white/40 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
        </div>
      </div>

      <span className="text-[11px] font-mono text-slate-500 mt-2">
        {enabled
          ? isDragging
            ? 'Trascinando • Motori attivi'
            : 'Tocca e trascina per guidare'
          : 'Controlli bloccati (In coda)'}
      </span>
    </div>
  );
};
