// API Client - Handles all API communications for Bodicise

class ApiClient {
    static baseUrl = 'https://your-google-cloud-function-url.com/api';
    static defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    static authToken = null;

    // Initialize API client
    static init() {
        // Load auth token from localStorage
        this.authToken = localStorage.getItem('authToken');
        
        // Set up request/response interceptors
        this.setupInterceptors();
    }

    // Set base URL
    static setBaseUrl(url) {
        this.baseUrl = url;
    }

    // Setup request/response interceptors
    static setupInterceptors() {
        // Add auth token to requests
        this.addRequestInterceptor((config) => {
            if (this.authToken) {
                config.headers.Authorization = `Bearer ${this.authToken}`;
            }
            return config;
        });

        // Handle response errors
        this.addResponseInterceptor(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    // Token expired, logout user
                    this.handleUnauthorized();
                }
                return Promise.reject(error);
            }
        );
    }

    // Request interceptors
    static requestInterceptors = [];
    static addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    // Response interceptors
    static responseInterceptors = [];
    static addResponseInterceptor(onFulfilled, onRejected) {
        this.responseInterceptors.push({ onFulfilled, onRejected });
    }

    // Handle unauthorized access
    static handleUnauthorized() {
        this.authToken = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        // Redirect to login or show login modal
        if (typeof AuthController !== 'undefined') {
            AuthController.logout();
        } else {
            window.location.href = '../index.html';
        }
    }

    // Generic request method
    static async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            method: 'GET',
            headers: { ...this.defaultHeaders },
            ...options
        };

        // Apply request interceptors
        for (const interceptor of this.requestInterceptors) {
            config = interceptor(config);
        }

        try {
            const response = await fetch(url, config);
            let data;

            // Parse response based on content type
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            // Create response object
            const responseObj = {
                data,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                ok: response.ok
            };

            // Apply response interceptors
            for (const interceptor of this.responseInterceptors) {
                if (interceptor.onFulfilled) {
                    return interceptor.onFulfilled(responseObj);
                }
            }

            return responseObj;

        } catch (error) {
            // Apply response interceptors for errors
            for (const interceptor of this.responseInterceptors) {
                if (interceptor.onRejected) {
                    return interceptor.onRejected(error);
                }
            }
            throw error;
        }
    }

    // GET request
    static async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(url, {
            method: 'GET'
        });
    }

    // POST request
    static async post(endpoint, data = {}, options = {}) {
        const config = {
            method: 'POST',
            body: JSON.stringify(data),
            ...options
        };

        // Handle FormData
        if (data instanceof FormData) {
            delete config.headers['Content-Type'];
            config.body = data;
        }

        return this.request(endpoint, config);
    }

    // PUT request
    static async put(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
            ...options
        });
    }

    // PATCH request
    static async patch(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options
        });
    }

    // DELETE request
    static async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            method: 'DELETE',
            ...options
        });
    }

    // Upload file
    static async uploadFile(endpoint, file, additionalData = {}) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Add additional data
        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });

        return this.post(endpoint, formData, {
            headers: {
                // Don't set Content-Type, let browser set it with boundary
            }
        });
    }

    // Download file
    static async downloadFile(endpoint, filename) {
        const response = await this.request(endpoint, {
            method: 'GET'
        });

        if (response.ok) {
            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }

        return response;
    }

    // Authentication endpoints
    static async login(credentials) {
        return this.post('/auth/login', credentials);
    }

    static async register(userData) {
        return this.post('/auth/register', userData);
    }

    static async logout() {
        return this.post('/auth/logout');
    }

    static async refreshToken() {
        return this.post('/auth/refresh');
    }

    static async verifyToken() {
        return this.get('/auth/verify');
    }

    static async forgotPassword(email) {
        return this.post('/auth/forgot-password', { email });
    }

    static async resetPassword(token, password) {
        return this.post('/auth/reset-password', { token, password });
    }

    // User endpoints
    static async getUserProfile() {
        return this.get('/user/profile');
    }

    static async updateUserProfile(profileData) {
        return this.put('/user/profile', profileData);
    }

    static async uploadProfilePicture(file) {
        return this.uploadFile('/user/profile-picture', file);
    }

    static async getUserSettings() {
        return this.get('/user/settings');
    }

    static async updateUserSettings(settings) {
        return this.put('/user/settings', settings);
    }

    static async changePassword(passwordData) {
        return this.put('/user/change-password', passwordData);
    }

    static async getUserStats() {
        return this.get('/user/stats');
    }

    static async getUserProgress(period = 'month') {
        return this.get(`/user/progress?period=${period}`);
    }

    static async getUserAchievements() {
        return this.get('/user/achievements');
    }

    static async getUserSubscription() {
        return this.get('/user/subscription');
    }

    static async updateSubscription(plan) {
        return this.put('/user/subscription', { plan });
    }

    static async cancelSubscription() {
        return this.post('/user/subscription/cancel');
    }

    static async getUserActivityFeed(page = 1, limit = 20) {
        return this.get(`/user/activity-feed?page=${page}&limit=${limit}`);
    }

    static async followUser(userId) {
        return this.post('/user/follow', { userId });
    }

    static async unfollowUser(userId) {
        return this.post('/user/unfollow', { userId });
    }

    static async getUserFollowers(userId = null) {
        const endpoint = userId ? `/user/${userId}/followers` : '/user/followers';
        return this.get(endpoint);
    }

    static async getUserFollowing(userId = null) {
        const endpoint = userId ? `/user/${userId}/following` : '/user/following';
        return this.get(endpoint);
    }

    static async searchUsers(query) {
        return this.get(`/user/search?q=${encodeURIComponent(query)}`);
    }

    static async getUserProfileById(userId) {
        return this.get(`/user/${userId}/profile`);
    }

    static async deleteAccount() {
        return this.delete('/user/account');
    }

    static async exportUserData() {
        return this.get('/user/export');
    }

    // Workout endpoints
    static async getWorkoutLibrary(category = null) {
        const endpoint = category ? `/workouts?category=${category}` : '/workouts';
        return this.get(endpoint);
    }

    static async getWorkoutPlan(planId) {
        return this.get(`/workouts/plans/${planId}`);
    }

    static async generateWorkoutPlan(userData) {
        return this.post('/workouts/generate', userData);
    }

    static async startWorkout(workoutId) {
        return this.post('/workouts/start', { workoutId });
    }

    static async completeExercise(exerciseId, data) {
        return this.post('/workouts/complete-exercise', {
            exerciseId,
            ...data
        });
    }

    static async finishWorkout(workoutId, data) {
        return this.post('/workouts/finish', {
            workoutId,
            ...data
        });
    }

    static async analyzeForm(videoData) {
        return this.post('/workouts/analyze-form', videoData);
    }

    static async getWorkoutRecommendations() {
        return this.get('/workouts/recommendations');
    }

    static async saveToFavorites(workoutId) {
        return this.post('/workouts/favorites', { workoutId });
    }

    static async getFavorites() {
        return this.get('/workouts/favorites');
    }

    static async getRecentWorkouts() {
        return this.get('/workouts/recent');
    }

    static async getCustomWorkouts() {
        return this.get('/workouts/custom');
    }

    static async createCustomWorkout(workoutData) {
        return this.post('/workouts/custom', workoutData);
    }

    static async getWorkoutStats(period = 'month') {
        return this.get(`/workouts/stats?period=${period}`);
    }

    static async getWorkoutProgress(workoutId) {
        return this.get(`/workouts/progress/${workoutId}`);
    }

    static async updateWorkoutProgress(workoutId, progressData) {
        return this.put(`/workouts/progress/${workoutId}`, progressData);
    }

    static async shareWorkout(workoutId, shareData) {
        return this.post('/workouts/share', {
            workoutId,
            ...shareData
        });
    }

    static async searchExercises(query) {
        return this.get(`/exercises/search?q=${encodeURIComponent(query)}`);
    }

    static async getExerciseLibrary(category = null) {
        const endpoint = category ? `/exercises?category=${category}` : '/exercises';
        return this.get(endpoint);
    }

    // Payment endpoints
    static async createPaymentIntent(paymentData) {
        return this.post('/payment/create-intent', paymentData);
    }

    static async confirmPayment(paymentIntentId) {
        return this.post('/payment/confirm', { paymentIntentId });
    }

    static async handlePaymentSuccess(paymentIntentId, plan) {
        return this.post('/payment/success', { paymentIntentId, plan });
    }

    static async createPayPalPayment(paymentData) {
        return this.post('/payment/paypal', paymentData);
    }

    static async createApplePayPayment(paymentData) {
        return this.post('/payment/apple-pay', paymentData);
    }

    static async processApplePayment(paymentData) {
        return this.post('/payment/apple-pay/process', paymentData);
    }

    static async getPaymentHistory() {
        return this.get('/payment/history');
    }

    static async getInvoices() {
        return this.get('/payment/invoices');
    }

    static async downloadInvoice(invoiceId) {
        return this.downloadFile(`/payment/invoices/${invoiceId}/download`, `invoice-${invoiceId}.pdf`);
    }

    // AI endpoints
    static async getAIInsights() {
        return this.get('/ai/insights');
    }

    static async generateWorkoutWithAI(workoutData) {
        return this.post('/ai/generate-workout', workoutData);
    }

    static async analyzeWorkoutForm(formData) {
        return this.post('/ai/analyze-form', formData);
    }

    static async getPersonalizedRecommendations() {
        return this.get('/ai/recommendations');
    }

    static async getNutritionAdvice(nutritionData) {
        return this.post('/ai/nutrition-advice', nutritionData);
    }

    // Analytics endpoints
    static async trackEvent(eventName, eventData) {
        return this.post('/analytics/track', {
            event: eventName,
            data: eventData,
            timestamp: new Date().toISOString()
        });
    }

    static async getAnalytics(period = 'month') {
        return this.get(`/analytics?period=${period}`);
    }

    // Notification endpoints
    static async getNotifications() {
        return this.get('/notifications');
    }

    static async markNotificationAsRead(notificationId) {
        return this.put(`/notifications/${notificationId}/read`);
    }

    static async markAllNotificationsAsRead() {
        return this.put('/notifications/read-all');
    }

    static async updateNotificationPreferences(preferences) {
        return this.put('/notifications/preferences', preferences);
    }

    // Health check
    static async healthCheck() {
        return this.get('/health');
    }

    // Error handling
    static handleError(error) {
        console.error('API Error:', error);
        
        let message = 'An unexpected error occurred';
        
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            
            switch (status) {
                case 400:
                    message = data.message || 'Bad request';
                    break;
                case 401:
                    message = 'Unauthorized access';
                    break;
                case 403:
                    message = 'Access forbidden';
                    break;
                case 404:
                    message = 'Resource not found';
                    break;
                case 422:
                    message = data.message || 'Validation error';
                    break;
                case 429:
                    message = 'Too many requests. Please try again later.';
                    break;
                case 500:
                    message = 'Internal server error';
                    break;
                case 502:
                case 503:
                case 504:
                    message = 'Service temporarily unavailable';
                    break;
                default:
                    message = data.message || `Error ${status}`;
            }
        } else if (error.request) {
            message = 'Network error. Please check your connection.';
        } else {
            message = error.message || message;
        }
        
        return message;
    }

    // Retry logic
    static async retryRequest(requestFn, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await requestFn();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }

    // Batch requests
    static async batchRequest(requests) {
        const promises = requests.map(request => request());
        return Promise.allSettled(promises);
    }

    // Cache management
    static cache = new Map();
    static cacheTimeout = 5 * 60 * 1000; // 5 minutes

    static setCache(key, data, timeout = this.cacheTimeout) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            timeout
        });
    }

    static getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > cached.timeout) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    static clearCache() {
        this.cache.clear();
    }

    // Request with cache
    static async getWithCache(endpoint, params = {}, cacheKey = null) {
        const key = cacheKey || `${endpoint}${JSON.stringify(params)}`;
        const cached = this.getCache(key);
        
        if (cached) {
            return { data: cached, fromCache: true };
        }
        
        const response = await this.get(endpoint, params);
        this.setCache(key, response.data);
        
        return response;
    }
}

// Initialize API client
ApiClient.init();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}

