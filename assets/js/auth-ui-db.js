/**
 * NexCore Labs - Authentication UI
 * Eligibility is enforced by the Supabase Auth hook. Sensitive access lists are
 * only available through the authenticated serverless admin API.
 */

(function() {
    'use strict';

    const sb = window.supabaseClient;
    const AUTH_NOTICE_KEY = 'auth_notice';
    let isEnforcingEmailDomain = false;
    const isArabicPage = (document.documentElement.getAttribute('lang') || '').toLowerCase().startsWith('ar') ||
        /(^|\/)ar(\/|$)/.test(window.location.pathname);
    const routePrefix = isArabicPage ? '/ar' : '';
    const copy = isArabicPage ? {
        lang: 'ar',
        dir: 'rtl',
        restrictedEmail: 'الوصول متاح حالياً لحسابات جامعة السلطان قابوس المؤهلة فقط. الوصول الخارجي متوقف مؤقتاً.',
        signInTitle: 'تسجيل الدخول',
        accessCore: 'استكشف الجوهر',
        dashboardTitle: 'لوحة التحكم',
        dashboard: 'لوحة التحكم',
        adminTitle: 'لوحة الإدارة',
        admin: 'لوحة الإدارة',
        accountTitle: 'إعدادات الحساب',
        account: 'إعدادات الحساب',
        accountActionsTitle: 'إجراءات الحساب',
        logoutTitle: 'تسجيل الخروج',
        logout: 'تسجيل الخروج',
        logoutFailed: 'تعذر تسجيل الخروج. يرجى المحاولة مرة أخرى.',
    } : {
        lang: 'en',
        dir: 'ltr',
        restrictedEmail: 'Access is currently limited to eligible SQU email addresses. External access is paused.',
        signInTitle: 'Sign In',
        accessCore: 'Access the Core',
        dashboardTitle: 'Dashboard',
        dashboard: 'Dashboard',
        adminTitle: 'Admin Panel',
        admin: 'Admin Panel',
        accountTitle: 'Account Settings',
        account: 'Account Settings',
        accountActionsTitle: 'Account actions',
        logoutTitle: 'Logout',
        logout: 'Logout',
        logoutFailed: 'Failed to logout. Please try again.',
    };

    if (!sb) {
        console.error('Supabase client not found. Make sure supabase-client.js is loaded first.');
        return;
    }

    function ensureInitiativesNavigation() {
        const menu = document.getElementById('myDropdown');
        if (!menu || menu.querySelector('[data-initiatives-nav]')) return;

        const hubLink = [...menu.querySelectorAll('a')].find((link) =>
            /(^|\/)hub(?:\.html)?(?:#|$)/.test(link.getAttribute('href') || '')
        );
        if (!hubLink) return;

        const link = document.createElement('a');
        link.href = isArabicPage ? '/ar/initiatives' : '/initiatives';
        link.dataset.initiativesNav = 'true';
        link.title = isArabicPage ? 'مبادرات NexCore Labs' : 'NexCore Labs Initiatives';
        link.innerHTML = `<i class="fa-solid fa-cube" aria-hidden="true"></i> ${isArabicPage ? 'المبادرات' : 'Initiatives'} <span class="new-badge">${isArabicPage ? 'جديد' : 'New'}</span>`;
        if (window.location.pathname.replace(/\/$/, '') === link.getAttribute('href')) {
            link.setAttribute('aria-current', 'page');
        }
        hubLink.insertAdjacentElement('beforebegin', link);
    }

    function ensureContributeNavigation() {
        const menu = document.getElementById('myDropdown');
        if (!menu || menu.querySelector('[data-contribute-nav]')) return;

        const initiativesGroup = menu.querySelector('[data-initiatives-nav-group]');
        const initiativesLink = menu.querySelector('[data-initiatives-nav]');
        const hubLink = [...menu.querySelectorAll('a')].find((link) =>
            /(^|\/)hub(?:\.html)?(?:#|$)/.test(link.getAttribute('href') || '')
        );
        const anchor = initiativesGroup || initiativesLink || hubLink;
        if (!anchor) return;

        const link = document.createElement('a');
        link.href = isArabicPage ? '/ar/contribute' : '/contribute';
        link.dataset.contributeNav = 'true';
        link.title = isArabicPage ? 'مركز المساهمين' : 'Contributor Center';
        link.innerHTML = `<i class="fa-solid fa-handshake-angle" aria-hidden="true"></i> ${isArabicPage ? 'مركز المساهمين' : 'Contributor Center'} <span class="new-badge">${isArabicPage ? 'جديد' : 'New'}</span>`;
        if (window.location.pathname.replace(/\/$/, '') === link.getAttribute('href')) {
            link.setAttribute('aria-current', 'page');
        }
        anchor.insertAdjacentElement('afterend', link);
    }

    function persistAuthNotice(message) {
        try {
            sessionStorage.setItem(AUTH_NOTICE_KEY, message);
        } catch (_) {}
    }

    async function enforceEmailDomain(session) {
        if (!session?.user) return false;
        // The Auth hook rejects unauthorized addresses before a session exists.
        // Do not enumerate the server-owned approved-user list in the browser.
        return true;
    }

    function getUserDisplayName(user) {
        const metadata = user?.user_metadata || {};
        const fullName = metadata.full_name || metadata.name || metadata.user_name || metadata.preferred_username;
        if (typeof fullName === 'string' && fullName.trim()) {
            return fullName.trim();
        }

        const email = typeof user?.email === 'string' ? user.email : '';
        if (email.includes('@')) return email.split('@')[0];
        return 'Member';
    }

    function getUserAvatar(user) {
        const metadata = user?.user_metadata || {};
        const avatar = metadata.avatar_url || metadata.picture || metadata.photo_url;
        if (typeof avatar === 'string' && /^https?:\/\//i.test(avatar.trim())) {
            return avatar.trim();
        }
        return '';
    }

    async function upsertUserProfile(user) {
        if (!user?.id) return;

        try {
            const payload = {
                id: user.id,
                email: user.email || null,
                name: getUserDisplayName(user),
                avatar_url: getUserAvatar(user) || null,
                updated_at: new Date().toISOString()
            };

            const { error } = await sb
                .from('users')
                .upsert(payload, { onConflict: 'id' });

            if (error) {
                console.warn('Profile upsert skipped:', error.message);
            }
        } catch (error) {
            console.warn('Profile upsert failed:', error?.message || error);
        }
    }

    // Create nav elements if they don't exist
    function ensureNavElements() {
        const dropdown = document.querySelector('.dropdown-content');
        if (!dropdown) return;

        // Check if elements already exist
        if (document.getElementById('navAuth') &&
            document.getElementById('navDashboard') &&
            document.getElementById('navAccount') &&
            document.getElementById('navAdmin') &&
            document.getElementById('navUser') &&
            document.getElementById('navLogout')) {
            return;
        }

        // Find the first menu item to insert after
        const firstMenuItem = dropdown.querySelector('a.magic-signup');

        if (firstMenuItem) {
            // Create auth elements HTML
            const authHTML = `
                <a href="${routePrefix}/auth.html" id="navAuth" class="magic-signup fade" title="${copy.signInTitle}" lang="${copy.lang}" dir="${copy.dir}" style="display: none;">
                    <i class="fa-solid fa-arrow-right-to-bracket"></i> ${copy.accessCore}
                </a>
                <div id="navUser" class="nav-user-toolbar" lang="${copy.lang}" dir="${copy.dir}" style="display: none;">
                    <span class="nav-user-identity">
                        <img id="navUserAvatar" class="nav-user-avatar" src="" alt="" style="display: none;">
                        <i id="navUserIcon" class="fa-solid fa-user" aria-hidden="true"></i>
                        <span id="navUserName"></span>
                    </span>
                    <span class="nav-user-actions" role="group" aria-label="${copy.accountActionsTitle}">
                        <a href="${routePrefix}/dashboard.html" id="navDashboard" class="nav-user-action" title="${copy.dashboardTitle}" aria-label="${copy.dashboardTitle}" lang="${copy.lang}" style="display: none;">
                        <i class="fa-solid fa-gauge" aria-hidden="true"></i>
                        </a>
                        <a href="${routePrefix}/account.html" id="navAccount" class="nav-user-action" title="${copy.accountTitle}" aria-label="${copy.accountTitle}" lang="${copy.lang}" style="display: none;">
                        <i class="fa-solid fa-gear" aria-hidden="true"></i>
                        </a>
                        <a href="${routePrefix}/admin-users.html" id="navAdmin" class="nav-user-action" title="${copy.adminTitle}" aria-label="${copy.adminTitle}" lang="${copy.lang}" style="display: none;">
                            <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
                        </a>
                        <button type="button" id="navLogout" class="nav-user-action nav-user-action--logout" title="${copy.logoutTitle}" aria-label="${copy.logoutTitle}" lang="${copy.lang}" style="display: none;">
                            <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
                        </button>
                    </span>
                </div>
            `;

            // Replace the first menu item with our auth elements
            firstMenuItem.outerHTML = authHTML;
        }
    }

    /**
     * Check if user is an admin
     */
    async function isUserAdmin(email) {
        if (!email) return false;

        try {
            const { data, error } = await sb.rpc('get_my_admin_status');
            return !error && data === true;
        } catch (err) {
            return false;
        }
    }

    // Update UI based on auth state
    async function updateAuthUI() {
        try {
            const { data: { session } } = await sb.auth.getSession();

            const navAuth = document.getElementById('navAuth');
            const navDashboard = document.getElementById('navDashboard');
            const navAdmin = document.getElementById('navAdmin');
            const navAccount = document.getElementById('navAccount');
            const navUser = document.getElementById('navUser');
            const navUserName = document.getElementById('navUserName');
            const navUserAvatar = document.getElementById('navUserAvatar');
            const navUserIcon = document.getElementById('navUserIcon');
            const navLogout = document.getElementById('navLogout');

            if (session && session.user) {
                const allowedSession = await enforceEmailDomain(session);
                if (!allowedSession) return;
                await upsertUserProfile(session.user);

                // Check if user is admin
                const userIsAdmin = await isUserAdmin(session.user.email);

                // User is logged in
                if (navAuth) navAuth.style.display = 'none';
                if (navDashboard) navDashboard.style.display = 'inline-flex';
                if (navAccount) navAccount.style.display = 'inline-flex';

                // Show admin button only for admins
                if (navAdmin) {
                    navAdmin.style.display = userIsAdmin ? 'inline-flex' : 'none';
                }

                if (navUser) {
                    navUser.style.display = 'flex';
                    if (navUserName) {
                        navUserName.textContent = getUserDisplayName(session.user);
                    }
                    if (navUserAvatar && navUserIcon) {
                        const avatarUrl = getUserAvatar(session.user);
                        if (avatarUrl) {
                            navUserAvatar.src = avatarUrl;
                            navUserAvatar.alt = getUserDisplayName(session.user);
                            navUserAvatar.style.display = 'inline-block';
                            navUserIcon.style.display = 'none';
                        } else {
                            navUserAvatar.removeAttribute('src');
                            navUserAvatar.style.display = 'none';
                            navUserIcon.style.display = 'inline-block';
                        }
                    }
                }
                if (navLogout) navLogout.style.display = 'inline-flex';

                // Send User-ID to GA4 for cross-device tracking
                setGAUserId(session.user.id);
            } else {
                // User is logged out
                clearGAUserId();
                if (navAuth) navAuth.style.display = 'block';
                if (navDashboard) navDashboard.style.display = 'none';
                if (navAdmin) navAdmin.style.display = 'none';
                if (navAccount) navAccount.style.display = 'none';
                if (navUser) navUser.style.display = 'none';
                if (navLogout) navLogout.style.display = 'none';
            }
        } catch (error) {
            console.error('Error updating auth UI:', error);
        }
    }

    // Logout function
    async function handleLogout(e) {
        e.preventDefault();

        try {
            const { error } = await sb.auth.signOut();
            if (error) throw error;

            // Redirect to auth page
            window.location.href = `${routePrefix}/auth.html`;
        } catch (error) {
            console.error('Logout error:', error);
            alert(copy.logoutFailed);
        }
    }

    // ─── GA4 User-ID helpers ────────────────────────────────────────────

    function setGAUserId(userId) {
        if (typeof window.gtag === 'function' && userId) {
            window.gtag('config', 'G-PYZB5L2R8W', { user_id: userId });
        }
    }

    function clearGAUserId() {
        if (typeof window.gtag === 'function') {
            window.gtag('config', 'G-PYZB5L2R8W', { user_id: undefined });
        }
    }

    // Initialize
    function init() {
        ensureInitiativesNavigation();
        ensureContributeNavigation();
        window.NexCoreInitiativesMenu?.init();
        // Ensure nav elements exist
        ensureNavElements();

        // Set up logout handler
        const logoutBtn = document.getElementById('navLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // Update UI initially
        updateAuthUI();

        // Listen for auth state changes
        sb.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            if (event === 'SIGNED_IN' && session?.user) {
                const allowedSession = await enforceEmailDomain(session);
                if (!allowedSession) {
                    updateAuthUI();
                    return;
                }
            }
            updateAuthUI();
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose updateAuthUI globally for manual calls if needed
    window.updateAuthUI = updateAuthUI;

    async function adminAccessRequest(method, payload) {
        const { data: { session } } = await sb.auth.getSession();
        if (!session?.access_token) throw new Error('Administrator session required');
        const response = await fetch('/api/admin/access', {
            method,
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || body.error || 'Access request failed');
        return body;
    }

    // Compatibility helpers for admin surfaces; all writes are server-authorized.
    window.addApprovedUser = async function(email, approvedBy, reason) {
        try {
            const data = await adminAccessRequest('POST', { resource: 'approved_users', email, reason });
            return { success: true, data };
        } catch (error) {
            console.error('Failed to add approved user:', error);
            return { success: false, error: error.message };
        }
    };

    // Expose function to remove approved users
    window.removeApprovedUser = async function(email) {
        try {
            await adminAccessRequest('DELETE', { resource: 'approved_users', email });
            return { success: true };
        } catch (error) {
            console.error('Failed to remove approved user:', error);
            return { success: false, error: error.message };
        }
    };
})();
