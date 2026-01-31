/**
 * ANALYTICS & MARKET INTELLIGENCE HANDLER
 * Manages Heatmaps and Strategic Data Visualization.
 */

const AnalyticsHandler = {
    heatmapLayer: null,
    isOn: false,

    init() {
        console.log("🔥 Analytics Handler Initialized");
        this.addHeatmapToggle();
    },

    addHeatmapToggle() {
        // Find the specific actions container in the stats panel
        const dashboardActions = document.querySelector('.dashboard-actions');
        if (dashboardActions) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'dashboard-btn secondary';
            toggleBtn.style.marginLeft = '8px'; // Spacing
            toggleBtn.innerHTML = '<i class="fas fa-fire"></i> Calor';
            toggleBtn.title = "Ativar/Desativar Mapa de Calor";

            toggleBtn.onclick = () => {
                const isActive = toggleBtn.classList.contains('active');
                if (isActive) {
                    toggleBtn.classList.remove('active');
                    toggleBtn.style.background = ''; // Revert to secondary style
                    toggleBtn.style.color = '';
                    this.toggleHeatmap(false);
                } else {
                    toggleBtn.classList.add('active');
                    toggleBtn.style.background = 'linear-gradient(135deg, #f87171, #ef4444)';
                    toggleBtn.style.color = 'white';
                    this.toggleHeatmap(true);
                }
            };

            dashboardActions.appendChild(toggleBtn);
        }
    },

    toggleHeatmap(show) {
        if (!window.map) return;

        if (show) {
            this.generateMockData().then(points => {
                if (this.heatmapLayer) {
                    window.map.removeLayer(this.heatmapLayer);
                }

                // Heatmap Configuration
                this.heatmapLayer = L.heatLayer(points, {
                    radius: 25,
                    blur: 15,
                    maxZoom: 17,
                    gradient: {
                        0.4: 'blue',
                        0.6: 'cyan',
                        0.7: 'lime',
                        0.8: 'yellow',
                        1.0: 'red'
                    }
                }).addTo(window.map);

                if (window.Toast) window.Toast.info("Mapa de Calor ativado: Zonas de Alta Demanda");
                this.isOn = true;
                console.log("🔥 Heatmap Layer Enabled");
            });
        } else {
            if (this.heatmapLayer) {
                window.map.removeLayer(this.heatmapLayer);
            }
            this.isOn = false;
            console.log("❄️ Heatmap Layer Disabled");
        }
    },

    async generateMockData() {
        // In a real app, we would fetch this from Supabase (e.g., clicks logs)
        // For now, we simulate hotspots in "Prime" areas (Enseada, Pitangueiras)

        const hotspots = [];

        // Helper to add random points around a center
        const addCluster = (lat, lng, count, spread) => {
            for (let i = 0; i < count; i++) {
                hotspots.push([
                    lat + (Math.random() - 0.5) * spread,
                    lng + (Math.random() - 0.5) * spread,
                    Math.random() // Intensity (0-1)
                ]);
            }
        };

        // Pitangueiras (High Density)
        addCluster(-24.0080, -46.2550, 300, 0.015);

        // Enseada (High Value)
        addCluster(-23.9950, -46.2200, 400, 0.020);

        // Jardim Acapulco (Exclusive)
        addCluster(-23.9650, -46.1900, 150, 0.010);

        return hotspots;
    }
};

// Init
window.addEventListener('load', () => {
    setTimeout(() => AnalyticsHandler.init(), 1000);
});
