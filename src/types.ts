export interface QueueState {
  activePilotId: string | null;
  activePilotName: string | null;
  timeRemainingSec: number;
  slotDurationSec: number;
  maxSpeedPercent: number; // 40, 75, 100
  safeMode: boolean;
  queue: Array<{ id: string; name: string }>;
}

export interface RobotState {
  connected: boolean;
  batteryPercent: number;
  cpuTemp: number;
  ip?: string;
  lastCommand: { left: number; right: number; timestamp: number };
}

export interface ShellyState {
  ip: string;
  isOn: boolean;
  reachable: boolean;
  name: string;
}

export interface MotorCalibration {
  invertLeft: boolean;
  invertRight: boolean;
  swapMotors: boolean;
  minPwmPercent: number; // 0 (normale), 55, 70, 100 (digitale ON/OFF)
}

export interface ServerStatePayload {
  queueState: QueueState;
  robotState: RobotState;
  shellyState: ShellyState;
  motorCalibration?: MotorCalibration;
  connectedTabletsCount: number;
  yourId?: string;
}
