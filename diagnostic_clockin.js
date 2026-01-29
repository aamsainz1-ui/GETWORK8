// ========================================
// 🧪 DIAGNOSTIC SCRIPT - ตรวจสอบระบบการเข้างาน
// ========================================
// วิธีใช้: Copy script นี้ทั้งหมด แล้ววางใน Console (F12)

console.log('🧪 Starting Clock In/Out System Diagnostic...\n');

// ========================================
// 1. ตรวจสอบฟังก์ชันที่จำเป็น
// ========================================
console.log('📋 Step 1: Checking Required Functions...');

const requiredFunctions = [
    'clockIn',
    'clockOut',
    'saveToLocalStorage',
    'loadFromLocalStorage',
    'renderAttendanceTable',
    'updateUI',
    'formatTime',
    'formatDate',
    'calculateDuration',
    'formatBreakTime'
];

let missingFunctions = [];
requiredFunctions.forEach(funcName => {
    if (typeof window[funcName] === 'function') {
        console.log(`  ✅ ${funcName}() - Found`);
    } else {
        console.error(`  ❌ ${funcName}() - MISSING!`);
        missingFunctions.push(funcName);
    }
});

if (missingFunctions.length > 0) {
    console.error(`\n❌ CRITICAL: Missing ${missingFunctions.length} functions!`);
    console.error('Missing:', missingFunctions.join(', '));
} else {
    console.log('\n✅ All required functions found!\n');
}

// ========================================
// 2. ตรวจสอบ DOM Elements
// ========================================
console.log('📋 Step 2: Checking DOM Elements...');

const requiredElements = [
    'attendanceBody',
    'clockInBtn',
    'clockOutBtn',
    'userName',
    'attendanceTable'
];

let missingElements = [];
requiredElements.forEach(elementId => {
    const element = document.getElementById(elementId);
    if (element) {
        console.log(`  ✅ #${elementId} - Found`);
    } else {
        console.error(`  ❌ #${elementId} - MISSING!`);
        missingElements.push(elementId);
    }
});

if (missingElements.length > 0) {
    console.error(`\n❌ WARNING: Missing ${missingElements.length} DOM elements!`);
    console.error('Missing:', missingElements.join(', '));
} else {
    console.log('\n✅ All required DOM elements found!\n');
}

// ========================================
// 3. ตรวจสอบ currentState
// ========================================
console.log('📋 Step 3: Checking currentState...');

if (typeof currentState === 'undefined') {
    console.error('  ❌ currentState is UNDEFINED!');
} else {
    console.log('  ✅ currentState exists');
    console.log('  📊 Current State:', {
        userName: currentState.userName || '(not selected)',
        isClockedIn: currentState.isClockedIn,
        attendanceRecords: currentState.attendanceRecords?.length || 0,
        employees: currentState.employees?.length || 0
    });
}

// ========================================
// 4. ตรวจสอบ localStorage
// ========================================
console.log('\n📋 Step 4: Checking localStorage...');

try {
    const saved = localStorage.getItem('globalWorkState');
    if (saved) {
        const parsed = JSON.parse(saved);
        console.log('  ✅ localStorage data found');
        console.log('  📊 Saved Data:', {
            attendanceRecords: parsed.attendanceRecords?.length || 0,
            employees: parsed.employees?.length || 0,
            leaveRequests: parsed.leaveRequests?.length || 0
        });
    } else {
        console.warn('  ⚠️ No saved data in localStorage');
    }
} catch (error) {
    console.error('  ❌ Error reading localStorage:', error.message);
}

// ========================================
// 5. ตรวจสอบว่า clockIn() มี Alert Popup
// ========================================
console.log('\n📋 Step 5: Checking clockIn() for Alert Popup...');

try {
    const clockInSource = clockIn.toString();
    if (clockInSource.includes('alert(')) {
        console.log('  ✅ clockIn() has Alert Popup');
    } else {
        console.error('  ❌ clockIn() MISSING Alert Popup!');
    }

    if (clockInSource.includes('saveToLocalStorage()')) {
        console.log('  ✅ clockIn() calls saveToLocalStorage()');
    } else {
        console.error('  ❌ clockIn() MISSING saveToLocalStorage() call!');
    }

    if (clockInSource.includes('renderAttendanceTable()')) {
        console.log('  ✅ clockIn() calls renderAttendanceTable()');
    } else {
        console.error('  ❌ clockIn() MISSING renderAttendanceTable() call!');
    }
} catch (error) {
    console.error('  ❌ Error checking clockIn():', error.message);
}

// ========================================
// 6. ตรวจสอบว่า clockOut() มี Alert Popup
// ========================================
console.log('\n📋 Step 6: Checking clockOut() for Alert Popup...');

try {
    const clockOutSource = clockOut.toString();
    if (clockOutSource.includes('alert(')) {
        console.log('  ✅ clockOut() has Alert Popup');
    } else {
        console.error('  ❌ clockOut() MISSING Alert Popup!');
    }

    if (clockOutSource.includes('saveToLocalStorage()')) {
        console.log('  ✅ clockOut() calls saveToLocalStorage()');
    } else {
        console.error('  ❌ clockOut() MISSING saveToLocalStorage() call!');
    }

    if (clockOutSource.includes('updateUI()')) {
        console.log('  ✅ clockOut() calls updateUI()');
    } else {
        console.error('  ❌ clockOut() MISSING updateUI() call!');
    }

    if (clockOutSource.includes('renderAttendanceTable()')) {
        console.log('  ✅ clockOut() calls renderAttendanceTable()');
    } else {
        console.error('  ❌ clockOut() MISSING renderAttendanceTable() call!');
    }
} catch (error) {
    console.error('  ❌ Error checking clockOut():', error.message);
}

// ========================================
// 7. สรุปผลการตรวจสอบ
// ========================================
console.log('\n' + '='.repeat(50));
console.log('📊 DIAGNOSTIC SUMMARY');
console.log('='.repeat(50));

const totalIssues = missingFunctions.length + missingElements.length;

if (totalIssues === 0) {
    console.log('✅ ALL CHECKS PASSED!');
    console.log('✅ System is ready for testing');
    console.log('\n📝 Next Steps:');
    console.log('  1. Select a user from dropdown');
    console.log('  2. Click "ลงเวลาเข้า" (Clock In)');
    console.log('  3. You should see an Alert Popup');
    console.log('  4. Check the attendance table for new record');
    console.log('  5. Click "ลงเวลาออก" (Clock Out)');
    console.log('  6. You should see another Alert Popup with duration');
} else {
    console.error(`❌ FOUND ${totalIssues} ISSUES!`);
    console.error('Please fix the issues above before testing');
}

console.log('\n' + '='.repeat(50));

// ========================================
// 8. ฟังก์ชันช่วยทดสอบ
// ========================================
console.log('\n🛠️ Helper Functions Available:');
console.log('  - testClockIn()     : Test clock in function');
console.log('  - testClockOut()    : Test clock out function');
console.log('  - viewRecords()     : View all attendance records');
console.log('  - clearData()       : Clear all localStorage data');
console.log('  - checkState()      : View current state');

window.testClockIn = function () {
    console.log('🧪 Testing clockIn()...');
    if (!currentState.userName) {
        console.error('❌ Please select a user first!');
        return;
    }
    console.log('Calling clockIn()...');
    clockIn();
};

window.testClockOut = function () {
    console.log('🧪 Testing clockOut()...');
    if (!currentState.isClockedIn) {
        console.error('❌ User is not clocked in!');
        return;
    }
    console.log('Calling clockOut()...');
    clockOut();
};

window.viewRecords = function () {
    console.log('📊 Attendance Records:');
    console.table(currentState.attendanceRecords);
};

window.clearData = function () {
    if (confirm('⚠️ This will delete ALL data. Are you sure?')) {
        localStorage.clear();
        location.reload();
    }
};

window.checkState = function () {
    console.log('📊 Current State:');
    console.log(currentState);
};

console.log('\n✅ Diagnostic Complete!');
