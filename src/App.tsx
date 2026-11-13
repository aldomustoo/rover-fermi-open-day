import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { VideoHud } from './components/VideoHud';
import { TouchJoystick } from './components/TouchJoystick';
import { DirectionalPad } from './components/DirectionalPad';
import { ShellyCard } from './components/ShellyCard';
import { QueueManager } from './components/QueueManager';
import { TeacherSettingsModal } from './components/TeacherSettingsModal';
import { DocsGuideModal } from './components/DocsGuideModal';
import { playTurnStart, playTurnWarning, playEmergencyStop } from './services/sound';
import type { QueueState, RobotState, ShellyState, ServerStatePayload } from './types';

export default function App() {
  // Tablet identification
  const [myTabletId] = useState(() => {
    const saved = localStorage.getItem('fermi_tablet_id');
    if (saved) return saved;
    const generated = `tab-${Math.random().toString(36).substring(2, 7)}`;
    localStorage.setItem('fermi_tablet_id', generated);
    return generated;
  });

  const [myTabletName, setMyTabletName] = useState(() => {
    return localStorage.getItem('fermi_tablet_name') || 'Tablet #1';
  });

  const handleSelectTabletName = (name: string) => {
    setMyTabletName(name);
    localStorage.setItem('fermi_tablet_name', name);
    // Notify server of name change
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'name:update', name }));
    }
  };

  // Connection & Ping States
  const [wsConnected, setWsConnected] = useState(false);
  const [pingMs, setPingMs] = useState(14);
  const wsRef = useRef<WebSocket | null>(null);

  // Core System States
  const [queueState, setQueueState] = useState<QueueState>({
    activePilotId: null,
    activePilotName: null,
    timeRemainingSec: 45,
    slotDurationSec: 45,
    maxSpeedPercent: 75,
    safeMode: true,
    queue: [],
  });

  const [robotState, setRobotState] = useState<RobotState>({
    connected: false,
    batteryPercent: 88,
    cpuTemp: 44.5,
    lastCommand: { left: 0, right: 0, timestamp: 0 },
  });

  const [shellyState, setShellyState] = useState<ShellyState>({
    ip: '192.168.1.50',
    isOn: false,
    reachable: true,
    name: 'Lampada Stand Fermi',
  });

  const [tabletsCount, setTabletsCount] = useState(1);

  // Local motor speeds for HUD gauges
  const [leftMotorSpeed, setLeftMotorSpeed] = useState(0);
  const [rightMotorSpeed, setRightMotorSpeed] = useState(0);

  // Drive Control Scheme Tab (Joystick vs D-Pad)
  const [controlMode, setControlMode] = useState<'joystick' | 'dpad'>('joystick');

  // Modals
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);

  const isMyTurn = queueState.activePilotId === myTabletId;
  const prevIsMyTurn = useRef(isMyTurn);

  // Turn arrival sound effect
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current) {
      playTurnStart();
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  // Turn ending 5s warning sound
  useEffect(() => {
    if (isMyTurn && queueState.timeRemainingSec === 5) {
      playTurnWarning();
    }
  }, [isMyTurn, queueState.timeRemainingSec]);

  // WebSocket connection management
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let pingInterval: NodeJS.Timeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?role=tablet&tabletId=${myTabletId}&name=${encodeURIComponent(
        myTabletName
      )}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        // Start ping interval
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'ping', time: Date.now() }));
          }
        }, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.event === 'pong') {
            const rtt = Math.max(4, Math.round(Date.now() - (data.clientTime || 0)));
            setPingMs(rtt);
          } else if (data.event === 'init') {
            const payload = data.payload as ServerStatePayload;
            setQueueState(payload.queueState);
            setRobotState(payload.robotState);
            setShellyState(payload.shellyState);
            setTabletsCount(payload.connectedTabletsCount || 1);
          } else if (data.event === 'state:update') {
            const payload = data.payload as ServerStatePayload;
            setQueueState(payload.queueState);
            setRobotState(payload.robotState);
            setShellyState(payload.shellyState);
            setTabletsCount(payload.connectedTabletsCount || 1);
          } else if (data.event === 'timer:tick') {
            setQueueState((prev) => ({
              ...prev,
              timeRemainingSec: data.payload.timeRemainingSec,
              activePilotId: data.payload.activePilotId,
            }));
          } else if (data.event === 'shelly:update') {
            setShellyState((prev) => ({
              ...prev,
              isOn: data.payload.isOn,
              reachable: data.payload.reachable,
            }));
          } else if (data.event === 'robot:telemetry') {
            setRobotState((prev) => ({
              ...prev,
              batteryPercent: data.payload.batteryPercent ?? prev.batteryPercent,
              cpuTemp: data.payload.cpuTemp ?? prev.cpuTemp,
            }));
          } else if (data.event === 'robot:status') {
            setRobotState((prev) => ({
              ...prev,
              connected: Boolean(data.payload.connected),
              ip: data.payload.ip ?? prev.ip,
            }));
          } else if (data.event === 'drive:telemetry') {
            setLeftMotorSpeed(data.payload.left);
            setRightMotorSpeed(data.payload.right);
          } else if (data.event === 'tablets:count') {
            setTabletsCount(data.payload.count);
          } else if (data.event === 'emergency:stop') {
            setLeftMotorSpeed(0);
            setRightMotorSpeed(0);
            playEmergencyStop();
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        clearInterval(pingInterval);
        reconnectTimeout = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [myTabletId, myTabletName]);

  // Actions
  const handleDriveCommand = useCallback(
    (left: number, right: number) => {
      setLeftMotorSpeed(left);
      setRightMotorSpeed(right);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            event: 'drive:command',
            left,
            right,
          })
        );
      }
    },
    []
  );

  const handleStopDrive = useCallback(() => {
    setLeftMotorSpeed(0);
    setRightMotorSpeed(0);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: 'drive:command',
          left: 0,
          right: 0,
        })
      );
    }
  }, []);

  const handleEmergencyStop = () => {
    playEmergencyStop();
    handleStopDrive();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'drive:stop' }));
    }
  };

  const handleJoinQueue = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'queue:join' }));
    }
  };

  const handleLeaveQueue = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'queue:leave' }));
    }
  };

  const handleToggleShelly = async () => {
    try {
      const res = await fetch('/api/shelly/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setShellyState((prev) => ({
          ...prev,
          isOn: data.isOn,
          reachable: data.reachable,
        }));
      }
    } catch {
      // Local fallback for demo
      setShellyState((prev) => ({ ...prev, isOn: !prev.isOn }));
    }
  };

  const handleUpdateTeacherConfig = async (config: {
    pin: string;
    shellyIp?: string;
    slotDurationSec?: number;
    maxSpeedPercent?: number;
    safeMode?: boolean;
    robotIp?: string;
  }) => {
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Top Application Bar */}
      <Header
        wsConnected={wsConnected}
        pingMs={pingMs}
        robotState={robotState}
        tabletsCount={tabletsCount}
        myTabletName={myTabletName}
        onSelectTabletName={handleSelectTabletName}
        onOpenDocs={() => setIsDocsOpen(true)}
        onOpenTeacherModal={() => setIsTeacherModalOpen(true)}
        onEmergencyStop={handleEmergencyStop}
      />

      {/* Main Cockpit Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col gap-4">
        {/* ROW 1: Center Video Feed (CSI Camera stream with HUD) */}
        <section className="w-full">
          <VideoHud
            robotState={robotState}
            isMyTurn={isMyTurn}
            activePilotName={queueState.activePilotName}
            timeRemainingSec={queueState.timeRemainingSec}
            camStreamUrl={robotState.connected && robotState.ip ? `http://${robotState.ip}:8081/stream.mjpg` : undefined}
            leftMotorSpeed={leftMotorSpeed}
            rightMotorSpeed={rightMotorSpeed}
          />
        </section>

        {/* ROW 2: Bento Grid (Controls, Queue, Shelly 1) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* DRIVING CONTROLS COCKPIT (Columns 1-5 on desktop / full on mobile) */}
          <div className="lg:col-span-5 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isMyTurn ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                Comandi Rover L298N
              </span>

              {/* Mode Switcher: Joystick vs D-Pad */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setControlMode('joystick')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    controlMode === 'joystick'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Joystick
                </button>
                <button
                  type="button"
                  onClick={() => setControlMode('dpad')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    controlMode === 'dpad'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tasti
                </button>
              </div>
            </div>

            {/* Interactive Control Canvas */}
            <div className="py-2 flex items-center justify-center min-h-[170px]">
              {controlMode === 'joystick' ? (
                <TouchJoystick
                  enabled={isMyTurn}
                  onDriveCommand={handleDriveCommand}
                  onStop={handleStopDrive}
                />
              ) : (
                <DirectionalPad
                  enabled={isMyTurn}
                  onDriveCommand={handleDriveCommand}
                  onStop={handleStopDrive}
                />
              )}
            </div>

            {/* Speed Limiter Indicator */}
            <div className="bg-slate-950/70 rounded-xl px-3 py-2 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Limitatore Velocità:</span>
              <span className="text-cyan-400 font-bold">
                {queueState.maxSpeedPercent}% ({queueState.maxSpeedPercent <= 40 ? 'Sicura Open Day' : 'Normale'})
              </span>
            </div>
          </div>

          {/* QUEUE MANAGER: The 6-Tablet Fair Rotation (Columns 6-8) */}
          <div className="lg:col-span-4 flex">
            <div className="w-full">
              <QueueManager
                queueState={queueState}
                myId={myTabletId}
                myTabletName={myTabletName}
                onJoinQueue={handleJoinQueue}
                onLeaveQueue={handleLeaveQueue}
              />
            </div>
          </div>

          {/* SHELLY 1 RELAY & LAMP CONTROL (Columns 9-12) */}
          <div className="lg:col-span-3 flex">
            <div className="w-full">
              <ShellyCard
                shellyState={shellyState}
                onToggle={handleToggleShelly}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer Branding & Copyright */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-4 py-3 text-center text-xs text-slate-400 font-mono">
        <span>I.S. Enrico Fermi - Mantova • Laboratorio di Telecomunicazioni & Robotica • Architettura Multi-Tablet WebSockets</span>
      </footer>

      {/* Modals */}
      <TeacherSettingsModal
        isOpen={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
        queueState={queueState}
        shellyState={shellyState}
        robotState={robotState}
        onUpdateConfig={handleUpdateTeacherConfig}
        onEmergencyStop={handleEmergencyStop}
      />

      <DocsGuideModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />
    </div>
  );
}
