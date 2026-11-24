const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Path direktori data
const DATA_DIR = path.join(__dirname, 'data');
const PAUD_FILE = path.join(DATA_DIR, 'paud_north.geojson');
const ZONA_FILE = path.join(DATA_DIR, 'zona_pendidikan_anak.geojson');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sajikan folder public/ sebagai file statis
app.use(express.static(path.join(__dirname, 'public')));

/**
 * SK-3 Endpoint 1: GET /api/data/paud
 * Mengambil seluruh data spasial titik PAUD, TK, dan Daycare format GeoJSON
 */
app.get('/api/data/paud', async (req, res) => {
  try {
    const rawData = await fs.readFile(PAUD_FILE, 'utf-8');
    const geojsonData = JSON.parse(rawData);
    res.json(geojsonData);
  } catch (error) {
    console.error('Error membaca data PAUD:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal membaca data paud_north.geojson',
      error: error.message
    });
  }
});

/**
 * Endpoint pendukung: GET /api/data/zona
 * Mengambil data poligon zona pendidikan anak format GeoJSON
 */
app.get('/api/data/zona', async (req, res) => {
  try {
    const rawData = await fs.readFile(ZONA_FILE, 'utf-8');
    const geojsonData = JSON.parse(rawData);
    res.json(geojsonData);
  } catch (error) {
    console.error('Error membaca data zona:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal membaca data zona_pendidikan_anak.geojson',
      error: error.message
    });
  }
});

/**
 * SK-3 Endpoint 2: GET /api/stats/jenjang
 * Menghitung dan menyajikan statistik jumlah fasilitas per jenjang (PAUD, TK, Daycare)
 */
app.get('/api/stats/jenjang', async (req, res) => {
  try {
    const rawData = await fs.readFile(PAUD_FILE, 'utf-8');
    const geojsonData = JSON.parse(rawData);

    const stats = {
      total: 0,
      jenjang: {
        PAUD: 0,
        TK: 0,
        Daycare: 0
      },
      akreditasi: {
        A: 0,
        B: 0,
        C: 0
      }
    };

    if (Array.isArray(geojsonData.features)) {
      stats.total = geojsonData.features.length;

      geojsonData.features.forEach((feature) => {
        const props = feature.properties || {};
        const jenjang = props.jenjang;
        const akreditasi = props.akreditasi;

        // Hitung per jenjang
        if (jenjang && stats.jenjang.hasOwnProperty(jenjang)) {
          stats.jenjang[jenjang]++;
        } else if (jenjang) {
          stats.jenjang[jenjang] = (stats.jenjang[jenjang] || 0) + 1;
        }

        // Hitung per akreditasi
        if (akreditasi && stats.akreditasi.hasOwnProperty(akreditasi)) {
          stats.akreditasi[akreditasi]++;
        } else if (akreditasi) {
          stats.akreditasi[akreditasi] = (stats.akreditasi[akreditasi] || 0) + 1;
        }
      });
    }

    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    console.error('Error menghitung statistik jenjang:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal menghitung statistik jenjang',
      error: error.message
    });
  }
});

/**
 * SK-3 Endpoint 3: POST /api/feature/zona
 * Menambahkan fitur poligon zona baru ke zona_pendidikan_anak.geojson
 */
app.post('/api/feature/zona', async (req, res) => {
  try {
    const newFeature = req.body.feature || req.body;

    if (!newFeature || !newFeature.geometry) {
      return res.status(400).json({
        status: 'error',
        message: 'Format data poligon tidak valid. Diperlukan objek GeoJSON Feature.'
      });
    }

    // Baca file zona_pendidikan_anak.geojson yang ada
    const rawData = await fs.readFile(ZONA_FILE, 'utf-8');
    const geojsonData = JSON.parse(rawData);

    if (!Array.isArray(geojsonData.features)) {
      geojsonData.features = [];
    }

    // Berikan default properties jika belum ada
    if (!newFeature.properties) {
      newFeature.properties = {};
    }

    if (!newFeature.properties.fid) {
      newFeature.properties.fid = geojsonData.features.length + 1;
    }

    if (!newFeature.properties.nama_zona) {
      newFeature.properties.nama_zona = `Zona Pendidikan ${newFeature.properties.fid}`;
    }

    // Tambahkan fitur baru ke daftar features
    geojsonData.features.push(newFeature);

    // Simpan kembali ke file
    await fs.writeFile(ZONA_FILE, JSON.stringify(geojsonData, null, 2), 'utf-8');

    res.status(201).json({
      status: 'success',
      message: 'Fitur zona pendidikan baru berhasil disimpan ke zona_pendidikan_anak.geojson',
      total_features: geojsonData.features.length,
      feature: newFeature
    });
  } catch (error) {
    console.error('Error menyimpan fitur zona:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal menyimpan fitur zona baru',
      error: error.message
    });
  }
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Server Web GIS Kelompok 14 berjalan di:`);
  console.log(` http://localhost:${PORT}`);
  console.log(`==================================================`);
  console.log(` Endpoint Tersedia:`);
  console.log(` - GET  /api/data/paud     : Data titik PAUD/TK/Daycare`);
  console.log(` - GET  /api/data/zona     : Data poligon zona`);
  console.log(` - GET  /api/stats/jenjang : Statistik jumlah per jenjang`);
  console.log(` - POST /api/feature/zona  : Tambah zona poligon baru`);
  console.log(`==================================================`);
});
