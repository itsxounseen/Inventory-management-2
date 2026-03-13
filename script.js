import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, deleteDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
apiKey: "PASTE_YOURS",
authDomain: "PASTE_YOURS",
projectId: "PASTE_YOURS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

let productData=[];
let editId=null;
let deleteId=null;

document.addEventListener("DOMContentLoaded",()=>{

const loginBtn=document.getElementById("googleLogin");
const logoutBtn=document.getElementById("logoutBtn");

if(loginBtn){
loginBtn.onclick=async()=>{
await signInWithPopup(auth,provider);
location="dashboard.html";
};
}

if(logoutBtn){
logoutBtn.onclick=async()=>{
await signOut(auth);
location="index.html";
};
}

});

onAuthStateChanged(auth,(user)=>{

if(location.pathname.includes("dashboard")){

if(!user){
location="index.html";
}else{
document.getElementById("userName").innerText=user.displayName;
startInventory();
}

}

});

function startInventory(){

const productsDiv=document.getElementById("products");

const q=query(collection(db,"products"),where("userId","==",auth.currentUser.uid));

onSnapshot(q,(snap)=>{

productData=[];
snap.forEach(d=>productData.push({id:d.id,...d.data()}));

render();

});

document.getElementById("fabBtn").onclick=()=>{
editId=null;
document.getElementById("productModal").style.display="flex";
};

document.getElementById("saveBtn").onclick=async()=>{

let name=document.getElementById("name").value;
let buy=+document.getElementById("buy").value;
let sell=+document.getElementById("sell").value;
let stock=+document.getElementById("stock").value;

if(editId){

await updateDoc(doc(db,"products",editId),{name,buy,sell,stock});

}else{

await addDoc(collection(db,"products"),{name,buy,sell,stock,userId:auth.currentUser.uid});

}

closeProductModal();

};

document.getElementById("confirmDeleteBtn").onclick=async()=>{
await deleteDoc(doc(db,"products",deleteId));
closeDeleteModal();
};

function render(){

productsDiv.innerHTML=
productData.map(p=>`

<div class="product-card">

<div class="product-top">

<div>
<b>${p.name}</b><br>
Buy ₹${p.buy} | Sell ₹${p.sell}
</div>

<div class="action-icons">
<button onclick="editProduct('${p.id}')">✏️</button>
<button onclick="deleteProduct('${p.id}')">🗑</button>
</div>

</div>

<div class="stock-badge">
Stock: ${p.stock}
</div>

</div>

`).join("");

}

window.editProduct=(id)=>{

let p=productData.find(x=>x.id===id);
editId=id;

document.getElementById("name").value=p.name;
document.getElementById("buy").value=p.buy;
document.getElementById("sell").value=p.sell;
document.getElementById("stock").value=p.stock;

document.getElementById("productModal").style.display="flex";

};

window.deleteProduct=(id)=>{
deleteId=id;
document.getElementById("deleteModal").style.display="flex";
};

}

window.closeProductModal=()=>{
document.getElementById("productModal").style.display="none";
};

window.closeDeleteModal=()=>{
document.getElementById("deleteModal").style.display="none";
};

window.showSection=(id,btn)=>{

document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
document.getElementById(id).classList.add("active");

document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.remove("active"));
btn.classList.add("active");

};
