// Cấu hình chung cho bản đồ và các thành phần
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
    route: {
        color: '#ed6498',
        width: 5
    },
    marker: {
        color: '#FF0000',
        startPointCircleColor: '#33D14D',
        endPointMarkerColor: '#FF0000'
    }
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
        console.warn('Không tìm thấy tuyến đường.');
        return null;
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu định tuyến:", error);
        return null;
    }
}

// Hàm khởi tạo ứng dụng và bản đồ
async function initializeApp() {
    const params = new URLSearchParams(window.location.search);
    const nodesParam = params.get('nodes');
    const markerParam = params.get("marker");

    let mapCenter = [CONFIG.map.initialLon, CONFIG.map.initialLat];
    let mapZoom = CONFIG.map.zoom;
    let routeCoords = null;
    let startPoint = null;
    let endPoint = null;

    // Ưu tiên xử lý tham số 'nodes' để vẽ tuyến đường
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
            
            if (startPoint && endPoint) {
                mapCenter = startPoint;
                mapZoom = 17;
                routeCoords = await fetchRouteData(startPoint, endPoint);
            }
        }
    } 
    // Nếu không có 'nodes', xử lý tham số 'marker'
    else if (markerParam) {
        const coords = markerParam.split(",").map(Number);
        if (coords.length === 2 && !coords.some(isNaN)) {
            mapCenter = [coords[1], coords[0]];
        }
    }

    // Khởi tạo bản đồ
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://xmap.vn/lib/dark-vietnam.json',
        center: mapCenter,
        zoom: mapZoom
    });

    map.on('load', () => {
        // Vẽ tuyến đường nếu có
        if (routeCoords) {
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

            map.addLayer({
                'id': 'route-line',
                'type': 'line',
                'source': 'route',
                'layout': { 'line-join': 'round', 'line-cap': 'round' },
                'paint': {
                    'line-color': CONFIG.route.color,
                    'line-width': CONFIG.route.width
                }
            });

            // Thêm chấm tròn cho điểm đầu
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
                    'circle-radius': 8,
                    'circle-color': CONFIG.marker.startPointCircleColor
                }
            });

            // Gắn marker cho điểm cuối
            new maplibregl.Marker({ color: CONFIG.marker.endPointMarkerColor })
                .setLngLat(endPoint)
                .addTo(map);

            const bounds = new maplibregl.LngLatBounds();
            routeCoords.forEach(coord => bounds.extend(coord));
            map.fitBounds(bounds, { padding: 50 });
        } 
        // Gắn marker đơn lẻ nếu chỉ có tham số 'marker'
        else if (markerParam) {
            const coords = markerParam.split(",").map(Number);
            if (coords.length === 2 && !coords.some(isNaN)) {
                new maplibregl.Marker({ color: CONFIG.marker.color })
                    .setLngLat([coords[1], coords[0]])
                    .addTo(map);
            }
        }
    });
}

// Bắt đầu ứng dụng
initializeApp();