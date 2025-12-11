// ==========================================
// HRMS FRONTEND CONFIGURATION
// ==========================================

const CONFIG = {
    // Apps Script Web App URL
    APPS_SCRIPT_URL: 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE',
    
    // Google OAuth Client ID
    OAUTH_CLIENT_ID: 'YOUR_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com',
    
    // Application Settings
    APP_NAME: 'HRMS Portal',
    APP_VERSION: '1.0.0',
    
    // API Timeout (ms)
    API_TIMEOUT: 30000,
    
    // File Upload Settings
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    
    // Portals for job posting
    JOB_PORTALS: [
        'Naukri.com',
        'Indeed',
        'Work India',
        'Apna',
        'LinkedIn',
        'Direct'
    ],
    
    // Job Roles
    JOB_ROLES: [
        'CRM',
        'CCE',
        'PC',
        'MIS',
        'Jr. Accountant',
        'Sr. Accountant',
        'HR Executive',
        'Team Leader',
        'Manager'
    ],
    
    // Shifts
    SHIFTS: [
        'Day Shift (9 AM - 6 PM)',
        'Night Shift (8 PM - 5 AM)',
        'Rotational',
        'Flexible'
    ],
    
    // Assessment Types
    ASSESSMENT_TYPES: {
        CRM: ['Excel', 'Voice'],
        CCE: ['Excel', 'Voice'],
        PC: ['Excel', 'Voice'],
        'Jr. Accountant': ['Excel', 'Tally'],
        'Sr. Accountant': ['Excel', 'Tally'],
        MIS: ['Excel'],
        'HR Executive': ['Excel'],
        'Team Leader': ['Excel'],
        Manager: ['Excel']
    },
    
    // Status Colors
    STATUS_COLORS: {
        'Active': 'status-active',
        'Pending Review': 'status-pending',
        'Valid': 'status-active',
        'Send Back': 'status-rejected',
        'CV Uploaded': 'status-pending',
        'Approved': 'status-active',
        'Rejected': 'status-rejected',
        'Recommended for Owners': 'status-pending',
        'Approved for Walk-in': 'status-active',
        'Scheduled': 'status-pending',
        'Appeared': 'status-active',
        'Cleared HR Interview': 'status-active',
        'Hold': 'status-pending'
    },
    
    // Interview Message Template
    INTERVIEW_MESSAGE_TEMPLATE: `Dear [Candidate Name],

We are pleased to inform you that you have been shortlisted for an interview for the position of [Job Title].

Interview Details:
📍 Location: Near Dr. Gyan Prakash, Kalai Compound, NT Woods, Gandhi Park, Aligarh (202 001)
📅 Date: [Date]
⏰ Time: [Time]

Kindly confirm your availability at your earliest convenience. For any information or assistance, please feel free to contact us.

Regards
Team HR
N.T Woods Pvt. Ltd.`,
    
    // Navigation Menu (Role-based)
    NAVIGATION: {
        Admin: [
            { id: 'dashboard', icon: '📊', label: 'Dashboard', section: 'main' },
            { id: 'requirements', icon: '📋', label: 'Requirements', section: 'recruitment' },
            { id: 'applicants', icon: '👥', label: 'Applicants', section: 'recruitment' },
            { id: 'interviews', icon: '📅', label: 'Interviews', section: 'recruitment' },
            { id: 'assessments', icon: '📝', label: 'Assessments', section: 'recruitment' },
            { id: 'users', icon: '👤', label: 'Users', section: 'admin' },
            { id: 'templates', icon: '📄', label: 'Job Templates', section: 'admin' },
            { id: 'permissions', icon: '🔐', label: 'Permissions', section: 'admin' },
            { id: 'reports', icon: '📈', label: 'Reports', section: 'admin' }
        ],
        EA: [
            { id: 'dashboard', icon: '📊', label: 'Dashboard', section: 'main' },
            { id: 'requirements', icon: '📋', label: 'My Requirements', section: 'main' },
            { id: 'incomplete-requirements', icon: '⚠️', label: 'Incomplete', section: 'main' },
            { id: 'applicants', icon: '👥', label: 'Applicants', section: 'main' },
            { id: 'assessments', icon: '📝', label: 'Assessments', section: 'main' }
        ],
        HR: [
            { id: 'dashboard', icon: '📊', label: 'Dashboard', section: 'main' },
            { id: 'requirements', icon: '📋', label: 'Review Requirements', section: 'recruitment' },
            { id: 'job-postings', icon: '📢', label: 'Job Postings', section: 'recruitment' },
            { id: 'cv-upload', icon: '📤', label: 'Upload CVs', section: 'recruitment' },
            { id: 'shortlisting', icon: '✅', label: 'Shortlisting', section: 'recruitment' },
            { id: 'screening', icon: '📞', label: 'Screening', section: 'recruitment' },
            { id: 'owner-discussion', icon: '💼', label: 'Owner Discussion', section: 'recruitment' },
            { id: 'schedule-interviews', icon: '📅', label: 'Schedule Interviews', section: 'recruitment' },
            { id: 'walk-ins', icon: '🚶', label: 'Walk-ins', section: 'recruitment' },
            { id: 'assessments', icon: '📝', label: 'Assessments', section: 'recruitment' }
        ]
    }
};

// Utility Functions
const Utils = {
    // Format date
    formatDate: function(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    },
    
    // Format datetime
    formatDateTime: function(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // Get status badge HTML
    getStatusBadge: function(status) {
        const colorClass = CONFIG.STATUS_COLORS[status] || 'status-pending';
        return `<span class="status-badge ${colorClass}">${status}</span>`;
    },
    
    // Show loading
    showLoading: function(show = true) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.toggle('active', show);
        }
    },
    
    // Show alert
    showAlert: function(message, type = 'info') {
        alert(message); // Replace with custom modal in production
    },
    
    // Show confirmation
    showConfirm: function(message) {
        return confirm(message); // Replace with custom modal in production
    },
    
    // Copy to clipboard
    copyToClipboard: function(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showAlert('Copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Copy failed:', err);
            this.showAlert('Failed to copy', 'error');
        });
    },
    
    // Generate interview message
    generateInterviewMessage: function(candidateName, jobTitle, date, time) {
        return CONFIG.INTERVIEW_MESSAGE_TEMPLATE
            .replace('[Candidate Name]', candidateName)
            .replace('[Job Title]', jobTitle)
            .replace('[Date]', date)
            .replace('[Time]', time);
    },
    
    // File validation
    validateFile: function(file) {
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            return { valid: false, error: 'File size exceeds 5MB limit' };
        }
        
        if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
            return { valid: false, error: 'Invalid file type. Only PDF and DOC files allowed' };
        }
        
        return { valid: true };
    },
    
    // Convert file to base64
    fileToBase64: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    
    // Parse CV filename
    parseFileName: function(fileName) {
        const parts = fileName.split('_');
        if (parts.length < 3) {
            return null;
        }
        
        return {
            name: parts[0].trim(),
            mobile: parts[1].trim(),
            source: parts[2].split('.')[0].trim()
        };
    },
    
    // Get initials from name
    getInitials: function(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    },
    
    // Debounce function
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, Utils };
}
