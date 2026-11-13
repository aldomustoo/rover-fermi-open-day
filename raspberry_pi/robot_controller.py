#!/usr/bin/env python3
"""
================================================================================
I.S. ENRICO FERMI - MANTOVA | DIPARTIMENTO DI TELECOMUNICAZIONI
OPEN DAY - ROVER ROBOT CONTROLLER (L298N + CAMERA MODULE 3 WIDE + WEBSOCKET)
================================================================================
Ottimizzato per:
- Raspberry Pi 3 Model B v1.2 (Raspberry Pi OS 32-bit Desktop)
- Telecamera CSI: Raspberry Pi Camera Module 3 Wide (Sensore IMX708 / TNBA2004)
- Driver Motori: Ponte H L298N con PWM Hardware/Software (gpiozero)

Funzionalità:
1. Client WebSocket ultra-low-latency verso il server centrale (WebUI porta 8080/3000)
2. Controllo bidirezionale motori con ponte H L298N (PWM per regolazione velocità)
3. Watchdog di sicurezza hardware (arresto immediato se si perde il segnale > 400ms)
4. Server HTTP Multi-Thread (ThreadingHTTPServer) per servire fino a 6+ tablet
   contemporaneamente con streaming MJPEG nativo da Picamera2 (latenza minima)
5. Autofocus continuo (PDAF) e formato 16:9 (640x360) per mantenere tutto il
   campo visivo grandangolare (120°) del modulo Camera 3 Wide TNBA2004.
"""

import io
import os
import sys
import time
import json
import socket
import logging
import argparse
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Gestione librerie GPIO (gpiozero preinstallata su Raspberry Pi OS Desktop)
HAS_GPIO = False
try:
    from gpiozero import PWMOutputDevice, DigitalOutputDevice
    HAS_GPIO = True
except (ImportError, Exception):
    HAS_GPIO = False

# Gestione Picamera2 & libcamera per Camera Module 3 Wide (IMX708)
HAS_CAMERA = False
HAS_LIBCAMERA_CONTROLS = False
try:
    from picamera2 import Picamera2
    from picamera2.encoders import MJPEGEncoder
    from picamera2.outputs import FileOutput
    HAS_CAMERA = True
    try:
        from libcamera import controls, Transform
        HAS_LIBCAMERA_CONTROLS = True
    except ImportError:
        HAS_LIBCAMERA_CONTROLS = False
        Transform = None
except (ImportError, Exception):
    HAS_CAMERA = False

import websocket  # pip install websocket-client

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [FERMI-ROBOT] %(message)s',
    datefmt='%H:%M:%S'
)

# ==============================================================================
# CONFIGURAZIONE PIN L298N / L298D (Numerazione GPIO BCM usata da gpiozero)
# Nota: tra parentesi il numero di Pin Fisico e l'equivalente WiringPi
# ==============================================================================
# Motore Sinistro:
PIN_ENA = 12  # PWM Velocità Sinistra  (Pin fisico 32 | WiringPi GPIO 26)
PIN_IN1 = 23  # Direzione Sinistra A   (Pin fisico 16 | WiringPi GPIO 4)
PIN_IN2 = 24  # Direzione Sinistra B   (Pin fisico 18 | WiringPi GPIO 5)

# Motore Destro:
PIN_ENB = 13  # PWM Velocità Destra    (Pin fisico 33 | WiringPi GPIO 23)
PIN_IN3 = 17  # Direzione Destra A     (Pin fisico 11 | WiringPi GPIO 0)
PIN_IN4 = 27  # Direzione Destra B     (Pin fisico 13 | WiringPi GPIO 2)


# ==============================================================================
# CLASSE DRIVER MOTORI L298N CON WATCHDOG FAIL-SAFE
# ==============================================================================
class L298NMotorDriver:
    def __init__(self, ena=PIN_ENA, in1=PIN_IN1, in2=PIN_IN2, enb=PIN_ENB, in3=PIN_IN3, in4=PIN_IN4):
        self.ena_pin = ena
        self.in1_pin = in1
        self.in2_pin = in2
        self.enb_pin = enb
        self.in3_pin = in3
        self.in4_pin = in4
        self.last_command_time = time.time()
        self.watchdog_timeout = 0.40  # 400ms senza comandi = STOP immediato
        self.is_stopped = True
        self._lock = threading.Lock()

        if HAS_GPIO:
            logging.info(
                f"Inizializzazione GPIO L298N: ENA={ena}, IN1={in1}, IN2={in2} | "
                f"ENB={enb}, IN3={in3}, IN4={in4}"
            )
            opened = []
            try:
                # Su Pi 3B v1.2 100Hz evita ronzii eccessivi sui motori DC con L298N
                self.pwm_left = PWMOutputDevice(self.ena_pin, frequency=100)
                opened.append(self.pwm_left)
                self.dir_left1 = DigitalOutputDevice(self.in1_pin)
                opened.append(self.dir_left1)
                self.dir_left2 = DigitalOutputDevice(self.in2_pin)
                opened.append(self.dir_left2)

                self.pwm_right = PWMOutputDevice(self.enb_pin, frequency=100)
                opened.append(self.pwm_right)
                self.dir_right1 = DigitalOutputDevice(self.in3_pin)
                opened.append(self.dir_right1)
                self.dir_right2 = DigitalOutputDevice(self.in4_pin)
                opened.append(self.dir_right2)
            except Exception as e:
                for dev in opened:
                    try:
                        dev.close()
                    except Exception:
                        pass
                logging.error(
                    f"Errore inizializzazione gpiozero ({e}). Verifica che non ci sia un altro "
                    f"script/servizio attivo sui pin GPIO. Modalità simulazione attiva."
                )
                self.pwm_left = None
        else:
            logging.warning("Librerie GPIO non rilevate (es. PC). Attiva modalità simulata.")
            self.pwm_left = None

        self.running = True
        self.watchdog_thread = threading.Thread(target=self._watchdog_loop, daemon=True)
        self.watchdog_thread.start()

    def set_motors(self, left_speed: int, right_speed: int):
        """
        left_speed e right_speed: da -100 (retro max) a +100 (avanti max). 0 = stop.
        """
        with self._lock:
            self.last_command_time = time.time()
            left_speed = max(-100, min(100, int(left_speed)))
            right_speed = max(-100, min(100, int(right_speed)))
            self.is_stopped = (left_speed == 0 and right_speed == 0)

            if not self.pwm_left:
                if not self.is_stopped:
                    logging.debug(f"[SIMULATORE MOTORI] SX={left_speed}% | DX={right_speed}%")
                return

            try:
                # Motore Sinistro
                if left_speed > 0:
                    self.dir_left1.on()
                    self.dir_left2.off()
                    self.pwm_left.value = abs(left_speed) / 100.0
                elif left_speed < 0:
                    self.dir_left1.off()
                    self.dir_left2.on()
                    self.pwm_left.value = abs(left_speed) / 100.0
                else:
                    self.dir_left1.off()
                    self.dir_left2.off()
                    self.pwm_left.value = 0.0

                # Motore Destro
                if right_speed > 0:
                    self.dir_right1.on()
                    self.dir_right2.off()
                    self.pwm_right.value = abs(right_speed) / 100.0
                elif right_speed < 0:
                    self.dir_right1.off()
                    self.dir_right2.on()
                    self.pwm_right.value = abs(right_speed) / 100.0
                else:
                    self.dir_right1.off()
                    self.dir_right2.off()
                    self.pwm_right.value = 0.0
            except Exception as err:
                logging.error(f"Errore comando motori: {err}")

    def stop(self):
        if not self.is_stopped:
            self.set_motors(0, 0)

    def _watchdog_loop(self):
        while self.running:
            time.sleep(0.08)
            if not self.is_stopped and (time.time() - self.last_command_time) > self.watchdog_timeout:
                logging.debug("Watchdog timeout: arresto motori per sicurezza.")
                self.stop()

    def cleanup(self):
        self.running = False
        self.set_motors(0, 0)
        if self.pwm_left:
            try:
                self.pwm_left.close()
                self.dir_left1.close()
                self.dir_left2.close()
                self.pwm_right.close()
                self.dir_right1.close()
                self.dir_right2.close()
            except Exception:
                pass


# ==============================================================================
# STREAMING VIDEO CAMERA MODULE 3 WIDE (MJPEG ZERO-LATENCY + 6 TABLET SIMULTANEI)
# ==============================================================================
class StreamingOutput(io.BufferedIOBase):
    """Buffer condiviso thread-safe: notifica istantaneamente tutti i 6 tablet."""
    def __init__(self):
        self.frame = None
        self.condition = threading.Condition()

    def write(self, buf):
        with self.condition:
            self.frame = bytes(buf)
            self.condition.notify_all()
        return len(buf)


stream_output = StreamingOutput()


class ReuseThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class MJPEGStreamHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ['/stream.mjpg', '/stream', '/']:
            self.send_response(200)
            self.send_header('Age', '0')
            self.send_header('Cache-Control', 'no-cache, private')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=FRAME')
            self.end_headers()
            try:
                while True:
                    with stream_output.condition:
                        stream_output.condition.wait(timeout=2.0)
                        frame = stream_output.frame
                    if frame:
                        self.wfile.write(b'--FRAME\r\n')
                        self.send_header('Content-Type', 'image/jpeg')
                        self.send_header('Content-Length', str(len(frame)))
                        self.end_headers()
                        self.wfile.write(frame)
                        self.wfile.write(b'\r\n')
            except (BrokenPipeError, ConnectionResetError, Exception):
                pass
        elif self.path == '/snapshot.jpg':
            frame = stream_output.frame
            if frame:
                self.send_response(200)
                self.send_header('Content-Type', 'image/jpeg')
                self.send_header('Content-Length', str(len(frame)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(frame)
            else:
                self.send_response(503)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        return


def start_camera_capture(width=640, height=360, fps=24, rotate_180=True):
    """
    Configura Picamera2 ottimizzata per Camera Module 3 Wide (TNBA2004 / IMX708)
    su Raspberry Pi 3 B v1.2 (32-bit).
    Usa formato 16:9 (640x360) per mantenere il FOV grandangolare 120° senza crop,
    rotazione hardware 180° (hflip+vflip) per montaggio capovolto e MJPEGEncoder nativo.
    """
    if HAS_CAMERA:
        logging.info(f"Avvio CSI Camera Module 3 Wide ({width}x{height} @ {fps}fps, rotate_180={rotate_180})...")
        try:
            picam2 = Picamera2()
            config_kwargs = {
                "main": {"size": (width, height)},
                "controls": {"FrameRate": fps},
            }
            if rotate_180 and Transform is not None:
                config_kwargs["transform"] = Transform(hflip=1, vflip=1)

            # 16:9 preserva tutto il grandangolo del sensore IMX708 ed è leggero per Pi 3B
            video_config = picam2.create_video_configuration(**config_kwargs)
            picam2.configure(video_config)

            # Abilita Autofocus Continuo (PDAF) specifico di Camera Module 3 (IMX708)
            if HAS_LIBCAMERA_CONTROLS:
                try:
                    picam2.set_controls({
                        "AfMode": controls.AfModeEnum.Continuous,
                        "AfSpeed": controls.AfSpeedEnum.Fast
                    })
                    logging.info("Autofocus continuo IMX708 (Camera Module 3 Wide) attivato.")
                except Exception as af_err:
                    logging.warning(f"Impossibile impostare Autofocus continuo: {af_err}")

            # Avvia encoding MJPEG nativo verso lo StreamingOutput condiviso
            encoder = MJPEGEncoder(bitrate=3000000)
            picam2.start_recording(encoder, FileOutput(stream_output))
            logging.info("Streaming MJPEG hardware avviato con successo!")
            return picam2
        except Exception as e:
            logging.warning(f"Errore hardware CSI Camera ({e}). Attivazione flusso test pattern.")

    # Fallback test pattern se eseguito senza telecamera collegata
    def fallback_loop():
        try:
            from PIL import Image, ImageDraw
        except ImportError:
            logging.warning("Pillow non installato: stream fallback disabilitato.")
            return

        logging.info("Generazione test pattern video Fermi Mantova...")
        t = 0
        while True:
            t += 1
            img = Image.new('RGB', (width, height), color=(15, 23, 42))
            draw = ImageDraw.Draw(img)
            for x in range(0, width, 40):
                draw.line([(x, 0), (x, height)], fill=(30, 41, 59), width=1)
            for y in range(0, height, 40):
                draw.line([(0, y), (width, y)], fill=(30, 41, 59), width=1)

            cx, cy = width // 2, height // 2
            draw.line([(cx - 25, cy), (cx + 25, cy)], fill=(16, 185, 129), width=2)
            draw.line([(cx, cy - 25), (cx, cy + 25)], fill=(16, 185, 129), width=2)
            draw.ellipse([(cx - 18, cy - 18), (cx + 18, cy + 18)], outline=(16, 185, 129), width=2)
            draw.text((16, 16), "I.S. E. FERMI MANTOVA - CAMERA 3 WIDE TEST", fill=(241, 245, 249))
            draw.text((16, 36), f"640x360 16:9 | {fps} FPS | FRAME {t:06d}", fill=(56, 189, 248))

            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=65)
            stream_output.write(buf.getvalue())
            time.sleep(1.0 / fps)

    threading.Thread(target=fallback_loop, daemon=True).start()
    return None


# ==============================================================================
# TELEMETRIA SISTEMA RASPBERRY PI 3 B v1.2
# ==============================================================================
def get_cpu_temperature():
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            return round(float(f.read().strip()) / 1000.0, 1)
    except Exception:
        return 45.0


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


# ==============================================================================
# CLIENT WEBSOCKET VERSO LA DASHBOARD CENTRALE
# ==============================================================================
def run_websocket_client(server_url: str, motor_driver: L298NMotorDriver):
    while True:
        try:
            base = server_url.rstrip('/')
            ws_url = f"{base}/ws?role=robot"
            logging.info(f"Connessione al server centrale: {ws_url}...")

            def on_open(ws):
                logging.info(">> Robot connesso con successo al server centrale!")

                def telemetry_worker():
                    while ws.sock and ws.sock.connected:
                        try:
                            msg = {
                                "type": "telemetry",
                                "temp": get_cpu_temperature(),
                                "battery": 92,
                                "ip": get_local_ip(),
                                "timestamp": time.time()
                            }
                            ws.send(json.dumps(msg))
                        except Exception:
                            break
                        time.sleep(2.0)

                threading.Thread(target=telemetry_worker, daemon=True).start()

            def on_message(ws, raw):
                try:
                    data = json.loads(raw)
                    msg_type = data.get("type")
                    if msg_type == "drive":
                        left = int(data.get("left", 0))
                        right = int(data.get("right", 0))
                        motor_driver.set_motors(left, right)
                    elif msg_type == "ping":
                        ws.send(json.dumps({"type": "pong"}))
                except Exception as e:
                    logging.error(f"Errore parsing messaggio server: {e}")

            def on_error(ws, error):
                logging.warning(f"Avviso WebSocket: {error}")
                motor_driver.set_motors(0, 0)

            def on_close(ws, close_status_code, close_msg):
                logging.warning("Connessione con il server chiusa. Arresto motori per sicurezza.")
                motor_driver.set_motors(0, 0)

            ws_app = websocket.WebSocketApp(
                ws_url,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )
            ws_app.run_forever(ping_interval=3, ping_timeout=2)

        except Exception as e:
            logging.error(f"Eccezione di connessione: {e}")
            motor_driver.set_motors(0, 0)

        logging.info("Tentativo di riconnessione tra 3 secondi...")
        time.sleep(3)


# ==============================================================================
# MAIN ENTRY POINT
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(description="Fermi Mantova - Rover Open Day Controller (Pi 3B + Cam 3 Wide)")
    parser.add_argument("--server", default="ws://192.168.1.100:8080", help="URL WebSocket server (es. ws://192.168.1.100:8080)")
    parser.add_argument("--cam-port", type=int, default=8081, help="Porta HTTP stream MJPEG telecamera CSI")
    parser.add_argument("--width", type=int, default=640, help="Larghezza video (default 640 per 16:9 Wide)")
    parser.add_argument("--height", type=int, default=360, help="Altezza video (default 360 per 16:9 Wide)")
    parser.add_argument("--fps", type=int, default=24, help="Frame rate video (default 24fps)")
    parser.add_argument("--no-rotate-180", action="store_false", dest="rotate_180", default=True, help="Disabilita la rotazione 180° (di default capovolta)")
    parser.add_argument("--ena", type=int, default=PIN_ENA, help="GPIO BCM per ENA (sinistro)")
    parser.add_argument("--in1", type=int, default=PIN_IN1, help="GPIO BCM per IN1 (sinistro)")
    parser.add_argument("--in2", type=int, default=PIN_IN2, help="GPIO BCM per IN2 (sinistro)")
    parser.add_argument("--enb", type=int, default=PIN_ENB, help="GPIO BCM per ENB (destro)")
    parser.add_argument("--in3", type=int, default=PIN_IN3, help="GPIO BCM per IN3 (destro)")
    parser.add_argument("--in4", type=int, default=PIN_IN4, help="GPIO BCM per IN4 (destro)")
    args = parser.parse_args()

    print("\n" + "=" * 66)
    print("   I.S. ENRICO FERMI - MANTOVA | INDIRIZZO TELECOMUNICAZIONI")
    print("   ROVER OPEN DAY | PI 3B v1.2 + L298N + CAMERA 3 WIDE (TNBA2004)")
    print("=" * 66 + "\n")

    motor_driver = L298NMotorDriver(
        ena=args.ena, in1=args.in1, in2=args.in2,
        enb=args.enb, in3=args.in3, in4=args.in4
    )

    picam2_instance = start_camera_capture(
        width=args.width, height=args.height, fps=args.fps, rotate_180=args.rotate_180
    )

    # ReuseThreadingHTTPServer permette a tutti i 6 tablet di ricevere lo stream e previene Errno 98 al riavvio
    try:
        cam_server = ReuseThreadingHTTPServer(('0.0.0.0', args.cam_port), MJPEGStreamHandler)
    except OSError as bind_err:
        logging.error(
            f"Porta {args.cam_port} già occupata ({bind_err}). "
            f"Chiudi il processo precedente (es: pkill -f robot_controller.py o sudo systemctl stop fermi_rover)."
        )
        motor_driver.cleanup()
        if picam2_instance:
            try:
                picam2_instance.stop_recording()
                picam2_instance.close()
            except Exception:
                pass
        sys.exit(1)

    local_ip = get_local_ip()
    logging.info(f"Stream video MJPEG Multi-Tablet su: http://{local_ip}:{args.cam_port}/stream.mjpg")
    threading.Thread(target=cam_server.serve_forever, daemon=True).start()

    try:
        run_websocket_client(args.server, motor_driver)
    except KeyboardInterrupt:
        logging.info("Interruzione richiesta da utente (Ctrl+C). Arresto sicuro.")
    finally:
        motor_driver.cleanup()
        if picam2_instance:
            try:
                picam2_instance.stop_recording()
                picam2_instance.close()
            except Exception:
                pass
        cam_server.shutdown()
        logging.info("Arresto completato. GPIO e Camera rilasciati.")


if __name__ == "__main__":
    main()
