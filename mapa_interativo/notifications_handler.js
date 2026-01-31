/**
 * notifications_handler.js
 * Gerencia o sistema de notificações (Sininho) na Sidebar
 */

class NotificationsHandler {
    constructor() {
        this.supabase = window.supabaseApp;
        this.userId = null;
        this.notifications = [];
        this.unreadCount = 0;

        this.init();
    }

    async init() {
        console.log('[Notifications] Initializing system...');

        // As the app uses a custom localStorage login, we don't strictly need a Supabase session 
        // to show notifications if RLS allows anon access.
        this.setupUI();
        this.fetchNotifications();
        this.subscribeToRealtime();

        // Optional: listen for custom login to refresh
        window.addEventListener('app-initialized', () => this.fetchNotifications());
    }

    setupUI() {
        // Find Sidebar Header Actions container
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) return;

        // Create Bell Button if not exists
        let btn = document.getElementById('btnNotifications');

        if (!btn) {
            console.warn("⚠️ Notification button not found in HTML. Notifications UI disabled.");
            return;
        }

        // Attach listeners to EXISTING button
        btn.onclick = (e) => this.toggleDropdown(e);
        btn.onmouseover = () => { if (this.unreadCount === 0) btn.style.color = '#3b82f6'; };
        btn.onmouseout = () => { if (this.unreadCount === 0) btn.style.color = '#666'; };

        // No need to appendChild as it is in HTML
        // headerActions.appendChild(btn);

        // Create Dropdown Container (Hidden)
        const dropdown = document.createElement('div');
        dropdown.id = 'notifDropdown';
        dropdown.className = 'notif-dropdown';
        dropdown.style.cssText = `
            display: none;
            position: absolute;
            top: 60px;
            left: 280px; /* Adjust based on sidebar width */
            width: 300px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            z-index: 10000;
            overflow: hidden;
            border: 1px solid #e5e7eb;
        `;
        // Keep it simple, append to body or sidebar? 
        // If sidebar has overflow hidden, might cut off. Appending to body is safer for absolute positioning.
        document.body.appendChild(dropdown);

        // Close dropdown on click outside
        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    async fetchNotifications() {
        try {
            const { data, error } = await this.supabase
                .from('notificacoes')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            this.notifications = data || [];
            this.updateBadge();
        } catch (e) {
            console.error('[Notifications] Error fetching:', e);
        }
    }

    subscribeToRealtime() {
        this.supabase
            .channel('public:notificacoes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes' }, payload => {
                console.log('[Notifications] New notification!', payload);
                this.notifications.unshift(payload.new);
                this.updateBadge();
                this.showToast(payload.new);
            })
            .subscribe();
    }

    updateBadge() {
        this.unreadCount = this.notifications.filter(n => !n.lida).length;
        const badge = document.getElementById('notifBadge');
        const btn = document.getElementById('btnNotifications');

        if (badge) {
            badge.innerText = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'block' : 'none';
        }

        if (btn) {
            // Se houver notificações não lidas, o sino fica dourado/amarelo, senão cinza
            btn.style.color = this.unreadCount > 0 ? '#f59e0b' : '#666';
        }
    }

    renderDropdown() {
        const dropdown = document.getElementById('notifDropdown');
        if (!dropdown) return;

        // Position it dynamically near button
        const btn = document.getElementById('btnNotifications');
        const rect = btn.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + 10}px`;
        dropdown.style.left = `${rect.left}px`;

        let html = `
            <div style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; display:flex; justify-content:space-between;">
                <span>Notificações</span>
                <button onclick="window.NotificationsHandler.markAllRead()" style="border:none; background:transparent; color:#2563eb; cursor:pointer; font-size:0.8rem;">Marcar todas lidas</button>
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
        `;

        if (this.notifications.length === 0) {
            html += `<div style="padding: 20px; text-align: center; color: #999;">Nenhuma notificação recente.</div>`;
        } else {
            this.notifications.forEach(n => {
                const icon = n.tipo === 'certidao' ? '📄' : '🔔';
                const bg = n.lida ? 'white' : '#f0f9ff';
                const date = new Date(n.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                html += `
                    <div class="notif-item" onclick="window.NotificationsHandler.handleClick('${n.id}', '${n.link_url}')" 
                         style="padding: 12px; border-bottom: 1px solid #eee; background: ${bg}; cursor: pointer; transition: background 0.2s;">
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <div style="font-size: 1.2rem;">${icon}</div>
                            <div>
                                <div style="font-weight: 600; font-size: 0.9rem; color: #333;">${n.titulo}</div>
                                <div style="font-size: 0.85rem; color: #666; margin-top: 2px;">${n.mensagem}</div>
                                <div style="font-size: 0.75rem; color: #999; margin-top: 4px;">${date}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        dropdown.innerHTML = html;
    }

    toggleDropdown(e) {
        e.stopPropagation();
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
        } else {
            this.renderDropdown();
            dropdown.style.display = 'block';
        }
    }

    async handleClick(id, url) {
        // Mark as read
        const notif = this.notifications.find(n => n.id === id);
        if (notif && !notif.lida) {
            notif.lida = true;
            this.updateBadge();
            // Async update DB
            this.supabase.from('notificacoes').update({ lida: true }).eq('id', id).then();
        }

        // Open URL
        if (url) {
            if (window.Infosimples && window.Infosimples.verComprovante) {
                window.Infosimples.verComprovante(url);
            } else {
                window.open(url, '_blank');
            }
        }

        // Refresh dropdown UI if open to show white background
        this.renderDropdown();
    }

    async markAllRead() {
        this.notifications.forEach(n => n.lida = true);
        this.updateBadge();
        this.renderDropdown();
        await this.supabase.from('notificacoes').update({ lida: true }).neq('lida', true);
    }

    showToast(n) {
        // Reuse existing toast system
        const toast = document.createElement('div');
        toast.className = 'toast info'; // Classes from toast_styles.css
        toast.style.cursor = 'pointer';
        toast.onclick = (e) => {
            if (!e.target.classList.contains('toast-close')) {
                this.handleClick(n.id, n.link_url);
                toast.remove();
            }
        };
        toast.innerHTML = `
            <div class="toast-icon">📄</div>
            <div class="toast-content" style="flex:1;">
                <div class="toast-title">${n.titulo}</div>
                <div class="toast-message">${n.mensagem}</div>
            </div>
            <div class="toast-close" onclick="event.stopPropagation(); this.parentElement.remove()">×</div>
        `;
        document.getElementById('toast-container')?.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
}

// Global instance
window.addEventListener('DOMContentLoaded', () => {
    // Wait for Supabase to be ready
    setTimeout(() => {
        window.NotificationsHandler = new NotificationsHandler();
    }, 1000);
});
