import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBuEYx4pTsnhRJE37mVX38jgBIi5GyZ4fQ",
    authDomain: "organizador-a8fa1.firebaseapp.com",
    projectId: "organizador-a8fa1",
    storageBucket: "organizador-a8fa1.firebasestorage.app",
    messagingSenderId: "813072238246",
    appId: "1:813072238246:web:5866f2684bade15f319667"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

window.data = JSON.parse(localStorage.getItem("linksData")) || [];
window.folderPINs = JSON.parse(localStorage.getItem("folderPINs")) || {};
window.pinnedIds = JSON.parse(localStorage.getItem("pinnedIds")) || [];
window.sortMode = localStorage.getItem("sortMode") || 'alpha';
window.isLightMode = localStorage.getItem("isLightMode") === 'true';
window.bgImage = localStorage.getItem("bgImage") || "";

window.currentFolder = null; 
window.editItemId = null;
window.currentType = "folder"; 
window.clipboard = null; 
window.contextItem = null; 
window.currentUser = null;
window.savedRange = null;

const container = document.getElementById("container");
const backBtn = document.getElementById("backBtn");
const breadcrumbsDiv = document.getElementById("breadcrumbs");
const searchTop = document.getElementById("searchTop");
const contextMenu = document.getElementById("contextMenu");

const bgImageLayer = document.getElementById("bgImageLayer");
const bgVideo = document.getElementById("bgVideo");
const bgYoutubeFrame = document.getElementById("bgYoutubeFrame");

function init() {
    if(window.isLightMode) document.body.classList.add('light-mode');
    
    pickRandomBackground(window.bgImage);
    
    window.history.replaceState({folderId: null}, "", ""); 
    window.onpopstate = (e) => {
        if(e.state) { window.currentFolder = e.state.folderId; renderItems(window.currentFolder); }
    };
    renderItems(); renderPinned();
    document.addEventListener('keydown', handleShortcuts);
    
    searchTop.addEventListener('input', () => { renderItems(window.currentFolder); });
    
    document.getElementById("editor").addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        document.execCommand('insertText', false, text);
    });

    document.addEventListener('click', (e) => {
        if(e.target.closest('#modal') || e.target.closest('#noteEditorModal')) return; 

        contextMenu.style.display="none";

        if(!e.target.closest('#searchContainer') && !e.target.closest('#btnSearchToggle')) document.getElementById("searchContainer").style.width = "0";
        if(!e.target.closest('#newItemMenu') && !e.target.closest('#btnAddNew')) document.getElementById("newItemMenu").style.display = "none";
        if(!e.target.closest('#gamesMenu') && !e.target.closest('#btnGames')) document.getElementById("gamesMenu").style.display = "none";
    });

    document.addEventListener('contextmenu', (e) => {
        if(e.target.closest('#editor') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; 
        
        e.preventDefault();
        contextMenu.style.display = "none";

        const itemEl = e.target.closest('.item') || e.target.closest('.pinned-item');
        
        if(itemEl) {
            const id = parseInt(itemEl.dataset.id) || (window.data.find(x=>x.title === itemEl.getAttribute('data-tooltip'))?.id);
            if(id) { 
                const item = window.data.find(x=>x.id===id); 
                if(item) showItemContextMenu(e, item); 
            }
        } else {
            document.getElementById("ctxItemActions").style.display = "none";
            document.getElementById("ctxGlobalActions").style.display = "block";
            document.getElementById("ctxPaste").style.display = window.clipboard ? "flex" : "none";
            
            showContextMenuAt(e.clientX, e.clientY);
        }
    });

    document.getElementById("headerEmptyTrashBtn").onclick = () => {
        if(confirm("¿Quemar todo lo de la basura?")) {
            window.data = window.data.filter(i => i.parent !== 'trash');
            if(window.saveData) window.saveData(); renderItems('trash');
        }
    };
}

function combinarDatos(existentes, nuevos) {
    const mapa = new Map(existentes.map(i => [i.id, i]));
    
    nuevos.forEach(item => {
        if (!mapa.has(item.id)) {
            mapa.set(item.id, item);
        }
    });
    
    // Devolvemos el array mezclado
    return Array.from(mapa.values());
}

function pickRandomBackground(bgString) {
    if(!bgString) return;
    const list = bgString.split(',').map(s => s.trim()).filter(s => s);
    if(list.length === 0) return;
    const randomUrl = list[Math.floor(Math.random() * list.length)];
    updateBackground(randomUrl);
}

function updateBackground(url) {
    if(!url) return;
    
    bgImageLayer.style.display = 'none';
    bgVideo.style.display = 'none';
    bgYoutubeFrame.style.display = 'none';
    bgVideo.src = "";
    
    const ytReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const ytMatch = url.match(ytReg);

    if(ytMatch && ytMatch[1]) {
        const vidId = ytMatch[1];
        bgYoutubeFrame.src = `https://www.youtube.com/embed/${vidId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${vidId}&showinfo=0&modestbranding=1&rel=0`;
        bgYoutubeFrame.style.display = 'block';
    } else if(url.endsWith('.mp4') || url.endsWith('.webm')) {
        bgVideo.src = url;
        bgVideo.muted = true; 
        bgVideo.style.display = 'block';
        bgVideo.play().catch(e => console.log("Interaccion necesaria para play"));
    } else {
        bgImageLayer.style.backgroundImage = `url('${url}')`;
        bgImageLayer.style.display = 'block';
    }
}

window.renderItems = function(folderId = null) {
    container.innerHTML = "";
    const isTrash = folderId === 'trash';
    document.getElementById("headerEmptyTrashBtn").style.display = (isTrash && window.data.some(i => i.parent === 'trash')) ? 'block' : 'none';
    backBtn.style.display = folderId ? 'block' : 'none';
    updateBreadcrumbs();

    let items = window.data.filter(i => i.parent === folderId);
    
    if(!isTrash && window.sortMode !== 'manual') {
        if(window.sortMode === 'usage') items.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
        else items.sort((a, b) => {
            const typeOrder = { 'folder': 1, 'note': 2, 'link': 3 };
            if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
            return a.title.localeCompare(b.title);
        });
    }

    const search = window.normalizeText(searchTop.value);
    if (search && !isTrash) {
    items = window.data.filter(i => i.parent!=='trash' && window.normalizeText(i.title).includes(search));
    breadcrumbsDiv.innerHTML = `<span class="crumb">Buscando...</span>`;
    backBtn.style.display="none"; 
}
    if (items.length === 0) container.innerHTML = `<div style="width:100%;text-align:center;color:#666;font-size:18px;">${isTrash?'Basura vacia':'Vacio aca'}</div>`;
    items.forEach(item => createItemElement(item, isTrash, search));
}

function createItemElement(item, isTrash, isSearch) {
    const div = document.createElement("div"); div.className = "item"; div.dataset.id = item.id;
    
    if(!isTrash && !isSearch) {
        div.draggable = true;
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData("id", item.id);
            div.classList.add('dragging');
        });
        div.addEventListener('dragend', () => { 
            div.classList.remove('dragging'); 
            document.querySelectorAll('.item').forEach(i => { i.classList.remove('drag-over-left'); i.classList.remove('drag-over-right'); });
        });
        
        div.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            const box = div.getBoundingClientRect();
            const mid = box.x + box.width / 2;
            if(e.clientX < mid) {
                div.classList.add('drag-over-left'); div.classList.remove('drag-over-right');
            } else {
                div.classList.add('drag-over-right'); div.classList.remove('drag-over-left');
            }
        });
        
        div.addEventListener('dragleave', () => {
             div.classList.remove('drag-over-left'); div.classList.remove('drag-over-right');
        });

        div.addEventListener('drop', (e) => handleDrop(e, item));
    }

    const iconBox = document.createElement("div"); iconBox.className = "icon-box";
    if(item.type==='folder') iconBox.innerHTML = `<i class="fa-solid ${window.data.some(x=>x.parent===item.id)?'fa-folder-open':'fa-folder'}" style="color:${item.color||'#FFD700'}"></i>`;
    else if(item.type==='note') iconBox.innerHTML = `<i class="fa-solid fa-file-lines" style="color:${item.color||'#4caf50'}"></i>`;
    else {
        const img = document.createElement("img"); img.src = `https://www.google.com/s2/favicons?sz=128&domain_url=${item.link}`;
        img.onerror = () => { img.style.display='none'; iconBox.innerHTML = '<i class="fa-solid fa-globe" style="color:#00aaff"></i>'; };
        iconBox.appendChild(img);
    }
    
    let html = `<div class="item-title">${item.title}</div>`;
    if(isTrash && item.deletedDate) {
        const d = 30 - Math.floor((Date.now()-item.deletedDate)/(1000*60*60*24));
        html += `<div style="font-size:10px;color:#ff6b6b">${d} dias</div>`;
    }
    div.innerHTML += html; div.prepend(iconBox);
    div.onclick = () => {
        if(isTrash) return;
        item.clicks = (item.clicks || 0) + 1; if(window.saveData) window.saveData(); 
        if(item.type==='folder') enterFolder(item);
        else if(item.type==='note') openNoteEditor(item.id);
        else openLink(item.link);
    };
    container.appendChild(div);
}

function handleDrop(e, targetItem) {
    e.stopPropagation();
    const srcId = parseInt(e.dataTransfer.getData("id"));
    if(srcId === targetItem.id) return;
    const srcItem = window.data.find(x => x.id === srcId);
    if(!srcItem) return;

    const box = e.target.closest('.item').getBoundingClientRect();
    const mid = box.x + box.width / 2;
    const insertAfter = e.clientX > mid;

    if(e.shiftKey && targetItem.type === 'folder') {
         if(confirm("¿Mover dentro de " + targetItem.title + "?")) {
             srcItem.parent = targetItem.id;
             if(window.saveData) window.saveData(); renderItems(window.currentFolder);
             return;
         }
    }

    window.sortMode = 'manual'; localStorage.setItem("sortMode", 'manual');
    const srcIndex = window.data.indexOf(srcItem);
    window.data.splice(srcIndex, 1);
    
    const targetIndex = window.data.indexOf(targetItem);
    const newIndex = insertAfter ? targetIndex + 1 : targetIndex;
    window.data.splice(newIndex, 0, srcItem);

    if(window.saveData) window.saveData(); renderItems(window.currentFolder);
}

window.renderPinned = function() {
    document.getElementById("pinnedContainer").innerHTML = "";
    window.pinnedIds.forEach(pid => {
        const item = window.data.find(x => x.id === pid);
        if(item && item.parent !== 'trash') {
            const div = document.createElement("div"); div.className = "task-icon pinned-item"; div.setAttribute("data-tooltip", item.title);
            if(item.type === 'folder') div.innerHTML = `<i class="fa-solid fa-folder" style="color:${item.color||'#FFD700'}"></i>`;
            else if(item.type === 'note') div.innerHTML = `<i class="fa-solid fa-file-lines" style="color:${item.color||'#4caf50'}"></i>`;
            else { const img = document.createElement("img"); img.src = `https://www.google.com/s2/favicons?sz=128&domain_url=${item.link}`; div.appendChild(img); }
            div.onclick = () => {
                if(item.type==='folder') enterFolder(item);
                else if(item.type==='note') openNoteEditor(item.id);
                else openLink(item.link);
            };
            document.getElementById("pinnedContainer").appendChild(div);
        }
    });
}

document.getElementById("btnSearchToggle").onclick = () => {
    const c = document.getElementById("searchContainer");
    if(c.style.width === "60%") c.style.width = "0"; else { c.style.width = "60%"; searchTop.focus(); }
};
document.getElementById("btnSettingsToggle").onclick = () => document.getElementById("settingsModal").style.display = "flex";
document.getElementById("trashBtn").onclick = () => { window.currentFolder='trash'; renderItems('trash'); };
document.getElementById("btnAddNew").onclick = () => {
    const m = document.getElementById("newItemMenu"); m.style.display = (m.style.display === "flex") ? "none" : "flex";
};

document.getElementById("menuNewFolder").onclick = () => { openModal(null, 'folder'); document.getElementById("newItemMenu").style.display="none"; };
document.getElementById("menuNewLink").onclick = () => { openModal(null, 'link'); document.getElementById("newItemMenu").style.display="none"; };
document.getElementById("menuNewNote").onclick = () => { openModal(null, 'note'); document.getElementById("newItemMenu").style.display="none"; };
document.getElementById("btnGames").onclick = () => { const m = document.getElementById("gamesMenu"); m.style.display = (m.style.display === "flex") ? "none" : "flex"; };

document.getElementById("ctxNewFolder").onclick = () => { openModal(null, 'folder'); contextMenu.style.display = "none"; };
document.getElementById("ctxNewNote").onclick = () => { openModal(null, 'note'); contextMenu.style.display = "none"; };
document.getElementById("ctxNewLink").onclick = () => { openModal(null, 'link'); contextMenu.style.display = "none"; };

window.enterFolder = function(item) {
    if(window.folderPINs[item.id] && prompt("PIN:")!==window.folderPINs[item.id]) return;
    searchTop.value = ""; window.currentFolder=item.id; 
    window.history.pushState({folderId: item.id}, "", "?folder="+item.id); renderItems(item.id);
}
backBtn.onclick = () => { window.history.back(); };

function getFolderPath(folderId) {
    let path = []; let current = window.data.find(i => i.id === folderId);
    while(current) { path.unshift(current); current = window.data.find(i => i.id === current.parent); }
    return path;
}
function updateBreadcrumbs() {
    let html = `<span class="crumb" onclick="goHome()"><i class="fa-solid fa-house"></i> Inicio</span>`;
    if(window.currentFolder) {
        if(window.currentFolder === 'trash') { html += ` <span class="crumb-sep">></span> <span style="color:#ff6b6b;font-weight:bold;">Basura</span>`; } 
        else {
             const path = getFolderPath(window.currentFolder);
             path.forEach(folder => { html += ` <span class="crumb-sep">></span> <span class="crumb" onclick="goToFolder(${folder.id})">${folder.title}</span>`; });
        }
    }
    breadcrumbsDiv.innerHTML = html;
}
window.goHome = () => { window.currentFolder = null; window.history.pushState({folderId: null}, "", "?root"); renderItems(null); }
window.goToFolder = (id) => { window.currentFolder = id; window.history.pushState({folderId: id}, "", "?folder="+id); renderItems(id); }

function openLink(url) {
    const ytReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(ytReg);
    if(match && match[1]) {
        const embedUrl = `https://www.youtube.com/embed/${match[1]}?autoplay=1`;
        document.getElementById("ytFrame").src = embedUrl; document.getElementById("ytModal").style.display = "flex";
    } else {
        window.open(url, '_self');
    }
}

document.getElementById("saveItem").onclick = saveModalItem;
document.getElementById("cancelItem").onclick = () => document.getElementById("modal").style.display="none";

function showItemContextMenu(e, item) {
    contextItem = item;
    const isTrash = item.parent === 'trash';
    document.getElementById("ctxGlobalActions").style.display = "none";
    document.getElementById("ctxItemActions").style.display = "block";
    
    document.getElementById("ctxOpenTab").style.display = (item.type === 'link') ? 'block':'none';
    document.getElementById("ctxCopyLink").style.display = (item.type === 'link')?'block':'none';
    document.getElementById("ctxColor").style.display = (!isTrash && item.type!=='link')?'block':'none';
    const isPinned = window.pinnedIds.includes(item.id);
    document.getElementById("ctxPin").style.display = (!isTrash && !isPinned) ? 'block' : 'none';
    document.getElementById("ctxUnpin").style.display = (!isTrash && isPinned) ? 'block' : 'none';
    document.getElementById("ctxDelete").style.display = isTrash?'none':'block';
    document.getElementById("ctxRestore").style.display = isTrash?'block':'none';
    document.getElementById("ctxPermDelete").style.display = isTrash?'block':'none';
    
    showContextMenuAt(e.clientX, e.clientY);
}

function showContextMenuAt(x, y) {
    contextMenu.style.display = "block";
    if(x + 220 > window.innerWidth) x = window.innerWidth - 230;
    if(y + 300 > window.innerHeight) y = window.innerHeight - 310;
    contextMenu.style.left=`${x}px`; contextMenu.style.top=`${y}px`;
}

function openModal(id, type) {
    if(id) {
        const item = window.data.find(x => x.id === id);
        if(item.type === 'folder' && window.folderPINs[id] && prompt("PIN para editar:")!==window.folderPINs[id]) return;
    }
    document.getElementById("modal").style.display = "flex"; editItemId = id; 
    document.getElementById("modalTitle").textContent = id ? "Editar" : "Agregar";
    document.getElementById("itemTitle").value = ""; document.getElementById("itemLink").value=""; document.getElementById("itemPIN").value="";
    if (id) {
        const i = window.data.find(x => x.id === id); currentType = i.type;
        document.getElementById("itemTitle").value = i.title;
        if(i.type==='link') document.getElementById("itemLink").value = i.link;
        if(i.type!=='link') document.getElementById("itemColor").value = i.color || "#FFD700";
        if(i.type==='folder') document.getElementById("itemPIN").value = window.folderPINs[i.id]||"";
    } else {
        currentType = type || "folder"; document.getElementById("itemColor").value = (currentType==="link") ? "#000000" : getRandomColor();
    }
    document.getElementById("linkFields").style.display = currentType === 'link' ? 'block' : 'none';
    document.getElementById("colorFields").style.display = (currentType !== 'link') ? 'block' : 'none';
    document.getElementById("folderPINField").style.display = currentType === 'folder' ? 'block' : 'none';
    document.getElementById("itemTitle").focus();
}

function saveModalItem() {
    let title = document.getElementById("itemTitle").value.trim(); if(!title) return;
    let createdItem = null;
    
    if(editItemId) {
        const i = window.data.find(x=>x.id===editItemId); 
        if(i.type === 'folder') title = title.toUpperCase();
        i.title = title;
        if(currentType === 'link') i.link = document.getElementById("itemLink").value.trim();
        if(currentType !== 'link') i.color = document.getElementById("itemColor").value;
        if(currentType === 'folder') { const pin = document.getElementById("itemPIN").value.trim(); if(pin) window.folderPINs[i.id]=pin; else delete window.folderPINs[i.id]; }
    } else {
        if(currentType === 'folder') title = title.toUpperCase();
        const newItem = { id: Date.now(), type: currentType, title, parent: window.currentFolder, clicks: 0 };
        if(currentType === 'link') newItem.link = document.getElementById("itemLink").value.trim();
        if(currentType !== 'link') newItem.color = document.getElementById("itemColor").value;
        if(currentType === 'note') newItem.content = "";
        window.data.push(newItem);
        createdItem = newItem;
        if(currentType === 'folder') { const pin = document.getElementById("itemPIN").value.trim(); if(pin) window.folderPINs[newItem.id]=pin; }
    }
    if(window.saveData) window.saveData(); 
    renderItems(window.currentFolder); 
    renderPinned(); 
    document.getElementById("modal").style.display="none";

    // AUTO ABRIR
    if(createdItem) {
        if(createdItem.type === 'folder') enterFolder(createdItem);
        else if(createdItem.type === 'note') openNoteEditor(createdItem.id);
    }
}

const editor = document.getElementById("editor"); let isEditing = false; let currentNoteId = null;
window.openNoteEditor = function(id) {
    currentNoteId = id; const n = window.data.find(x=>x.id===id); if(!n) return;
    editor.innerHTML = n.content || ""; document.getElementById("noteEditorTitle").textContent = n.title;
    isEditing=false; editor.contentEditable=false; 
    document.getElementById("modeToggle").textContent="Editar"; document.getElementById("modeToggle").style.background="#0078d4";
    document.getElementById("editToolbar").style.display="none"; 
    document.getElementById("noteEditorModal").style.display="flex"; 
}
document.getElementById("modeToggle").onclick = () => {
    isEditing = !isEditing; editor.contentEditable = isEditing;
    if(isEditing) { editor.focus(); document.getElementById("modeToggle").textContent="Guardar"; document.getElementById("modeToggle").style.background="#4caf50"; document.getElementById("editToolbar").style.display="flex"; } 
    else { saveNote(); }
};
function saveNote() {
    const n = window.data.find(x=>x.id===currentNoteId); 
    if(n){
        // LIMPIEZA EXTREMA ANTES DE GUARDAR
        let cleanContent = editor.innerHTML.replace(/<span class="highlight"[^>]*>(.*?)<\/span>/gi, "$1");
        cleanContent = cleanContent.replace(/ data-index-in-node="\d+"/gi, "");
        
        n.content = cleanContent;
        if(window.saveData) window.saveData(); 
        editor.innerHTML = cleanContent;
    } 
    document.getElementById("modeToggle").textContent="Editar"; document.getElementById("modeToggle").style.background="#0078d4"; document.getElementById("editToolbar").style.display="none";
    isEditing = false; editor.contentEditable = false;
}

document.getElementById("addLinkNoteBtn").onmousedown = (e) => {
    e.preventDefault();
    const sel = window.getSelection();
    if(sel.rangeCount > 0) window.savedRange = sel.getRangeAt(0);
    document.getElementById("noteLinkText").value = sel.toString(); 
    document.getElementById("noteLinkUrl").value = ""; 
    document.getElementById("noteLinkModal").style.display = "flex"; 
};

document.getElementById("confirmNoteLink").onclick = () => {
    const txt = document.getElementById("noteLinkText").value || "Enlace"; const url = document.getElementById("noteLinkUrl").value;
    if(url) { 
         document.getElementById("noteLinkModal").style.display="none";
         editor.focus();
         if(window.savedRange) {
             const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(window.savedRange);
         }
         const html = `<a href="${url}" target="_blank" contenteditable="false" style="color:#00aaff; text-decoration:underline; cursor:pointer;">${txt}</a>&nbsp;`; 
         document.execCommand('insertHTML', false, html); 
    } else {
         document.getElementById("noteLinkModal").style.display="none";
    }
};

document.getElementById("searchNoteInput").addEventListener('input', function() {
    const term = this.value;
    let clean = editor.innerHTML;
    const regexRemove = /<span class="highlight"[^>]*>([\s\S]*?)<\/span>/gi;
    while(regexRemove.test(clean)){
        clean = clean.replace(regexRemove, '$1');
    }
    if(!term) { editor.innerHTML = clean; return; }
    const re = new RegExp(`(${term})(?![^<]*>)`, 'gi');
    editor.innerHTML = clean.replace(re, '<span class="highlight">$1</span>');
});

document.getElementById("closeEditorBtn").onclick = () => { if(isEditing) saveNote(); document.getElementById("noteEditorModal").style.display='none'; };

window.switchTab = (tabId) => {
    document.querySelectorAll('.settings-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.settings-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    const btns = document.querySelectorAll('.settings-btn');
    if(tabId==='profile') btns[0].classList.add('active'); if(tabId==='view') btns[1].classList.add('active'); if(tabId==='personalize') btns[2].classList.add('active');
};
document.getElementById("btnToggleTheme").onclick = () => {
    window.isLightMode = !window.isLightMode;
    if(window.isLightMode) document.body.classList.add('light-mode'); else document.body.classList.remove('light-mode');
    localStorage.setItem("isLightMode", window.isLightMode);
};
document.getElementById("btnSortAlpha").onclick = () => { window.sortMode='alpha'; localStorage.setItem("sortMode", 'alpha'); renderItems(window.currentFolder); };
document.getElementById("btnSortUsage").onclick = () => { window.sortMode='usage'; localStorage.setItem("sortMode", 'usage'); renderItems(window.currentFolder); };
document.getElementById("btnSortManual").onclick = () => { window.sortMode='manual'; localStorage.setItem("sortMode", 'manual'); renderItems(window.currentFolder); };

document.getElementById("btnHelpInfo").onclick = () => {
    document.getElementById("helpOverlay").style.display = "flex";
};
document.getElementById("closeHelpBtn").onclick = () => {
    document.getElementById("helpOverlay").style.display = "none";
};

document.getElementById("btnSaveBg").onclick = () => {
    const url = document.getElementById("bgInput").value;
    const status = document.getElementById("bgStatus");
    status.textContent = "Guardando...";
    setTimeout(() => {
        window.bgImage = url;
        pickRandomBackground(url);
        localStorage.setItem("bgImage", url);
        if(window.saveData) window.saveData();
        status.textContent = "¡Listo! (Si pusiste varios, recarga para ver random)";
        setTimeout(()=>status.textContent="", 2000);
    }, 500);
};

document.getElementById("btnExport").onclick = () => {
    const str = JSON.stringify({ data: window.data, pins: window.pinnedIds, bg: window.bgImage });
    const blob = new Blob([str], {type: "application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="backup.json"; a.click();
};
document.getElementById("fileInput").onchange = (e) => {
    const f = e.target.files[0]; if(!f) return; const reader = new FileReader();
    reader.onload = (evt) => { 
        try { 
            const obj = JSON.parse(evt.target.result); 
            if(obj.data) window.data = combinarDatos(window.data, obj.data); 
            // Para los pines si reemplazamos por seguridad visual, o podrias mezclarlos tmb, pero mejor dejar el backup
            if(obj.pins) window.pinnedIds = obj.pins; 
            if(obj.bg) { window.bgImage = obj.bg; pickRandomBackground(obj.bg); localStorage.setItem("bgImage", obj.bg); }
            if(window.saveData) window.saveData(); renderItems(); renderPinned(); 
            alert("Backup fusionado correctamente.");
        } catch(x) { alert("Error al importar."); } 
    };
    reader.readAsText(f);
};

function handleShortcuts(e) {
    const activeModal = Array.from(document.querySelectorAll('.modal')).find(m => m.style.display === 'flex');
    const helpOpen = document.getElementById("helpOverlay").style.display === 'flex';
    
    if(e.key === "Escape") { 
        if(helpOpen) document.getElementById("helpOverlay").style.display = 'none';
        else if(activeModal) { activeModal.style.display = 'none'; } 
        else document.getElementById("searchContainer").style.width="0"; 
    }
    if(e.key === "Enter" && activeModal && activeModal.id!=='noteEditorModal' && !e.shiftKey) { const saveBtn = activeModal.querySelector('#saveItem, #confirmNoteLink, #btnSavePoem'); if(saveBtn) saveBtn.click(); }
    if(e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById("btnSearchToggle").click(); }
    if(e.ctrlKey && (e.key === 'g' || e.key === 's') && activeModal && activeModal.id === 'noteEditorModal') { e.preventDefault(); saveNote(); }
    
    if(activeModal && activeModal.id === 'noteEditorModal' && isEditing && e.key === '.') { window.nextCap = true; } 
    else if(window.nextCap && e.key.length === 1 && /[a-z]/i.test(e.key)) {
         e.preventDefault(); document.execCommand('insertText', false, e.key.toUpperCase()); window.nextCap = false;
    } else if (e.key !== ' ' && e.key !== 'Shift') { window.nextCap = false; }
}

window.normalizeText = (t) => t ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
window.getRandomColor = () => { const l="0123456789ABCDEF"; let c="#"; for(let i=0;i<6;i++) c+=l[Math.floor(Math.random()*16)]; return c; };

document.getElementById("ctxCopyItem").onclick = () => { window.clipboard = { item: JSON.parse(JSON.stringify(contextItem)), type: 'copy' }; };
document.getElementById("ctxCutItem").onclick = () => { window.clipboard = { item: contextItem, type: 'cut' }; };
document.getElementById("ctxPaste").onclick = () => {
    if(!window.clipboard) return;
    const newItem = JSON.parse(JSON.stringify(window.clipboard.item));
    newItem.id = Date.now(); newItem.parent = window.currentFolder;
    if(window.clipboard.type === 'cut') { window.data = window.data.filter(x => x.id !== window.clipboard.item.id); window.clipboard = null; }
    window.data.push(newItem);
    if(window.saveData) window.saveData(); renderItems(window.currentFolder);
};
document.getElementById("ctxPin").onclick = () => { if(window.pinnedIds.length >= 6) { alert("Lleno."); return; } if(!window.pinnedIds.includes(contextItem.id)) { window.pinnedIds.push(contextItem.id); if(window.saveData) window.saveData(); renderPinned(); } };
document.getElementById("ctxUnpin").onclick = () => { window.pinnedIds = window.pinnedIds.filter(id => id !== contextItem.id); if(window.saveData) window.saveData(); renderPinned(); };
// Abrir enlace en nueva pestaña
document.getElementById("ctxOpenTab").onclick = () => { window.open(contextItem.link, '_blank'); };
document.getElementById("ctxCopyLink").onclick = () => navigator.clipboard.writeText(contextItem.link);
document.getElementById("ctxColor").onclick = () => document.getElementById("ctxColorInput").click();
document.getElementById("ctxColorInput").onchange = (e) => { if(contextItem){contextItem.color=e.target.value; if(window.saveData) window.saveData(); renderItems(window.currentFolder);} };
document.getElementById("ctxEdit").onclick = () => openModal(contextItem.id); 
document.getElementById("ctxDelete").onclick = () => { 
    if(contextItem.type==='folder' && window.folderPINs[contextItem.id] && prompt("PIN")!==window.folderPINs[contextItem.id]) return;
    contextItem.originalParent=contextItem.parent; contextItem.parent='trash'; contextItem.deletedDate=Date.now(); if(window.saveData) window.saveData(); renderItems(window.currentFolder); 
};
document.getElementById("ctxRestore").onclick = () => { contextItem.parent=contextItem.originalParent||null; delete contextItem.deletedDate; if(window.saveData) window.saveData(); renderItems('trash'); };
document.getElementById("ctxPermDelete").onclick = () => { 
    if(confirm("¿Seguro?")) { 
        function delRecursive(id) { const kids = window.data.filter(i=>i.parent===id); kids.forEach(k => delRecursive(k.id)); window.data = window.data.filter(x=>x.id !== id); window.pinnedIds = window.pinnedIds.filter(x=>x !== id); }
        delRecursive(contextItem.id); if(window.saveData) window.saveData(); renderItems('trash'); renderPinned();
    } 
};

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userStatus = document.getElementById("userStatus");

btnLogin.onclick = () => signInWithPopup(auth, provider).catch(e => console.error(e));
btnLogout.onclick = () => { signOut(auth).then(() => { location.reload(); }); };

onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.currentUser = user;
        userName.textContent = user.displayName;
        userStatus.textContent = "Sincronizado";
        userAvatar.src = user.photoURL;
        btnLogin.style.display = "none";
        btnLogout.style.display = "block";
        
        let isGlobalAdmin = false;
        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            
            let cloudData = [];
            let localData = window.data;
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData.role === 'admin') isGlobalAdmin = true;
                if(userData.linksData) cloudData = JSON.parse(userData.linksData);
                
                window.data = combinarDatos(cloudData, localData);
                
                if(userData.folderPINs) window.folderPINs = {...window.folderPINs, ...JSON.parse(userData.folderPINs)};
                if(userData.pinnedIds) window.pinnedIds = [...new Set([...window.pinnedIds, ...JSON.parse(userData.pinnedIds)])];
                if(userData.bgImage && !window.bgImage) { window.bgImage = userData.bgImage; }
                
            } else { 
                await setDoc(userRef, { role: 'user', linksData: JSON.stringify(localData) }, { merge: true }); 
            }
            
            if(window.bgImage) { document.getElementById("bgInput").value = window.bgImage; pickRandomBackground(window.bgImage); }
            renderItems(window.currentFolder);
            renderPinned();
            
        } catch (e) { console.error(e); }

        document.getElementById("poemBtn").style.display = isGlobalAdmin ? "flex" : "none";

        window.saveData = async function() {
            localStorage.setItem("linksData", JSON.stringify(window.data));
            localStorage.setItem("folderPINs", JSON.stringify(window.folderPINs));
            localStorage.setItem("pinnedIds", JSON.stringify(window.pinnedIds));
            localStorage.setItem("bgImage", window.bgImage);
            try {
                await setDoc(doc(db, "users", user.uid), {
                    linksData: JSON.stringify(window.data),
                    folderPINs: JSON.stringify(window.folderPINs),
                    pinnedIds: JSON.stringify(window.pinnedIds),
                    bgImage: window.bgImage
                }, { merge: true });
            } catch (e) { console.error(e); }
        };
        
        window.saveData();

    } else {
        window.currentUser = null;
        userName.textContent = "Invitado";
        userStatus.textContent = "Local";
        userAvatar.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; 
        btnLogin.style.display = "block";
        btnLogout.style.display = "none";
        
        window.data = JSON.parse(localStorage.getItem("linksData")) || [];
        renderItems(window.currentFolder);
        renderPinned();
        
        window.saveData = function() {
           localStorage.setItem("linksData", JSON.stringify(window.data));
           localStorage.setItem("folderPINs", JSON.stringify(window.folderPINs));
           localStorage.setItem("pinnedIds", JSON.stringify(window.pinnedIds));
           localStorage.setItem("bgImage", window.bgImage);
        }
    }
});

let currentVerseId = null;

async function fetchRandomPoem(isAdminMode) {
    document.getElementById("poemModal").style.display = "flex";
    document.getElementById("poemBody").textContent = "Buscando...";
    document.getElementById("poemAuthor").textContent = "";
    document.getElementById("adminPoemArea").style.display = isAdminMode ? "block" : "none";
    document.getElementById("poemAdminControls").style.display = "none";
    document.getElementById("newPoemContent").value = "";
    document.getElementById("newPoemAuthor").value = "";
    try {
        const querySnapshot = await getDocs(collection(db, "public_poems"));
        const poems = [];
        querySnapshot.forEach((doc) => { const d = doc.data(); d.id = doc.id; poems.push(d); });
        if(poems.length > 0) {
            const randomPoem = poems[Math.floor(Math.random() * poems.length)];
            document.getElementById("poemBody").textContent = randomPoem.content;
            document.getElementById("poemAuthor").textContent = "- " + randomPoem.author;
            currentVerseId = randomPoem.id;
            if(isAdminMode) document.getElementById("poemAdminControls").style.display = "flex";
        } else { document.getElementById("poemBody").textContent = "Vacio."; }
    } catch(e) { document.getElementById("poemBody").textContent = "Offline."; }
}
document.getElementById("viewVersesBtn").onclick = () => fetchRandomPoem(false);
document.getElementById("poemBtn").onclick = () => fetchRandomPoem(true);
document.getElementById("btnDeleteCurrentVerse").onclick = async () => { if(currentVerseId && confirm("¿Borrar?")) { await deleteDoc(doc(db, "public_poems", currentVerseId)); fetchRandomPoem(true); } }
document.getElementById("btnEditCurrentVerse").onclick = () => {
    document.getElementById("newPoemContent").value = document.getElementById("poemBody").textContent;
    document.getElementById("newPoemAuthor").value = document.getElementById("poemAuthor").textContent.replace("- ", "");
    document.getElementById("btnSavePoem").textContent = "Guardar";
    document.getElementById("btnCancelEditVerse").style.display = "block";
}
document.getElementById("btnCancelEditVerse").onclick = () => {
    document.getElementById("newPoemContent").value = ""; document.getElementById("newPoemAuthor").value = "";
    document.getElementById("btnSavePoem").textContent = "Publicar"; document.getElementById("btnCancelEditVerse").style.display = "none";
}
document.getElementById("btnSavePoem").onclick = async () => {
    const content = document.getElementById("newPoemContent").value;
    const author = document.getElementById("newPoemAuthor").value;
    const isEditing = document.getElementById("btnSavePoem").textContent === "Guardar";
    if(content && author) {
        if(isEditing && currentVerseId) { await updateDoc(doc(db, "public_poems", currentVerseId), { content, author }); document.getElementById("btnCancelEditVerse").click(); document.getElementById("poemBody").textContent = content; } 
        else { await addDoc(collection(db, "public_poems"), { content, author, date: Date.now() }); fetchRandomPoem(true); }
    }
}
init();