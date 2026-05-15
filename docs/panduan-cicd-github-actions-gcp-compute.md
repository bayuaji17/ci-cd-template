# Panduan CI/CD dengan GitHub Actions dan Compute Instance GCP Tanpa Docker

Panduan ini menjelaskan setup CI/CD untuk repo Node.js/TypeScript ini menggunakan GitHub Actions, Compute Instance GCP sebagai VPS, dan PM2 sebagai process manager. Deployment tidak menggunakan Docker.

## Gambaran Alur

Branch permanen yang digunakan:

```text
staging -> main
```

Alur kerja:

```text
Pull Request ke staging -> CI
Push ke staging         -> CI
Push ke main            -> CI + CD production
```

Workflow yang dipakai:

```text
.github/workflows/ci-staging.yml
.github/workflows/cd-production.yml
```

Script aplikasi yang digunakan workflow:

```bash
npm run lint
npm test
npm run build
npm start
```

## CI Staging

File CI staging:

```text
.github/workflows/ci-staging.yml
```

Workflow ini berjalan saat:

```yaml
on:
    pull_request:
        branches:
            - staging
    push:
        branches:
            - staging
```

Step CI:

```text
checkout repository
setup Node.js 24
npm ci
npm run lint
npm test
npm run build
```

Tujuannya adalah memastikan kode yang masuk ke `staging` sudah lolos lint, test, dan build.

Perintah membuat branch `staging` dari `main`:

```bash
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

Contoh alur feature:

```bash
git checkout staging
git pull origin staging
git checkout -b feature/example
```

Setelah commit dan push, buat Pull Request:

```text
feature/example -> staging
```

## CD Production

File CD production:

```text
.github/workflows/cd-production.yml
```

Workflow ini berjalan saat:

```yaml
on:
    push:
        branches:
            - main
    workflow_dispatch:
```

Artinya:

- setiap push atau merge ke `main` akan langsung deploy ke production
- workflow juga bisa dijalankan manual dari tab GitHub Actions

Step CD:

```text
checkout repository
setup Node.js 24
npm ci
npm run lint
npm test
npm run build
prepare release artifact
validate deployment secrets
configure SSH
create app directory on VPS
upload release using rsync
npm ci --omit=dev on VPS
start or reload PM2 process
pm2 save
```

Artifact yang dikirim ke VPS:

```text
dist/
package.json
package-lock.json
```

Dependency production diinstall di VPS dengan:

```bash
npm ci --omit=dev
```

Aplikasi dijalankan oleh PM2:

```bash
pm2 start dist/index.js --name cicd-template
```

Jika process sudah ada, workflow akan menjalankan:

```bash
pm2 reload cicd-template --update-env
```

## Persiapan Compute Instance GCP

Gunakan Compute Instance dengan Ubuntu LTS. Buka firewall untuk:

```text
22  SSH
80  HTTP
443 HTTPS
```

Install tools dasar:

```bash
sudo apt update
sudo apt install -y curl nginx rsync
```

Repo ini memakai Node.js 24. Jika memakai `nvm`, install Node.js 24:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 24
nvm use 24
```

Cek:

```bash
node -v
npm -v
```

Install PM2 pada user yang dipakai deploy:

```bash
npm install -g pm2
pm2 -v
```

Pada contoh ini user VPS yang dipakai adalah user default dari Compute Instance:

```text
gcp-user
```

Folder aplikasi yang disarankan:

```text
/home/gcp-user/apps/cicd-template
```

Buat folder aplikasi:

```bash
mkdir -p /home/gcp-user/apps/cicd-template
```

## Setup SSH Key

Buat SSH key di komputer lokal:

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions-cicd-template" -f github-actions-deploy-key
```

File yang terbentuk:

```text
github-actions-deploy-key      -> private key
github-actions-deploy-key.pub  -> public key
```

Public key dipasang di VPS pada user deploy. Karena user yang dipakai adalah `gcp-user`, file tujuannya:

```text
/home/gcp-user/.ssh/authorized_keys
```

Di VPS:

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
```

Paste isi public key, lalu set permission:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

Test dari komputer lokal:

```bash
ssh -i ./github-actions-deploy-key gcp-user@IP_VPS
```

Jika test SSH berhasil, GitHub Actions juga bisa menggunakan key yang sama.

## GitHub Secrets

Tambahkan secrets di:

```text
GitHub Repository -> Settings -> Secrets and variables -> Actions
```

Secrets yang dibutuhkan:

```text
VPS_HOST=IP_VPS
VPS_USER=gcp-user
VPS_PORT=22
VPS_APP_DIR=/home/gcp-user/apps/cicd-template
VPS_SSH_KEY=isi private key github-actions-deploy-key
```

`VPS_SSH_KEY` harus berisi private key, bukan public key.

Contoh format private key:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

## Setup Nginx

Buat file config:

```bash
sudo nano /etc/nginx/sites-available/cicd-template
```

Isi:

```nginx
server {
    listen 80;
    server_name IP_VPS;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan config:

```bash
sudo ln -s /etc/nginx/sites-available/cicd-template /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Jika nanti sudah memakai domain, ubah:

```nginx
server_name IP_VPS;
```

menjadi:

```nginx
server_name example.com;
```

## Deploy ke Production

Merge `staging` ke `main`:

```bash
git checkout main
git pull origin main
git merge staging
git push origin main
```

Setelah push ke `main`, workflow `CD Production` akan berjalan otomatis.

Cek hasil deploy dari VPS:

```bash
pm2 status
pm2 logs cicd-template
curl http://localhost:3000/health
```

Cek dari browser:

```text
http://IP_VPS/health
```

## Troubleshooting

### Permission denied publickey

Error:

```text
Permission denied (publickey)
```

Penyebab umum:

- `VPS_USER` tidak sesuai dengan user pemilik `authorized_keys`
- public key belum dipasang di VPS
- `VPS_SSH_KEY` berisi public key, bukan private key
- permission `.ssh` atau `authorized_keys` salah

Pastikan:

```text
VPS_USER=gcp-user
public key ada di /home/gcp-user/.ssh/authorized_keys
VPS_SSH_KEY berisi private key github-actions-deploy-key
```

Test dari lokal:

```bash
ssh -i ./github-actions-deploy-key gcp-user@IP_VPS
```

### npm command not found

Error:

```text
npm: command not found
```

Penyebab:

- Node/npm di VPS dipasang melalui `nvm`
- SSH non-interactive dari GitHub Actions tidak otomatis membaca `.bashrc`

Workflow sudah menangani ini dengan:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 24
```

Pastikan Node.js 24 dan PM2 sudah ada pada user yang dipakai deploy:

```bash
nvm use 24
npm -v
npm install -g pm2
pm2 -v
```

### PM2 app belum ada

Tidak masalah. Workflow akan membuat process baru dengan:

```bash
pm2 start dist/index.js --name cicd-template
```

Jika process sudah ada, workflow akan reload:

```bash
pm2 reload cicd-template --update-env
```

### Port 3000 tidak bisa diakses dari browser

Aplikasi Node berjalan di localhost port `3000`. Browser sebaiknya mengakses lewat Nginx pada port `80`.

Cek aplikasi:

```bash
curl http://localhost:3000/health
```

Cek Nginx:

```bash
sudo nginx -t
sudo systemctl status nginx
```

## Catatan

Untuk saat ini hanya ada satu VPS, jadi `main` langsung deploy ke production. Jika nanti ada VPS kedua, alur bisa dikembangkan menjadi:

```text
staging -> deploy staging VPS
main    -> deploy production VPS
```
