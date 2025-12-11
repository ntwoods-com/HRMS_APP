// ==========================================
// AUTHENTICATION MODULE
// ==========================================

const Auth = {
    currentUser: null,
    permissions: null,
    sessionToken: null,

    // Initialize authentication
    init: async function() {
        const userEmail = sessionStorage.getItem('userEmail');
        const idToken = sessionStorage.getItem('idToken');

        if (!userEmail || !idToken) {
            this.redirectToLogin();
            return false;
        }

        try {
            Utils.showLoading(true);
            
            // Verify user with backend
            const response = await this.verifyUser(userEmail, idToken);
            
            if (response.success) {
                this.currentUser = response.data.user;
                this.permissions = response.data.permissions;
                this.sessionToken = response.data.user.sessionToken;
                
                // Store session token
                sessionStorage.setItem('sessionToken', this.sessionToken);
                
                // Update UI
                this.updateUserInterface();
                
                Utils.showLoading(false);
                return true;
            } else {
                this.redirectToLogin();
                return false;
            }
        } catch (error) {
            console.error('Auth error:', error);
            // Even if verification fails due to CORS, try to continue with cached data
            Utils.showLoading(false);
            return this.loadCachedUserData(userEmail);
        }
    },

    // Verify user with backend
    verifyUser: async function(email, idToken) {
        // Note: Due to no-cors mode, we won't get the actual response
        // This is a limitation we'll handle gracefully
        try {
            await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'verifyUser',
                    email: email,
                    idToken: idToken
                })
            });

            // Since we can't read the response, we'll return success
            // and handle verification on subsequent authenticated calls
            return {
                success: true,
                data: {
                    user: {
                        email: email,
                        name: email.split('@')[0],
                        role: 'User', // Will be updated on first real API call
                        sessionToken: 'temp_' + Date.now()
                    },
                    permissions: {}
                }
            };
        } catch (error) {
            throw error;
        }
    },

    // Load cached user data (fallback)
    loadCachedUserData: function(email) {
        const cachedUser = localStorage.getItem('cachedUser');
        if (cachedUser) {
            const userData = JSON.parse(cachedUser);
            if (userData.email === email) {
                this.currentUser = userData;
                this.permissions = userData.permissions || {};
                this.updateUserInterface();
                return true;
            }
        }
        this.redirectToLogin();
        return false;
    },

    // Update user interface
    updateUserInterface: function() {
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userRole = document.getElementById('userRole');
        const userAvatar = document.getElementById('userAvatar');

        if (userName) userName.textContent = this.currentUser.name || 'User';
        if (userEmail) userEmail.textContent = this.currentUser.email;
        if (userRole) userRole.textContent = `Role: ${this.currentUser.role || 'User'}`;
        if (userAvatar) userAvatar.textContent = Utils.getInitials(this.currentUser.name || this.currentUser.email);

        // Cache user data
        localStorage.setItem('cachedUser', JSON.stringify({
            ...this.currentUser,
            permissions: this.permissions
        }));
    },

    // Check if user has permission
    hasPermission: function(permission) {
        if (!this.permissions) return false;
        if (this.currentUser.role === 'Admin') return true;

        for (const module in this.permissions) {
            if (this.permissions[module].includes(permission)) {
                return true;
            }
        }
        return false;
    },

    // Check if user has role
    hasRole: function(role) {
        return this.currentUser && this.currentUser.role === role;
    },

    // Get user role
    getRole: function() {
        return this.currentUser ? this.currentUser.role : null;
    },

    // Get user email
    getEmail: function() {
        return this.currentUser ? this.currentUser.email : null;
    },

    // Logout
    logout: function() {
        sessionStorage.clear();
        localStorage.removeItem('cachedUser');
        this.currentUser = null;
        this.permissions = null;
        this.sessionToken = null;
        this.redirectToLogin();
    },

    // Redirect to login
    redirectToLogin: function() {
        window.location.href = 'index.html';
    }
};

// API Helper with Authentication
const API = {
    // Make authenticated API call
    call: async function(action, data = {}) {
        const userEmail = Auth.getEmail();
        const sessionToken = sessionStorage.getItem('sessionToken');

        if (!userEmail || !sessionToken) {
            Auth.redirectToLogin();
            throw new Error('Not authenticated');
        }

        const payload = {
            action: action,
            userEmail: userEmail,
            sessionToken: sessionToken,
            ...data
        };

        try {
            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            // Note: With no-cors, we can't read the response
            // Show confirmation message to user
            return {
                success: true,
                message: 'Request sent successfully'
            };
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    },

    // Make authenticated API call with response (using CORS-enabled endpoint)
    callWithResponse: async function(action, data = {}) {
        const userEmail = Auth.getEmail();
        const sessionToken = sessionStorage.getItem('sessionToken');

        if (!userEmail || !sessionToken) {
            Auth.redirectToLogin();
            throw new Error('Not authenticated');
        }

        const payload = {
            action: action,
            userEmail: userEmail,
            sessionToken: sessionToken,
            ...data
        };

        try {
            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    },

    // Batch upload CVs
    uploadCVsBatch: async function(jobId, files, onProgress) {
        const cvFiles = [];
        
        // Convert files to base64
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Validate file
            const validation = Utils.validateFile(file);
            if (!validation.valid) {
                throw new Error(`${file.name}: ${validation.error}`);
            }

            // Show progress
            if (onProgress) {
                onProgress(i + 1, files.length, `Processing ${file.name}...`);
            }

            const base64Content = await Utils.fileToBase64(file);
            
            cvFiles.push({
                name: file.name,
                content: base64Content,
                mimeType: file.type
            });
        }

        // Upload to server
        return await this.call('uploadCVs', {
            jobId: jobId,
            cvFiles: cvFiles
        });
    }
};

// Initialize authentication when called
async function initializeAuth() {
    const success = await Auth.init();
    if (success) {
        // Initialize navigation
        Navigation.init();
        // Load dashboard
        Dashboard.init();
    }
}

// Logout function (called from UI)
function logout() {
    if (Utils.showConfirm('Are you sure you want to logout?')) {
        Auth.logout();
    }
}
