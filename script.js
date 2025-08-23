// Variables
let currentFolder = null,
  editItemId = null,
  currentType = "folder";
let data = JSON.parse(localStorage.getItem("linksData")) || [];
let folderPINs = JSON.parse(localStorage.getItem("folderPINs")) || {};
let folderHistory = [];

const container = document.getElementById("container");
const addBtn = document.getElementById("addBtn");
const addOptions = document.getElementById("addOptions");
const addFolderBtn = document.getElementById("addFolderBtn");
const addLinkBtn = document.getElementById("addLinkBtn");
const searchBottom = document.getElementById("searchBottom");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const itemTitle = document.getElementById("itemTitle");
const itemLink = document.getElementById("itemLink");
const itemColor = document.getElementById("itemColor");
const itemPIN = document.getElementById("itemPIN");
const saveItem = document.getElementById("saveItem");
const cancelItem = document.getElementById("cancelItem");
const backBtn = document.getElementById("backBtn");
const linkLabel = document.getElementById("linkLabel");
const colorLabel = document.getElementById("colorLabel");
const pinLabel = document.getElementById("pinLabel");

const menuBtn = document.getElementById("menuBtn");
const sideMenu = document.getElementById("sideMenu");

const overlay = document.getElementById("overlay");
const filesBtn = document.getElementById("filesBtn");
const filesOptions = document.getElementById("filesOptions");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

// Funciones auxiliares
function saveData() {
  localStorage.setItem("linksData", JSON.stringify(data));
  localStorage.setItem("folderPINs", JSON.stringify(folderPINs));
}
function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
  return color;
}
function normalizeText(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Render
function renderItems(folderId = null) {
  container.innerHTML = "";
  let items = data.filter((i) => i.parent === folderId);
  const search = normalizeText(searchBottom.value);
  if (search)
    items = items.filter((i) => normalizeText(i.title).includes(search));
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
  });
  items.forEach((item) => {
    const div = document.createElement("div");
    div.classList.add("item");
    div.dataset.id = item.id;
    const iconContainer = document.createElement("div");
    iconContainer.style.width = "100px";
    iconContainer.style.height = "100px";
    iconContainer.style.borderRadius = "10px";
    iconContainer.style.display = "flex";
    iconContainer.style.alignItems = "center";
    iconContainer.style.justifyContent = "center";
    iconContainer.style.background = "#2a2a2a";
    iconContainer.style.padding = "10px";

    if (item.type === "folder") {
      const icon = document.createElement("i");
      const hasChildren = data.some((i) => i.parent === item.id);
      icon.className = hasChildren
        ? "fa-solid fa-folder-open"
        : "fa-solid fa-folder";
      icon.style.color = item.color || "#FFD700";
      iconContainer.appendChild(icon);
    } else {
      const img = document.createElement("img");
      img.src = `https://www.google.com/s2/favicons?sz=128&domain_url=${item.link}`;
      img.style.width = "80px";
      img.style.height = "80px";
      img.style.borderRadius = "10px";
      iconContainer.appendChild(img);
    }
    div.appendChild(iconContainer);

    const title = document.createElement("div");
    title.classList.add("item-title");
    title.textContent =
      item.type === "folder" ? item.title.toUpperCase() : item.title;
    div.appendChild(title);

    const buttonsDiv = document.createElement("div");
    buttonsDiv.classList.add("buttons");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.onclick = (e) => {
      e.stopPropagation();
      if (item.type === "folder" && folderPINs[item.id]) {
        const pinInput = prompt("Ingrese PIN para editar esta carpeta:");
        if (pinInput !== folderPINs[item.id]) {
          alert("PIN incorrecto");
          return;
        }
      }
      openModal(item.id);
    };
    const delBtn = document.createElement("button");
    delBtn.textContent = "Borrar";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (item.type === "folder" && folderPINs[item.id]) {
        const pinInput = prompt("Ingrese PIN para borrar esta carpeta:");
        if (pinInput !== folderPINs[item.id]) {
          alert("PIN incorrecto");
          return;
        }
      }
      if (confirm("¿Seguro que deseas borrar este elemento?"))
        deleteItem(item.id);
    };
    buttonsDiv.appendChild(editBtn);
    buttonsDiv.appendChild(delBtn);
    div.appendChild(buttonsDiv);

    div.onclick = () => {
      if (item.type === "folder") {
        if (folderPINs[item.id]) {
          const pinInput = prompt("Ingrese PIN de la carpeta:");
          if (pinInput !== folderPINs[item.id]) {
            alert("PIN incorrecto");
            return;
          }
        }
        if (currentFolder !== null) folderHistory.push(currentFolder);
        currentFolder = item.id;
        renderItems(currentFolder);
      } else {
        window.open(item.link, "_blank");
      }
    };
    container.appendChild(div);
  });
  backBtn.style.display = folderId ? "block" : "none";
}

// Modal
function openModal(id = null, type = null) {
  modal.style.display = "flex";
  editItemId = id;
  modalTitle.textContent = id ? "Editar" : "Agregar";
  if (id) {
    const item = data.find((i) => i.id === id);
    currentType = item.type;
    itemTitle.value = item.title;
    itemLink.value = item.link || "";
    itemColor.value = item.color || "#FFD700";
    itemPIN.value = folderPINs[item.id] || "";
  } else {
    currentType = type || "folder";
    itemTitle.value = "";
    itemLink.value = "";
    itemColor.value = "#FFD700";
    itemPIN.value = "";
  }
  if (currentType === "link") {
    itemLink.style.display = "block";
    linkLabel.style.display = "block";
    itemColor.style.display = "none";
    colorLabel.style.display = "none";
    itemPIN.style.display = "none";
    pinLabel.style.display = "none";
  } else {
    itemLink.style.display = "none";
    linkLabel.style.display = "none";
    itemColor.style.display = "block";
    colorLabel.style.display = "block";
    itemPIN.style.display = "block";
    pinLabel.style.display = "block";
  }
  itemTitle.focus();
}
function closeModal() {
  modal.style.display = "none";
}
function saveModal() {
  const title = itemTitle.value.trim();
  if (!title) return alert("Ingrese un título");
  if (currentType === "link") {
    const link = itemLink.value.trim();
    if (!link) return alert("Ingrese URL");
    if (editItemId) {
      const item = data.find((i) => i.id === editItemId);
      item.title = title;
      item.link = link;
    } else {
      data.push({
        id: Date.now(),
        type: "link",
        title,
        link,
        parent: currentFolder,
      });
    }
  } else {
    const color = editItemId ? itemColor.value : getRandomColor();
    const pin = itemPIN.value.trim() || null;
    if (editItemId) {
      const item = data.find((i) => i.id === editItemId);
      item.title = title;
      item.color = color;
      if (pin !== null) folderPINs[item.id] = pin;
      else delete folderPINs[item.id];
    } else {
      const newId = Date.now();
      data.push({
        id: newId,
        type: "folder",
        title,
        color,
        parent: currentFolder,
      });
      if (pin !== null) folderPINs[newId] = pin;
    }
  }
  saveData();
  renderItems(currentFolder);
  closeModal();
}
function deleteItem(id) {
  data = data.filter((i) => i.id !== id && i.parent !== id);
  if (folderPINs[id]) delete folderPINs[id];
  saveData();
  renderItems(currentFolder);
}

// Eventos
addBtn.addEventListener("click", () => {
  addOptions.style.display =
    addOptions.style.display === "flex" ? "none" : "flex";
});
addFolderBtn.addEventListener("click", () => openModal(null, "folder"));
addLinkBtn.addEventListener("click", () => openModal(null, "link"));
cancelItem.addEventListener("click", closeModal);
saveItem.addEventListener("click", saveModal);
searchBottom.addEventListener("input", () => renderItems(currentFolder));
backBtn.addEventListener("click", () => {
  if (folderHistory.length > 0) {
    currentFolder = folderHistory.pop();
    renderItems(currentFolder);
  } else {
    currentFolder = null;
    renderItems();
  }
});

// Atajos teclado
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.key === "n" || e.key === "N") openModal(null, "folder");
  if (e.key === "l" || e.key === "L") openModal(null, "link");
});

// Modal enter
modal.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveModal();
  }
});

// Menú lateral toggle
menuBtn.addEventListener("click", () => {
  if (sideMenu.style.display === "flex") {
    sideMenu.style.display = "none";
    overlay.style.display = "none";
  } else {
    sideMenu.style.display = "flex";
    overlay.style.display = "block";
  }
});
overlay.addEventListener("click", () => {
  sideMenu.style.display = "none";
  overlay.style.display = "none";
});
filesBtn.addEventListener("click", () => {
  filesOptions.style.display =
    filesOptions.style.display === "flex" ? "none" : "flex";
});

// Exportar/Importar
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "linksData.json";
  a.click();
  URL.revokeObjectURL(url);
});
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      data = JSON.parse(event.target.result);
      saveData();
      renderItems();
      alert("Datos cargados correctamente");
    } catch (err) {
      alert("Archivo no válido");
    }
  };
  reader.readAsText(file);
  importFile.value = "";
});

//RELOJ
function updateClock() {
  const now = new Date();
  let hours = now.getHours().toString().padStart(2, "0");
  let minutes = now.getMinutes().toString().padStart(2, "0");
  let seconds = now.getSeconds().toString().padStart(2, "0");
  document.getElementById(
    "clock"
  ).textContent = `${hours}:${minutes}:${seconds}`;
}
setInterval(updateClock, 1000);
updateClock(); // para que aparezca inmediatamente al cargar

renderItems();
