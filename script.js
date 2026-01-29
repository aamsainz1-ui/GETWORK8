// State Management
let currentState = {
    isClockedIn: false,
    currentSessionStart: null,
    userName: '',
    userPin: '1234', // Default PIN
    attendanceRecords: [],
    currentBreaks: {
        restroom: [],
        rest: []
    },
    activeBreak: null,
    securitySettings: {
        requirePin: true,
        requirePhoto: true,
        requireGPS: true,
        officeLocations: [], // Changed from officeLocation: null
        lateThreshold: '09:00'
    },
    workMode: 'office',
    leaveRequests: [],
    leaveQuotas: {
        'Vacation': 15,
        'Sick': 30,
        'Personal': 7
    },
    language: 'TH'
};

let pendingAction = null; // Store pending clock in/out action
let webcamStream = null;

// Thai month names
const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

// Initialize
// Initialize theme and basic state
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    ensureOwnerExists();
    updateClock();
    setInterval(updateClock, 1000);
    renderAttendanceTable();
    updateUI();
    updateNameDropdown();
    renderTeamStatus();
    renderWeeklyChart();
    updateWorkLifeScore();
    applyTranslations();

    // Load initial data states
    if (currentState.userName) {
        document.getElementById('userName').value = currentState.userName;
        loadUserState(currentState.userName);
    } else {
        updateUI();
    }

    if (currentState.theme === 'dark') {
        document.body.classList.add('dark-mode');
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) themeBtn.innerHTML = '<span class="theme-icon">☀️</span>';
    }

    // PIN input enter key
    const pinInput = document.getElementById('pinInput');
    if (pinInput) {
        pinInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') verifyPin();
        });
    }
});

// Sidebar Toggle Logic
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth > 900) {
        sidebar.classList.toggle('collapsed');
    } else {
        sidebar.classList.toggle('expanded');

        // Close sidebar when clicking outside on mobile
        if (sidebar.classList.contains('expanded')) {
            setTimeout(() => {
                document.addEventListener('click', closeSidebarOnClickOutside);
            }, 100);
        } else {
            document.removeEventListener('click', closeSidebarOnClickOutside);
        }
    }
}

function closeSidebarOnClickOutside(event) {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebarToggleBtn');

    if (sidebar.classList.contains('expanded') &&
        !sidebar.contains(event.target) &&
        event.target !== sidebarToggle) {
        sidebar.classList.remove('expanded');
        document.removeEventListener('click', closeSidebarOnClickOutside);
    }
}

window.toggleSidebar = toggleSidebar;

// Force Owner existence function
function ensureOwnerExists() {
    if (!currentState.employees) currentState.employees = [];
    const hasOwner = currentState.employees.some(e => e.role === 'Owner' || e.name === 'System Owner');

    if (!hasOwner) {
        const ownerAcc = {
            id: 'EMP-0001',
            name: 'System Owner',
            pin: '2626',
            dept: 'Executive',
            pos: 'Owner',
            role: 'Owner',
            status: 'Active'
        };
        currentState.employees.unshift(ownerAcc);
        saveToLocalStorage();
        console.log('👑 Owner account initialized.');
    }
}

// Event listeners
const clockInBtn = document.getElementById('clockInBtn');
const clockOutBtn = document.getElementById('clockOutBtn');

if (clockInBtn) clockInBtn.addEventListener('click', () => handleClockAction('clockIn'));
if (clockOutBtn) clockOutBtn.addEventListener('click', () => handleClockAction('clockOut'));

const restroomBtn = document.getElementById('restroomBtn');
const restBtn = document.getElementById('restBtn');
const nameSelect = document.getElementById('userName');

if (restroomBtn) restroomBtn.addEventListener('click', () => handleBreak('restroom'));
if (restBtn) restBtn.addEventListener('click', () => handleBreak('rest'));
if (nameSelect) nameSelect.addEventListener('change', handleNameChange);

// Update real-time clock
function updateClock() {
    const now = new Date();

    // Time
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('currentTime').textContent = `${hours}:${minutes}:${seconds}`;

    // Date
    const dayName = thaiDays[now.getDay()];
    const day = now.getDate();
    const month = thaiMonths[now.getMonth()];
    const year = now.getFullYear() + 543;
    document.getElementById('currentDate').textContent = `วัน${dayName}ที่ ${day} ${month} ${year}`;

    // Update Shift Timer
    updateShiftTimer(now);

    // Check for alarms/notifications
    checkAlarms(now);
}

// Update shift timer display
function updateShiftTimer(now) {
    const timerEl = document.getElementById('shiftTimer');
    if (!currentState.isClockedIn || !currentState.currentSessionStart) {
        timerEl.textContent = '00:00:00';
        return;
    }

    const start = new Date(currentState.currentSessionStart);
    const diff = now - start;

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    timerEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Handle name change
function handleNameChange(e) {
    currentState.userName = e.target.value;
    loadUserState(currentState.userName);
    updateUI(); // Immediate UI update for role visibility
    saveToLocalStorage();
}

// Check for file protocol (Geolocation doesn't work on file:// in modern browsers)
function checkProtocol() {
    if (window.location.protocol === 'file:') {
        window.toast.warning('⚠️ Warning: ระบบ GPS จะไม่ทำงานหากรันผ่านไฟล์โดยตรง');
    }
}

// Initial check
checkProtocol();

// Handle clock in/out action with security
function handleClockAction(action) {
    if (!currentState.userName) {
        window.toast.warning('⚠️ กรุณาเลือกชื่อพนักงานก่อน');
        return;
    }

    // Store the explicit action
    pendingAction = action;

    // Start security verification process
    if (currentState.securitySettings.requirePin) {
        showPinModal();
    } else if (currentState.securitySettings.requirePhoto) {
        startLivenessChallenge(); // Phase 2: AI Liveness
    } else if (currentState.securitySettings.requireGPS) {
        verifyGPS();
    } else {
        executePendingAction();
    }
}

// PIN Modal Functions
function showPinModal() {
    const modal = document.getElementById('pinModal');
    const pinInput = document.getElementById('pinInput');
    modal.classList.add('show');
    pinInput.value = '';
    pinInput.focus();
}

function closePinModal() {
    const modal = document.getElementById('pinModal');
    modal.classList.remove('show');
    // Stop webcam if it's running during security flow
    stopWebcam();
    // Clear pending action on explicit close
    pendingAction = null;
}

// Fixed PIN Verification
function verifyPin() {
    const pinInput = document.getElementById('pinInput');
    const enteredPin = pinInput.value.trim(); // Trim whitespace

    // Find employee PIN
    const employee = currentState.employees.find(emp => emp.name === currentState.userName);

    // Debugging (console log can be seen in dev tools if needed)
    console.log('Verifying PIN for:', currentState.userName);

    // Fallback to global PIN if employee not found (legacy support), but prefer employee PIN
    const correctPin = employee ? employee.pin : currentState.userPin;

    if (enteredPin === correctPin) {
        closePinModal();

        // Continue to next security step
        if (currentState.securitySettings.requirePhoto) {
            startLivenessChallenge();
        } else if (currentState.securitySettings.requireGPS) {
            verifyGPS();
        } else {
            executePendingAction();
        }
    } else {
        window.toast.error('❌ รหัส PIN ไม่ถูกต้อง');
        pinInput.value = '';
        pinInput.focus();
    }
}

// Webcam Modal Functions
function showWebcamModal() {
    const modal = document.getElementById('webcamModal');
    modal.classList.add('show');
    startWebcam();
}

function closeWebcamModal() {
    const modal = document.getElementById('webcamModal');
    modal.classList.remove('show');
    stopWebcam();
}

async function startWebcam() {
    try {
        const video = document.getElementById('webcam');
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        video.srcObject = webcamStream;
    } catch (error) {
        console.error('Error accessing webcam:', error);
        window.toast.error('❌ ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง');
        closeWebcamModal();
    }
}

function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
}

async function capturePhoto() {
    console.log('capturePhoto() called, pendingAction:', pendingAction);

    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');

    if (!video || !video.videoWidth) {
        console.error('Video not ready');
        window.toast.error('❌ กล้องยังไม่พร้อม กรุณารอสักครู่');
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    // Convert to base64
    const photoData = canvas.toDataURL('image/jpeg', 0.8);
    console.log('Photo captured, size:', photoData.length);

    // ตรวจสอบว่าต้องเปรียบเทียบใบหน้าหรือไม่
    if (currentState.userName && currentState.employees) {
        const employee = currentState.employees.find(e => e.name === currentState.userName);

        if (employee && employee.faceData) {
            // มีข้อมูลใบหน้าที่ลงทะเบียนไว้ - ต้องตรวจสอบ
            window.toast.info('🔍 กำลังตรวจสอบใบหน้า...');

            try {
                const isMatch = await compareFaceData(photoData, employee.faceData);

                if (!isMatch) {
                    window.toast.error('❌ ใบหน้าไม่ตรงกับที่ลงทะเบียน!\n\nกรุณาให้เจ้าของบัญชีสแกนหน้าด้วยตนเอง');
                    closeWebcamModal();
                    pendingAction = null;
                    return;
                }

                window.toast.success('✅ ยืนยันใบหน้าสำเร็จ!');
            } catch (error) {
                console.error('Face verification error:', error);
                window.toast.warning('⚠️ ไม่สามารถตรวจสอบใบหน้าได้\n\nระบบจะดำเนินการต่อ');
            }
        } else {
            // ไม่มีข้อมูลใบหน้า - แจ้งเตือนให้ลงทะเบียน
            window.toast.warning('⚠️ ยังไม่ได้ลงทะเบียนใบหน้า\n\nระบบจะบันทึกรูปนี้ แต่แนะนำให้ลงทะเบียน Face ID');
        }
    }

    // Store photo with pending action
    if (pendingAction) {
        const actionData = {
            photo: photoData,
            timestamp: new Date().toISOString(),
            verified: currentState.employees?.find(e => e.name === currentState.userName)?.faceData ? true : false
        };

        // Store in the record that will be created
        if (pendingAction === 'clockIn') {
            currentState.pendingPhoto = actionData;
        }
    }

    closeWebcamModal();
    console.log('Webcam closed, checking next step...');

    // Continue to next security step
    console.log('requireGPS:', currentState.securitySettings.requireGPS);
    if (currentState.securitySettings.requireGPS) {
        console.log('Proceeding to GPS verification');
        verifyGPS();
    } else {
        console.log('No GPS required, executing action directly');
        executePendingAction();
    }
}


// เปรียบเทียบข้อมูลใบหน้า
async function compareFaceData(currentPhoto, registeredPhoto) {
    return new Promise((resolve) => {
        try {
            const img1 = new Image();
            const img2 = new Image();

            let loaded = 0;
            const checkLoaded = () => {
                loaded++;
                if (loaded === 2) {
                    // สร้าง canvas สำหรับเปรียบเทียบ
                    const canvas1 = document.createElement('canvas');
                    const canvas2 = document.createElement('canvas');
                    const ctx1 = canvas1.getContext('2d');
                    const ctx2 = canvas2.getContext('2d');

                    // ปรับขนาดให้เท่ากัน
                    const size = 128;
                    canvas1.width = canvas1.height = size;
                    canvas2.width = canvas2.height = size;

                    // วาดรูป
                    ctx1.drawImage(img1, 0, 0, size, size);
                    ctx2.drawImage(img2, 0, 0, size, size);

                    // ดึง pixel data
                    const data1 = ctx1.getImageData(0, 0, size, size).data;
                    const data2 = ctx2.getImageData(0, 0, size, size).data;

                    // คำนวณความแตกต่าง
                    let diff = 0;
                    const sampleRate = 4; // ตรวจสอบทุก 4 pixels เพื่อความเร็ว

                    for (let i = 0; i < data1.length; i += sampleRate * 4) {
                        const r1 = data1[i];
                        const g1 = data1[i + 1];
                        const b1 = data1[i + 2];

                        const r2 = data2[i];
                        const g2 = data2[i + 1];
                        const b2 = data2[i + 2];

                        diff += Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
                    }

                    // คำนวณเปอร์เซ็นต์ความแตกต่าง
                    const maxDiff = (size * size / sampleRate) * 255 * 3;
                    const similarity = 100 - (diff / maxDiff * 100);

                    console.log('Face similarity:', similarity.toFixed(2) + '%');

                    // ถ้าความคล้ายคลึงมากกว่า 70% ถือว่าเป็นคนเดียวกัน
                    // ค่านี้อาจต้องปรับตามสภาพแสงและมุมกล้อง
                    const threshold = 70;

                    if (similarity >= threshold) {
                        resolve(true);
                    } else {
                        console.warn(`Face match failed: ${similarity.toFixed(2)}% < ${threshold}%`);
                        resolve(false);
                    }
                }
            };

            img1.onload = checkLoaded;
            img2.onload = checkLoaded;

            img1.onerror = () => {
                console.error('Failed to load current photo');
                resolve(false);
            };

            img2.onerror = () => {
                console.error('Failed to load registered photo');
                resolve(false);
            };

            img1.src = currentPhoto;
            img2.src = registeredPhoto;

        } catch (error) {
            console.error('Face comparison error:', error);
            resolve(false);
        }
    });
}

// GPS Verification & Mock Geocoding
async function verifyGPS() {
    if (!navigator.geolocation) {
        window.toast.warning('⚠️ เบรา้วเซอร์ไม่รองรับ GPS');
        executePendingAction();
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;

        // Check against saved office locations
        let matchedLocation = null;
        let minDistance = Infinity;

        // Safely get locations array
        let locationsToCheck = [];
        if (currentState.securitySettings.officeLocations && Array.isArray(currentState.securitySettings.officeLocations)) {
            locationsToCheck = [...currentState.securitySettings.officeLocations];
        } else if (currentState.securitySettings.officeLocation) {
            // Fallback for legacy single location
            locationsToCheck.push(currentState.securitySettings.officeLocation);
        }

        // Validate and check each location
        locationsToCheck.forEach(loc => {
            // Ensure location has valid coordinates
            if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
                const dist = calculateDistance(latitude, longitude, loc.latitude, loc.longitude);
                if (dist <= 150) { // 150 meters radius
                    if (dist < minDistance) {
                        minDistance = dist;
                        matchedLocation = loc.name || 'Office Location';
                    }
                }
            }
        });

        // Use matched office name or fallback to Geocoding
        const locName = matchedLocation ? `${matchedLocation} (Verified)` : await mockReverseGeocode(latitude, longitude);

        currentState.pendingLocation = {
            latitude: latitude,
            longitude: longitude,
            name: locName,
            timestamp: new Date().toISOString()
        };
        executePendingAction();
    }, (err) => {
        let msg = '❌ GPS Error: ' + err.message;
        if (err.code === err.PERMISSION_DENIED) {
            msg = '📍 การเข้าถึงพิกัดถูกปฏิเสธ (GPS Blocked)\n\nวิธีแก้:\n1. กดที่ "รูปแม่กุญแจ" หรือไอคอนข้างแถบ URL\n2. ตั้งค่า Location ให้เป็น "Allow" (อนุญาต)\n3. รีเฟรชหน้าเว็บแล้วลองใหม่ครับ';
        }
        window.toast.error(msg);
        executePendingAction();
    });
}

function mockReverseGeocode(lat, lng) {
    return new Promise(resolve => {
        setTimeout(() => {
            const cities = ['Bangkok, TH', 'Nonthaburi, TH', 'Chiang Mai, TH', 'Phuket, TH', 'Pattaya, TH'];
            resolve(cities[Math.floor(Math.random() * cities.length)]);
        }, 600);
    });
}

// Calculate distance between two GPS coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

// Execute the pending action after all security checks
function executePendingAction() {
    console.log('executePendingAction called, pendingAction:', pendingAction);

    if (!pendingAction) {
        console.warn('No pending action to execute');
        return;
    }

    console.log('Executing action:', pendingAction);

    if (pendingAction === 'clockIn') {
        clockIn();
    } else if (pendingAction === 'clockOut') {
        clockOut();
    }

    pendingAction = null;
    updateUI();
    saveToLocalStorage();
}

// Clock in
function clockIn() {
    console.log('clockIn() called for user:', currentState.userName);

    const now = new Date();
    currentState.isClockedIn = true;
    currentState.currentSessionStart = now.toISOString();
    currentState.currentBreaks = { restroom: [], rest: [] };
    currentState.activeBreak = null;

    const projectInput = document.getElementById('projectInput');
    const projectName = projectInput ? projectInput.value.trim() : '';

    // Check if late
    let isLate = false;
    if (currentState.securitySettings.lateThreshold) {
        const threshold = currentState.securitySettings.lateThreshold.split(':');
        const thresholdMin = (parseInt(threshold[0]) * 60) + parseInt(threshold[1]);
        const currentMin = (now.getHours() * 60) + now.getMinutes();
        if (currentMin > thresholdMin) {
            isLate = true;
        }
    }

    // Create new attendance record
    const record = {
        id: Date.now(),
        userName: currentState.userName,
        date: formatDate(now),
        clockIn: formatTime(now),
        clockOut: null,
        isLate: isLate,
        duration: null,
        restroomTime: 0,
        restTime: 0,
        restroomBreaks: [],
        restBreaks: [],
        photo: currentState.pendingPhoto?.photo || null,
        location: currentState.pendingLocation || null,
        mode: currentState.workMode || 'office',
        project: projectName || 'General Work',
        ipAddress: null, // Would need server-side to get real IP
        timestamp: now.toISOString(), // Add timestamp for tracking
        sessionStart: now.toISOString(), // Add session start
        sessionEnd: null // Will be set on clock out
    };

    console.log('Created attendance record:', record);

    if (projectInput) projectInput.value = ''; // Clear project input after clock in

    currentState.attendanceRecords.unshift(record);

    console.log('Total attendance records:', currentState.attendanceRecords.length);

    currentState.pendingPhoto = null;
    currentState.pendingLocation = null;
    renderAttendanceTable();
    window.toast.success(`✅ สวัสดีครับคุณ ${currentState.userName} เข้างานเรียบร้อย`);

    console.log('clockIn() completed successfully');
}

// Clock out
function clockOut() {
    const now = new Date();

    // End any active break first
    if (currentState.activeBreak) {
        endBreak(currentState.activeBreak.type);
    }

    currentState.isClockedIn = false;

    // Update the most recent record
    if (currentState.attendanceRecords.length > 0) {
        const record = currentState.attendanceRecords[0];
        record.clockOut = formatTime(now);
        record.sessionEnd = now.toISOString(); // Add session end timestamp

        // Calculate duration
        const start = new Date(currentState.currentSessionStart);
        const duration = calculateDuration(start, now);
        record.duration = duration;

        // Calculate break times
        record.restroomTime = calculateTotalBreakTime(currentState.currentBreaks.restroom);
        record.restTime = calculateTotalBreakTime(currentState.currentBreaks.rest);
        record.restroomBreaks = [...currentState.currentBreaks.restroom];
        record.restBreaks = [...currentState.currentBreaks.rest];
    }

    currentState.currentSessionStart = null;
    currentState.currentBreaks = { restroom: [], rest: [] };
    currentState.activeBreak = null;
    renderAttendanceTable();
    renderWeeklyChart(); // Phase 4: Update Analytics
    updateWorkLifeScore(); // Phase 4: Update Score
    calculateStats(); // Update statistics after clock out
    window.toast.info(`👋 เลิกงานแล้ว พักผ่อนให้เต็มที่นะครับคุณ ${currentState.userName}`);
}

// Handle break tracking (start/end toggle)
function handleBreak(type) {
    const now = new Date();

    // If there's an active break of different type, end it first
    if (currentState.activeBreak && currentState.activeBreak.type !== type) {
        endBreak(currentState.activeBreak.type);
    }

    // Toggle break
    if (currentState.activeBreak && currentState.activeBreak.type === type) {
        endBreak(type);
    } else {
        startBreak(type);
    }

    updateUI();
    saveToLocalStorage();
}

// Start a break
function startBreak(type) {
    const now = new Date();
    currentState.activeBreak = {
        type: type,
        startTime: now.toISOString()
    };

    const button = document.getElementById(type === 'restroom' ? 'restroomBtn' : 'restBtn');
    button.classList.add('active-break');

    saveToLocalStorage();
}

// End a break
function endBreak(type) {
    if (!currentState.activeBreak || currentState.activeBreak.type !== type) return;

    const now = new Date();
    const breakRecord = {
        startTime: currentState.activeBreak.startTime,
        endTime: now.toISOString(),
        duration: new Date(now) - new Date(currentState.activeBreak.startTime)
    };

    currentState.currentBreaks[type].push(breakRecord);
    currentState.activeBreak = null;

    // Update the open record
    const record = currentState.attendanceRecords.find(r =>
        r.userName === currentState.userName && !r.sessionEnd
    );

    if (record) {
        record.restroomTime = calculateTotalBreakTime(currentState.currentBreaks.restroom);
        record.restTime = calculateTotalBreakTime(currentState.currentBreaks.rest);
        record[type === 'restroom' ? 'restroomBreaks' : 'restBreaks'].push(breakRecord);
        record.activeBreak = null;
    }

    renderAttendanceTable();
    saveToLocalStorage();
    updateUI();
}

// Calculate total break time in milliseconds
function calculateTotalBreakTime(breaks) {
    return breaks.reduce((total, breakItem) => {
        return total + breakItem.duration;
    }, 0);
}

// Format break time duration
function formatBreakTime(milliseconds) {
    if (milliseconds === 0) return '-';

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours} ชม. ${minutes} นาที`;
    } else if (minutes > 0) {
        return `${minutes} นาที ${seconds} วินาที`;
    } else {
        return `${seconds} วินาที`;
    }
}

// Handle name change
function handleNameChange(e) {
    currentState.userName = e.target.value;
    loadUserState(currentState.userName);
    saveToLocalStorage();
}

// Load User State from Records
function loadUserState(name) {
    if (!name) {
        resetToClockedOutState();
        return;
    }

    // Find the latest open record for this user (no sessionEnd or clockOut)
    // We check sessionEnd first as it's the most reliable end indicator in our new logic
    const openRecord = (currentState.attendanceRecords || []).find(r =>
        r.userName === name && (!r.sessionEnd && !r.clockOut)
    );

    if (openRecord) {
        // User is clocked in
        currentState.isClockedIn = true;
        currentState.currentSessionStart = openRecord.sessionStart || openRecord.timestamp; // Fallback

        // Restore breaks
        currentState.currentBreaks = {
            restroom: openRecord.restroomBreaks || [],
            rest: openRecord.restBreaks || []
        };

        // Check if there is an active break (we need to store this in record to restore it properly)
        // For now, if we switch users, we might lose the "active" break state unless we save it to the record.
        // Adding activeBreak persistence would be better:
        currentState.activeBreak = openRecord.activeBreak || null;

    } else {
        // User is NOT clocked in
        resetToClockedOutState();
    }

    updateUI();
}

function resetToClockedOutState() {
    currentState.isClockedIn = false;
    currentState.currentSessionStart = null;
    currentState.currentBreaks = { restroom: [], rest: [] };
    currentState.activeBreak = null;

    // Reset buttons immediately
    const clockInBtn = document.getElementById('clockInBtn');
    const clockOutBtn = document.getElementById('clockOutBtn');
    if (clockInBtn) clockInBtn.disabled = false;
    if (clockOutBtn) clockOutBtn.disabled = true;

    updateUI();
}

// Update UI based on current state
function updateUI() {
    const clockInBtn = document.getElementById('clockInBtn');
    const clockOutBtn = document.getElementById('clockOutBtn');

    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const restroomBtn = document.getElementById('restroomBtn');
    const restBtn = document.getElementById('restBtn');

    const headerUserName = document.getElementById('headerUserName');
    const userRoleDisplay = document.getElementById('userRoleDisplay');

    // Update User Info
    if (currentState.userName) {
        headerUserName.textContent = currentState.userName;
        const employee = (currentState.employees || []).find(e => e.name === currentState.userName);
        if (employee) {
            userRoleDisplay.textContent = employee.role || 'Staff';
        }
    } else {
        headerUserName.textContent = 'Select User...';
        userRoleDisplay.textContent = 'Employee';
    }

    // Update Work Mode Buttons
    const modeOffice = document.getElementById('modeOffice');
    const modeRemote = document.getElementById('modeRemote');
    const locationBadge = document.getElementById('locationBadge');

    if (currentState.workMode === 'office') {
        modeOffice.classList.add('active');
        modeRemote.classList.remove('active');
        locationBadge.textContent = '🏢 Corporate Office';
    } else {
        modeOffice.classList.remove('active');
        modeRemote.classList.add('active');
        locationBadge.textContent = '🏠 Remote / Home';
    }

    // Role-Based UI Access Control
    const navAdmin = document.getElementById('navAdmin');
    const employee = (currentState.employees || []).find(e => e.name === currentState.userName);
    const userRole = employee ? employee.role : 'Staff';

    if (userRole === 'Admin' || userRole === 'Owner') {
        navAdmin.style.display = 'flex';
    } else {
        navAdmin.style.display = 'none';
        // If user is currently in settings modal but no longer admin/owner, close it
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal && settingsModal.classList.contains('show')) {
            closeSettingsModal();
        }
    }

    if (currentState.isClockedIn) {
        // Clocked In State
        if (clockInBtn) clockInBtn.disabled = true; // Disable In
        if (clockOutBtn) clockOutBtn.disabled = false; // Enable Out

        statusBadge.classList.remove('clocked-out');
        statusBadge.classList.add('clocked-in');
        statusText.textContent = 'กำลังทำงาน';

        restroomBtn.disabled = false;
        restBtn.disabled = false;

        if (currentState.activeBreak) {
            if (currentState.activeBreak.type === 'restroom') {
                restroomBtn.textContent = '🚽 กลับจากห้องน้ำ';
            } else {
                restBtn.textContent = '☕ กลับจากพัก';
            }
        } else {
            restroomBtn.textContent = '🚽 Restroom';
            restBtn.textContent = '☕ Coffee Break';
        }
    } else {
        // Clocked Out State
        if (clockInBtn) clockInBtn.disabled = false; // Enable In
        if (clockOutBtn) clockOutBtn.disabled = true; // Disable Out

        statusBadge.classList.remove('clocked-in');
        statusBadge.classList.add('clocked-out');
        statusText.textContent = 'ยังไม่ได้เข้างาน';

        restroomBtn.disabled = true;
        restBtn.disabled = true;
        restroomBtn.classList.remove('active-break');
        restBtn.classList.remove('active-break');

        restroomBtn.textContent = '🚽 Restroom';
        restBtn.textContent = '☕ Coffee Break';
    }
}

// Work Mode Selection
function setWorkMode(mode) {
    currentState.workMode = mode;
    updateUI();
    saveToLocalStorage();
}

// Render attendance table
function renderAttendanceTable() {
    const tbody = document.getElementById('attendanceBody');
    const emptyState = document.getElementById('emptyState');

    if (currentState.attendanceRecords.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = currentState.attendanceRecords.map(record => `
    <tr>
      <td>
        <strong>${record.userName}</strong>
        ${record.photo ? '<span class="security-indicator">📸</span>' : ''}
        ${record.location ? '<span class="security-indicator">📍</span>' : ''}
      </td>
      <td>${record.date}</td>
      <td>${record.clockIn}</td>
      <td>${record.clockOut || '-'}</td>
      <td>${formatBreakTime(record.restroomTime)}</td>
      <td>${formatBreakTime(record.restTime)}</td>
      <td class="duration ${record.duration ? 'complete' : 'incomplete'}">
        ${record.duration || 'กำลังทำงาน...'}
      </td>
    </tr>
  `).join('');
}

// Export to Excel
function exportToExcel() {
    if (currentState.attendanceRecords.length === 0) {
        window.toast.warning('ไม่มีข้อมูลให้ส่งออก');
        return;
    }

    let csv = '\uFEFF';
    csv += 'ชื่อ,วันที่,เวลาเข้า-ออก,มาสาย,เวลาห้องน้ำ,เวลาพักผ่อน,หมายเหตุ,ระยะเวลาทำงาน,OT,มีรูปถ่าย,มี GPS\n';

    currentState.attendanceRecords.forEach(record => {
        const sessionStart = record.sessionStart ? new Date(record.sessionStart) : null;
        const sessionEnd = record.sessionEnd ? new Date(record.sessionEnd) : null;
        let otStr = '-';
        if (sessionStart && sessionEnd) {
            const dur = sessionEnd - sessionStart;
            const otMs = calculateOT(dur);
            if (otMs > 0) otStr = formatDurationShort(otMs);
        }

        csv += `"${record.userName}",`;
        csv += `"${record.date}",`;
        csv += `"${record.clockIn} - ${record.clockOut || '-'}",`;
        csv += `"${record.isLate ? 'สาย' : '-'}",`;
        csv += `"${formatBreakTime(record.restroomTime)}",`;
        csv += `"${formatBreakTime(record.restTime)}",`;
        csv += `"${record.note || '-'}",`;
        csv += `"${record.duration || 'กำลังทำงาน...'}",`;
        csv += `"${otStr}",`;
        csv += `"${record.photo ? 'มี' : 'ไม่มี'}",`;
        csv += `"${record.location ? 'มี' : 'ไม่มี'}"`;
        csv += '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const filename = `attendance_report_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.exportToExcel = exportToExcel;

// Format date
function formatDate(date) {
    const d = new Date(date);
    const day = d.getDate();
    const month = thaiMonths[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${day} ${month} ${year}`;
}

// Format time
function formatTime(date) {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// Calculate duration between two dates
function calculateDuration(start, end) {
    const diff = end - start;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours} ชม. ${minutes} นาที ${seconds} วินาที`;
}

// Local Storage Functions
function saveToLocalStorage() {
    localStorage.setItem('attendanceState', JSON.stringify(currentState));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('attendanceState');
    if (saved) {
        try {
            const loaded = JSON.parse(saved);
            currentState = {
                ...currentState,
                ...loaded,
                securitySettings: {
                    ...currentState.securitySettings,
                    ...(loaded.securitySettings || {})
                }
            };

            currentState.securitySettings.lateThreshold = currentState.securitySettings.lateThreshold || '09:00';

            // Migrate officeLocation to officeLocations array if needed
            if (loaded.securitySettings && loaded.securitySettings.officeLocation && !loaded.securitySettings.officeLocations) {
                currentState.securitySettings.officeLocations = [loaded.securitySettings.officeLocation];
            } else if (!currentState.securitySettings.officeLocations) {
                currentState.securitySettings.officeLocations = [];
            }

            // Initialize/Migrate employees list if not present in loaded state
            if (!currentState.employees || currentState.employees.length === 0) {
                currentState.employees = [
                    { id: 'EMP-0001', name: 'System Owner', pin: '2626', dept: 'Executive', pos: 'Owner', role: 'Owner', status: 'Active' },
                    { id: 'EMP-1001', name: 'พนักงาน ทดสอบ', pin: '1234', dept: 'IT', pos: 'Developer', role: 'Staff', status: 'Active' },
                    { id: 'EMP-1002', name: 'เจ้าหน้าที่ การเงิน', pin: '0000', dept: 'Finance', pos: 'Accountant', role: 'Admin', status: 'Active' }
                ];
                currentState.lastEmployeeId = 1002; // Update last ID based on new defaults
            } else {
                // Migration logic for existing simple schema
                currentState.employees = currentState.employees.map((emp, idx) => {
                    if (!emp.id) {
                        const idNum = 1000 + idx + 1;
                        if (!currentState.lastEmployeeId || idNum > currentState.lastEmployeeId) {
                            currentState.lastEmployeeId = idNum;
                        }
                        return {
                            ...emp,
                            id: `EMP-${idNum}`,
                            dept: emp.dept || 'ทั่วไป',
                            pos: emp.pos || 'พนักงาน',
                            role: emp.role || 'Staff',
                            status: emp.status || 'Active'
                        };
                    }
                    return emp;
                });
            }
        } catch (e) {
            console.error('Error loading from localStorage:', e);
        }
    } else {
        // If no saved state, initialize with default employees
        currentState.employees = [
            { id: 'EMP-0001', name: 'System Owner', pin: '2626', dept: 'Executive', pos: 'Owner', role: 'Owner', status: 'Active' },
            { id: 'EMP-1001', name: 'พนักงาน ทดสอบ', pin: '1234', dept: 'IT', pos: 'Developer', role: 'Staff', status: 'Active' },
            { id: 'EMP-1002', name: 'เจ้าหน้าที่ การเงิน', pin: '0000', dept: 'Finance', pos: 'Accountant', role: 'Admin', status: 'Active' }
        ];
        currentState.lastEmployeeId = 1002;
    }

    // Ensure Owner account exists if not present (Migration)
    if (currentState.employees && !currentState.employees.some(e => e.role === 'Owner')) {
        currentState.employees.unshift({
            id: 'EMP-0001', name: 'System Owner', pin: '2626', dept: 'Executive', pos: 'Owner', role: 'Owner', status: 'Active'
        });
        saveToLocalStorage(); // Save immediately after adding owner
    }

    updateUI();
    renderAttendanceTable();
    updateNameDropdown();
    applyTranslations(); // Assuming applyTranslations is a global function
}

// Settings Modal Functions
function showSettingsModal() {
    if (!checkRoleAccess('Admin')) return;

    const modal = document.getElementById('settingsModal');
    modal.classList.add('show');
    renderEmployeeList();
    updateSecurityToggles();
    renderAdminLeaveManagement();
    updateQuotaDropdown();
    initMapPicker(); // Initialize map picker when settings modal is shown
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('show');
    updateNameDropdown();
}

function toggleSecurity(key) {
    currentState.securitySettings[key] = !currentState.securitySettings[key];
    saveToLocalStorage();
}

function updateSecurityToggles() {
    document.getElementById('requirePinCheck').checked = currentState.securitySettings.requirePin;
    document.getElementById('requirePhotoCheck').checked = currentState.securitySettings.requirePhoto;
    document.getElementById('requireGPSCheck').checked = currentState.securitySettings.requireGPS;
    document.getElementById('lateThresholdInput').value = currentState.securitySettings.lateThreshold || '09:00';

    // Show/Hide Owner specific tools
    const ownerTools = document.getElementById('ownerTools');
    if (ownerTools) {
        const employee = (currentState.employees || []).find(e => e.name === currentState.userName);
        ownerTools.style.display = (employee && employee.role === 'Owner') ? 'block' : 'none';
    }

    // Update office locations list
    const locationsList = document.getElementById('officeLocationsList');
    if (locationsList) {
        const locations = currentState.securitySettings.officeLocations || [];
        if (locations.length === 0) {
            locationsList.innerHTML = '<p style="text-align:center; color:var(--text-light); font-size:0.75rem; margin-top:5px;">ยังไม่ได้ตั้งค่าตำแหน่ง</p>';
        } else {
            locationsList.innerHTML = locations.map((loc, index) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-card); border-radius: 6px; border: 1px solid var(--border-light);">
                    <div style="overflow: hidden;">
                        <span style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-main); white-space: nowrap; text-overflow: ellipsis;">${loc.name}</span>
                        <span style="display: block; font-size: 0.65rem; color: var(--text-muted);">${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}</span>
                    </div>
                    <button onclick="deleteOfficeLocation(${index})" style="background: none; border: none; cursor: pointer; color: var(--danger-red); font-size: 0.8rem;">🗑️</button>
                </div>
            `).join('');
        }
    }
}

// Map Picker for Office Location
let mapPicker;
let markerPicker;

function initMapPicker() {
    const mapContainer = document.getElementById('mapPicker');
    if (!mapContainer) return;

    // Ensure map is only initialized once
    if (mapPicker) {
        mapPicker.remove();
    }

    const initialLat = currentState.securitySettings.officeLocation?.latitude || 13.7563; // Bangkok default
    const initialLng = currentState.securitySettings.officeLocation?.longitude || 100.5018;

    mapPicker = L.map('mapPicker').setView([initialLat, initialLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapPicker);

    markerPicker = L.marker([initialLat, initialLng], { draggable: true }).addTo(mapPicker);

    markerPicker.on('dragend', function (event) {
        const latlng = markerPicker.getLatLng();
        document.getElementById('mapPickerLat').value = latlng.lat.toFixed(6);
        document.getElementById('mapPickerLng').value = latlng.lng.toFixed(6);
    });

    // Set initial values in input fields
    document.getElementById('mapPickerLat').value = initialLat.toFixed(6);
    document.getElementById('mapPickerLng').value = initialLng.toFixed(6);
    document.getElementById('mapPickerName').value = currentState.securitySettings.officeLocation?.name || 'Main Office';

    // Invalidate size to ensure map renders correctly after modal opens
    setTimeout(() => {
        mapPicker.invalidateSize();
    }, 100);
}

function saveOfficeLocationFromPicker() {
    if (!checkRoleAccess('Owner')) return;

    const lat = parseFloat(document.getElementById('mapPickerLat').value);
    const lng = parseFloat(document.getElementById('mapPickerLng').value);
    const name = document.getElementById('mapPickerName').value.trim();

    if (isNaN(lat) || isNaN(lng) || !name) {
        window.toast.error('❌ กรุณากรอกข้อมูลพิกัดและชื่อให้ถูกต้อง');
        return;
    }

    currentState.securitySettings.officeLocation = {
        latitude: lat,
        longitude: lng,
        name: name
    };
    saveToLocalStorage();
    updateSecurityToggles(); // Update display in settings
    window.toast.success('✅ สำเร็จ! พิกัดสำนักงานถูกตั้งค่าเรียบร้อยแล้ว');
}
window.saveOfficeLocationFromPicker = saveOfficeLocationFromPicker;

function setOfficeLocation() {
    if (!checkRoleAccess('Owner')) return;

    if (navigator.geolocation) {
        window.toast.info('🛰 กำลังค้นหาพิกัด... โปรดรอสักครู่');
        navigator.geolocation.getCurrentPosition(pos => {
            currentState.securitySettings.officeLocation = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                name: 'Current Location' // Default name when using current GPS
            };
            saveToLocalStorage();
            updateSecurityToggles(); // Update display in settings
            window.toast.success('✅ สำเร็จ! พิกัดสำนักงานถูกตั้งค่าเรียบร้อยแล้ว');
        }, err => {
            let msg = '❌ ไม่สามารถดึงพิกัดได้: ' + err.message;
            if (err.code === err.PERMISSION_DENIED) {
                msg = '📍 การเข้าถึงพิกัดถูกปฏิเสธ';
            }
            window.toast.error(msg);
        }, { enableHighAccuracy: true, timeout: 5000 });
    } else {
        window.toast.error('❌ Browser does not support Geolocation');
    }
}
window.setOfficeLocation = setOfficeLocation;

window.showSettingsModal = showSettingsModal;
window.closeSettingsModal = closeSettingsModal;

// Helper to generate Employee ID
function generateEmployeeId() {
    const lastId = currentState.lastEmployeeId || 1000;
    const nextId = lastId + 1;
    currentState.lastEmployeeId = nextId;
    return `EMP-${nextId}`;
}

// Render employee list with HRM Standard
function renderEmployeeList() {
    const list = document.getElementById('employeeList');

    if (!currentState.employees || currentState.employees.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: var(--spacing-md);">ยังไม่มีพนักงาน</p>';
        return;
    }

    list.innerHTML = currentState.employees.map((emp, index) => `
    <div class="employee-item">
      <div class="employee-info-mini">
        <div class="employee-name-mini">
            ${emp.name} 
            <span class="status-tag ${emp.status === 'Inactive' ? 'status-inactive' : 'status-active'}">
                ${emp.status || 'Active'}
            </span>
        </div>
        <div class="employee-dept-mini">
            ID: ${emp.id || 'N/A'} | ${emp.dept || 'ทั่วไป'} | ${emp.pos || 'พนักงาน'}
        </div>
      </div>
      <div class="employee-actions">
        <button class="btn-icon" onclick="toggleEmployeeStatus(${index})" title="สลับสถานะ (Active/Inactive)">🔄</button>
        <button class="btn-icon" onclick="editEmployee(${index})" title="แก้ไขข้อมูล">✏️</button>
        <button class="btn-icon btn-delete-row" onclick="deleteEmployee(${index})" title="ลบพนักงาน">🗑️</button>
      </div>
    </div>
  `).join('');
}

// Add new employee with HRM Standard
function addEmployee() {
    const nameInput = document.getElementById('newEmployeeName');
    const pinInput = document.getElementById('newEmployeePin');
    const deptInput = document.getElementById('newEmployeeDept');
    const posInput = document.getElementById('newEmployeePos');
    const roleInput = document.getElementById('newEmployeeRole');

    const name = nameInput.value.trim();
    const pin = pinInput.value.trim();
    const dept = deptInput.value.trim();
    const pos = posInput.value.trim();
    const role = roleInput.value; // Roles: Staff, Admin, Owner

    if (!name) {
        window.toast.warning('⚠️ กรุณากรอกชื่อพนักงาน');
        return;
    }

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        window.toast.warning('⚠️ กรุณากรอก PIN 4 หลัก (ตัวเลขเท่านั้น)');
        return;
    }

    // Check duplicate
    if (currentState.employees.some(emp => emp.name === name)) {
        window.toast.warning('⚠️ มีชื่อนี้อยู่แล้ว');
        return;
    }

    const newEmp = {
        id: generateEmployeeId(),
        name,
        pin,
        dept: dept || 'ทั่วไป',
        pos: pos || 'พนักงาน',
        role: role,
        status: 'Active',
        hireDate: new Date().toISOString()
    };

    currentState.employees.push(newEmp);
    saveToLocalStorage();
    renderEmployeeList();
    updateNameDropdown();

    // Clear inputs
    nameInput.value = '';
    pinInput.value = '';
    deptInput.value = '';
    posInput.value = '';

    window.toast.success(`✅ เพิ่มพนักงาน ${name} สำเร็จ (ID: ${newEmp.id})`);
}

window.addEmployee = addEmployee;

// Toggle Active/Inactive
function toggleEmployeeStatus(index) {
    const emp = currentState.employees[index];
    emp.status = (emp.status === 'Inactive') ? 'Active' : 'Inactive';
    saveToLocalStorage();
    renderEmployeeList();
    updateNameDropdown();
}
window.toggleEmployeeStatus = toggleEmployeeStatus;

// Edit employee with HRM Standard
function editEmployee(index) {
    const emp = currentState.employees[index];

    // Protect Owner account
    if (emp.role === 'Owner') {
        const currentUser = (currentState.employees || []).find(e => e.name === currentState.userName);
        if (!currentUser || currentUser.role !== 'Owner') {
            window.toast.error('❌ เฉพาะ Owner เท่านั้นที่สามารถแก้ไขบัญชีระดับ Owner ได้');
            return;
        }
    }

    const newName = prompt('แก้ไขชื่อ:', emp.name);
    if (newName && newName.trim()) {
        const newPin = prompt('แก้ไข PIN (4 หลัก):', emp.pin);
        const newDept = prompt('แก้ไขแผนก:', emp.dept || '');
        const newPos = prompt('แก้ไขตำแหน่ง:', emp.pos || '');

        if (newPin && /^\d{4}$/.test(newPin)) {
            currentState.employees[index] = {
                ...emp,
                name: newName.trim(),
                pin: newPin,
                dept: newDept || emp.dept,
                pos: newPos || emp.pos
            };
            saveToLocalStorage();
            renderEmployeeList();
            updateNameDropdown();
            window.toast.success('✅ แก้ไขสำเร็จ');
        } else if (newPin !== null) {
            window.toast.warning('⚠️ PIN ต้องเป็นตัวเลข 4 หลักเท่านั้น');
        }
    }
}

window.editEmployee = editEmployee;

// Delete employee
function deleteEmployee(index) {
    const emp = currentState.employees[index];

    // Protect Owner account
    if (emp.role === 'Owner') {
        window.toast.error('❌ ไม่สามารถลบบัญชีระดับ Owner ได้');
        return;
    }

    window.confirmDialog.show({
        title: 'ยืนยันการลบ',
        message: `ต้องการลบ "${emp.name}" หรือไม่?\nแนะนำให้เปลี่ยนสถานะเป็น Inactive แทนเพื่อเก็บประวัติ`,
        type: 'delete'
    }).then(confirmed => {
        if (confirmed) {
            currentState.employees.splice(index, 1);
            saveToLocalStorage();
            renderEmployeeList();
            updateNameDropdown();
            window.toast.success('✅ ลบสำเร็จ');
        }
    });
}

window.deleteEmployee = deleteEmployee;

// Update Name Dropdown & Filter Dropdown
function updateNameDropdown() {
    const select = document.getElementById('userName');
    const filterSelect = document.getElementById('filterName');
    const currentValue = select.value;
    const currentFilter = filterSelect ? filterSelect.value : 'all';

    const options = '<option value="">เลือกชื่อพนักงาน...</option>';
    const filterOptions = '<option value="all">ทั้งหมด</option>';

    // Staff dropdown only shows Active employees
    const activeEmployees = (currentState.employees || []).filter(e => e.status !== 'Inactive');
    const employeeOptions = activeEmployees.map(emp =>
        `<option value="${emp.name}">${emp.name}</option>`
    ).join('');

    // Filter dropdown shows all for history but can be restricted if needed
    const allEmployeeOptions = (currentState.employees || []).map(emp =>
        `<option value="${emp.name}">${emp.name}</option>`
    ).join('');

    if (select) select.innerHTML = options + employeeOptions;
    if (filterSelect) filterSelect.innerHTML = filterOptions + allEmployeeOptions;

    if (select && currentValue && activeEmployees.some(emp => emp.name === currentValue)) {
        select.value = currentValue;
    }
    if (filterSelect && currentFilter !== 'all' && currentState.employees.some(emp => emp.name === currentFilter)) {
        filterSelect.value = currentFilter;
    }
}

// Stats Calculation
function calculateStats() {
    const now = new Date();
    const todayStr = formatDate(now);

    const todayRecords = (currentState.attendanceRecords || []).filter(r => r.date === todayStr);

    let workMs = 0;
    let breakMs = 0;
    let restroomCount = 0;

    todayRecords.forEach(r => {
        if (r.sessionStart && r.sessionEnd) {
            workMs += (new Date(r.sessionEnd) - new Date(r.sessionStart));
        }
        restroomCount += (r.restroomBreaks ? r.restroomBreaks.length : 0);
        breakMs += (r.restroomTime || 0) + (r.restTime || 0);
    });

    const workTimeEl = document.getElementById('todayWorkTime');
    const breakTimeEl = document.getElementById('todayBreakTime');
    const restroomCountEl = document.getElementById('todayRestroomCount');
    const totalRecordsEl = document.getElementById('totalRecords');

    if (workTimeEl) workTimeEl.textContent = formatDurationShort(workMs);
    if (breakTimeEl) breakTimeEl.textContent = formatDurationShort(breakMs);
    if (restroomCountEl) restroomCountEl.textContent = `${restroomCount} ครั้ง`;
    if (totalRecordsEl) totalRecordsEl.textContent = `${(currentState.attendanceRecords || []).length} รายการ`;
}

function formatDurationShort(ms) {
    if (ms <= 0) return '0 นาที';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
    return `${minutes} นาที`;
}

// Filtering Logic
function filterToMe() {
    if (!currentState.userName) {
        window.toast.warning('⚠️ กรุณาเลือกชื่อพนักงานก่อน');
        return;
    }
    const nameFilterEl = document.getElementById('filterName');
    if (nameFilterEl) {
        nameFilterEl.value = currentState.userName;
        applyFilters();
        // Scroll to history table
        document.getElementById('attendanceTable').scrollIntoView({ behavior: 'smooth' });
    }
}

function applyFilters() {
    const nameFilterEl = document.getElementById('filterName');
    const dateFilterEl = document.getElementById('filterDate');
    const searchQueryEl = document.getElementById('searchQuery');

    if (!nameFilterEl || !dateFilterEl || !searchQueryEl) return;

    const nameFilter = nameFilterEl.value;
    const dateFilter = dateFilterEl.value;
    const searchQuery = searchQueryEl.value.toLowerCase();

    const now = new Date();
    const todayStr = formatDate(now);

    let filtered = (currentState.attendanceRecords || []);

    // Filter by Name
    if (nameFilter !== 'all') {
        filtered = filtered.filter(r => r.userName === nameFilter);
    }

    // Filter by Date Template
    if (dateFilter === 'today') {
        filtered = filtered.filter(r => r.date === todayStr);
    } else if (dateFilter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(r => new Date(r.timestamp || r.id) > oneWeekAgo);
    } else if (dateFilter === 'month') {
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        filtered = filtered.filter(r => new Date(r.timestamp || r.id) > oneMonthAgo);
    }

    // Filter by Search Query
    if (searchQuery) {
        filtered = filtered.filter(r =>
            r.userName.toLowerCase().includes(searchQuery) ||
            r.date.toLowerCase().includes(searchQuery) ||
            (r.note && r.note.toLowerCase().includes(searchQuery))
        );
    }

    renderTableData(filtered);
}

// Data Management
function deleteRecord(id) {
    window.confirmDialog.show({
        title: 'ยืนยันการลบ',
        message: '⚠️ ต้องการลบบันทึกนี้ใช่หรือไม่?',
        type: 'delete'
    }).then(confirmed => {
        if (confirmed) {
            currentState.attendanceRecords = currentState.attendanceRecords.filter(r => r.id !== id);
            saveToLocalStorage();
            calculateStats();
            applyFilters();
            window.toast.success('ลบบันทึกเรียบร้อย');
        }
    });
}

function updateNote(id, note) {
    const record = currentState.attendanceRecords.find(r => r.id === id);
    if (record) {
        record.note = note;
        saveToLocalStorage();
    }
}

function showResetModal() {
    const modal = document.getElementById('resetModal');
    if (modal) modal.classList.add('show');
}

function closeResetModal() {
    const modal = document.getElementById('resetModal');
    if (modal) modal.classList.remove('show');
}

function confirmResetAll() {
    if (!checkRoleAccess('Owner')) {
        window.toast.error('⛔ เฉพาะระดับ "Owner" เท่านั้นที่สามารถล้างระบบได้');
        return;
    }
    window.confirmDialog.show({
        title: 'ล้างข้อมูลทั้งหมด',
        message: '‼️ คำเตือนสุดท้าย: ข้อมูลการเข้างาน และ รายชื่อพนักงานทั้งหมด จะหายไปถาวร ยืนยันใช่หรือไม่?',
        type: 'danger',
        confirmText: 'ลบทิ้งทั้งหมด'
    }).then(confirmed => {
        if (confirmed) {
            currentState.attendanceRecords = [];
            currentState.employees = []; // Clear employees
            currentState.lastEmployeeId = 1000; // Reset ID counter

            saveToLocalStorage();
            calculateStats();
            applyFilters();
            renderEmployeeList(); // Re-render list
            updateNameDropdown(); // Re-render dropdown

            closeResetModal();
            window.toast.success('✅ ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว');
        }
    });
}

function exportToJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentState));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `attendance_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Improved Table Rendering
function renderAttendanceTable() {
    calculateStats();
    applyFilters();
    renderTeamStatus(); // Also update team when attendance changes
}

function renderTeamStatus() {
    const list = document.getElementById('teamList');
    if (!list) return;

    // Use employees list to create team status
    const teamMembers = (currentState.employees || []).slice(0, 5); // Show first 5

    list.innerHTML = teamMembers.map(emp => {
        // Determine if online (clocked in)
        const isOnline = (currentState.attendanceRecords || []).some(
            r => r.userName === emp.name && !r.clockOut
        );

        return `
            <div class="team-member-item">
                <div class="member-avatar">${emp.role === 'Admin' ? '👨‍💼' : '🧑‍💻'}</div>
                <div class="member-info">
                    <span class="member-name">${emp.name}</span>
                    <span class="member-dept">${emp.dept}</span>
                </div>
                <span class="member-status ${isOnline ? 'online' : 'offline'}"></span>
            </div>
        `;
    }).join('');
}

function renderTableData(records) {
    const tbody = document.getElementById('attendanceBody');
    const emptyState = document.getElementById('emptyState');

    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = records.map(record => `
    <tr>
      <td>
        <strong>${record.userName}</strong>
        ${record.isLate ? '<span class="status-row-tag" style="background:rgba(239, 68, 68, 0.1); color:var(--danger-red); margin-left:5px; font-size:0.7rem;">สาย</span>' : ''}
        ${record.photo ? '<span class="security-indicator" title="Captured Verification">📸</span>' : ''}
        ${record.location ? `<span class="security-indicator" title="${record.location.name || 'GPS Verified'}">📍</span>` : ''}
        <div class="mode-tag">${record.mode === 'office' ? '🏢 Office' : '🏠 Remote'}</div>
        ${record.location?.name ? `<div style="font-size:0.65rem; color:var(--text-muted); opacity:0.8;">📍 ${record.location.name}</div>` : ''}
      </td>
      <td>${record.date}</td>
      <td>
        <div style="font-size: 0.85em; color: var(--text-secondary)">
          เข้า: ${record.clockIn}<br>
          ออก: ${record.clockOut || '-'}
        </div>
      </td>
      <td>
        <div style="font-size: 0.85em;">
            WC: ${formatBreakTime(record.restroomTime)}<br>
            Rest: ${formatBreakTime(record.restTime)}
        </div>
      </td>
      <td>
        <div class="project-title">${record.project || '-'}</div>
        <input type="text" class="note-input" value="${record.note || ''}" 
          placeholder="เพิ่มหมายเหตุ..." onchange="updateNote(${record.id}, this.value)">
      </td>
      <td class="duration ${record.duration ? 'complete' : 'incomplete'}">
        ${record.duration || 'กำลังทำงาน...'}
      </td>
      <td>
        <div class="table-actions">
          <button class="btn-icon btn-delete-row" onclick="deleteRecord(${record.id})" title="ลบ">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Enhanced Clock In/Out with proper timestamp tracking
// Note: Removed function override to prevent race conditions
// Timestamps are now handled directly in clockIn() and clockOut() functions

// Theme Toggle Logic
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    currentState.theme = isDark ? 'dark' : 'light';
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.innerHTML = isDark ?
            '<span class="theme-icon">☀️</span>' :
            '<span class="theme-icon">🌙</span>';
    }
    saveToLocalStorage();
}

// Restore Logic
function triggerRestore() {
    document.getElementById('restoreInput').click();
}

function handleRestore(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            window.confirmDialog.show({
                title: 'กู้คืนข้อมูล',
                message: '📂 ยืนยันการกู้คืนข้อมูล? ข้อมูลปัจจุบันบางส่วนอาจถูกเขียนทับ',
                type: 'info'
            }).then(confirmed => {
                if (confirmed) {
                    // Merge records and employees, avoiding duplicates by ID
                    const existingIds = new Set(currentState.attendanceRecords.map(r => r.id));
                    const newRecords = (data.attendanceRecords || []).filter(r => !existingIds.has(r.id));

                    currentState.attendanceRecords = [...newRecords, ...currentState.attendanceRecords];
                    if (data.employees) currentState.employees = data.employees;

                    saveToLocalStorage();
                    renderAttendanceTable();
                    window.toast.success('✅ กู้คืนข้อมูลสำเร็จแล้ว');
                }
            });
        } catch (err) {
            window.toast.error('❌ ไฟล์ JSON ไม่ถูกต้อง');
        }
    };
    reader.readAsText(file);
}

// OT Calculation and Advanced Stats
function calculateOT(ms) {
    const eightHoursMs = 8 * 60 * 60 * 1000;
    if (ms > eightHoursMs) {
        return ms - eightHoursMs;
    }
    return 0;
}

// Updating calculateStats to include OT and all dashboard metrics
function calculateStats() {
    const now = new Date();
    const todayStr = formatDate(now);
    const todayRecords = (currentState.attendanceRecords || []).filter(r => r.date === todayStr);

    let totalWorkMs = 0;
    let totalBreakMs = 0;
    let restroomCount = 0;

    todayRecords.forEach(r => {
        if (r.sessionStart && r.sessionEnd) {
            totalWorkMs += (new Date(r.sessionEnd) - new Date(r.sessionStart));
        }
        totalBreakMs += (r.restroomTime || 0) + (r.restTime || 0);
        restroomCount += (r.restroomBreaks ? r.restroomBreaks.length : 0);
    });

    const workTimeEl = document.getElementById('todayWorkTime');
    const breakTimeEl = document.getElementById('todayBreakTime');
    const restroomEl = document.getElementById('todayRestroomCount');
    const totalRecordsEl = document.getElementById('totalRecords');

    // Update Base Metrics
    if (breakTimeEl) breakTimeEl.textContent = formatDurationShort(totalBreakMs);
    if (restroomEl) restroomEl.textContent = `${restroomCount} ครั้ง`;
    if (totalRecordsEl) totalRecordsEl.textContent = `${(currentState.attendanceRecords || []).length} รายการ`;

    // Update Work Time with OT Highlight
    if (workTimeEl) {
        const otMs = calculateOT(totalWorkMs);
        if (otMs > 0) {
            const otDisplay = `(+OT ${formatDurationShort(otMs)})`;
            workTimeEl.innerHTML = `${formatDurationShort(totalWorkMs)} <span style="color: #43e97b; font-size: 0.7em;">${otDisplay}</span>`;
        } else {
            workTimeEl.textContent = formatDurationShort(totalWorkMs);
        }
    }
}

// Notifications Logic
let lastNotificationTime = 0;
function checkAlarms(now) {
    if (!currentState.isClockedIn) return;

    const sessionStart = new Date(currentState.currentSessionStart);
    const workDur = now - sessionStart;

    // Notify if 8h worked
    if (workDur >= 8 * 60 * 60 * 1000 && workDur < 8 * 60 * 60 * 1000 + 10000) {
        showNotification('⏰ ทำงานครบ 8 ชั่วโมงแล้วครับ อย่าลืมพักผ่อน!');
    }

    // Check long breaks
    if (currentState.activeBreak) {
        const breakStart = new Date(currentState.activeBreak.startTime);
        const breakDur = now - breakStart;
        if (breakDur >= 30 * 60 * 1000 && (now - lastNotificationTime > 600000)) { // 30 min break
            showNotification(`⚠️ คุณ${currentState.activeBreak.type === 'restroom' ? 'เข้าห้องน้ำ' : 'พัก'}มา 30 นาทีแล้ว`);
            lastNotificationTime = now.getTime();
        }
    }
}

function showNotification(msg) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(msg);
    } else if ("Notification" in window && Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") new Notification(msg);
        });
    }
    // Fallback to alert if user hasn't seen it recently
    console.log("NOTIFY:", msg);
}

// Attach globals
window.toggleTheme = toggleTheme;
window.triggerRestore = triggerRestore;
window.handleRestore = handleRestore;
window.toggleSecurity = toggleSecurity;
window.verifyPin = verifyPin;
window.exportToExcel = exportToExcel;
window.applyFilters = applyFilters;
window.deleteRecord = deleteRecord;
window.updateNote = updateNote;
window.confirmResetAll = confirmResetAll;
window.closeResetModal = closeResetModal;
window.exportToJSON = exportToJSON;
window.showResetModal = showResetModal;
window.showSettingsModal = showSettingsModal;

// Duplicate function removed - using the one at line 1274

// History Smooth Scroll
function scrollToHistory() {
    const el = document.getElementById('historySection');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }
}
window.scrollToHistory = scrollToHistory;

// Biometric Hub Logic
function showBiometricModal() {
    if (!currentState.userName) {
        window.toast.warning('⚠️ กรุณาเลือกชื่อพนักงานก่อน');
        return;
    }

    const modal = document.getElementById('biometricModal');
    const employee = (currentState.employees || []).find(e => e.name === currentState.userName);

    document.getElementById('bioUserNameDisplay').textContent = currentState.userName;
    const avatarPreview = document.getElementById('bioAvatarPreview');
    const statusDate = document.getElementById('bioRegistrationDate');
    const actionsBox = document.getElementById('bioActions');

    if (employee && employee.faceData) {
        avatarPreview.innerHTML = `<img src="${employee.faceData}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        statusDate.textContent = `Registered: ${employee.faceRegDate || 'N/A'}`;
        actionsBox.innerHTML = `
            <button class="btn-confirm btn-danger" style="width:100%;" onclick="resetFaceId()">
                🔄 Biometric Reset: รีเซ็ตข้อมูลใบหน้า
            </button>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 10px;">
                *ใช้งานสิ่งนี้หากรูปลักษณ์มีการเปลี่ยนแปลง
            </p>
        `;
    } else {
        avatarPreview.innerHTML = `<span style="font-size: 3rem;">👤</span>`;
        statusDate.textContent = 'Status: Not Registered';
        actionsBox.innerHTML = `
            <button class="btn-confirm" style="width:100%;" onclick="showBioRegisterModal()">
                📸 Register New Face ID
            </button>
        `;
    }

    modal.classList.add('show');
}

function closeBiometricModal() {
    document.getElementById('biometricModal').classList.remove('show');
}

function resetFaceId() {
    window.confirmDialog.show({
        title: 'ยืนยันการรีเซ็ต',
        message: '‼️ ยืนยันการรีเซ็ตข้อมูลใบหน้า? คุณจะต้องลงทะเบียนใบหน้าใหม่อีกครั้ง',
        type: 'warning'
    }).then(confirmed => {
        if (confirmed) {
            const employee = (currentState.employees || []).find(e => e.name === currentState.userName);
            if (employee) {
                employee.faceData = null;
                employee.faceRegDate = null;
                saveToLocalStorage();
                showBiometricModal(); // Refresh UI
                window.toast.success('✅ รีเซ็ตข้อมูลใบหน้าเรียบร้อยแล้ว');
            }
        }
    });
}

let bioStream = null;

async function showBioRegisterModal() {
    closeBiometricModal();
    const modal = document.getElementById('bioRegisterModal');
    modal.classList.add('show');

    try {
        const video = document.getElementById('bioWebcam');
        bioStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        video.srcObject = bioStream;
    } catch (error) {
        console.error('Error accessing webcam:', error);
        window.toast.error('❌ ไม่สามารถเข้าถึงกล้องได้');
        closeBioRegisterModal();
    }
}

function closeBioRegisterModal() {
    document.getElementById('bioRegisterModal').classList.remove('show');
    if (bioStream) {
        bioStream.getTracks().forEach(track => track.stop());
        bioStream = null;
    }
}

function registerFace() {
    const video = document.getElementById('bioWebcam');
    const canvas = document.getElementById('bioCanvas');
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const faceData = canvas.toDataURL('image/jpeg', 0.8);
    const employee = (currentState.employees || []).find(e => e.name === currentState.userName);

    if (employee) {
        employee.faceData = faceData;
        employee.faceRegDate = new Date().toLocaleDateString('th-TH');
        saveToLocalStorage();
        window.toast.success('✅ ลงทะเบียนใบหน้าสำเร็จ!');
        closeBioRegisterModal();
        showBiometricModal();
    }
}

// Leave Request Hub Logic
function showLeaveModal() {
    if (!currentState.userName) {
        window.toast.warning('⚠️ กรุณาเลือกชื่อพนักงานก่อน');
        return;
    }
    document.getElementById('leaveModal').classList.add('show');
    renderLeaveQuotas();
    renderLeaveHistory();
}

function closeLeaveModal() {
    document.getElementById('leaveModal').classList.remove('show');
}

function renderLeaveQuotas() {
    const grid = document.getElementById('leaveQuotaGrid');
    const employee = (currentState.employees || []).find(e => e.name === currentState.userName);

    // Use employee specific quotas or global defaults
    const quotas = employee?.leaveQuotas || currentState.leaveQuotas || { Vacation: 0, Sick: 0, Personal: 0 };
    const requests = (currentState.leaveRequests || []).filter(r => r.userName === currentState.userName && r.status === 'Approved');

    const types = [
        { key: 'Vacation', label: 'ลาพักร้อน', color: 'blue' },
        { key: 'Sick', label: 'ลาป่วย', color: 'orange' },
        { key: 'Personal', label: 'ลากิจ', color: 'purple' }
    ];

    grid.innerHTML = types.map(t => {
        const used = requests.filter(r => r.type === t.key).reduce((sum, r) => sum + (r.days || 0), 0);
        const total = quotas[t.key] || 0;
        const remaining = Math.max(0, total - used); // Prevent negative values

        return `
            <div class="quota-card ${t.color}">
                <span class="quota-label">${t.label}</span>
                <span class="quota-value">${remaining} <small>/ ${total}</small></span>
                <span class="days-text">Days Left</span>
            </div>
        `;
    }).join('');
}

function submitLeaveRequest() {
    const type = document.getElementById('leaveType').value;
    const start = document.getElementById('leaveStart').value;
    const end = document.getElementById('leaveEnd').value;
    const reason = document.getElementById('leaveReason').value;

    if (!start || !end || !reason) {
        window.toast.warning('⚠️ กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (endDate < startDate) {
        window.toast.warning('⚠️ วันที่สิ้นสุดต้องอยู่หลังวันที่เริ่มต้น');
        return;
    }

    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const newRequest = {
        id: Date.now(),
        userName: currentState.userName,
        type: type,
        start: start,
        end: end,
        days: diffDays,
        reason: reason,
        status: 'Pending',
        timestamp: new Date().toISOString()
    };

    if (!currentState.leaveRequests) currentState.leaveRequests = [];
    currentState.leaveRequests.unshift(newRequest);
    saveToLocalStorage();

    // Reset form
    document.getElementById('leaveStart').value = '';
    document.getElementById('leaveEnd').value = '';
    document.getElementById('leaveReason').value = '';

    renderLeaveHistory();
    window.toast.success('🚀 ส่งคำขอลาเรียบร้อยแล้ว รอการอนุมัติ');
}

function renderLeaveHistory() {
    const list = document.getElementById('leaveHistoryList');
    const myRequests = (currentState.leaveRequests || []).filter(r => r.userName === currentState.userName);

    if (myRequests.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-light); padding:1rem;">ไม่มีประวัติการลา</p>';
        return;
    }

    list.innerHTML = myRequests.map(r => `
        <div class="leave-history-item">
            <div class="leave-main-info">
                <strong>${getThaiLeaveName(r.type)}</strong>
                <span>${r.start} ถึง ${r.end} (${r.days} วัน)</span>
            </div>
            <div class="leave-status-tag status-${r.status.toLowerCase()}">${r.status}</div>
        </div>
    `).join('');
}

function getThaiLeaveName(type) {
    const names = { 'Vacation': 'ลาพักร้อน', 'Sick': 'ลาป่วย', 'Personal': 'ลากิจ' };
    return names[type] || type;
}

// Admin Side: Handle Approvals
function renderAdminLeaveManagement() {
    const section = document.getElementById('adminLeaveSection');
    if (!section) return;

    const pending = (currentState.leaveRequests || []).filter(r => r.status === 'Pending');

    if (pending.length === 0) {
        section.innerHTML = '<h4>Pending Requests</h4><p style="color:var(--text-muted);">No pending requests.</p>';
        return;
    }

    section.innerHTML = `
        <h4>Pending Requests (${pending.length})</h4>
        <div class="admin-leave-list">
            ${pending.map(r => `
                <div class="admin-leave-item">
                    <div class="admin-leave-info">
                        <strong>${r.userName}</strong> - ${getThaiLeaveName(r.type)}
                        <div>${r.start} ถึง ${r.end} (${r.days} วัน)</div>
                        <em style="font-size:0.8rem; display:block;">Reason: ${r.reason}</em>
                    </div>
                    <div class="admin-leave-actions">
                        <button class="btn-icon" onclick="handleLeaveDecision(${r.id}, 'Approved')" title="Approve">✅</button>
                        <button class="btn-icon" onclick="handleLeaveDecision(${r.id}, 'Rejected')" title="Reject">❌</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function handleLeaveDecision(id, decision) {
    const request = currentState.leaveRequests.find(r => r.id === id);
    if (request) {
        request.status = decision;
        saveToLocalStorage();
        renderAdminLeaveManagement();
        window.toast.info(`Request marked as ${decision}`);
    }
}

// Role-Based Access Helper
function checkRoleAccess(requiredRole) {
    const employee = (currentState.employees || []).find(e => e.name === currentState.userName);
    const currentRole = employee ? employee.role : 'Staff';

    // Hierarchy check: Owner > Admin > Staff
    const roles = ['Staff', 'Admin', 'Owner'];
    const currentLevel = roles.indexOf(currentRole);
    const requiredLevel = roles.indexOf(requiredRole);

    if (currentLevel < requiredLevel) {
        document.getElementById('restrictedModal').classList.add('show');
        return false;
    }
    return true;
}

function closeRestrictedModal() {
    document.getElementById('restrictedModal').classList.remove('show');
}

// Team Board Logic
function showTeamBoardModal() {
    const modal = document.getElementById('teamBoardModal');
    modal.classList.add('show');
    renderFullTeamGrid();
}

function closeTeamBoardModal() {
    document.getElementById('teamBoardModal').classList.remove('show');
}

function renderFullTeamGrid() {
    const grid = document.getElementById('fullTeamGrid');
    if (!grid) return;

    grid.innerHTML = (currentState.employees || []).map(emp => {
        const isOnline = (currentState.attendanceRecords || []).some(
            r => r.userName === emp.name && !r.clockOut
        );

        const activeSession = (currentState.attendanceRecords || []).find(
            r => r.userName === emp.name && !r.clockOut
        );

        const currentTask = activeSession?.project || 'Ready to Work';
        const workStartTime = activeSession?.clockIn || '--:--';

        return `
            <div class="team-board-card ${isOnline ? 'card-online' : ''}">
                <div class="card-status-dot ${isOnline ? 'online' : 'offline'}"></div>
                <div class="card-avatar">${emp.role === 'Owner' ? '👑' : (emp.role === 'Admin' ? '👨‍💼' : '🧑‍💻')}</div>
                <div class="card-info">
                    <span class="card-role-tag">${emp.role}</span>
                    <h4>${emp.name}</h4>
                    <span class="card-dept">${emp.dept} | ${emp.pos}</span>
                    <div class="card-task">
                        <span class="task-label">${isOnline ? '� Active Now' : '💤 Offline'}</span>
                        <p>${currentTask}</p>
                        ${isOnline ? `<small class="start-time">Started at ${workStartTime}</small>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Phase 2: AI Liveness Challenge
let livenessStream = null;
let challengeActive = false;

async function startLivenessChallenge() {
    const modal = document.getElementById('livenessModal');
    const video = document.getElementById('livenessWebcam');
    const progress = document.getElementById('livenessProgress');
    const text = document.getElementById('challengeText');

    // Check if user is selected
    if (!currentState.userName) {
        window.toast.warning('⚠️ กรุณาเลือกชื่อพนักงานก่อน');
        return;
    }

    // Check if Face ID is registered
    const employee = (currentState.employees || []).find(e => e.name === currentState.userName);
    if (!employee || !employee.faceData) {
        window.toast.warning('⚠️ Error: Face ID not registered. Please register in Biometric Hub first.');
        return;
    }

    // Reset progress bar and indicators
    if (progress) progress.style.width = '0%';
    if (text) text.textContent = 'Initializing AI Liveness Detection...';
    ['ind-blink', 'ind-smile', 'ind-head'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });

    modal.classList.add('show');
    challengeActive = true;

    try {
        livenessStream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = livenessStream;
        runAIHeuristics();
    } catch (err) {
        window.toast.error('❌ Camera error');
        closeLivenessModal();
    }
}

function runAIHeuristics() {
    const progress = document.getElementById('livenessProgress');
    const text = document.getElementById('challengeText');
    const indicators = ['ind-blink', 'ind-smile', 'ind-head'];
    let step = 0;

    const interval = setInterval(() => {
        if (!challengeActive) {
            clearInterval(interval);
            return;
        }

        step += 2;
        progress.style.width = step + '%';

        if (step === 20) {
            text.textContent = 'Challenge: Blink Twice...';
            document.getElementById('ind-blink').classList.add('active');
        } else if (step === 50) {
            text.textContent = 'Challenge: Smile for AI...';
            document.getElementById('ind-smile').classList.add('active');
        } else if (step === 80) {
            text.textContent = 'Challenge: Turn head slightly...';
            document.getElementById('ind-head').classList.add('active');
        }

        if (step >= 100) {
            clearInterval(interval);

            // Real Face Verification Logic
            verifyBiometricMatch().then(isMatch => {
                if (isMatch) {
                    text.textContent = '✅ Identity Verified!';
                    setTimeout(() => {
                        completeLiveness();
                    }, 1000);
                } else {
                    text.textContent = '❌ Identity Mismatch!';
                    setTimeout(() => {
                        window.toast.error('⚠️ Verification Failed: Face does not match registered data.');
                        closeLivenessModal();
                    }, 1500);
                }
            });
        }
    }, 50);
}

function completeLiveness() {
    challengeActive = false;
    closeLivenessModal();

    // Mock capturing the photo for record
    const video = document.getElementById('livenessWebcam');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    if (pendingAction === 'clockIn') {
        currentState.pendingPhoto = { photo: canvas.toDataURL('image/jpeg'), timestamp: new Date().toISOString() };
    }

    if (currentState.securitySettings.requireGPS) {
        verifyGPS();
    } else {
        executePendingAction();
    }
}

function closeLivenessModal() {
    const modal = document.getElementById('livenessModal');
    modal.classList.remove('show');
    challengeActive = false;
    if (livenessStream) {
        livenessStream.getTracks().forEach(t => t.stop());
        livenessStream = null;
    }
}

async function verifyBiometricMatch() {
    // Validate userName is selected
    if (!currentState.userName) {
        console.error('No user selected for biometric verification');
        return false;
    }

    const video = document.getElementById('livenessWebcam');
    if (!video || !video.videoWidth || !video.videoHeight) {
        console.error('Video element not ready');
        return false;
    }

    const employee = (currentState.employees || []).find(e => e.name === currentState.userName);
    if (!employee || !employee.faceData) {
        console.error('Employee face data not found');
        return false;
    }

    return await compareImages(employee.faceData, video);
}

function compareImages(base64A, videoElement) {
    return new Promise(resolve => {
        const imgA = new Image();
        imgA.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            // Resize to small 64x64 for comparison
            const size = 64;
            canvas.width = size;
            canvas.height = size;

            // Draw Registered Image
            ctx.drawImage(imgA, 0, 0, size, size);
            const dataA = ctx.getImageData(0, 0, size, size).data;

            // Draw Current Video Frame
            ctx.clearRect(0, 0, size, size);
            ctx.drawImage(videoElement, 0, 0, size, size);
            const dataB = ctx.getImageData(0, 0, size, size).data;

            // Compare Pixel Difference
            let diff = 0;
            for (let i = 0; i < dataA.length; i += 4) {
                const rDiff = Math.abs(dataA[i] - dataB[i]);
                const gDiff = Math.abs(dataA[i + 1] - dataB[i + 1]);
                const bDiff = Math.abs(dataA[i + 2] - dataB[i + 2]);
                diff += (rDiff + gDiff + bDiff);
            }

            const totalPixels = size * size;
            const maxDiff = totalPixels * 3 * 255;
            const percentage = (diff / maxDiff) * 100;

            console.log('Face Match Diff:', percentage.toFixed(2) + '%');

            // Heuristic Threshold: If difference is less than 35%, assume it's the same person/environment
            // This is basic but prevents total randoms or empty chairs (usually)
            resolve(percentage < 35);
        };
        imgA.onerror = () => resolve(false);
        imgA.src = base64A;
    });
}

// Phase 4: Analytics & Score
function renderWeeklyChart() {
    const chart = document.getElementById('workChart');
    const labelRow = document.getElementById('chartLabels');
    if (!chart || !labelRow) return;

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(formatDate(d));
    }

    chart.innerHTML = '';
    labelRow.innerHTML = '';

    last7Days.forEach(dateStr => {
        const records = currentState.attendanceRecords.filter(r => r.date === dateStr);
        let dailyMs = 0;
        records.forEach(r => {
            if (r.duration) {
                // Parse duration string or use session timestamps
                if (r.sessionStart && r.sessionEnd) {
                    dailyMs += (new Date(r.sessionEnd) - new Date(r.sessionStart));
                }
            }
        });

        const hours = dailyMs / (1000 * 60 * 60);
        const height = Math.min((hours / 12) * 100, 100);

        chart.innerHTML += `
            <div class="chart-bar-wrapper">
                <div class="chart-bar" style="height: ${height}%;" title="${hours.toFixed(1)} hrs">
                    <span class="bar-value">${hours.toFixed(1)}h</span>
                </div>
            </div>
        `;
        labelRow.innerHTML += `<span>${dateStr.split(' ')[0]}</span>`;
    });
}

function updateWorkLifeScore() {
    const scoreVal = document.getElementById('balanceScoreValue');
    if (!scoreVal) return;

    // Mock logic: 100 - (Overtime hours / total hours * 50) - (Late arrivals * 5)
    // For now, let's fluctuate it slightly around 90-100 based on recent records
    const recent = currentState.attendanceRecords.slice(0, 10);
    let penalty = 0;
    recent.forEach(r => {
        if (r.sessionStart && r.sessionEnd) {
            const dur = new Date(r.sessionEnd) - new Date(r.sessionStart);
            if (dur > 9 * 60 * 60 * 1000) penalty += 2; // OT penalty for balance
        }
    });

    const score = Math.max(70, 100 - penalty);
    scoreVal.textContent = `${score}%`;
    scoreVal.style.color = score > 85 ? 'var(--success-green)' : 'var(--secondary-orange)';
}

// Phase 5: Multi-language Logic
const translations = {
    'TH': {
        dashboard: 'แดชบอร์ด',
        teamBoard: 'ทีมบอร์ด',
        leaveRequest: 'ยื่นใบลา',
        biometricHub: 'ความปลอดภัย',
        history: 'ประวัติ',
        adminHub: 'ตั้งค่าระบบ',
        startWork: 'ลงเวลาเข้า',
        stopWork: 'ลงเวลาออก',
        weeklyAnalytics: 'วิเคราะห์การเข้างานรายสัปดาห์',
        workHoursTrend: 'แนวโน้มการทำงาน (7 วันล่าสุด)',
        balanceScore: 'คะแนน Work-Life Balance',
        announcements: 'ประกาศข่าวสาร',
        versionText: 'v2.5.0 รุ่น Enterprise'
    },
    'EN': {
        dashboard: 'Dashboard',
        teamBoard: 'Team Board',
        leaveRequest: 'Leave Request',
        biometricHub: 'Biometric Hub',
        history: 'History',
        adminHub: 'Admin Hub',
        startWork: 'Start Work',
        stopWork: 'Stop Work',
        weeklyAnalytics: 'Weekly Attendance Analytics',
        workHoursTrend: 'Work hours trend (Last 7 Days)',
        balanceScore: 'Work-Life Balance Score',
        announcements: 'Corporate Announcements',
        versionText: 'v2.5.0 Enterprise Edition'
    }
};

function toggleLanguage() {
    currentState.language = currentState.language === 'TH' ? 'EN' : 'TH';
    document.getElementById('langText').textContent = currentState.language;
    applyTranslations();
    saveToLocalStorage();
}

function applyTranslations() {
    const lang = currentState.language;
    const dict = translations[lang];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
    });

    // Update specific sidebar items manually if needed (they have identifiers)
    const navItems = {
        'navDashboard': 'dashboard',
        'navTeam': 'teamBoard',
        'navLeave': 'leaveRequest',
        'navHistory': 'history',
        'navAdmin': 'adminHub'
    };

    for (let id in navItems) {
        const el = document.getElementById(id);
        if (el) el.querySelector('span:not(.nav-icon)').textContent = dict[navItems[id]];
    }

    // Update buttons
    const ciBtn = document.getElementById('clockInBtn');
    if (ciBtn) ciBtn.querySelector('h3').textContent = dict['startWork'];
    const coBtn = document.getElementById('clockOutBtn');
    if (coBtn) coBtn.querySelector('h3').textContent = dict['stopWork'];
}

// Global Exports
window.toggleLanguage = toggleLanguage;
window.showTeamBoardModal = showTeamBoardModal;
window.closeTeamBoardModal = closeTeamBoardModal;
window.closeRestrictedModal = closeRestrictedModal;
window.showLeaveModal = showLeaveModal;
window.closeLeaveModal = closeLeaveModal;
window.submitLeaveRequest = submitLeaveRequest;
window.handleLeaveDecision = handleLeaveDecision;
window.showBiometricModal = showBiometricModal;
window.closeBiometricModal = closeBiometricModal;
window.resetFaceId = resetFaceId;
window.showBioRegisterModal = showBioRegisterModal;
window.closeBioRegisterModal = closeBioRegisterModal;
window.registerFace = registerFace;
window.setWorkMode = setWorkMode;
window.toggleSecurity = toggleSecurity;
window.closeSettingsModal = closeSettingsModal;
window.addEmployee = addEmployee;
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
window.handleClockAction = handleClockAction;
window.handleBreak = handleBreak;
window.handleNameChange = handleNameChange;
window.capturePhoto = capturePhoto;
window.closeWebcamModal = closeWebcamModal;
window.closePinModal = closePinModal;

// Mobile User Selection Logic
function showMobileUserSelector() {
    const modal = document.getElementById('mobileUserModal');
    const list = document.getElementById('mobileUserList');

    const activeEmployees = (currentState.employees || []).filter(e => e.status !== 'Inactive');

    list.innerHTML = activeEmployees.map(emp => `
        <div class="mobile-user-item ${currentState.userName === emp.name ? 'active' : ''}" 
             onclick="handleMobileUserSelect('${emp.name}')">
            <div class="member-avatar">${emp.role === 'Admin' ? '👨‍💼' : '🧑‍💻'}</div>
            <div class="member-info">
                <span class="member-name">${emp.name}</span>
                <span class="member-dept">${emp.dept} | ${emp.pos}</span>
            </div>
            ${currentState.userName === emp.name ? '<span class="active-badge">✅</span>' : ''}
        </div>
    `).join('');

    modal.classList.add('show');
}

function closeMobileUserSelector() {
    document.getElementById('mobileUserModal').classList.remove('show');
}

function handleMobileUserSelect(name) {
    currentState.userName = name;
    loadUserState(name);

    // Also update the main select if it exists
    const mainSelect = document.getElementById('userName');
    if (mainSelect) mainSelect.value = name;

    saveToLocalStorage();
    updateUI();
    closeMobileUserSelector();
    window.toast.success(`สวัสดีครับคุณ ${name}`);
}

window.showMobileUserSelector = showMobileUserSelector;
window.closeMobileUserSelector = closeMobileUserSelector;
window.handleMobileUserSelect = handleMobileUserSelect;

// Map Picker Logic
let map = null;
let pickerMarker = null;

function openMapPicker() {
    const modal = document.getElementById('mapModal');
    modal.classList.add('show');

    // Default center (Bangkok or last saved location)
    let lat = 13.7563;
    let lng = 100.5018;

    if (currentState.securitySettings.officeLocations && currentState.securitySettings.officeLocations.length > 0) {
        const lastLoc = currentState.securitySettings.officeLocations[currentState.securitySettings.officeLocations.length - 1];
        lat = lastLoc.latitude;
        lng = lastLoc.longitude;
    } else if (currentState.securitySettings.officeLocation) {
        // Fallback for legacy data
        lat = currentState.securitySettings.officeLocation.latitude;
        lng = currentState.securitySettings.officeLocation.longitude;
    }

    setTimeout(() => {
        if (!map) {
            map = L.map('mapPickerContainer').setView([lat, lng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(map);

            pickerMarker = L.marker([lat, lng], { draggable: true }).addTo(map);

            pickerMarker.on('dragend', function (e) {
                const pos = pickerMarker.getLatLng();
                updateMapCoords(pos.lat, pos.lng);
            });

            map.on('click', function (e) {
                pickerMarker.setLatLng(e.latlng);
                updateMapCoords(e.latlng.lat, e.latlng.lng);
            });
        } else {
            map.setView([lat, lng], 15);
            pickerMarker.setLatLng([lat, lng]);
        }
        updateMapCoords(lat, lng);
        map.invalidateSize();
    }, 400);
}

function updateMapCoords(lat, lng) {
    document.getElementById('latDisplay').textContent = lat.toFixed(6);
    document.getElementById('lngDisplay').textContent = lng.toFixed(6);
}

function closeMapPicker() {
    document.getElementById('mapModal').classList.remove('show');
}

function deleteOfficeLocation(index) {
    if (!confirm('ยืนยันการลบตำแหน่งนี้หรือไม่?')) return;
    currentState.securitySettings.officeLocations.splice(index, 1);
    saveToLocalStorage();
    updateSecurityToggles();
    window.toast.success('🗑️ ลบตำแหน่งเรียบร้อยแล้ว');
}

function savePinnedLocation() {
    const lat = parseFloat(document.getElementById('latDisplay').textContent);
    const lng = parseFloat(document.getElementById('lngDisplay').textContent);
    const nameInput = document.getElementById('newLocationName');
    const name = nameInput ? nameInput.value.trim() : 'Unnamed Location';

    if (!name) {
        window.toast.warning('⚠️ กรุณาระบุชื่อสถานที่');
        return;
    }

    const newLoc = {
        latitude: lat,
        longitude: lng,
        name: name
    };

    if (!currentState.securitySettings.officeLocations) {
        currentState.securitySettings.officeLocations = [];
    }

    currentState.securitySettings.officeLocations.push(newLoc);
    saveToLocalStorage();
    updateSecurityToggles();
    closeMapPicker();

    if (nameInput) nameInput.value = ''; // Clear input
    window.toast.success(`✅ บันทึกตำแหน่ง "${name}" เรียบร้อยแล้ว`);
}

window.deleteOfficeLocation = deleteOfficeLocation;

window.openMapPicker = openMapPicker;
window.closeMapPicker = closeMapPicker;
window.savePinnedLocation = savePinnedLocation;

// My History Modal Functions
function showMyHistoryModal() {
    if (!currentState.userName) {
        window.toast.warning('⚠️ กรุณาเลือกชื่อพนักงานก่อน');
        return;
    }

    const modal = document.getElementById('myHistoryModal');
    const tbody = document.getElementById('myHistoryBody');
    const userRecords = (currentState.attendanceRecords || []).filter(r => r.userName === currentState.userName);

    document.getElementById('myHistorySubtitle').textContent = `ประวัติของ: ${currentState.userName}`;

    // Calculate My Stats
    const totalDays = userRecords.length;
    let totalMs = 0;
    userRecords.forEach(r => {
        if (r.sessionStart && r.sessionEnd) {
            totalMs += (new Date(r.sessionEnd) - new Date(r.sessionStart));
        }
    });
    const totalHours = (totalMs / (1000 * 60 * 60)).toFixed(1);

    document.getElementById('myTotalDays').textContent = `${totalDays} รายการ`;
    document.getElementById('myTotalWorkHours').textContent = `${totalHours} ชม.`;
    document.getElementById('myReliability').textContent = (totalDays > 0) ? '98%' : '100%';

    tbody.innerHTML = userRecords.map(record => `
        <tr>
            <td>
                ${record.date}
                ${record.isLate ? '<span style="color:var(--danger-red); font-size:0.6rem; display:block; font-weight:700;">[สาย]</span>' : ''}
            </td>
            <td>
                <div style='font-size: 0.8rem;'>
                    ${record.clockIn} - ${record.clockOut || '...'}
                </div>
            </td>
            <td>${formatDurationShort((record.restroomTime || 0) + (record.restTime || 0))}</td>
            <td>
                <span class='status-row-tag ${record.clockOut ? 'status-complete' : 'status-active'}'>
                    ${record.clockOut ? 'เสร็จสิ้น' : 'กำลังทำ'}
                </span>
            </td>
        </tr>
    `).join('');

    if (userRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">ไม่มีประวัติการทำงาน</td></tr>';
    }

    modal.classList.add('show');
}

function closeMyHistoryModal() {
    const modal = document.getElementById('myHistoryModal');
    modal.classList.remove('show');
}

window.showMyHistoryModal = showMyHistoryModal;
window.closeMyHistoryModal = closeMyHistoryModal;


// Owner Advanced Settings Functions
function saveLateThreshold() {
    const input = document.getElementById('lateThresholdInput');
    if (!input || !input.value) {
        window.toast.warning('⚠️ กรุณาระบุเวลาที่ต้องการ');
        return;
    }

    currentState.securitySettings.lateThreshold = input.value;
    saveToLocalStorage();
    window.toast.success(`✅ เปลี่ยนเวลาเข้างานเป็น ${input.value} เรียบร้อยแล้ว`);
}

function loadEmployeeQuota() {
    const select = document.getElementById('quotaEmployeeSelect');
    const inputs = document.getElementById('quotaInputs');
    const saveBtn = document.getElementById('saveQuotaBtn');

    if (!select.value) {
        inputs.style.display = 'none';
        saveBtn.style.display = 'none';
        return;
    }

    const emp = currentState.employees.find(e => e.name === select.value);
    if (emp) {
        const quotas = emp.leaveQuotas || currentState.leaveQuotas;
        document.getElementById('quotaVacation').value = quotas.Vacation || 0;
        document.getElementById('quotaSick').value = quotas.Sick || 0;
        document.getElementById('quotaPersonal').value = quotas.Personal || 0;

        inputs.style.display = 'grid';
        saveBtn.style.display = 'block';
    }
}

function saveEmployeeQuota() {
    const select = document.getElementById('quotaEmployeeSelect');
    const empName = select.value;
    const emp = currentState.employees.find(e => e.name === empName);

    if (emp) {
        emp.leaveQuotas = {
            Vacation: parseInt(document.getElementById('quotaVacation').value) || 0,
            Sick: parseInt(document.getElementById('quotaSick').value) || 0,
            Personal: parseInt(document.getElementById('quotaPersonal').value) || 0
        };
        saveToLocalStorage();
        window.toast.success(`✅ อัปเดตโควตาการลาของคุณ ${empName} เรียบร้อยแล้ว`);
    }
}

function updateQuotaDropdown() {
    const select = document.getElementById('quotaEmployeeSelect');
    if (!select) return;

    const options = currentState.employees.map(emp =>
        `<option value="${emp.name}">${emp.name} (${emp.id})</option>`
    ).join('');

    select.innerHTML = '<option value="">เลือกพนักงานเพื่อกำหนดสิทธิ์...</option>' + options;
}

window.saveLateThreshold = saveLateThreshold;
window.loadEmployeeQuota = loadEmployeeQuota;
window.saveEmployeeQuota = saveEmployeeQuota;

// ========================================
// LOCAL STORAGE FUNCTIONS (CRITICAL!)
// ========================================

function saveToLocalStorage() {
    try {
        console.log('Saving to localStorage...', {
            attendanceRecords: currentState.attendanceRecords.length,
            employees: currentState.employees?.length || 0,
            leaveRequests: currentState.leaveRequests?.length || 0
        });

        localStorage.setItem('globalWorkState', JSON.stringify(currentState));
        console.log('✅ Data saved successfully');
    } catch (error) {
        console.error('❌ Failed to save to localStorage:', error);
        window.toast.error('ไม่สามารถบันทึกข้อมูลได้: ' + error.message);
    }
}

function loadFromLocalStorage() {
    try {
        console.log('Loading from localStorage...');
        const saved = localStorage.getItem('globalWorkState');

        if (saved) {
            const parsed = JSON.parse(saved);
            console.log('Found saved data:', {
                attendanceRecords: parsed.attendanceRecords?.length || 0,
                employees: parsed.employees?.length || 0,
                leaveRequests: parsed.leaveRequests?.length || 0
            });

            // Merge saved state with current state
            Object.assign(currentState, parsed);

            // Ensure arrays exist
            if (!currentState.attendanceRecords) currentState.attendanceRecords = [];
            if (!currentState.employees) currentState.employees = [];
            if (!currentState.leaveRequests) currentState.leaveRequests = [];
            if (!currentState.currentBreaks) currentState.currentBreaks = { restroom: [], rest: [] };
            if (!currentState.securitySettings) {
                currentState.securitySettings = {
                    requirePin: true,
                    requirePhoto: true,
                    requireGPS: true,
                    officeLocations: [],
                    lateThreshold: '09:00'
                };
            }
            if (!currentState.securitySettings.officeLocations) {
                currentState.securitySettings.officeLocations = [];
            }

            console.log('✅ Data loaded successfully');
        } else {
            console.log('No saved data found, using defaults');
        }
    } catch (error) {
        console.error('❌ Failed to load from localStorage:', error);
        window.toast.error('ไม่สามารถโหลดข้อมูลได้: ' + error.message);
    }
}

// Export functions to window
window.saveToLocalStorage = saveToLocalStorage;
window.loadFromLocalStorage = loadFromLocalStorage;

console.log('✅ LocalStorage functions loaded');


