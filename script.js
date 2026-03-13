// Smart Inventory - script.js

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc,
  addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where,
  serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKEwR483coxO4u_v5wadTK0vZ9PvVUioU",
  authDomain: "inventory-management-f3ea9.firebaseapp.com",
  projectId: "inventory-management-f3ea9",
  storageBucket: "inventory-management-f3ea9.firebasestorage.app",
  messagingSenderId: "812103080140",
  appId: "1:812103080140:web:83918712ffbf0343bf8a69",
  measurementId: "G-RQJCGB3FCR"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// STATE
let currentUser    = null;
let products       = [];
let allSales       = [];   // all sales for current user, filtered in JS
let editingId      = null;
let deleteTargetId = null;
let saleProduct    = null;
let saleQty        = 1;
let unsubProducts  = null;
let unsubSales     = null;

// DOM REFS
const get = id => document.getElementById(id);

const userName         = get("user-name");
const logoutBtn        = get("logout-btn");
const fab              = get("fab");
const productList      = get("product-list");
const salesList        = get("sales-list");
const productsEmpty    = get("products-empty");
const salesEmpty       = get("sales-empty");
const productSearch    = get("product-search");
const salesSearch      = get("sales-search");

// Report elements
const dailyRevenue      = get("daily-revenue");
const dailyProfit       = get("daily-profit");
const monthlyRevenue    = get("monthly-revenue");
const monthlyProfit     = get("monthly-profit");
const dailySalesCount   = get("daily-sales-count");
const monthlySalesCount = get("monthly-sales-count");
const reportTodayLabel  = get("report-today-label");
const reportMonthLabel  = get("report-month-label");

// Product modal
const productModal    = get("product-modal");
const modalTitle      = get("modal-title");
const modalClose      = get("modal-close");
const productForm     = get("product-form");
const inputName       = get("input-name");
const inputBuy        = get("input-buy");
const inputSell       = get("input-sell");
const inputStock      = get("input-stock");
const formError       = get("form-error");
const modalSubmitBtn  = get("modal-submit-btn");

// Delete modal
const deleteModal       = get("delete-modal");
const deleteModalClose  = get("delete-modal-close");
const deleteProductName = get("delete-product-name");
const deleteCancelBtn   = get("delete-cancel-btn");
const deleteConfirmBtn  = get("delete-confirm-btn");

// Sale modal
const saleModal        = get("sale-modal");
const saleModalClose   = get("sale-modal-close");
const saleProductName  = get("sale-product-name");
const saleProductPrice = get("sale-product-price");
const qtyMinus         = get("qty-minus");
const qtyPlus          = get("qty-plus");
const qtyDisplay       = get("qty-display");
const saleCustomPrice  = get("sale-custom-price");
const saleRevenueEl    = get("sale-revenue");
const saleProfitEl     = get("sale-profit");
const saleError        = get("sale-error");
const saleConfirmBtn   = get("sale-confirm-btn");

// Logout modal
const logoutModal      = get("logout-modal");
const logoutCancelBtn  = get("logout-cancel-btn");
const logoutConfirmBtn = get("logout-confirm-btn");

const toast       = get("toast");
const navBtns     = document.querySelectorAll(".nav-btn");
const tabSections = document.querySelectorAll(".tab-section");

// AUTH
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;
  userName.textContent = user.displayName || user.email || "User";
  startListeners();
});

logoutBtn.addEventListener("click", () => openModal(logoutModal));
logoutCancelBtn.addEventListener("click", () => closeModal(logoutModal));
logoutConfirmBtn.addEventListener("click", async () => {
  if (unsubProducts) unsubProducts();
  if (unsubSales)    unsubSales();
  closeModal(logoutModal);
  await signOut(auth);
  window.location.href = "index.html";
});

// FIRESTORE LISTENERS
function startListeners() {
  const now = new Date();

  // Set report labels
  const todayStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  reportTodayLabel.textContent = todayStr;
  reportMonthLabel.textContent = now.toLocaleString("default", { month: "long", year: "numeric" });

  // Products — no orderBy, sort client-side
  const prodQ = query(
    collection(db, "products"),
    where("userId", "==", currentUser.uid)
  );

  unsubProducts = onSnapshot(prodQ, snap => {
    products = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
    renderProducts(productSearch.value.trim());
    renderSalesTab(salesSearch.value.trim());
  }, err => {
    console.error("Products error:", err.message);
    showToast("Error loading products");
  });

  // Sales — load all for this user, filter by day/month in JS
  // This avoids needing composite Firestore indexes
  const salesQ = query(
    collection(db, "sales"),
    where("userId", "==", currentUser.uid)
  );

  unsubSales = onSnapshot(salesQ, snap => {
    allSales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderReports();
  }, err => {
    console.error("Sales error:", err.message);
  });
}

// REPORT CALCULATIONS
function renderReports() {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();

  let dRevenue = 0, dProfit = 0, dCount = 0;
  let mRevenue = 0, mProfit = 0, mCount = 0;

  allSales.forEach(s => {
    if (!s.createdAt) return;

    // Convert Firestore Timestamp to JS Date
    const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);

    const sY = d.getFullYear();
    const sM = d.getMonth();
    const sD = d.getDate();

    const rev = s.revenue || 0;
    const prt = s.profit  || 0;

    // Monthly
    if (sY === todayY && sM === todayM) {
      mRevenue += rev;
      mProfit  += prt;
      mCount++;

      // Daily (subset of monthly)
      if (sD === todayD) {
        dRevenue += rev;
        dProfit  += prt;
        dCount++;
      }
    }
  });

  dailyRevenue.textContent   = inr(dRevenue);
  dailyProfit.textContent    = inr(dProfit);
  monthlyRevenue.textContent = inr(mRevenue);
  monthlyProfit.textContent  = inr(mProfit);
  dailySalesCount.textContent   = dCount;
  monthlySalesCount.textContent = mCount;
}

// NAVIGATION
navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    navBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    tabSections.forEach(s => {
      const isTarget = s.id === "tab-" + target;
      s.classList.toggle("active", isTarget);
      s.classList.toggle("hidden", !isTarget);
    });
    fab.style.display = target === "products" ? "flex" : "none";
  });
});

// RENDER: PRODUCTS
function renderProducts(filter) {
  filter = (filter || "").toLowerCase();
  const list = filter ? products.filter(p => p.name.toLowerCase().includes(filter)) : products;
  productsEmpty.classList.toggle("hidden", list.length > 0);
  productList.innerHTML = "";
  list.forEach(p => productList.appendChild(buildProductCard(p)));
}

function buildProductCard(p) {
  const card = document.createElement("div");
  card.className = "product-card";

  let badgeClass = "", badgeLabel = p.stock + " in stock";
  if (p.stock === 0)     { badgeClass = "out-of-stock"; badgeLabel = "Out of stock"; }
  else if (p.stock < 20) { badgeClass = "low-stock";    badgeLabel = "Low - " + p.stock; }

  card.innerHTML =
    '<div class="product-card-header">' +
      '<span class="product-card-name" title="' + escHtml(p.name) + '">' + escHtml(p.name) + '</span>' +
      '<span class="stock-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
    '</div>' +
    '<div class="product-card-prices">' +
      '<div class="price-item"><span class="price-label">Buy</span><span class="price-value">' + inr(p.buyPrice) + '</span></div>' +
      '<div class="price-item"><span class="price-label">Sell</span><span class="price-value sell">' + inr(p.sellPrice) + '</span></div>' +
      '<div class="price-item"><span class="price-label">Margin</span><span class="price-value">' + inr(p.sellPrice - p.buyPrice) + '</span></div>' +
    '</div>' +
    '<div class="product-card-actions">' +
      '<button class="icon-btn icon-btn--edit"><span class="material-icons-round">edit</span>Edit</button>' +
      '<button class="icon-btn icon-btn--delete"><span class="material-icons-round">delete</span>Delete</button>' +
    '</div>';

  card.querySelector(".icon-btn--edit").addEventListener("click",   () => openEditModal(p.id));
  card.querySelector(".icon-btn--delete").addEventListener("click", () => openDeleteModal(p.id));
  return card;
}

// RENDER: SALES TAB
function renderSalesTab(filter) {
  filter = (filter || "").toLowerCase();
  const list = filter ? products.filter(p => p.name.toLowerCase().includes(filter)) : products;
  salesEmpty.classList.toggle("hidden", list.length > 0);
  salesList.innerHTML = "";
  list.forEach(p => salesList.appendChild(buildSaleCard(p)));
}

function buildSaleCard(p) {
  const card = document.createElement("div");
  card.className = "product-card";

  const badgeClass = p.stock === 0 ? "out-of-stock" : p.stock < 20 ? "low-stock" : "";
  const badgeLabel = p.stock === 0 ? "Out of stock" : p.stock < 20 ? "Low - " + p.stock : p.stock + " in stock";

  card.innerHTML =
    '<div class="product-card-header">' +
      '<span class="product-card-name">' + escHtml(p.name) + '</span>' +
      '<span class="stock-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
    '</div>' +
    '<div class="product-card-prices">' +
      '<div class="price-item"><span class="price-label">Sell</span><span class="price-value sell">' + inr(p.sellPrice) + '</span></div>' +
      '<div class="price-item"><span class="price-label">Profit/unit</span><span class="price-value">' + inr(p.sellPrice - p.buyPrice) + '</span></div>' +
    '</div>' +
    '<div class="product-card-actions">' +
      '<button class="sale-card-btn" ' + (p.stock === 0 ? "disabled" : "") + '>' +
        '<span class="material-icons-round" style="font-size:18px">shopping_cart</span>' +
        (p.stock === 0 ? "Out of stock" : "Sell") +
      '</button>' +
    '</div>';

  if (p.stock > 0) {
    card.querySelector(".sale-card-btn").addEventListener("click", () => openSaleModal(p.id));
  }
  return card;
}

// SEARCH
productSearch.addEventListener("input", () => renderProducts(productSearch.value.trim()));
salesSearch.addEventListener("input",   () => renderSalesTab(salesSearch.value.trim()));

// PRODUCT MODAL
fab.addEventListener("click", openAddModal);

function openAddModal() {
  editingId = null;
  modalTitle.textContent     = "Add Product";
  modalSubmitBtn.textContent = "Save Product";
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

  if (!name)                              return showError(formError, "Product name is required.");
  if (isNaN(buyPrice)  || buyPrice  < 0)  return showError(formError, "Enter a valid buy price.");
  if (isNaN(sellPrice) || sellPrice < 0)  return showError(formError, "Enter a valid sell price.");
  if (isNaN(stock)     || stock     < 0)  return showError(formError, "Enter a valid stock quantity.");

  modalSubmitBtn.disabled    = true;
  modalSubmitBtn.textContent = "Saving...";

  try {
    if (editingId) {
      await updateDoc(doc(db, "products", editingId), { name, buyPrice, sellPrice, stock });
      showToast("Product updated");
    } else {
      await addDoc(collection(db, "products"), {
        userId: currentUser.uid,
        name, buyPrice, sellPrice, stock,
        createdAt: serverTimestamp()
      });
      showToast("Product added");
    }
    closeModal(productModal);
  } catch (err) {
    showError(formError, "Error: " + err.message);
  } finally {
    modalSubmitBtn.disabled    = false;
    modalSubmitBtn.textContent = editingId ? "Update Product" : "Save Product";
  }
});

// DELETE MODAL
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
  deleteConfirmBtn.disabled    = true;
  deleteConfirmBtn.textContent = "Deleting...";
  try {
    await deleteDoc(doc(db, "products", deleteTargetId));
    showToast("Product deleted");
    closeModal(deleteModal);
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    deleteConfirmBtn.disabled    = false;
    deleteConfirmBtn.textContent = "Delete";
    deleteTargetId = null;
  }
});

// SALE MODAL
function openSaleModal(id) {
  saleProduct = products.find(x => x.id === id);
  if (!saleProduct) return;
  saleQty = 1;
  saleProductName.textContent  = saleProduct.name;
  saleProductPrice.textContent = "Default sell: " + inr(saleProduct.sellPrice) + "  |  Buy: " + inr(saleProduct.buyPrice);
  saleCustomPrice.value        = "";
  saleCustomPrice.placeholder  = fmt(saleProduct.sellPrice) + " (default)";
  updateSaleSummary();
  hideError(saleError);
  openModal(saleModal);
}

saleModalClose.addEventListener("click", () => closeModal(saleModal));
saleCustomPrice.addEventListener("input", updateSaleSummary);

qtyMinus.addEventListener("click", () => {
  if (saleQty > 1) { saleQty--; updateSaleSummary(); }
});
qtyPlus.addEventListener("click", () => {
  if (saleProduct && saleQty < saleProduct.stock) { saleQty++; updateSaleSummary(); }
});

function getEffectiveSellPrice() {
  const custom = parseFloat(saleCustomPrice.value);
  return (!isNaN(custom) && custom >= 0) ? custom : saleProduct.sellPrice;
}

function updateSaleSummary() {
  if (!saleProduct) return;
  qtyDisplay.textContent    = saleQty;
  const sp = getEffectiveSellPrice();
  saleRevenueEl.textContent = inr(sp * saleQty);
  saleProfitEl.textContent  = inr((sp - saleProduct.buyPrice) * saleQty);
}

saleConfirmBtn.addEventListener("click", async () => {
  if (!saleProduct) return;
  if (saleQty < 1 || saleQty > saleProduct.stock) return showError(saleError, "Invalid quantity.");

  const sellPrice = getEffectiveSellPrice();
  if (sellPrice < 0) return showError(saleError, "Selling price cannot be negative.");

  saleConfirmBtn.disabled    = true;
  saleConfirmBtn.textContent = "Processing...";
  hideError(saleError);

  const newStock = saleProduct.stock - saleQty;
  const revenue  = sellPrice * saleQty;
  const profit   = (sellPrice - saleProduct.buyPrice) * saleQty;

  try {
    await updateDoc(doc(db, "products", saleProduct.id), { stock: newStock });
    await addDoc(collection(db, "sales"), {
      userId:      currentUser.uid,
      productId:   saleProduct.id,
      productName: saleProduct.name,
      quantity:    saleQty,
      sellPrice,
      revenue,
      profit,
      createdAt:   serverTimestamp()
    });
    showToast("Sale recorded - " + inr(revenue));
    closeModal(saleModal);
    saleProduct = null;
  } catch (err) {
    showError(saleError, "Error: " + err.message);
  } finally {
    saleConfirmBtn.disabled    = false;
    saleConfirmBtn.textContent = "Complete Sale";
  }
});

// MODAL HELPERS
function openModal(modal) {
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal(modal) {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}
[productModal, deleteModal, saleModal, logoutModal].forEach(modal => {
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(modal); });
});

// TOAST
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

// UTILS
function inr(n) {
  const val = parseFloat(n) || 0;
  return "\u20B9" + val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
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
