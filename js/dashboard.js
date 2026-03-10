// ============================================================
//  js/dashboard.js  —  Powers index.html (main dashboard)
// ============================================================
import { getAllRooms, getRoomStats, searchRooms,
         filterRooms, subscribeToRoomChanges } from './rooms.js';
import { getUser, getUserRole, logout }         from './auth.js';

// ── DOM refs ─────────────────────────────────────────────────
const grid          = document.getElementById('room-grid');
const statsTotal    = document.getElementById('stat-total');
const statsVacant   = document.getElementById('stat-vacant');
const statsOccupied = document.getElementById('stat-occupied');
const statsFreeSoon = document.getElementById('stat-free-soon');
const searchInput   = document.getElementById('search-input');
const searchBtn     = document.getElementById('search-btn');
const filterBuilding   = document.getElementById('filter-building');
const filterDept       = document.getElementById('filter-dept');
const filterStatus     = document.getElementById('filter-status');
const authBtn          = document.getElementById('auth-btn');
const userGreeting     = document.getElementById('user-greeting');

// ── Bootstrap ────────────────────────────────────────────────
async function init() {
  await loadUser();
  await loadStats();
  await loadRooms();
  bindEvents();
  listenRealtime();
}

// ── Auth display ─────────────────────────────────────────────
async function loadUser() {
  const user = await getUser();
  if (user) {
    const role = await getUserRole();
    userGreeting.textContent = `${user.email} (${role})`;
    authBtn.textContent = 'Logout';
    authBtn.onclick = logout;
  } else {
    userGreeting.textContent = 'Guest';
    authBtn.textContent = 'Login';
    authBtn.href = '/pages/login.html';
  }
}

// ── Stats cards ──────────────────────────────────────────────
async function loadStats() {
  const stats = await getRoomStats();
  animateCount(statsTotal,    stats.total);
  animateCount(statsVacant,   stats.vacant);
  animateCount(statsOccupied, stats.occupied);
  animateCount(statsFreeSoon, stats.freeSoon);
}

function animateCount(el, target) {
  if (!el) return;
  let count = 0;
  const step = Math.ceil(target / 30);
  const timer = setInterval(() => {
    count = Math.min(count + step, target);
    el.textContent = count;
    if (count >= target) clearInterval(timer);
  }, 30);
}

// ── Room grid ─────────────────────────────────────────────────
async function loadRooms(rooms = null) {
  grid.innerHTML = '<div class="col-span-full flex justify-center py-12"><div class="loader"></div></div>';
  try {
    const data = rooms ?? await getAllRooms();
    if (data.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-16 text-slate-400">
          <span class="material-symbols-outlined text-5xl block mb-3">search_off</span>
          <p class="text-lg font-medium">No classrooms found</p>
        </div>`;
      return;
    }
    grid.innerHTML = data.map(buildRoomCard).join('');
    attachCardListeners();
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full text-red-500 text-center py-8">Error loading rooms: ${err.message}</div>`;
  }
}

// ── Room card HTML ────────────────────────────────────────────
function buildRoomCard(room) {
  const isVacant   = room.status === 'vacant';
  const isFreeSoon = room.status === 'free_soon';
  const isOccupied = room.status === 'occupied';

  const statusColor = isVacant   ? 'green'
                    : isFreeSoon ? 'amber'
                    :              'red';

  const statusLabel = isVacant   ? 'Vacant'
                    : isFreeSoon ? 'Free Soon'
                    :              'Occupied';

  const statusBg    = `bg-${statusColor}-100 text-${statusColor}-700`;
  const barColor    = `bg-${statusColor}-500`;

  const sessionBlock = isOccupied || isFreeSoon
    ? `<div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-6">
         <p class="text-xs text-slate-500 uppercase font-bold mb-1">Ongoing Session</p>
         <p class="font-bold text-primary">${room.current_subject ?? '—'}</p>
         <p class="text-xs text-slate-600 dark:text-slate-400">
           ${room.current_faculty ?? ''} • ${fmtTime(room.session_start)} – ${fmtTime(room.session_end)}
         </p>
       </div>`
    : `<div class="space-y-3 mb-6">
         <div class="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
           <span class="material-symbols-outlined text-lg">groups</span>
           <span>Capacity: ${room.capacity ?? '—'} Students</span>
         </div>
         <div class="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
           <span class="material-symbols-outlined text-lg">laptop_mac</span>
           <span>${room.facilities ?? 'Standard Room'}</span>
         </div>
       </div>`;

  const footer = isVacant
    ? `<span class="text-xs font-medium text-slate-400">Next: ${room.next_class_time ?? 'No class today'}</span>
       <button class="text-primary text-sm font-semibold hover:underline view-schedule-btn" data-id="${room.id}">View Schedule</button>`
    : `<span class="text-xs font-medium text-slate-400">${room.ends_in ?? ''}</span>
       <button class="text-primary text-sm font-semibold hover:underline view-details-btn" data-id="${room.id}">Full Details</button>`;

  return `
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl transition-shadow room-card" data-id="${room.id}" data-status="${room.status}">
      <div class="h-2 ${barColor}"></div>
      <div class="p-6">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h4 class="text-2xl font-bold text-slate-900 dark:text-white">${room.room_number}</h4>
            <p class="text-sm text-slate-500">${room.building} • ${room.floor}</p>
          </div>
          <span class="${statusBg} text-xs font-bold px-2 py-1 rounded-lg uppercase">${statusLabel}</span>
        </div>
        ${sessionBlock}
        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          ${footer}
        </div>
      </div>
    </div>`;
}

function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

// ── Card click listeners ──────────────────────────────────────
function attachCardListeners() {
  document.querySelectorAll('.view-schedule-btn, .view-details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      window.location.href = `/pages/room-detail.html?id=${id}`;
    });
  });
}

// ── Search ────────────────────────────────────────────────────
async function handleSearch() {
  const q = searchInput.value.trim();
  if (!q) { await loadRooms(); return; }
  const results = await searchRooms(q);
  await loadRooms(results);
}

// ── Filters ───────────────────────────────────────────────────
async function handleFilter() {
  const results = await filterRooms({
    building:   filterBuilding?.value,
    department: filterDept?.value,
    status:     filterStatus?.value,
  });
  await loadRooms(results);
}

// ── Real-time listener ────────────────────────────────────────
function listenRealtime() {
  subscribeToRoomChanges((updatedRoom) => {
    // Update just the affected card without full re-render
    const card = document.querySelector(`.room-card[data-id="${updatedRoom.id}"]`);
    if (card) {
      const newCardHtml = buildRoomCard(updatedRoom);
      card.outerHTML = newCardHtml;
      attachCardListeners();
    }
    loadStats(); // refresh counts
  });
}

// ── Bind all events ───────────────────────────────────────────
function bindEvents() {
  searchBtn?.addEventListener('click', handleSearch);
  searchInput?.addEventListener('keydown', e => e.key === 'Enter' && handleSearch());
  filterBuilding?.addEventListener('change', handleFilter);
  filterDept?.addEventListener('change', handleFilter);
  filterStatus?.addEventListener('change', handleFilter);
}

// ── Start ─────────────────────────────────────────────────────
init();
