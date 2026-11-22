# Multi-Business Omnichannel Platform — Neon PostgreSQL + Vercel Ready

Platform pusat operasional untuk mengelola banyak usaha berbeda (Fashion, F&B, Jasa, Ritel) dalam satu sistem terpadu dengan arsitektur berlapis (*Clean Layered Architecture*) dan **Neon PostgreSQL (`@neondatabase/serverless`)**.

---

## Cara Deploy ke Vercel + Neon PostgreSQL (3 Langkah Ringkas)

Karena akun **Neon PostgreSQL** Anda sudah terhubung ke **Vercel**, Anda tidak perlu setup manual yang rumit:

### Langkah 1 — Upload Proyek ke GitHub & Hubungkan ke Vercel
1. Push folder proyek ini ke repositori GitHub Anda (pastikan `.env.local` tidak ikut ter-upload — sudah otomatis diblokir oleh `.gitignore`).
2. Di Dashboard **Vercel**, import repositori tersebut ke project Anda yang sudah terhubung dengan integrasi **Neon PostgreSQL** (Vercel otomatis menyuntikkan variabel `DATABASE_URL`).

### Langkah 2 — Tambahkan 4 Environment Variables di Vercel
Buka **Vercel Project → Settings → Environment Variables**, lalu tambahkan 4 variabel ini:
- `JWT_SECRET` → isi string acak panjang minimal 32 karakter (contoh: `khaluna-omnichannel-prod-secret-9988776655`)
- `OWNER_NAME` → nama Anda (contoh: `Pemilik Usaha`)
- `OWNER_EMAIL` → email untuk login (contoh: `owner@bisnisanda.com`)
- `OWNER_PASSWORD` → password kuat pilihan Anda

*(Catatan: `DB_PROVIDER` tidak wajib diisi karena sistem otomatis mendeteksi `DATABASE_URL` dari Neon dan langsung mengaktifkan `NeonPostgresAdapter`).*

### Langkah 3 — Deploy & Langsung Login!
1. Klik **Deploy** (atau **Redeploy** setelah menambah env var).
2. Buka alamat website Vercel Anda → login menggunakan `OWNER_EMAIL` dan `OWNER_PASSWORD`.
3. **Otomatis:** Saat login pertama kali, sistem otomatis menjalankan inisialisasi skema (`CREATE TABLE IF NOT EXISTS`) untuk seluruh **14 tabel operasional + tabel `auth_credentials`** di Neon PostgreSQL!
4. Cek menu **Settings** untuk melihat status **NEON** dan jumlah baris pada seluruh 14 tabel.

---

## Menjalankan Secara Lokal (Opsional)
1. Instal dependensi (butuh **Node.js 20 LTS**):
   ```bash
   npm install
   ```
2. Tarik environment variable dari Vercel (atau salin `.env.example` ke `.env.local` dan isi `DATABASE_URL`):
   ```bash
   vercel env pull .env.local
   ```
3. (Opsional) Inisialisasi tabel dari CLI atau gunakan file [sql/001_initial_schema.sql](sql/001_initial_schema.sql) di Neon SQL Editor:
   ```bash
   npm run db:init
   ```
4. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
