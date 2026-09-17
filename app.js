const DATA_URL = 'data/products.json';
const state = {
  products: [],
  filter: 'Alle',
  query: '',
  purchased: JSON.parse(localStorage.getItem('baitermin-purchased') || '{}')
};
const fmt = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 2 });
const labels = { buy:'Køb nu', conditional:'Afhænger af valg', later:'Senere', hold:'Afvent' };

function lowest(p){ return p.offers?.length ? [...p.offers].sort((a,b)=>a.priceDkk-b.priceDkk)[0] : null; }
function eligible(p){ return p.status !== 'hold' && p.offers?.length; }
function save(){ localStorage.setItem('baitermin-purchased', JSON.stringify(state.purchased)); }
function escapeHtml(value=''){ return String(value).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function fallbackImage(p){
  const title = escapeHtml(p.name).slice(0,34);
  const cat = escapeHtml(p.category).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#171a22"/><stop offset="1" stop-color="#08090c"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><path d="M80 650L390 210l310 330 420-380" fill="none" stroke="#b78a42" stroke-width="8" opacity=".6"/><text x="80" y="130" fill="#e0b766" font-family="Arial" font-size="28" font-weight="700" letter-spacing="8">BAITERMIN BUILD</text><text x="80" y="430" fill="#f5f5f2" font-family="Arial" font-size="54" font-weight="800">${title}</text><text x="84" y="500" fill="#999da8" font-family="Arial" font-size="24" letter-spacing="5">${cat}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function renderStats(){
  const tracked = state.products.filter(eligible);
  const all = tracked.reduce((s,p)=>s+lowest(p).priceDkk,0);
  const bought = tracked.filter(p=>state.purchased[p.id]).reduce((s,p)=>s+lowest(p).priceDkk,0);
  const remaining = tracked.filter(p=>!state.purchased[p.id]).reduce((s,p)=>s+lowest(p).priceDkk,0);
  const count = tracked.filter(p=>state.purchased[p.id]).length;
  document.querySelector('#totalAll').textContent = fmt.format(all);
  document.querySelector('#totalBought').textContent = fmt.format(bought);
  document.querySelector('#totalRemaining').textContent = fmt.format(remaining);
  document.querySelector('#progress').textContent = `${Math.round((count/Math.max(1,tracked.length))*100)}%`;
  document.querySelector('#progressDetail').textContent = `${count} af ${tracked.length} dele købt`;
}

function renderFilters(){
  const cats = ['Alle', ...new Set(state.products.map(p=>p.category))];
  const el = document.querySelector('#filters');
  el.innerHTML = cats.map(c=>`<button data-cat="${escapeHtml(c)}" class="${state.filter===c?'active':''}">${escapeHtml(c)}</button>`).join('');
  el.querySelectorAll('button').forEach(b=>b.onclick=()=>{ state.filter=b.dataset.cat; renderFilters(); renderProducts(); });
}

function renderProducts(){
  const q = state.query.trim().toLowerCase();
  const list = state.products
    .filter(p=>state.filter==='Alle'||p.category===state.filter)
    .filter(p=>!q || `${p.name} ${p.category} ${p.note} ${(p.offers||[]).map(o=>o.seller).join(' ')}`.toLowerCase().includes(q))
    .sort((a,b)=>a.order-b.order);

  const root=document.querySelector('#products');
  root.innerHTML=list.map(p=>{
    const offers=[...(p.offers||[])].sort((a,b)=>a.priceDkk-b.priceDkk).slice(0,3);
    const checked=!!state.purchased[p.id];
    const img=p.image?.url || fallbackImage(p);
    const fit=p.image?.fit==='cover'?'cover':'contain';
    return `<article class="product ${checked?'purchased':''}" data-id="${escapeHtml(p.id)}">
      <div class="product-main">
        <div class="product-media ${fit}">
          <img src="${escapeHtml(img)}" data-fallback="${escapeHtml(fallbackImage(p))}" alt="${escapeHtml(p.image?.alt || p.name)}" loading="lazy">
          <span class="order-overlay">${String(p.order).padStart(2,'0')}</span>
          <span class="image-source">${escapeHtml(p.image?.source || 'BAITERMIN')}</span>
        </div>
        <div class="product-body">
          <div class="product-head">
            <div>
              <p class="category">${escapeHtml(p.category)}</p>
              <div class="title-row"><h2>${escapeHtml(p.name)}</h2><span class="badge ${p.status}">${labels[p.status]}</span></div>
              <p class="note">${escapeHtml(p.note)}</p>
            </div>
            <label class="buycheck"><input type="checkbox" ${checked?'checked':''} ${p.status==='hold'?'disabled':''}><span>${checked?'Købt':'Markér købt'}</span></label>
          </div>
          ${offers.length ? `<div class="offers">${offers.map((o,i)=>`<div class="offer ${i===0?'best':''}"><div class="seller">${escapeHtml(o.seller)}</div><div class="price">${fmt.format(o.priceDkk)}</div><div class="native">${escapeHtml(o.priceNative)}</div><div class="tag">${escapeHtml(o.tag||'')}</div><a href="${escapeHtml(o.url)}" target="_blank" rel="noopener">Åbn tilbud ↗</a></div>`).join('')}</div>` : `<div class="empty">Ingen tilbud endnu — denne del står med vilje på pause.</div>`}
        </div>
      </div>
    </article>`;
  }).join('');

  root.querySelectorAll('.product').forEach(card=>{
    const product=state.products.find(p=>p.id===card.dataset.id);
    const img=card.querySelector('.product-media img');
    if(img){
      img.addEventListener('error',()=>{
        img.src=img.dataset.fallback;
        card.querySelector('.image-source').textContent='BAITERMIN fallback';
      },{once:true});
    }
    const input=card.querySelector('input[type=checkbox]');
    if(!input||input.disabled)return;
    input.onchange=()=>{ state.purchased[product.id]=input.checked; save(); renderProducts(); renderStats(); };
  });
}

async function init(){
  try{
    const res=await fetch(DATA_URL,{cache:'no-store'});
    if(!res.ok)throw new Error('Kunne ikke hente produktdata');
    const data=await res.json();
    state.products=data.products;
    document.querySelector('#updated').textContent=`Opdateret ${new Date(data.updatedAt).toLocaleString('da-DK')}`;
    renderFilters(); renderProducts(); renderStats();
  }catch(err){ document.querySelector('#products').innerHTML=`<div class="empty">${escapeHtml(err.message)}</div>`; }
}

document.querySelector('#search').addEventListener('input',e=>{state.query=e.target.value;renderProducts();});
document.querySelector('#reset').onclick=()=>{ if(confirm('Nulstil alle markeringer som købt?')){state.purchased={};save();renderProducts();renderStats();} };
init();
