# Wake-on-LAN Host Relay

Use this when the LabKom backend runs in Docker/container but the physical server host is on the same LAN as lab PCs.

## Why

Wake-on-LAN is a LAN broadcast. If Node.js sends the packet from inside a Docker bridge network, the packet can be marked as sent but still not wake a PC. The host server at `192.168.100.10/24` can send the same packet successfully to `192.168.100.255`, so production should send WoL through a host-side helper.

## Host helper

On the production server host, create `/usr/local/bin/labkom-wol`:

```bash
#!/usr/bin/env bash
set -euo pipefail

MAC="$1"
BROADCAST="${2:-192.168.100.255}"

node /srv/apps/labkom-apps/scripts/wol-send.js "$MAC" "$BROADCAST" "9,7"
```

Then make it executable:

```bash
chmod +x /usr/local/bin/labkom-wol
```

Test from the host:

```bash
/usr/local/bin/labkom-wol 58:11:22:A9:D5:8A 192.168.100.255
```

## Backend environment

Set these in backend production env:

```env
WOL_HOST_COMMAND=/usr/local/bin/labkom-wol
WOL_DEFAULT_BROADCAST=192.168.100.255
```

Restart backend after changing env.

## Dashboard test

In `/pc-monitoring`, open the PC, send `Wake on LAN`, and use:

```text
192.168.100.255
```

If it still fails, verify the PC MAC is the wired LAN MAC and that the host helper succeeds from the server shell.
