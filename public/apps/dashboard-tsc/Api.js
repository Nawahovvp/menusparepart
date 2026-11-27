const TscApi = {
    // Configuration - Pointing to internal Vercel API
    config: {
        proxyUrl: '/api/proxy'
    },
    
    // Helper to get proxy endpoint
    getProxyUrl(type) {
        return `${this.config.proxyUrl}?type=${type}`;
    },

    // Helper to get authentication token from storage
    getToken() {
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    },

    // Helper for fetch with timeout
    async fetchWithTimeout(resource, options = {}) {
        const { timeout = 30000 } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        // Clone and ensure headers & same-origin cookie credentials exist
        const fetchOptions = { credentials: 'same-origin', ...options };
        fetchOptions.headers = {
            'X-Requested-With': 'CallSparePartApp',
            ...(options.headers || {})
        };
        
        const token = this.getToken();
        if (token) {
            fetchOptions.headers['Authorization'] = `Bearer ${token}`;
        }
        
        fetchOptions.signal = controller.signal;
        
        try {
            const response = await fetch(resource, fetchOptions);
            clearTimeout(id);
            
            // Automatically log out if token is expired or unauthorized
            if (response.status === 401) {
                console.warn("Session expired or unauthorized. Logging out...");
                if (typeof Auth !== 'undefined' && typeof Auth.logout === 'function') {
                    Auth.logout();
                }
            }
            
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    },

    // Perform Secure Server-side login
    async login(username, password) {
        try {
            const response = await this.fetchWithTimeout('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            return response;
        } catch (error) {
            console.error("Login connection error:", error);
            throw error;
        }
    },

    // Fetch Product Data
    async getProductData() {
        const url = this.getProxyUrl('product');
        try {
            const response = await this.fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching Product Data:", error);
            throw error;
        }
    },

    // Fetch Bluetap Claim Data
    async getBluetapClaimData() {
        const url = this.getProxyUrl('bluetap_claim');
        try {
            const response = await this.fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching Bluetap Claim Data:", error);
            throw error;
        }
    },

    // Fetch Store Brand Data (for tsc_store.js)
    async getStoreBrandData() {
        const url = this.getProxyUrl('brand');
        try {
            const response = await this.fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching Store Brand Data:", error);
            throw error;
        }
    },

    // Fetch Store TSC Data (for tsc_store.js)
    async getStoreTscData() {
        const url = this.getProxyUrl('tsc');
        try {
            const response = await this.fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error fetching Store TSC Data:", error);
            throw error;
        }
    },

    // Log Activity to Google Sheets
    async logActivity(action, details = '-') {
        const profileStr = localStorage.getItem('userProfile') || sessionStorage.getItem('userProfile');
        let profile = null;
        try { profile = profileStr ? JSON.parse(profileStr) : null; } catch (e) {}

        const logData = {
            userId: profile ? profile.id : 'Anonymous',
            userName: profile ? profile.name : 'Guest',
            action: action,
            category: window.currentProductFilter || 'General',
            details: details
        };

        const url = this.getProxyUrl('log');

        // Post to our proxy
        this.fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logData)
        }).catch(err => console.error("Logging via proxy failed:", err));
    }
};

window.TscApi = TscApi;
