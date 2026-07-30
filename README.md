# RePrompter

RePrompter adalah aplikasi teleprompter cerdas berbasis web yang dirancang untuk memberikan pengalaman membaca naskah yang lebih natural bagi presenter konten, jurnalis, atau kreator video. 

Berbeda dengan teleprompter tradisional yang sekadar menggulir teks secara konstan, RePrompter menggunakan **Rhythm Engine** (Mesin Irama) yang memecah naskah menjadi frasa logis dan mengatur tempo secara dinamis berdasarkan tanda baca dan panjang karakter kata, memberikan waktu bernapas alami bagi pembaca.

## Fitur Utama

- **Smart Pacing & Dynamic Rhythm**
  Teks tidak digulir, melainkan ditampilkan frasa demi frasa dengan tempo (WPM) yang dapat diatur. Sistem secara cerdas menambahkan jeda otomatis untuk tanda baca (titik, koma, tanda tanya) dan memberikan ekstra waktu dinamis untuk kata-kata yang sangat panjang.

- **Fokus Mode & Layar Penuh**
  Antarmuka minimalis tanpa gangguan saat membaca naskah. Mendukung kustomisasi ukuran fon, lebar area baca, dan posisi teks (Tengah, Sepertiga Atas, dll).

- **Sistem Perekaman Terintegrasi (Kamera)**
  Aplikasi ini dapat langsung merekam wajah Anda dari kamera web (webcam) sembari Anda membaca naskah. Mendukung mode cermin (Mirror Mode) untuk perangkat teleprompter kaca asli, serta pengaturan codec, rasio bingkai (framerate 24/30/60fps), dan rasio aspek portrait/landscape.

- **PREMO (Prompter Remote Mode)**
  Kendali jarak jauh nirkabel (*Wireless Remote Control*). Jadikan ponsel Anda sebagai **Kontroler** dan komputer Anda sebagai **Monitor**. Keduanya akan tersinkronisasi secara langsung (*real-time*) dengan jeda nyaris nol melalui Firebase.

- **Dynamic QR Code Scanner**
  Proses penyambungan PREMO antara Kontroler dan Monitor tidak lagi harus mengetik kode manual. Perangkat Monitor dapat secara langsung membuka kamera dan memindai kode QR yang tampil di perangkat Kontroler.

## Tumpukan Teknologi

- **Frontend Framework:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS v4
- **Realtime Sync:** Firebase Cloud Firestore
- **Motion & Scroll:** Framer Motion, Lenis Scroll
- **QR & Kamera:** jsQR, Lucide-react (Ikon)

## Cara Menggunakan (Pengembangan Lokal)

1. Pastikan Anda telah memasang **Node.js** (disarankan versi 18 ke atas).
2. Kloning repositori ini dan masuk ke direktori proyek.
3. Pasang dependensi menggunakan manajer paket (npm):
   ```bash
   npm install
   ```
4. Buat file `.env` dan masukkan konfigurasi Firebase Anda (jika diperlukan untuk PREMO Mode).
5. Jalankan peladen pengembangan lokal:
   ```bash
   npm run dev
   ```
6. Buka peramban dan akses aplikasi sesuai URL yang diberikan (umumnya `http://localhost:5173`).

## Cara Membangun untuk Produksi

Untuk menghasilkan bundel produksi statis, jalankan:
```bash
npm run build
```
Hasil pembangunan akan berada di dalam direktori `dist`, siap untuk diunggah ke Vercel, Netlify, atau layanan hosting statis lainnya.

## Pengembang

Aplikasi ini dikembangkan oleh **Fatih Farhat Asshidiq**. 
Untuk umpan balik, masukan, pelaporan kutu (bug), atau pertanyaan lebih lanjut, silakan hubungi melalui surel: kazokuhairy@gmail.com

---

### Catatan Desain
Proyek ini mengutamakan standar desain antarmuka (UI) minimalis dan fungsional tanpa elemen dekoratif berlebih. Setiap elemen visual dan tulisan dibuat berlandaskan fungsi nyata dan mengutamakan kemudahan navigasi pengguna.
