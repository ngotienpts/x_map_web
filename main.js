
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

// Map style configuration
const MAP_STYLE = {
    version: 8,
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    sources: {
        vietnam: {
            type: "vector",
            tiles: ["https://tiles.xmap.vn/vector/{z}/{x}/{y}.pbf"],
            minzoom: 0,
            maxzoom: 14
        }
    },
    layers: [
        // Base layers
        {
            id: "earth",
            type: "fill",
            source: "vietnam",
            "source-layer": "landcover",
            paint: { "fill-color": "#1c1b23" }
        },
        {
            id: "landuse",
            type: "fill",
            source: "vietnam",
            "source-layer": "landuse",
            paint: {
                "fill-color": "#2e2e36",
                "fill-opacity": 0.6
            }
        },
        {
            id: "water",
            type: "fill",
            source: "vietnam",
            "source-layer": "water",
            paint: {
                "fill-color": "#42587c",
                "fill-opacity": 0.7
            }
        },
        {
            id: "buildings",
            type: "fill",
            source: "vietnam",
            "source-layer": "building",
            paint: {
                "fill-color": "#5e6370",
                "fill-opacity": 0.8
            }
        },
        // Grass areas
        {
            id: "landuse-grass",
            type: "fill",
            source: "vietnam",
            "source-layer": "landuse",
            filter: ["==", ["get", "class"], "grass"],
            paint: {
                "fill-color": "#0C4321",
                "fill-opacity": 0.6
            }
        },
        // Road network
        {
            id: "roads",
            type: "line",
            source: "vietnam",
            "source-layer": "transportation",
            paint: {
                "line-color": [
                    "case",
                    ["in", ["get", "highway"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "service"]]], "#424247",
                    ["==", ["get", "highway"], "residential"], "#141B23",
                    ["==", ["get", "footway"], "crossing"], "rgba(0,0,0,0)",
                    ["in", ["get", "highway"], ["literal", ["pedestrian"]]], "#999999",
                    ["==", ["get", "footway"], "sidewalk"], "#999999",
                    "#d2b48c"
                ],
                "line-width": [
                    "interpolate", ["linear"], ["zoom"],
                    12, [
                        "case",
                        ["==", ["get", "highway"], "motorway"], 2.5,
                        ["==", ["get", "highway"], "trunk"], 2.2,
                        ["==", ["get", "highway"], "primary"], 2,
                        ["==", ["get", "highway"], "secondary"], 1.8,
                        ["==", ["get", "highway"], "residential"], 1.2,
                        1
                    ],
                    15, [
                        "case",
                        ["==", ["get", "highway"], "motorway"], 7,
                        ["==", ["get", "highway"], "trunk"], 6,
                        ["==", ["get", "highway"], "primary"], 5,
                        ["==", ["get", "highway"], "secondary"], 4.5,
                        ["==", ["get", "highway"], "residential"], 3,
                        2
                    ],
                    18, [
                        "case",
                        ["==", ["get", "highway"], "motorway"], 14,
                        ["==", ["get", "highway"], "trunk"], 12,
                        ["==", ["get", "highway"], "primary"], 10,
                        ["==", ["get", "highway"], "secondary"], 9,
                        ["==", ["get", "highway"], "residential"], 6,
                        ["==", ["get", "highway"], "pedestrian"], 2,
                        ["==", ["get", "footway"], "sidewalk"], 1.5,
                        3.5
                    ]
                ]
            }
        },
        // Center lines for pedestrian areas and crossings
        {
            id: "center-line",
            type: "line",
            source: "vietnam",
            "source-layer": "transportation",
            minzoom: 17,
            filter: [
                "any",
                ["==", ["get", "highway"], "pedestrian"],
                ["==", ["get", "footway"], "crossing"],
                ["==", ["get", "highway"], "crossing"]
            ],
            paint: {
                "line-color": "#999999",
                "line-width": [
                    "interpolate", ["linear"], ["zoom"],
                    17, [
                        "case",
                        ["==", ["get", "footway"], "crossing"], 20,
                        0.4
                    ],
                    18, [
                        "case",
                        ["==", ["get", "footway"], "crossing"], 30,
                        0.8
                    ]
                ],
                "line-dasharray": [0.2, 0.2],
                "line-opacity": [
                    "interpolate", ["linear"], ["zoom"],
                    15, 0.6,
                    17, 0.8,
                    18, 1
                ]
            }
        }
    ]
};

// Initialize application
function initializeApp() {
    initConfigFromURL();
    
    // Create map
    const map = new maplibregl.Map({
        container: 'map',
        style: MAP_STYLE,
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