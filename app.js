const TANK = 16.6;
const LEVELS = [
 { gal: 0, label: 'E' },
 { gal: 2.1, label: '⅛' },
 { gal: 4.2, label: '¼' },
 { gal: 6.2, label: '⅜' },
 { gal: 8.3, label: '½' },
 { gal: 10.4, label: '⅝' },
 { gal: 12.5, label: '¾' },
 { gal: 14.5, label: '⅞' },
];

let fuelLogs = [];
let currentE85Needed = 0;
let currentC93Needed = 0;
let currentEthResult = 0;

// Google Form Backup
const GOOGLE_FORM_ACTION_URL = "https://docs.google.com/forms/d/e/1FAIpQLScfYRQp2e6oH524g83RI2Hf2xDz1DRJLj2mt2uc8xBrLJ8g9g/formResponse";
const FORM_ENTRY_DATE    = "entry.1873002234"; 
const FORM_ENTRY_STATION = "entry.490270945"; 
const FORM_ENTRY_E85     = "entry.391979914"; 
const FORM_ENTRY_93      = "entry.1998665240"; 
const FORM_ENTRY_ETH     = "entry.1111191565"; 

window.onload = function() {
 if(localStorage.getItem('tgtEth')) document.getElementById('inp-tgt').value = localStorage.getItem('tgtEth');
 if(localStorage.getItem('curEth')) document.getElementById('inp-eth').value = localStorage.getItem('curEth');
 const savedLogs = localStorage.getItem('wrxFuelLogs');
 if (savedLogs) fuelLogs = JSON.parse(savedLogs);
 setTick(0);
 renderLogs();
 generateStaticTable();
};

function setTick(i) {
 document.getElementById('sl').value = i;
 document.getElementById('inp-gal').value = LEVELS[i].gal.toFixed(1);
 calculateBlend();
}

function onSlide(v) {
 document.getElementById('inp-gal').value = LEVELS[v].gal.toFixed(1);
 calculateBlend();
}

function handleInput() {
 let v = parseFloat(document.getElementById('inp-gal').value) || 0;
 let match = LEVELS.findIndex(l => Math.abs(l.gal - v) < 0.1);
 if (match !== -1) document.getElementById('sl').value = match;
 calculateBlend();
}

function calculateBlend() {
 let curGal = parseFloat(document.getElementById('inp-gal').value) || 0;
 let curEth = parseFloat(document.getElementById('inp-eth').value) || 0;
 let tgtEth = parseFloat(document.getElementById('inp-tgt').value) || 0;

 localStorage.setItem('tgtEth', tgtEth);
 localStorage.setItem('curEth', curEth);

 const V_empty = Math.max(0, TANK - curGal);
 let e85 = (tgtEth * TANK - curGal * curEth - V_empty * 10) / 75;
 e85 = Math.max(0, Math.min(e85, V_empty));
 let c93 = Math.max(0, V_empty - e85);
 let actualEth = Math.round(((curGal * curEth) + (e85 * 85) + (c93 * 10)) / TANK);

 currentE85Needed = e85.toFixed(2);
 currentC93Needed = c93.toFixed(2);
 currentEthResult = actualEth;

 document.getElementById('needle-reading').innerHTML = curGal <= 0.1 ? 'E &mdash; <em>Empty</em>' : curGal.toFixed(1) + ' <em>Gal Left</em>';
 
 // Gauge Bar UI & Slider Track Fill
 const e85p = (e85 / TANK) * 100;
 const c93p = (c93 / TANK) * 100;
 const curp = (curGal / TANK) * 100;

 document.getElementById('gex').style.width = curp + '%';
 document.getElementById('ge').style.width = e85p + '%';
 document.getElementById('gc').style.left = e85p + '%';
 document.getElementById('gc').style.width = c93p + '%';
 
 // Animate the value pop
 const els = ['ve','vc','vx'];
 els.forEach(id => {
   const el = document.getElementById(id);
   el.classList.remove('pop');
   void el.offsetWidth; 
   el.classList.add('pop');
 });

 document.getElementById('ve').textContent = currentE85Needed;
 document.getElementById('vc').textContent = currentC93Needed;
 document.getElementById('vx').textContent = '~E' + actualEth;
 
 document.getElementById('i1').textContent = currentE85Needed + ' gal';
 document.getElementById('i2').textContent = currentC93Needed + ' gal';
 document.getElementById('i3').textContent = '~' + actualEth + '%';

 const b = document.getElementById('ebadge');
 b.className = 'ebadge ' + (actualEth < tgtEth - 2 ? 'low' : 'sweet');
 b.textContent = actualEth < tgtEth - 2 ? '⚠ TANK TOO FULL TO REACH TARGET' : '✓ SCRK TUNED — SAFE BLEND';

 // Update Tick styling
 let matchIndex = LEVELS.findIndex(l => Math.abs(l.gal - curGal) < 0.1);
 document.querySelectorAll('.tick').forEach((t, i) => {
   t.classList.toggle('on', i === matchIndex);
 });
}

// LOGGING
function saveFillUpLog() {
 const station = document.getElementById('inp-station').value.trim() || 'Unknown';
 const estTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: true });
 const newLog = { id: Date.now(), date: estTime, station, e85: currentE85Needed, c93: currentC93Needed, eth: currentEthResult };
 fuelLogs.unshift(newLog);
 localStorage.setItem('wrxFuelLogs', JSON.stringify(fuelLogs));
 sendToGoogleForm(newLog);
 
 const btn = document.querySelector('.save-log-btn');
 btn.innerHTML = '✓ SAVED';
 setTimeout(() => { btn.innerHTML = '<span class="btn-icon">💾</span> SAVE TELEMETRY'; }, 2000);
 document.getElementById('inp-station').value = '';
 renderLogs();
}

function renderLogs() {
 const tbody = document.getElementById('log-table-body');
 document.getElementById('log-empty-msg').style.display = fuelLogs.length ? 'none' : 'block';
 tbody.innerHTML = fuelLogs.map(log => `<tr><td>${log.date}</td><td>${log.station}</td><td style="color:var(--e85);font-weight:bold;">${log.e85}</td><td style="color:var(--c93);font-weight:bold;">${log.c93}</td><td style="color:var(--gold);font-family:'Orbitron',sans-serif;font-size:20px;">E${log.eth}</td><td><button class="del-btn" onclick="deleteLog(${log.id})">✕</button></td></tr>`).join('');
}

function deleteLog(id) { if(confirm('Delete locally?')) { fuelLogs = fuelLogs.filter(l => l.id !== id); localStorage.setItem('wrxFuelLogs', JSON.stringify(fuelLogs)); renderLogs(); } }
function deleteAllLogs() { if(confirm('Clear all local logs?')) { fuelLogs = []; localStorage.removeItem('wrxFuelLogs'); renderLogs(); } }

function sendToGoogleForm(log) {
 const fd = new FormData();
 fd.append(FORM_ENTRY_DATE, log.date); fd.append(FORM_ENTRY_STATION, log.station);
 fd.append(FORM_ENTRY_E85, log.e85); fd.append(FORM_ENTRY_93, log.c93); fd.append(FORM_ENTRY_ETH, log.eth);
 fetch(GOOGLE_FORM_ACTION_URL, { method: "POST", mode: "no-cors", body: fd });
}

function downloadCSV() {
 if (fuelLogs.length === 0) { alert("No logs to download."); return; }
 const headers = ["Date (EST)", "Station", "E85 Gallons", "93 Gallons", "Resulting Eth %"];
 const rows = fuelLogs.map(log => `"${log.date}","${log.station}",${log.e85},${log.c93},${log.eth}`);
 const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: 'text/csv;charset=utf-8;' });
 const link = document.createElement("a");
 link.href = URL.createObjectURL(blob);
 link.download = `SCRK_Telemetry_${Date.now()}.csv`;
 document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ==================== SIMULATOR LOGIC ====================
function openSim() { document.getElementById('sim-modal').classList.add('show'); runSim(); }
function closeSim(e) { if(!e || e.target.classList.contains('modal-overlay')) document.getElementById('sim-modal').classList.remove('show'); }

function runSim() {
 const curGal = parseFloat(document.getElementById('sim-sl-cur').value);
 const tgtEth = parseFloat(document.getElementById('sim-sl-tgt').value);
 const emptySpace = TANK - curGal;

 let idealE85 = ((tgtEth * TANK) - (10 * curGal) - (10 * emptySpace)) / 75;
 let actualE85 = Math.max(0, Math.min(idealE85, emptySpace));
 let actual93 = Math.max(0, emptySpace - actualE85);
 let finalEth = Math.round(((curGal * 10) + (actualE85 * 85) + (actual93 * 10)) / TANK);

 document.getElementById('sim-val-cur').innerHTML = curGal.toFixed(1) + '<span style="font-size:16px;"> GAL</span>';
 document.getElementById('sim-val-tgt').textContent = 'E' + tgtEth;
 document.getElementById('sim-stat-empty').textContent = emptySpace.toFixed(1) + ' GAL';
 document.getElementById('sim-stat-ideal').textContent = idealE85.toFixed(1) + ' GAL';
 document.getElementById('sim-stat-max').textContent = 'E' + finalEth;

 const curP = (curGal / TANK) * 100;
 const e85P = (actualE85 / TANK) * 100;
 const c93P = (actual93 / TANK) * 100;

 const sfhCur = document.getElementById('sfh-cur');
 const sfhE85 = document.getElementById('sfh-e85');
 const sfh93  = document.getElementById('sfh-93');

 sfhCur.style.width = curP + '%'; sfhCur.style.left = '0%';
 sfhE85.style.width = e85P + '%'; sfhE85.style.left = curP + '%';
 sfh93.style.width = c93P + '%'; sfh93.style.left = (curP + e85P) + '%';

 document.getElementById('pct-cur').textContent = 'In: ' + curGal.toFixed(1);
 document.getElementById('pct-e85').textContent = 'E85: ' + actualE85.toFixed(1);
 document.getElementById('pct-93').textContent  = '93: ' + actual93.toFixed(1);

 const alert = document.getElementById('sim-alert');
 if (idealE85 > emptySpace) {
    alert.className = 'sim-alert trap';
    alert.innerHTML = `<strong>⚠ TRAP ACTIVATED:</strong> Need ${idealE85.toFixed(1)}g E85 but only have ${emptySpace.toFixed(1)}g of space. Max achievable is E${finalEth}.`;
 } else {
    alert.className = 'sim-alert ok';
    alert.innerHTML = `<strong>✓ TARGET CLEAR:</strong> Room to fit ${actualE85.toFixed(1)}g of E85 safely.`;
 }
}

function setMode(m) {
 document.getElementById('calc-view').style.display = m==='calc' ? 'block' : 'none';
 document.getElementById('table-view').style.display = m==='table' ? 'block' : 'none';
 document.getElementById('log-view').style.display = m==='log' ? 'block' : 'none';
 document.getElementById('btn-calc').className = m==='calc' ? 'mode-btn active' : 'mode-btn';
 document.getElementById('btn-table').className = m==='table' ? 'mode-btn active' : 'mode-btn';
 document.getElementById('btn-log').className = m==='log' ? 'mode-btn active' : 'mode-btn';
}

function resetDefault() { location.reload(); }

function generateStaticTable() {
  // Automatically populates the static chart so we don't need hardcoded HTML rows.
  const tbody = document.getElementById('static-chart-body');
  if(!tbody) return;
  tbody.innerHTML = LEVELS.map((l, i) => {
    let empty = TANK - l.gal;
    let e85 = ((45 * TANK) - (10 * l.gal) - (10 * empty)) / 75;
    e85 = Math.max(0, Math.min(e85, empty));
    let c93 = empty - e85;
    let w = (l.gal / TANK) * 100;
    return `<tr ${i===0?'class="lf"':''}>
      <td><div class="gcell"><div><div class="glv">${l.label} Tank</div><div class="gsub">~${l.gal.toFixed(1)} gal remaining<div class="fbw"><div class="fb" style="width:${w}%"></div></div></div></div></div></td>
      <td><span class="tv">${empty.toFixed(1)} gal</span></td>
      <td><span class="ev">${e85.toFixed(2)}<span class="u">gal</span></span></td>
      <td><span class="cv">${c93.toFixed(2)}<span class="u">gal</span></span></td>
    </tr>`;
  }).join('');
}
