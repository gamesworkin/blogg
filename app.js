// ==========================================
// CONFIGURAÇÃO DO FIREBASE (INSIRA SEUS DADOS AQUI)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCRIQZdBjolh7fadpCqPh6ahr64sBIZy7o",
  authDomain: "blog-workin.firebaseapp.com",
  databaseURL: "https://blog-workin-default-rtdb.firebaseio.com",
  projectId: "blog-workin",
  storageBucket: "blog-workin.firebasestorage.app",
  messagingSenderId: "331204790714",
  appId: "1:331204790714:web:ec65d20ec4b454e51cb583"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, push, remove, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const ADMIN_EMAIL = "admin@admin.com";

// Estado da Aplicação
let allPosts = [];
let allTags = [];
let currentPage = 1;
let postsPerPage = 5;
let searchQuery = "";
let selectedTagFilter = "";

// Elementos DOM
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const adminTriggerBtn = document.getElementById('admin-trigger-btn');
const loginModal = document.getElementById('login-modal');
const adminModal = document.getElementById('admin-modal');
const postModal = document.getElementById('post-modal');
const closeLogin = document.getElementById('close-login');
const closeAdmin = document.getElementById('close-admin');
const closePostModal = document.getElementById('close-post-modal');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const hamburgerBtn = document.getElementById('hamburger-btn');
const siteNav = document.getElementById('site-nav');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');

// --- TEMA (DARK / LIGHT) ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fa-solid fa-sun';
    } else {
        icon.className = 'fa-solid fa-moon';
    }
}

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

initTheme();

// --- MENU HAMBÚRGUER ---
hamburgerBtn.addEventListener('click', () => {
    siteNav.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if (e.target.matches('.site-nav a')) {
        siteNav.classList.remove('active');
    }
});

// --- CARREGAR CONFIGURAÇÕES GERAIS ---
async function loadSettings() {
    try {
        const snapshot = await get(child(ref(db), 'settings'));
        if (snapshot.exists()) {
            const data = snapshot.val();
            document.getElementById('site-title').innerText = data.title || "Meu Blog Moderno";
            document.getElementById('setting-title').value = data.title || "";
            
            const logoImg = document.getElementById('site-logo-img');
            const logoText = document.getElementById('site-logo-text');
            if (data.logo) {
                logoImg.src = data.logo;
                logoImg.style.display = 'block';
                logoText.style.display = 'none';
                document.getElementById('setting-logo').value = data.logo;
            } else {
                logoImg.style.display = 'none';
                logoText.style.display = 'flex';
            }
            if (data.favicon) {
                document.getElementById('site-favicon').href = data.favicon;
                document.getElementById('setting-favicon').value = data.favicon;
            }
            if (data.perPage) {
                postsPerPage = parseInt(data.perPage);
                document.getElementById('setting-per-page').value = data.perPage;
            }
        }
    } catch (error) {
        console.error("Erro ao carregar configurações:", error);
    }
}

// --- CARREGAR MENUS ---
async function loadMenus() {
    const menuList = document.getElementById('menu-list');
    const adminMenuList = document.getElementById('admin-menu-list');
    menuList.innerHTML = '';
    adminMenuList.innerHTML = '';

    try {
        const snapshot = await get(child(ref(db), 'menus'));
        let menus = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                menus.push({ id: childSnapshot.key, ...childSnapshot.val() });
            });
        }

        if (menus.length === 0) {
            menus = [{ id: 'default', name: 'Início', url: 'index.html' }];
        }

        menus.forEach(menu => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="${menu.url}">${menu.name}</a>`;
            menuList.appendChild(li);

            const adminLi = document.createElement('div');
            adminLi.className = 'admin-list-item';
            adminLi.innerHTML = `<span><b>${menu.name}</b> (${menu.url})</span> <button type="button" class="btn-danger" onclick="deleteMenu('${menu.id}')"><i class="fa-solid fa-trash"></i></button>`;
            adminMenuList.appendChild(adminLi);
        });
    } catch (error) {
        console.error("Erro ao carregar menus:", error);
    }
}

window.deleteMenu = async function(id) {
    if (confirm("Deseja excluir este item do menu?")) {
        try {
            await remove(ref(db, 'menus/' + id));
            loadMenus();
        } catch (error) {
            alert("Erro ao excluir: " + error.message);
        }
    }
}

// --- CARREGAR MARCADORES (TAGS) ---
async function loadTags() {
    const sidebarTags = document.getElementById('sidebar-tags');
    const adminTagsList = document.getElementById('admin-tags-list');
    sidebarTags.innerHTML = '';
    adminTagsList.innerHTML = '';

    try {
        const snapshot = await get(child(ref(db), 'tags'));
        allTags = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                allTags.push({ id: childSnapshot.key, ...childSnapshot.val() });
            });
        }

        // Renderizar tags na Sidebar
        if (allTags.length === 0) {
            sidebarTags.innerHTML = `<span style="font-size:0.85rem; color:#888;">Nenhum marcador</span>`;
        } else {
            const allBtn = document.createElement('button');
            allBtn.type = 'button';
            allBtn.className = `tag-badge ${selectedTagFilter === '' ? 'active' : ''}`;
            allBtn.style.cursor = 'pointer';
            allBtn.innerHTML = `<b>Todos</b>`;
            allBtn.onclick = () => { selectedTagFilter = ''; currentPage = 1; renderPosts(); loadTags(); };
            sidebarTags.appendChild(allBtn);

            allTags.forEach(tag => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `tag-badge ${selectedTagFilter === tag.name ? 'active' : ''}`;
                btn.style.cursor = 'pointer';
                btn.innerHTML = `${tag.name}`;
                btn.onclick = () => { selectedTagFilter = tag.name; currentPage = 1; renderPosts(); loadTags(); };
                sidebarTags.appendChild(btn);
            });
        }

        // Renderizar no painel admin
        allTags.forEach(tag => {
            const item = document.createElement('div');
            item.className = 'admin-list-item';
            item.innerHTML = `
                <span><b>${tag.name}</b></span>
                <button type="button" class="btn-danger" onclick="deleteTag('${tag.id}')"><i class="fa-solid fa-trash"></i></button>
            `;
            adminTagsList.appendChild(item);
        });
    } catch (error) {
        console.error("Erro ao carregar tags:", error);
    }
}

window.deleteTag = async function(id) {
    if (confirm("Deseja excluir este marcador?")) {
        try {
            await remove(ref(db, 'tags/' + id));
            loadTags();
        } catch (error) {
            alert("Erro ao excluir tag: " + error.message);
        }
    }
}

// --- CARREGAR POSTS E CASCATA ---
async function loadPosts() {
    try {
        const snapshot = await get(child(ref(db), 'posts'));
        allPosts = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                allPosts.push({ id: childSnapshot.key, ...childSnapshot.val() });
            });
            allPosts.sort((a, b) => b.date - a.date);
        }
        renderPosts();
        renderAdminPosts();
    } catch (error) {
        console.error("Erro ao carregar posts:", error);
    }
}

function renderPosts() {
    const container = document.getElementById('posts-container');
    container.innerHTML = '';

    let filtered = allPosts;
    
    if (searchQuery) {
        filtered = filtered.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.summary.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (selectedTagFilter) {
        filtered = filtered.filter(p => p.tags && p.tags.toLowerCase().includes(selectedTagFilter.toLowerCase()));
    }

    const totalPages = Math.ceil(filtered.length / postsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * postsPerPage;
    const paginatedPosts = filtered.slice(start, start + postsPerPage);

    if (paginatedPosts.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding: 20px;">Nenhum post encontrado.</p>`;
        renderPagination(1, 1);
        return;
    }

    paginatedPosts.forEach(post => {
        const card = document.createElement('article');
        card.className = 'post-card';
        
        let tagsHtml = '';
        if (post.tags) {
            const tagArray = post.tags.split(',').map(t => t.trim()).filter(t => t);
            tagsHtml = `<div class="post-tags-container">` + tagArray.map(t => `<span class="tag-badge">#${t}</span>`).join('') + `</div>`;
        }

        card.innerHTML = `
            ${post.image ? `<img src="${post.image}" class="post-img" alt="${post.title}">` : ''}
            <div class="post-body">
                <div class="post-meta-info">
                    <span><i class="fa-regular fa-calendar"></i> ${new Date(post.date).toLocaleDateString('pt-BR')}</span>
                    ${post.category ? `<span><i class="fa-solid fa-folder"></i> ${post.category}</span>` : ''}
                    ${post.author ? `<span><i class="fa-solid fa-user"></i> ${post.author}</span>` : ''}
                </div>
                <h2 class="post-title">${post.title}</h2>
                <div class="post-summary">${post.summary}</div>
                ${tagsHtml}
            </div>
        `;

        card.addEventListener('click', () => {
            openPostModal(post);
        });

        container.appendChild(card);
    });

    renderPagination(totalPages, currentPage);
}

// Abrir Modal perfeitamente enquadrado com conteúdo completo e imagens redimensionadas
function openPostModal(post) {
    const modalContainer = document.getElementById('modal-post-container');
    let tagsHtml = '';
    if (post.tags) {
        const tagArray = post.tags.split(',').map(t => t.trim()).filter(t => t);
        tagsHtml = `<div class="post-tags-container" style="margin-top: 20px;">` + tagArray.map(t => `<span class="tag-badge">#${t}</span>`).join('') + `</div>`;
    }

    modalContainer.innerHTML = `
        ${post.image ? `<img src="${post.image}" style="width:100\%; max-height:400px; object-fit:cover; border-radius:8px; margin-bottom:20px;" alt="${post.title}">` : ''}
        <div class="post-meta-info" style="margin-bottom: 12px;">
            <span><i class="fa-regular fa-calendar"></i> ${new Date(post.date).toLocaleDateString('pt-BR')}</span>
            ${post.category ? `<span><i class="fa-solid fa-folder"></i> ${post.category}</span>` : ''}
            ${post.author ? `<span><i class="fa-solid fa-user"></i> ${post.author}</span>` : ''}
        </div>
        <h1 style="font-size: 1.8rem; margin-bottom: 15px; color: var(--text-color); line-height: 1.3;">${post.title}</h1>
        <div class="post-full-html-content" style="line-height: 1.7; font-size: 1.05rem; overflow-wrap: break-word;">${post.content}</div>
        ${tagsHtml}
    `;
    postModal.style.display = 'flex';
}

closePostModal.addEventListener('click', () => postModal.style.display = 'none');

// --- PAGINAÇÃO INTELIGENTE ---
function renderPagination(totalPages, current) {
    const container = document.getElementById('pagination-container');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    if (current > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'page-btn';
        prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left"></i>`;
        prevBtn.onclick = () => { currentPage--; renderPosts(); };
        container.appendChild(prevBtn);
    }

    let startPage = Math.max(1, current - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `page-btn ${i === current ? 'active' : ''}`;
        btn.innerText = i;
        btn.onclick = () => { currentPage = i; renderPosts(); };
        container.appendChild(btn);
    }

    if (current < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'page-btn';
        nextBtn.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
        nextBtn.onclick = () => { currentPage++; renderPosts(); };
        container.appendChild(nextBtn);
    }
}

// Pesquisa
searchBtn.addEventListener('click', () => {
    searchQuery = searchInput.value.trim();
    currentPage = 1;
    renderPosts();
});
searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        searchQuery = searchInput.value.trim();
        currentPage = 1;
        renderPosts();
    }
});

// --- AUTENTICAÇÃO E CONTROLE DO ADMIN ---
onAuthStateChanged(auth, (user) => {
    adminTriggerBtn.classList.remove('spin-animation');
    if (user && user.email === ADMIN_EMAIL) {
        adminTriggerBtn.style.opacity = '1';
    } else {
        adminTriggerBtn.style.opacity = '0.4';
    }
});

adminTriggerBtn.addEventListener('click', () => {
    adminTriggerBtn.classList.add('spin-animation');
    const user = auth.currentUser;
    setTimeout(() => {
        adminTriggerBtn.classList.remove('spin-animation');
        if (user && user.email === ADMIN_EMAIL) {
            adminModal.style.display = 'flex';
        } else {
            loginModal.style.display = 'flex';
        }
    }, 600);
});

closeLogin.addEventListener('click', () => loginModal.style.display = 'none');
closeAdmin.addEventListener('click', () => adminModal.style.display = 'none');

window.addEventListener('click', (e) => {
    if (e.target === loginModal) loginModal.style.display = 'none';
    if (e.target === adminModal) adminModal.style.display = 'none';
    if (e.target === postModal) postModal.style.display = 'none';
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    try {
        const userCred = await signInWithEmailAndPassword(auth, email, pass);
        if (userCred.user.email === ADMIN_EMAIL) {
            loginModal.style.display = 'none';
            adminModal.style.display = 'flex';
            loginForm.reset();
        } else {
            alert("Acesso negado. Apenas o administrador.");
            signOut(auth);
        }
    } catch (error) {
        alert("Erro no login: " + error.message);
    }
});

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    adminModal.style.display = 'none';
    alert("Deslogado com sucesso.");
});

// Abas do Painel Admin
const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
    });
});

// --- GERENCIAMENTO DE POSTS (ADMIN) ---
function renderAdminPosts() {
    const list = document.getElementById('admin-posts-list');
    list.innerHTML = '';
    allPosts.forEach(post => {
        const item = document.createElement('div');
        item.className = 'admin-list-item';
        item.innerHTML = `
            <span><b>${post.title}</b></span>
            <div>
                <button type="button" class="btn-primary" onclick="editPost('${post.id}')" style="padding: 5px 10px; margin-right: 5px; width: auto;"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn-danger" onclick="deletePost('${post.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
}

const postForm = document.getElementById('post-form');
postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('post-id').value;
    const title = document.getElementById('post-title').value;
    const category = document.getElementById('post-category').value;
    const author = document.getElementById('post-author').value;
    const tags = document.getElementById('post-tags').value;
    const summary = document.getElementById('post-summary').value;
    const content = document.getElementById('post-content').value; // Conteúdo HTML Gigante / Infinito
    const image = document.getElementById('post-image').value;

    const postData = {
        title,
        category,
        author,
        tags,
        summary,
        content,
        image,
        date: Date.now()
    };

    try {
        if (id) {
            await set(ref(db, 'posts/' + id), postData);
        } else {
            const newPostRef = push(ref(db, 'posts'));
            await set(newPostRef, postData);
        }

        postForm.reset();
        document.getElementById('post-id').value = '';
        loadPosts();
        alert("Post salvo com sucesso!");
    } catch (error) {
        alert("Erro ao salvar post: " + error.message);
    }
});

window.editPost = function(id) {
    const post = allPosts.find(p => p.id === id);
    if (post) {
        document.getElementById('post-id').value = post.id;
        document.getElementById('post-title').value = post.title;
        document.getElementById('post-category').value = post.category || '';
        document.getElementById('post-author').value = post.author || '';
        document.getElementById('post-tags').value = post.tags || '';
        document.getElementById('post-summary').value = post.summary;
        document.getElementById('post-content').value = post.content;
        document.getElementById('post-image').value = post.image || '';
    }
}

window.deletePost = async function(id) {
    if (confirm("Tem certeza que deseja excluir este post?")) {
        try {
            await remove(ref(db, 'posts/' + id));
            loadPosts();
        } catch (error) {
            alert("Erro ao excluir post: " + error.message);
        }
    }
}

// --- GERENCIAMENTO DE MARCADORES (TAGS) - ADMIN ---
const tagForm = document.getElementById('tag-form');
tagForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('tag-name').value.trim();
    if (!name) return;

    try {
        const newTagRef = push(ref(db, 'tags'));
        await set(newTagRef, { name });
        tagForm.reset();
        loadTags();
        alert("Marcador adicionado!");
    } catch (error) {
        alert("Erro ao adicionar marcador: " + error.message);
    }
});

// --- GERENCIAMENTO DE MENUS (ADMIN) ---
const menuForm = document.getElementById('menu-form');
menuForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('menu-name').value;
    const url = document.getElementById('menu-url').value;

    try {
        const newMenuRef = push(ref(db, 'menus'));
        await set(newMenuRef, { name, url });

        menuForm.reset();
        loadMenus();
        alert("Menu adicionado!");
    } catch (error) {
        alert("Erro ao adicionar menu: " + error.message);
    }
});

// --- CONFIGURAÇÕES DE LAYOUT & APARÊNCIA (ADMIN) ---
const layoutForm = document.getElementById('layout-form');
layoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('setting-title').value;
    const logo = document.getElementById('setting-logo').value;
    const favicon = document.getElementById('setting-favicon').value;
    const perPage = document.getElementById('setting-per-page').value;

    const settingsData = { title, logo, favicon, perPage };
    try {
        await set(ref(db, 'settings'), settingsData);
        loadSettings();
        alert("Configurações atualizadas com sucesso!");
    } catch (error) {
        alert("Erro ao atualizar configurações: " + error.message);
    }
});

// --- GERADOR DE PÁGINAS (ZIP) ---
document.getElementById('download-zip-btn').addEventListener('click', async () => {
    const subpageName = document.getElementById('subpage-name').value.trim() || 'subpagina';
    const zip = new JSZip();

    const subHtml = `<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subpageName.toUpperCase()} - Subpágina</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <header class="site-header">
        <div class="header-container">
            <div class="logo-area">
                <h1><i class="fa-solid fa-folder-open"></i> ${subpageName}</h1>
            </div>
            <nav class="site-nav">
                <ul>
                    <li><a href="../index.html"><i class="fa-solid fa-house"></i> Voltar ao Início</a></li>
                </ul>
            </nav>
        </div>
    </header>
    <main class="main-container" style="display: block;">
        <div class="widget">
            <h3>Conteúdo da Subpágina</h3>
            <p>Esta é uma subpágina gerada automaticamente. Edite este arquivo HTML conforme sua necessidade.</p>
        </div>
    </main>
    <footer class="site-footer">
        <p>&copy; 2026 - Subpágina hospedada no GitHub Pages.</p>
    </footer>
</body>
</html>`;

    zip.file("index.html", subHtml);
    
    try {
        const cssResponse = await fetch('style.css');
        const cssText = await cssResponse.text();
        zip.file("style.css", cssText);
    } catch (e) {
        zip.file("style.css", "/* Estilo padrão */");
    }

    zip.generateAsync({ type: "blob" }).then((content) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${subpageName}.zip`;
        link.click();
    });
});

// Inicialização Geral
loadSettings();
loadMenus();
loadTags();
loadPosts();
