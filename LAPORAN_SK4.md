# LAPORAN SK-4: Frontend Interaktif (Leaflet JS)

## Kelompok 14 — PjBL SIG Dasar

---

## 1. Ringkasan Singkat

Aplikasi Web GIS interaktif untuk pemetaan fasilitas Pendidikan Anak Usia Dini (PAUD), Taman Kanak-Kanak (TK), dan Daycare di Kecamatan Pontianak Utara, Kota Pontianak, Kalimantan Barat. Frontend dibangun dengan Leaflet JS dan terhubung langsung ke backend Express.js di `server.js`.

---

## 2. Skenario & Dataset Kelompok

| Item | Detail |
|------|--------|
| **Kelompok** | Kelompok 14 |
| **Topik** | Pemetaan Fasilitas PAUD, TK & Daycare di Pontianak Utara |
| **Wilayah Kajian** | Kecamatan Pontianak Utara, Kota Pontianak, Kalimantan Barat |
| **File GeoJSON Titik** | `data/paud_north.geojson` (32 fitur titik) |
| **File GeoJSON Poligon** | `data/zona_pendidikan_anak.geojson` (2 fitur poligon zona) |
| **Koordinat Titik Tengah** | Lat: 0.0095, Lng: 109.3261 |
| **Bounding Box** | Lng: 109.2898 – 109.3624, Lat: -0.0129 – 0.0320 |

### Atribut Fitur Titik (`paud_north.geojson`)

| Atribut | Tipe | Keterangan |
|---------|------|------------|
| `id` | Integer | ID unik instansi |
| `nama` | String | Nama fasilitas |
| `jenjang` | String | Kategori: `TK`, `PAUD`, `Daycare` |
| `akreditasi` | String | Akreditasi: `A`, `B`, `C` |
| `jumlah_siswa` | Integer | Jumlah kapasitas siswa |
| `jumlah_sis` | Integer | Duplikasi jumlah_siswa |
| `biaya` | Integer | Biaya SPP per bulan (Rupiah) |
| `kode_paud` | String | Kode instansi |
| `latitude`, `longitude` | Float | Koordinat lokasi |

---

## 3. Integrasi Backend (`server.js`)

Frontend memanggil endpoint berikut yang disediakan oleh `server.js`:

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/data/paud` | GET | Mengambil seluruh data titik PAUD/TK/Daycare format GeoJSON |
| `/api/data/zona` | GET | Mengambil data poligon zona pendidikan anak |
| `/api/stats/jenjang` | GET | Statistik jumlah per jenjang dan akreditasi |
| `/api/feature/zona` | POST | Tambah poligon zona baru |

Semua endpoint diakses melalui `fetch()` di `public/js/app.js` dengan path relatif (karena disajikan oleh Express pada origin yang sama).

---

## 4. Struktur File Frontend (`public/`)

```
public/
├── index.html          # Shell HTML, CDN Leaflet + MarkerCluster, Font Awesome, panel kontrol
├── css/
│   └── style.css       # Styling: peta full-screen, panel glassmorphism, popup, divIcon
└── js/
    └── app.js          # State management, Leaflet init, fetch API, fungsi render
```


---

## 5. State Management Terpusat (`state`)

Objek global `state` di `public/js/app.js` baris 6–20:

```javascript
const state = {
  cluster: false,         // Toggle mode clustering (default: false)
  showZona: true,         // Toggle tampilan poligon zona
  jenjang: {
    TK: true,
    PAUD: true,
    Daycare: true
  },
  akreditasi: {
    A: true,
    B: true,
    C: true
  }
};
```

Setiap kali nilai `state` berubah (melalui checkbox filter atau toggle switch), fungsi render utama `renderPaud()` dipanggil untuk merender ulang peta.

---

## 6. Fungsi Utama

### `initMap()`
Inisialisasi peta Leaflet dengan TileLayer OpenStreetMap (OSM). Center default ke Pontianak Utara (`[0.0095, 109.3261]`), zoom 13. Zoom control ditempatkan di kiri atas agar tidak menutupi panel floating.

### `initLayers()`
Membuat layer groups: `regularMarkerGroup` (untuk mode non-cluster), `clusterMarkerGroup` (untuk mode cluster), dan `zonaPolygonGroup` (untuk poligon zona). Juga memanggil `createMapLegend()`.

### `renderPaud()` — Fungsi Render Utama
1. Membaca `state` saat ini
2. Membersihkan layer sebelumnya (`clearLayers()` dan `removeLayer()`)
3. Memfilter fitur GeoJSON berdasarkan `state.jenjang` dan `state.akreditasi`
4. Jika `state.cluster === false`: render dengan `L.circleMarker` berwarna per kategori
5. Jika `state.cluster === true`: render dengan `L.marker` + custom `L.divIcon` dalam `L.markerClusterGroup()`
6. Menambahkan layer aktif ke peta
7. Memperbarui statistik counter di UI

### `renderZona()`
Render layer poligon zona pendidikan anak dari `zona_pendidikan_anak.geojson` dengan estilo garis putus-putus biru dan fill transparan.

### `createCustomDivIcon(jenjang)`
Membuat `L.divIcon` kustom dengan class CSS `custom-pin-marker tk/paud/daycare` agar warna marker di mode cluster tetap mengikuti kategori jenjang.

### `getColorByJenjang(jenjang)`
Mengembalikan kode warna heksadesimal per kategori:
- TK: `#2563eb` (Biru)
- PAUD: `#f59e0b` (Oranye Amber)
- Daycare: `#10b981` (Hijau Zamrud)


---

## 7. Kepatuhan Spesifikasi Wajib SK-4

| # | Spesifikasi | Status | Implementasi |
|---|-------------|--------|--------------|
| 1 | Peta Dasar: Leaflet + TileLayer OSM | ✅ | `L.tileLayer('https://{s}.tile.openstreetmap.org/...')` |
| 2 | Center & fitBounds ke wilayah Pontianak | ✅ | `map.fitBounds(bounds, {padding: [40,40]})` setelah fetch data |
| 3 | State Management: objek `state` terpusat | ✅ | `state` dengan `cluster`, `showZona`, `jenjang`, `akreditasi` |
| 4 | Mode Non-Cluster: `L.circleMarker` | ✅ | Warna berbeda per kategori, `bindPopup` detail |
| 5 | Mode Non-Cluster: Legenda warna | ✅ | `createMapLegend()` di posisi bottomleft |
| 6 | Mode Cluster: `Leaflet.markercluster` via CDN | ✅ | CSS + JS MarkerCluster di `index.html` baris 12-13 |
| 7 | Mode Cluster: `L.marker` + `L.divIcon` | ✅ | Custom divIcon warna sesuai kategori di `createCustomDivIcon()` |
| 8 | Membersihkan layer sebelum render ulang | ✅ | `clearLayers()` + `removeLayer()` di `renderPaud()` |
| 9 | UI Modern & Responsif | ✅ | Panel floating glassmorphism di pojok kanan atas |

---

## 8. Tampilan UI

- **Peta**: Full-screen (`100vw`, `100vh`) dengan TileLayer OSM
- **Panel Kontrol**: Floating di pojok kanan atas, efek glassmorphism (backdrop blur, transparansi)
- **Statistik Counter**: Menampilkan jumlah titik aktif vs total fasilitas
- **Switch Mode**: Clustering titik (On/Off), Poligon zona (On/Off)
- **Filter Kategori**: Checkbox untuk jenjang (TK, PAUD, Daycare) dan akreditasi (A, B, C)
- **Tombol Reset**: Mengembalikan semua filter ke kondisi default
- **Legenda**: Warna kategori di pojok kiri bawah peta
- **Popup**: Kartu detail per titik (nama, jenjang, akreditasi, kode PAUD, jumlah siswa, biaya SPP, koordinat)

---

## 9. Cara Menjalankan

1. Pastikan Node.js dan `npm install` telah dijalankan
2. Jalankan server: `node server.js` (atau `npm start`)
3. Buka browser: `http://localhost:3000`
4. Halaman akan otomatis memuat data dari `/api/data/paud` dan `/api/data/zona`

---

## 10. Catatan Pengembangan

- Tidak ada modifikasi pada `server.js` (kode backend SK-3 tetap utuh)
- Semua perubahan ada di ruang lingkup SK-4: `public/` dan `LAPORAN_SK4.md`
- Library eksternal yang digunakan: Leaflet 1.9.4, Leaflet.markercluster 1.5.3, Font Awesome 6.4.0 (semua via CDN)

