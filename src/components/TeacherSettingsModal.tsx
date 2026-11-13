import React, { useState } from 'react';
import { X, Lock, Unlock, Settings, Sliders, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { QueueState, ShellyState, RobotState } from '../types';

interface TeacherSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  queueState: QueueState;
  shellyState: ShellyState;
  robotState: RobotState;
  onUpdateConfig: (config: {
    pin: string;
    shellyIp?: string;
    slotDurationSec?: number;
    maxSpeedPercent?: number;
    safeMode?: boolean;
    robotIp?: string;
  }) => Promise<boolean>;
  onEmergencyStop: () => void;
}

export const TeacherSettingsModal: React.FC<TeacherSettingsModalProps> = ({
  isOpen,
  onClose,
  queueState,
  shellyState,
  robotState,
  onUpdateConfig,
  onEmergencyStop,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [shellyIp, setShellyIp] = useState(shellyState.ip);
  const [slotDuration, setSlotDuration] = useState(queueState.slotDurationSec);
  const [speedLimit, setSpeedLimit] = useState(queueState.maxSpeedPercent);
  const [robotIp, setRobotIp] = useState(robotState.ip || '192.168.1.100');

  if (!isOpen) return null;

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
      pin: pinInput || 'fermi',
      shellyIp,
      slotDurationSec: slotDuration,
      maxSpeedPercent: speedLimit,
      robotIp,
    });
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative text-slate-100 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              {isUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Pannello Docenti & Tecnici</h3>
              <p className="text-xs text-slate-400">I.S. Enrico Fermi - Telecomunicazioni</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isUnlocked ? (
          <form onSubmit={handleUnlock} className="flex flex-col gap-4 py-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
              <p>
                L&apos;interfaccia studenti è protetta per evitare manomissioni accidentali durante l&apos;Open Day.
                Inserisci il PIN docente per modificare le impostazioni di rete e sicurezza.
              </p>
              <p className="mt-1 font-mono text-cyan-400">PIN predefinito: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-white">fermi</code> oppure <code className="bg-slate-800 px-1.5 py-0.5 rounded text-white">1234</code></p>
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
          <div className="flex flex-col gap-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
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
                    className={`py-2 rounded-xl text-xs font-mono font-bold border transition ${
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
                  { val: 40, label: '40% Sicura (Consigliata)', color: 'emerald' },
                  { val: 75, label: '75% Standard', color: 'cyan' },
                  { val: 100, label: '100% Massima', color: 'amber' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setSpeedLimit(item.val)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition text-center ${
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

            {/* Shelly IP */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Indirizzo IP Shelly 1 (Lampada Stand):
              </label>
              <input
                type="text"
                value={shellyIp}
                onChange={(e) => setShellyIp(e.target.value)}
                placeholder="192.168.1.50"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Robot IP */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Indirizzo IP Raspberry Pi Robot:
              </label>
              <input
                type="text"
                value={robotIp}
                onChange={(e) => setRobotIp(e.target.value)}
                placeholder="192.168.1.100"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3 pt-2">
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
                  alert('Comando di arresto forzato inviato a tutti i motori!');
                }}
                className="px-4 py-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                title="Ferma subito il robot"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>STOP MOTORI</span>
              </button>
            </div>

            <div className="pt-2 text-right">
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
