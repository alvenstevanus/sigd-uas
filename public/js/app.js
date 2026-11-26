/**
 * Web GIS Application - PAUD, TK & Daycare Pontianak Utara
 * Kelompok 14 - SK-4 Frontend Interaktif (Leaflet JS)
 */

// 1. STATE MANAGEMENT TERPUSAT
const state = {
  cluster: false,
  showZona: true,
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

// Global data caches & map layer handles
let paudGeoJsonData = null;
let zonaGeoJsonData = null;
let map = null;

let regularMarkerGroup = null;
let clusterMarkerGroup = null;
let zonaPolygonGroup = null;
let legendControl = null;
let drawControl = null;

// Utility: Skema Warna per Jenjang
function getColorByJenjang(jenjang) {
  switch (jenjang) {
    case 'TK':
      return '#2563eb'; // Blue
    case 'PAUD':
      return '#f59e0b'; // Amber / Orange
    case 'Daycare':
      return '#10b981'; // Emerald / Green
    default:
      return '#64748b'; // Muted Slate
  }
}

// Utility: Format Rupiah
function formatRupiah(amount) {
  if (amount === undefined || amount === null) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}

// Utility: Format Custom L.divIcon untuk mode Cluster
function createCustomDivIcon(jenjang) {
  const jenjangClass = (jenjang || '').toLowerCase();
  return L.divIcon({
    className: 'custom-pin-icon-wrap',
    html: `<div class="custom-pin-marker ${jenjangClass}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
}

// Inisialisasi Peta Leaflet
function initMap() {
  // Center default ke Pontianak Utara
  const pontianakUtaraCenter = [0.0095, 109.3261];
  
  map = L.map('map', {
    zoomControl: false // Kita pindahkan zoom control agar tidak tertutup panel floating
  }).setView(pontianakUtaraCenter, 13);

  // Tambahkan zoom control di kiri atas
  L.control.zoom({ position: 'topleft' }).addTo(map);

  // TileLayer OpenStreetMap (OSM Standard)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Web GIS Kelompok 14'
  }).addTo(map);

  // Inisialisasi Layer Groups dipindahkan ke fungsi initLayers()
}

// Buat Legenda Peta (Floating Bottom Left)
function createMapLegend() {
  legendControl = L.control({ position: 'bottomleft' });

  legendControl.onAdd = function () {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
      <div class="legend-title">Kategori Fasilitas</div>
      <div class="legend-item">
        <span class="color-dot tk"></span>
        <span>TK (Taman Kanak-Kanak)</span>
      </div>
      <div class="legend-item">
        <span class="color-dot paud"></span>
        <span>PAUD (Pendidikan Anak Usia Dini)</span>
      </div>
      <div class="legend-item">
        <span class="color-dot daycare"></span>
        <span>Daycare (Penitipan Anak)</span>
      </div>
    `;
    return div;
  };

  legendControl.addTo(map);
}

// Template Popup Detail Fitur
function createPopupHTML(props, coords) {
  const jenjangClass = (props.jenjang || '').toLowerCase();
  const lat = coords ? coords[1].toFixed(5) : (props.latitude || 0);
  const lng = coords ? coords[0].toFixed(5) : (props.longitude || 0);

  return `
    <div class="popup-card">
      <div class="popup-header ${jenjangClass}">
        <div class="popup-title">${props.nama || 'Tanpa Nama'}</div>
        <div class="popup-badges">
          <span class="popup-badge">${props.jenjang || 'N/A'}</span>
          <span class="popup-badge">Akreditasi ${props.akreditasi || '-'}</span>
        </div>
      </div>
      <div class="popup-body">
        <div class="popup-row">
          <span class="popup-label">Kode PAUD</span>
          <span class="popup-value">${props.kode_paud || 'PAUD-' + props.id}</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Jumlah Siswa</span>
          <span class="popup-value">${props.jumlah_siswa || props.jumlah_sis || 0} Anak</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Biaya SPP / Bulan</span>
          <span class="popup-value">${formatRupiah(props.biaya)}</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Koordinat</span>
          <span class="popup-value">${lat}, ${lng}</span>
        </div>
      </div>
    </div>
  `;
}

// FUNGSI RENDER UTAMA (renderPaud)
function renderPaud() {
  if (!paudGeoJsonData || !Array.isArray(paudGeoJsonData.features)) return;

  // 1. Bersihkan Layer Sebelumnya
  regularMarkerGroup.clearLayers();
  clusterMarkerGroup.clearLayers();
  if (map.hasLayer(clusterMarkerGroup)) map.removeLayer(clusterMarkerGroup);
  if (map.hasLayer(regularMarkerGroup)) map.removeLayer(regularMarkerGroup);

  let activeCount = 0;
  const categoryCounts = { TK: 0, PAUD: 0, Daycare: 0 };

  // 2. Filter & Render Titik yang Lolos Kriteria State
  paudGeoJsonData.features.forEach((feature) => {
    const props = feature.properties || {};
    const coords = feature.geometry ? feature.geometry.coordinates : null;
    if (!coords || coords.length < 2) return;

    const jenjang = props.jenjang;
    const akreditasi = props.akreditasi;

    // Hitung statistik kategori total terdaftar untuk UI badge
    if (jenjang && categoryCounts.hasOwnProperty(jenjang)) {
      categoryCounts[jenjang]++;
    }

    // Evaluasi State Checkbox Filter (Jenjang & Akreditasi)
    const passJenjang = state.jenjang[jenjang] === true;
    const passAkreditasi = state.akreditasi[akreditasi] === true;

    if (passJenjang && passAkreditasi) {
      activeCount++;
      const latLng = [coords[1], coords[0]];
      const popupHTML = createPopupHTML(props, coords);

      if (state.cluster) {
        // Mode 4: Integrasi MarkerCluster + Custom L.divIcon
        const marker = L.marker(latLng, {
          icon: createCustomDivIcon(jenjang)
        }).bindPopup(popupHTML);

        clusterMarkerGroup.addLayer(marker);
      } else {
        // Mode 3: Visualisasi CircleMarker (Warna per kategori)
        const circleMarker = L.circleMarker(latLng, {
          radius: 8,
          fillColor: getColorByJenjang(jenjang),
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        }).bindPopup(popupHTML);

        regularMarkerGroup.addLayer(circleMarker);
      }
    }
  });

  // 3. Tampilkan Layer Sesuai Status Toggle Cluster
  if (state.cluster) {
    map.addLayer(clusterMarkerGroup);
  } else {
    map.addLayer(regularMarkerGroup);
  }

  // 4. Update Elemen Statistik UI
  updateUIStats(activeCount, paudGeoJsonData.features.length, categoryCounts);
}

// Render Layer Poligon Zona Pendidikan
function renderZona() {
  zonaPolygonGroup.clearLayers();
  if (!state.showZona || !zonaGeoJsonData) return;

  const zonaLayer = L.geoJSON(zonaGeoJsonData, {
    style: {
      color: '#2563eb',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#3b82f6',
      fillOpacity: 0.15
    },
    onEachFeature: (feature, layer) => {
      const namaZona = feature.properties ? feature.properties.nama_zona : 'Zona Pendidikan';
      layer.bindPopup(`
        <div style="padding: 10px; font-family: sans-serif;">
          <strong style="color: #1e293b; font-size: 0.95rem;">📍 ${namaZona}</strong>
          <p style="margin-top: 4px; font-size: 0.8rem; color: #64748b;">Kawasan Prioritas Pengembangan Pendidikan Anak Usia Dini Pontianak Utara.</p>
        </div>
      `);
    }
  });

  zonaPolygonGroup.addLayer(zonaLayer);
}

// Update Counter UI Statistik
function updateUIStats(activeCount, totalCount, categoryCounts) {
  const elActive = document.getElementById('stat-active');
  const elTotal = document.getElementById('stat-total');
  
  if (elActive) elActive.textContent = activeCount;
  if (elTotal) elTotal.textContent = totalCount;

  // Update badge count jika elemen tersedia
  ['TK', 'PAUD', 'Daycare'].forEach((j) => {
    const elBadge = document.getElementById(`count-${j.toLowerCase()}`);
    if (elBadge) elBadge.textContent = categoryCounts[j] || 0;
  });
}

// Inisialisasi Layer Groups setelah peta siap
function initLayers() {
  regularMarkerGroup = L.layerGroup().addTo(map);
  clusterMarkerGroup = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 40
  });
  zonaPolygonGroup = L.layerGroup().addTo(map);

  // Tambahkan Legenda Peta
  createMapLegend();
}

// Fitur Gambar Poligon Zona dengan Leaflet.draw
// Toolbar ditampilkan langsung di topleft saat peta dimuat (tidak perlu tombol pemicu tambahan).
function initDrawControl() {
  try {
    // WORKAROUND kompatibilitas Leaflet.draw v1.0.4 + Leaflet 1.9+:
    // Mencegah ReferenceError: type is not defined saat menggambar poligon.
    window.type = '';

    // 1. Buat FeatureGroup untuk menampung hasil gambar (harus dibuat sebelum L.Control.Draw)
    const drawnItems = new L.FeatureGroup().addTo(map);

    // 2. Inisialisasi kontrol gambar (hanya polygon, posisi topleft)
    // showArea di-set false untuk menghindari bug pada Leaflet versi terbaru.
    drawControl = new L.Control.Draw({
      position: 'topleft',
      edit: {
        featureGroup: drawnItems,
        edit: false,
        remove: false
      },
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: false,
          shapeOptions: {
            color: '#3b82f6',
            weight: 2,
            fillColor: '#3b82f6',
            fillOpacity: 0.15
          }
        },
        polyline: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false
      }
    }).addTo(map);

    console.log('[Leaflet.draw] Kontrol gambar poligon aktif di topleft');

    // 3. Event saat selesai menggambar poligon (L.Draw.Event.CREATED)
    map.on(L.Draw.Event.CREATED, async (e) => {
      const layer = e.layer;
      const feature = layer.toGeoJSON();

      console.log('[Leaflet.draw] draw:created terpanggil', {
        geometryType: feature && feature.geometry ? feature.geometry.type : null,
        coordinates: feature && feature.geometry ? feature.geometry.coordinates : null
      });

      // Simpan ke layer gambar agar dapat dilacak oleh kontrol draw
      drawnItems.addLayer(layer);

      // 4. Minta nama zona kepada pengguna
      const namaZona = prompt('Masukkan nama zona pendidikan anak:');
      if (!namaZona || namaZona.trim() === '') {
        console.warn('[Leaflet.draw] Pengguna batal, gambar dibatalkan.');
        drawnItems.removeLayer(layer);
        return;
      }

      try {
        // Payload cocok dengan handler app.post('/api/feature/zona') di server.js:
        //   const newFeature = req.body.feature || req.body;
        //   if (!newFeature || !newFeature.geometry) -> 400
        //   default: properties.fid, properties.nama_zona
        const payload = {
          feature: {
            type: 'Feature',
            properties: {
              nama_zona: namaZona.trim()
            },
            geometry: feature.geometry
          }
        };

        console.log('[Leaflet.draw] POST /api/feature/zona payload:', payload);

        const res = await fetch('/api/feature/zona', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        console.log('[Leaflet.draw] Respons server:', res.status, res.statusText);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Gagal menyimpan zona ke server.');
        }

        const data = await res.json();
        console.log('[Leaflet.draw] Zona berhasil disimpan:', data);

        // Tambahkan poligon ke layer zona utama agar langsung terlihat di peta
        const newFeatureForLayer = {
          type: 'Feature',
          properties: {
            nama_zona: namaZona.trim(),
            fid: data.feature ? data.feature.fid : null
          },
          geometry: feature.geometry
        };

        const zonaLayer = L.geoJSON(newFeatureForLayer, {
          style: {
            color: '#2563eb',
            weight: 2,
            dashArray: '6, 6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15
          },
          onEachFeature: (f, l) => {
            l.bindPopup(`
              <div style="padding: 10px; font-family: sans-serif;">
                <strong style="color: #1e293b; font-size: 0.95rem;">📍 ${f.properties.nama_zona || 'Zona Pendidikan'}</strong>
                <p style="margin-top: 4px; font-size: 0.8rem; color: #64748b;">Zona baru hasil gambar Leaflet.draw.</p>
              </div>
            `);
          }
        });
        zonaPolygonGroup.addLayer(zonaLayer);

        // Segarkan data zona dari server agar state sinkron
        try {
          const resZona = await fetch('/api/data/zona');
          if (resZona.ok) {
            zonaGeoJsonData = await resZona.json();
            console.log('[Leaflet.draw] Data zona di-refresh, total fitur:', zonaGeoJsonData.features ? zonaGeoJsonData.features.length : 0);
          }
        } catch (errZona) {
          console.warn('[Leaflet.draw] Gagal refresh data zona:', errZona);
        }

        // Kembali ke mode normal setelah selesai menggambar (jika method tersedia)
        if (typeof drawControl.disable === 'function') {
          drawControl.disable();
        }

        alert('Zona pendidikan baru berhasil disimpan dan ditampilkan di peta.');
      } catch (err) {
        console.error('[Leaflet.draw] Error menyimpan zona:', err);
        alert('Gagal menyimpan zona baru: ' + err.message);
      }
    });
  } catch (err) {
    console.error('Leaflet.draw gagal diinisialisasi:', err);
  }
}

// Mengambil Data dari Backend Express API
async function fetchApiData() {
  // --- 1. Fetch Data PAUD (terpisah agar error zona tidak menyembunyikan PAUD) ---
  try {
    const resPaud = await fetch('/api/data/paud');
    console.log('GET /api/data/paud -> HTTP', resPaud.status);
    if (!resPaud.ok) {
      throw new Error('Gagal mengambil data PAUD (HTTP ' + resPaud.status + ')');
    }
    paudGeoJsonData = await resPaud.json();

    // FitBounds otomatis ke seluruh titik data GeoJSON
    if (
      paudGeoJsonData &&
      Array.isArray(paudGeoJsonData.features) &&
      paudGeoJsonData.features.length > 0
    ) {
      const tempGeoJsonLayer = L.geoJSON(paudGeoJsonData);
      const bounds = tempGeoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }

    // Render titik PAUD segera (jangan tunggu data zona)
    renderPaud();
  } catch (errorPaud) {
    // Log spesifik agar penyebab pasti terlihat di console
    console.error('Error mengambil data PAUD:', errorPaud);
    alert('Terjadi kesalahan saat mengambil data PAUD dari server backend Express.');
    return; // Hentikan di sini jika data inti (PAUD) gagal dimuat
  }

  // --- 2. Fetch Data Poligon Zona (isolasi, tidak mengganggu tampilan PAUD) ---
  try {
    const resZona = await fetch('/api/data/zona');
    console.log('GET /api/data/zona -> HTTP', resZona.status);
    if (resZona.ok) {
      zonaGeoJsonData = await resZona.json();
    } else {
      // Endpoint tersedia tapi mengembalikan error (misal 404/500)
      console.warn('GET /api/data/zona mengembalikan HTTP', resZona.status, '- menggunakan zona kosong.');
      zonaGeoJsonData = { type: 'FeatureCollection', features: [] };
    }
  } catch (errZona) {
    // Jika endpoint tidak tersedia sama sekali (jaringan / 404), gunakan zona kosong sebagai fallback
    console.warn('Endpoint /api/data/zona tidak tersedia, menggunakan zona kosong sebagai fallback:', errZona);
    zonaGeoJsonData = { type: 'FeatureCollection', features: [] };
  }

  // Render layer zona (tidak akan error meskipun zonaGeoJsonData kosong)
  renderZona();
}

// Inisialisasi Event Listener untuk Control Panel
function setupEventListeners() {
  // Checkbox Filter Jenjang
  const jenjangMap = { tk: 'TK', paud: 'PAUD', daycare: 'Daycare' };
  Object.keys(jenjangMap).forEach((key) => {
    const el = document.getElementById(`filter-${key}`);
    if (el) {
      el.addEventListener('change', (e) => {
        state.jenjang[jenjangMap[key]] = e.target.checked;
        renderPaud();
      });
    }
  });

  // Checkbox Filter Akreditasi
  ['a', 'b', 'c'].forEach((key) => {
    const el = document.getElementById(`filter-akr-${key}`);
    if (el) {
      el.addEventListener('change', (e) => {
        state.akreditasi[key.toUpperCase()] = e.target.checked;
        renderPaud();
      });
    }
  });

  // Toggle Switch Cluster
  const toggleCluster = document.getElementById('toggle-cluster');
  if (toggleCluster) {
    toggleCluster.addEventListener('change', (e) => {
      state.cluster = e.target.checked;
      renderPaud();
    });
  }

  // Toggle Switch Zona
  const toggleZona = document.getElementById('toggle-zona');
  if (toggleZona) {
    toggleZona.addEventListener('change', (e) => {
      state.showZona = e.target.checked;
      renderZona();
    });
  }

  // Tombol Reset Filter
  const btnReset = document.getElementById('btn-reset-filter');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      state.cluster = false;
      state.showZona = true;
      state.jenjang.TK = true;
      state.jenjang.PAUD = true;
      state.jenjang.Daycare = true;
      state.akreditasi.A = true;
      state.akreditasi.B = true;
      state.akreditasi.C = true;

      // Reset UI Controls
      if (toggleCluster) toggleCluster.checked = false;
      if (toggleZona) toggleZona.checked = true;

      Object.keys(jenjangMap).forEach((key) => {
        const el = document.getElementById(`filter-${key}`);
        if (el) el.checked = true;
      });

      ['a', 'b', 'c'].forEach((key) => {
        const el = document.getElementById(`filter-akr-${key}`);
        if (el) el.checked = true;
      });

      renderZona();
      renderPaud();
    });
  }

  // Tombol Toggle Collapse Panel Floating
  const btnTogglePanel = document.getElementById('btn-toggle-panel');
  const panel = document.querySelector('.floating-panel');
  if (btnTogglePanel && panel) {
    btnTogglePanel.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      const icon = btnTogglePanel.querySelector('i');
      if (icon) {
        if (panel.classList.contains('collapsed')) {
          icon.className = 'fas fa-chevron-down';
        } else {
          icon.className = 'fas fa-chevron-up';
        }
      }
    });
  }
}

// Jalankan saat dokumen HTML siap
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initLayers();
  setupEventListeners();

  // Muat dan render data terlebih dahulu agar titik lokasi PAUD selalu tampil,
  // meskipun inisialisasi Leaflet.draw gagal.
  fetchApiData();

  // Inisialisasi fitur gambar poligon (diamalkan jika gagal, tidak mengganggu render data)
  try {
    initDrawControl();
  } catch (err) {
    console.error('Gagal memanggil initDrawControl:', err);
  }
});

