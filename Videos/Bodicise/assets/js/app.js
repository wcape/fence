// Main App JavaScript - Core application logic for Bodicise

class App {
    static isInitialized = false;
    static currentUser = null;
    static config = {
        apiBaseUrl: 'https://your-google-cloud-function-url.com/api',
        stripePublishableKey: 'pk_test_your_stripe_publishable_key',
        environment: 'development',
        version: '1.0.0'
    };

    // Initialize the application
    static async init() {
        if (this.isInitialized) return;

        try {
            console.log('Initializing Bodicise App...');
            
            // Initialize core services
            await this.initializeServices();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize authentication
            await this.initializeAuth();
            
            // Setup navigation
            this.setupNavigation();
            
            // Initialize PWA
            this.initializePWA();
            
            this.isInitialized = true;
            console.log('Bodicise App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    // Initialize core services
    static async initializeServices() {
        // Initialize API client
        if (typeof ApiClient !== 'undefined') {
            ApiClient.setBaseUrl(this.config.apiBaseUrl);
        }

        // Initialize Stripe
        if (typeof PaymentController !== 'undefined') {
            await PaymentController.init();
        }

        // Initialize controllers
        if (typeof AuthController !== 'undefined') {
            AuthController.checkAuthStatus();
        }

        if (typeof UserController !== 'undefined') {
            await UserController.init();
        }

        if (typeof WorkoutController !== 'undefined') {
            await WorkoutController.init();
        }
    }

    // Setup global event listeners
    static setupEventListeners() {
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            const dropdowns = document.querySelectorAll('.dropdown-menu.show');
            dropdowns.forEach(dropdown => {
                if (!dropdown.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });
        });

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
                this.closeAllDropdowns();
            }
        });

        // Handle form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.classList.contains('prevent-default')) {
                e.preventDefault();
            }
        });

        // Handle navigation clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-navigate]')) {
                e.preventDefault();
                const page = e.target.dataset.navigate;
                this.navigateToPage(page);
            }
        });

        // Handle smooth scrolling
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-scroll-to]')) {
                e.preventDefault();
                const targetId = e.target.dataset.scrollTo;
                this.scrollToElement(targetId);
            }
        });
    }

    // Initialize authentication
    static async initializeAuth() {
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                // Verify token with server
                const response = await ApiClient.get('/auth/verify');
                if (response.success) {
                    this.currentUser = response.user;
                    this.updateUIForAuthenticatedUser();
                } else {
                    this.logout();
                }
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.logout();
        }
    }

    // Setup navigation
    static setupNavigation() {
        // Mobile menu toggle
        const navToggle = document.getElementById('navToggle');
        const navMenu = document.getElementById('navMenu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
            });
        }

        // Active navigation link
        this.updateActiveNavLink();
    }

    // Initialize PWA
    static initializePWA() {
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        }

        // Handle install prompt
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            this.showInstallPrompt();
        });

        // Handle app installed
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.hideInstallPrompt();
        });
    }

    // Navigation methods
    static navigateToPage(page) {
        const pages = {
            'home': '../index.html',
            'dashboard': 'views/dashboard.html',
            'workouts': 'views/workout-plans.html',
            'profile': 'views/profile.html',
            'progress': 'views/progress.html',
            'settings': 'views/settings.html'
        };

        if (pages[page]) {
            window.location.href = pages[page];
        }
    }

    static scrollToElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    static updateActiveNavLink() {
        const currentPage = this.getCurrentPage();
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === currentPage) {
                link.classList.add('active');
            }
        });
    }

    static getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop();
        return page || 'index.html';
    }

    // Authentication methods
    static async login(credentials) {
        try {
            const response = await ApiClient.post('/auth/login', credentials);
            
            if (response.success) {
                this.currentUser = response.user;
                localStorage.setItem('authToken', response.token);
                localStorage.setItem('user', JSON.stringify(response.user));
                
                this.updateUIForAuthenticatedUser();
                this.showSuccess('Login successful!');
                
                return true;
            } else {
                this.showError(response.message);
                return false;
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Login failed. Please try again.');
            return false;
        }
    }

    static async logout() {
        try {
            await ApiClient.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.currentUser = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            
            this.updateUIForUnauthenticatedUser();
            this.showSuccess('Logged out successfully');
            
            // Redirect to home page
            window.location.href = '../index.html';
        }
    }

    static updateUIForAuthenticatedUser() {
        const user = this.currentUser;
        if (!user) return;

        // Update user info in navigation
        const userNameElements = document.querySelectorAll('.user-name');
        userNameElements.forEach(el => {
            el.textContent = user.firstName || user.email.split('@')[0];
        });

        const userAvatarElements = document.querySelectorAll('.user-avatar');
        userAvatarElements.forEach(el => {
            el.src = user.avatar || '../assets/images/default-avatar.png';
        });

        // Show/hide authenticated elements
        const authElements = document.querySelectorAll('[data-auth="required"]');
        authElements.forEach(el => {
            el.style.display = 'block';
        });

        const unauthElements = document.querySelectorAll('[data-auth="none"]');
        unauthElements.forEach(el => {
            el.style.display = 'none';
        });
    }

    static updateUIForUnauthenticatedUser() {
        // Hide authenticated elements
        const authElements = document.querySelectorAll('[data-auth="required"]');
        authElements.forEach(el => {
            el.style.display = 'none';
        });

        const unauthElements = document.querySelectorAll('[data-auth="none"]');
        unauthElements.forEach(el => {
            el.style.display = 'block';
        });
    }

    // Modal methods
    static openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            
            // Focus first input
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    static closeModal(modal) {
        if (typeof modal === 'string') {
            modal = document.getElementById(modal);
        }
        
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    static closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
    }

    static closeAllDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown-menu.show');
        dropdowns.forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }

    // Notification methods
    static showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        notification.innerHTML = `
            <div class="notification-content">
                <i class="notification-icon ${iconMap[type]}"></i>
                <span class="notification-text">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Auto remove
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    static showSuccess(message) {
        this.showNotification(message, 'success');
    }

    static showError(message) {
        this.showNotification(message, 'error');
    }

    static showWarning(message) {
        this.showNotification(message, 'warning');
    }

    static showInfo(message) {
        this.showNotification(message, 'info');
    }

    // Utility methods
    static formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    static formatTime(date) {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    static debounce(func, wait) {
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

    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // PWA methods
    static showInstallPrompt() {
        // Show install button or banner
        const installBanner = document.getElementById('installBanner');
        if (installBanner) {
            installBanner.style.display = 'block';
        }
    }

    static hideInstallPrompt() {
        const installBanner = document.getElementById('installBanner');
        if (installBanner) {
            installBanner.style.display = 'none';
        }
    }

    static async installApp() {
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            const { outcome } = await window.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            window.deferredPrompt = null;
        }
    }

    // Error handling
    static handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);
        
        let message = 'An unexpected error occurred';
        
        if (error.response) {
            // Server responded with error status
            message = error.response.data?.message || `Server error: ${error.response.status}`;
        } else if (error.request) {
            // Request was made but no response received
            message = 'Network error. Please check your connection.';
        } else {
            // Something else happened
            message = error.message || message;
        }
        
        this.showError(message);
    }

    // Performance monitoring
    static trackPerformance(name, startTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`${name} took ${duration} milliseconds`);
        
        // Send to analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'timing_complete', {
                name: name,
                value: Math.round(duration)
            });
        }
    }

    // Analytics
    static trackEvent(eventName, parameters = {}) {
        console.log('Event tracked:', eventName, parameters);
        
        // Send to Google Analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, parameters);
        }
    }

    // Configuration
    static updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    static getConfig() {
        return this.config;
    }

    // Cleanup
    static cleanup() {
        // Remove event listeners
        document.removeEventListener('click', this.handleClick);
        document.removeEventListener('keydown', this.handleKeydown);
        
        // Clear intervals and timeouts
        // This would need to be implemented based on specific use cases
        
        this.isInitialized = false;
    }
}

// Global utility functions
window.scrollToSection = function(sectionId) {
    App.scrollToElement(sectionId);
};

window.toggleUserMenu = function() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is hidden, pause any ongoing activities
        console.log('Page hidden');
    } else {
        // Page is visible, resume activities
        console.log('Page visible');
    }
});

// Handle online/offline status
window.addEventListener('online', function() {
    App.showSuccess('Connection restored');
});

window.addEventListener('offline', function() {
    App.showWarning('You are offline. Some features may not work.');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}

