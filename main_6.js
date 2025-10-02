// Cấu hình chung
const CONFIG = {
    map: {
        initialLat: 20.978009,
        initialLon: 105.8121463,
        zoom: 16
    },
    route: {
        color: '#ed6498',
        width: 5
    },
    marker: {
        singleColor: '#FF0000',
        startPointColor: '#33D14D',
        endPointColor: '#FF0000'
    }
};

// Hàm chính khởi tạo và xử lý bản đồ
async function initializeApp() {
    const params = new URLSearchParams(window.location.search);
    const nodesParam = params.get('nodes');
    const markerParam = params.get('marker');

    let mapCenter = [CONFIG.map.initialLon, CONFIG.map.initialLat];
    let mapZoom = CONFIG.map.zoom;

    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://xmap.vn/lib/dark-vietnam.json',
        center: mapCenter,
        zoom: mapZoom
    });

    map.on('load', async () => {
        if (nodesParam) {
            // Trường hợp có tham số 'nodes': Vẽ tuyến đường
            const nodeIds = nodesParam.split(',').map(id => id.trim());
            if (nodeIds.length >= 2) {
                const startNodeId = nodeIds[0];
                const endNodeId = nodeIds[nodeIds.length - 1];

                // Lấy tọa độ
                const [startResponse, endResponse] = await Promise.all([
                    fetch(`https://api.xmap.vn/node/${startNodeId}.json`),
                    fetch(`https://api.xmap.vn/node/${endNodeId}.json`)
                ]);

                if (startResponse.ok && endResponse.ok) {
                    const startData = await startResponse.json();
                    const endData = await endResponse.json();

                    const startPoint = startData.elements[0] ? [startData.elements[0].lon, startData.elements[0].lat] : null;
                    const endPoint = endData.elements[0] ? [endData.elements[0].lon, endData.elements[0].lat] : null;

                    if (startPoint && endPoint) {
                        // Lấy dữ liệu tuyến đường từ OSRM
                        const routeUrl = `https://router.project-osrm.org/route/v1/driving/${startPoint[0]},${startPoint[1]};${endPoint[0]},${endPoint[1]}?overview=full&geometries=geojson`;
                        const routeResponse = await fetch(routeUrl);

                        if (routeResponse.ok) {
                            const routeData = await routeResponse.json();
                            const routeCoords = routeData.routes[0]?.geometry.coordinates;

                            if (routeCoords) {
                                // Thêm source và layer cho đường đi OSRM
                                map.addSource('route', { 'type': 'geojson', 'data': { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': routeCoords } } });
                                map.addLayer({ 'id': 'route-line', 'type': 'line', 'source': 'route', 'layout': { 'line-join': 'round', 'line-cap': 'round' }, 'paint': { 'line-color': CONFIG.route.color, 'line-width': CONFIG.route.width } });

                                // Thêm chấm tròn cho điểm đầu
                                map.addSource('start-point', { 'type': 'geojson', 'data': { 'type': 'Feature', 'geometry': { 'type': 'Point', 'coordinates': startPoint } } });
                                map.addLayer({ 'id': 'start-circle', 'type': 'circle', 'source': 'start-point', 'paint': { 'circle-radius': 8, 'circle-color': CONFIG.marker.startPointColor } });

                                // Gắn marker cho điểm cuối
                                new maplibregl.Marker({ color: CONFIG.marker.endPointColor }).setLngLat(endPoint).addTo(map);

                                // Điều chỉnh bản đồ
                                const bounds = new maplibregl.LngLatBounds();
                                routeCoords.forEach(coord => bounds.extend(coord));
                                map.fitBounds(bounds, { padding: 50 });
                            }
                        }
                    }
                }
            }
        } else if (markerParam) {
            // Trường hợp có tham số 'marker': Hiển thị một marker đơn lẻ
            const coords = markerParam.split(',').map(Number);
            if (coords.length === 2 && !coords.some(isNaN)) {
                new maplibregl.Marker({ color: CONFIG.marker.singleColor }).setLngLat([coords[1], coords[0]]).addTo(map);
                map.setCenter([coords[1], coords[0]]);
                map.setZoom(17);
            }
        }
    });
}

// Bắt đầu ứng dụng
initializeApp();