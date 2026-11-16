import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Unlock,
  Settings,
  Sliders,
  Shield,
  AlertTriangle,
  CheckCircle2,
  ArrowLeftRight,
  RotateCcw,
  Play,
  Cpu,
} from 'lucide-react';
import type { QueueState, ShellyState, RobotState, MotorCalibration } from '../types';

interface TeacherSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  queueState: QueueState;
  shellyState: ShellyState;
  robotState: RobotState;
  motorCalibration: MotorCalibration;
  onUpdateConfig: (config: {
    pin: string;
    shellyIp?: string;
    slotDurationSec?: number;
    maxSpeedPercent?: number;
    safeMode?: boolean;
    robotIp?: string;
    motorCalibration?: MotorCalibration;
  }) => Promise<boolean>;
  onTestMotor: (pin: string, left: number, right: number) => Promise<boolean>;
  onEmergencyStop: () => void;
}

export const TeacherSettingsModal: React.FC<TeacherSettingsModalProps> = ({
  isOpen,
  onClose,
  queueState,
  shellyState,
  robotState,
  motorCalibration,
  onUpdateConfig,
  onTestMotor,
  onEmergencyStop,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Form states
  const [shellyIp, setShellyIp] = useState(shellyState.ip || '');
  const [slotDuration, setSlotDuration] = useState(queueState.slotDurationSec);
  const [speedLimit, setSpeedLimit] = useState(queueState.maxSpeedPercent);
  const [robotIp, setRobotIp] = useState(robotState.ip || '192.168.1.100');
  const [cal, setCal] = useState<MotorCalibration>(motorCalibration);

  useEffect(() => {
    if (isOpen) {
      setShellyIp(shellyState.ip || '');
      setSlotDuration(queueState.slotDurationSec);
      setSpeedLimit(queueState.maxSpeedPercent);
      setRobotIp(robotState.ip || '192.168.1.100');
      setCal(motorCalibration);
      setStatusNotice(null);
    }
  }, [isOpen, shellyState.ip, queueState.slotDurationSec, queueState.maxSpeedPercent, robotState.ip, motorCalibration]);

  if (!isOpen) return null;

  const activePin = pinInput || 'fermi';

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === 'fermi' || pinInput === 'FERMI2025' || pinInput === '1234') {
      setIsUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleSave = async () => {
    const ok = await onUpdateConfig({
      pin: activePin,
      shellyIp,
      slotDurationSec: slotDuration,
      maxSpeedPercent: speedLimit,
      robotIp,
      motorCalibration: cal,
    });
    if (ok) {
      setSaveSuccess(true);
      setStatusNotice('Configurazione e calibrazione sincronizzate.');
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const applyCalibrationLive = async (nextCal: MotorCalibration) => {
    setCal(nextCal);
    const ok = await onUpdateConfig({
      pin: activePin,
      motorCalibration: nextCal,
    });
    if (ok) {
      setStatusNotice('Calibrazione inviata in tempo reale al Raspberry Pi.');
    }
  };

  const triggerTest = async (label: string, left: number, right: number) => {
    if (!robotState.connected) {
      setStatusNotice('Attenzione: Rover offline, impossibile eseguire il test sui motori.');
      return;
    }
    const ok = await onTestMotor(activePin, left, right);
    setStatusNotice(
      ok
        ? `Impulso test inviato: ${label} (SX=${left}%, DX=${right}%)`
        : 'Errore invio test motori.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative text-slate-100 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              {isUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Pannello Docenti &amp; Tecnici</h3>
              <p className="text-xs text-slate-400">I.S. Enrico Fermi - Telecomunicazioni</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi pannello docenti"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isUnlocked ? (
          <form onSubmit={handleUnlock} className="flex flex-col gap-4 py-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
              <p>
                L&apos;interfaccia studenti è protetta per evitare manomissioni accidentali durante l&apos;Open Day.
                Inserisci il PIN docente per modificare le impostazioni di rete, calibrazione motori e sicurezza.
              </p>
              <p className="mt-1 font-mono text-cyan-400">
                PIN predefinito: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-white">fermi</code> oppure{' '}
                <code className="bg-slate-800 px-1.5 py-0.5 rounded text-white">1234</code>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                PIN di Sblocco Docente:
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="es. fermi"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center tracking-widest focus:outline-none focus:border-cyan-500"
                autoFocus
              />
              {pinError && (
                <span className="text-xs text-rose-400 mt-1 block font-semibold">
                  PIN non corretto. Riprova.
                </span>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide transition shadow-lg shadow-amber-500/20 active:scale-[0.98] cursor-pointer"
            >
              SBLOCCA IMPOSTAZIONI
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4 py-1 max-h-[75vh] overflow-y-auto pr-1">
            {/* Live Motor Calibration L298N */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  <Cpu className="w-4 h-4" />
                  Calibrazione Motori L298N (Live)
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    robotState.connected
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60'
                      : 'bg-rose-950/60 text-rose-400 border-rose-700/60'
                  }`}
                >
                  {robotState.connected ? 'PI CONNESSO' : 'PI OFFLINE'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyCalibrationLive({ ...cal, invertLeft: !cal.invertLeft })}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    cal.invertLeft
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Inverti SX: {cal.invertLeft ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyCalibrationLive({ ...cal, invertRight: !cal.invertRight })}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    cal.invertRight
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Inverti DX: {cal.invertRight ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyCalibrationLive({ ...cal, swapMotors: !cal.swapMotors })}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    cal.swapMotors
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Scambia SX↔DX: {cal.swapMotors ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              {/* Anti-stall / PWM deadband */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Compensazione Spunto PWM (se i motori ronzano ma non partono a bassa velocità):
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { val: 0, label: 'Normale' },
                    { val: 55, label: 'Min 55%' },
                    { val: 70, label: 'Min 70%' },
                    { val: 100, label: '100% ON/OFF' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => applyCalibrationLive({ ...cal, minPwmPercent: opt.val })}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-bold border transition cursor-pointer ${
                        cal.minPwmPercent === opt.val
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direct Wheel Test Buttons */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Test Rapido Ruote (impulso 0.9s senza prendere il turno):
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => triggerTest('Solo SX Avanti', 100, 0)}
                    className="py-2 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Test SX</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerTest('Solo DX Avanti', 0, 100)}
                    className="py-2 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Test DX</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerTest('Entrambi Avanti', 100, 100)}
                    className="py-2 px-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/60 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Avanti</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerTest('Gira Destra', 85, -85)}
                    className="py-2 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Gira DX</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Slot duration */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-2">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Durata Slot di Guida (per ciascun visitatore):
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[20, 30, 45, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSlotDuration(sec)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                      slotDuration === sec
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {sec} sec
                  </button>
                ))}
              </div>
            </div>

            {/* Speed Limiter */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-2">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Limitatore Velocità Motori L298N (Sicurezza Open Day):
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 40, label: '40% Sicura' },
                  { val: 75, label: '75% Standard' },
                  { val: 100, label: '100% Massima' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setSpeedLimit(item.val)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                      speedLimit === item.val
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Network IPs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  IP Lampada (opzionale):
                </label>
                <input
                  type="text"
                  value={shellyIp}
                  onChange={(e) => setShellyIp(e.target.value)}
                  placeholder="Lascia vuoto per predefinito"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  IP Raspberry Pi Robot:
                </label>
                <input
                  type="text"
                  value={robotIp}
                  onChange={(e) => setRobotIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {statusNotice && (
              <div className="px-3 py-2 rounded-xl bg-slate-950 border border-cyan-500/30 text-xs font-mono text-cyan-300">
                {statusNotice}
              </div>
            )}

            {/* Save Button */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm tracking-wide transition shadow-lg shadow-cyan-500/20 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>CONFIGURAZIONE SALVATA!</span>
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4" />
                    <span>APPLICA MODIFICHE</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onEmergencyStop();
                  setStatusNotice('Arresto forzato inviato ai motori!');
                }}
                className="px-4 py-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                title="Ferma subito il robot"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>STOP MOTORI</span>
              </button>
            </div>

            <div className="pt-1 text-right">
              <button
                type="button"
                onClick={() => setIsUnlocked(false)}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Riblocca interfaccia (Esci)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
