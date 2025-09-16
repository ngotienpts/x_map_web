const State = {
    user: {
        lat: 0,
        lon: 0,
        bearing: 0,
        speed: 0
    },
    system: {
        watchId: null,
        isInitialized: false
    }
};

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
    }
};

let map;
let currentBearing = 0;
let autoCenter = true;
let lastNavigationLat = 0;
let lastNavigationLon = 0;
let currentMapBearing = 0;
let lastPos = null;

// ===== GPS TRACKER =====
class GPSTracker {
    constructor() {
        this.autoCenterTimeout = true;
        this.userMarker = null;

        this.carIcon = document.createElement('div');
        this.carIcon.innerHTML = `<svg width="45" height="43" viewBox="0 0 67 67" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="33.5" cy="33.5" r="33.5" fill="#2D6AE9" fill-opacity="0.3"/>
        <path d="M33.5 39.5714L11 49L33.5 7L56 49L33.5 39.5714Z" fill="white"/>
        </svg>`;
        this.carIcon.id = 'car-icon';
    }

    initialize() {
        map = new maplibregl.Map({
          container:'map',
          style:{
            version:8,
            glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
            sources: {
              vietnam: {
                type: "vector",
                tiles: [
                  "https://tiles.xmap.vn/vector/{z}/{x}/{y}.pbf"
                ],
                minzoom: 0,
                maxzoom: 14
              }
            },
            layers:[
              { id:"earth", type:"fill", source:"vietnam", "source-layer":"landcover", paint:{ "fill-color":"#1c1b23" } },
              { id:"landuse", type:"fill", source:"vietnam", "source-layer":"landuse", paint:{ "fill-color":"#2e2e36","fill-opacity":0.6 }},
              { id:"water", type:"fill", source:"vietnam", "source-layer":"water", paint:{ "fill-color":"#42587c","fill-opacity":0.7 }},
              { id:"buildings", type:"fill", source:"vietnam", "source-layer":"building", paint:{ "fill-color":"#5e6370","fill-opacity":0.8 }},

              // 🚧 Đường
              {
                id:"roads", type:"line", source:"vietnam", "source-layer":"transportation",
                paint:{
                  "line-color":[
                    "case",
                    ["==",["get","highway"],"motorway"],"#424247",
                    ["==",["get","highway"],"trunk"],"#424247",
                    ["==",["get","highway"],"primary"],"#424247",
                    ["==",["get","highway"],"secondary"],"#424247",
                    ["==",["get","highway"],"tertiary"],"#424247",
                    ["==",["get","highway"],"residential"],"#141B23",
                    ["==",["get","highway"],"service"],"#424247",
                    ["==",["get","footway"],"crossing"], "rgba(0,0,0,0)",
                    ["==",["get","footway"],"sidewalk"], "#999999",
                    ["==",["get","highway"],"pedestrian"],"#999999",
                    "#d2b48c"
                  ],
                  "line-width":[
                    "interpolate",["linear"],["zoom"],
                    12,["case",
                      ["==",["get","highway"],"motorway"],2.5,
                      ["==",["get","highway"],"trunk"],2.2,
                      ["==",["get","highway"],"primary"],2,
                      ["==",["get","highway"],"secondary"],1.8,
                      ["==",["get","highway"],"residential"],1.2,1
                    ],
                    15,["case",
                      ["==",["get","highway"],"motorway"],7,
                      ["==",["get","highway"],"trunk"],6,
                      ["==",["get","highway"],"primary"],5,
                      ["==",["get","highway"],"secondary"],4.5,
                      ["==",["get","highway"],"residential"],3,2
                    ],
                    18,["case",
                      ["==",["get","highway"],"motorway"],14,
                      ["==",["get","highway"],"trunk"],12,
                      ["==",["get","highway"],"primary"],10,
                      ["==",["get","highway"],"secondary"],9,
                      ["==",["get","highway"],"residential"],6,
                      ["==",["get","highway"],"pedestrian"],2,
                      ["==",["get","footway"],"sidewalk"],1.5,
                      3.5
                    ]
                  ]
                }
              },



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
                    "interpolate",
                    ["linear"],
                    ["zoom"],
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
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    15, 0.6,
                    17, 0.8,
                    18, 1
                ]
            }
        },

        {
            id: "landuse-grass",
            type: "fill",
            source: "vietnam", // đúng với source bạn đang dùng
            "source-layer": "landuse", // đúng với layer trong ảnh
            filter: ["==", ["get", "class"], "grass"],
            paint: {
                "fill-color": "#0C4321",  // Màu xanh cỏ, bạn có thể đổi tùy ý
                "fill-opacity": 0.6       // Độ trong suốt tùy chỉnh
            }
        },


            ]
          },
          center:[CONFIG.map.initialLon,CONFIG.map.initialLat], zoom:CONFIG.map.zoom, pitch:0, bearing:State.user.bearing});

        // Bắt đầu kéo
        map.on('dragstart', this.handleUserInteraction);
        map.on('drag', this.handleUserInteraction);
        //map.on('zoomstart', this.handleUserInteraction);


        this.userMarker = new maplibregl.Marker({ element: this.carIcon }).setLngLat([State.user.lon, State.user.lat]).addTo(map);
    }

    handleUserInteraction() {
        autoCenter = false;
        document.body.classList.add('dragging');

        // Huỷ timeout cũ (nếu có) để tránh bật sớm khi người dùng vẫn tương tác
        if (this.autoCenterTimeout) clearTimeout(this.autoCenterTimeout);

        // Đếm lại 5 000 ms → bật lại autoCenter
        this.autoCenterTimeout = setTimeout(() => {
            autoCenter = true;
            document.body.classList.remove('dragging');
        }, 5000);
    }
    
    start() {
        if (!navigator.geolocation) {
            console.error('Geolocation not supported');
            return false;
        }
        
        /*State.system.watchId = navigator.geolocation.watchPosition(
            pos => this.handlePosition(pos),
            err => console.error('GPS watch error:', err.message),
            CONFIG.gps
        );*/
        return true;
    }

    stop() {
        if (State.system.watchId) {
            navigator.geolocation.clearWatch(State.system.watchId);
            State.system.watchId = null;
        }
    }

    handlePosition(position) {
        let lat = position.coords.latitude;
        let lng = position.coords.longitude;

        if(navigationManager.isActive) {
            const snapPoint = navigationManager.snapRoute(lat, lng);
            lat = snapPoint.lat;
            lng = snapPoint.lon;
        }
        const newPos = { lat, lng };
        State.user.lat = lat;
        State.user.lon = lng;

        if (lastPos) {
            if(autoCenter == false) {
                this.userMarker.setLngLat([State.user.lon, State.user.lat]);
            }
            else {
                //this.userMarker.setLngLat([lng, lat]); // new
                this.animateTo(lastPos, newPos, 1000);
            }
        } else {
            /*
            this.userMarker.setLngLat([lng, lat]);
            const center = utils.calculateOffsetCenter(lat, lng, 0, -80);
            currentMapBearing = 0; // Initialize bearing
            map.jumpTo({ center: center, zoom: 18, pitch: 60, bearing: 0 });
            */
            this.userMarker.setLngLat([lng, lat]);

            // Lấy pixel từ lat/lng
            const userPixel = map.project([lng, lat]);

            // Dịch lên 20% chiều cao canvas
            const offsetY = map.getCanvas().height * 0.2;
            userPixel.y -= offsetY; // dịch lên trên

            // Unproject lại ra LatLng để lấy tâm mới
            const newCenter = map.unproject(userPixel);

            currentMapBearing = 0;
            map.jumpTo({
                center: newCenter,
                zoom: 17,
                pitch: 0,
                bearing: 0
            });
        }

        
        lastPos = newPos;

        if (position.coords.speed !== null && position.coords.speed !== undefined) {
            State.user.speed = position.coords.speed > 0 ? Math.round(position.coords.speed * 3.6) : 0;
            document.getElementById('speed-value').textContent = State.user.speed;
        }

        utils.findNearestNodeAndWay(lat, lng, 100);

        if(navigationManager.isActive) {
            navigationManager.drawRoute();
            navigationManager.updateNavigationPanel();
        }

    }

    animateTo(from, to, duration = 1000) {
        const start = performance.now();

        if(State.user.speed > 10)  currentBearing = utils.calculateBearing(from.lat, from.lng, to.lat, to.lng);
        
        // Calculate shortest rotation path (handle 360° wrap-around)
        let bearingDiff = currentBearing - currentMapBearing;
        if (bearingDiff > 180) bearingDiff -= 360;
        if (bearingDiff < -180) bearingDiff += 360;
        
        const startBearing = currentMapBearing;

        
        /*function step(timestamp) {
            const progress = Math.min((timestamp - start) / duration, 1);
            
            // Smooth easing function (ease-in-out)
            const easeProgress = progress < 0.5 ? 
                2 * progress * progress : 
                1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            const lat = from.lat + (to.lat - from.lat) * easeProgress;
            const lng = from.lng + (to.lng - from.lng) * easeProgress;
            
            // Smooth bearing interpolation
            const currentBearing = startBearing + bearingDiff * easeProgress;
            currentMapBearing = (currentBearing + 360) % 360;

            gpsTracker.userMarker.setLngLat([lng, lat]);
            gpsTracker.carIcon.style.transform = `translate(-50%, -100%) rotate(${currentMapBearing}deg)`;

            const camCenter = utils.calculateOffsetCenter(lat, lng, currentMapBearing, -80);
        
            // Use easeTo with longer duration for smoother map rotation
            map.easeTo({
                center: camCenter,
                bearing: currentMapBearing,
                pitch: 60,//
                duration: 100 // Smooth map animation
            });

            if (progress < 1) requestAnimationFrame(step);
        }*/
        function step(timestamp) {
            const progress = Math.min((timestamp - start) / duration, 1);
            
            const easeProgress = progress < 0.5 ? 
                2 * progress * progress : 
                1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            const lat = from.lat + (to.lat - from.lat) * easeProgress;
            const lng = from.lng + (to.lng - from.lng) * easeProgress;

            const currentBearing = startBearing + bearingDiff * easeProgress;
            currentMapBearing = (currentBearing + 360) % 360;

            gpsTracker.userMarker.setLngLat([lng, lat]);
            gpsTracker.carIcon.style.transform = `translate(-50%, -100%) rotate(${currentMapBearing}deg)`;

            // Convert user position to pixel, apply vertical offset, and unproject to get new center
            const userPixel = map.project([lng, lat]);
            const offsetY = map.getCanvas().height * 0.2;
            userPixel.y -= offsetY;
            const camCenter = map.unproject(userPixel);

            map.easeTo({
                center: camCenter,
                bearing: currentMapBearing,
                pitch: 60,
                duration: 100
            });

            if (progress < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }
}

// ===== ENHANCED NAVIGATION MANAGER =====
class NavigationManager {
    constructor() {
        this.isActive = false;
        this.route = null;
        this.coordinates = null;
        this.steps = null;
        this.passedIndex = 0;
        this.currentStep = 0;
        this.distanceStep = -1;
        this.navDistanceEl = document.getElementById('nav-distance');
        this.streetEl = document.getElementById('nav-street');
        this.iconEl = document.getElementById('nav-icon');
        this.distanceEl = document.getElementById('route-distance');
        this.durationEl = document.getElementById('route-duration');
        this.timeEl = document.getElementById('route-time');
        this.isAudioPlayed = false;
        this.totalDuration = 0;
        this.totalDistance = 0;
    }
    initHandlers() {
        document.addEventListener('click', function(event) {
            if (event.target.classList.contains('btn_router')) {
                const button = event.target;
                const lat = parseFloat(button.getAttribute('data-lat'));
                const lon = parseFloat(button.getAttribute('data-lon'));
                
                navigationManager.startNavigation(lat, lon);
            }
        });
        
        const exitButton = document.getElementById('exit-button');
        if (exitButton) {
            exitButton.addEventListener('click', (e) => {
                e.stopPropagation();
                navigationManager.stopNavigation();
            });
        }
    }
    
    async startNavigation(lat, lon) {
        if (!State.user.lat || !State.user.lon) {
            alert('Không thể xác định vị trí của bạn');
            return false;
        }
        lastNavigationLat = lat;
        lastNavigationLon = lon;

        // test
        /*gpsTracker.stop();
        const realGPS = {
            coords: {
                latitude: 20.974380,
                longitude: 105.812516,
                accuracy: Math.max(3, 0),
                speed: 0,
                heading: 0,
                altitude: null,
                altitudeAccuracy: null
            },
            timestamp: Date.now()
        };
        gpsTracker.handlePosition(realGPS);*/
        // end test

        
        const route = await this.getRoute(
            State.user.lat, State.user.lon,
            lat, lon
        );
        
        if (!route) return false;
        
        this.isActive = true;
        this.route = route;
        this.coordinates = route.geometry.coordinates;
        this.steps = route.steps;
        this.currentStep = 0;
        this.distanceStep = -1;
        this.passedIndex = 0;
        this.totalDistance = route.distance;
        this.totalDuration = route.duration;
        this.remainingDistance(0, 0);
        this.remainingDuration(0, 0);

        //console.log(route)
        
        if (route.legs && route.legs[0] && route.legs[0].steps) {
            this.steps = route.legs[0].steps;
            this.currentStep = 0;
        }
        
        this.showNavigationUI();


        if (map.getSource('route')) {
            map.removeLayer('route');
            map.removeSource('route');
        }
        if (map.getSource('route-full')) {
            map.removeLayer('route-full');
            map.removeSource('route-full');
        }

        map.addSource('route-full', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: []
                }
            }
        });
        map.addSource('route', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: []
                }
            }
        });

        map.addLayer({
            id: 'route-full',
            type: 'line',
            source: 'route-full',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#4A90E2',
                'line-width': 8
            }
        });
        map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#4A90E2',
                'line-width': 8
            }
        });
        this.drawRouteFull();
        this.drawRoute();
        
        console.log('✅ Navigation started with line-based tracking');
        return true;
    }
    drawRouteFull() {
        if (!this.route) {
            alert('Chưa xác định được đường');
            return false;
        }
        const coordinates = this.route.geometry.coordinates;
        const totalPoints = coordinates.length;

        const segment = coordinates.slice((navigationManager.passedIndex+1), totalPoints);
        map.getSource('route-full').setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: segment
            }
        });
    }
    drawRoute() {
        if (!this.route) {
            alert('Chưa xác định được đường');
            return false;
        }
        const coordinates = this.route.geometry.coordinates;
        

        
        const totalPoints = coordinates.length;
        const nextPoint = coordinates[navigationManager.passedIndex+1];

        const segment = [[State.user.lon, State.user.lat], nextPoint];
        map.getSource('route').setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: segment
            }
        });

    }
    snapRoute(lat, lon) {
        if(!this.route) return {lat: lat, lon: lon};
        const coordinates = this.coordinates;
        const passedIndex = Math.max(0, this.passedIndex || 0);

        if(!coordinates[passedIndex] || !coordinates[passedIndex+1] || !coordinates[passedIndex+2]) return {lat: lat, lon: lon};

        const { point: point, distance: distance } = utils.findNearestPointOnLine([lon, lat], [coordinates[passedIndex], coordinates[passedIndex+1]]);
        const { point: point_2, distance: distance_2 } = utils.findNearestPointOnLine([lon, lat], [coordinates[passedIndex+1], coordinates[passedIndex+2]]);

        if(distance_2 < distance) {
            this.passedIndex++;
            this.drawRouteFull();
            return {lat: point_2[1], lon: point_2[0]};
        }
        const max_distance = Math.max(30, State.user.speed);
        if(distance<max_distance) {
            return {lat: point[1], lon: point[0]};
        }
        else {
            this.reRoute();
            return {lat: lat, lon: lon};
        }
    }
    reRoute() {
        this.startNavigation(lastNavigationLat, lastNavigationLon);
    }
    updateNavigationPanel() {
        const navPanel = document.getElementById('navigation-panel');
        if (!navPanel) return;

        const stepInfo = this.steps[this.currentStep]; if (!stepInfo) return;
        const location = stepInfo.intersections[0].location;
        const distance = utils.calculateDistance({lat: State.user.lat, lon: State.user.lon}, {lat: location[1], lon: location[0]});
        const max_distance = Math.max(10, State.user.speed); // ít nhất là 10m
        //console.log('distance', distance);
        //console.log('max_distance', max_distance);

        if(this.distanceStep == -1) {
            this.distanceStep = distance;
            this.streetEl.textContent = stepInfo.name || 'Tiếp tục';
            const nextIcon = this.getNavigationIcon(
                stepInfo.maneuver.type, 
                stepInfo.maneuver.modifier
            );
            this.iconEl.innerHTML = nextIcon;
            // VOICE
            const maneuverType = stepInfo.maneuver.type || '';
            const maneuverModifier = stepInfo.maneuver.modifier || '';
            const stepName = stepInfo.name || '';
            const voiceText = this.createVoiceText(maneuverType, maneuverModifier, stepName);
            this.isAudioPlayed = 0;
            this.loadVoice(voiceText);
        }
        else if(distance<max_distance) {
            this.currentStep++;
            this.distanceStep = -1;
            this.remainingDistance(stepInfo.distance, distance);
            this.remainingDuration(stepInfo.duration, 0);
        }
        else if(distance < this.distanceStep) {
            this.distanceStep = distance;
        }
        else if(distance > this.distanceStep + max_distance) {
            this.currentStep++;
            this.distanceStep = -1;
            this.remainingDistance(stepInfo.distance, distance);
            this.remainingDuration(stepInfo.duration, 0);
        }

        if(distance < max_distance * 5) {
            this.playVoice();
        }

        this.navDistanceEl.textContent = this.formatNavigationDistance(distance);
    }
    remainingDistance(passed, current) {
        this.totalDistance -= passed;
        const distance = (this.totalDistance + current);
        this.distanceEl.textContent = (distance / 1000).toFixed(1);
        //
        if (distance < 5) {
            uiManager.setNoti('Kết thúc dẫn đường');
            setTimeout(() => {
                this.stopNavigation();
                uiManager.setNoti('');
            }, 3000);
        }
    }
    remainingDuration(passed, current) {
        this.totalDuration -= passed;
        const durationMin = Math.round((this.totalDuration + current) / 60) * 2; // x2 so với OSM
        this.durationEl.textContent = durationMin;

        // Tính ETA
        const now = new Date();
        now.setMinutes(now.getMinutes() + durationMin);
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        this.timeEl.textContent = timeStr;
    }
    formatNavigationDistance(meters) {
        if (meters < 10) {
            return 'Ngay';
        } else if (meters < 1000) {
            return `${Math.round(meters)} m`;
        } else {
            return `${(meters / 1000).toFixed(1)} km`;
        }
    }
    createVoiceText(maneuverType, maneuverModifier, stepName) {
        let voiceText = '';
        if(stepName=='tiếp tục') stepName = '';
        
        // Xử lý các loại maneuver
        switch (maneuverType) {
            case 'turn':
                if(stepName) stepName = 'vào '+stepName;
                if (maneuverModifier === 'left') {
                    voiceText = `Rẽ trái ${stepName}`;
                } else if (maneuverModifier === 'right') {
                    voiceText = `Rẽ phải ${stepName}`;
                } else {
                    voiceText = `Rẽ ${stepName}`;
                }
                break;
                
            case 'new name':
            case 'continue':
                voiceText = `Đi thẳng`;
                break;
                
            case 'merge':
                voiceText = `Nhập làn vào ${stepName}`;
                break;
                
            case 'on ramp':
                voiceText = `Đi lên đường cao tốc ${stepName}`;
                break;
                
            case 'off ramp':
                if(stepName) stepName = 'tại '+stepName;
                voiceText = `Xuống khỏi cao tốc ${stepName}`;
                break;
                
            case 'roundabout':
                voiceText = `Vào vòng xuyến, lối ra thứ ${maneuverModifier || ''}`;
                break;
                
            case 'rotary':
                voiceText = `Vào vòng xuyến lớn`;
                break;
                
            case 'fork':
                if(stepName) stepName = 'tại '+stepName;
                if (maneuverModifier === 'left') {
                    voiceText = `Giữ bên trái ${stepName}`;
                } else if (maneuverModifier === 'right') {

                    voiceText = `Giữ bên phải ${stepName}`;
                } else {
                    voiceText = `Chọn làn ${stepName}`;
                }
                break;
                
            case 'end of road':
                if (maneuverModifier === 'left') {
                    voiceText = `Cuối đường, rẽ trái vào ${stepName}`;
                } else if (maneuverModifier === 'right') {
                    voiceText = `Cuối đường, rẽ phải vào ${stepName}`;
                } else {
                    voiceText = `Cuối đường, tiếp tục vào ${stepName}`;
                }
                break;
                
            case 'use lane':
                voiceText = `Sử dụng làn đường để đến ${stepName}`;
                break;
                
            case 'arrive':
                voiceText = `Đã đến ${stepName}`;
                break;
                
            case 'depart':
                if(stepName) stepName = 'từ '+stepName;
                voiceText = `Khởi hành ${stepName}`;
                break;
                
            default:
                voiceText = `Tiếp tục đến ${stepName}`;
                break;
        }
        
        return voiceText;
    }
    async loadVoice(text) {
        const success = await voiceAudio.loadAudio(text);
        if (success) {
            console.log(`🎤 Loaded navigation audio: "${text}"`);
        } else {
            console.warn('🎤 Failed to load navigation audio');
        }
        return success;
    }
    async playVoice() {
        if(this.isAudioPlayed) return;
        const success = await voiceAudio.play();
        if (success) {
            this.isAudioPlayed = 1;
            console.log('🎤 Playing navigation audio');
        }
    }
    showNavigationUI() {
        document.body.classList.add('navigating');
    }
    hideNavigationUI() {
        document.body.classList.remove('navigating');
    }

    stopNavigation() {
        this.isActive = false;
        this.coordinates = null;
        this.steps = null;
        lastNavigationLat = 0;
        lastNavigationLon = 0;

        if (map.getSource('route')) {
            map.removeLayer('route');
            map.removeSource('route');
        }
        if (map.getSource('route-full')) {
            map.removeLayer('route-full');
            map.removeSource('route-full');
        }
        this.hideNavigationUI();
        
        console.log('❌ Navigation stopped');
    }
    
    async getRoute(startLat, startLon, endLat, endLon) {
        try {
            uiManager.setNoti('Đang tìm đường');
            
            const response = await fetch(
                `https://api.xmap.vn/route/${startLon},${startLat}/${endLon},${endLat}.json`
            );
            
            const data = await response.json();
            uiManager.setNoti('');
            
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                return data.routes[0];
            } else {
                alert('Không thể tìm đường đi');
                return null;
            }
        } catch (error) {
            uiManager.setNoti('');
            console.error('Route error:', error);
            alert('Lỗi kết nối');
            return null;
        }
    }
    

    getNavigationIcon(type, modifier='') {
        if(type == 'new name' || type == 'continue') {type = 'turn'; modifier = 'straight';}
        if(type == 'roundabout turn' || type == 'roundabout') {type = 'roundabout'; modifier = '';}
        if(type == 'exit roundabout' || type == 'exit rotary') type = 'turn';
        if(type == 'depart' || type == 'arrive') modifier = '';
        let filename = type.toString();
        if(modifier) filename = filename.toString() + '-' + modifier.toString();
        filename = filename.replace(/ /g, '-');
        filename = filename.replace(/_/g, '-');
        filename = filename.replace(/-to-/g, '-');
        return '<img src="https://xmap.vn/templates/themes/icons/navigation/'+filename+'.svg" alt="'+filename+'" height="100%" width="auto">';
    }
    parseTurnLanes(turnLanesData) {
        const lanes = [];
        const laneStrings = turnLanesData.split('|');
        
        laneStrings.forEach(laneString => {
            if (laneString.trim() === '') {
                // Empty lane - no directions
                lanes.push([]);
            } else {
                // Split by ; for multiple directions in same lane
                const directions = laneString.replace(/;/g, '-');
                lanes.push(directions);
            }
        });
        
        return lanes;
    }
}

// ===== SEARCH FUNCTIONALITY =====
class SearchManager {
    constructor() {
        this.currentSearchQuery = '';
        this.searchTimeout = null;
        this.debounceTimeout = null;
        this.abortController = null;
    }
    async searchLocation(query) {
        if (!query || query.trim().length < 2) {
            clearTimeout(this.debounceTimeout);
            if (this.abortController) this.abortController.abort();
            this.hideSearchResults();
            return;
        }

        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(async () => {
            if (this.abortController) this.abortController.abort();
            this.abortController = new AbortController();
            const signal = this.abortController.signal;

            this.showSearchLoading();

            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&countrycodes=vn&addressdetails=1`,
                    { signal }
                );

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const results = await response.json();
                this.displaySearchResults(results);
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }
                console.error('Search error:', error);
                this.showSearchError();
            }
        }, 300);
    }
    showSearchLoading() {
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = '<div class="loading">Đang tìm kiếm...</div>';
    }

    showSearchError() {
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = '<div class="no-results">Có lỗi xảy ra khi tìm kiếm. Vui lòng thử lại.</div>';
    }

    hideSearchResults() {
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
    }

    displaySearchResults(results) {
        const resultsContainer = document.getElementById('search-results');
        
        if (!results || results.length === 0) {
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = '<div class="no-results">Không tìm thấy kết quả nào.</div>';
            return;
        }

        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = '';

        results.forEach(result => {
            const resultItem = document.createElement('button');
            resultItem.className = 'search-result-item btn_router';
            
            const name = result.display_name.split(',')[0];
            const address = result.display_name;
            const lat = result.lat;
            const lon = result.lon;
            
            const parts = address.split(',').map(p => p.trim());
            while (parts.length > 0 && /^[0-9]{4,6}$|^Vietnam$/i.test(parts[parts.length - 1])) {
                parts.pop();
            }
            const shortAddress = parts.slice(1).join(', ');
            
            resultItem.setAttribute('data-lat', lat);
            resultItem.setAttribute('data-lon', lon);
            
            resultItem.innerHTML = `
                <div class="result-name">${name}</div>
                <div class="result-address">${shortAddress}</div>
            `;
            
            resultsContainer.appendChild(resultItem);
        });
    }

    getSearchHistory() {
        return JSON.parse(localStorage.getItem('searchHistory') || '[]');
    }

    showSearchHistory() {
        const history = this.getSearchHistory();
        const searchResults = document.getElementById('search-results');
        
        if (!searchResults) return;
        
        searchResults.innerHTML = '';
        
        if (history.length === 0) {
            return;
        }
        
        searchResults.style.display = 'block';
        
        history.forEach(item => {
            const resultItem = document.createElement('button');
            resultItem.className = 'search-result-item btn_router';
            resultItem.setAttribute('data-lat', item.latitude);
            resultItem.setAttribute('data-lon', item.longitude);
            
            resultItem.innerHTML = `
                <div class="result-time">${this.formatTime(item.timestamp)}</div>
                <div class="result-name">${item.name}</div>
                <div class="result-address">${item.address}</div>
            `;
            
            searchResults.appendChild(resultItem);
        });
    }

    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (minutes < 60) {
            return `${minutes} phút trước`;
        } else if (hours < 24) {
            return `${hours} giờ trước`;
        } else {
            return `${days} ngày trước`;
        }
    }

    initSearchHandlers() {
        const searchForm = document.getElementById('search-form');
        const searchInput = document.getElementById('search-input');
        const searchBox = document.getElementById('search');
        const searchBtn = document.getElementById('search-button');
        
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                searchManager.searchLocation(query);
            }
        });
        
        searchInput.addEventListener('focus', function() {
            if (this.value.trim() === '') {
                searchManager.showSearchHistory();
                searchBtn.classList.add('clear-button');
            }
        });
        
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim();
            if (this.value.trim() === '') {
                searchManager.showSearchHistory();
                searchBtn.classList.remove('clear-button');
            } else {
                searchBtn.classList.add('clear-button');
                this.currentSearchQuery = query;
                
                if (this.searchTimeout) {
                    clearTimeout(this.searchTimeout);
                }
                
                if (query.length >= 2) {
                    this.searchTimeout = setTimeout(() => {
                        if (this.currentSearchQuery === query) {
                            searchManager.searchLocation(query);
                        }
                    }, 300);
                } else {
                    searchManager.hideSearchResults();
                }
            }
        });
        
        searchBtn.addEventListener('click', function(e) {
            document.getElementById('search-input').value = '';
            searchManager.hideSearchResults();
            if(searchBtn.classList.contains('clear-button')) {
                searchBtn.classList.remove('clear-button');
                searchBox.style.display = 'none';
            }
        });
        document.getElementById('btn-open-search').addEventListener('click', function(e) {
            searchBox.style.display = 'block';
            searchInput.focus();
        });
        
    }
}

// ===== UTILITIES =====
class Utils {
    calculateOffsetCenter(lat, lng, bearing, distanceMeters = 150) {
        const R = 6378137;
        const angle = (bearing + 180) % 360;
        const deltaLat = (distanceMeters * Math.cos(angle * Math.PI / 180)) / R;
        const deltaLng = (distanceMeters * Math.sin(angle * Math.PI / 180)) / (R * Math.cos(lat * Math.PI / 180));
        return [
            lng + deltaLng * (180 / Math.PI),
            lat + deltaLat * (180 / Math.PI)
        ];
    }
    calculateDistance(A, B) {
        const R = 6371000; // Earth radius in meters
        const toRad = x => x * Math.PI / 180;

        const dLat = toRad(B.lat - A.lat);
        const dLon = toRad(B.lon - A.lon);
        const a = Math.sin(dLat/2)**2 +
                  Math.cos(toRad(A.lat)) * Math.cos(toRad(B.lat)) * Math.sin(dLon/2)**2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    calculateBearing(lat1, lon1, lat2, lon2) {
        const toRad = deg => deg * Math.PI / 180;
        const toDeg = rad => rad * 180 / Math.PI;
        const dLon = toRad(lon2 - lon1);
        const y = Math.sin(dLon) * Math.cos(toRad(lat2));
        const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                  Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }
    findNearestNodeAndWay(lat, lng, radius = 50) {
        //console.log(`🔍 Finding nearest node/way to GPS position: ${lat}, ${lng}`);
        
        // Query all roads within radius around GPS position
        const point = map.project([lng, lat]);
        const sw = map.unproject([point.x - radius, point.y - radius]);
        const ne = map.unproject([point.x + radius, point.y + radius]);
        
        // Get all road features in the bounding box
        const roadFeatures = map.querySourceFeatures('vietnam', {
            sourceLayer: 'transportation',
            filter: [
                "any",
                ["==", ["get", "highway"], "motorway"],
                ["==", ["get", "highway"], "trunk"],
                ["==", ["get", "highway"], "primary"],
                ["==", ["get", "highway"], "secondary"],
                ["==", ["get", "highway"], "tertiary"],
                ["==", ["get", "highway"], "residential"],
                ["==", ["get", "highway"], "unclassified"]
            ]
        });
        
        //console.log(`📊 Found ${roadFeatures.length} road features in radius`);
        
        let nearestWay = null;
        let nearestNode = null;
        let minWayDistance = Infinity;
        let minNodeDistance = Infinity;
        
        roadFeatures.forEach((feature, index) => {
            if (feature.geometry && feature.geometry.type === 'LineString') {
                const coordinates = feature.geometry.coordinates;
                const props = feature.properties;
                
                // Find nearest point on this way (line)
                const { point: nearestPoint, distance: wayDistance } = this.findNearestPointOnLine(
                    [lng, lat], 
                    coordinates
                );
                
                if (wayDistance < minWayDistance) {
                    minWayDistance = wayDistance;
                    nearestWay = {
                        feature: feature,
                        properties: props,
                        nearestPoint: nearestPoint,
                        distance: wayDistance,
                        wayId: props.id || props.osm_id || `way_${index}`,
                        name: props.name || '',
                        kind: props.kind_detail || props.kind,
                        highway: props.highway,
                        coordinates: coordinates
                    };
                }
                
                // Check each node (coordinate) of this way
                coordinates.forEach((coord, nodeIndex) => {
                    const nodeDistance = this.calculateDistance(
                        { lat: lat, lon: lng },
                        { lat: coord[1], lon: coord[0] }
                    );
                    
                    if (nodeDistance < minNodeDistance) {
                        minNodeDistance = nodeDistance;
                        nearestNode = {
                            coordinates: coord,
                            distance: nodeDistance,
                            nodeId: `${props.id || props.osm_id || `way_${index}`}_node_${nodeIndex}`,
                            wayId: props.id || props.osm_id || `way_${index}`,
                            wayName: props.name || '',
                            nodeIndex: nodeIndex,
                            wayProperties: props
                        };
                    }
                });
            }
        });
        
        // Log results
        if (nearestWay) {
            document.getElementById('this-road').textContent = nearestWay.name;
            

            if(nearestWay.properties.maxspeed) {
                document.getElementById('speed-limit').textContent = nearestWay.properties.maxspeed;
            }
            else document.getElementById('speed-limit').textContent = '';

            const turnLanesPanel = document.getElementById('turn-lanes-panel');
            if(nearestWay.properties["turn:lanes"]) {
                const lanes = navigationManager.parseTurnLanes(nearestWay.properties["turn:lanes"]);
                
                // Clear existing content
                turnLanesPanel.innerHTML = '';
                
                // Create spans for each lane
                lanes.forEach((laneDirections, index) => {
                    const span = document.createElement('span');
                    
                    const svg = navigationManager.getNavigationIcon(laneDirections);
                    
                    if (svg) {
                        span.innerHTML = svg;
                        turnLanesPanel.appendChild(span);
                    }
                });
            }
            else turnLanesPanel.innerHTML = '';

        } else {
            console.log('❌ No way found within radius');
        }
        
        
        return {
            nearestWay,
            nearestNode,
            totalRoadsChecked: roadFeatures.length
        };
    }

    findNearestPointOnLine(point, lineCoordinates) {
        let minDistance = Infinity;
        let nearestPoint = null;
        
        for (let i = 0; i < lineCoordinates.length - 1; i++) {
            const segmentStart = lineCoordinates[i];
            const segmentEnd = lineCoordinates[i + 1];
            
            const projected = this.projectPointOnSegment(point, segmentStart, segmentEnd);
            const distance = this.calculateDistance(
                { lat: point[1], lon: point[0] },
                { lat: projected[1], lon: projected[0] }
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = projected;
            }
        }
        
        return { point: nearestPoint, distance: minDistance };
    }
    projectPointOnSegment(point, segmentStart, segmentEnd) {
        const [px, py] = point;
        const [x1, y1] = segmentStart;
        const [x2, y2] = segmentEnd;
        
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return segmentStart; // Degenerate segment
        
        let param = dot / lenSq;
        
        // Clamp to segment
        if (param < 0) return segmentStart;
        if (param > 1) return segmentEnd;
        
        return [x1 + param * C, y1 + param * D];
    }
}

class UIManager {
    setNoti(value) {
        document.getElementById('noti-box').textContent = value;
    }
}

// ===== GLOBAL INSTANCES =====
let gpsTracker, utils, navigationManager, searchManager, uiManager, voiceAudio;

// ===== INITIALIZATION =====
async function initializeApp() {
    if (State.system.isInitialized) return;
    
    try {
        if(localStorage.getItem('currentLat')) State.user.lat = parseFloat(localStorage.getItem('currentLat'));
        if(localStorage.getItem('currentLon')) State.user.lon = parseFloat(localStorage.getItem('currentLon'));
        if(localStorage.getItem('currentBearing')) State.user.bearing = parseInt(localStorage.getItem('currentBearing'));
        if(State.user.lon>0) CONFIG.map.initialLon = State.user.lon;
        if(State.user.lat>0) CONFIG.map.initialLat = State.user.lat;
        console.log('🚀 Initializing Consolidated Navigation System...');
        
        gpsTracker = new GPSTracker();
        utils = new Utils();
        navigationManager = new NavigationManager();
        uiManager = new UIManager();

        gpsTracker.initialize();
        gpsTracker.start();
        searchManager = new SearchManager();
        voiceAudio = new VoiceAudio();

        searchManager.initSearchHandlers();
        navigationManager.initHandlers();
        
        
        State.system.isInitialized = true;
        console.log('✅ Consolidated Navigation System initialized successfully');

        if(localStorage.getItem('lastNavigationLat')) lastNavigationLat = parseFloat(localStorage.getItem('lastNavigationLat'));
        if(localStorage.getItem('lastNavigationLon')) lastNavigationLon = parseFloat(localStorage.getItem('lastNavigationLon'));
        if(lastNavigationLat>0 && lastNavigationLon>0) {
            setTimeout(() => {
                //navigationManager.startNavigation(lastNavigationLat, lastNavigationLon);
            }, 1000);
        }
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
    }
}


window.addEventListener('beforeunload', () => {
    if(State.user.lat>0) localStorage.setItem('currentLat', State.user.lat);
    if(State.user.lon>0) localStorage.setItem('currentLon', State.user.lon);
    if(State.user.bearing>0) localStorage.setItem('currentBearing', State.user.bearing);
    localStorage.setItem('lastNavigationLat', lastNavigationLat);
    localStorage.setItem('lastNavigationLon', lastNavigationLon);
});

initializeApp();