# Hydrovoltiger

Sistem monitoring berbasis web, dengan integrasi Firebase untuk autentikasi dan database, serta AI Assistant berbasis Gemini untuk analisis dan penjelasan kondisi sistem.

Repo ini berisi:
- Halaman login, dashboard utama, dan komponen pendukung (HTML/CSS/JS).
- Integrasi Firebase (Auth, Realtime Database, Storage).
- AI Assistant di sisi frontend yang memanggil backend Node.js kecil untuk mengakses Gemini API secara aman (menggunakan `.env`).

---

## 1. Prasyarat

- Node.js dan npm ter‑install.
- Akun Firebase dan project yang sudah dikonfigurasi (sudah digunakan di file JS kamu).
- API Key Gemini dari **Google AI Studio / Google AI for Developers**.

---

## 2. Konfigurasi Environment (`.env`)

Buat file `.env` di root project (sudah di‑ignore di `.gitignore`). Contoh minimal untuk AI backend:

```env
GEMINI_API_KEY=API_KEY_GEMINI_DARI_GOOGLE_AI_STUDIO
GEMINI_MODEL=gemini-2.0-flash
PORT=3000
```

> **Catatan:** Jangan pernah commit `.env` ke repository publik.

Firebase Web API key tetap disimpan di file JS frontend (seperti sekarang) karena ketentuan Firebase memang memperbolehkan itu. Untuk keamanan lebih lanjut, bisa dipindah ke backend di masa depan.

---

## 3. Instalasi Dependency

Di root project:

```bash
npm install
```

Ini akan meng‑install:
- `express`, `cors`, `dotenv` untuk backend AI.
- `firebase` dan `live-server` sesuai kebutuhan project.

---

## 4. Menjalankan Backend AI (Gemini)

Backend AI didefinisikan di `server.js` dan menggunakan `.env` untuk membaca `GEMINI_API_KEY`.

Jalankan backend dengan:

```bash
npm start
```

Secara default server akan berjalan di `http://localhost:3000` dengan endpoint:

- `GET  /api/health` → pengecekan kesehatan server.
- `POST /api/ai`     → menerima `{ prompt }` dan mengembalikan `{ text }` dari Gemini.

Jika `GEMINI_API_KEY` belum diset, server akan memperingatkan di console dan permintaan ke `/api/ai` akan gagal.

---

## 5. Menjalankan Frontend

Frontend berupa HTML/JS statis (misalnya `login/login.html`, `main.html`, dll.).

Pilihan untuk pengembangan lokal:

- Menggunakan `live-server` (sudah ada di dependencies):

  ```bash
  npx live-server
  ```

  Lalu buka halaman utama (misalnya `main.html` atau `login/login.html`).

- Atau gunakan extension Live Server di VS Code / IDE yang kamu pakai.

Pastikan backend (`npm start`) sudah berjalan, karena AI Assistant di frontend memanggil `http://localhost:3000/api/ai`.

---

## 6. Cara Kerja AI Assistant

- Frontend (`ai_assistant/ai.js`):
  - Mengambil input user dari UI chat.
  - Menyusun `prompt` dengan konteks sistem Hydrovoltiger.
  - Mengirim `POST` ke `/api/ai` (backend) dengan body `{ prompt }`.
  - Menampilkan respons AI (Markdown → HTML) di panel chat.

- Backend (`server.js`):
  - Membaca `GEMINI_API_KEY` dan `GEMINI_MODEL` dari `.env`.
  - Memanggil endpoint resmi Gemini: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
  - Mengembalikan teks hasil AI ke frontend.

Dengan arsitektur ini, API key Gemini **tidak pernah muncul di kode frontend** dan tidak ikut ter‑publish ketika project di‑hosting sebagai static site.

---

## 7. Catatan Hosting / Deployment

Karena sekarang ada backend Node.js, deployment umumnya dipisah menjadi:

- **Frontend**: dihosting sebagai static site (GitHub Pages, Netlify, Vercel static, dsb.).
- **Backend**: dihosting di layanan Node (Render, Railway, Vercel serverless functions, dsb.), dengan `.env` diatur di dashboard mereka.

Setelah backend di‑hosting, ubah URL di `ai_assistant/ai.js` dari:

```js
fetch("http://localhost:3000/api/ai", ...)
```

menjadi misalnya:

```js
fetch("https://nama-backend-kamu.onrender.com/api/ai", ...)
```

---

## 8. Perintah NPM yang Tersedia

```bash
npm test   # placeholder bawaan
npm start  # menjalankan backend AI (server.js)
```

Tidak ada script `npm run dev` di project ini. Untuk pengembangan gunakan:
- `npm start` untuk backend.
- `npx live-server` atau live server lain untuk frontend.