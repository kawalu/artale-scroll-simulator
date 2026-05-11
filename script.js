const sfxSuccess = new Audio('sounds/ScrollSuccess.ogg');
const sfxFailed  = new Audio('sounds/ScrollFailed.ogg');
const sfxHover   = new Audio('sounds/ButtonHover.ogg');
const sfxClick   = new Audio('sounds/ButtonClick.ogg');

const allSfx = [sfxSuccess, sfxFailed, sfxHover, sfxClick];

function playSfx(audio) {
  audio.currentTime = 0;
  const played = audio.play();
  if (played) played.catch(() => {});
}

function playHover() { playSfx(sfxHover); }
function playClick() { playSfx(sfxClick); }

// 進階設定
const STORAGE_KEY = 'scroll-simulator-state-v1';
let cooldownMs = 600;
let volumePercent = 100;
let lastRollTime = 0;

function updateCooldown(val, shouldSave = true) {
  cooldownMs = Number(val);
  document.getElementById('cooldown-val').textContent = val + ' ms';
  updateSliderFill('cooldown-slider', val, 0, 600);
  if (shouldSave) saveState();
}

function updateVolume(val, shouldSave = true) {
  volumePercent = Number(val);
  const v = val / 100;
  allSfx.forEach(a => a.volume = v);
  document.getElementById('volume-val').textContent = val + '%';
  updateSliderFill('volume-slider', val, 0, 100);
  if (shouldSave) saveState();
}

function updateSliderFill(id, val, min, max) {
  const pct = ((val - min) / (max - min)) * 100;
  const el = document.getElementById(id);
  el.style.background = `linear-gradient(to right, #3b82f6 ${pct}%, #0a1628 ${pct}%)`;
}

const ALL_RATES = [1, 5, 10, 15, 20, 30, 60, 65, 70];

const RATE_COLOR = {
  1: 'rate-color-1', 5: 'rate-color-5', 10: 'rate-color-10',
  15: 'rate-color-15', 20: 'rate-color-20', 30: 'rate-color-30',
  60: 'rate-color-60', 65: 'rate-color-65', 70: 'rate-color-70'
};

const WARN = {
  1:  '⚠ 失敗時有 2% 機率摧毀裝備！',
  5:  '⚠ 失敗時有 10% 機率摧毀裝備！',
  10: '　',
  15: '　',
  20: '⚠ 失敗時裝備必定被摧毀！',
  30: '⚠ 失敗時有 50% 機率摧毀裝備！',
  60: '　',
  65: '　',
  70: '⚠ 失敗時有 50% 機率摧毀裝備！',
};

// 失敗摧毀機率（0 = 安全，1 = 必定）
const DESTROY_CHANCE = { 1: 0.02, 5: 0.10, 20: 1.0, 30: 0.5, 70: 0.5 };

let selected = 10;

const stats = {
  1:  { s: 0, f: 0, d: 0 },
  5:  { s: 0, f: 0, d: 0 },
  10: { s: 0, f: 0 },
  15: { s: 0, f: 0 },
  20: { s: 0, f: 0, d: 0 },
  30: { s: 0, f: 0, d: 0 },
  60: { s: 0, f: 0 },
  65: { s: 0, f: 0 },
  70: { s: 0, f: 0, d: 0 },
};

const streaks = Object.fromEntries(ALL_RATES.map(r => [r, { s: 0, f: 0 }]));
const totals  = Object.fromEntries(ALL_RATES.map(r => [r, { s: 0, f: 0 }]));

function updateDisplay(rate) {
  const display = document.getElementById('rate-display');
  const disabled = rate === null;
  document.getElementById('go-btn').disabled = disabled;
  document.getElementById('sticky-go-btn').disabled = disabled;
  if (rate === null) {
    display.textContent = '—';
    display.className = '';
    document.getElementById('warn-text').textContent = '　';
  } else {
    display.textContent = rate + '%';
    display.className = RATE_COLOR[rate];
    document.getElementById('warn-text').textContent = WARN[rate];
  }
}

// 點卷軸圖示：勾選並設為使用目標（不取消其他已勾選）
// 點卷軸圖示：設為使用目標（不影響 checkbox）
function selectScroll(rate) {
  if (selected !== null && selected !== rate) {
    document.getElementById(`item-${selected}`).classList.remove('selected');
    document.getElementById(`sticky-item-${selected}`).classList.remove('selected');
  }
  selected = rate;
  document.getElementById(`chk-${rate}`).checked = true;
  document.getElementById(`item-${rate}`).classList.add('selected');
  document.getElementById(`sticky-item-${rate}`).classList.add('selected');
  document.getElementById(`card-${rate}`).classList.add('active');
  updateDisplay(rate);
  saveState();
}

// checkbox 變動：只控制卡片顯示；選中的卷軸卡片不可隱藏
function onCheckboxChange(rate, el) {
  if (el.checked) {
    document.getElementById(`card-${rate}`).classList.add('active');
  } else {
    if (selected === rate) {
      el.checked = true; // 不允許隱藏目前使用中卷軸的卡片
    } else {
      document.getElementById(`card-${rate}`).classList.remove('active');
    }
  }
  saveState();
}

function startCooldown() {
  if (cooldownMs === 0) return;
  const btn = document.getElementById('go-btn');
  const stickyBtn = document.getElementById('sticky-go-btn');
  btn.disabled = true;
  stickyBtn.disabled = true;

  for (const barId of ['cooldown-bar', 'sticky-cooldown-bar']) {
    const bar = document.getElementById(barId);
    bar.style.transition = 'none';
    bar.style.width = '100%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.transition = `width ${cooldownMs}ms linear`;
        bar.style.width = '0%';
      });
    });
  }

  setTimeout(() => {
    btn.disabled = false;
    stickyBtn.disabled = false;
    document.getElementById('cooldown-bar').style.width = '0%';
    document.getElementById('sticky-cooldown-bar').style.width = '0%';
  }, cooldownMs);
}

function roll() {
  const now = Date.now();
  if (now - lastRollTime < cooldownMs) return;
  lastRollTime = now;
  startCooldown();

  const rate = selected;
  const success = Math.random() * 100 < rate;

  if (success) {
    stats[rate].s++;
    streaks[rate].s++; streaks[rate].f = 0;
    totals[rate].s++;
    playSfx(sfxSuccess);
    toast('✅ 卷軸閃爍了一下，神秘的力量傳到了道具身上。', 'success');
  } else {
    stats[rate].f++;
    streaks[rate].f++; streaks[rate].s = 0;
    totals[rate].f++;
    const dc = DESTROY_CHANCE[rate] ?? 0;
    if (dc > 0 && Math.random() < dc) {
      stats[rate].d++;
      playSfx(sfxFailed);
      toast('❌ 受到卷軸的力量，道具已被摧毀。', 'destroy');
    } else {
      playSfx(sfxFailed);
      toast('❌ 卷軸閃爍了一下，但道具沒有任何變化。', 'fail');
    }
  }

  render();
}

function render() {
  for (const r of ALL_RATES) {
    const { s, f } = stats[r];
    const total = s + f;
    document.getElementById(`s${r}`).textContent = s;
    const fEl = document.getElementById(`f${r}`);
    if (fEl) fEl.textContent = f;
    document.getElementById(`r${r}`).textContent = total > 0 ? (s / total * 100).toFixed(1) + '%' : '—';
    document.getElementById(`streak-s${r}`).textContent = streaks[r].s;
    document.getElementById(`streak-f${r}`).textContent = streaks[r].f;
    document.getElementById(`total-s${r}`).textContent = totals[r].s;
    document.getElementById(`total-f${r}`).textContent = totals[r].f;
    if (stats[r].d !== undefined) document.getElementById(`d${r}`).textContent = stats[r].d;
  }

  const gs = ALL_RATES.reduce((a, r) => a + totals[r].s, 0);
  const gf = ALL_RATES.reduce((a, r) => a + totals[r].f, 0);
  const gt = gs + gf;
  document.getElementById('grand-s').textContent = gs;
  document.getElementById('grand-f').textContent = gf;
  document.getElementById('grand-t').textContent = gt;
  document.getElementById('grand-r').textContent = gt > 0 ? (gs / gt * 100).toFixed(1) + '%' : '—';
  saveState();
}

function resetScroll(rate) {
  stats[rate].s = 0; stats[rate].f = 0;
  if (stats[rate].d !== undefined) stats[rate].d = 0;
  streaks[rate].s = 0; streaks[rate].f = 0;
  totals[rate].s = 0; totals[rate].f = 0;
  render();
  toast(`🔄 ${rate}% 卷軸紀錄已重置`, 'fail');
}

function uncheckAll() {
  for (const rate of ALL_RATES) {
    if (rate === selected) continue;
    document.getElementById(`chk-${rate}`).checked = false;
    document.getElementById(`card-${rate}`).classList.remove('active');
  }
  saveState();
}

function resetAll() {
  for (const rate of ALL_RATES) {
    stats[rate].s = 0;
    stats[rate].f = 0;
    if (stats[rate].d !== undefined) stats[rate].d = 0;
    streaks[rate].s = 0;
    streaks[rate].f = 0;
    totals[rate].s = 0;
    totals[rate].f = 0;
  }
  render();
  toast('🔄 全部紀錄已重置', 'fail');
}

let toastTimer;
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = `toast ${type}`, 1500);
}

function toggleAdvPanel() {
  const panel = document.getElementById('adv-panel');
  const isOpen = panel.classList.toggle('open');
  document.getElementById('adv-toggle-icon').textContent = isOpen ? '▶' : '◀';
}

function getVisibleRates() {
  return ALL_RATES.filter(rate => document.getElementById(`chk-${rate}`).checked);
}

function saveState() {
  const payload = {
    selected,
    cooldownMs,
    volumePercent,
    visibleRates: getVisibleRates(),
    stats,
    streaks,
    totals,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function mergeRateData(target, source) {
  if (!source) return;
  for (const rate of ALL_RATES) {
    if (source[rate]) Object.assign(target[rate], source[rate]);
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    mergeRateData(stats, saved.stats);
    mergeRateData(streaks, saved.streaks);
    mergeRateData(totals, saved.totals);

    selected = ALL_RATES.includes(saved.selected) ? saved.selected : 10;
    const visibleRates = Array.isArray(saved.visibleRates) && saved.visibleRates.length
      ? saved.visibleRates.filter(rate => ALL_RATES.includes(rate))
      : [selected];

    for (const rate of ALL_RATES) {
      const visible = visibleRates.includes(rate) || rate === selected;
      document.getElementById(`chk-${rate}`).checked = visible;
      document.getElementById(`card-${rate}`).classList.toggle('active', visible);
      document.getElementById(`item-${rate}`).classList.toggle('selected', rate === selected);
    }

    updateDisplay(selected);
    updateCooldown(saved.cooldownMs ?? 600, false);
    updateVolume(saved.volumePercent ?? 100, false);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

loadState();
updateDisplay(selected);
updateCooldown(cooldownMs, false);
updateVolume(volumePercent, false);
render();

// 固定卷軸欄：主面板離開視野時顯示
const stickyBar = document.getElementById('sticky-scroll-bar');
new IntersectionObserver(entries => {
  stickyBar.classList.toggle('visible', !entries[0].isIntersecting);
}, { threshold: 0 }).observe(document.querySelector('.scroll-list'));
