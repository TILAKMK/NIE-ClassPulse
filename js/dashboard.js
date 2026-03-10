// ============================================================
//  js/dashboard.js  —  Powers index.html
// ============================================================
import { initScheduler }                                     from './scheduler.js';
import { getAllRooms, getRoomStats, searchRooms, filterRooms,
         subscribeToRoomChanges }                            from './rooms.js';
import { getUser, getUserRole, logout }                      from './auth.js';

const grid          = document.getElementById('room-grid');
const statsTotal    = document.getElementById('stat-total');
const statsVacant   = document.getElementById('stat-vacant');
const statsOccupied = document.getElementById('stat-occupied');
const statsFreeSoon = document.getElementById('stat-free-soon');
const roomCount     = document.getElementById('room-count');
const searchInput   = document.getElementById('search-input');
const searchBtn     = document.getElementById('search-btn');
const filterBuilding = document.getElementById('filter-building');
const filterStatus   = document.getElementById('filter-status');
const authBtn        = document.getElementById('auth-btn');
const userGreeting   = document.getElementById('user-greeting');

async function init() {
  await loadUser();
  await loadStats();
  await loadRooms();
  initScheduler();
  bindEvents();
  listenRealtime();
}

async function loadUser() {
  const user = await getUser();
  if (user) {
    const role = await getUserRole();
    userGreeting.textContent = `${user.email} (${role})`;
    authBtn.textContent = 'Logout';
    authBtn.onclick = (e) => { e.preventDefault(); logout(); };
  }
}

async function loadStats() {
  try {
    const s = await getRoomStats();
    animateCount(statsTotal,    s.total);
    animateCount(statsVacant,   s.vacant);
    animateCount(statsOccupied, s.occupied);
    animateCount(statsFreeSoon, s.freeSoon);
  } catch(e) { console.error('Stats error', e); }
}

function animateCount(el, target) {
  if (!el) return;
  let count = 0;
  const step = Math.ceil(target / 30);
  const t = setInterval(() => {
    count = Math.min(count + step, target);
    el.textContent = count;
    if (count >= target) clearInterval(t);
  }, 30);
}

async function loadRooms(rooms = null) {
  grid.innerHTML = '<div class="col-span-full flex justify-center py-12"><div class="loader"></div></div>';
  try {
    const data = rooms ?? await getAllRooms();
    if (roomCount) roomCount.textContent = `(${data.length} rooms)`;
    if (!data.length) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-16 text-slate-400">
          <span class="material-symbols-outlined text-5xl block mb-3">search_off</span>
          <p class="text-lg font-medium">No classrooms found</p>
        </div>`;
      return;
    }
    grid.innerHTML = data.map(buildRoomCard).join('');
    attachCardListeners();
  } catch(err) {
    grid.innerHTML = `<div class="col-span-full text-red-500 text-center py-8">Error: ${err.message}</div>`;
  }
}

function fmtTime(t) {
  if (!t) return '';
  const parts = String(t).substring(0,5).split(':');
  const h = parseInt(parts[0]), m = parts[1];
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

function buildRoomCard(room) {
  const isVacant   = room.status === 'vacant';
  const isFreeSoon = room.status === 'free_soon';
  const isOccupied = room.status === 'occupied';

  const barColor    = isVacant ? 'bg-green-500' : isFreeSoon ? 'bg-amber-500' : 'bg-red-500';
  const badgeBg     = isVacant ? 'bg-green-100 text-green-700'
                    : isFreeSoon ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700';
  const badgeLabel  = isVacant ? 'Vacant' : isFreeSoon ? 'Free Soon' : 'Occupied';

  const bodyHtml = (isOccupied || isFreeSoon) && room.current_subject
    ? `<div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-6">
         <p class="text-xs text-slate-500 uppercase font-bold mb-1">Ongoing Session</p>
         <p class="font-bold text-primary text-sm">${room.current_subject}</p>
         ${room.session_start ? `<p class="text-xs text-slate-500 mt-0.5">${fmtTime(room.session_start)} – ${fmtTime(room.session_end)}</p>` : ''}
       </div>`
    : `<div class="space-y-2 mb-6">
         <div class="flex items-center gap-2 text-sm text-slate-500">
           <span class="material-symbols-outlined text-base">groups</span>
           <span>60 Students</span>
         </div>
         <div class="flex items-center gap-2 text-sm text-slate-500">
           <span class="material-symbols-outlined text-base">location_on</span>
           <span>${room.building}</span>
         </div>
       </div>`;

  return `
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl transition-shadow room-card" data-id="${room.id}">
      <div class="h-2 ${barColor}"></div>
      <div class="p-6">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h4 class="text-2xl font-bold">${room.room_number}</h4>
            <p class="text-sm text-slate-500">${room.building} • ${room.floor}</p>
          </div>
          <span class="${badgeBg} text-xs font-bold px-2 py-1 rounded-lg uppercase">${badgeLabel}</span>
        </div>
        ${bodyHtml}
        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <span class="text-xs text-slate-400">${room.section ?? ''}</span>
          <button class="text-primary text-sm font-semibold hover:underline view-schedule-btn" data-id="${room.id}">
            View Schedule →
          </button>
        </div>
      </div>
    </div>`;
}

function attachCardListeners() {
  document.querySelectorAll('.view-schedule-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = `/pages/room-detail.html?id=${btn.dataset.id}`;
    });
  });
}

async function handleSearch() {
  const q = searchInput.value.trim();
  if (!q) { await loadRooms(); return; }
  const results = await searchRooms(q);
  await loadRooms(results);
}

async function handleFilter() {
  const results = await filterRooms({
    building: filterBuilding?.value,
    status:   filterStatus?.value,
  });
  await loadRooms(results);
}

function listenRealtime() {
  subscribeToRoomChanges((updated) => {
    const card = document.querySelector(`.room-card[data-id="${updated.id}"]`);
    if (card) {
      const newHtml = buildRoomCard(updated);
      const tmp = document.createElement('div');
      tmp.innerHTML = newHtml;
      card.replaceWith(tmp.firstElementChild);
      attachCardListeners();
    }
    loadStats();
  });
}

function bindEvents() {
  searchBtn?.addEventListener('click', handleSearch);
  searchInput?.addEventListener('keydown', e => e.key === 'Enter' && handleSearch());
  filterBuilding?.addEventListener('change', handleFilter);
  filterStatus?.addEventListener('change', handleFilter);
}

init();
