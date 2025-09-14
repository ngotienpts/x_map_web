let gpsTestInterval = null;

const GPS_CONFIG = {
    intervalMs: 1000,        // Mỗi 1000ms = 1 giây
    interpolateSteps: 1,     // Số bước nội suy giữa 2 waypoint
    
    // 🚗 CẤU HÌNH TỐC ĐỘ CỐ ĐỊNH
    constantSpeed: 50,       // km/h - TỐC ĐỘ CỐ ĐỊNH
    speedVariation: false,   // false = tốc độ cố định, true = có biến thiên
    variationPercent: 10,    // ±10% nếu bật speedVariation
    
    // 📍 Độ chính xác GPS
    gpsAccuracy: 8           // meters - độ chính xác GPS
};

let gpsStep = 0;
let gpsWaypoints = []; // Array chứa các điểm dọc đường thật
let gpsRoute = null;

const gpsStart = { lat: 20.9742737, lon: 105.8126312 };
const gpsEnd = { lat: 20.999015, lon: 105.787645 };

// GPS Simulator Functions
async function startGPSTest() {
    if (gpsTestInterval) {
        console.log('GPS test đã chạy rồi');
        return;
    }
    gpsTracker.stop();
    console.log('🚀 Đang lấy route thật từ API...');
    
    // Lấy route thật từ API
    const routeSuccess = await getRealRoute();
    if (!routeSuccess) {
        console.error('❌ Không lấy được route, dừng test');
        return;
    }
    
    gpsStep = 0;
    console.log(`🛣️ Bắt đầu GPS test với ${gpsWaypoints.length} waypoints`);
    
    // Initialize map bearing for first waypoint
    if (gpsWaypoints.length > 1) {
        currentMapBearing = calculateBearingFromWaypoints(gpsWaypoints[0], gpsWaypoints[1]);
    }
    
    // Gọi ngay
    sendRealGPS();
    
    // Mỗi [intervalMs] gọi 1 lần
    gpsTestInterval = setInterval(sendRealGPS, GPS_CONFIG.intervalMs);
}

async function getRealRoute() {
    try {
        // Gọi API routing của OpenStreetMap/OSRM
        const url = `https://api.xmap.vn/route/${gpsStart.lon},${gpsStart.lat}/${gpsEnd.lon},${gpsEnd.lat}.json`;
        
        console.log('🌐 Gọi API:', url);
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            gpsRoute = data.routes[0];
            
            // Lấy tất cả coordinates từ route geometry
            const coordinates = gpsRoute.geometry.coordinates;
            
            // Chuyển đổi từ [lon, lat] sang {lat, lon}
            let waypoints = coordinates.map(coord => ({
                lat: coord[1],
                lon: coord[0]
            }));
            
            // ⚡ TĂNG SỐ WAYPOINTS bằng interpolation
            if (GPS_CONFIG.interpolateSteps > 1) {
                waypoints = interpolateWaypoints(waypoints, GPS_CONFIG.interpolateSteps);
                console.log(`🔢 Đã tăng từ ${coordinates.length} lên ${waypoints.length} waypoints (x${GPS_CONFIG.interpolateSteps})`);
            }
            
            gpsWaypoints = waypoints;
            
            console.log(`✅ Lấy được route: ${(gpsRoute.distance/1000).toFixed(1)}km, ${gpsWaypoints.length} waypoints`);
            
            return true;
            
        } else {
            console.error('❌ API trả về lỗi:', data);
            return createFallbackRoute();
        }
        
    } catch (error) {
        console.error('❌ Lỗi gọi API:', error);
        return createFallbackRoute();
    }
}

// 🔢 Hàm tăng số waypoints bằng nội suy
function interpolateWaypoints(originalWaypoints, steps) {
    if (steps <= 1) return originalWaypoints;
    
    const newWaypoints = [];
    
    for (let i = 0; i < originalWaypoints.length - 1; i++) {
        const current = originalWaypoints[i];
        const next = originalWaypoints[i + 1];
        
        // Thêm waypoint hiện tại
        newWaypoints.push(current);
        
        // Thêm các waypoint nội suy
        for (let j = 1; j < steps; j++) {
            const progress = j / steps;
            const interpolated = {
                lat: current.lat + (next.lat - current.lat) * progress,
                lon: current.lon + (next.lon - current.lon) * progress
            };
            newWaypoints.push(interpolated);
        }
    }
    
    // Thêm waypoint cuối cùng
    newWaypoints.push(originalWaypoints[originalWaypoints.length - 1]);
    
    return newWaypoints;
}

function createFallbackRoute() {
    console.log('🔄 Tạo route fallback với nhiều điểm...');
    
    // Tạo route với nhiều điểm trung gian (không phải đường thẳng)
    gpsWaypoints = [];
    const steps = 50;
    
    for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        
        // Thêm một chút curve để không đi thẳng
        const curve = Math.sin(progress * Math.PI) * 0.002; // 0.002 độ curve
        
        const lat = gpsStart.lat + (gpsEnd.lat - gpsStart.lat) * progress + curve;
        const lon = gpsStart.lon + (gpsEnd.lon - gpsStart.lon) * progress;
        
        gpsWaypoints.push({ lat, lon });
    }
    
    console.log(`🔄 Tạo fallback route với ${gpsWaypoints.length} waypoints`);
    return true;
}

function stopGPSTest() {
    if (gpsTestInterval) {
        clearInterval(gpsTestInterval);
        gpsTestInterval = null;
        console.log('❌ Dừng GPS test');
    }
}

function sendRealGPS() {
    if (gpsStep >= gpsWaypoints.length) {
        console.log('🎯 Hoàn thành GPS test - đã đến đích!');
        stopGPSTest();
        return;
    }
    
    // Lấy waypoint hiện tại (vị trí thật trên đường)
    const currentWaypoint = gpsWaypoints[gpsStep];
    
    // Tính heading đến waypoint tiếp theo
    let heading = 0;
    if (gpsStep < gpsWaypoints.length - 1) {
        const nextWaypoint = gpsWaypoints[gpsStep + 1];
        heading = calculateBearingFromWaypoints(currentWaypoint, nextWaypoint);
    }
    
    // 🚗 Tính tốc độ - CỐ ĐỊNH hoặc CÓ BIẾN THIÊN
    let speed;
    if (GPS_CONFIG.speedVariation) {
        // Có biến thiên ±variationPercent%
        const variation = (Math.random() - 0.5) * 2 * (GPS_CONFIG.variationPercent / 100);
        speed = GPS_CONFIG.constantSpeed * (1 + variation);
    } else {
        // Tốc độ hoàn toàn cố định
        speed = GPS_CONFIG.constantSpeed;
    }
    
    // Chuyển đổi km/h sang m/s
    const speedMs = speed / 3.6;
    
    // 📍 Độ chính xác GPS - ổn định hoặc biến thiên nhẹ
    const accuracy = GPS_CONFIG.speedVariation ? 
        GPS_CONFIG.gpsAccuracy + (Math.random() - 0.5) * 4 :  // ±2m variation
        GPS_CONFIG.gpsAccuracy;  // cố định
    
    // Tạo GPS data ổn định
    const realGPS = {
        coords: {
            latitude: currentWaypoint.lat,
            longitude: currentWaypoint.lon,
            accuracy: Math.max(3, accuracy), // min 3m accuracy
            speed: speedMs,
            heading: heading,
            altitude: null,
            altitudeAccuracy: null
        },
        timestamp: Date.now()
    };
    
    // Gửi đến hệ thống GPS
    if (gpsTracker && gpsTracker.handlePosition) {
        gpsTracker.handlePosition(realGPS);
    }
    
    // Log chi tiết
    const percent = ((gpsStep + 1) / gpsWaypoints.length * 100).toFixed(1);
    //console.log(`🚗 Waypoint ${gpsStep + 1}/${gpsWaypoints.length} (${percent}%): ${speed.toFixed(1)}km/h | ${heading.toFixed(0)}°`);
    
    gpsStep++;
}

function calculateBearingFromWaypoints(from, to) {
    const dLat = to.lat - from.lat;
    const dLon = to.lon - from.lon;
    
    let bearing = Math.atan2(dLon, dLat) * 180 / Math.PI;
    bearing = (bearing + 360) % 360; // Normalize 0-360°
    
    return bearing;
}

function getGPSTestStatus() {
    const isRunning = gpsTestInterval !== null;
    const totalWaypoints = gpsWaypoints.length;
    const progress = totalWaypoints > 0 ? (gpsStep / totalWaypoints * 100).toFixed(1) : 0;
    
    return {
        isRunning: isRunning,
        step: gpsStep,
        totalWaypoints: totalWaypoints,
        progress: progress + '%',
        
        // 🚗 Thông tin tốc độ
        speed: GPS_CONFIG.speedVariation ? 
            `${GPS_CONFIG.constantSpeed}km/h ±${GPS_CONFIG.variationPercent}%` :
            `${GPS_CONFIG.constantSpeed}km/h (fixed)`,
        interval: GPS_CONFIG.intervalMs + 'ms',
        interpolation: 'x' + GPS_CONFIG.interpolateSteps,
        
        route: gpsRoute ? {
            distance: (gpsRoute.distance / 1000).toFixed(1) + ' km',
            duration: Math.round(gpsRoute.duration / 60) + ' min'
        } : 'No route'
    };
}




// Speed Control Functions
function setGPSSpeed(mode) {
    switch(mode) {
        case 'very_slow':
            GPS_CONFIG.intervalMs = 2000;      // 2 giây
            GPS_CONFIG.interpolateSteps = 5;   // x5 waypoints
            console.log('🐌 Đặt tốc độ: RẤT CHẬM (2s/step, x5 waypoints)');
            break;
        case 'slow':
            GPS_CONFIG.intervalMs = 1500;      // 1.5 giây
            GPS_CONFIG.interpolateSteps = 3;   // x3 waypoints
            console.log('🚶 Đặt tốc độ: CHẬM (1.5s/step, x3 waypoints)');
            break;
        case 'normal':
            GPS_CONFIG.intervalMs = 1000;      // 1 giây
            GPS_CONFIG.interpolateSteps = 1;   // waypoints gốc
            console.log('🚗 Đặt tốc độ: BÌNH THƯỜNG (1s/step, waypoints gốc)');
            break;
        case 'fast':
            GPS_CONFIG.intervalMs = 500;       // 0.5 giây
            GPS_CONFIG.interpolateSteps = 1;   // waypoints gốc
            console.log('🏃 Đặt tốc độ: NHANH (0.5s/step)');
            break;
        case 'very_fast':
            GPS_CONFIG.intervalMs = 200;       // 0.2 giây
            GPS_CONFIG.interpolateSteps = 1;   // waypoints gốc
            console.log('🚀 Đặt tốc độ: RẤT NHANH (0.2s/step)');
            break;
        default:
            console.log('❌ Mode không hợp lệ. Dùng: very_slow, slow, normal, fast, very_fast');
            return;
    }
    
}

function setGPSSpeedConstant(speedKmh, enableVariation = false, variationPercent = 10) {
    GPS_CONFIG.constantSpeed = speedKmh;
    GPS_CONFIG.speedVariation = enableVariation;
    GPS_CONFIG.variationPercent = variationPercent;
    
    if (enableVariation) {
        console.log(`🚗 Đặt tốc độ: ${speedKmh}km/h ±${variationPercent}%`);
    } else {
        console.log(`🚗 Đặt tốc độ CỐ ĐỊNH: ${speedKmh}km/h (constant)`);
    }
    
}