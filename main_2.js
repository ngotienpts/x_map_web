
// Configuration constants
const CONFIG = {
    map: {
        initialLat: 20.978009,
        initialLon: 105.8121463,
        zoom: 16
    },
    gps: {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    },
    marker: {
        color: '#FF0000'
    }
};

// URL parameter handling
function initConfigFromURL() {
    const params = new URLSearchParams(window.location.search);
    const markerParam = params.get("marker");

    if (markerParam) {
        const coords = markerParam.split(",").map(Number);
        if (coords.length === 2 && !coords.some(isNaN)) {
            CONFIG.map.initialLat = coords[0];
            CONFIG.map.initialLon = coords[1];
        }
    }
}

// Initialize application
function initializeApp() {
    initConfigFromURL();
    
    // Create map
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://xmap.vn/lib/dark-vietnam.json',
        center: [CONFIG.map.initialLon, CONFIG.map.initialLat],
        zoom: CONFIG.map.zoom,
        pitch: 0,
        bearing: 0,
    });
    
    // Add marker
    const marker = new maplibregl.Marker({ 
        color: CONFIG.marker.color 
    })
        .setLngLat([CONFIG.map.initialLon, CONFIG.map.initialLat])
        .addTo(map);
    
    return { map, marker };
}

// Start the application
const { map, marker } = initializeApp();