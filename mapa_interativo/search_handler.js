// ==========================================
// SEARCH & FILTER HANDLER (V1.0.1 - REFRESHED)
// ==========================================

window.currentSearchType = 'all';

// Initialize Search Listeners
window.setupSearchAndFilters = function () {
    console.log("Initializing Search Handler...");

    // Filter Chips
    const chips = document.querySelectorAll('.filter-chip[data-search-type]');
    chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            // UI Toggle
            chips.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');

            // Logic Update
            window.currentSearchType = e.target.dataset.searchType;
            console.log(`Search Type Changed to: ${window.currentSearchType}`);

            // Re-run search if input is present
            const query = document.getElementById('searchInput').value;
            if (query && query.length >= 3) {
                window.performSearch(query);
            }
        });
    });

    // Search Input Logic
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');

    if (searchBtn) {
        searchBtn.onclick = () => {
            const query = searchInput.value;
            window.performSearch(query);
        };
    }

    if (searchInput) {
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                window.performSearch(searchInput.value);
            }
        };

        // Clear button logic
        searchInput.oninput = (e) => {
            if (clearBtn) {
                clearBtn.style.display = e.target.value ? 'block' : 'none';
            }
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            document.getElementById('searchResults').classList.add('hidden');
            document.getElementById('sidebar').classList.remove('searching');
            document.querySelector('.search-box')?.classList.remove('loading');
        };
    }
};

window.performSearch = async function (query) {
    if (!query || query.trim().length < 2) {
        window.Toast.warning('Digite pelo menos 2 caracteres.');
        return;
    }

    // Format for Text Search (Prefix matching on all terms)
    // "Rua do Sol" -> "'Rua':* & 'do':* & 'Sol':*"
    const formatTsQuery = (input) => {
        // 1. Remove accents (NFD normalization)
        let clean = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        // 2. Remove special chars except spaces, alphanumeric and basic punctuation if needed
        clean = clean.replace(/['"]/g, ""); // Remove quotes to prevent query errors

        return clean.trim().split(/\s+/).filter(w => w.length > 0).map(w => `'${w}':*`).join(' & ');
    };

    const tsQuery = formatTsQuery(query);
    const type = window.currentSearchType;
    let results = [];

    const searchBox = document.querySelector('.search-box');
    if (searchBox) searchBox.classList.add('loading');

    try {
        console.log(`Searching for "${tsQuery}" (TextSearch) with type "${type}"`);

        // 1. Street Search (Old functionality preserved)
        if (type === 'all' || type === 'street') {
            // Check if query contains a number at the end
            let streetTerm = query.trim();
            const numberMatch = streetTerm.match(/^(.*?)(?:\s+(?:nº?|num|no|-)?\s*)(\d+)$/i);

            let queryBuilder = window.supabaseApp
                .from('unidades')
                .select('inscricao, endereco_completo, numero, bairro_unidade, lote_inscricao');

            if (numberMatch) {
                const rawStreet = numberMatch[1].trim();
                const rawNumber = numberMatch[2];
                const paddedNumber = rawNumber.padStart(5, '0');
                const unpaddedNumber = parseInt(rawNumber, 10).toString();
                const variants = [...new Set([rawNumber, paddedNumber, unpaddedNumber])];
                const streetTsQuery = formatTsQuery(rawStreet);

                queryBuilder = queryBuilder
                    .textSearch('endereco_completo', streetTsQuery, { config: 'portuguese' })
                    .in('numero', variants);
            } else {
                queryBuilder = queryBuilder
                    .textSearch('endereco_completo', tsQuery, { config: 'portuguese' });
            }

            const { data: streets } = await queryBuilder.limit(20);

            if (streets) {
                results = results.concat(streets.map(item => {
                    // Strictly string-based logic to avoid NaN
                    let address = String(item.endereco_completo || '').trim();
                    let houseNum = String(item.numero || '').replace(/^0+/, '').trim();

                    // Sanitize House Number
                    if (houseNum === 'NaN' || houseNum === 'null' || houseNum === 'undefined') {
                        houseNum = '';
                    }

                    // Build Label gracefully
                    let finalLabel = address;
                    if (houseNum && houseNum !== 'S/N' && !address.includes(houseNum)) {
                        finalLabel += ', ' + houseNum;
                    }

                    return {
                        ...item,
                        type: 'Rua',
                        label: finalLabel,
                        sub: `${item.bairro_unidade || '-'} - Ref: ${item.lote_inscricao || item.inscricao}`,
                        isUnit: true,
                        lote_inscricao: item.lote_inscricao
                    };
                }));
            }
        }

        // 2. Property / Building / Legacy Owner Search
        // "Imóveis" agora busca Edifícios + Proprietários nas UNIDADES (Legado)
        if (type === 'all' || type === 'property' || type === 'building') {
            const promises = [];

            // Edifícios
            promises.push(window.supabaseApp
                .from('lotes')
                .select('inscricao, building_name')
                .textSearch('building_name', tsQuery, { config: 'portuguese' })
                .limit(10)
                .then(r => ({ type: 'building', data: r.data || [] })));

            // Proprietários na tabela de UNIDADES (Busca Clássica "Imóveis de Fulano")
            // Isso permite buscar "Adelson" e ver as unidades individuais
            if (type === 'property' || type === 'all') {
                promises.push(window.supabaseApp
                    .from('unidades')
                    .select('inscricao, nome_proprietario, lote_inscricao, tipo, complemento, endereco_completo')
                    .textSearch('nome_proprietario', tsQuery, { config: 'portuguese' })
                    .limit(20)
                    .then(r => ({ type: 'legacy_unit', data: r.data || [] })));
            }

            const resultsData = await Promise.all(promises);

            resultsData.forEach(res => {
                if (res.type === 'building') {
                    results = results.concat(res.data.map(item => ({
                        ...item,
                        type: 'Edifício',
                        label: item.building_name || 'Edifício sem Nome',
                        sub: `Ref: ${item.inscricao || '-'}`,
                        loteInscricao: item.inscricao
                    })));
                } else if (res.type === 'legacy_unit') {
                    results = results.concat(res.data.map(item => ({
                        ...item,
                        type: 'Imóvel',
                        label: item.nome_proprietario || 'Proprietário não informado',
                        sub: `${item.tipo || ''} ${item.complemento || ''} - ${item.endereco_completo || item.lote_inscricao || '-'}`,
                        isUnit: true,
                        loteInscricao: item.lote_inscricao
                    })));
                }
            });
        }

        // 3. New Owner Search (Unified Only)
        // "Proprietário" busca APENAS na tabela nova
        if (type === 'all' || type === 'owner') {
            // Normaliza termo para bater com a coluna 'nome_busca' (que é lower + unaccent)
            // Atenção: Esta lógica depende da migration 12_fix_accents ter sido rodada no banco
            let term = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

            // NEW: Ultra-permissive Owner Search

            const { data: owners } = await window.supabaseApp
                .from('proprietarios')
                .select('id, nome_completo, cpf_cnpj, total_propriedades')
                .ilike('nome_completo', `%${query.trim()}%`)
                .limit(20);

            if (owners && owners.length > 0) {
                results = results.concat(owners.map(owner => ({
                    type: 'Proprietário',
                    label: owner.nome_completo || 'Sem Nome',
                    sub: `${owner.total_propriedades > 0 ? owner.total_propriedades + ' imóveis • ' : ''}CPF: ${window.formatDocument ? window.formatDocument(owner.cpf_cnpj, false) : owner.cpf_cnpj}`,
                    isOwner: true,
                    proprietarioId: owner.id,
                    inscricao: 'P-' + owner.id
                })));
            }
        }

        // Inscricao Search (Keep ILIKE just for safe number matching)
        if (type === 'all' || type === 'property') {
            const { data: byInscricao } = await window.supabaseApp
                .from('lotes')
                .select('inscricao, bairro')
                .ilike('inscricao', `%${query.trim()}%`)
                .limit(5);

            if (byInscricao) {
                results = results.concat(byInscricao.map(item => ({
                    ...item,
                    type: 'Inscrição',
                    label: item.inscricao || '-',
                    sub: item.bairro || '-'
                })));
            }
        }

        // Deduplicate results by inscricao
        const uniqueResults = [];
        const seen = new Set();
        results.forEach(r => {
            if (!seen.has(r.inscricao)) {
                seen.add(r.inscricao);
                uniqueResults.push(r);
            }
        });

        window.displaySearchResults(uniqueResults);

        if (window.Analytics) {
            window.Analytics.trackSearch(query, type, uniqueResults.length);
        }

    } catch (e) {
        console.error("Search error:", e);
        window.Toast.error("Erro na busca.");
    } finally {
        if (searchBox) searchBox.classList.remove('loading');
    }
};

window.lastSearchResults = [];

window.displaySearchResults = function (results) {
    const container = document.getElementById('searchResults');
    const sidebar = document.getElementById('sidebar');
    window.lastSearchResults = results;

    if (!results || results.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Nenhum resultado encontrado for this filter.</div>';
        container.classList.remove('hidden');
        sidebar.classList.add('searching');
        return;
    }

    // --- Export Header ---
    container.innerHTML = `
            <div style="padding: 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Resultados: ${results.length}</span>
                <button onclick="window.downloadCSV(window.lastSearchResults, 'busca_guaruja_geo.csv')" 
                    style="background: #22c55e; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-file-csv"></i> Exportar CSV
                </button>
            </div>
        `;

    // Group by Type for nicer display? Or just flat list. Flat list is simpler for now.
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-item';
        // Icon based on type
        let icon = '📍';
        if (item.type === 'Edifício/Loteamento') icon = '🏢';
        if (item.type === 'Proprietário') icon = '👤';
        if (item.type === 'Rua') icon = '🛣️';

        div.innerHTML = `
            <div class="result-title" style="color: #2e7d32; font-weight: 700; font-size: 14px;">${icon} ${item.label}</div>
            <div class="result-subtitle" style="font-size: 12px; color: #555;">
                ${item.sub ? `<div style="margin-bottom:2px;">${item.sub}</div>` : ''}
                <div style="font-size: 11px; color: #777;">${item.type}</div>
            </div>
        `;

        div.onclick = () => window.handleResultClick(item);
        container.appendChild(div);
    });

    container.classList.remove('hidden');
    sidebar.classList.add('searching');
};

window.handleResultClick = async function (item) {
    console.log("Result clicked:", item);

    // MOBILE AUTO-COLLAPSE (Save state)
    if (window.innerWidth <= 768) {
        window.mobileSidebarWasOpen = true; // Flag for restoration
        if (window.closeMobileSidebar) window.closeMobileSidebar();
    }

    // 0. Handle Consolidated Owner Click (NEW FLOW)
    if (item.isOwner && item.proprietarioId) {
        if (window.ProprietarioTooltip) {
            window.ProprietarioTooltip.show(item.proprietarioId);
        } else {
            console.error("ProprietarioTooltip module not loaded");
            window.Toast.error("Erro: Módulo de proprietário não carregado.");
        }
        return;
    }

    // 1. Fetch Full Details (LEGACY FLOW - Works for Units, Lots, and Legacy Owners)
    if (item.isUnit) {
        window.navigateToInscricao(item.lote_inscricao, item.inscricao);
    } else {
        window.navigateToInscricao(item.inscricao);
    }
};

/**
 * Core Navigation Logic: Fly hierarchically to a lot/unit and open tooltip
 * @param {string} loteInscricao 
 * @param {string} unitInscricao (Optional)
 */
window.navigateToInscricao = async function (loteInscricao, unitInscricao = null) {
    if (!loteInscricao) return;

    window.Loading.show('Localizando...', 'Preparando navegação');

    try {
        const loteToOpen = await window.fetchLotDetails(loteInscricao);
        if (!loteToOpen) {
            window.Toast.error("Lote não encontrado.");
            return;
        }

        let unitToFocus = null;
        if (unitInscricao && loteToOpen.unidades) {
            unitToFocus = loteToOpen.unidades.find(u => u.inscricao === unitInscricao);
        }

        // --- Ensure Lot is in Hierarchy ---
        const existingIdx = window.allLotes.findIndex(l => l.inscricao === loteToOpen.inscricao);
        if (existingIdx >= 0) {
            window.allLotes[existingIdx] = loteToOpen;
        } else {
            window.allLotes.push(loteToOpen);
        }
        window.processDataHierarchy();

        // --- Calculate Target Coordinates ---
        let targetLat, targetLng;
        if (loteToOpen._lat && loteToOpen._lng) {
            targetLat = loteToOpen._lat;
            targetLng = loteToOpen._lng;
        } else if (loteToOpen.minx) {
            const cx = (loteToOpen.minx + loteToOpen.maxx) / 2;
            const cy = (loteToOpen.miny + loteToOpen.maxy) / 2;
            const ll = window.utmToLatLon(cx, cy);
            targetLat = ll.lat;
            targetLng = ll.lng;
        }

        // --- Hierarchical Animation Sequence ---
        const meta = loteToOpen.metadata || {};
        const targetZone = meta.zona || loteToOpen.zona;
        const targetSector = meta.setor || loteToOpen.setor;

        const flyWait = (lat, lng, zoom) => {
            return new Promise(resolve => {
                window.map.flyTo([lat, lng], zoom, { duration: 1.5 });
                window.map.once('moveend', resolve);
            });
        };

        // Step A: Go to Zone (Level 1)
        if (targetZone && window.cityData[targetZone]) {
            window.currentLevel = 1;
            window.currentZone = targetZone;
            const zoneData = window.cityData[targetZone];
            const zoneLat = zoneData.latSum / zoneData.count;
            const zoneLng = zoneData.lngSum / zoneData.count;
            window.renderHierarchy();
            await flyWait(zoneLat, zoneLng, 14);
        }

        // Step B: Go to Sector (Level 2)
        if (targetZone && targetSector && window.cityData[targetZone].sectors[targetSector]) {
            window.currentLevel = 2;
            window.currentSector = targetSector;
            const sectorData = window.cityData[targetZone].sectors[targetSector];
            const secLat = sectorData.latSum / sectorData.count;
            const secLng = sectorData.lngSum / sectorData.count;
            window.renderHierarchy();
            await flyWait(secLat, secLng, 16);
        }

        // Step C: Go to Lot (Final)
        window.map.flyTo([targetLat, targetLng], 19, { duration: 1.0 });

        // Open Tooltip after arrival
        setTimeout(() => {
            if (unitToFocus && typeof window.showUnitTooltip === 'function') {
                window.showUnitTooltip(unitToFocus, loteToOpen, window.innerWidth / 2, window.innerHeight / 2);
            } else if (typeof window.showLotTooltip === 'function') {
                window.showLotTooltip(loteToOpen, window.innerWidth / 2, window.innerHeight / 2);
            }
        }, 1100);

    } catch (e) {
        console.error("Navigation error:", e);
        window.Toast.error("Erro na navegação.");
    } finally {
        window.Loading.hide();
    }
};

// Re-export fetchLotDetails if not globally available, but it should be in app.js
// We assume fetchLotDetails is window.fetchLotDetails in app.js.

// Initialize on Load
document.addEventListener('DOMContentLoaded', window.setupSearchAndFilters);
