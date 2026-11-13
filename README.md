# 📡 Rover Teleoperato Open Day — I.S. Enrico Fermi (Mantova)
### Indirizzo Telecomunicazioni & Robotica • Dashboard Multi-Tablet (6 Postazioni), Raspberry Pi 3 B v1.2, L298N, Camera Module 3 Wide (TNBA2004) & Shelly 1

Sistema completo *production-ready* per l'Open Day di Telecomunicazioni dell'**I.S. Enrico Fermi di Mantova**: consente a **6 tablet contemporaneamente** di osservare in tempo reale il flusso video della telecamera CSI e lo stato della lampada Shelly 1, gestendo una **coda di guida a slot temporizzati** lato server in modo che un solo visitatore alla volta possa muovere il rover in totale sicurezza.

---

## 📑 Indice

1. [Architettura di Sistema & Latenza Minima](#-1-architettura-di-sistema--latenza-minima)
2. [Hardware Target & Specifiche](#-2-hardware-target--specifiche)
3. [Schemi Elettrici e Cablaggio (L298N, CSI Cam, Shelly 1)](#-3-schemi-elettrici-e-cablaggio)
4. [Preparazione Raspberry Pi 3 B v1.2 (OS 32-bit Desktop) & Camera Module 3 Wide](#-4-preparazione-raspberry-pi-3-b-v12-os-32-bit-desktop--camera-module-3-wide)
5. [Guida Server Centrale (LAN Porta 8080) — Cosa Eseguire & Codice](#-5-guida-server-centrale-lan-porta-8080--cosa-eseguire--codice)
6. [Guida Raspberry Pi — Cosa Eseguire, Codice Completo & Avvio Automatico](#-6-guida-raspberry-pi--cosa-eseguire-codice-completo--avvio-automatico)
7. [Configurazione dei 6 Tablet & Modalità Presentazione Sicura](#-7-configurazione-dei-6-tablet--modalità-presentazione-sicura)
8. [Risoluzione Problemi (Troubleshooting)](#-8-risoluzione-problemi-troubleshooting)

---

## 🏗 1. Architettura di Sistema & Latenza Minima

Tutti i dispositivi si trovano nella **stessa LAN** (Access Point / Router Wi-Fi di laboratorio):

```text
  ┌──────────────────┐   ┌──────────────────┐        ┌──────────────────┐
  │   Tablet #1      │   │   Tablet #2      │  ...   │   Tablet #6      │
  │  (Pilota Attivo) │   │   (In Coda)      │        │  (Spettatore)    │
  └────────┬─────────┘   └────────┬─────────┘        └────────┬─────────┘
           │                      │                           │
           │  1. WebUI + Comandi WebSocket (porta 8080)       │
           ▼                      ▼                           ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                SERVER CENTRALE NODE.JS (server.ts)                  │
  │                     IP LAN es. 192.168.1.100:8080                   │
  │  • Gestione Turni (Slot-Lease 45s) — accetta drive solo dal pilota  │
  │  • Broadcast stato coda, telemetria, timer e lampada a tutti i tab  │
  │  • Proxy HTTP REST verso Shelly 1 (evita blocchi CORS dei browser)  │
  └───────────────────┬─────────────────────────────┬───────────────────┘
                      │ WebSocket /ws?role=robot    │ HTTP REST /relay/0
                      ▼ (< 10ms LAN)                ▼
  ┌───────────────────────────────────────┐   ┌─────────────────────────┐
  │     RASPBERRY PI 3 MODEL B v1.2       │   │        SHELLY 1         │
  │    (robot_controller.py • Pi OS 32)   │   │   IP: 192.168.1.50      │
  │  • L298N PWM Motori + Watchdog 400ms  │   │  • Relè Contatto Pulito │
  │  • Camera Module 3 Wide (TNBA2004)    │   │  • Lampada Stand 230V   │
  │  • Stream MJPEG :8081/stream.mjpg ────┼───┼─────────────────────────┼──► Diretto verso i 6 Tablet
  └───────────────────────────────────────┘   └─────────────────────────┘
```

### Perché questa architettura garantisce latenza minima e zero conflitti:
- **Comandi motori via WebSocket binario/JSON persistente**: nessun overhead HTTP per ogni movimento del joystick.
- **Stream video diretto P2M (Pi → Multi-Tablet) via `ThreadingHTTPServer` + `MJPEGEncoder` nativo di `Picamera2`**:
  - Il video non viene ri-encodato in Python con Pillow (che saturerebbe la CPU 32-bit del Pi 3B): usa l'encoder JPEG/MJPEG nativo di `libcamera`/`picamera2` con latenza tipica **< 50ms** in LAN.
  - Il buffer usa `threading.Condition()` e `ThreadingHTTPServer` in modo che **tutti i 6 tablet** ricevano il flusso video in parallelo senza bloccarsi a vicenda.
- **Watchdog hardware di sicurezza (400 ms)**: se il Wi-Fi cade o il pilota rilascia il touch/esce dal turno, i motori si fermano entro 0,4 secondi.

---

## 🔩 2. Hardware Target & Specifiche

| Componente | Modello / Specifica | Note Tecniche |
|---|---|---|
| **SBC a bordo Rover** | **Raspberry Pi 3 Model B v1.2** | Quad-core Cortex-A53, 1 GB RAM, Wi-Fi 2.4 GHz (802.11n), OS **Raspberry Pi OS 32-bit con Desktop** |
| **Telecamera CSI** | **Raspberry Pi Camera Module 3 Wide** *(Codice: TNBA2004)* | Sensore Sony **IMX708** 12MP, angolo **120° Ultra-Wide**, Autofocus PDAF. Richiede `libcamera` / `picamera2` |
| **Ponte H Motori** | **Modulo L298N Dual H-Bridge** | Controllo 2 canali DC con PWM su `ENA` e `ENB` (jumper rimossi) |
| **Attuatore Luce** | **Shelly 1** (Gen 1) | Relè Wi-Fi a contatto pulito su rete locale (`http://<IP>/relay/0`) |
| **Server Centrale** | PC / Portatile / Mini-PC Linux, Windows o macOS | Node.js ≥ 20, aperto sulla porta **8080** in LAN |
| **Postazioni Utente** | **6 Tablet / Smartphone** | Browser Chrome / Safari aggiornato, stessa rete Wi-Fi |

---

## 🔌 3. Schemi Elettrici e Cablaggio

### A. Raspberry Pi 3 B v1.2 ↔ Ponte H L298N

> **⚠️ REGOLA D'ORO OBBLIGATORIA**: Collega **SEMPRE** un pin **GND** del Raspberry Pi al morsetto **GND** dell'L298N (massa comune). Senza massa comune i livelli logici fluttuano, i motori vibrano o non rispondono.

> **⚠️ JUMPER ENA / ENB**: Rimuovi i due ponticelli (jumper) neri presenti su `ENA` ed `ENB` della scheda L298N per abilitare la regolazione di velocità PWM via software (modalità sicura Open Day al 40% / 75%).

> **ℹ️ NOTA NUMERAZIONE GPIO (WiringPi vs BCM)**: La libreria Python `gpiozero` usa la numerazione **BCM**, mentre tabelle come `gpio readall` mostrano anche i numeri **WiringPi**. I pin fisici indicati sul tuo cablaggio corrispondono esattamente ai GPIO BCM già configurati in `robot_controller.py`:

| Morsetto L298D / L298N | Pin Fisico Header | GPIO BCM *(usato da Python)* | Numero WiringPi | Funzione |
|---|---|---|---|---|
| **ENA** *(senza jumper)* | **Pin 32** | **GPIO 12** *(PWM0)* | GPIO 26 | Velocità PWM Motore Sinistro |
| **IN1** | **Pin 16** | **GPIO 23** | GPIO 4 | Direzione Motore Sinistro A |
| **IN2** | **Pin 18** | **GPIO 24** | GPIO 5 | Direzione Motore Sinistro B |
| **IN3** | **Pin 11** | **GPIO 17** | GPIO 0 | Direzione Motore Destro A |
| **IN4** | **Pin 13** | **GPIO 27** | GPIO 2 | Direzione Motore Destro B |
| **ENB** *(senza jumper)* | **Pin 33** | **GPIO 13** *(PWM1)* | GPIO 23 | Velocità PWM Motore Destro |
| **GND** | **Pin 6, 14, 20 o 30** | **GND** | — | Massa comune (0V) |

#### Schema Alimentazione Sicuro per Pi 3 B v1.2 (consigliato):
- **Motori (L298N)**: Collega il pacco batterie motori (es. 2x 18650 Li-Ion = 7.4V/8.4V oppure batteria 12V) ai morsetti **12V/VMS (+)** e **GND (-)** dell'L298N.
- **Raspberry Pi 3 B v1.2**: Alimenta il Raspberry Pi tramite la porta **micro-USB** con un Power Bank dedicato (5V ≥ 2.5A). **Non** usare i 5V in uscita dall'L298N per il Pi 3B, perché i picchi di corrente allo spunto dei motori farebbero riavviare il Raspberry Pi (undervoltage lightning bolt).

### B. Collegamento Camera Module 3 Wide (TNBA2004)
1. **Spegni** il Raspberry Pi 3 B v1.2 prima di collegare il cavo flat.
2. Individua il connettore **CAMERA** (tra la porta HDMI e il jack audio 3.5mm).
3. Solleva delicatamente verso l'alto la linguetta nera/bianca in plastica.
4. Inserisci il cavo ribbon a 15 pin con i **contatti metallici argentati rivolti verso la porta HDMI** (e la linguetta blu rivolta verso la porta Ethernet/USB).
5. Premi la linguetta verso il basso fino al click di blocco.

### C. Collegamento Shelly 1 (Lampada sul Pannello Stand)
- **L** (Line): Fase 230V AC
- **N** (Neutral): Neutro 230V AC
- **I** (Input): Ponticellato con la Fase (230V AC) — *(oppure +12V DC se alimentato a 12V con jumper interno spostato)*
- **O** (Output): Filo che va al morsetto della lampadina
- L'altro polo della lampadina va al **Neutro (N)**.
- Imposta allo Shelly 1 un **IP statico** nella LAN (es. `192.168.1.50`) tramite la sua interfaccia web locale.

---

## 🍓 4. Preparazione Raspberry Pi 3 B v1.2 (OS 32-bit Desktop) & Camera Module 3 Wide

Sul tuo **Raspberry Pi 3 B v1.2** con **Raspberry Pi OS 32-bit Desktop**, apri un terminale (o collegati via SSH) ed esegui questi passaggi preparatori **una sola volta**:

### 1. Aggiorna il sistema e installa i pacchetti nativi (Picamera2 + GPIO)
```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y python3-picamera2 python3-gpiozero python3-websocket python3-pil
```
*(Nota: su Raspberry Pi OS 32-bit è fortemente consigliato installare `python3-picamera2`, `python3-gpiozero` e `python3-websocket` via `apt` anziché `pip`, così vengono usati i pacchetti precompilati per ARMv7 32-bit senza errori di compilazione o conflitti `externally-managed-environment`).*

Se `python3-websocket` non fosse disponibile via `apt` sulla tua versione, installalo con pip:
```bash
pip3 install websocket-client --break-system-packages
```

### 2. Verifica il rilevamento della Camera Module 3 Wide (TNBA2004 / IMX708)
Controlla il file di configurazione boot:
- Su **Raspberry Pi OS Bookworm**: `sudo nano /boot/firmware/config.txt`
- Su **Raspberry Pi OS Bullseye**: `sudo nano /boot/config.txt`

Assicurati che sia presente:
```ini
camera_auto_detect=1
```
*(Se `camera_auto_detect=1` non rilevasse il modulo, aggiungi esplicitamente `dtoverlay=imx708`. Assicurati inoltre che **non** sia attiva la vecchia voce `start_x=1` della Legacy Camera, incompatibile con Camera Module 3).*

Riavvia se hai modificato `config.txt` (`sudo reboot`), poi testa la telecamera:
```bash
# Su Bookworm:
rpicam-hello --list-cameras

# Oppure su Bullseye:
libcamera-hello --list-cameras
```
Dovresti vedere nell'output:
```text
0 : imx708_wide [4608x2592 10-bit RGGB] (/base/soc/i2c0mux/i2c@1/imx708@1a)
```
Se leggi **`imx708_wide`**, la telecamera TNBA2004 è riconosciuta perfettamente!

### 3. Ottimizzazione Latenza Wi-Fi su Raspberry Pi 3 B v1.2
Il chip Wi-Fi del Pi 3 B v1.2 attiva di default il *Power Management*, che introduce picchi di ping di 100-300 ms. Disattivalo per una guida fluida:
```bash
sudo iw dev wlan0 set power_save off
```
*(Lo aggiungeremo anche automaticamente nello script di avvio / systemd).*

---

## 💻 5. Guida Server Centrale (LAN Porta 8080) — Docker su VM Alpine Linux

Il server centralizzato è completamente containerizzato tramite **`Dockerfile`** e **`docker-compose.yml`** basati su `node:22-alpine`.

> **⚠️ RETE DELLA VM (IMPORTANTE)**: Nelle impostazioni dell'hypervisor (Proxmox, VirtualBox, VMware), imposta la scheda di rete della VM Alpine Linux in modalità **Bridged (Scheda con Bridge)** e **non** in NAT! Solo in modalità Bridged la VM riceverà un IP della LAN del laboratorio (es. `192.168.1.100`) raggiungibile dai 6 tablet, dal Raspberry Pi e dallo Shelly 1.

---

### Opzione A (Consigliata): Installazione Docker + Docker Compose su Alpine Linux & Avvio Container

#### 1. Abilita il repository `community` su Alpine Linux
Accedi alla VM Alpine come `root` (o con `doas`/`sudo`) e apri il file dei repository:
```sh
vi /etc/apk/repositories
```
Assicurati che la riga che termina con **`/community`** **non** abbia il `#` davanti (decommentala), ad esempio:
```text
https://dl-cdn.alpinelinux.org/alpine/v3.20/main
https://dl-cdn.alpinelinux.org/alpine/v3.20/community
```
Salva ed esci (`ESC`, poi `:wq` + `Invio`).

#### 2. Installa Docker e Docker Compose v2 su Alpine
```sh
apk update
apk add docker docker-cli-compose git
```
*(Opzionale: se vuoi verificare o installare anche utility di rete utili per testare lo Shelly e il Pi: `apk add curl iproute2`.)*

#### 3. Abilita e avvia il servizio Docker con OpenRC
```sh
rc-update add docker default
service docker start
```
*(Se usi un utente non-root, es. `fermi`, aggiungilo al gruppo docker e rifai login: `addgroup fermi docker`.)*

Verifica che entrambi funzionino correttamente:
```sh
docker --version
docker compose version
```

#### 4. Avvia il Server Centralizzato in Docker (Porta `8080`)
Copia la cartella del progetto sulla VM Alpine (oppure clonalo con `git clone ...`) ed entra nella directory:
```sh
cd /opt/fermi-rover-server   # (o il percorso della cartella del progetto)
docker compose up -d --build
```
Cosa fa automaticamente `docker compose up -d --build`:
1. Compila il frontend React/Vite (`dist/`) e fa il bundle del server Node/WebSocket (`dist-server/server.js`) in uno stage builder.
2. Crea un'immagine finale Alpine Linux leggerissima in produzione.
3. Espone la WebUI e il server WebSocket `/ws` sulla porta **`8080`** con riavvio automatico (`restart: unless-stopped`).

Comandi utili per gestire il container su Alpine:
```sh
# Controlla che il container sia "Up (healthy)"
docker compose ps

# Vedi i log in tempo reale (connessioni tablet, Raspberry Pi e Shelly 1)
docker compose logs -f

# Verifica che l'API risponda localmente sulla porta 8080
wget -qO- http://127.0.0.1:8080/api/status

# Ferma / Riavvia il server
docker compose down
docker compose up -d
```

> **💡 Suggerimento Pro (Zero-NAT su Alpine VM)**: Nel file `docker-compose.yml` puoi facoltativamente decommentare `network_mode: host` (e commentare `ports:`) per avere latenza di rete nativa sulla VM Linux senza bridge NAT di Docker.

---

### Opzione B: Avvio Diretto Senza Docker (Node.js nativo)
1. Assicurati di avere **Node.js ≥ 20** installato (`node -v`).
2. Compila e avvia sulla **porta `8080`**:
   ```bash
   npm install
   npm run build
   PORT=8080 NODE_ENV=production npm start
   ```
   *(Su Windows PowerShell: `$env:PORT="8080"; $env:NODE_ENV="production"; npm start`)*

### C. Cosa fa il Codice Server (`server.ts`)
Il file `/server.ts` gestisce in un unico processo Express + WebSocket (`ws`):
1. **Serving della WebUI** (porta `8080`, accessibile da tutti i 6 tablet via HTTP).
2. **Server WebSocket `/ws`** con due ruoli:
   - `?role=tablet&tabletId=...&name=...`: identifica ciascuno dei 6 tablet.
   - `?role=robot`: identifica il Raspberry Pi 3 B v1.2, salva il suo IPv4 reale e aggiorna la telemetria.
3. **Gestione Turni (Slot-Lease)**:
   - Mantiene `queueState.activePilotId`, `timeRemainingSec` e la coda `queue`.
   - I pacchetti `drive:command` vengono inoltrati al robot **solo se provengono dal tablet che detiene il turno attivo**.
   - Allo scadere del timer (o disconnessione del pilota), invia immediatamente `{ type: 'drive', left: 0, right: 0 }` al robot e passa il turno al tablet successivo.
4. **Proxy Shelly 1 (`/api/shelly/toggle`)**:
   - Interroga periodicamente `http://<SHELLY_IP>/relay/0` ogni 4 secondi.
   - Al click sul pulsante in dashboard, invia `http://<SHELLY_IP>/relay/0?turn=on|off` e propaga il nuovo stato in tempo reale a tutti e 6 i tablet via WebSocket (`shelly:update`).
5. **Pannello Supervisore Docenti (`/api/admin/config`, `/api/admin/emergency-stop`)**:
   - Protetto da PIN (`fermi` o `1234`), consente di cambiare in diretta durata turno (15–180s), limite velocità (`40%`, `75%`, `100%`) e IP Shelly.

---

## 🤖 6. Guida Raspberry Pi — Quali File Importare, Codice & Avvio Automatico

### A. Quali file devi importare sul Raspberry Pi 3 B v1.2?
Sul Raspberry Pi **NON** devi copiare né Node.js, né la cartella `src/`, né i file Docker. Devi importare **SOLO 2 file** (più 1 opzionale) dalla cartella `raspberry_pi/` di questo progetto dentro `/home/pi/fermi_rover/`:

| File del Repository | Obbligatorio? | A cosa serve sul Raspberry Pi |
|---|---|---|
| **`raspberry_pi/robot_controller.py`** | ✅ **Sì (Obbligatorio)** | Script Python principale: pilota l'L298D/L298N via GPIO, trasmette lo stream video della Camera Module 3 Wide sulla porta `8081` e si connette via WebSocket al server centrale. |
| **`raspberry_pi/fermi_rover.service`** | ✅ **Consigliato** | Servizio `systemd` per avviare automaticamente lo script all'accensione del Raspberry Pi (e disattivare il risparmio energetico Wi-Fi). |
| `raspberry_pi/requirements.txt` | ⚪ *Opzionale* | Elenco di riferimento delle librerie Python (già installabili direttamente via `apt`). |

Esempio rapido per copiarli dal tuo PC al Raspberry Pi via `scp`:
```bash
ssh pi@<IP_RASPBERRY> "mkdir -p ~/fermi_rover"
scp raspberry_pi/robot_controller.py raspberry_pi/fermi_rover.service pi@<IP_RASPBERRY>:~/fermi_rover/
```

### B. Esecuzione Manuale su Raspberry Pi 3 B v1.2
Accedi al Raspberry Pi ed entra nella cartella:
```bash
cd ~/fermi_rover
```
Avvia lo script puntando all'IP della tua VM Alpine / Server centrale sulla porta **8080**:
```bash
python3 robot_controller.py --server ws://192.168.1.100:8080 --cam-port 8081
```
*(Sostituisci `192.168.1.100` con l'IP reale della VM Alpine sulla LAN del laboratorio!)*

Parametri opzionali supportati da `robot_controller.py`:
- `--server`: URL WebSocket del server centrale (default `ws://192.168.1.100:8080`)
- `--cam-port`: Porta dello stream MJPEG (default `8081`)
- `--width` / `--height` / `--fps`: Risoluzione e FPS Camera 3 Wide (default `640` x `360` a `24` fps — formato 16:9 nativo IMX708 che conserva tutto il grandangolo 120° senza appesantire la CPU 32-bit del Pi 3B)
- `--ena`, `--in1`, `--in2`, `--enb`, `--in3`, `--in4`: Override pin GPIO BCM se cablati diversamente

### B. Codice Completo Raspberry Pi (`raspberry_pi/robot_controller.py`)
Il file completo si trova in `/raspberry_pi/robot_controller.py`. Punti chiave implementati per **Pi 3 B v1.2 + Camera Module 3 Wide (TNBA2004)**:
- **`MJPEGEncoder` + `FileOutput(stream_output)`**: codifica hardware/nativa di `Picamera2` senza conversioni RGB→PIL in Python.
- **`controls.AfModeEnum.Continuous`**: abilita l'autofocus PDAF continuo specifico del sensore IMX708 (Camera Module 3 Wide).
- **`ThreadingHTTPServer`**: consente a **tutti i 6 tablet** di aprire contemporaneamente `http://<IP_PI>:8081/stream.mjpg` senza blocchi.
- **Watchdog 400ms**: arresto automatico dei motori in caso di assenza pacchetti.

### C. Avvio Automatico all'Accensione (`systemd`)
Per avviare il robot automaticamente appena si accende il Raspberry Pi (senza aprire il terminale durante l'Open Day):

1. Copia il file di servizio fornito in `/raspberry_pi/fermi_rover.service`:
```bash
sudo cp ~/fermi_rover/fermi_rover.service /etc/systemd/system/fermi_rover.service
```
2. Modifica se necessario l'IP del server e assicurati che lo user corrisponda al tuo utente (`pi` o il nome utente configurato in Raspberry Pi OS):
```bash
sudo nano /etc/systemd/system/fermi_rover.service
```
Contenuto consigliato (include disattivazione risparmio energetico Wi-Fi):
```ini
[Unit]
Description=Fermi Mantova Open Day Rover Controller
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/fermi_rover
ExecStartPre=-/sbin/iw dev wlan0 set power_save off
ExecStart=/usr/bin/python3 /home/pi/fermi_rover/robot_controller.py --server ws://192.168.1.100:8080 --cam-port 8081
Restart=always
RestartSec=3
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
```
3. Abilita e avvia il servizio:
```bash
sudo systemctl daemon-reload
sudo systemctl enable fermi_rover
sudo systemctl start fermi_rover
```
4. Controlla i log in tempo reale per verificare la connessione:
```bash
journalctl -u fermi_rover -f
```

---

## 📱 7. Configurazione dei 6 Tablet & Modalità Presentazione Sicura

1. Collega tutti e **6 i tablet** alla stessa rete Wi-Fi del laboratorio.
2. Apri Chrome (Android) o Safari (iPad) su ciascun tablet e visita:
   ```text
   http://192.168.1.100:8080
   ```
3. *(Consigliato)* Aggiungi la pagina alla **Schermata Home** ("Installa app" / "Aggiungi a Home") per aprirla a schermo intero senza barra degli indirizzi, ed attiva il blocco schermo / Modalità Kiosk (es. *Fissaggio schermo* su Android o *Accesso Guidato* su iPadOS) in modo che i visitatori non escano dal browser.
4. Nel selettore in alto su ciascun tablet scegli la sua postazione univoca:
   - Tablet 1 → `Tablet #1`
   - Tablet 2 → `Tablet #2`
   - ... fino a `Tablet #6`
5. **Come funziona per i visitatori**:
   - Tutti i tablet vedono costantemente il video live della **Camera Module 3 Wide** e lo stato aggiornato della **lampada Shelly 1** (che possono accendere/spegnere dal pannello dedicato).
   - Per guidare il robot, toccano **"PRENOTA TURNO DI GUIDA"**: chi è primo guida subito per 45 secondi, gli altri vedono la propria posizione in coda (`#1`, `#2`...) e il tempo stimato d'attesa.
   - Allo scadere del turno, i motori si fermano e i comandi passano automaticamente al tablet successivo.
6. **Pannello Docenti / Supervisori** (icona lucchetto 🔒 in alto a destra):
   - PIN di default: **`fermi`** oppure **`1234`**
   - Permette ai docenti di modificare l'IP dello Shelly 1, regolare la durata degli slot (20/30/45/60s), impostare il **Limitatore Velocità L298N** al **40% (Sicura Open Day)**, **75%** o **100%**, e attivare l'**E-STOP** d'emergenza.

---

## 🛠 8. Risoluzione Problemi (Troubleshooting)

| Sintomo | Causa Probabile | Soluzione |
|---|---|---|
| **`Picamera2` non rileva la camera / errore `no cameras available`** | Cavo ribbon inserito al contrario, connettore non bloccato o Legacy Camera attiva | Spegni il Pi 3B, controlla che i contatti argentati guardino verso l'HDMI; verifica `camera_auto_detect=1` (o `dtoverlay=imx708`) in `/boot/firmware/config.txt` ed esegui `rpicam-hello --list-cameras`. |
| **Il video si vede su 1 tablet ma si blocca sugli altri 5** | Firewall sul Pi o porta 8081 chiusa / vecchia versione non multi-thread | Assicurati di usare la versione aggiornata di `robot_controller.py` con `ThreadingHTTPServer` e verifica che i tablet raggiungano `http://<IP_PI>:8081/stream.mjpg`. |
| **I motori ronzano ma non girano o il Pi si riavvia all'avvio motori** | Massa `GND` non condivisa tra Pi e L298N, oppure Pi alimentato dai 5V dell'L298N / velocità troppo bassa | Collega `GND` Pi ↔ `GND` L298N; usa un Power Bank separato per il Pi 3 B v1.2; aumenta il limite velocità dal Pannello Docenti da 40% a 75% se i motori richiedono più coppia di spunto. |
| **Un motore gira al contrario rispetto al joystick** | Polarità dei due cavi del motore su `OUT1/OUT2` o `OUT3/OUT4` invertita | Inverti fisicamente i due fili del singolo motore sui morsetti dell'L298N. |
| **Latenza alta o comandi a scatti su Pi 3 B v1.2** | Risparmio energetico Wi-Fi `wlan0` attivo sul Pi 3B o risoluzione video troppo alta | Esegui `sudo iw dev wlan0 set power_save off` e mantieni la risoluzione stream a `640x360` @ `24fps`. |
| **Lo Shelly 1 mostra `SYNC ATTIVO` invece di `ONLINE (LAN)`** | IP dello Shelly diverso da `192.168.1.50` o Shelly Plus (Gen 2) | Apri il Pannello Docenti (🔒 PIN `fermi`) e inserisci l'IP corretto dello Shelly 1 nella LAN. |

---
*Realizzato per l'Open Day dell'I.S. Enrico Fermi di Mantova — Dipartimento di Telecomunicazioni.*
