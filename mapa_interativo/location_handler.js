/**
 * LOCATION HANDLER (GPS)
 * Manages user geolocation and the "Minha Localização" feature.
 */

const LocationHandler = {
    watchId: null,
    userMarker: null,
    isFollowing: false,

    init() {
        if (this.btn) {
            console.warn("📍 Location Handler already initialized.");
            return;
        }
        this.createControl();
        console.log("📍 Location Handler Initialized");
    },

    createControl() {
        // Create the GPS button
        const controlDiv = document.createElement('div');
        controlDiv.className = 'leaflet-control landscape-control'; // Reuse existing map control class if possible or custom
        controlDiv.style.cssText = `
            position: absolute; bottom: 150px; right: 10px; z-index: 900;
            background: white; border-radius: 50%; width: 50px; height: 50px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            border: 2px solid white;
        `;
        controlDiv.innerHTML = '<i class="fas fa-crosshairs" style="font-size: 20px; color: #334155;"></i>';

        controlDiv.onclick = () => this.toggleTracking();

        document.getElementById('map').appendChild(controlDiv);
        this.btn = controlDiv;
    },

    toggleTracking() {
        if (this.isFollowing) {
            this.stopTracking();
        } else {
            this.startTracking();
        }
    },

    startTracking() {
        if (!navigator.geolocation) {
            console.error("❌ Geolocation API not supported in this environment.");
            if (window.Toast) window.Toast.error("GPS não suportado neste dispositivo.");
            return;
        }

        if (window.Toast) window.Toast.info("Buscando sua localização...");
        this.btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="color: #0284c7;"></i>';

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                this.updateMarker(lat, lng, accuracy);

                // Centering (First time or Follow Mode)
                if (!this.userMarker || this.isFollowing) {
                    window.map.setView([lat, lng], 18);
                }

                if (!this.isFollowing) {
                    this.isFollowing = true;
                    this.btn.innerHTML = '<i class="fas fa-location-arrow" style="color: #0284c7;"></i>'; // Active Icon
                    if (window.Toast) window.Toast.success("Localização encontrada!");
                }

                console.log(`📍 GPS Update: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}, Acc ${accuracy}m`);

                // AUTO-DETECT PROXIMITY
                if (window.findNearestLot && accuracy < 50) { // Only if accuracy is decent
                    const nearest = window.findNearestLot(lat, lng);
                    if (nearest) {
                        // Prevent spamming: Only show if not already showing this one
                        // Check if we are already viewing this lot
                        const currentInscricao = window.currentTooltip && window.currentLoteForUnit ? window.currentLoteForUnit.inscricao : null;

                        if (currentInscricao !== nearest.inscricao) {
                            console.log("📍 GPS Auto-Select:", nearest.inscricao);
                            window.Toast.info(`📍 Você está no lote: ${nearest.metadata.bairro}`, 'Localização Detectada');
                            window.showLotTooltip(nearest);
                        }
                    }
                }
            },
            (error) => {
                console.error("❌ GPS Error Code:", error.code, "Message:", error.message);
                let msg = "Erro ao obter localização.";
                if (error.code === 1) {
                    msg = "Permissão de GPS negada.";
                    console.warn("⚠️ User denied GPS permission.");
                }
                if (error.code === 2) {
                    msg = "Sinal de GPS indisponível.";
                    console.warn("⚠️ GPS Signal Unavailable.");
                }
                if (error.code === 3) {
                    msg = "Tempo limite esgotado.";
                    console.warn("⚠️ GPS Timeout.");
                }

                if (window.Toast) window.Toast.error(msg);
                this.stopTracking();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    },

    stopTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isFollowing = false;
        this.btn.innerHTML = '<i class="fas fa-crosshairs" style="color: #334155;"></i>';
    },

    updateMarker(lat, lng, accuracy) {
        // If marker exists, update it
        if (this.userMarker) {
            this.userMarker.setLatLng([lat, lng]);
            this.userCircle.setLatLng([lat, lng]);
            this.userCircle.setRadius(accuracy / 2); // Show accuracy radius
        } else {
            // Create Blue Dot Marker
            // Outer Circle (Accuracy/Pulse)
            this.userCircle = L.circle([lat, lng], {
                radius: accuracy / 2,
                color: '#0284c7',
                fillColor: '#0284c7',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(window.map);

            // Inner Dot
            this.userMarker = L.circleMarker([lat, lng], {
                radius: 8,
                color: '#ffffff',
                fillColor: '#0284c7',
                fillOpacity: 1,
                weight: 3
            }).addTo(window.map);

            // Bring to front
            this.userMarker.bringToFront();
        }
    }
};

// Auto-init if map is ready, or wait
if (window.map) {
    LocationHandler.init();
} else {
    // Poll for map or listen to an event (simplest is polling or waiting for load)
    const checkMap = setInterval(() => {
        if (window.map) {
            LocationHandler.init();
            clearInterval(checkMap);
        }
    }, 500);
}
