# Deploy Fimbria

**Fimbria — Live lessons, shared understanding.**

Fimbria is the application name; **https://fimbria.lattice-1.com** is the proposed public address under lattice-1.com. The name offers a subtle anatomical connection for medical teaching while leaving room for other subjects. Keep the plain-language descriptor visible so newcomers understand its purpose. Students join by a six-digit room code or QR link.

This guide prepares deployment; DNS, TLS and hosting still need to be configured.

## Target architecture

Run one application container in a Linux VM on Proxmox, initially with 2 vCPUs and 2 GB RAM. The container serves React, Express and Socket.IO from the same origin. SQLite lives in the persistent lesson-data Docker volume. Use a single replica.

Route HTTPS through your existing reverse proxy. Forward both WebSocket upgrades and HTTP long polling. If the proxy runs on the same VM, keep the application bound to loopback. If it runs on a different machine, bind to the VM's private IP and allow port 3000 only from the proxy.

## DNS and HTTPS

1. Add a DNS record for fimbria.lattice-1.com pointing to your public ingress address. Only publish an AAAA record if IPv6 routing works too.
2. Route that hostname to the VM's application service.
3. Issue a valid TLS certificate and redirect HTTP to HTTPS.
4. Preserve the original Host, Origin and Cookie headers. Forward /socket.io/ as well as the frontend/API; disable caching for /api/ and /socket.io/.

For Caddy installed on the **same VM** as the app, a minimal Caddyfile site is:

~~~caddyfile
fimbria.lattice-1.com {
  reverse_proxy 127.0.0.1:3000
}
~~~

With DNS and ports 80/443 correctly routed to Caddy, it can obtain the HTTPS certificate automatically. See the official [Caddy reverse-proxy guide](https://caddyserver.com/docs/quick-starts/reverse-proxy). Use your existing proxy's equivalent configuration if you already have one. A proxy in another container needs a reachable host address or shared Docker network; its own loopback does not reach the app container.

## Configure and start

Install Docker Engine and Docker Compose on the Linux VM. Copy this repository there, including the lockfile. Run commands from the project directory.

Create .env alongside compose.yaml:

~~~dotenv
PUBLIC_BASE_URL=https://fimbria.lattice-1.com
COOKIE_SECURE=true
BIND_ADDRESS=127.0.0.1
SESSION_TTL_HOURS=24
~~~

Use the exact public origin without a trailing slash or path. It controls QR links and request origin checks. Secure cookies require HTTPS in the browser; TLS may terminate at the proxy. For a proxy on another machine, replace BIND_ADDRESS with the VM's private IP.

Compose reads .env for the variables referenced in this repository's configuration; shell values can override them. See [Docker's interpolation documentation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/).

~~~sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app
curl --fail http://127.0.0.1:3000/api/health
~~~

If bound to a private IP, use that IP in the health check. Expected response: {"ok":true}. Compose includes a health check and restart: unless-stopped; ensure Docker starts automatically when the VM boots.

The app needs outbound HTTPS access to raw.githubusercontent.com for GitHub lesson imports. No GitHub token or email service is required.

## Create or reset the teacher password

Start the server once so its tables exist, then run in a Bash terminal:

~~~bash
read -rs -p 'Teacher password (12+ characters): ' TEACHER_PASSWORD
echo
export TEACHER_PASSWORD
docker compose exec -e TEACHER_PASSWORD app node scripts/teacher-container.mjs
unset TEACHER_PASSWORD
~~~

This sets the single teacher password and revokes existing teacher sessions. Choose a new production password rather than the local demonstration password. Passwords are hashed; login cookies expire after 12 hours. Keep credentials outside the image and repository.

Visit **https://fimbria.lattice-1.com**, sign in, and upload examples/intro.json or import a public GitHub JSON link. Preview the lesson, start a session, and open the presentation display. Student entry: **https://fimbria.lattice-1.com/join**.

## Typography and themes

Fimbria pairs editorial serif headings with a readable sans-serif interface using local system fonts; there is no external font request. The header offers **System**, **Light**, **Dark** and warm **Paper** themes on teacher, student and presentation screens.

System follows the device's light/dark preference. Selection persists in that browser's local storage across refreshes. Each device chooses independently; changing the teacher's theme does not change student screens. If storage is blocked, selection works for the current page.

## Verify before a class

- Complete the sample lesson with a teacher, display and two separate student browsers.
- Check QR codes and join links use https://fimbria.lattice-1.com.
- Confirm students cannot access teacher controls or see answers before reveal.
- Import a public GitHub lesson, including a commit permalink for a fixed version.
- Check all themes and narrow phone layouts; test keyboard focus and answer controls.
- Refresh after voting, reconnect Wi-Fi, and restart the app between test steps. Confirm recorded answers and progress return.
- Test physical phones after screen locking, and rehearse backup restoration.

From a separate machine with Node 24.16+ and this repository installed, run:

~~~bash
export TEST_BASE_URL=https://fimbria.lattice-1.com
read -rs -p 'Teacher password: ' TEACHER_PASSWORD
echo
export TEACHER_PASSWORD
npm run test:classroom -- --students 40 --duration 30m
npm run test:classroom -- --students 40 --duration 60m
unset TEACHER_PASSWORD
~~~

Record errors, unexpected disconnects, p95 update/acknowledgement latency and recovery behavior. Use docker stats on the VM for server CPU/memory; simulator resource figures describe its own process. Acceptance targets: p95 below 500 ms, no lost acknowledged answers, and recovery within five seconds of connection restoration. These remain targets until measured on this deployment.

## Back up and restore

Create a consistent online SQLite backup:

~~~sh
docker compose exec app node --input-type=module -e "import {DatabaseSync,backup} from 'node:sqlite'; const db=new DatabaseSync('/app/data/app.sqlite'); await backup(db,'/app/data/backup.sqlite'); db.close();"
docker compose cp app:/app/data/backup.sqlite ./fimbria-backup.sqlite
~~~

Move timestamped copies to protected storage outside the VM. Backups contain teacher authentication data, lessons and participant records. Do not copy an active app.sqlite file alone; it may have uncheckpointed WAL data.

To restore a chosen backup, first stop the application. These commands replace current data:

~~~sh
docker compose stop app
docker compose cp ./fimbria-backup.sqlite app:/app/data/app.sqlite
docker compose run --rm --no-deps --user root --entrypoint sh app -c 'rm -f /app/data/app.sqlite-wal /app/data/app.sqlite-shm; chown 1000:1000 /app/data/app.sqlite; chmod 600 /app/data/app.sqlite'
docker compose up -d app
~~~

Verify the health endpoint, teacher login, saved lesson, room position and recorded answer. Rehearse in a disposable environment before restoring a live class. Never use docker compose down -v unless you intend to delete persistent data.

## Updates and troubleshooting

Schedule updates between classes. Save a backup, copy the new source and lockfile, then run docker compose up -d --build. Keep the previous release and matching backup for rollback. Restarts interrupt connections briefly; clients reconnect and recover snapshots.

- **Origin rejected:** PUBLIC_BASE_URL must exactly match the browser's scheme/hostname/port. Recreate the container after configuration changes.
- **Login does not persist:** confirm the public page uses HTTPS with COOKIE_SECURE=true.
- **QR code contains localhost/private IP:** correct PUBLIC_BASE_URL and recreate the container.
- **Connections drop:** inspect proxy WebSocket forwarding, idle timeouts, and /socket.io/ caching.
- **GitHub import fails:** check the repository/file is public, the file matches the schema/size limit, and outbound HTTPS is allowed.
- **Data disappeared:** check the named volume and Compose project name; changing project names can select a different volume.

DNS, certificates, proxy access, Proxmox deployment, sustained tests and phone checks must be performed on the target infrastructure. Local checks are recorded separately in VALIDATION.md.
