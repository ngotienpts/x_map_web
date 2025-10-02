// Cấu hình chung
const CONFIG = {
    map: {
        initialLat: 20.978009,
        initialLon: 105.8121463,
        zoom: 16
    },
    marker: {
        color: '#FF0000'
    }
};

// Hàm lấy tọa độ từ các node ID
async function fetchNodeData(nodeIds) {
    const fetchPromises = nodeIds.map(async (nodeId) => {
        try {
            const response = await fetch(`https://api.xmap.vn/node/${nodeId}.json`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (data.elements && data.elements.length > 0) {
                const node = data.elements[0];
                return [node.lon, node.lat];
            }
        } catch (error) {
            console.error(`Lỗi khi tải dữ liệu cho node ${nodeId}:`, error);
            return null;
        }
    });
    const results = await Promise.all(fetchPromises);
    return results.filter(coords => coords !== null);
}

// Hàm khởi tạo và xử lý bản đồ
async function initializeApp() {
    const params = new URLSearchParams(window.location.search);
    const nodesParam = params.get('nodes');
    const markerParam = params.get('marker');

    let initialCoords = [CONFIG.map.initialLon, CONFIG.map.initialLat];
    let initialZoom = CONFIG.map.zoom;
    let routeCoordinates = [];

    // Xử lý tham số URL để xác định tọa độ và zoom ban đầu
    if (nodesParam) {
        const nodeIds = nodesParam.split(',');
        routeCoordinates = await fetchNodeData(nodeIds);
        if (routeCoordinates.length > 0) {
            // Lấy tọa độ của node đầu tiên để làm tâm bản đồ
            initialCoords = routeCoordinates[0];
            initialZoom = 17;
        }
    } else if (markerParam) {
        const coords = markerParam.split(",").map(Number);
        if (coords.length === 2 && !coords.some(isNaN)) {
            const [lat, lon] = coords;
            initialCoords = [lon, lat];
            initialZoom = 17;
        }
    }

    // Khởi tạo bản đồ với các giá trị đã xác định
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://xmap.vn/lib/dark-vietnam.json',
        center: initialCoords,
        zoom: initialZoom
    });

    map.on('load', () => {
        // Vẽ đường đi nếu có nodes
        if (routeCoordinates.length > 1) {
            map.addSource('route', {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': routeCoordinates
                    }
                }
            });
            map.addLayer({
                'id': 'route-line',
                'type': 'line',
                'source': 'route',
                'paint': { 'line-color': '#ed6498', 'line-width': 5 }
            });
            
            // Thêm marker tại điểm cuối
            const lastCoord = routeCoordinates[routeCoordinates.length - 1];
            new maplibregl.Marker({ color: '#FF0000' })
                .setLngLat(lastCoord)
                .addTo(map);

            // Tự động fit bản đồ để hiển thị toàn bộ đường đi
            const bounds = new maplibregl.LngLatBounds();
            routeCoordinates.forEach(coord => bounds.extend(coord));
            map.fitBounds(bounds, { padding: 50 });
        }
        
        // Thêm marker nếu có tham số marker
        if (markerParam) {
            const coords = markerParam.split(",").map(Number);
            if (coords.length === 2 && !coords.some(isNaN)) {
                const [lat, lon] = coords;
                new maplibregl.Marker({ color: CONFIG.marker.color })
                    .setLngLat([lon, lat])
                    .addTo(map);
            }
        }
    });
}

initializeApp();