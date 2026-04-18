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

function animVal(id, txt) {
  const el = document.getElementById(id);
  el.classList.remove('pop');
  void el.offsetWidth;
  el.textContent = txt;
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 200);
}

// Syncs the slider preset to the manual inputs
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

// Triggered when user manually types into the input boxes
function handleInput() {
  let v = parseFloat(document.getElementById('inp-gal').value) || 0;
  
  let match = LEVELS.findIndex(l => Math.abs(l.gal - v) < 0.1);
  if (match !== -1) {
    document.getElementById('sl').value = match;
    cur = match;
  } else {
    cur = -1; // Unlink slider visuals
  }
  calculateBlend();
}

// Core Math Engine
function calculateBlend() {
  let curGal = parseFloat(document.getElementById('inp-gal').value) || 0;
  let curEth = parseFloat(document.getElementById('inp-eth').value) || 0;
  let tgtEth = parseFloat(document.getElementById('inp-tgt').value) || 0;

  // Constrain limits
  if (curGal > TANK) curGal = TANK;
  if (curGal < 0) curGal = 0;
  if (curEth > 100) curEth = 100;
  if (tgtEth > 100) tgtEth = 100;

  const V_empty = TANK - curGal;

  // Algebraic solve for E85 needed
  let e85 = (tgtEth * TANK - curGal * curEth - V_empty * 10) / 75;

  // Constrain physical limits
  if (e85 < 0) e85 = 0;
  if (e85 > V_empty) e85 = V_empty;

  let c93 = V_empty - e85;
  let actualEth = Math.round(((curGal * curEth) + (e85 * 85) + (c93 * 10)) / TANK);

  // Update Live Math Box
  document.getElementById('live-math').textContent = 
    `E85 Needed = [(${tgtEth} × 16.6) - (${curEth} × ${curGal.toFixed(1)}) - (10 × ${V_empty.toFixed(1)})] ÷ 75 = ${e85.toFixed(2)}`;

  // Gauge Needle Label
  const nr = document.getElementById('needle-reading');
  if (curGal <= 0.1) {
    nr.innerHTML = 'E &mdash; <em>Empty</em>';
  } else {
    nr.innerHTML = curGal.toFixed(1) + ' <em>Gal Remaining</em>';
  }

  // Ticks and Slider
  document.querySelectorAll('.tick').forEach((t,i) => t.classList.toggle('on', i === cur));
  document.getElementById('sl').style.setProperty('--sp', (curGal/TANK*100)+'%');

  // Gauge Bars (% of total tank width)
  const exPct = (curGal / TANK) * 100;
  const e85p  = (e85 / TANK) * 100;
  const c93p  = (c93 / TANK) * 100;

  document.getElementById('gex').style.width = exPct + '%';
  document.getElementById('gex').style.right = '0';
  document.getElementById('gex').style.left = 'auto';

  document.getElementById('ge').style.width = e85p + '%';
  document.getElementById('gc').style.left  = e85p + '%';
  document.getElementById('gc').style.width = c93p + '%';

  // Floating Labels
  const le = document.getElementById('lle');
  const lc = document.getElementById('llc');
  le.style.opacity = e85p > 14 ? '1' : '0';
  lc.style.opacity = c93p > 14 ? '1' : '0';
  lc.style.left = (e85p + c93p/2) + '%';
  lc.style.transform = 'translateY(-50%) translateX(-50%)';

  // Result Values
  animVal('ve', e85.toFixed(2));
  animVal('vc', c93.toFixed(2));
  animVal('vx', '~E' + actualEth);

  // Instruction Steps
  document.getElementById('i1').textContent = e85.toFixed(2) + ' gallons';
  document.getElementById('i2').textContent = c93.toFixed(2) + ' gallons';
  document.getElementById('i3').textContent = '~' + actualEth + '%';

  // Status Badge
  const b = document.getElementById('ebadge');
  b.className = 'ebadge';
  if (actualEth >= 40 && actualEth <= 50) {
    b.classList.add('sweet'); b.textContent = '✓ SWEET SPOT — SAFE FOR DAILY DRIVING';
  } else if (actualEth < 40) {
    b.classList.add('low');   b.textContent = '⚠ BELOW TARGET — HIGHER 93 OCTANE BIAS';
  } else {
    b.classList.add('high');  b.textContent = '🚨 ABOVE SAFE STREET LIMIT — HPFP RISK';
  }
}

function setMode(m) {
  document.getElementById('calc-view').style.display  = m==='calc'  ? 'block' : 'none';
  document.getElementById('table-view').style.display = m==='table' ? 'block' : 'none';
  document.getElementById('btn-calc').classList.toggle('active', m==='calc');
  document.getElementById('btn-table').classList.toggle('active', m==='table');
}

function resetDefault() {
  setMode('calc');
  document.getElementById('inp-tgt').value = 45;
  document.getElementById('inp-eth').value = 10;
  setTick(0);
}

// Initialize the app
setTick(0);
