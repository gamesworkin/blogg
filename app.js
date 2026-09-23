// ==========================================
// CONFIGURAÇÃO DO FIREBASE (INSIRA SEUS DADOS AQUI)
// ==========================================
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
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
let currentPage = 1;
let postsPerPage = 5;
let searchQuery = "";

// Elementos DOM
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const adminTriggerBtn = document.getElementById('admin-trigger-btn');
const loginModal = document.getElementById('login-modal');
const adminModal = document.getElementById('admin-modal');
const closeLogin = document.getElementById('close-login');
const closeAdmin = document.getElementById('close-admin');
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

// --- CARREGAR CONFIGURAÇÕES GERAIS ---
async function loadSettings() {
    try {
        const snapshot = await get(child(ref(db), 'settings'));
        if (snapshot.exists()) {
            const data = snapshot.val();
            document.getElementById('site-title').innerText = data.title || "Meu Blog Moderno";
            document.getElementById('setting-title').value = data.title || "";
            
            if (data.logo) {
                document.getElementById('site-logo-img').src = data.logo;
                document.getElementById('site-logo-img').style.display = 'block';
                document.getElementById('site-logo-text').style.display = 'none';
                document.getElementById('setting-logo').value = data.logo;
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

        // Menu Padrão Inicial se vazio
        if (menus.length === 0) {
            menus = [{ id: 'default', name: 'Início', url: 'index.html' }];
        }

        menus.forEach(menu => {
            // Renderizar no site
            const li = document.createElement('li');
            li.innerHTML = `<a href="${menu.url}">${menu.name}</a>`;
            menuList.appendChild(li);

            // Renderizar no painel admin
            const adminLi = document.createElement('div');
            adminLi.className = 'admin-list-item';
            adminLi.innerHTML = `<span><b>${menu.name}</b> (${menu.url})</span> <button class="btn-danger" onclick="deleteMenu('${menu.id}')"><i class="fa-solid fa-trash"></i></button>`;
            adminMenuList.appendChild(adminLi);
        });
    } catch (error) {
        console.error("Erro ao carregar menus:", error);
    }
}

window.deleteMenu = async function(id) {
    if (confirm("Deseja excluir este item do menu?")) {
        await remove(ref(db, 'menus/' + id));
        loadMenus();
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
            // Ordenar por data decrescente
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

    // Filtragem por pesquisa
    let filtered = allPosts;
    if (searchQuery) {
        filtered = allPosts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.summary.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Paginação
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
        card.innerHTML = `
            ${post.image ? `<img src="${post.image}" class="post-img" alt="${post.title}">` : ''}
            <div class="post-body">
                <h2 class="post-title">${post.title}</h2>
                <div class="post-date"><i class="fa-regular fa-calendar"></i> ${new Date(post.date).toLocaleDateString('pt-BR')}</div>
                <div class="post-summary">${post.summary}</div>
                <div class="post-full-content" style="display:none; margin-top:15px;">${post.content}</div>
                <button class="btn-primary" onclick="toggleReadMore(this)" style="width: auto; padding: 6px 15px; font-size: 0.9rem;">Ler Mais</button>
            </div>
        `;
        container.appendChild(card);
    });

    renderPagination(totalPages, currentPage);
}

window.toggleReadMore = function(btn) {
    const body = btn.previousElementSibling;
    if (body.style.display === 'none') {
        body.style.display = 'block';
        btn.innerText = 'Ler Menos';
    } else {
        body.style.display = 'none';
        btn.innerText = 'Ler Mais';
    }
}

// --- PAGINAÇÃO INTELIGENTE (MAX 5 NÚMEROS + SETAS) ---
function renderPagination(totalPages, current) {
    const container = document.getElementById('pagination-container');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    // Botão Anterior (<)
    if (current > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left"></i>`;
        prevBtn.onclick = () => { currentPage--; renderPosts(); };
        container.appendChild(prevBtn);
    }

    // Cálculo de intervalo de páginas (máximo 5 números)
    let startPage = Math.max(1, current - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === current ? 'active' : ''}`;
        btn.innerText = i;
        btn.onclick = () => { currentPage = i; renderPosts(); };
        container.appendChild(btn);
    }

    // Botão Próximo (>)
    if (current < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
        nextBtn.onclick = () => { currentPage++; renderPosts(); };
        container.appendChild(nextBtn);
    }
}

// Pesquisa
searchBtn.addEventListener('click', () => {
    searchQuery = searchInput.value;
    currentPage = 1;
    renderPosts();
});
searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        searchQuery = searchInput.value;
        currentPage = 1;
        renderPosts();
    }
});

// --- AUTENTICAÇÃO E CONTROLE DO ADMIN ---
onAuthStateChanged(auth, (user) => {
    adminTriggerBtn.classList.remove('spin-animation');
    if (user && user.email === ADMIN_EMAIL) {
        // Usuário logado é admin
        adminTriggerBtn.style.opacity = '1';
    } else {
        // Não logado ou não admin
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
    }, 500);
});

closeLogin.addEventListener('click', () => loginModal.style.display = 'none');
closeAdmin.addEventListener('click', () => adminModal.style.display = 'none');

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
                <button class="btn-primary" onclick="editPost('${post.id}')" style="padding: 5px 10px; margin-right: 5px;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="deletePost('${post.id}')"><i class="fa-solid fa-trash"></i></button>
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
    const summary = document.getElementById('post-summary').value;
    const content = document.getElementById('post-content').value;
    const image = document.getElementById('post-image').value;

    const postData = {
        title,
        summary,
        content,
        image,
        date: Date.now()
    };

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
});

window.editPost = function(id) {
    const post = allPosts.find(p => p.id === id);
    if (post) {
        document.getElementById('post-id').value = post.id;
        document.getElementById('post-title').value = post.title;
        document.getElementById('post-summary').value = post.summary;
        document.getElementById('post-content').value = post.content;
        document.getElementById('post-image').value = post.image || '';
    }
}

window.deletePost = async function(id) {
    if (confirm("Tem certeza que deseja excluir este post?")) {
        await remove(ref(db, 'posts/' + id));
        loadPosts();
    }
}

// --- GERENCIAMENTO DE MENUS (ADMIN) ---
const menuForm = document.getElementById('menu-form');
menuForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('menu-name').value;
    const url = document.getElementById('menu-url').value;

    const newMenuRef = push(ref(db, 'menus'));
    await set(newMenuRef, { name, url });

    menuForm.reset();
    loadMenus();
    alert("Menu adicionado!");
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
    await set(ref(db, 'settings'), settingsData);

    loadSettings();
    alert("Configurações atualizadas com sucesso!");
});

// --- GERADOR DE PÁGINAS (ZIP) ---
document.getElementById('download-zip-btn').addEventListener('click', async () => {
    const subpageName = document.getElementById('subpage-name').value.trim() || 'subpagina';
    const zip = new JSZip();

    // Arquivo HTML padrão para a subpágina
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

    // Incluir arquivos no ZIP
    zip.file("index.html", subHtml);
    // Reutilizamos o style.css principal da raiz para manter a harmonia visual
    const cssResponse = await fetch('style.css');
    const cssText = await cssResponse.text();
    zip.file("style.css", cssText);

    // Gerar ZIP e disparar download
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
loadPosts();
