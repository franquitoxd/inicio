let currentFolder = null;
let editItemId = null;
let data = JSON.parse(localStorage.getItem("linksData")) || [];
let folderHistory = [];

const container = document.getElementById("container");
const addBtn = document.getElementById("addBtn");
const searchBottom = document.getElementById("searchBottom");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const itemType = document.getElementById("itemType");
const itemTitle = document.getElementById("itemTitle");
const itemLink = document.getElementById("itemLink");
const itemColor = document.getElementById("itemColor");
const saveItem = document.getElementById("saveItem");
const cancelItem = document.getElementById("cancelItem");
const backBtn = document.getElementById("backBtn");

const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

function saveData() {
  localStorage.setItem("linksData", JSON.stringify(data));
}

function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function renderItems(folderId = null) {
  container.innerHTML = "";
  let items = data.filter((i) => i.parent === folderId);
  const search = searchBottom.value.toLowerCase();
  if (search)
    items = items.filter((i) => i.title.toLowerCase().includes(search));

  // Ordenar alfabéticamente
  items.sort((a, b) =>
    a.title.toLowerCase().localeCompare(b.title.toLowerCase())
  );

  items.forEach((item) => {
    const div = document.createElement("div");
    div.classList.add("item");
    div.dataset.id = item.id;

    const iconContainer = document.createElement("div");
    iconContainer.style.width = "100px";
    iconContainer.style.height = "100px";
    iconContainer.style.borderRadius = "10px";
    iconContainer.style.overflow = "hidden";
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
    title.textContent = item.title;
    div.appendChild(title);

    const buttonsDiv = document.createElement("div");
    buttonsDiv.classList.add("buttons");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.onclick = (e) => {
      e.stopPropagation();
      openModal(item.id);
    };
    const delBtn = document.createElement("button");
    delBtn.textContent = "Borrar";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteItem(item.id);
    };
    buttonsDiv.appendChild(editBtn);
    buttonsDiv.appendChild(delBtn);
    div.appendChild(buttonsDiv);

    div.onclick = () => {
      if (item.type === "folder") {
        if (currentFolder !== null) folderHistory.push(currentFolder);
        currentFolder = item.id;
        renderItems(currentFolder);
      } else {
        window.location.href = item.link;
      }
    };

    container.appendChild(div);
  });

  backBtn.style.display = folderId ? "block" : "none";
}

function openModal(id = null) {
  modal.style.display = "flex";
  editItemId = id;
  modalTitle.textContent = id ? "Editar" : "Agregar";
  if (id) {
    const item = data.find((i) => i.id === id);
    itemType.value = item.type;
    itemTitle.value = item.title;
    itemLink.value = item.link || "";
    itemColor.value = item.color || "#FFD700";
  } else {
    itemType.value = "folder";
    itemTitle.value = "";
    itemLink.value = "";
    itemColor.value = "#FFD700";
  }
  itemLink.style.display = itemType.value === "link" ? "block" : "none";
  itemColor.style.display = itemType.value === "folder" ? "block" : "none";
  itemType.onchange = () => {
    itemLink.style.display = itemType.value === "link" ? "block" : "none";
    itemColor.style.display = itemType.value === "folder" ? "block" : "none";
  };
  itemTitle.focus();
}

function closeModal() {
  modal.style.display = "none";
}

function saveModal() {
  const type = itemType.value;
  const title = itemTitle.value.trim();
  if (!title) return alert("Ingrese un título");
  if (type === "link") {
    const link = itemLink.value.trim();
    if (!link) return alert("Ingrese URL");
    if (editItemId) {
      const item = data.find((i) => i.id === editItemId);
      item.title = title;
      item.link = link;
    } else {
      data.push({ id: Date.now(), type, title, link, parent: currentFolder });
    }
  } else {
    const color = editItemId ? itemColor.value : getRandomColor();
    if (editItemId) {
      const item = data.find((i) => i.id === editItemId);
      item.title = title;
      item.color = color;
    } else {
      data.push({ id: Date.now(), type, title, color, parent: currentFolder });
    }
  }
  saveData();
  renderItems(currentFolder);
  closeModal();
}

function deleteItem(id) {
  data = data.filter((i) => i.id !== id && i.parent !== id);
  saveData();
  renderItems(currentFolder);
}

addBtn.addEventListener("click", () => openModal());
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
modal.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveModal();
  }
});

// ================= Exportar / Importar =================
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
  importFile.value = ""; // Limpiar input
});

renderItems();
