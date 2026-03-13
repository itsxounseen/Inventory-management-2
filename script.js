import { initializeApp } from 
"https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";

import { getAuth, GoogleAuthProvider, signInWithPopup,
onAuthStateChanged, signOut } 
from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import { getFirestore, collection, addDoc, getDocs, query, where,
deleteDoc, doc, updateDoc } 
from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

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
const db = getFirestore(app);

/* LOGIN / LOGOUT */

document.addEventListener("DOMContentLoaded", () => {

  const loginBtn = document.getElementById("googleLogin");
  const logoutBtn = document.getElementById("logoutBtn");

  if(loginBtn){
    loginBtn.addEventListener("click", async ()=>{
      await signInWithPopup(auth,provider);
      window.location.href="dashboard.html";
    });
  }

  if(logoutBtn){
    logoutBtn.addEventListener("click", async ()=>{
      await signOut(auth);
      window.location.href="index.html";
    });
  }

});

/* AUTH CHECK */

onAuthStateChanged(auth,(user)=>{

  if(window.location.pathname.includes("dashboard")){

    if(!user){
      window.location.href="index.html";
    }else{
      const userName=document.getElementById("userName");
      if(userName) userName.innerText=user.displayName;
      initInventory();
    }

  }

});

/* ================= INVENTORY APP ================= */

async function initInventory(){

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

let productData=[];
let editId=null;
let deleteId=null;

/* LOAD PRODUCTS */

async function loadProducts(){

const q=query(
collection(db,"products"),
where("userId","==",auth.currentUser.uid)
);

const snapshot=await getDocs(q);

productData=[];

snapshot.forEach((doc)=>{
productData.push({id:doc.id,...doc.data()});
});

render();

}

await loadProducts();

/* ADD PRODUCT */

document.getElementById("fabBtn").addEventListener("click",function(){
editId=null;
modalTitle.innerText="Add Product";
name.value=""; buy.value=""; sell.value=""; stock.value="";
productModal.style.display="flex";
});

/* CLOSE MODALS */

window.closeProductModal=function(){
productModal.style.display="none";
};

window.closeDeleteModal=function(){
deleteModal.style.display="none";
};

/* SAVE PRODUCT */

document.getElementById("saveBtn").addEventListener("click",async function(){

let n=name.value.trim();
if(!n) return;

let b=+buy.value;
let s=+sell.value;
let st=+stock.value;

if(editId){

await updateDoc(doc(db,"products",editId),{
name:n,buy:b,sell:s,stock:st
});

}else{

await addDoc(collection(db,"products"),{
name:n,
buy:b,
sell:s,
stock:st,
userId:auth.currentUser.uid
});

}

closeProductModal();
await loadProducts();

});

/* DELETE PRODUCT */

document.getElementById("confirmDeleteBtn").addEventListener("click",async function(){

await deleteDoc(doc(db,"products",deleteId));

closeDeleteModal();
await loadProducts();

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

name.value=p.name;
buy.value=p.buy;
sell.value=p.sell;
stock.value=p.stock;

productModal.style.display="flex";

};

/* RENDER PRODUCTS */

function render(){

totalProducts.innerText=productData.length;
lowStock.innerText=productData.filter(p=>p.stock<20).length;

document.getElementById("products").innerHTML =
productData.map(p=>{

let low=p.stock<20?"stock-low":"";

return `
<div class="product-card">

<div class="product-top">

<div class="product-info">
<div class="product-name">${p.name}</div>
<div class="price-line">
Buy ₹${p.buy} | Sell ₹${p.sell}
</div>
</div>

<div class="action-icons">
<button onclick="openEdit('${p.id}')">Edit</button>
<button onclick="openDelete('${p.id}')">Delete</button>
</div>

</div>

<div class="stock-badge ${low}">
Stock: ${p.stock}
</div>

</div>
`;

}).join("");

}

}
