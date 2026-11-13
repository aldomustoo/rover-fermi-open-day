import React, { useState } from 'react';
import { X, Copy, Check, Download, Cpu, Wrench, ShieldCheck, Terminal, Layers } from 'lucide-react';

interface DocsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsGuideModal: React.FC<DocsGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'wiring' | 'python' | 'shelly' | 'launch'>('wiring');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pythonScriptPreview = `#!/usr/bin/env python3
# I.S. ENRICO FERMI MANTOVA - TELECOMUNICAZIONI
# PI 3B v1.2 (32-bit) + L298N + CAMERA MODULE 3 WIDE (TNBA2004 / IMX708)
# Esegui: python3 robot_controller.py --server ws://<IP_SERVER>:8080

import io, time, json, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import websocket
from gpiozero import PWMOutputDevice, DigitalOutputDevice
from picamera2 import Picamera2
from picamera2.encoders import MJPEGEncoder
from picamera2.outputs import FileOutput
from libcamera import controls

# Pinout L298N/L298D (BCM usata da gpiozero | tra parentesi Pin Fisico / WiringPi)
PIN_ENA, PIN_IN1, PIN_IN2 = 12, 23, 24  # Motore SX (Pin 32/wPi26, 16/wPi4, 18/wPi5)
PIN_ENB, PIN_IN3, PIN_IN4 = 13, 17, 27  # Motore DX (Pin 33/wPi23, 11/wPi0, 13/wPi2)

pwm_sx = PWMOutputDevice(PIN_ENA, frequency=100)
dir_sx1, dir_sx2 = DigitalOutputDevice(PIN_IN1), DigitalOutputDevice(PIN_IN2)
pwm_dx = PWMOutputDevice(PIN_ENB, frequency=100)
dir_dx1, dir_dx2 = DigitalOutputDevice(PIN_IN3), DigitalOutputDevice(PIN_IN4)

def set_motors(left, right):
    if left > 0: dir_sx1.on(); dir_sx2.off(); pwm_sx.value = abs(left)/100.0
    elif left < 0: dir_sx1.off(); dir_sx2.on(); pwm_sx.value = abs(left)/100.0
    else: dir_sx1.off(); dir_sx2.off(); pwm_sx.value = 0.0
    if right > 0: dir_dx1.on(); dir_dx2.off(); pwm_dx.value = abs(right)/100.0
    elif right < 0: dir_dx1.off(); dir_dx2.on(); pwm_dx.value = abs(right)/100.0
    else: dir_dx1.off(); dir_dx2.off(); pwm_dx.value = 0.0

# Camera Module 3 Wide (640x360 16:9 FOV 120° + Autofocus Continuo)
picam2 = Picamera2()
picam2.configure(picam2.create_video_configuration(main={"size": (640, 360)}))
picam2.set_controls({"AfMode": controls.AfModeEnum.Continuous})`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pythonScriptPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPythonFile = () => {
    const blob = new Blob([pythonScriptPreview], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'robot_controller.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">
                Guida Hardware & Step-by-Step Open Day
              </h3>
              <p className="text-xs text-slate-400">
                I.S. Enrico Fermi Mantova • Telecomunicazioni & Robotica
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 gap-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'wiring', label: '1. Cablaggio L298N & Cam', icon: Wrench },
            { id: 'shelly', label: '2. Collegamento Shelly 1', icon: ShieldCheck },
            { id: 'python', label: '3. Codice Python Raspberry', icon: Cpu },
            { id: 'launch', label: '4. Avvio & Config LAN', icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-3 px-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-xs sm:text-sm text-slate-300 space-y-4">
          {activeTab === 'wiring' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <strong>⚠️ Regola Fondamentale di Massa Comune:</strong> Collega SEMPRE il pin{' '}
                <strong>GND del Raspberry Pi</strong> al morsetto <strong>GND dell&apos;L298N</strong>.
                Senza massa in comune i livelli logici fluttuano e i motori tremano o si bloccano!
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-800 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-slate-950 text-slate-200 border-b border-slate-800 text-xs">
                      <th className="p-2.5">Segnale L298</th>
                      <th className="p-2.5">GPIO BCM (Python)</th>
                      <th className="p-2.5">Pin Fisico</th>
                      <th className="p-2.5">WiringPi</th>
                      <th className="p-2.5">Funzione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    <tr className="bg-slate-900/40">
                      <td className="p-2.5 font-bold text-cyan-300">ENA (togli jumper)</td>
                      <td className="p-2.5 text-white font-bold">GPIO 12</td>
                      <td className="p-2.5">Pin 32</td>
                      <td className="p-2.5 text-slate-400">26</td>
                      <td className="p-2.5 text-slate-400">PWM Velocità Sinistra</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-cyan-300">IN1</td>
                      <td className="p-2.5 text-white font-bold">GPIO 23</td>
                      <td className="p-2.5">Pin 16</td>
                      <td className="p-2.5 text-slate-400">4</td>
                      <td className="p-2.5 text-slate-400">Direzione Motore SX (A)</td>
                    </tr>
                    <tr className="bg-slate-900/40">
                      <td className="p-2.5 font-bold text-cyan-300">IN2</td>
                      <td className="p-2.5 text-white font-bold">GPIO 24</td>
                      <td className="p-2.5">Pin 18</td>
                      <td className="p-2.5 text-slate-400">5</td>
                      <td className="p-2.5 text-slate-400">Direzione Motore SX (B)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-cyan-300">ENB (togli jumper)</td>
                      <td className="p-2.5 text-white font-bold">GPIO 13</td>
                      <td className="p-2.5">Pin 33</td>
                      <td className="p-2.5 text-slate-400">23</td>
                      <td className="p-2.5 text-slate-400">PWM Velocità Destra</td>
                    </tr>
                    <tr className="bg-slate-900/40">
                      <td className="p-2.5 font-bold text-cyan-300">IN3</td>
                      <td className="p-2.5 text-white font-bold">GPIO 17</td>
                      <td className="p-2.5">Pin 11</td>
                      <td className="p-2.5 text-slate-400">0</td>
                      <td className="p-2.5 text-slate-400">Direzione Motore DX (A)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-cyan-300">IN4</td>
                      <td className="p-2.5 text-white font-bold">GPIO 27</td>
                      <td className="p-2.5">Pin 13</td>
                      <td className="p-2.5 text-slate-400">2</td>
                      <td className="p-2.5 text-slate-400">Direzione Motore DX (B)</td>
                    </tr>
                    <tr className="bg-slate-900/40">
                      <td className="p-2.5 font-bold text-emerald-300">GND (Massa)</td>
                      <td className="p-2.5 text-emerald-300 font-bold">GND</td>
                      <td className="p-2.5">Pin 6, 14, 20</td>
                      <td className="p-2.5 text-slate-400">-</td>
                      <td className="p-2.5 text-slate-400">Riferimento 0V Comune</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Camera Module 3 Wide (TNBA2004 / IMX708) su Raspberry Pi 3 B v1.2:
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Solleva la clip del connettore <strong>CAMERA</strong> (tra HDMI e jack audio).
                  Inserisci la flat cable 15-pin con i contatti argentati rivolti verso la porta HDMI e richiudi la clip.
                  Richiede <strong>libcamera / picamera2</strong> (no legacy camera) ed è configurata a <strong>640×360 (16:9)</strong> per sfruttare tutto il grandangolo 120° con autofocus continuo.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'shelly' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm">Schema Morsettiera Shelly 1 (Gen 1)</h4>
                <p className="text-xs text-slate-400">
                  Lo Shelly 1 possiede un relè a <strong>contatto pulito (Dry Contact)</strong> isolato tra i morsetti <strong>I (Input)</strong> e <strong>O (Output)</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-amber-400 font-bold block mb-1">Alimentazione Modulo:</span>
                    <p className="text-slate-300"><strong>L</strong>: Fase 230V AC</p>
                    <p className="text-slate-300"><strong>N</strong>: Neutro 230V AC</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-cyan-400 font-bold block mb-1">Circuito Lampadina Stand:</span>
                    <p className="text-slate-300"><strong>I</strong>: Fase di linea (o +12V DC)</p>
                    <p className="text-slate-300"><strong>O</strong>: Al morsetto lampadina</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                  <span className="font-bold text-slate-200 block mb-1">API HTTP Diretta (LAN):</span>
                  <code className="text-cyan-400 break-all">http://&lt;IP_SHELLY&gt;/relay/0?turn=toggle</code>
                  <p className="text-slate-400 mt-1">
                    Il server Web inoltra in tempo reale la richiesta e notifica via WebSocket tutti i 6 tablet connessi istantaneamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'python' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  File: <strong className="text-white">raspberry_pi/robot_controller.py</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiato!' : 'Copia'}</span>
                  </button>
                  <button
                    onClick={downloadPythonFile}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white cursor-pointer shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Scarica .py</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto text-cyan-300">
                <pre>{pythonScriptPreview}</pre>
              </div>

              <p className="text-xs text-slate-400">
                Include Watchdog di sicurezza: se la connessione Wi-Fi o il server non inviano pacchetti per &gt;400ms, i motori si arrestano all&apos;istante per evitare urti.
              </p>
            </div>
          )}

          {activeTab === 'launch' && (
            <div className="space-y-3">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm">Avvio su Server Centrale (porta 8080 LAN):</h4>
                <div className="bg-slate-900 p-3 rounded-lg font-mono text-xs text-cyan-300 space-y-1.5 border border-slate-800">
                  <p className="text-slate-400"># Sul PC/Server in laboratorio</p>
                  <p className="text-slate-100">npm install &amp;&amp; npm run build</p>
                  <p className="text-emerald-400">PORT=8080 NODE_ENV=production npm start</p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm">Avvio su Raspberry Pi 3 B v1.2 (OS 32-bit Desktop):</h4>
                <div className="bg-slate-900 p-3 rounded-lg font-mono text-xs text-cyan-300 space-y-1.5 border border-slate-800">
                  <p className="text-slate-400"># 1. Verifica Camera Module 3 Wide (IMX708)</p>
                  <p className="text-slate-100">rpicam-hello --list-cameras</p>
                  <p className="mt-2 text-slate-400"># 2. Installa dipendenze Python</p>
                  <p className="text-slate-100">sudo apt install -y python3-picamera2 python3-gpiozero python3-websocket</p>
                  <p className="mt-2 text-slate-400"># 3. Avvia il controller verso il server LAN</p>
                  <p className="text-emerald-400">python3 robot_controller.py --server ws://192.168.1.100:8080</p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-sm">Connessione dei 6 Tablet:</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Apri Chrome su ciascun tablet e vai a: <code className="text-cyan-400 bg-slate-900 px-2 py-0.5 rounded">http://192.168.1.100:8080</code>.
                  Seleziona in alto la postazione (<code className="text-white">Tablet #1</code> .. <code className="text-white">#6</code>).
                  Tutti vedono lo stream video da <code className="text-white">:8081/stream.mjpg</code> e la lampada Shelly 1; la guida ruota a turni di 45s.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
