const TscApi = {
    // Configuration - Pointing to internal Vercel API
    config: {
        proxyUrl: '/api/proxy',
        cacheTtlMs: 5 * 60 * 1000,
        cacheMaxStaleMs: 24 * 60 * 60 * 1000,
        refreshIntervalMs: 2 * 60 * 1000
    },

    // Small response tables fit localStorage and are available before the API responds.
    getCacheKey(type) {
        let userId = 'guest';
        try {
            const profile = JSON.parse(localStorage.getItem('userProfile') || sessionStorage.getItem('userProfile') || 'null');
            userId = profile?.id || profile?.username || 'guest';
        } catch (_) {}
        return `tsc-table-cache:v1:${userId}:${type}`;
    },

    readCache(type) {
        try {
            const cached = JSON.parse(localStorage.getItem(this.getCacheKey(type)) || 'null');
            return cached && Array.isArray(cached.data) && Number.isFinite(cached.savedAt) ? cached : null;
        } catch (_) { return null; }
    },

    async fetchTableData(type) {
        const response = await this.fetchWithTimeout(this.getProxyUrl(type));
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error(`Invalid ${type} data format`);
        try { localStorage.setItem(this.getCacheKey(type), JSON.stringify({ savedAt: Date.now(), data })); }
        catch (error) { console.warn(`Could not cache ${type} table data`, error); }
        return data;
    },

    async getTableData(type) {
        const cached = this.readCache(type);
        if (cached && Date.now() - cached.savedAt < this.config.cacheMaxStaleMs) {
            // Show cached rows immediately; refresh in the background when stale.
            if (Date.now() - cached.savedAt >= this.config.cacheTtlMs) {
                this.fetchTableData(type).catch(error => console.warn(`Background refresh failed for ${type}`, error));
            }
            return cached.data;
        }
        if (cached) {
            try { localStorage.removeItem(this.getCacheKey(type)); } catch (_) {}
        }
        return this.fetchTableData(type);
    },

    startCacheRefresh() {
        if (this.refreshTimer) return;
        const refresh = () => {
            ['product', 'bluetap_claim', 'brand', 'tsc'].forEach(type => {
                const cached = this.readCache(type);
                if (cached && Date.now() - cached.savedAt >= this.config.cacheTtlMs) {
                    this.fetchTableData(type).catch(error => console.warn(`Background refresh failed for ${type}`, error));
                }
                if (cached && Date.now() - cached.savedAt >= this.config.cacheMaxStaleMs) {
                    try { localStorage.removeItem(this.getCacheKey(type)); } catch (_) {}
                }
            });
        };
        this.refreshTimer = setInterval(refresh, this.config.refreshIntervalMs);
        window.addEventListener('online', refresh);
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
        try {
            return await this.getTableData('product');
        } catch (error) {
            console.error("Error fetching Product Data:", error);
            throw error;
        }
    },

    // Fetch Bluetap Claim Data
    async getBluetapClaimData() {
        try {
            return await this.getTableData('bluetap_claim');
        } catch (error) {
            console.error("Error fetching Bluetap Claim Data:", error);
            throw error;
        }
    },

    // Fetch Store Brand Data (for tsc_store.js)
    async getStoreBrandData() {
        try {
            return await this.getTableData('brand');
        } catch (error) {
            console.error("Error fetching Store Brand Data:", error);
            throw error;
        }
    },

    // Fetch Store TSC Data (for tsc_store.js)
    async getStoreTscData() {
        try {
            return await this.getTableData('tsc');
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

TscApi.startCacheRefresh();

window.TscApi = TscApi;
