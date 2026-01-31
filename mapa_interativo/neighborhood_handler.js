// ==========================================
// NEIGHBORHOOD HANDLER (Enhanced)
// ==========================================
// Handles loading, coloring, and visualizing Neighborhoods (Bairros)
// Source: vw_bairros_centroids (Materialized View)
// Geometry: UTM -> LatLon conversion
// ==========================================

window.neighborhoodsLoaded = false;
window.neighborhoodData = []; // Combined Data
window.neighborhoodLayer = null;
window.isNeighborhoodMode = false;
window.isNeighborhoodEditMode = false; // New Edit Mode

// Color Palette
const NEIGHBORHOOD_COLORS = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
    '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
];

// Helper: Get Color by Neighborhood Name (Stable Hash)
window.getNeighborhoodColor = function (name) {
    if (!name) return '#cccccc';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % NEIGHBORHOOD_COLORS.length;
    return NEIGHBORHOOD_COLORS[index];
};

// Main Toggle Function (Called by UI Button)
window.toggleNeighborhoods = async function (buttonEl) {
    window.isNeighborhoodMode = !window.isNeighborhoodMode;
    const editBtn = document.getElementById('btnEditNeighborhoods');

    if (window.isNeighborhoodMode) {
        buttonEl.classList.add('active');
        buttonEl.innerHTML = '🏘️ Bairros';
        if (editBtn) editBtn.style.display = 'inline-block'; // Show Edit Button
        window.Toast.info('Ativando visão por Bairros...');

        if (!window.neighborhoodsLoaded) {
            await window.loadNeighborhoods();
        } else {
            // Re-render if already loaded to ensure layer is added
            window.renderNeighborhoods();
        }

    } else {
        buttonEl.classList.remove('active');
        buttonEl.innerHTML = '🗺️ Zonas';
        if (editBtn) editBtn.style.display = 'none'; // Hide Edit Button
        window.Toast.info('Retornando visão por Zonas...');

        if (window.neighborhoodLayer) {
            window.map.removeLayer(window.neighborhoodLayer);
        }
    }

    if (window.renderHierarchy) window.renderHierarchy();
};

window.toggleNeighborhoodEditMode = function (btn) {
    window.isNeighborhoodEditMode = !window.isNeighborhoodEditMode;

    if (window.isNeighborhoodEditMode) {
        btn.classList.add('active');
        btn.innerHTML = '💾 Salvar';
        window.Toast.warning('MODO EDIÇÃO: Arraste os rótulos ou clique com botão direito para ocultar.', 'Edição Ativada');
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '✏️ Editar';
        window.Toast.success('Modo de edição finalizado.');
    }

    // Re-render to enable/disable drag interactivity
    window.renderNeighborhoods();
};

window.loadNeighborhoods = async function () {
    try {
        window.Loading.show('Carregando Bairros...', 'Obtendo dados...');

        // 1. Fetch Auto Data (View)
        const { data: autoData, error: viewError } = await window.supabaseApp
            .from('vw_bairros_centroids').select('*');
        if (viewError) throw viewError;

        // 2. Fetch Manual Adjustments
        const { data: manualData, error: manualError } = await window.supabaseApp
            .from('bairros_ajustes').select('*');
        // Ignore manual error (table might not exist yet)

        // 3. Merge Strategies
        const adjustments = {};
        if (manualData) {
            manualData.forEach(m => {
                if (m.nome_bairro) adjustments[m.nome_bairro.trim()] = m;
            });
        }

        const mergedMap = new Map();

        // 1. Process View Data (Automatic Centroids)
        autoData.forEach(b => {
            const bairroName = b.nome ? b.nome.trim() : 'Desconhecido';
            const adj = adjustments[bairroName] || {};

            let coords = window.utmToLatLon(b.utm_x, b.utm_y);
            if (adj.lat && adj.lng) {
                coords = { lat: adj.lat, lng: adj.lng };
            }

            mergedMap.set(bairroName, {
                ...b,
                nome: bairroName,
                _lat: coords.lat,
                _lng: coords.lng,
                _visible: adj.visible !== false
            });
        });

        // 2. Add New Manual Neighborhoods (those not in the View)
        if (manualData) {
            manualData.forEach(m => {
                const manualName = m.nome_bairro ? m.nome_bairro.trim() : null;
                if (manualName && !mergedMap.has(manualName)) {
                    console.log("➕ Carregando Bairro Manual:", manualName);
                    mergedMap.set(manualName, {
                        nome: manualName,
                        _lat: m.lat,
                        _lng: m.lng,
                        _visible: m.visible !== false,
                        total_lotes: 0
                    });
                }
            });
        }

        window.neighborhoodData = Array.from(mergedMap.values());
        console.log(`✅ Merge concluído: ${window.neighborhoodData.length} bairros totais.`);

        window.neighborhoodsLoaded = true;
        window.renderNeighborhoods();
        window.Loading.hide();

    } catch (e) {
        console.error("Erro loadNeighborhoods:", e);
        window.Toast.error('Erro ao carregar dados de bairros.');
        window.Loading.hide();
    }
};

window.renderNeighborhoods = function () {
    if (!window.neighborhoodData) return;

    if (!window.neighborhoodLayer) {
        window.neighborhoodLayer = L.layerGroup();
    } else {
        window.neighborhoodLayer.clearLayers();
    }

    if (window.isNeighborhoodMode) {
        window.neighborhoodLayer.addTo(window.map);
    } else {
        window.map.removeLayer(window.neighborhoodLayer);
        return;
    }

    const renderedPoints = []; // To track rendered label positions for anti-collision
    const COLLISION_THRESHOLD = 70; // Pixel distance to hide overlapping labels

    window.neighborhoodData.forEach(bairro => {
        if (!bairro._visible && !window.isNeighborhoodEditMode) return;

        // Anti-Collision Check
        // Convert LatLng to Pixel Point on screen
        const point = window.map.latLngToLayerPoint([bairro._lat, bairro._lng]);

        let isOverlapping = false;
        if (!window.isNeighborhoodEditMode) {
            for (const other of renderedPoints) {
                const dist = point.distanceTo(other);
                if (dist < COLLISION_THRESHOLD) {
                    isOverlapping = true;
                    break;
                }
            }
        }

        if (isOverlapping) return; // Skip rendering this label if it overlaps
        renderedPoints.push(point);

        // Label Class & HTML
        // Use minimal inline style, rely on CSS class
        const editClass = window.isNeighborhoodEditMode ? 'editing' : '';
        const labelHtml = `<div class="neighborhood-label-content ${editClass}" style="
            opacity: ${bairro._visible ? '' : '0.3'};
            cursor: ${window.isNeighborhoodEditMode ? 'move' : 'default'};
            pointer-events: auto;
        ">${bairro.nome} ${!bairro._visible ? '(Oculto)' : ''}</div>`;

        const icon = L.divIcon({
            className: 'neighborhood-label-icon',
            html: labelHtml,
            iconSize: null,
            iconAnchor: [40, 10]
        });

        const marker = L.marker([bairro._lat, bairro._lng], {
            icon: icon,
            interactive: true, // Always interactive for hover/edit
            draggable: window.isNeighborhoodEditMode,
            zIndexOffset: 1000
        });

        // --- EDIT EVENTS ---
        if (window.isNeighborhoodEditMode) {
            marker.on('dragend', async (e) => {
                const newPos = e.target.getLatLng();
                bairro._lat = newPos.lat;
                bairro._lng = newPos.lng;
                await window.saveNeighborhoodAdjustment(bairro.nome, { lat: newPos.lat, lng: newPos.lng });
            });

            marker.on('contextmenu', async (e) => {
                L.DomEvent.stopPropagation(e);
                const hide = confirm(`Ocultar o bairro "${bairro.nome}"?`);
                if (hide) {
                    bairro._visible = false;
                    await window.saveNeighborhoodAdjustment(bairro.nome, { visible: false });
                    window.renderNeighborhoods();
                }
            });

            if (!bairro._visible) {
                marker.on('click', async () => {
                    const show = confirm(`Restaurar o bairro "${bairro.nome}"?`);
                    if (show) {
                        bairro._visible = true;
                        await window.saveNeighborhoodAdjustment(bairro.nome, { visible: true });
                        window.renderNeighborhoods();
                    }
                });
            }
        }

        window.neighborhoodLayer.addLayer(marker);
    });

    // Re-bind zoom/move events to refresh anti-collision
    // Re-bind zoom/move events to refresh anti-collision
    if (!window._refreshNeighborhoods) {
        window._refreshNeighborhoods = () => window.renderNeighborhoods();
    }

    window.map.off('zoomend moveend', window._refreshNeighborhoods);
    window.map.on('zoomend moveend', window._refreshNeighborhoods);

    // --- MAP CONTEXT MENU FOR CREATION ---
    if (!window._handleMapContextCreateBairro) {
        window._handleMapContextCreateBairro = async function (e) {
            if (!window.isNeighborhoodEditMode) return;

            const nome = prompt("Nome do Novo Bairro (Manual):");
            if (nome) {
                const { lat, lng } = e.latlng;
                window.Loading.show('Criando Bairro...');

                await window.saveNeighborhoodAdjustment(nome, { lat, lng, visible: true });

                // Add to local data to show immediately
                window.neighborhoodData.push({
                    nome: nome,
                    _lat: lat,
                    _lng: lng,
                    _visible: true,
                    total_lotes: 0 // Manual mark
                });

                window.renderNeighborhoods();
                window.Loading.hide();
                window.Toast.success(`Bairro "${nome}" criado!`);
            }
        };
    }

    if (window.isNeighborhoodEditMode) {
        window.map.off('contextmenu', window._handleMapContextCreateBairro); // Avoid double register
        window.map.on('contextmenu', window._handleMapContextCreateBairro);
        console.log("✅ Map ContextMenu Registered for Creation");
    } else {
        window.map.off('contextmenu', window._handleMapContextCreateBairro);
    }
};

window.saveNeighborhoodAdjustment = async function (nome, changes) {
    if (!nome) return;
    const cleanNome = nome.trim();

    try {
        const payload = {
            nome_bairro: cleanNome,
            ...changes,
            updated_at: new Date()
        };

        const { error } = await window.supabaseApp
            .from('bairros_ajustes')
            .upsert(payload, { onConflict: 'nome_bairro' });

        if (error) throw error;

        // Show success for everything to be sure
        window.Toast.success(`Ajuste de "${cleanNome}" salvo no banco!`);
        console.log("💾 Salvo com sucesso:", cleanNome, changes);

    } catch (e) {
        console.error("❌ Erro ao salvar bairro:", e);
        window.Toast.error(`Erro ao salvar: ${e.message}`);
    }
};
