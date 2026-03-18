function injectNavbar() {
    const token = localStorage.getItem("token");
    
    // 1. The HTML Structure
    const navbarHTML = `
    <div class="grass-tree" onclick="showOverallProgress()">🌳</div>

    <header class="navbar">
        <div class="hamburger" id="hamburger">
            <span></span><span></span><span></span>
        </div>

        <div class="brand" onclick="window.location.href='index.html'">
            <img src="/images/OUR_LOGO.png" class="logo-img" alt="pimentor">
            <div class="logo-text">PiMentor</div>
        </div>

        <nav class="nav-links">
            <a href="index.html">Home</a>
            <a href="courses.html">All Courses</a>
            <a href="pishot_hub.html">PiShot</a>
            <a href="community.html">Community</a>
            <a href="support.html">Contact Us</a>
            
            <div class="desktop-theme-toggle">
                <label class="switch">
                    <input type="checkbox" id="themeToggleDesktop">
                    <span class="slider-round"></span>
                </label>
            </div>

            ${token ? `<a href="#" id="logoutBtnDesktop" class="logout-btn-desktop">Logout</a>` : `<a href="login.html" class="login-link">Login</a>`}
        </nav>
    </header>

    <aside class="sidebar" id="sidebar">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
            <div class="logo-text" style="color: var(--text);">Menu</div>
            <button id="closeSidebar" style="background:none; border:none; color:var(--text); font-size:2.5rem; cursor:pointer;">&times;</button>
        </div>
        
        <div class="theme-switch-wrapper">
            <span style="font-weight:700;">Dark Theme</span>
            <label class="switch">
                <input type="checkbox" id="themeToggleMobile">
                <span class="slider-round"></span>
            </label>
        </div>

        <nav class="sidebar-links">
            <a href="index.html">Home</a>
            <a href="courses.html">All Courses</a>
            <a href="pishot_hub.html">PiShot</a>
            <a href="community.html">Community</a>
            <a href="support.html">Contact Us</a>
            ${token ? `
            <div style="margin-top:auto; padding-top:20px; border-top:1px solid var(--card-border);">
                <a href="#" id="logoutBtnMobile" style="color:#ff4d4d; font-weight: 800;">Logout</a>
            </div>` : ''}
        </nav>
    </aside>
    `;

    document.getElementById('global-navbar-container').innerHTML = navbarHTML;
    setupNavbarLogic();
}

function setupNavbarLogic() {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    const closeSidebar = document.getElementById('closeSidebar');
    const themeToggles = [document.getElementById('themeToggleDesktop'), document.getElementById('themeToggleMobile')];

    // Toggle Sidebar
    hamburger.onclick = () => sidebar.classList.add('active');
    closeSidebar.onclick = () => sidebar.classList.remove('active');

    // Theme Logic
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggles.forEach(t => { if(t) t.checked = currentTheme === 'dark' });

    themeToggles.forEach(toggle => {
        if(!toggle) return;
        toggle.onchange = (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            // Sync the other toggle
            themeToggles.forEach(t => { if(t) t.checked = e.target.checked });
        };
    });

    // Logout Logic
    const logout = () => {
        localStorage.clear();
        window.location.href = 'login.html';
    };
    if(document.getElementById('logoutBtnDesktop')) document.getElementById('logoutBtnDesktop').onclick = logout;
    if(document.getElementById('logoutBtnMobile')) document.getElementById('logoutBtnMobile').onclick = logout;
}

// Run on load
document.addEventListener('DOMContentLoaded', injectNavbar);