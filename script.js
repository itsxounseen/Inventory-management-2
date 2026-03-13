import { initializeApp } from 
"https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";

import { getAuth, GoogleAuthProvider, signInWithPopup,
onAuthStateChanged, signOut } from 
"https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyAKEwR483coxO4u_v5wadTK0vZ9PvVUioU",
  authDomain: "inventory-management-f3ea9.firebaseapp.com",
  projectId: "inventory-management-f3ea9",
  storageBucket: "inventory-management-f3ea9.firebasestorage.app",
  messagingSenderId: "812103080140",
  appId: "1:812103080140:web:83918712ffbf0343bf8a69",
  measurementId: "G-RQJCGB3FCR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const provider = new GoogleAuthProvider();

document.addEventListener("DOMContentLoaded", () => {

  const loginBtn = document.getElementById("googleLogin");
  const logoutBtn = document.getElementById("logoutBtn");

  /* LOGIN */
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      await signInWithPopup(auth, provider);
      window.location.href = "dashboard.html";
    });
  }

  /* LOGOUT */
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "index.html";
    });
  }

});

/* AUTH CHECK */
onAuthStateChanged(auth, (user) => {

  if (window.location.pathname.includes("dashboard")) {

    if (!user) {
      window.location.href = "index.html";
    } else {
      const userName = document.getElementById("userName");
      if (userName) userName.innerText = user.displayName;
    }

  }

});
document.addEventListener("DOMContentLoaded", function(){
  // ---- GET ALL ELEMENTS ONCE ----
const name = document.getElementById("name");
const buy = document.getElementById("buy");
const sell = document.getElementById("sell");
const stock = document.getElementById("stock");

const productModal = document.getElementById("productModal");
const deleteModal = document.getElementById("deleteModal");
const modalTitle = document.getElementById("modalTitle");

const totalProducts = document.getElementById("totalProducts");
const lowStock = document.getElementById("lowStock");
const monthRevenue = document.getElementById("monthRevenue");
const monthProfit = document.getElementById("monthProfit");

let productData = JSON.parse(localStorage.getItem("inventory_products")) || [];
let salesHistory = JSON.parse(localStorage.getItem("inventory_sales")) || [];

let editId = null;
let deleteId = null;
let selected = null;
let qty = 1;

function save(){
localStorage.setItem("inventory_products", JSON.stringify(productData));
localStorage.setItem("inventory_sales", JSON.stringify(salesHistory));
}

/* NAVIGATION */
window.showSection = function(id,btn){
document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
document.getElementById(id).classList.add("active");
document.querySelectorAll(".tabs button").forEach(b=>b.classList.remove("active"));
btn.classList.add("active");
render();
};

/* OPEN MODAL */
document.getElementById("fabBtn").addEventListener("click", function(){
editId=null;
document.getElementById("modalTitle").innerText="Add Product";
name.value=""; buy.value=""; sell.value=""; stock.value="";
productModal.style.display="flex";
});

window.closeProductModal=function(){
productModal.style.display="none";
};

window.closeDeleteModal=function(){
deleteModal.style.display="none";
};

/* SAVE PRODUCT (FIXED) */
document.getElementById("saveBtn").addEventListener("click", function(){

let n=name.value.trim();
if(!n) return;

let b=+buy.value;
let s=+sell.value;
let st=+stock.value;

if(editId){
let p=productData.find(x=>x.id===editId);
if(p){ p.name=n; p.buy=b; p.sell=s; p.stock=st; }
}else{
productData.push({id:Date.now(),name:n,buy:b,sell:s,stock:st});
}

save();
closeProductModal();
render();
});

/* DELETE */
document.getElementById("confirmDeleteBtn").addEventListener("click", function(){
productData=productData.filter(p=>p.id!==deleteId);
save();
closeDeleteModal();
render();
});

window.openDelete=function(id){
deleteId=id;
deleteModal.style.display="flex";
};

window.openEdit=function(id){
let p=productData.find(x=>x.id===id);
if(!p) return;
editId=id;
modalTitle.innerText="Edit Product";
name.value=p.name; buy.value=p.buy; sell.value=p.sell; stock.value=p.stock;
productModal.style.display="flex";
};

/* SALES */
window.selectProduct=function(id){
selected=productData.find(p=>p.id===id);
qty=1;
render();
};

window.changeQty=function(n){
qty+=n;
if(qty<1) qty=1;
render();
};

window.completeSale=function(){
if(!selected || selected.stock<qty) return;
selected.stock-=qty;

salesHistory.push({
productId:selected.id,
revenue:selected.sell*qty,
profit:(selected.sell-selected.buy)*qty,
date:new Date().toISOString()
});

save();
selected=null;
qty=1;
render();
};

/* RENDER */
function render(){

totalProducts.innerText=productData.length;
lowStock.innerText=productData.filter(p=>p.stock<20).length;

let now=new Date();
let monthSales=salesHistory.filter(s=>{
let d=new Date(s.date);
return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
});

let monthRev=monthSales.reduce((a,b)=>a+b.revenue,0);
let monthProf=monthSales.reduce((a,b)=>a+b.profit,0);

monthRevenue.innerText="₹"+monthRev;
monthProfit.innerText="₹"+monthProf;

/* PRODUCTS */
document.getElementById("products").innerHTML =
productData.map(p=>{
let low = p.stock < 20 ? "stock-low" : "";
return `
<div class="product-card">
    <div class="product-top">
        <div class="product-info">
            <div class="product-name">📦 ${p.name}</div>
            <div class="price-line">
                Buy ₹${p.buy} | Sell ₹${p.sell}
            </div>
        </div>
        <div class="action-icons">
            <button class="icon-btn edit" onclick="openEdit(${p.id})">✏️</button>
            <button class="icon-btn delete" onclick="openDelete(${p.id})">🗑</button>
        </div>
    </div>
    <div class="stock-badge ${low}">
        Stock: ${p.stock}
    </div>
</div>
`;
}).join("");

/* SALES */
document.getElementById("sales").innerHTML =
productData.map(p=>{
let active=selected && selected.id===p.id ? "active":"";
return `<div class="sales-product ${active}" onclick="selectProduct(${p.id})">
🛒 ${p.name} (₹${p.sell}) - Stock ${p.stock}
</div>`;
}).join("") + (selected?`
<div style="text-align:center;margin-top:10px;">Selected: ${selected.name}</div>
<div class="qty-box">
<div class="qty-btn" onclick="changeQty(-1)">−</div>
<div>${qty}</div>
<div class="qty-btn" onclick="changeQty(1)">+</div>
</div>
<button class="primary" onclick="completeSale()">Complete Sale</button>
`:"");

/* REPORT */
document.getElementById("report").innerHTML=`
<div class="product-card">
<h3>This Month Revenue</h3>
<p class="green">₹${monthRev}</p>
</div>
<div class="product-card">
<h3>This Month Profit</h3>
<p class="green">₹${monthProf}</p>
</div>`;
}

render();

});
