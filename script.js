// ════════════════════════════════════════════
//  SMART INVENTORY – script.js
//  Firebase Auth + Firestore, real-time sync
// ════════════════════════════════════════════

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc,
  addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where,
  serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── REPLACE WITH YOUR FIREBASE CONFIG ──
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
let currentUser   = null;
let products      = [];          // local cache from Firestore listener
let sales         = [];          // local cache of this-month sales
let editingId     = null;        // product id being edited
let deleteTargetId = null;       // product id pending deletion
let saleProduct   = null;        // product being sold
let saleQty       = 1;
let unsubProducts = null;        // Firestore listener unsubscribe
let unsubSales    = null;

// ══════════════════════════════════════════
//  DOM REFERENCES
// ══════════════════════════════════════════
const $  = id => document.getElementById(id);
const userName         = $("user-name");
const logoutBtn        = $("logout-btn");
const fab              = $("fab");
const productList      = $("product-list");
const salesList        = $("sales-list");
const productsEmpty    = $("products-empty");
const salesEmpty       = $("sales-empty");
const productSearch    = $("product-search");
const salesSearch      = $("sales-search");
const monthlyRevenue   = $("monthly-revenue");
const monthlyProfit    = $("monthly-profit");
const reportMonthLabel = $("report-month-label");

// Modals
const productModal     = $("product-modal");
const modalTitle       = $("modal-title");
const modalClose       = $("modal-close");
const productForm      = $("product-form");
const inputName        = $("input-name");
const inputBuy         = $("input-buy");
const inputSell        = $("input-sell");
const inputStock       = $("input-stock");
const formError        = $("form-error");
const modalSubmitBtn   = $("modal-submit-btn");

const deleteModal      = $("delete-modal");
const deleteModalClose = $("delete-modal-close");
const deleteProductName = $("delete-product-name");
const deleteCancelBtn  = $("delete-cancel-btn");
const deleteConfirmBtn = $("delete-confirm-btn");

const saleModal        = $("sale-modal");
const saleModalClose   = $("sale-modal-close");
const saleProductName  = $("sale-product-name");
const saleProductPrice = $("sale-product-price");
const qtyMinus         = $("qty-minus");
const qtyPlus          = $("qty-plus");
const qtyDisplay       = $("qty-display");
const saleRevenueEl    = $("sale-revenue");
const saleProfitEl     = $("sale-profit");
const saleError        = $("sale-error");
const saleConfirmBtn   = $("sale-confirm-btn");

const toast            = $("toast");
const navBtns          = document.querySelectorAll(".nav-btn");
const tabSections      = document.querySelectorAll(".tab-section");

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  userName.textContent = user.displayName || user.email || "User";
  startListeners();
});

logoutBtn.addEventListener("click", async () => {
  if (unsubProducts) unsubProducts();
  if (unsubSales)    unsubSales();
  await signOut(auth);
  window.location.href = "index.html";
});

// ══════════════════════════════════════════
//  FIRESTORE LISTENERS
// ══════════════════════════════════════════
function startListeners() {
  // ── Products (real-time) ──
  const prodQ = query(
    collection(db, "products"),
    where("userId", "==", currentUser.uid),
    orderBy("createdAt", "desc")
  );

  unsubProducts = onSnapshot(prodQ, snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts(productSearch.value.trim());
    renderSalesTab(salesSearch.value.trim());
  });

  // ── Sales (current month, real-time) ──
  const now  = new Date();
  const y    = now.getFullYear();
  const m    = now.getMonth();
  const from = new Date(y, m, 1);
  const to   = new Date(y, m + 1, 1);

  const salesQ = query(
    collection(db, "sales"),
    where("userId",    "==", currentUser.uid),
    where("createdAt", ">=", from),
    where("createdAt", "<",  to)
  );

  unsubSales = onSnapshot(salesQ, snap => {
    sales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderReports();
  });

  // Set report month label
  reportMonthLabel.textContent = now.toLocaleString("default", { month: "long", year: "numeric" });
}

// ══════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════
navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    navBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    tabSections.forEach(s => {
      s.classList.toggle("active",  s.id === `tab-${target}`);
      s.classList.toggle("hidden", s.id !== `tab-${target}`);
    });

    // Show/hide FAB (only on products tab)
    fab.style.display = target === "products" ? "flex" : "none";
  });
});

// ══════════════════════════════════════════
//  RENDER: PRODUCTS
// ══════════════════════════════════════════
function renderProducts(filter = "") {
  const q      = filter.toLowerCase();
  const list   = q ? products.filter(p => p.name.toLowerCase().includes(q)) : products;
  const isEmpty = list.length === 0;

  productsEmpty.classList.toggle("hidden", !isEmpty);
  productList.innerHTML = "";

  list.forEach(product => {
    const card = buildProductCard(product);
    productList.appendChild(card);
  });
}

function buildProductCard(product) {
  const { id, name, buyPrice, sellPrice, stock } = product;
  const card = document.createElement("div");
  card.className = "product-card";

  // Stock badge style
  let badgeClass = "";
  let badgeLabel = `${stock} in stock`;
  if (stock === 0)   { badgeClass = "out-of-stock"; badgeLabel = "Out of stock"; }
  else if (stock < 20) { badgeClass = "low-stock";    badgeLabel = `Low – ${stock}`; }

  card.innerHTML = `
    <div class="product-card-header">
      <span class="product-card-name" title="${escHtml(name)}">${escHtml(name)}</span>
      <span class="stock-badge ${badgeClass}">${badgeLabel}</span>
    </div>
    <div class="product-card-prices">
      <div class="price-item">
        <span class="price-label">Buy</span>
        <span class="price-value">$${fmt(buyPrice)}</span>
      </div>
      <div class="price-item">
        <span class="price-label">Sell</span>
        <span class="price-value sell">$${fmt(sellPrice)}</span>
      </div>
      <div class="price-item">
        <span class="price-label">Margin</span>
        <span class="price-value">$${fmt(sellPrice - buyPrice)}</span>
      </div>
    </div>
    <div class="product-card-actions">
      <button class="icon-btn icon-btn--edit" data-id="${id}">
        <span class="material-icons-round">edit</span>
        Edit
      </button>
      <button class="icon-btn icon-btn--delete" data-id="${id}">
        <span class="material-icons-round">delete</span>
        Delete
      </button>
    </div>`;

  card.querySelector(".icon-btn--edit").addEventListener("click",   () => openEditModal(id));
  card.querySelector(".icon-btn--delete").addEventListener("click", () => openDeleteModal(id));
  return card;
}

// ══════════════════════════════════════════
//  RENDER: SALES TAB
// ══════════════════════════════════════════
function renderSalesTab(filter = "") {
  const q      = filter.toLowerCase();
  const list   = q ? products.filter(p => p.name.toLowerCase().includes(q)) : products;
  const isEmpty = list.length === 0;

  salesEmpty.classList.toggle("hidden", !isEmpty);
  salesList.innerHTML = "";

  list.forEach(product => {
    const card = buildSaleCard(product);
    salesList.appendChild(card);
  });
}

function buildSaleCard(product) {
  const { id, name, buyPrice, sellPrice, stock } = product;
  const card = document.createElement("div");
  card.className = "product-card";

  const badgeClass = stock === 0 ? "out-of-stock" : stock < 20 ? "low-stock" : "";
  const badgeLabel = stock === 0 ? "Out of stock" : stock < 20 ? `Low – ${stock}` : `${stock} in stock`;

  card.innerHTML = `
    <div class="product-card-header">
      <span class="product-card-name" title="${escHtml(name)}">${escHtml(name)}</span>
      <span class="stock-badge ${badgeClass}">${badgeLabel}</span>
    </div>
    <div class="product-card-prices">
      <div class="price-item">
        <span class="price-label">Sell</span>
        <span class="price-value sell">$${fmt(sellPrice)}</span>
      </div>
      <div class="price-item">
        <span class="price-label">Profit/unit</span>
        <span class="price-value">$${fmt(sellPrice - buyPrice)}</span>
      </div>
    </div>
    <div class="product-card-actions">
      <button class="sale-card-btn" data-id="${id}" ${stock === 0 ? "disabled" : ""}>
        <span class="material-icons-round" style="font-size:18px;">shopping_cart</span>
        ${stock === 0 ? "Out of stock" : "Sell"}
      </button>
    </div>`;

  if (stock > 0) {
    card.querySelector(".sale-card-btn").addEventListener("click", () => openSaleModal(id));
  }
  return card;
}

// ══════════════════════════════════════════
//  RENDER: REPORTS
// ══════════════════════════════════════════
function renderReports() {
  const revenue = sales.reduce((sum, s) => sum + (s.revenue || 0), 0);
  const profit  = sales.reduce((sum, s) => sum + (s.profit  || 0), 0);
  monthlyRevenue.textContent = `$${fmt(revenue)}`;
  monthlyProfit.textContent  = `$${fmt(profit)}`;
}

// ══════════════════════════════════════════
//  SEARCH
// ══════════════════════════════════════════
productSearch.addEventListener("input", () => renderProducts(productSearch.value.trim()));
salesSearch.addEventListener("input",   () => renderSalesTab(salesSearch.value.trim()));

// ══════════════════════════════════════════
//  PRODUCT MODAL – ADD / EDIT
// ══════════════════════════════════════════
fab.addEventListener("click", openAddModal);

function openAddModal() {
  editingId = null;
  modalTitle.textContent       = "Add Product";
  modalSubmitBtn.textContent   = "Save Product";
  productForm.reset();
  hideError(formError);
  openModal(productModal);
}

function openEditModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  modalTitle.textContent     = "Edit Product";
  modalSubmitBtn.textContent = "Update Product";
  inputName.value  = p.name;
  inputBuy.value   = p.buyPrice;
  inputSell.value  = p.sellPrice;
  inputStock.value = p.stock;
  hideError(formError);
  openModal(productModal);
}

modalClose.addEventListener("click", () => closeModal(productModal));

productForm.addEventListener("submit", async e => {
  e.preventDefault();
  hideError(formError);

  const name      = inputName.value.trim();
  const buyPrice  = parseFloat(inputBuy.value);
  const sellPrice = parseFloat(inputSell.value);
  const stock     = parseInt(inputStock.value, 10);

  if (!name)                  return showError(formError, "Product name is required.");
  if (isNaN(buyPrice)  || buyPrice  < 0) return showError(formError, "Enter a valid buy price.");
  if (isNaN(sellPrice) || sellPrice < 0) return showError(formError, "Enter a valid sell price.");
  if (isNaN(stock)     || stock     < 0) return showError(formError, "Enter a valid stock quantity.");

  modalSubmitBtn.disabled = true;
  modalSubmitBtn.textContent = "Saving…";

  try {
    if (editingId) {
      await updateDoc(doc(db, "products", editingId), { name, buyPrice, sellPrice, stock });
      showToast("Product updated ✓");
    } else {
      await addDoc(collection(db, "products"), {
        userId: currentUser.uid,
        name, buyPrice, sellPrice, stock,
        createdAt: serverTimestamp()
      });
      showToast("Product added ✓");
    }
    closeModal(productModal);
  } catch (err) {
    showError(formError, "Error saving product: " + err.message);
  } finally {
    modalSubmitBtn.disabled    = false;
    modalSubmitBtn.textContent = editingId ? "Update Product" : "Save Product";
  }
});

// ══════════════════════════════════════════
//  DELETE MODAL
// ══════════════════════════════════════════
function openDeleteModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  deleteTargetId = id;
  deleteProductName.textContent = p.name;
  openModal(deleteModal);
}

deleteModalClose.addEventListener("click",  () => closeModal(deleteModal));
deleteCancelBtn.addEventListener("click",   () => closeModal(deleteModal));

deleteConfirmBtn.addEventListener("click", async () => {
  if (!deleteTargetId) return;
  deleteConfirmBtn.disabled     = true;
  deleteConfirmBtn.textContent  = "Deleting…";
  try {
    await deleteDoc(doc(db, "products", deleteTargetId));
    showToast("Product deleted");
    closeModal(deleteModal);
  } catch (err) {
    alert("Error deleting: " + err.message);
  } finally {
    deleteConfirmBtn.disabled    = false;
    deleteConfirmBtn.textContent = "Delete";
    deleteTargetId = null;
  }
});

// ══════════════════════════════════════════
//  SALE MODAL
// ══════════════════════════════════════════
function openSaleModal(id) {
  saleProduct = products.find(x => x.id === id);
  if (!saleProduct) return;
  saleQty = 1;
  saleProductName.textContent  = saleProduct.name;
  saleProductPrice.textContent = `Sell: $${fmt(saleProduct.sellPrice)} | Buy: $${fmt(saleProduct.buyPrice)}`;
  updateSaleSummary();
  hideError(saleError);
  openModal(saleModal);
}

saleModalClose.addEventListener("click", () => closeModal(saleModal));

qtyMinus.addEventListener("click", () => {
  if (saleQty > 1) { saleQty--; updateSaleSummary(); }
});

qtyPlus.addEventListener("click", () => {
  if (saleProduct && saleQty < saleProduct.stock) {
    saleQty++;
    updateSaleSummary();
  }
});

function updateSaleSummary() {
  qtyDisplay.textContent = saleQty;
  const revenue = (saleProduct.sellPrice * saleQty);
  const profit  = ((saleProduct.sellPrice - saleProduct.buyPrice) * saleQty);
  saleRevenueEl.textContent = `$${fmt(revenue)}`;
  saleProfitEl.textContent  = `$${fmt(profit)}`;
}

saleConfirmBtn.addEventListener("click", async () => {
  if (!saleProduct) return;
  if (saleQty < 1 || saleQty > saleProduct.stock) {
    return showError(saleError, "Invalid quantity.");
  }

  saleConfirmBtn.disabled    = true;
  saleConfirmBtn.textContent = "Processing…";
  hideError(saleError);

  const newStock = saleProduct.stock - saleQty;
  const revenue  = saleProduct.sellPrice * saleQty;
  const profit   = (saleProduct.sellPrice - saleProduct.buyPrice) * saleQty;

  try {
    // Reduce stock
    await updateDoc(doc(db, "products", saleProduct.id), { stock: newStock });

    // Record sale
    await addDoc(collection(db, "sales"), {
      userId:    currentUser.uid,
      productId: saleProduct.id,
      productName: saleProduct.name,
      quantity:  saleQty,
      revenue,
      profit,
      createdAt: serverTimestamp()
    });

    showToast(`Sale recorded – $${fmt(revenue)} revenue`);
    closeModal(saleModal);
    saleProduct = null;
  } catch (err) {
    showError(saleError, "Error completing sale: " + err.message);
  } finally {
    saleConfirmBtn.disabled    = false;
    saleConfirmBtn.textContent = "Complete Sale";
  }
});

// ══════════════════════════════════════════
//  MODAL HELPERS
// ══════════════════════════════════════════
function openModal(modal) {
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal(modal) {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

// Close on backdrop click
[productModal, deleteModal, saleModal].forEach(modal => {
  modal.addEventListener("click", e => {
    if (e.target === modal) closeModal(modal);
  });
});

// ══════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 320);
  }, 2800);
}

// ══════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════
function fmt(n) {
  return (parseFloat(n) || 0).toFixed(2);
}

function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}
function hideError(el) {
  el.textContent = "";
  el.classList.add("hidden");
}
