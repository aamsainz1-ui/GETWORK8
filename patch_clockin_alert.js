// ========================================
// PATCH 1: เพิ่ม Alert Popup ใน clockIn()
// ========================================
// หาบรรทัดนี้ใน script.js (ประมาณบรรทัด 653):
// window.toast.success(`✅ สวัสดีครับคุณ ${currentState.userName} เข้างานเรียบร้อย`);
// 
// เพิ่มโค้ดนี้ข้างล่าง:

// Show alert popup
setTimeout(() => {
    alert(`✅ บันทึกเวลาเข้างานสำเร็จ!\n\nชื่อ: ${currentState.userName}\nเวลา: ${formatTime(now)}\nวันที่: ${formatDate(now)}`);
}, 500);
