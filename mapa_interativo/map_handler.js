// ==========================================
// MAP HANDLER - MAP_HANDLER.JS
// ==========================================
// Handles map initialization, hierarchy processing, and rendering

// Variables for internal map state
let markersLayer = null;

// EXPORT state to window for cross-module access
window.cityData = {};
window.currentLevel = 0;
window.currentZone = null;
window.currentSector = null;

// ========================================
// MOBILE: GPS & DRAWER LOGIC
// ========================================

// GPS Control moved to location_handler.js
window.addGpsControl = function () {
    // Legacy NO-OP
};

window.initMobileSidebar = function () {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (!sidebar) return;

    // Mobile Drawer Peak/Expand logic
    let touchStartY = 0;
    sidebar.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    sidebar.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;

        if (window.innerWidth <= 768) {
            if (diff > 50) { // Swipe Up
                sidebar.classList.add('active');
                if (backdrop) backdrop.classList.add('active');
            } else if (diff < -50) { // Swipe Down
                sidebar.classList.remove('active');
                if (backdrop) backdrop.classList.remove('active');
            }
        }
    }, { passive: true });

    // Backdrop click to close
    if (backdrop) {
        backdrop.onclick = () => {
            sidebar.classList.remove('active');
            backdrop.classList.remove('active');
        };
    }
};
window.initMapHandlerRefs = function (refs) {
    // Shared state is accessed via window.allLotes, window.map, etc.
};

function handleRealtimeUpdate(payload) {
    console.log("Realtime update:", payload);

    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const newRow = payload.new;
        const updatedLote = {
            ...newRow,
            metadata: {
                inscricao: newRow.inscricao,
                zona: newRow.zona,
                setor: newRow.setor,
                lote: newRow.lote_geo,
                quadra: newRow.quadra,
                loteamento: newRow.loteamento,
                bairro: newRow.bairro,
                valor_m2: newRow.valor_m2 ? newRow.valor_m2.toString().replace('.', ',') : null
            },
            bounds_utm: {
                minx: newRow.minx, miny: newRow.miny, maxx: newRow.maxx, maxy: newRow.maxy
            },
            unidades: []
        };

        const existingIndex = window.allLotes.findIndex(l => l.inscricao === updatedLote.inscricao);
        if (existingIndex >= 0) {
            window.allLotes[existingIndex] = updatedLote;
        } else {
            window.allLotes.push(updatedLote);
        }

        // Refresh hierarchy
        processDataHierarchy();
        renderHierarchy();
        window.Toast.info(`Lote ${updatedLote.inscricao} atualizado em tempo real`);
    } else if (payload.eventType === 'DELETE') {
        const inscricao = payload.old.inscricao;
        window.allLotes = window.allLotes.filter(l => l.inscricao !== inscricao);
        processDataHierarchy();
        renderHierarchy();
        window.Toast.warning(`Lote ${inscricao} removido`);
    }
}

// ========================================
// MAIN INITIALIZATION
// ========================================
window.initMap = async function () {
    const totalLotesEl = document.getElementById('totalLotes');
    const mapBackBtn = document.getElementById('mapBackBtn');

    // Show loading overlay
    Loading.show('Inicializando Mapa...', 'Configurando camadas');
    Loading.setProgress(10);

    // Base Layer: Satellite
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
    });

    // Overlay: Street Names & Roads (Transparent)
    const labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    });

    // Alternative: Standard OSM
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    });

    window.Loading.setProgress(20);

    if (window.map) {
        window.map.remove();
        window.map = null;
    }

    window.map = L.map('map', {
        preferCanvas: true,
        center: [-23.9934, -46.2567],
        zoom: 13,
        minZoom: 12,
        layers: [satellite, labels] // Default: Hybrid
    });

    // --- MOBILE: GPS LOCATION CONTROL ---
    // Handled by location_handler.js
    // window.addGpsControl();

    // --- MOBILE: SIDEBAR DRAWER LOGIC ---
    window.initMobileSidebar();

    // Map Right Click for Creating Lots
    window.map.on('contextmenu', (e) => window.handleContextMenu(e, 'map', null));

    // SMART NAVIGATION CLICK LISTENER
    window.map.on('click', () => {
        // CLOSE CONTEXT MENU
        window.hideContextMenu();

        // TOOLTIP NAVIGATION LOGIC
        if (window.currentTooltip) {
            // If viewing a UNIT -> Go back to LOTE
            if (window.currentTooltipType === 'unit' && window.currentLoteForUnit) {
                console.log("🔙 Navigation: Unit -> Lote");
                window.showLotTooltip(window.currentLoteForUnit, 0, 0);
            } else {
                // Else -> Close everything
                console.log("❌ Navigation: Close All");
                if (window.closeParamsTooltip) window.closeParamsTooltip();
                if (window.currentTooltip) window.currentTooltip.remove();
                window.currentTooltip = null;
                window.currentTooltipType = null;
            }
        }
    });

    // Feature Group for Drawings (Init before control)
    window.drawnItems = new L.FeatureGroup();
    window.map.addLayer(window.drawnItems);

    // Layer Control
    const baseMaps = {
        "Satélite (Híbrido)": satellite,
        "Mapa de Ruas": osm
    };
    const overlayMaps = {
        "Nomes de Ruas": labels,
        "Desenhos/Anotações": window.drawnItems
    };
    window.layerControl = L.control.layers(baseMaps, overlayMaps).addTo(window.map);

    // ===========================================
    // GEOPROCESSAMENTO: DRAW TOOLS (DYNAMIC LOADER)
    // ===========================================
    const loadDrawLibs = () => {
        return new Promise((resolve) => {
            if (typeof L.Control.Draw !== 'undefined') return resolve();

            console.log("⚠️ Draw Lib missing, injecting dynamically...");
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css';
            document.head.appendChild(link);

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js';
            script.onload = () => { console.log("✅ Draw Lib loaded via JS"); resolve(); };
            script.onerror = () => { console.error("❌ Failed to load Draw Lib"); resolve(); }; // Resolve anyway to stop hanging
            document.head.appendChild(script);
        });
    };

    loadDrawLibs().then(() => {
        // Polling short-wait to ensure parsing
        let attempts = 0;
        const interval = setInterval(() => {
            if (typeof L.Control.Draw !== 'undefined' && window.map) {
                clearInterval(interval);
                window.initDraw(window.map);
            } else {
                attempts++;
                if (attempts > 20) clearInterval(interval); // 10s timeout
            }
        }, 500);
    });

    // Helper to init draw to avoid duplication
    window.initDraw = function (mapInstance) {
        if (window.drawControlAdded) return;

        // 1. Feature Group para itens desenhados (Permite edição)
        // Inicializa ANTES para poder adicionar ao controle de camadas
        if (!window.drawnItems) {
            window.drawnItems = new L.FeatureGroup();
            mapInstance.addLayer(window.drawnItems);
        }

        // Adicionar ao Controle de Camadas existente (se houver)
        // REMOVIDO: Já é adicionado na inicialização do mapa (linhas 118-122) para evitar duplicata.
        /* if (window.layerControl) {
            window.layerControl.addOverlay(window.drawnItems, "Desenhos/Anotações");
        } */

        // 2. Configurar Controle com Edição Habilitada
        // Estilo mais discreto (Linhas mais finas e transparentes)
        const drawControl = new L.Control.Draw({
            position: 'topright',
            draw: {
                polyline: {
                    shapeOptions: { color: '#3388ff', weight: 3, opacity: 0.6 },
                    metric: true
                },
                marker: true,
                polygon: false,
                circle: false,
                rectangle: false,
                circlemarker: false
            },
            edit: {
                featureGroup: window.drawnItems,
                remove: true
            }
        });
        mapInstance.addControl(drawControl);
        window.drawControlAdded = true;
        console.log("✅ Draw Control Added (Editable)");

        // 3. Handlers
        mapInstance.off('draw:created');
        mapInstance.on('draw:created', async function (e) {
            console.log("🖊️ Evento draw:created disparado!");
            try {
                const type = e.layerType;
                const layer = e.layer;

                let nome = prompt("Nome da Referência (ex: Praia X, Padaria Y):");
                if (!nome) {
                    console.log("❌ Criação cancelada pelo usuário (sem nome).");
                    return;
                }

                let tipo = 'OUTRO';
                let subtipo = null;
                let cor = '#3388ff';

                if (type === 'polyline') {
                    if (confirm("É uma linha de MAR/PRAIA? (Cancel para outro)")) {
                        tipo = 'MAR';
                        cor = '#4fc3f7';
                    } else {
                        tipo = 'OUTRO';
                        cor = '#555555';
                    }
                } else if (type === 'marker') {
                    tipo = 'POI';
                    subtipo = prompt("Tipo do Ponto (ex: MERCADO, ESCOLA):", "GERAL")?.toUpperCase() || 'GERAL';
                    cor = '#ff6b6b';
                }

                // Apply style if supported (Markers don't have setStyle usually)
                if (typeof layer.setStyle === 'function') {
                    layer.setStyle({ color: cor });
                }

                // Persistir
                console.log("💾 Salvando no Supabase...", { nome, tipo, subtipo, cor });
                const geojson = layer.toGeoJSON();
                const { data, error } = await window.supabaseApp
                    .from('referencias_geograficas')
                    .insert({
                        nome, tipo, subtipo, geometria: geojson.geometry, cor
                    })
                    .select()
                    .single();

                if (error) {
                    console.error("❌ Erro salvando:", error);
                    window.Toast.error("Erro ao salvar: " + error.message);
                } else {
                    console.log("✅ Salvo com sucesso:", data);
                    layer.feature = layer.feature || {};
                    layer.feature.properties = data;

                    if (window.drawnItems) {
                        window.drawnItems.addLayer(layer);
                        window.Toast.success("Referência salva!");
                    } else {
                        console.error("❌ window.drawnItems não encontrado!");
                    }
                }
            } catch (err) {
                console.error("❌ Erro CRÍTICO no handler de desenho:", err);
                window.Toast.error("Erro interno ao desenhar.");
            }
        });

        // Handler: Edição
        mapInstance.on('draw:edited', async function (e) {
            const layers = e.layers;
            layers.eachLayer(async function (layer) {
                const id = layer.feature?.properties?.id;
                if (!id) return;

                const newGeoJSON = layer.toGeoJSON();
                await window.supabaseApp
                    .from('referencias_geograficas')
                    .update({ geometria: newGeoJSON.geometry }) // Save geometry ONLY
                    .eq('id', id);
                console.log(`✏️ Ref ${id} atualizada.`);
            });
            window.Toast.success("Edições salvas!");
        });

        // Handler: Exclusão
        mapInstance.on('draw:deleted', async function (e) {
            const layers = e.layers;
            layers.eachLayer(async function (layer) {
                const id = layer.feature?.properties?.id;
                if (!id) return;

                await window.supabaseApp
                    .from('referencias_geograficas')
                    .delete()
                    .eq('id', id);
            });
            window.Toast.success("Referência(s) excluída(s).");
        });

        // Carregar Referências
        loadReferences();
    };

    async function loadReferences() {
        console.log("Carregando Referências Geográficas...");
        const { data, error } = await window.supabaseApp
            .from('referencias_geograficas')
            .select('*');

        if (error || !data) return;

        data.forEach(ref => {
            const layer = L.geoJSON(ref.geometria, {
                style: { color: ref.cor || '#3388ff', weight: 4 },
                pointToLayer: (geoJsonPoint, latlng) => L.marker(latlng)
            }).getLayers()[0];

            if (layer) {
                layer.feature = layer.feature || {};
                layer.feature.properties = ref;

                let popupContent = `<b>${ref.nome}</b><br>${ref.subtipo || ref.tipo}`;
                layer.bindPopup(popupContent);

                window.drawnItems.addLayer(layer);
            }
        });
        console.log(`🗺️ ${data.length} referências carregadas.`);
    }

    // Função para carregar Refs
    window.loadReferenciasGeo = async function () {
        console.log("Carregando Referências Geográficas...");
        try {
            const { data, error } = await window.supabaseApp
                .from('referencias_geograficas')
                .select('*');

            if (error) throw error;

            if (data && data.length > 0) {
                const geoGroup = L.featureGroup().addTo(window.map);

                data.forEach(ref => {
                    const geometry = ref.geometria;
                    const layer = L.geoJSON(geometry, {
                        style: function (feature) {
                            if (ref.tipo === 'MAR') {
                                return {
                                    color: ref.cor || '#4fc3f7',
                                    weight: 4,
                                    opacity: 0.5,
                                    lineCap: 'round',
                                    lineJoin: 'round'
                                };
                            }
                            return { color: ref.cor || '#3388ff', weight: 4, opacity: 0.7 };
                        },
                        pointToLayer: function (feature, latlng) {
                            return L.marker(latlng);
                        }
                    });

                    // Extrair layers internos do GeoJSON wrapper
                    layer.eachLayer(l => {
                        let label = ref.nome;
                        if (ref.tipo === 'MAR') label = `🌊 ${label}`;
                        if (ref.tipo === 'POI') label = `📍 ${label}`;

                        l.bindTooltip(label, { sticky: true });
                        l.feature = { properties: ref }; // Store data
                        geoGroup.addLayer(l);
                    });
                });

                console.log(`Carregadas ${data.length} referências.`);
            }
        } catch (e) {
            console.error("Erro carregando referências:", e);
        }
    };

    window.Loading.setProgress(30);
    window.Loading.setProgress(40);

    let isCachedLoaded = false;

    try {
        // --- CACHE STRATEGY: Stale-While-Revalidate ---
        // 1. Try Load from Cache
        let cached = await window.loadLotesFromCache();

        if (cached && cached.data && cached.data.length > 0) {
            console.log("Loading from Cache...", cached.data.length);
            window.allLotes = cached.data;

            // Render Cache Immediately
            window.processDataHierarchy();
            window.renderHierarchy();
            totalLotesEl.innerText = `${window.allLotes.length.toLocaleString()} Lotes (Cache)`;

            // Setup Back Button immediately if cached
            if (mapBackBtn) mapBackBtn.onclick = window.goUpLevel;

            isCachedLoaded = true;
            window.Loading.hide();
            window.Toast.info('Dados locais carregados. Sincronizando...', 'Início Rápido');
            if (window.Onboarding) window.Onboarding.checkAndStart();
        }

        // 2. Network Fetch (Background if cached)
        if (!isCachedLoaded) {
            window.Loading.show('Carregando Dados...', 'Buscando arquivo de lotes');
        }

        // Fetch data from Supabase (Chunked)
        let rawData = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await window.supabaseApp
                .from('lotes')
                .select('*')
                .range(from, from + step - 1);

            if (error) throw new Error(error.message);

            if (data && data.length > 0) {
                rawData = rawData.concat(data);
                if (!isCachedLoaded) {
                    window.Loading.show('Carregando Dados...', `Baixado ${rawData.length.toLocaleString()} registros...`);
                }
                from += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        if (!isCachedLoaded) window.Loading.setProgress(60);

        // Transform Supabase Flat Structure to App Nested Structure
        const newAllLotes = rawData.map(row => ({
            ...row,
            metadata: {
                inscricao: row.inscricao,
                zona: row.zona,
                setor: row.setor,
                lote: row.lote_geo,
                quadra: row.quadra,
                loteamento: row.loteamento,
                bairro: row.bairro,
                valor_m2: row.valor_m2 ? row.valor_m2.toString().replace('.', ',') : null
            },
            bounds_utm: {
                minx: row.minx, miny: row.miny, maxx: row.maxx, maxy: row.maxy
            },
            unidades: []
        }));

        // Update State & Cache
        window.allLotes = newAllLotes;
        await window.saveLotesToCache(window.allLotes);

        // Setup Realtime Subscription
        window.supabaseApp.channel('public:all_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lotes' }, payload => {
                handleRealtimeUpdate(payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'unidades' }, payload => {
                handleRealtimeUpdate(payload);
            })
            .subscribe();

        if (!isCachedLoaded) Loading.setProgress(90);

        processDataHierarchy();
        renderHierarchy();

        totalLotesEl.innerText = `${allLotes.length.toLocaleString()} Lotes`;

        // Setup Back Button Listener
        if (mapBackBtn) mapBackBtn.onclick = goUpLevel;

        if (!isCachedLoaded) Loading.setProgress(100);

        if (isCachedLoaded) {
            Toast.success('Dados sincronizados com o servidor!', 'Atualizado');
        } else {
            setTimeout(() => {
                Loading.hide();
                Toast.success(`${allLotes.length.toLocaleString()} lotes carregados!`);
                if (window.Onboarding) window.Onboarding.checkAndStart();
            }, 500);
        }

    } catch (e) {
        console.error(e);
        if (isCachedLoaded) {
            Toast.warning('Falha na sincronização. Usando dados locais.', 'Offline');
        } else {
            Loading.hide();
            Toast.error(`Não foi possível carregar os dados: ${e.message}`, 'Erro Crítico');
        }
    }
};

// ========================================
// HIERARCHY PROCESSING
// ========================================
function processDataHierarchy() {
    window.cityData = {};

    for (const lote of window.allLotes) {
        const b = lote.bounds_utm || lote.bounds;
        if (!b) continue;

        const cx = (b.minx + b.maxx) / 2;
        const cy = (b.miny + b.maxy) / 2;
        const ll = window.utmToLatLon(cx, cy);

        lote._lat = ll.lat;
        lote._lng = ll.lng;

        const meta = lote.metadata || {};
        const zona = meta.zona;

        // Filter: Ignore Undefined, Null, or "Unk" Zones
        if (!zona || zona === "Indefinida" || zona.toLowerCase() === "unk") {
            continue;
        }

        const setor = meta.setor || "Indefinido";

        if (!window.cityData[zona]) {
            window.cityData[zona] = {
                id: zona,
                sectors: {},
                count: 0,
                latSum: 0,
                lngSum: 0
            };
        }
        window.cityData[zona].count++;
        window.cityData[zona].latSum += ll.lat;
        window.cityData[zona].lngSum += ll.lng;

        if (!window.cityData[zona].sectors[setor]) {
            window.cityData[zona].sectors[setor] = {
                id: setor,
                parentId: zona,
                lotes: [],
                count: 0,
                latSum: 0,
                lngSum: 0
            };
        }
        window.cityData[zona].sectors[setor].lotes.push(lote);
        window.cityData[zona].sectors[setor].count++;
        window.cityData[zona].sectors[setor].latSum += ll.lat;
        window.cityData[zona].sectors[setor].lngSum += ll.lng;
    }

    // --- Multi-Centroid Calculation for Large Zones ---
    const GRID_SIZE = 0.03; // ~1.2km grid for Clustering

    for (const zoneKey in window.cityData) {
        const zone = window.cityData[zoneKey];

        // 1. Gather Sector Centroids
        const sectorCentroids = [];
        for (const sKey in zone.sectors) {
            const s = zone.sectors[sKey];
            if (s.count > 0) {
                sectorCentroids.push({
                    lat: s.latSum / s.count,
                    lng: s.lngSum / s.count,
                    weight: s.count
                });
            }
        }

        // 2. Grid-based Clustering
        const clusters = {};
        for (const p of sectorCentroids) {
            const gx = Math.floor(p.lng / GRID_SIZE);
            const gy = Math.floor(p.lat / GRID_SIZE);
            const key = `${gx}_${gy}`;

            if (!clusters[key]) clusters[key] = { wLat: 0, wLng: 0, wSum: 0 };

            clusters[key].wLat += p.lat * p.weight;
            clusters[key].wLng += p.lng * p.weight;
            clusters[key].wSum += p.weight;
        }

        // 3. Convert Clusters to Display Points
        zone.displayPoints = [];
        for (const key in clusters) {
            const c = clusters[key];
            if (c.wSum > 0) {
                zone.displayPoints.push({
                    lat: c.wLat / c.wSum,
                    lng: c.wLng / c.wSum
                });
            }
        }

        // Fallback: If no clusters found, use global average
        if (zone.displayPoints.length === 0) {
            zone.displayPoints.push({
                lat: zone.latSum / zone.count,
                lng: zone.lngSum / zone.count
            });
        }
    }

    // Populate zone legend after processing
    if (typeof populateZoneLegend === 'function') {
        populateZoneLegend();
    }

    window.cityData = window.cityData; // Ensure on window
}

// ========================================
// RENDER HIERARCHY (Zones -> Sectors -> Lots)
// ========================================
function renderHierarchy() {
    const totalLotesEl = document.getElementById('totalLotes');

    if (markersLayer) window.map.removeLayer(markersLayer);
    markersLayer = L.layerGroup().addTo(window.map);

    if (window.currentLevel === 0) {
        // --- LEVEL 0: ZONES (Multi-Centroid) ---
        totalLotesEl.innerText = "Visão Geral: Selecione uma Zona";

        for (const zoneKey in window.cityData) {
            const zone = window.cityData[zoneKey];

            zone.displayPoints.forEach(pt => {
                const zoneColor = window.getZoneColor(zoneKey);
                const icon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div style="
background-color:${zoneColor};
color: white;
border-radius: 8px;
padding: 2px 6px;
display: table;
white-space: nowrap;
text-align: center;
font-weight: bold;
box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
cursor: pointer;
border: 2px solid white;
transform: translate(-50%, -50%);
">
    <div style="font-size:12px;">ZONA ${zone.id}</div>
</div>`,
                    iconSize: null
                });

                const marker = L.marker([pt.lat, pt.lng], { icon: icon });
                marker.on('click', () => {
                    window.currentLevel = 1;
                    window.currentZone = zoneKey;
                    window.map.setView([pt.lat, pt.lng], 15);
                    renderHierarchy();
                });
                markersLayer.addLayer(marker);
            });
        }

    } else if (window.currentLevel === 1) {
        // --- LEVEL 1: SECTORS ---
        if (!window.cityData[window.currentZone]) {
            window.currentLevel = 0;
            window.currentZone = null;
            renderHierarchy();
            return;
        }

        totalLotesEl.innerText = `Zona ${window.currentZone}: Selecione um Setor`;

        const zone = window.cityData[window.currentZone];
        for (const sectorKey in zone.sectors) {
            const sector = zone.sectors[sectorKey];
            const centerLat = sector.latSum / sector.count;
            const centerLng = sector.lngSum / sector.count;

            const zoneColor = window.getZoneColor(window.currentZone);
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="
background-color:${zoneColor};
color: white;
border-radius: 6px;
padding: 1px 4px;
display: table;
white-space: nowrap;
text-align: center;
font-weight: bold;
box-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
cursor: pointer;
border: 1.5px solid white;
transform: translate(-50%, -50%);
opacity: 0.9;
">
    <div style="font-size:11px;">${sector.id}</div>
</div>`,
                iconSize: null
            });

            const marker = L.marker([centerLat, centerLng], { icon: icon });
            marker.on('click', () => {
                window.currentLevel = 2;
                window.currentSector = sectorKey;
                window.map.setView([centerLat, centerLng], 17);
                renderHierarchy();
            });
            markersLayer.addLayer(marker);
        }

    } else if (window.currentLevel === 2) {
        // --- LEVEL 2: LOTES ---
        if (!window.cityData[window.currentZone] || !window.cityData[window.currentZone].sectors[window.currentSector]) {
            Toast.warning('Setor vazio. Retornando...');
            window.currentLevel = 1;
            window.currentSector = null;
            renderHierarchy();
            return;
        }

        const sector = window.cityData[window.currentZone].sectors[window.currentSector];
        totalLotesEl.innerText = `Zona ${window.currentZone} > Setor ${window.currentSector}: ${sector.count} Lotes`;

        for (const lote of sector.lotes) {
            const meta = lote.metadata || {};
            const hasUnits = lote.unidades && lote.unidades.length > 0;
            let hasSublots = false;

            if (hasUnits) {
                const sortedUnits = [...lote.unidades].sort((a, b) => {
                    const endA = a.inscricao.slice(-3);
                    const endB = b.inscricao.slice(-3);
                    if (endA === '000') return -1;
                    if (endB === '000') return 1;
                    return a.inscricao.localeCompare(b.inscricao);
                });
                hasSublots = sortedUnits.some(u => u.inscricao.slice(-3) !== '000');
            }

            let color;
            if (window.isNeighborhoodMode) {
                // NEIGHBORHOOD MODE: Color by Bairro
                const bairro = meta.bairro || 'Desconhecido';
                color = window.getNeighborhoodColor(bairro);
            } else {
                // NORMAL MODE: Color by Zone
                color = window.getZoneColor(meta.zona);
            }

            if (hasSublots) {
                color = '#9C27B0'; // Purple for condos
            }
            if (lote.inscricao && window.editedLotes && window.editedLotes[lote.inscricao]) {
                color = '#ff9800'; // Orange for edited
            }

            const loteNum = meta.lote || '?';
            // Use building_name if available, otherwise use lot number
            const displayLabel = lote.building_name || loteNum;

            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="
background-color:${color};
color: white;
border-radius: 4px;
padding: 2px 6px;
font-size: 10px;
font-weight: bold;
box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
cursor: pointer;
border: 1px solid white;
transform: translate(-50%, -50%);
display: -webkit-box;
-webkit-line-clamp: 2;
-webkit-box-orient: vertical;
overflow: hidden;
text-overflow: ellipsis;
max-width: 90px;
white-space: normal;
line-height: 1.2;
text-align: center;
">${displayLabel}</div>`,
                iconSize: null
            });

            const marker = L.marker([lote._lat, lote._lng], { icon: icon });
            marker.on('click', async () => {
                const fullLote = await window.fetchLotDetails(lote.inscricao);
                if (fullLote) {
                    window.showLotTooltip(fullLote, 0, 0);
                }
            });
            marker.on('contextmenu', (e) => {
                window.handleContextMenu(e, 'lote', lote);
            });
            markersLayer.addLayer(marker);
        }
    }

    updateBackBtn();
}

// ========================================
// NAVIGATION
// ========================================
function updateBackBtn() {
    const mapBackBtn = document.getElementById('mapBackBtn');
    if (!mapBackBtn) {
        console.warn("Botão voltar não encontrado no DOM");
        return;
    }

    console.log(`Update Back Btn: Level ${window.currentLevel}`);

    if (window.currentLevel === 0) {
        mapBackBtn.style.display = 'none';
        mapBackBtn.classList.add('hidden');
    } else {
        mapBackBtn.classList.remove('hidden');
        mapBackBtn.style.display = 'block'; // Forçar display block

        // Estilo flutuante para garantir visibilidade
        mapBackBtn.style.position = 'absolute';
        mapBackBtn.style.top = '10px';
        mapBackBtn.style.left = '60px'; // Ao lado do controle de zoom
        mapBackBtn.style.zIndex = '1000';
        mapBackBtn.style.padding = '8px 12px';
        mapBackBtn.style.background = 'white';
        mapBackBtn.style.border = '2px solid rgba(0,0,0,0.2)';
        mapBackBtn.style.borderRadius = '4px';
        mapBackBtn.style.cursor = 'pointer';
        mapBackBtn.style.fontWeight = 'bold';
        mapBackBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

        // Dynamic Text
        if (window.currentLevel === 2) {
            mapBackBtn.innerText = "⬅ Voltar para Setor";
        } else if (window.currentLevel === 1) {
            mapBackBtn.innerText = "⬅ Voltar para Visão Geral";
        }
    }
}

function goUpLevel() {
    if (window.currentLevel === 2) {
        window.currentLevel = 1;
        window.currentSector = null;
        const zone = window.cityData[window.currentZone];
        const centerLat = zone.latSum / zone.count;
        const centerLng = zone.lngSum / zone.count;
        map.setView([centerLat, centerLng], 15);
    } else if (window.currentLevel === 1) {
        window.currentLevel = 0;
        window.currentZone = null;
        window.map.setView([-23.9934, -46.2567], 13);
    }
    renderHierarchy();
}

// ========================================
// EXPORTS
// ========================================
window.processDataHierarchy = processDataHierarchy;
window.renderHierarchy = renderHierarchy;
window.goUpLevel = goUpLevel;
window.updateBackBtn = updateBackBtn;

// ========================================
// REALTIME UPDATES
// ========================================
window.handleRealtimeUpdate = function (payload) {
    console.log("Realtime Event:", payload);
    const { eventType, table, new: newRow, old: oldRow } = payload;

    if (table === 'lotes') {
        if (eventType === 'INSERT') {
            const transformed = {
                ...newRow,
                metadata: {
                    inscricao: newRow.inscricao,
                    zona: newRow.zona,
                    setor: newRow.setor,
                    lote: newRow.lote_geo,
                    quadra: newRow.quadra,
                    loteamento: newRow.loteamento,
                    bairro: newRow.bairro,
                    valor_m2: newRow.valor_m2 ? newRow.valor_m2.toString().replace('.', ',') : null
                },
                bounds_utm: { minx: newRow.minx, miny: newRow.miny, maxx: newRow.maxx, maxy: newRow.maxy },
                unidades: []
            };
            window.allLotes.push(transformed);
            processDataHierarchy();
            renderHierarchy();
            window.Toast.info(`Novo lote recebido: ${newRow.inscricao}`);
        }
        else if (eventType === 'UPDATE') {
            const index = window.allLotes.findIndex(l => l.inscricao === newRow.inscricao);
            if (index !== -1) {
                const currentMeta = window.allLotes[index].metadata || {};
                const currentBounds = window.allLotes[index].bounds_utm || { minx: 0, miny: 0, maxx: 0, maxy: 0 };

                window.allLotes[index] = {
                    ...window.allLotes[index],
                    ...newRow,
                    metadata: {
                        ...currentMeta,
                        zona: newRow.zona !== undefined ? newRow.zona : currentMeta.zona,
                        setor: newRow.setor !== undefined ? newRow.setor : currentMeta.setor,
                        lote: newRow.lote_geo !== undefined ? newRow.lote_geo : currentMeta.lote,
                        quadra: newRow.quadra !== undefined ? newRow.quadra : currentMeta.quadra,
                        bairro: newRow.bairro !== undefined ? newRow.bairro : currentMeta.bairro
                    },
                    bounds_utm: {
                        minx: newRow.minx !== undefined ? newRow.minx : currentBounds.minx,
                        miny: newRow.miny !== undefined ? newRow.miny : currentBounds.miny,
                        maxx: newRow.maxx !== undefined ? newRow.maxx : currentBounds.maxx,
                        maxy: newRow.maxy !== undefined ? newRow.maxy : currentBounds.maxy
                    }
                };
                processDataHierarchy();
                renderHierarchy();
            }
        }
        else if (eventType === 'DELETE') {
            const index = window.allLotes.findIndex(l => l.inscricao === oldRow.inscricao);
            if (index !== -1) {
                window.allLotes.splice(index, 1);
                processDataHierarchy();
                renderHierarchy();
                window.Toast.info(`Lote removido: ${oldRow.inscricao}`);
            }
        }
    } else if (table === 'unidades') {
        const parentId = (newRow && newRow.lote_inscricao) || (oldRow && oldRow.lote_inscricao);
        const parentLot = window.allLotes.find(l => l.inscricao === parentId);
        if (parentLot) {
            parentLot._detailsLoaded = false;
            // console.log(`Unit updated: ${parentId} - Not re-rendering full map.`);
        }
    }
};

// ========================================
// ZONE LEGEND POPULATION
// ========================================
window.populateZoneLegend = function () {
    const container = document.getElementById('zoneLegendContainer');
    if (!container) return;

    container.innerHTML = '';

    // Sort zones numerically
    const zones = Object.keys(window.cityData).sort((a, b) => {
        return parseInt(a) - parseInt(b);
    });

    zones.forEach(zoneKey => {
        const zone = window.cityData[zoneKey];
        const color = window.getZoneColor(zoneKey);

        const item = document.createElement('div');
        item.className = 'legend-item';
        item.style.cursor = 'pointer';
        item.onclick = (e) => {
            e.stopPropagation();
            const centerLat = zone.latSum / zone.count;
            const centerLng = zone.lngSum / zone.count;
            window.currentLevel = 1;
            window.currentZone = zoneKey;
            window.map.setView([centerLat, centerLng], 14);
            window.renderHierarchy();
        };

        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.cssText = `width:10px; height:10px; border-radius:3px; background-color:${color}; flex-shrink:0;`;

        const label = document.createElement('div');
        label.className = 'legend-label';
        label.style.cssText = `font-size:12px; font-weight:600; color:#475569; display:flex; align-items:center; gap:6px;`;
        label.innerHTML = `<span>Zona ${zoneKey}</span> <span style=\"font-weight:400; font-size:10px; color:#94a3b8;\">(${zone.count})</span>`;

        item.style.cssText = `display:flex; align-items:center; gap:8px; padding:4px 0; border-bottom:1px solid #f1f5f9;`;
        item.appendChild(colorBox);
        item.appendChild(label);
        container.appendChild(item);
    });
};

// ========================================
// CONTEXT MENU
// ========================================
let contextMenuTarget = null;
let contextMenuPos = null;

window.handleContextMenu = function (e, type, data) {
    if (e.originalEvent) {
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();
    }

    const menu = document.getElementById('context-menu');
    if (!menu) return;

    contextMenuTarget = { type, data };
    contextMenuPos = e.latlng;

    menu.querySelectorAll('.context-menu-item').forEach(el => el.style.display = 'none');
    const dividers = menu.querySelectorAll('.context-menu-divider');
    dividers.forEach(d => d.style.display = 'none');

    if (type === 'map') {
        document.getElementById('ctx-create-lote').style.display = 'flex';
        document.getElementById('ctx-add-lead').style.display = 'flex';
        if (dividers[0]) dividers[0].style.display = 'block';
        if (dividers[1]) dividers[1].style.display = 'block';
    } else if (type === 'lote') {
        document.getElementById('ctx-add-unit').style.display = 'flex';
        document.getElementById('ctx-move-lote').style.display = 'flex';
        document.getElementById('ctx-edit-details').style.display = 'flex';
        document.getElementById('ctx-delete-lote').style.display = 'flex';
        document.getElementById('ctx-add-lead').style.display = 'flex';
        if (dividers[0]) dividers[0].style.display = 'block';
        if (dividers[1]) dividers[1].style.display = 'block';
    }

    // Always show cancel
    const items = menu.querySelectorAll('.context-menu-item');
    if (items.length > 0) items[items.length - 1].style.display = 'flex';

    const x = e.originalEvent ? e.originalEvent.pageX : e.containerPoint.x;
    const y = e.originalEvent ? e.originalEvent.pageY : e.containerPoint.y;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
};

window.hideContextMenu = function () {
    const menu = document.getElementById('context-menu');
    if (menu) menu.style.display = 'none';
};

document.addEventListener('click', () => window.hideContextMenu());

window.handleContextAction = function (action) {
    const target = contextMenuTarget;
    const pos = contextMenuPos;
    window.hideContextMenu();

    if (!target) return;
    const { type, data } = target;

    if (action === 'create' && type === 'map') {
        if (typeof window.openAddLoteModal === 'function') window.openAddLoteModal(pos);
    } else if (action === 'add-unit' && type === 'lote') {
        if (typeof window.openAddUnitModal === 'function') window.openAddUnitModal(data);
    } else if (action === 'edit' && type === 'lote') {
        // Open tooltip first, then activate edit mode
        if (typeof window.showLotTooltip === 'function' && typeof window.editFromTooltip === 'function') {
            const lote = window.allLotes.find(l => l.inscricao === data.inscricao);
            if (lote) {
                // Open the tooltip
                window.showLotTooltip(lote, pos.x, pos.y);
                // Wait a bit for tooltip to render, then activate edit mode
                setTimeout(() => {
                    window.editFromTooltip(data.inscricao);
                }, 100);
            }
        }
    } else if (action === 'move' && type === 'lote') {
        window.Toast.info('Clique no mapa para mover o lote para a nova localização');
        // Set up one-time click handler for new position
        const moveHandler = (e) => {
            window.map.off('click', moveHandler);
            if (typeof window.moveLote === 'function') {
                window.moveLote(data.inscricao, e.latlng);
            }
        };
        window.map.once('click', moveHandler);
    } else if (action === 'delete' && type === 'lote') {
        if (typeof window.deleteLote === 'function') window.deleteLote(data.inscricao);
    }
};

console.log("✅ Map Handler module loaded");
