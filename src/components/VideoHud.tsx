import React, { useEffect, useRef, useState } from 'react';
import { Camera, Radio, Compass, BatteryCharging, Gauge, Maximize2 } from 'lucide-react';
import type { RobotState } from '../types';

interface VideoHudProps {
  robotState: RobotState;
  isMyTurn: boolean;
  activePilotName: string | null;
  timeRemainingSec: number;
  camStreamUrl?: string;
  leftMotorSpeed: number;
  rightMotorSpeed: number;
}

export const VideoHud: React.FC<VideoHudProps> = ({
  robotState,
  isMyTurn,
  activePilotName,
  timeRemainingSec,
  camStreamUrl,
  leftMotorSpeed,
  rightMotorSpeed,
}) => {
  const [streamError, setStreamError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [heading, setHeading] = useState(142);

  // Fallback interactive synthetic HUD canvas when hardware stream is waiting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.05;
      const w = canvas.width;
      const h = canvas.height;

      // Dark sci-fi camera background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(1, '#05070d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Perspective ground grid for visual driving motion
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const horizonY = h * 0.52;

      // Horizon line
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(w, horizonY);
      ctx.stroke();

      // Simulated motion lines when motors are engaged
      const speedOffset = (t * (leftMotorSpeed + rightMotorSpeed) * 0.2) % 30;
      for (let y = horizonY; y < h; y += 24) {
        const adjustedY = y + speedOffset;
        if (adjustedY >= horizonY && adjustedY < h) {
          ctx.beginPath();
          ctx.moveTo(0, adjustedY);
          ctx.lineTo(w, adjustedY);
          ctx.stroke();
        }
      }

      // Vanishing point perspective lines
      const cx = w / 2;
      for (let x = -w; x <= w * 2; x += 60) {
        ctx.beginPath();
        ctx.moveTo(cx, horizonY);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Crosshair Reticle in center
      const cy = h / 2;
      ctx.strokeStyle = isMyTurn ? '#10b981' : '#06b6d4';
      ctx.lineWidth = 1.5;

      // Circle
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.stroke();

      // Inner crosshair dots
      ctx.beginPath();
      ctx.moveTo(cx - 45, cy);
      ctx.lineTo(cx - 15, cy);
      ctx.moveTo(cx + 15, cy);
      ctx.lineTo(cx + 45, cy);
      ctx.moveTo(cx, cy - 45);
      ctx.lineTo(cx, cy - 15);
      ctx.moveTo(cx, cy + 15);
      ctx.lineTo(cx, cy + 45);
      ctx.stroke();

      // Center laser dot
      ctx.fillStyle = isMyTurn ? '#34d399' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      // Artificial Horizon pitch & roll indicators
      ctx.strokeStyle = '#38bdf888';
      ctx.lineWidth = 1;
      [-40, -20, 20, 40].forEach((offset) => {
        ctx.beginPath();
        ctx.moveTo(cx - 20, cy + offset);
        ctx.lineTo(cx + 20, cy + offset);
        ctx.stroke();
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isMyTurn, leftMotorSpeed, rightMotorSpeed]);

  // Dynamic heading simulation on steering
  useEffect(() => {
    if (leftMotorSpeed !== 0 || rightMotorSpeed !== 0) {
      const delta = (leftMotorSpeed - rightMotorSpeed) * 0.05;
      setHeading((prev) => (prev + delta + 360) % 360);
    }
  }, [leftMotorSpeed, rightMotorSpeed]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col items-center justify-center aspect-[16/10] sm:aspect-[16/9] w-full select-none"
    >
      {/* Video Content: Physical Stream or Synthetic HUD */}
      {camStreamUrl && !streamError ? (
        <img
          src={camStreamUrl}
          alt="CSI Camera Live Feed"
          onError={() => setStreamError(true)}
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      ) : (
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      )}

      {/* Vignette & scanline overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(2,6,23,0.75)_100%)] z-10" />

      {/* TOP HUD BAR */}
      <div className="absolute top-0 inset-x-0 p-3 sm:p-4 flex items-center justify-between text-xs font-mono z-20 pointer-events-none">
        {/* Camera info */}
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-slate-200 shadow-md">
          <Camera className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-bold text-white">CSI-CAM 0</span>
          <span className="text-slate-400">|</span>
          <span className="text-emerald-400 font-semibold">25 FPS</span>
          <span className="text-slate-400 hidden sm:inline">|</span>
          <span className="text-slate-300 hidden sm:inline">640x480</span>
        </div>

        {/* Center Pilot Status Pill */}
        <div className="pointer-events-auto">
          {isMyTurn ? (
            <div className="flex items-center gap-2 bg-emerald-500/90 text-slate-950 px-4 py-1.5 rounded-full font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-500/30 animate-pulse border border-emerald-300">
              <Radio className="w-4 h-4 animate-spin text-slate-950" />
              <span>TU SEI AI COMANDI!</span>
              <span className="bg-slate-950 text-emerald-400 px-2 py-0.5 rounded-full font-mono text-xs">
                {timeRemainingSec}s
              </span>
            </div>
          ) : activePilotName ? (
            <div className="flex items-center gap-2 bg-slate-900/90 text-slate-200 px-3.5 py-1.5 rounded-full text-xs border border-amber-500/50 shadow-md">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-slate-400">Pilota attuale:</span>
              <span className="font-bold text-amber-300">{activePilotName}</span>
              <span className="font-mono text-slate-400">({timeRemainingSec}s)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-900/90 text-slate-300 px-3.5 py-1.5 rounded-full text-xs border border-slate-700 shadow-md">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>Rover libero • Prenota per guidare</span>
            </div>
          )}
        </div>

        {/* Telemetry top-right */}
        <div className="flex items-center gap-2">
          <div className="hidden xs:flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-slate-200 shadow-md">
            <BatteryCharging className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-bold">{robotState.batteryPercent}%</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="pointer-events-auto p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition"
            title="Schermo intero"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* BOTTOM HUD TELEMETRY BAR */}
      <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 flex items-end justify-between text-xs font-mono z-20 pointer-events-none">
        {/* Left Motor Gauge */}
        <div className="flex flex-col gap-1 bg-slate-900/80 backdrop-blur-md p-2 sm:p-2.5 rounded-xl border border-slate-700/60 shadow-lg text-[11px]">
          <div className="flex items-center justify-between gap-3 text-slate-300">
            <span className="flex items-center gap-1 font-semibold text-cyan-400">
              <Gauge className="w-3.5 h-3.5" /> M-SX:
            </span>
            <span className="font-bold text-white">{leftMotorSpeed}%</span>
          </div>
          <div className="w-24 sm:w-32 bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                leftMotorSpeed >= 0 ? 'bg-cyan-400' : 'bg-rose-400'
              }`}
              style={{ width: `${Math.abs(leftMotorSpeed)}%` }}
            />
          </div>
        </div>

        {/* Center Compass / Heading */}
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-slate-300 shadow-lg text-xs">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400">HDG:</span>
          <span className="font-bold text-white">{Math.round(heading)}°</span>
          <span className="text-cyan-400 font-bold">
            {heading > 315 || heading <= 45
              ? 'N'
              : heading <= 135
              ? 'E'
              : heading <= 225
              ? 'S'
              : 'W'}
          </span>
        </div>

        {/* Right Motor Gauge */}
        <div className="flex flex-col gap-1 bg-slate-900/80 backdrop-blur-md p-2 sm:p-2.5 rounded-xl border border-slate-700/60 shadow-lg text-[11px]">
          <div className="flex items-center justify-between gap-3 text-slate-300">
            <span className="flex items-center gap-1 font-semibold text-cyan-400">
              <Gauge className="w-3.5 h-3.5" /> M-DX:
            </span>
            <span className="font-bold text-white">{rightMotorSpeed}%</span>
          </div>
          <div className="w-24 sm:w-32 bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                rightMotorSpeed >= 0 ? 'bg-cyan-400' : 'bg-rose-400'
              }`}
              style={{ width: `${Math.abs(rightMotorSpeed)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
