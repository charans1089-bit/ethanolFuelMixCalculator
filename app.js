const TANK = 16.6;
const LEVELS = [
  { gal: 0,    label: 'E' },
  { gal: 2.1,  label: '⅛' },
  { gal: 4.2,  label: '¼' },
  { gal: 6.2,  label: '⅜' },
  { gal: 8.3,  label: '½' },
  { gal: 10.4, label: '⅝' },
  { gal: 12.5, label: '¾' },
  { gal: 14.5, label: '⅞' },
];

let cur = 0;
let currentE85Needed = 0;
let currentC93Needed = 0;
let currentEthResult = 0;
let fuelLogs = [];

// ==========================================
// 🔴 GOOGLE FORM CONFIGURATION 🔴
// ==========================================
const GOOGLE_FORM_ACTION_URL = "https://docs.google.com/forms/d/e/1FAIpQLScfYRQp2e6oH524g83RI2Hf2xDz1DRJLj2mt2uc8xBrLJ8g9g/formResponse";
const FORM_ENTRY_DATE    = "entry.1873002234"; 
const FORM_ENTRY_STATION = "entry.490270945"; 
const FORM_ENTRY_E85     = "entry.391979914"; 
const FORM_ENTRY_93      = "entry.1998665240"; 
const FORM_ENTRY_ETH     = "entry.1111191565"; 
// ==========================================

window.onload = function() {
  if(localStorage.getItem('tgtEth')) document.getElementById('inp-tgt').value = localStorage.getItem('tgtEth');
  if(localStorage.getItem('curEth')) document.getElementById('inp-eth').value = localStorage.getItem('curEth');
  
  const savedLogs = localStorage.getItem('wrxFuelLogs');
  if (savedLogs) fuelLogs = JSON.parse(savedLogs);
  
  setTick(0);
  renderLogs();
};

function animVal(id, txt) {
  const el = document.getElementById(id);
  el.classList.remove('pop');
  void el.offsetWidth;
  el.textContent = txt;
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 200);
}

function setTick(i) {
  cur = i;
  document.getElementById('sl').value = i;
  document.getElementById('inp-gal').value = LEVELS[i].gal.toFixed(1);
  calculateBlend();
}

function onSlide(v) {
  cur = +v;
  document.getElementById('inp-gal').value = LEVELS[cur].gal.toFixed(1);
  calculateBlend();
}

function handleInput() {
  let v = parseFloat(document.getElementById('inp-gal').value) || 0;
  if(v < 0) { v = 0; document.getElementById('inp-gal').value = 0; }
  
  let match = LEVELS.findIndex(l => Math.abs(l.gal - v) < 0.1);
  if (match !== -1) {
    document.getElementById('sl').value = match;
    cur = match;
  } else {
    cur = -1; 
  }
  calculateBlend();
}

function calculateBlend() {
  let curGal = parseFloat(document.getElementById('inp-gal').value) || 0;
  let curEth = parseFloat(document.getElementById('inp-eth').value) || 0;
  let tgtEth = parseFloat(document.getElementById('inp-tgt').value) || 0;

  localStorage.setItem('tgtEth', tgtEth);
  localStorage.setItem('curEth', curEth);

  if (curGal > TANK) curGal = TANK;
  if (curGal < 0) curGal = 0;
  if (curEth > 100) curEth = 100;
  if (tgtEth > 100) tgtEth = 100;

  const V_empty = TANK - curGal;
  let e85 = (tgtEth * TANK - curGal * curEth - V_empty * 10) / 75;

  if (e85 < 0) e85 = 0;
  if (e85 > V_empty) e85 = V_empty;

  let c93 = V_empty - e85;
  let actualEth = Math.round(((curGal * curEth) + (e85 * 85) + (c93 * 10)) / TANK);

  currentE85Needed = e85.toFixed(2);
  currentC93Needed = c93.toFixed(2);
  currentEthResult = actualEth;

  const nr = document.getElementById('needle-reading');
  if (curGal <= 0.1) {
    nr.innerHTML = 'E &mdash; <em>Empty</em>';
  } else {
    nr.innerHTML = curGal.toFixed(1) + ' <em>Gal Remaining</em>';
  }

  document.querySelectorAll('.tick').forEach((t,i) => t.classList.toggle('on', i === cur));
  document.getElementById('sl').style.setProperty('--sp', (curGal/TANK*100)+'%');

  const exPct = (curGal / TANK) * 100;
  const e85p  = (e85 / TANK) * 100;
  const c93p  = (c93 / TANK) * 100;

  document.getElementById('gex').style.width = exPct + '%';
  document.getElementById('ge').style.width = e85p + '%';
  document.getElementById('gc').style.left  = e85p + '%';
  document.getElementById('gc').style.width = c93p + '%';

  const le = document.getElementById('lle');
  const lc = document.getElementById('llc');
  le.style.opacity = e85p > 14 ? '1' : '0';
  lc.style.opacity = c93p > 14 ? '1' : '0';
  lc.style.left = (e85p + c93p/2) + '%';
  lc.style.transform = 'translateY(-50%) translateX(-50%)';

  animVal('ve', currentE85Needed);
  animVal('vc', currentC93Needed);
  animVal('vx', '~E' + actualEth);

  document.getElementById('i1').textContent = currentE85Needed + ' gallons';
  document.getElementById('i2').textContent = currentC93Needed + ' gallons';
  document.getElementById('i3').textContent = '~' + actualEth + '%';

  const b = document.getElementById('ebadge');
  b.className = 'ebadge';
  if (actualEth >= 40 && actualEth <= 50) {
    b.classList.add('sweet'); b.textContent = '✓ SWEET SPOT — SAFE FOR DAILY DRIVING';
  } else if (actualEth > 50) {
    b.classList.add('high');  b.textContent = '🚨 ABOVE SAFE STREET LIMIT — HPFP RISK';
  } else if (actualEth < tgtEth - 2) {
    b.classList.add('low');   b.textContent = '⚠ TANK TOO FULL TO REACH TARGET MIX';
  } else {
    b.classList.add('low');   b.textContent = '⚠ BELOW TARGET — HIGHER 93 OCTANE BIAS';
  }
}

function setMode(m) {
  document.getElementById('calc-view').style.display  = m==='calc'  ? 'block' : 'none';
  document.getElementById('table-view').style.display = m==='table' ? 'block' : 'none';
  document.getElementById('log-view').style.display   = m==='log'   ? 'block' : 'none';
  
  document.getElementById('btn-calc').classList.toggle('active', m==='calc');
  document.getElementById('btn-table').classList.toggle('active', m==='table');
  document.getElementById('btn-log').classList.toggle('active', m==='log');
}

function resetDefault() {
  setMode('calc');
  document.getElementById('inp-tgt').value = 45;
  document.getElementById('inp-eth').value = 10;
  setTick(0);
}

// --- HYBRID LOGGING SYSTEM ---

function saveFillUpLog() {
  const station = document.getElementById('inp-station').value.trim() || 'Unknown Station';
  
  const dateObj = new Date();
  const estTime = dateObj.toLocaleString('en-US', { 
    timeZone: 'America/New_York', 
    year: 'numeric', month: 'short', day: 'numeric', 
    hour: 'numeric', minute: '2-digit' 
  }) + ' EST';

  const newLog = {
    id: Date.now(),
    date: estTime,
    station: station,
    e85: currentE85Needed,
    c93: currentC93Needed,
    eth: currentEthResult
  };

  fuelLogs.unshift(newLog); 
  localStorage.setItem('wrxFuelLogs', JSON.stringify(fuelLogs));
  
  sendToGoogleForm(newLog);

  document.getElementById('inp-station').value = ''; 
  
  const btn = document.querySelector('.save-log-btn');
  btn.textContent = '✓ LOG SAVED';
  btn.style.background = 'var(--e85)';
  setTimeout(() => {
    btn.textContent = '💾 Log Fill-up';
    btn.style.background = 'var(--gold)';
  }, 2000);

  renderLogs();
}

function renderLogs() {
  const tbody = document.getElementById('log-table-body');
  const emptyMsg = document.getElementById('log-empty-msg');
  
  if (fuelLogs.length === 0) {
    tbody.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }
  
  emptyMsg.style.display = 'none';
  tbody.innerHTML = fuelLogs.map(log => `
    <tr>
      <td class="tv">${log.date}</td>
      <td class="tv">${log.station}</td>
      <td class="ev">${log.e85} <span class="u">gal</span></td>
      <td class="cv">${log.c93} <span class="u">gal</span></td>
      <td style="color:var(--gold); font-family:'Share Tech Mono', monospace; font-size:18px;">E${log.eth}</td>
      <td><button class="del-btn" onclick="deleteLog(${log.id})">Del</button></td>
    </tr>
  `).join('');
}

// UPDATED: Explicitly tell the user the cloud backup is safe
function deleteLog(id) {
  if(confirm('Delete this fill-up log from your browser?\n\n(Note: Your Google Sheets backup will NOT be deleted)')) {
    fuelLogs = fuelLogs.filter(l => l.id !== id);
    localStorage.setItem('wrxFuelLogs', JSON.stringify(fuelLogs));
    renderLogs();
  }
}

// UPDATED: Explicitly tell the user the cloud backup is safe
function deleteAllLogs() {
  if(fuelLogs.length === 0) return;
  if(confirm('⚠️ Clear all log history on this device?\n\nYour data saved in Google Sheets is safe and will NOT be deleted. Proceed?')) {
    fuelLogs = [];
    localStorage.removeItem('wrxFuelLogs');
    renderLogs();
  }
}

function downloadCSV() {
  if (fuelLogs.length === 0) { alert("No logs to download yet."); return; }

  const headers = ["Date (EST)", "Station", "E85 Gallons", "93 Gallons", "Resulting Eth %"];
  const rows = fuelLogs.map(log => `"${log.date}","${log.station}",${log.e85},${log.c93},${log.eth}`);
  
  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `WRX_Fuel_Log_${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function sendToGoogleForm(logData) {
  if (GOOGLE_FORM_ACTION_URL.includes("YOUR_FORM_ID_HERE")) return;

  const formData = new FormData();
  formData.append(FORM_ENTRY_DATE, logData.date);
  formData.append(FORM_ENTRY_STATION, logData.station);
  formData.append(FORM_ENTRY_E85, logData.e85);
  formData.append(FORM_ENTRY_93, logData.c93);
  formData.append(FORM_ENTRY_ETH, logData.eth);

  fetch(GOOGLE_FORM_ACTION_URL, {
    method: "POST",
    mode: "no-cors",
    body: formData
  }).catch(error => console.error("Cloud Sync Failed:", error));
}
