# LabKom PC Agent

Agent yang berjalan di setiap PC lab untuk monitoring hardware dan eksekusi remote command.

## Prerequisites

- Python 3.8+
- pip

## Instalasi

```bash
cd labkom-agent
pip install -r requirements.txt
```

## Konfigurasi

1. Generate token dari dashboard admin:
   - Login sebagai KOORDINATOR_LAB
   - Buka halaman PC Management
   - Klik "Generate Agent Token" pada PC yang diinginkan
   - Catat token yang muncul (hanya ditampilkan sekali)

2. Edit `config.json`:

```json
{
  "pc_code": "PC-LAB1-01",
  "agent_token": "TOKEN_DARI_DASHBOARD",
  "base_url": "http://SERVER_IP:5000/api/v1/pcs",
  "heartbeat_interval": 60,
  "command_poll_interval": 30
}
```

- `pc_code`: Kode PC sesuai yang terdaftar di sistem (unique)
- `agent_token`: Token yang di-generate dari dashboard
- `base_url`: URL backend API
- `heartbeat_interval`: Interval heartbeat dalam detik (default: 60)
- `command_poll_interval`: Interval polling command dalam detik (default: 30)

## Menjalankan

```bash
python agent.py
```

## Auto-Start

### Windows (Task Scheduler)

1. Buka Task Scheduler
2. Create Basic Task → nama "LabKom Agent"
3. Trigger: "When the computer starts"
4. Action: Start a program
   - Program: `python`
   - Arguments: `C:\path\to\labkom-agent\agent.py`
   - Start in: `C:\path\to\labkom-agent`
5. Centang "Run with highest privileges"

### Linux (systemd)

Buat file `/etc/systemd/system/labkom-agent.service`:

```ini
[Unit]
Description=LabKom PC Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/labkom-agent
ExecStart=/usr/bin/python3 /opt/labkom-agent/agent.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable labkom-agent
sudo systemctl start labkom-agent
```

## Fitur

- **Heartbeat**: Kirim status CPU, RAM, storage, uptime setiap 60 detik
- **Command Execution**: Terima dan eksekusi SHUTDOWN, RESTART, SLEEP, LOCK, MESSAGE
- **Auto-Register**: Otomatis register saat pertama kali jalan
- **Warning Detection**: Server otomatis buat warning jika CPU/RAM/Storage > 90%
- **Logging**: Log aktivitas ke file lokal dan ke server

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| "config.json tidak ditemukan" | Pastikan config.json ada di folder yang sama dengan agent.py |
| "Agent token tidak valid" | Generate ulang token dari dashboard |
| "PC tidak ditemukan" | Pastikan pc_code di config.json sesuai dengan yang terdaftar di sistem |
| Agent tidak bisa connect | Pastikan backend berjalan dan URL di base_url benar |
| Permission denied (shutdown) | Jalankan agent sebagai Administrator/root |

## Log

Log tersimpan di `logs/agent.log`. Rotasi manual jika diperlukan.
