// App State (Global)
window.state = {
    activePanel: 'arcade', // 'arcade', 'devtools'
    activeGame: 'snake',   // 'snake', 'typing'
    dictLoaded: false,
    dictWords: null,
    toastTimeout: null
};

// Base URL Helper
window.getBaseUrl = () => {
    return window.location.origin + window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
};

// Toast Notifications Helper
window.showToast = (msg) => {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        toast.innerHTML = `<span class="toast-icon">✓</span> <span class="toast-message"></span>`;
        document.body.appendChild(toast);
    }
    toast.querySelector('.toast-message').innerText = msg;
    toast.classList.add('show');
    
    if (window.state.toastTimeout) clearTimeout(window.state.toastTimeout);
    window.state.toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
};

// Clipboard Copier Helper
window.copyToClipboard = (text, successMsg) => {
    navigator.clipboard.writeText(text).then(() => {
        window.showToast(successMsg || 'Copied to clipboard!');
    }).catch(err => {
        console.error('Error copying to clipboard:', err);
    });
};

// --- General Navigation Router ---
const setupNavigation = () => {
    // Top Tabs (Arcade vs DevTools)
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const target = btn.dataset.target;
            window.state.activePanel = target;
            
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`panel-${target}`).classList.add('active');
            
            // Trigger resets
            if (target === 'arcade') {
                if (window.state.activeGame === 'snake' && typeof window.resetSnake === 'function') {
                    window.resetSnake();
                }
            }
        });
    });

    // Arcade Sidebar selectors (Snake vs Typing)
    const gameBtns = document.querySelectorAll('.game-select-btn');
    gameBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            gameBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const game = btn.dataset.game;
            window.state.activeGame = game;
            
            // Stop other game loops
            if (typeof window.stopSnakeGame === 'function') window.stopSnakeGame();
            if (typeof window.stopTypingGame === 'function') window.stopTypingGame();
            
            document.querySelectorAll('.game-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`game-${game}`).classList.add('active');
            
            // Initialize selected game cabinet
            if (game === 'snake' && typeof window.resetSnake === 'function') {
                window.resetSnake();
            } else if (game === 'typing' && typeof window.resetTypingGame === 'function') {
                window.resetTypingGame();
            }
        });
    });
};

// --- CDN References Drawer ---
const setupCdnDrawer = () => {
    const header = document.getElementById('cdn-header');
    const body = document.getElementById('cdn-body');
    const arrow = document.getElementById('cdn-arrow');
    
    if (!header) return;

    header.addEventListener('click', () => {
        body.classList.toggle('open');
        arrow.classList.toggle('open');
    });

    // Populate URLs inside CDN cards
    document.querySelectorAll('.cdn-card-path').forEach(el => {
        const file = el.dataset.file;
        if (file) {
            el.innerText = `${window.getBaseUrl()}/assets/${file}`;
        }
    });

    document.querySelectorAll('.cdn-card-path').forEach(el => {
        el.addEventListener('click', () => {
            window.copyToClipboard(el.innerText, 'API URL copied!');
        });
    });
};

// Self-initialization
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupCdnDrawer();
});
