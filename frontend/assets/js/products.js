async function loadProducts(){
 const qs=new URLSearchParams(location.search); const q=document.querySelector('#search')?.value||qs.get('search')||''; const cat=document.querySelector('#category')?.value||''; const type=document.querySelector('#type')?.value||''; const max=document.querySelector('#max_price')?.value||'';
 const params=new URLSearchParams(); if(q)params.set('search',q); if(cat)params.set('category',cat); if(type)params.set('type',type); if(max)params.set('max_price',max);
 const data=await api('/api/products?'+params.toString()); const wrap=document.querySelector('#productsGrid'); if(!wrap)return;
 wrap.innerHTML=data.products.map(p=>`<article class="card product-card"><img src="${p.image_url||'../assets/img/product-placeholder.svg'}" alt="${p.name}"><div class="body"><span class="badge">${p.category}</span><h3>${p.name}</h3><p class="muted">${p.short_description||''}</p><div class="price">${money(p.price_cents)}</div><div class="actions"><a class="btn primary" href="details.html?slug=${p.slug}">View Product</a><a class="btn" href="../register.html">Buy / Get License</a></div></div></article>`).join('')||'<p class="muted">No products found.</p>';
}
document.addEventListener('DOMContentLoaded',()=>{loadProducts().catch(e=>toast(e.message));document.querySelector('#applyFilters')?.addEventListener('click',()=>loadProducts().catch(e=>toast(e.message)))})
