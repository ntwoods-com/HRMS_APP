// ==========================================
// DASHBOARD MODULE
// ==========================================

const Dashboard = {
    // Initialize dashboard
    init: function() {
        this.load();
    },

    // Load dashboard
    load: function() {
        this.renderCards();
        this.loadRecentActivities();
    },

    // Render dashboard cards based on role
    renderCards: function() {
        const container = document.getElementById('dashboardCards');
        const role = Auth.getRole();

        let cards = [];

        switch(role) {
            case 'Admin':
                cards = [
                    {
                        icon: '👥',
                        iconBg: '#667eea',
                        title: 'Total Users',
                        value: '0',
                        description: 'Active system users',
                        action: () => Navigation.navigateTo('users')
                    },
                    {
                        icon: '📋',
                        iconBg: '#f093fb',
                        title: 'Requirements',
                        value: '0',
                        description: 'Active job requirements',
                        action: () => Navigation.navigateTo('requirements')
                    },
                    {
                        icon: '📝',
                        iconBg: '#4facfe',
                        title: 'Applicants',
                        value: '0',
                        description: 'Total applicants',
                        action: () => Navigation.navigateTo('applicants')
                    },
                    {
                        icon: '📅',
                        iconBg: '#43e97b',
                        title: 'Interviews',
                        value: '0',
                        description: 'Scheduled today',
                        action: () => Navigation.navigateTo('interviews')
                    }
                ];
                break;

            case 'EA':
                cards = [
                    {
                        icon: '📋',
                        iconBg: '#667eea',
                        title: 'My Requirements',
                        value: '0',
                        description: 'Raised by me',
                        action: () => Navigation.navigateTo('requirements')
                    },
                    {
                        icon: '⚠️',
                        iconBg: '#fa709a',
                        title: 'Incomplete',
                        value: '0',
                        description: 'Need attention',
                        action: () => Navigation.navigateTo('incomplete-requirements')
                    },
                    {
                        icon: '✅',
                        iconBg: '#43e97b',
                        title: 'Approved',
                        value: '0',
                        description: 'Valid requirements',
                        action: () => Navigation.navigateTo('requirements')
                    }
                ];
                break;

            case 'HR':
                cards = [
                    {
                        icon: '📋',
                        iconBg: '#667eea',
                        title: 'Pending Review',
                        value: '0',
                        description: 'Requirements to review',
                        action: () => Navigation.navigateTo('requirements')
                    },
                    {
                        icon: '📤',
                        iconBg: '#f093fb',
                        title: 'To Upload',
                        value: '0',
                        description: 'CVs pending upload',
                        action: () => Navigation.navigateTo('cv-upload')
                    },
                    {
                        icon: '✅',
                        iconBg: '#4facfe',
                        title: 'Shortlisting',
                        value: '0',
                        description: 'Pending shortlist',
                        action: () => Navigation.navigateTo('shortlisting')
                    },
                    {
                        icon: '📞',
                        iconBg: '#fa709a',
                        title: 'Screening',
                        value: '0',
                        description: 'Pending calls',
                        action: () => Navigation.navigateTo('screening')
                    },
                    {
                        icon: '📅',
                        iconBg: '#43e97b',
                        title: 'Today\'s Walk-ins',
                        value: '0',
                        description: 'Scheduled today',
                        action: () => Navigation.navigateTo('walk-ins')
                    }
                ];
                break;
        }

        // Render cards
        let html = '';
        cards.forEach(card => {
            html += `
                <div class="card" style="cursor: pointer;" onclick="Navigation.navigateTo('${card.action ? card.action.toString().match(/'(.+)'/)[1] : 'dashboard'}')">
                    <div class="card-icon" style="background: ${card.iconBg}20; color: ${card.iconBg}">
                        ${card.icon}
                    </div>
                    <div class="card-title">${card.title}</div>
                    <div class="card-value" id="card-${card.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}">${card.value}</div>
                    <div class="card-description">${card.description}</div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Load actual counts
        this.loadCardCounts();
    },

    // Load card counts (will fetch from backend)
    loadCardCounts: async function() {
        // For now, using static data
        // In production, fetch from backend via API
        const role = Auth.getRole();

        // Simulate counts based on role
        const counts = {
            'Admin': {
                'card-total-users': 15,
                'card-requirements': 8,
                'card-applicants': 45,
                'card-interviews': 5
            },
            'EA': {
                'card-my-requirements': 3,
                'card-incomplete': 1,
                'card-approved': 2
            },
            'HR': {
                'card-pending-review': 4,
                'card-to-upload': 2,
                'card-shortlisting': 12,
                'card-screening': 8,
                'card-today-s-walk-ins': 3
            }
        };

        const roleCounts = counts[role] || {};

        for (const id in roleCounts) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = roleCounts[id];
            }
        }
    },

    // Load recent activities
    loadRecentActivities: function() {
        const tbody = document.querySelector('#recentActivities tbody');
        const role = Auth.getRole();

        // Sample data - replace with actual API call
        const activities = this.getSampleActivities(role);

        if (activities.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">No recent activities</td></tr>';
            return;
        }

        let html = '';
        activities.forEach(activity => {
            html += `
                <tr>
                    <td>${activity.description}</td>
                    <td>${Utils.getStatusBadge(activity.status)}</td>
                    <td>${Utils.formatDate(activity.date)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    // Get sample activities based on role
    getSampleActivities: function(role) {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        switch(role) {
            case 'Admin':
                return [
                    { description: 'New user created: hr@example.com', status: 'Active', date: now.toISOString() },
                    { description: 'Template updated: CRM Role', status: 'Active', date: yesterday.toISOString() },
                    { description: 'Permission modified: EA Role', status: 'Active', date: twoDaysAgo.toISOString() }
                ];

            case 'EA':
                return [
                    { description: 'Requirement raised: CRM Position', status: 'Pending Review', date: now.toISOString() },
                    { description: 'Requirement updated: MIS Position', status: 'Valid', date: yesterday.toISOString() },
                    { description: 'Requirement sent back: Jr. Accountant', status: 'Send Back', date: twoDaysAgo.toISOString() }
                ];

            case 'HR':
                return [
                    { description: '15 CVs uploaded for CRM position', status: 'Active', date: now.toISOString() },
                    { description: 'Interview scheduled: John Doe', status: 'Scheduled', date: now.toISOString() },
                    { description: 'Screening completed: 8 candidates', status: 'Active', date: yesterday.toISOString() },
                    { description: 'Job posted on Naukri.com', status: 'Active', date: twoDaysAgo.toISOString() },
                    { description: 'Requirement reviewed: Sr. Accountant', status: 'Valid', date: twoDaysAgo.toISOString() }
                ];

            default:
                return [];
        }
    }
};
