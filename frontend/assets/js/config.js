const API_BASE = localStorage.getItem('ATLAS_API_BASE') || 'http://localhost:3000';
function token(){return localStorage.getItem('atlas_token')||''}
function user(){try{return JSON.parse(localStorage.getItem('atlas_user')||'null')}catch{return null}}
async function api(path, opts={}){const res=await fetch(API_BASE+path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{}),...(token()?{Authorization:'Bearer '+token()}:{})}});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Request failed');return data}
function money(cents){return '$'+((Number(cents||0)/100).toFixed(2))}
function logout(){localStorage.removeItem('atlas_token');localStorage.removeItem('atlas_user');location.href='../login.html'}
function guard(role){const u=user(); if(!u){location.href='../login.html';return} if(role&&u.role!==role){location.href='../dashboard/index.html'}}
function toast(msg){let t=document.querySelector('.toast'); if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)} t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',3000)}
