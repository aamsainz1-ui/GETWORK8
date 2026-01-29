// ========================================
// EMERGENCY DIAGNOSTIC SCRIPT
// Copy ทั้งหมดนี้ใส่ใน Console (F12)
// ========================================

console.log('%c🔍 STARTING DIAGNOSTIC...', 'color: #2563eb; font-size: 16px; font-weight: bold;');
console.log('');

// ========================================
// 1. CHECK FUNCTIONS
// ========================================
console.log('%c1️⃣ CHECKING FUNCTIONS...', 'color: #16a34a; font-weight: bold;');

const functions = {
    'formatDate': typeof formatDate,
    'formatTime': typeof formatTime,
    'formatBreakTime': typeof formatBreakTime,
    'saveToLocalStorage': typeof saveToLocalStorage,
    'loadFromLocalStorage': typeof loadFromLocalStorage,
    'renderAttendanceTable': typeof renderAttendanceTable,
    'clockIn': typeof clockIn,
    'executePendingAction': typeof executePendingAction
};

let missingFunctions = [];
for (const [name, type] of Object.entries(functions)) {
    if (type === 'function') {
        console.log(`  ✅ ${name}: ${type}`);
    } else {
        console.log(`  ❌ ${name}: ${type} (MISSING!)`);
        missingFunctions.push(name);
    }
}

if (missingFunctions.length > 0) {
    console.log('%c⚠️ MISSING FUNCTIONS:', 'color: #dc2626; font-weight: bold;', missingFunctions);
}

console.log('');

// ========================================
// 2. CHECK HTML ELEMENTS
// ========================================
console.log('%c2️⃣ CHECKING HTML ELEMENTS...', 'color: #16a34a; font-weight: bold;');

const elements = {
    'attendanceBody': document.getElementById('attendanceBody'),
    'attendanceTable': document.getElementById('attendanceTable'),
    'emptyState': document.getElementById('emptyState')
};

let missingElements = [];
for (const [name, element] of Object.entries(elements)) {
    if (element) {
        console.log(`  ✅ ${name}: found`);
    } else {
        console.log(`  ❌ ${name}: NOT FOUND!`);
        missingElements.push(name);
    }
}

if (missingElements.length > 0) {
    console.log('%c⚠️ MISSING ELEMENTS:', 'color: #dc2626; font-weight: bold;', missingElements);
}

console.log('');

// ========================================
// 3. CHECK CURRENT STATE
// ========================================
console.log('%c3️⃣ CHECKING CURRENT STATE...', 'color: #16a34a; font-weight: bold;');

console.log('  userName:', currentState.userName || '(empty)');
console.log('  isClockedIn:', currentState.isClockedIn);
console.log('  attendanceRecords:', currentState.attendanceRecords.length, 'records');
console.log('  pendingAction:', pendingAction || '(none)');

console.log('');

// ========================================
// 4. CHECK LOCALSTORAGE
// ========================================
console.log('%c4️⃣ CHECKING LOCALSTORAGE...', 'color: #16a34a; font-weight: bold;');

const saved = localStorage.getItem('globalWorkState');
if (saved) {
    try {
        const parsed = JSON.parse(saved);
        console.log('  ✅ LocalStorage has data');
        console.log('  Saved records:', parsed.attendanceRecords?.length || 0);
        console.log('  Saved employees:', parsed.employees?.length || 0);
    } catch (e) {
        console.log('  ❌ LocalStorage data is corrupted:', e.message);
    }
} else {
    console.log('  ⚠️ LocalStorage is empty');
}

console.log('');

// ========================================
// 5. TEST FUNCTIONS
// ========================================
console.log('%c5️⃣ TESTING FUNCTIONS...', 'color: #16a34a; font-weight: bold;');

if (typeof formatDate === 'function') {
    try {
        const testDate = formatDate(new Date());
        console.log('  ✅ formatDate() works:', testDate);
    } catch (e) {
        console.log('  ❌ formatDate() error:', e.message);
    }
} else {
    console.log('  ⚠️ formatDate() not available');
}

if (typeof formatTime === 'function') {
    try {
        const testTime = formatTime(new Date());
        console.log('  ✅ formatTime() works:', testTime);
    } catch (e) {
        console.log('  ❌ formatTime() error:', e.message);
    }
} else {
    console.log('  ⚠️ formatTime() not available');
}

if (typeof renderAttendanceTable === 'function') {
    try {
        console.log('  ℹ️ Calling renderAttendanceTable()...');
        renderAttendanceTable();
        console.log('  ✅ renderAttendanceTable() executed');
    } catch (e) {
        console.log('  ❌ renderAttendanceTable() error:', e.message);
    }
} else {
    console.log('  ⚠️ renderAttendanceTable() not available');
}

console.log('');

// ========================================
// 6. SUMMARY
// ========================================
console.log('%c📊 DIAGNOSTIC SUMMARY', 'color: #2563eb; font-size: 14px; font-weight: bold;');

const issues = [];

if (missingFunctions.length > 0) {
    issues.push(`Missing ${missingFunctions.length} functions: ${missingFunctions.join(', ')}`);
}

if (missingElements.length > 0) {
    issues.push(`Missing ${missingElements.length} HTML elements: ${missingElements.join(', ')}`);
}

if (currentState.attendanceRecords.length === 0) {
    issues.push('No attendance records in memory');
}

if (!saved) {
    issues.push('No data in LocalStorage');
}

if (issues.length === 0) {
    console.log('%c✅ NO ISSUES FOUND!', 'color: #16a34a; font-weight: bold;');
    console.log('');
    console.log('If data still not showing, try:');
    console.log('1. Check the table on the page');
    console.log('2. Try manual clock in (see below)');
} else {
    console.log('%c⚠️ ISSUES FOUND:', 'color: #dc2626; font-weight: bold;');
    issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
    });
}

console.log('');

// ========================================
// 7. MANUAL CLOCK IN (IF NEEDED)
// ========================================
console.log('%c🚀 MANUAL CLOCK IN', 'color: #0891b2; font-size: 14px; font-weight: bold;');
console.log('If you want to test clock in manually, copy this:');
console.log('');
console.log('%cmanualClockIn("Your Name");', 'background: #1e293b; color: #22c55e; padding: 8px; border-radius: 4px; font-family: monospace;');
console.log('');

// Define manual clock in function
window.manualClockIn = function (userName) {
    console.log('%c🔧 MANUAL CLOCK IN STARTING...', 'color: #0891b2; font-weight: bold;');

    if (!userName) {
        console.log('%c❌ Please provide a name!', 'color: #dc2626; font-weight: bold;');
        console.log('Usage: manualClockIn("Your Name")');
        return;
    }

    currentState.userName = userName;

    const now = new Date();
    const record = {
        id: Date.now(),
        userName: userName,
        date: typeof formatDate === 'function' ? formatDate(now) : now.toLocaleDateString('th-TH'),
        clockIn: typeof formatTime === 'function' ? formatTime(now) : now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        clockOut: null,
        isLate: false,
        duration: null,
        restroomTime: 0,
        restTime: 0,
        restroomBreaks: [],
        restBreaks: [],
        photo: null,
        location: null,
        mode: 'office',
        project: 'Manual Entry',
        ipAddress: null,
        timestamp: now.toISOString(),
        sessionStart: now.toISOString(),
        sessionEnd: null
    };

    console.log('Created record:', record);

    currentState.attendanceRecords.unshift(record);
    currentState.isClockedIn = true;
    currentState.currentSessionStart = now.toISOString();

    console.log('Total records:', currentState.attendanceRecords.length);

    // Save
    if (typeof saveToLocalStorage === 'function') {
        saveToLocalStorage();
        console.log('✅ Saved to localStorage');
    } else {
        console.log('⚠️ saveToLocalStorage not available, saving manually...');
        localStorage.setItem('globalWorkState', JSON.stringify(currentState));
        console.log('✅ Saved manually');
    }

    // Render
    if (typeof renderAttendanceTable === 'function') {
        renderAttendanceTable();
        console.log('✅ Table rendered');
    } else {
        console.log('❌ renderAttendanceTable not available');
    }

    // Update UI
    if (typeof updateUI === 'function') {
        updateUI();
        console.log('✅ UI updated');
    }

    console.log('%c✅ MANUAL CLOCK IN COMPLETE!', 'color: #16a34a; font-weight: bold;');
    console.log('Check the table now!');
};

console.log('%c✅ DIAGNOSTIC COMPLETE!', 'color: #2563eb; font-size: 16px; font-weight: bold;');
console.log('');
console.log('Next steps:');
console.log('1. Review the issues above (if any)');
console.log('2. Try: manualClockIn("Your Name")');
console.log('3. Check if data appears in the table');
