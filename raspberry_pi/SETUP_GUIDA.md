# 📡 GUIDA PASSO-PASSO | OPEN DAY TELECOMUNICAZIONI I.S. FERMI MANTOVA
## Progetto Rover Teleoperato Raspberry Pi + L298N + CSI Cam + Shelly 1

Questa guida descrive in modo chiaro e pratico come assemblare, configurare ed eseguire il sistema rover per l'Open Day, collegando 6 tablet contemporaneamente con coda temporizzata e feedback in tempo reale.

---

### 1. 🔌 SCHEMA DEI COLLEGAMENTI ELETTRICI

#### A. Collegamento Raspberry Pi (40 Pin GPIO) <---> Ponte H L298N
> **⚠️ REGOLA D'ORO**: Collega SEMPRE il **GND del Raspberry Pi** al **GND dell'L298N** (massa comune). Altrimenti i segnali logici fluttuano e i motori vibrano!

| Segnale L298D / L298N | Pin Fisico Header | GPIO BCM (Python) | WiringPi | Funzione |
|---|---|---|---|---|
| **ENA** *(Rimuovere jumper nero)* | Pin 32 | **GPIO 12** | 26 | Velocità PWM Motore Sinistro |
| **IN1** | Pin 16 | **GPIO 23** | 4 | Direzione Sinistra (A) |
| **IN2** | Pin 18 | **GPIO 24** | 5 | Direzione Sinistra (B) |
| **IN3** | Pin 11 | **GPIO 17** | 0 | Direzione Destra (A) |
| **IN4** | Pin 13 | **GPIO 27** | 2 | Direzione Destra (B) |
| **ENB** *(Rimuovere jumper nero)* | Pin 33 | **GPIO 13** | 23 | Velocità PWM Motore Destro |
| **GND** | Pin 6, 14 o 20 | **GND** | - | Massa comune |

#### B. Alimentazione Motori L298N
* **VMS (+12V o +7.4V)**: Polo POSITIVO del pacco batterie dei motori (es. 2 celle Li-Ion 18650 in serie = 7.4V o 8.4V a piena carica, oppure batteria 12V al piombo/LiPo).
* **GND**: Polo NEGATIVO del pacco batterie **E** collegato al GND del Raspberry Pi.
* **5V sull'L298N**: Se il jumper del regolatore interno dell'L298N è inserito, il morsetto 5V è un'uscita (può alimentare il Pi se il pacco batterie è > 7V, altrimenti alimenta il Raspberry Pi tramite la sua porta USB-C dedicata con power bank separato per evitare reset da spike induttivi).

#### C. Telecamera CSI
* Inserisci il cavo ribbon flessibile nel connettore **CAMERA** del Raspberry Pi sollevando delicatamente il fermo in plastica.
* **Orientamento contatti**: i contatti argentati devono essere rivolti verso la presa HDMI (o verso l'interno della scheda), mentre la linguetta blu/nera guarda verso la porta USB/Ethernet.

#### D. Shelly 1 (Lampada sul Pannello Stand)
* **L (Line)**: Fase 230V AC (o +12V DC se configurato con jumper DC)
* **N (Neutral)**: Neutro 230V AC (o GND in DC)
* **I (Input)**: Collegato alla Fase (o polo positivo)
* **O (Output)**: Collegato al morsetto della lampadina
* La lampadina chiude l'altro polo sul Neutro.
* Assegna allo Shelly un IP statico nel router del laboratorio (es. `192.168.1.50`).

---

### 2. ⚡ INSTALLAZIONE RAPIDA SU RASPBERRY PI

Accedi via SSH al Raspberry Pi (`ssh pi@<IP_RASPBERRY>`) ed esegui:

```bash
# 1. Aggiorna i pacchetti di sistema
sudo apt update && sudo apt install -y python3-pip python3-picamera2 python3-gpiozero git

# 2. Crea la cartella del progetto
mkdir -p ~/fermi_rover && cd ~/fermi_rover

# 3. Scarica o copia robot_controller.py e requirements.txt
pip3 install websocket-client pillow --break-system-packages

# 4. Testa lo script manualmente (sostituisci l'IP con quello del server WebUI)
python3 robot_controller.py --server ws://192.168.1.100:3000 --cam-port 8081
```

---

### 3. 🚀 AVVIO AUTOMATICO ALL'ACCENSIONE (SYSTEMD)

Per far partire il robot in autonomia appena collegata la batteria:

```bash
# Copia il file di servizio
sudo cp fermi_rover.service /etc/systemd/system/fermi_rover.service

# Modifica l'IP del server se necessario
sudo nano /etc/systemd/system/fermi_rover.service

# Abilita e avvia il servizio
sudo systemctl daemon-reload
sudo systemctl enable fermi_rover
sudo systemctl start fermi_rover

# Verifica lo stato
sudo systemctl status fermi_rover
```

---

### 4. 📱 GESTIONE DEI 6 TABLET PER L'OPEN DAY

1. Collega tutti i 6 tablet alla stessa rete Wi-Fi (es. `FERMI-OPEN-DAY` a 5 GHz).
2. Apri Google Chrome o Safari su ciascun tablet e digita l'URL del server:
   `http://192.168.1.100:3000` (oppure la porta 8080 impostata).
3. **Modalità Presentazione Sicura**:
   - I ragazzi visitatori vedono la telecamera a pieno schermo e la lampada Shelly.
   - Per guidare, toccano il pulsante **"PRENOTA GUIDA"**.
   - Il server gestisce i turni (es. 45 secondi a testa).
   - Quando scade il turno, i motori si fermano istantaneamente e il controllo passa al tablet successivo in coda.
   - Tutti i tablet continuano a vedere lo stream video e la posizione del robot.
4. **Pannello Docenti / Supervisori**:
   - Clicca sull'icona dell'ingranaggio in alto a destra e inserisci il PIN docenti: `fermi` (oppure `1234`).
   - Puoi modificare la durata dei turni (15s - 120s), limitare la velocità massima (40% Sicura, 75% Standard, 100% Turbo), cambiare l'IP dello Shelly 1 ed espellere un pilota se necessario.
