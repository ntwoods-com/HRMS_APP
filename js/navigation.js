// ==========================================
// NAVIGATION MODULE
// ==========================================

const Navigation = {
    currentPage: 'dashboard',

    // Initialize navigation
    init: function() {
        this.renderMenu();
        this.setupEventListeners();
    },

    // Render menu based on user role
    renderMenu: function() {
        const sidebar = document.getElementById('sidebar');
        const userRole = Auth.getRole();
        const menuItems = CONFIG.NAVIGATION[userRole] || CONFIG.NAVIGATION['HR'];

        let html = '';
        let currentSection = '';

        menuItems.forEach(item => {
            // Add section header if new section
            if (item.section !== currentSection) {
                if (currentSection !== '') {
                    html += '<div style="margin: 1rem 0;"></div>';
                }
                html += `<div class="menu-section">${item.section}</div>`;
                currentSection = item.section;
            }

            // Add menu item
            const activeClass = item.id === this.currentPage ? 'active' : '';
            html += `
                <div class="menu-item ${activeClass}" data-page="${item.id}">
                    <span class="menu-item-icon">${item.icon}</span>
                    <span>${item.label}</span>
                </div>
            `;
        });

        sidebar.innerHTML = html;
    },

    // Setup event listeners
    setupEventListeners: function() {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.currentTarget.getAttribute('data-page');
                this.navigateTo(page);
            });
        });
    },

    // Navigate to page
    navigateTo: function(page) {
        // Update current page
        this.currentPage = page;

        // Update menu active state
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-page') === page) {
                item.classList.add('active');
            }
        });

        // Hide all content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show selected content section
        const contentSection = document.getElementById(page);
        if (contentSection) {
            contentSection.classList.add('active');
            
            // Load page content
            this.loadPageContent(page);
        }
    },

    // Load page content
    loadPageContent: function(page) {
        switch(page) {
            case 'dashboard':
                Dashboard.load();
                break;
            case 'requirements':
                if (typeof Requirements !== 'undefined') Requirements.load();
                break;
            case 'incomplete-requirements':
                if (typeof Requirements !== 'undefined') Requirements.loadIncomplete();
                break;
            case 'applicants':
                if (typeof Applicants !== 'undefined') Applicants.load();
                break;
            case 'job-postings':
                if (typeof JobPostings !== 'undefined') JobPostings.load();
                break;
            case 'cv-upload':
                if (typeof CVUpload !== 'undefined') CVUpload.load();
                break;
            case 'shortlisting':
                if (typeof Shortlisting !== 'undefined') Shortlisting.load();
                break;
            case 'screening':
                if (typeof Screening !== 'undefined') Screening.load();
                break;
            case 'owner-discussion':
                if (typeof OwnerDiscussion !== 'undefined') OwnerDiscussion.load();
                break;
            case 'schedule-interviews':
                if (typeof Interviews !== 'undefined') Interviews.loadScheduling();
                break;
            case 'walk-ins':
                if (typeof Interviews !== 'undefined') Interviews.loadWalkIns();
                break;
            case 'interviews':
                if (typeof Interviews !== 'undefined') Interviews.load();
                break;
            case 'assessments':
                if (typeof Assessments !== 'undefined') Assessments.load();
                break;
            case 'users':
                if (typeof Users !== 'undefined') Users.load();
                break;
            case 'templates':
                if (typeof Templates !== 'undefined') Templates.load();
                break;
            case 'permissions':
                if (typeof Permissions !== 'undefined') Permissions.load();
                break;
            case 'reports':
                if (typeof Reports !== 'undefined') Reports.load();
                break;
            default:
                console.log('Page not implemented:', page);
        }
    }
};
