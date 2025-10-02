// Cấu hình bản đồ
const MAP_CONFIG = {
    initialCenter: [105.8121463, 20.978009], // [lon, lat]
    initialZoom: 16,
    routeColor: '#ed6498',
    routeWidth: 5,
    markerColor: '#FF0000',
    endPointMarkerColor: '#FF0000',
    startPointCircleColor: '#33D14D' // Màu mới cho chấm tròn điểm đầu
};

// Hàm tải dữ liệu từ một URL JSON để lấy tọa độ
async function fetchCoordsFromUrl(nodeId) {
    try {
        const response = await fetch(`https://api.xmap.vn/node/${nodeId}.json`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.elements && data.elements.length > 0) {
            const node = data.elements[0];
            return [node.lon, node.lat];
        }
        return null;
    } catch (error) {
        console.error(`Lỗi khi tải dữ liệu từ node ${nodeId}:`, error);
        return null;
    }
}

// Hàm lấy dữ liệu tuyến đường từ OSRM
async function fetchRouteData(startCoords, endCoords) {
    const url = `https://router.project-osrm.org/route/v1/driving/${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?overview=full&geometries=geojson`;
    console.log(`Đang gọi OSRM với URL: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`OSRM API error! status: ${response.status}`);
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distance = route.distance / 1000;
            console.log(`Đã tìm thấy tuyến đường. Tổng quãng đường: ${distance.toFixed(2)} km`);
            return route.geometry.coordinates;
        }
        console.warn('Không tìm thấy tuyến đường từ OSRM.');
        return null;
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu định tuyến:", error);
        return null;
    }
}

// Khởi tạo và xử lý bản đồ
async function initMap() {
    const params = new URLSearchParams(window.location.search);
    const nodesParam = params.get('nodes');

    let mapCenter = MAP_CONFIG.initialCenter;
    let mapZoom = MAP_CONFIG.initialZoom;
    let routeCoords = null;
    let startPoint = null;
    let endPoint = null;

    if (nodesParam) {
        const nodeIds = nodesParam.split(',').map(id => id.trim());
        if (nodeIds.length === 2) {
            const [startNodeId, endNodeId] = nodeIds;
            
            const [fetchedStartPoint, fetchedEndPoint] = await Promise.all([
                fetchCoordsFromUrl(startNodeId),
                fetchCoordsFromUrl(endNodeId)
            ]);
            
            startPoint = fetchedStartPoint;
            endPoint = fetchedEndPoint;
        }
    }

    if (startPoint && endPoint) {
        mapCenter = startPoint;
        mapZoom = 17;
        routeCoords = await fetchRouteData(startPoint, endPoint);
    }
    
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://xmap.vn/lib/dark-vietnam.json',
        center: mapCenter,
        zoom: mapZoom
    });

    map.on('load', () => {
        if (routeCoords) {
            // Thêm source cho đường đi
            map.addSource('route', {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': routeCoords
                    }
                }
            });

            // Thêm layer để vẽ đường đi
            map.addLayer({
                'id': 'route-line',
                'type': 'line',
                'source': 'route',
                'layout': { 'line-join': 'round', 'line-cap': 'round' },
                'paint': {
                    'line-color': MAP_CONFIG.routeColor,
                    'line-width': MAP_CONFIG.routeWidth
                }
            });

            // ✨ THAY ĐỔI TẠI ĐÂY: Thêm source và layer cho chấm tròn điểm đầu
            const startPointFeature = {
                'type': 'FeatureCollection',
                'features': [{
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': startPoint
                    }
                }]
            };

            map.addSource('start-point', {
                'type': 'geojson',
                'data': startPointFeature
            });

            map.addLayer({
                'id': 'start-circle',
                'type': 'circle',
                'source': 'start-point',
                'paint': {
                    'circle-radius': 8, // Kích thước của chấm tròn
                    'circle-color': MAP_CONFIG.startPointCircleColor
                }
            });

            // Gắn marker vào điểm cuối
            new maplibregl.Marker({ color: MAP_CONFIG.endPointMarkerColor })
                .setLngLat(endPoint)
                .addTo(map);

            const bounds = new maplibregl.LngLatBounds();
            routeCoords.forEach(coord => bounds.extend(coord));
            map.fitBounds(bounds, { padding: 50 });
        }
    });
}

initMap();