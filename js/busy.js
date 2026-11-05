// Umumiy "Yuklanmoqda" qatlami: mashina sotib olish / almashtirish / ko'rish paytida ko'rinadi
const $ = (id) => document.getElementById(id);
let depth = 0;

export function showBusy(title = 'Yuklanmoqda...', sub = '') {
  depth++;
  $('busyTitle').textContent = title;
  $('busySub').textContent = sub;
  setBusyProgress(-1);
  $('busy').classList.add('show');
}

// p: 0..1 yoki -1 (noma'lum — aylanuvchi chiziq)
export function setBusyProgress(p) {
  const bar = $('busyBar');
  if (p < 0) { bar.classList.add('indet'); bar.style.width = ''; $('busyPct').textContent = ''; return; }
  bar.classList.remove('indet');
  bar.style.width = Math.round(p * 100) + '%';
  $('busyPct').textContent = Math.round(p * 100) + '%';
}

export function hideBusy() {
  depth = Math.max(0, depth - 1);
  if (depth === 0) $('busy').classList.remove('show');
}

// Mashina tayyor bo'lguncha overlay ko'rsatadi
export async function withBusy(title, sub, promiseFactory) {
  showBusy(title, sub);
  try { return await promiseFactory(setBusyProgress); } finally { hideBusy(); }
}

