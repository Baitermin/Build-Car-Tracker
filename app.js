const DATA_URL = 'data/products.json';
const LIVERY_IMAGE_URL = 'assets/products/baitermin-livery-preview.png';

const state = {
  products: [],
  filter: 'Alle',
  statusFilter: 'all',
  sort: localStorage.getItem('baitermin-sort') || 'priority',
  query: '',
  purchased: JSON.parse(localStorage.getItem('baitermin-purchased') || '{}')
};

const fmt = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
  minimumFractionDigits: 0
});

const labels = {
  buy: 'Køb nu',
  conditional: 'Afhænger af valg',
  later: 'Senere',
  hold: 'Afvent'
};

const sortLabels = {
  priority: 'Køb først',
  order: 'Build-rækkefølge',
  deal: 'Tilbud først',
  'price-asc': 'Pris: lav → høj',
  'price-desc': 'Pris: høj → lav'
};

const statusButtons = [
  ['all', 'Alle mods'],
  ['buy', '🛒 Skal købes'],
  ['deal', '🔥 På tilbud'],
  ['unpurchased', 'Ikke købt'],
  ['purchased', '✓ Købt'],
  ['later', 'Senere'],
  ['hold', 'Afvent']
];

function lowest(p) {
  return p.offers?.length
    ? [...p.offers].sort((a, b) => a.priceDkk - b.priceDkk)[0]
    : null;
}

function eligible(p) {
  return p.status !== 'hold' && p.offers?.length;
}

function save() {
  localStorage.setItem('baitermin-purchased', JSON.stringify(state.purchased));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function isDealOffer(o = {}) {
  const text = `${o.tag || ''} ${o.priceNative || ''}`.toLowerCase();
  return /(tilbud|sale|rabat|discount|spar|save|%)/i.test(text)
    && !/(udsolgt|out of stock)/i.test(text);
}

function dealOffers(p) {
  return (p.offers || []).filter(isDealOffer);
}

function hasDeal(p) {
  return dealOffers(p).length > 0;
}

function fallbackImage(p) {
  const title = escapeHtml(p.name).slice(0, 34);
  const cat = escapeHtml(p.category).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#171a22"/><stop offset="1" stop-color="#08090c"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><path d="M80 650L390 210l310 330 420-380" fill="none" stroke="#b78a42" stroke-width="8" opacity=".6"/><text x="80" y="130" fill="#e0b766" font-family="Arial" font-size="28" font-weight="700" letter-spacing="8">BAITERMIN BUILD</text><text x="80" y="430" fill="#f5f5f2" font-family="Arial" font-size="54" font-weight="800">${title}</text><text x="84" y="500" fill="#999da8" font-family="Arial" font-size="24" letter-spacing="5">${cat}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function renderStats() {
  const tracked = state.products.filter(eligible);
  const all = tracked.reduce((s, p) => s + lowest(p).priceDkk, 0);
  const bought = tracked
    .filter(p => state.purchased[p.id])
    .reduce((s, p) => s + lowest(p).priceDkk, 0);
  const remaining = tracked
    .filter(p => !state.purchased[p.id])
    .reduce((s, p) => s + lowest(p).priceDkk, 0);
  const count = tracked.filter(p => state.purchased[p.id]).length;

  document.querySelector('#totalAll').textContent = fmt.format(all);
  document.querySelector('#totalBought').textContent = fmt.format(bought);
  document.querySelector('#totalRemaining').textContent = fmt.format(remaining);
  document.querySelector('#progress').textContent =
    `${Math.round((count / Math.max(1, tracked.length)) * 100)}%`;
  document.querySelector('#progressDetail').textContent =
    `${count} af ${tracked.length} dele købt`;
}

function renderFilters() {
  const cats = ['Alle', ...new Set(state.products.map(p => p.category))];
  const el = document.querySelector('#filters');

  el.innerHTML = cats.map(c => {
    const count = c === 'Alle'
      ? state.products.length
      : state.products.filter(p => p.category === c).length;

    return `<button type="button" data-cat="${escapeHtml(c)}" class="${state.filter === c ? 'active' : ''}">
      ${escapeHtml(c)} <span>${count}</span>
    </button>`;
  }).join('');

  el.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      state.filter = b.dataset.cat;
      renderFilters();
      renderProducts();
    });
  });
}

function countForStatus(key) {
  return state.products.filter(p => {
    const bought = !!state.purchased[p.id];
    if (key === 'all') return true;
    if (key === 'buy') return p.status === 'buy' && !bought;
    if (key === 'deal') return hasDeal(p) && !bought;
    if (key === 'unpurchased') return !bought;
    if (key === 'purchased') return bought;
    if (key === 'later') return p.status === 'later' && !bought;
    if (key === 'hold') return p.status === 'hold';
    return true;
  }).length;
}

function renderStatusFilters() {
  const el = document.querySelector('#statusFilters');

  el.innerHTML = statusButtons.map(([key, label]) =>
    `<button type="button" data-status="${key}" class="${state.statusFilter === key ? 'active' : ''}">
      <span>${label}</span><b>${countForStatus(key)}</b>
    </button>`
  ).join('');

  el.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      state.statusFilter = b.dataset.status;
      renderStatusFilters();
      renderProducts();
    });
  });
}

function mediaClasses(image = {}) {
  const fit = image.fit === 'cover' ? 'cover' : 'contain';
  const background = image.background === 'dark' ? 'dark-media' : 'light-media';
  return `${fit} ${background}`;
}

function matchesStatus(p) {
  const bought = !!state.purchased[p.id];

  switch (state.statusFilter) {
    case 'buy': return p.status === 'buy' && !bought;
    case 'deal': return hasDeal(p) && !bought;
    case 'unpurchased': return !bought;
    case 'purchased': return bought;
    case 'later': return p.status === 'later' && !bought;
    case 'hold': return p.status === 'hold';
    default: return true;
  }
}

function comparePrices(a, b, direction = 1) {
  const ap = lowest(a)?.priceDkk;
  const bp = lowest(b)?.priceDkk;
  const aMissing = !Number.isFinite(ap);
  const bMissing = !Number.isFinite(bp);

  if (aMissing && bMissing) return a.order - b.order;
  if (aMissing) return 1;
  if (bMissing) return -1;

  return (ap - bp) * direction || a.order - b.order;
}

function priorityCompare(a, b) {
  const aBought = !!state.purchased[a.id];
  const bBought = !!state.purchased[b.id];
  const statusRank = { buy: 0, conditional: 1, later: 2, hold: 3 };

  return Number(aBought) - Number(bBought)
    || (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9)
    || Number(hasDeal(b)) - Number(hasDeal(a))
    || a.order - b.order;
}

function sortProducts(a, b) {
  switch (state.sort) {
    case 'order':
      return a.order - b.order;

    case 'deal': {
      const aDeal = hasDeal(a);
      const bDeal = hasDeal(b);
      if (aDeal !== bDeal) return Number(bDeal) - Number(aDeal);

      if (aDeal && bDeal) {
        const ad = Math.min(...dealOffers(a).map(o => o.priceDkk));
        const bd = Math.min(...dealOffers(b).map(o => o.priceDkk));
        return ad - bd || a.order - b.order;
      }

      return priorityCompare(a, b);
    }

    case 'price-asc':
      return comparePrices(a, b, 1);

    case 'price-desc':
      return comparePrices(a, b, -1);

    case 'priority':
    default:
      return priorityCompare(a, b);
  }
}

function syncSortMenu() {
  const buttonText = document.querySelector('#sortButtonText');
  const options = [...document.querySelectorAll('#sortMenu [data-sort]')];

  if (buttonText) {
    buttonText.textContent = sortLabels[state.sort] || sortLabels.priority;
  }

  options.forEach(option => {
    const active = option.dataset.sort === state.sort;
    option.classList.toggle('active', active);
    option.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function closeSortMenu({ focusButton = false } = {}) {
  const control = document.querySelector('#sortControl');
  const button = document.querySelector('#sortButton');
  const menu = document.querySelector('#sortMenu');

  if (!control || !button || !menu) return;

  control.classList.remove('open');
  button.setAttribute('aria-expanded', 'false');
  menu.hidden = true;

  if (focusButton) button.focus();
}

function openSortMenu() {
  const control = document.querySelector('#sortControl');
  const button = document.querySelector('#sortButton');
  const menu = document.querySelector('#sortMenu');

  if (!control || !button || !menu) return;

  control.classList.add('open');
  button.setAttribute('aria-expanded', 'true');
  menu.hidden = false;
  syncSortMenu();

  const active = menu.querySelector('[data-sort].active') || menu.querySelector('[data-sort]');
  active?.focus();
}

function setSort(value) {
  if (!sortLabels[value]) return;

  state.sort = value;
  localStorage.setItem('baitermin-sort', state.sort);
  syncSortMenu();
  renderProducts();
  closeSortMenu();
}

function setupSortMenu() {
  const control = document.querySelector('#sortControl');
  const button = document.querySelector('#sortButton');
  const menu = document.querySelector('#sortMenu');

  if (!control || !button || !menu) return;

  button.addEventListener('click', event => {
    event.stopPropagation();

    if (menu.hidden) {
      openSortMenu();
    } else {
      closeSortMenu();
    }
  });

  menu.querySelectorAll('[data-sort]').forEach(option => {
    option.addEventListener('click', event => {
      event.stopPropagation();
      setSort(option.dataset.sort);
      button.focus();
    });
  });

  control.addEventListener('keydown', event => {
    const options = [...menu.querySelectorAll('[data-sort]')];
    const current = document.activeElement;
    const index = options.indexOf(current);

    if (event.key === 'Escape') {
      event.preventDefault();
      closeSortMenu({ focusButton: true });
      return;
    }

    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && menu.hidden) {
      event.preventDefault();
      openSortMenu();
      return;
    }

    if (!menu.hidden && event.key === 'ArrowDown') {
      event.preventDefault();
      options[(index + 1 + options.length) % options.length]?.focus();
    }

    if (!menu.hidden && event.key === 'ArrowUp') {
      event.preventDefault();
      options[(index - 1 + options.length) % options.length]?.focus();
    }

    if (!menu.hidden && event.key === 'Home') {
      event.preventDefault();
      options[0]?.focus();
    }

    if (!menu.hidden && event.key === 'End') {
      event.preventDefault();
      options[options.length - 1]?.focus();
    }
  });

  document.addEventListener('click', event => {
    if (!control.contains(event.target)) closeSortMenu();
  });

  window.addEventListener('blur', () => closeSortMenu());
  syncSortMenu();
}

function renderOfferRows(offers) {
  return offers.map((o, i) => {
    const offerDeal = isDealOffer(o);

    return `<div class="offer-row ${i === 0 ? 'best' : ''} ${offerDeal ? 'deal-offer' : ''}">
      <div class="offer-copy">
        <div class="offer-topline">
          <strong>${escapeHtml(o.seller)}</strong>
          ${i === 0 ? '<span class="mini-badge cheapest">Lavest</span>' : ''}
          ${offerDeal ? '<span class="mini-badge sale">Tilbud</span>' : ''}
        </div>
        <span>${escapeHtml(o.tag || '')}</span>
      </div>

      <div class="offer-price">
        <strong>${fmt.format(o.priceDkk)}</strong>
        <small>${escapeHtml(o.priceNative)}</small>
      </div>

      <a href="${escapeHtml(o.url)}" target="_blank" rel="noopener">Åbn ↗</a>
    </div>`;
  }).join('');
}

function renderProducts() {
  const q = state.query.trim().toLowerCase();

  const list = state.products
    .filter(p => state.filter === 'Alle' || p.category === state.filter)
    .filter(matchesStatus)
    .filter(p => !q || `${p.name} ${p.category} ${p.note} ${(p.offers || []).map(o => `${o.seller} ${o.tag || ''}`).join(' ')}`.toLowerCase().includes(q))
    .sort(sortProducts);

  const meta = document.querySelector('#resultMeta');
  if (meta) {
    const deals = list.filter(hasDeal).length;
    meta.textContent = `${list.length} mods • ${deals} tilbud • ${sortLabels[state.sort] || 'Sorteret'}`;
  }

  const root = document.querySelector('#products');

  if (!list.length) {
    root.innerHTML = `<div class="no-results">
      <strong>Ingen mods matcher filtrene.</strong>
      <span>Prøv “Alle mods”, en anden kategori eller ryd søgningen.</span>
    </div>`;
    return;
  }

  root.innerHTML = list.map(p => {
    const offers = [...(p.offers || [])]
      .sort((a, b) => a.priceDkk - b.priceDkk)
      .slice(0, 3);

    const checked = !!state.purchased[p.id];
    const img = p.image?.url || fallbackImage(p);
    const mediaClass = mediaClasses(p.image || {});
    const padding = Number.isFinite(p.image?.padding) ? `${p.image.padding}px` : '12px';
    const position = p.image?.position || 'center center';
    const deal = hasDeal(p);
    const cheapest = lowest(p);

    return `<article class="product ${checked ? 'purchased' : ''} ${deal ? 'has-deal' : ''}" data-id="${escapeHtml(p.id)}">
      <div class="product-media ${mediaClass}" style="--media-padding:${escapeHtml(padding)};--media-position:${escapeHtml(position)};">
        <img src="${escapeHtml(img)}" data-fallback="${escapeHtml(fallbackImage(p))}" alt="${escapeHtml(p.image?.alt || p.name)}" loading="lazy">
        <span class="order-overlay">#${String(p.order).padStart(2, '0')}</span>
        ${deal ? '<span class="deal-overlay">TILBUD</span>' : ''}
        <span class="image-source">${escapeHtml(p.image?.source || 'BAITERMIN')}</span>
      </div>

      <div class="product-body">
        <div class="product-top">
          <p class="category">${escapeHtml(p.category)}</p>
          <div class="badges">
            <span class="badge ${p.status}">${labels[p.status]}</span>
            ${deal ? '<span class="badge deal-badge">På tilbud</span>' : ''}
          </div>
        </div>

        <h2>${escapeHtml(p.name)}</h2>
        <p class="note">${escapeHtml(p.note)}</p>

        <div class="card-spacer"></div>

        ${cheapest ? `<div class="best-price">
          <div>
            <span>Bedste pris</span>
            <strong>${fmt.format(cheapest.priceDkk)}</strong>
            <small>${escapeHtml(cheapest.seller)}</small>
          </div>
          <a href="${escapeHtml(cheapest.url)}" target="_blank" rel="noopener">Åbn billigste ↗</a>
        </div>` : `<div class="best-price no-price">
          <div>
            <span>Pris</span>
            <strong>Afventer</strong>
            <small>Ingen aktiv pris endnu</small>
          </div>
        </div>`}

        <div class="card-actions">
          <label class="buycheck ${checked ? 'checked' : ''}">
            <input type="checkbox" ${checked ? 'checked' : ''} ${p.status === 'hold' ? 'disabled' : ''}>
            <span>${checked ? '✓ Købt' : 'Markér som købt'}</span>
          </label>

          ${offers.length ? `<details class="offer-drawer">
            <summary><span>Se ${offers.length} tilbud</span><b>⌄</b></summary>
            <div class="offer-list">${renderOfferRows(offers)}</div>
          </details>` : ''}
        </div>
      </div>
    </article>`;
  }).join('');

  root.querySelectorAll('.product').forEach(card => {
    const product = state.products.find(p => p.id === card.dataset.id);
    const img = card.querySelector('.product-media img');

    if (img) {
      img.addEventListener('error', () => {
        img.src = img.dataset.fallback;
        card.querySelector('.image-source').textContent = 'BAITERMIN fallback';
      }, { once: true });
    }

    const input = card.querySelector('input[type=checkbox]');
    if (!input || input.disabled) return;

    input.addEventListener('change', () => {
      state.purchased[product.id] = input.checked;
      save();
      renderStatusFilters();
      renderProducts();
      renderStats();
    });
  });
}

async function init() {
  try {
    const cacheKey = Date.now();
    const [res, liveryRes] = await Promise.all([
      fetch(`${DATA_URL}?v=${cacheKey}`, { cache: 'no-store' }),
      fetch(`${LIVERY_IMAGE_URL}?v=${cacheKey}`, { cache: 'no-store' }).catch(() => null)
    ]);

    if (!res.ok) throw new Error('Kunne ikke hente produktdata');

    const data = await res.json();
    state.products = data.products;

    if (liveryRes?.ok) {
      const livery = state.products.find(p => p.id === 'livery');
      if (livery) {
        livery.image = {
          ...(livery.image || {}),
          url: LIVERY_IMAGE_URL,
          source: 'BAITERMIN render',
          fit: 'contain',
          background: 'dark',
          padding: 8,
          position: 'center center'
        };
      }
    }

    document.querySelector('#updated').textContent =
      `Opdateret ${new Date(data.updatedAt).toLocaleString('da-DK')}`;

    if (!sortLabels[state.sort]) state.sort = 'priority';
    syncSortMenu();

    renderFilters();
    renderStatusFilters();
    renderProducts();
    renderStats();
  } catch (err) {
    document.querySelector('#products').innerHTML =
      `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

document.querySelector('#search').addEventListener('input', e => {
  state.query = e.target.value;
  renderProducts();
});

document.querySelector('#reset').addEventListener('click', () => {
  if (confirm('Nulstil alle markeringer som købt?')) {
    state.purchased = {};
    save();
    renderStatusFilters();
    renderProducts();
    renderStats();
  }
});

setupSortMenu();
init();
