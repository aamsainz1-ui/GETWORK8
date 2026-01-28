// Modern Toast Notification System
class ToastManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create toast container if not exists
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    show(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = this.getIcon(type);
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        this.container.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    }

    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            gps: '📍',
            security: '🔐',
            biometric: '👤',
            owner: '👑'
        };
        return icons[type] || icons.info;
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Modern Confirm Dialog
class ConfirmDialog {
    static show(options) {
        return new Promise((resolve) => {
            const {
                title = 'ยืนยันการดำเนินการ',
                message = 'คุณแน่ใจหรือไม่?',
                confirmText = 'ยืนยัน',
                cancelText = 'ยกเลิก',
                type = 'warning'
            } = options;

            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';

            const icon = this.getIcon(type);
            overlay.innerHTML = `
                <div class="confirm-dialog">
                    <div class="confirm-icon">${icon}</div>
                    <h3 class="confirm-title">${title}</h3>
                    <p class="confirm-message">${message}</p>
                    <div class="confirm-actions">
                        <button class="btn-cancel" id="confirmCancel">${cancelText}</button>
                        <button class="btn-confirm" id="confirmOk">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('show'), 10);

            const cleanup = () => {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);
            };

            document.getElementById('confirmOk').onclick = () => {
                cleanup();
                resolve(true);
            };

            document.getElementById('confirmCancel').onclick = () => {
                cleanup();
                resolve(false);
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            };
        });
    }

    static getIcon(type) {
        const icons = {
            warning: '⚠️',
            danger: '🚨',
            info: 'ℹ️',
            question: '❓',
            delete: '🗑️'
        };
        return icons[type] || icons.warning;
    }
}

// Initialize global toast manager
window.toast = new ToastManager();
window.confirmDialog = ConfirmDialog;

// Legacy alert replacement (optional)
window.showToast = (message, type = 'info') => {
    window.toast.show(message, type);
};
