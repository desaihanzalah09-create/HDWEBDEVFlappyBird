// --- AUDIO SYNTHESIZER (Web Audio API) ---
class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playJump() {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playScore() {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.08); // E5

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playHit() {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
}

// --- GAME LOGIC & ENGINE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const sound = new SoundController();

const TARGET_FPS = 60;
const FRAME_DURATION = 1000 / TARGET_FPS;
const MAX_DELTA_MS = 100;
const PIPE_SPAWN_INTERVAL_MS = 1500;
let lastFrameTime = 0;
let pipeSpawnTimer = 0;

// DOM Overlays
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const homeBtn = document.getElementById('homeBtn');
const quickRetryBtn = document.getElementById('quickRetryBtn');
const audioToggleBtn = document.getElementById('audioToggleBtn');
const birdChoicesEl = document.getElementById('birdChoices');
const mapChoicesEl = document.getElementById('mapChoices');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const hudBestScoreEl = document.getElementById('hudBestScore');
const hudCoinCountEl = document.getElementById('hudCoinCount');
const powerupTrayEl = document.getElementById('powerupTray');
const medalSlotEl = document.getElementById('medalSlot');

// Game State Constants
const STATE = { MENU: 0, PLAYING: 1, GAMEOVER: 2 };
let currentState = STATE.MENU;

let score = 0;
let highScore = parseInt(localStorage.getItem('flappy_best_score')) || 0;
let coinCount = parseInt(localStorage.getItem('flappy_coin_count')) || 0;
let frameCount = 0;
let screenShakeTimer = 0;
let flashAlpha = 0;
let worldSpeed = 2.5;
let pipeGap = 150;
let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;
let shieldBreakGraceTimer = 0;
let powerupHudSignature = '';

hudBestScoreEl.textContent = highScore;
hudCoinCountEl.textContent = coinCount;

const POWERUP_DURATION_MS = 5000;
const MINI_SCALE = 0.6;
const SLOW_MO_SPEED_SCALE = 0.5;
const activePowerups = {
  shield: 0,
  slowMo: 0,
  mini: 0
};

const COLLECTIBLE_TYPES = {
  coin: {
    icon: '🪙',
    color: '#facc15',
    glow: '#f59e0b',
    radius: 13,
    weight: 0.58
  },
  shield: {
    icon: '🛡️',
    color: '#67e8f9',
    glow: '#22d3ee',
    radius: 14,
    weight: 0.14
  },
  slowMo: {
    icon: '⏱️',
    color: '#c4b5fd',
    glow: '#8b5cf6',
    radius: 14,
    weight: 0.14
  },
  mini: {
    icon: '🍄',
    color: '#86efac',
    glow: '#22c55e',
    radius: 14,
    weight: 0.14
  }
};

const BIRD_SKINS = [
  {
    id: 'sky',
    name: 'Sky',
    colors: ['#38bdf8', '#22d3ee', '#f59e0b'],
    wing: '#bae6fd',
    beak: '#f59e0b',
    glow: '#38bdf8',
    trail: '#38bdf8'
  },
  {
    id: 'red',
    name: 'Red',
    colors: ['#fb7185', '#ef4444', '#f97316'],
    wing: '#fecdd3',
    beak: '#fbbf24',
    glow: '#fb7185',
    trail: '#fb7185'
  },
  {
    id: 'lime',
    name: 'Lime',
    colors: ['#bef264', '#22c55e', '#14b8a6'],
    wing: '#dcfce7',
    beak: '#fde047',
    glow: '#84cc16',
    trail: '#a3e635'
  },
  {
    id: 'violet',
    name: 'Nova',
    colors: ['#c4b5fd', '#8b5cf6', '#06b6d4'],
    wing: '#ddd6fe',
    beak: '#f472b6',
    glow: '#a78bfa',
    trail: '#c084fc'
  },
  {
    id: 'gold',
    name: 'Gold',
    colors: ['#fde68a', '#f59e0b', '#f97316'],
    wing: '#fef3c7',
    beak: '#fb923c',
    glow: '#fbbf24',
    trail: '#facc15'
  },
  {
    id: 'midnight',
    name: 'Shadow',
    colors: ['#94a3b8', '#334155', '#020617'],
    wing: '#cbd5e1',
    beak: '#38bdf8',
    glow: '#64748b',
    trail: '#94a3b8'
  },
  {
    id: 'rose',
    name: 'Rose',
    colors: ['#f9a8d4', '#ec4899', '#fb7185'],
    wing: '#fce7f3',
    beak: '#fbbf24',
    glow: '#f472b6',
    trail: '#fb7185'
  },
  {
    id: 'ember',
    name: 'Ember',
    colors: ['#fed7aa', '#f97316', '#7f1d1d'],
    wing: '#ffedd5',
    beak: '#fde047',
    glow: '#fb923c',
    trail: '#f97316'
  }
];

const MAP_THEMES = [
  {
    id: 'neon',
    name: 'Neon',
    sky: ['#07111f', '#12304b', '#0b1724'],
    star: '#bae6fd',
    cloud: '#e0f2fe',
    ground: ['rgba(20, 184, 166, 0.08)', 'rgba(245, 158, 11, 0.28)'],
    pipe: ['#059669', '#34d399', '#047857', '#6ee7b7'],
    ridge: '#0f766e'
  },
  {
    id: 'canyon',
    name: 'Canyon',
    sky: ['#35140f', '#be5b2c', '#f7b267'],
    star: '#fff7ed',
    cloud: '#fed7aa',
    ground: ['rgba(120, 53, 15, 0.18)', 'rgba(154, 52, 18, 0.52)'],
    pipe: ['#b45309', '#f59e0b', '#92400e', '#fed7aa'],
    ridge: '#7c2d12'
  },
  {
    id: 'glacier',
    name: 'Glacier',
    sky: ['#062236', '#0e7490', '#cffafe'],
    star: '#ecfeff',
    cloud: '#f0f9ff',
    ground: ['rgba(186, 230, 253, 0.18)', 'rgba(14, 116, 144, 0.34)'],
    pipe: ['#0891b2', '#67e8f9', '#0e7490', '#cffafe'],
    ridge: '#155e75'
  },
  {
    id: 'jungle',
    name: 'Jungle',
    sky: ['#052e16', '#166534', '#84cc16'],
    star: '#dcfce7',
    cloud: '#bbf7d0',
    ground: ['rgba(21, 128, 61, 0.18)', 'rgba(63, 98, 18, 0.48)'],
    pipe: ['#365314', '#84cc16', '#1a2e05', '#bef264'],
    ridge: '#14532d'
  }
];

let selectedBirdId = localStorage.getItem('flappy_selected_bird') || 'sky';
let selectedMapId = localStorage.getItem('flappy_selected_map') || 'neon';

function getSelectedBird() {
  return BIRD_SKINS.find(skin => skin.id === selectedBirdId) || BIRD_SKINS[0];
}

function getSelectedMap() {
  return MAP_THEMES.find(theme => theme.id === selectedMapId) || MAP_THEMES[0];
}

function getBirdRadius() {
  return bird.radius * (activePowerups.mini > 0 ? MINI_SCALE : 1);
}

function getWorldSpeedScale() {
  return activePowerups.slowMo > 0 ? SLOW_MO_SPEED_SCALE : 1;
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;

  canvas.width = Math.round(viewportWidth * dpr);
  canvas.height = Math.round(viewportHeight * dpr);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  bird.x = Math.max(84, Math.min(150, viewportWidth * 0.18));
  bird.radius = Math.max(13, Math.min(20, viewportWidth * 0.026));
  pipeGap = Math.max(150, Math.min(230, viewportHeight * 0.26));
  worldSpeed = Math.max(2.5, Math.min(4.2, viewportWidth * 0.003));
  resetAtmosphere();
}

// Bird Settings
const bird = {
  x: 80,
  y: 280,
  radius: 14,
  gravity: 0.45,
  velocity: 0,
  jump: -7.5,
  rotation: 0,
  reset() {
    this.y = viewportHeight * 0.45;
    this.velocity = 0;
    this.rotation = 0;
  },
  flap() {
    this.velocity = this.jump;
    sound.playJump();
    createParticles(this.x - getBirdRadius(), this.y + 4, 10, getSelectedBird().trail, 1.2);
  },
  update(dtScale) {
    this.velocity += this.gravity * dtScale;
    this.y += this.velocity * dtScale;

    // Smooth Rotation
    if (this.velocity < 0) {
      this.rotation = Math.max(-0.4, this.rotation - 0.08 * dtScale);
    } else {
      this.rotation = Math.min(0.6, this.rotation + 0.04 * dtScale);
    }
  },
  draw() {
    const skin = getSelectedBird();
    const radius = getBirdRadius();
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (activePowerups.shield > 0) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = COLLECTIBLE_TYPES.shield.glow;
      ctx.strokeStyle = COLLECTIBLE_TYPES.shield.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Glow Effect
    ctx.shadowBlur = 18;
    ctx.shadowColor = skin.glow;

    ctx.globalAlpha = 0.26;
    ctx.fillStyle = skin.glow;
    ctx.beginPath();
    ctx.ellipse(-10, 2, radius * 1.9, radius * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Body Gradient
    const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    grad.addColorStop(0, skin.colors[0]);
    grad.addColorStop(0.5, skin.colors[1]);
    grad.addColorStop(1, skin.colors[2]);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = skin.wing;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.35, radius * 0.16, radius * 0.5, radius * 0.28, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(radius * 0.42, -radius * 0.3, radius * 0.27, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(radius * 0.48, -radius * 0.3, radius * 0.13, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = skin.beak;
    ctx.beginPath();
    ctx.moveTo(radius * 0.72, radius * 0.15);
    ctx.lineTo(radius * 1.45, radius * 0.32);
    ctx.lineTo(radius * 0.72, radius * 0.52);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
};

// Pipe Array & Settings
const pipes = [];
const pipeWidth = 52;
const collectibles = [];

function spawnPipes() {
  const minTop = Math.max(70, viewportHeight * 0.1);
  const maxTop = viewportHeight - pipeGap - Math.max(130, viewportHeight * 0.18);
  const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
  const width = Math.max(58, Math.min(86, viewportWidth * 0.075));
  const pipe = {
    x: viewportWidth,
    width: width,
    topHeight: topHeight,
    bottomY: topHeight + pipeGap,
    passed: false,
    shieldBypassed: false
  };

  pipes.push(pipe);
  maybeSpawnCollectible(pipe);
}

function maybeSpawnCollectible(pipe) {
  if (Math.random() > 0.78) return;

  const type = chooseCollectibleType();
  const gapPadding = Math.max(28, getBirdRadius() + COLLECTIBLE_TYPES[type].radius + 8);
  const yMin = pipe.topHeight + gapPadding;
  const yMax = pipe.bottomY - gapPadding;
  const y = yMin >= yMax ? pipe.topHeight + pipeGap / 2 : Math.random() * (yMax - yMin) + yMin;

  collectibles.push({
    type,
    x: pipe.x + pipe.width / 2,
    y,
    radius: COLLECTIBLE_TYPES[type].radius,
    wobbleSeed: Math.random() * Math.PI * 2,
    collected: false
  });
}

function chooseCollectibleType() {
  let roll = Math.random();
  for (const [type, config] of Object.entries(COLLECTIBLE_TYPES)) {
    roll -= config.weight;
    if (roll <= 0) return type;
  }
  return 'coin';
}

function updatePipes(dtScale) {
  if (pipeSpawnTimer >= PIPE_SPAWN_INTERVAL_MS) {
    spawnPipes();
    pipeSpawnTimer -= PIPE_SPAWN_INTERVAL_MS;
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= worldSpeed * getWorldSpeedScale() * dtScale;

    // Score Tracking
    if (!p.passed && p.x + p.width < bird.x) {
      p.passed = true;
      score++;
      sound.playScore();
      createParticles(bird.x, bird.y, 22, '#f59e0b', 1.6);
      flashAlpha = 0.18;
    }

    // Collision Detection
    const birdRadius = getBirdRadius();
    const inXBounds = bird.x + birdRadius > p.x && bird.x - birdRadius < p.x + p.width;
    const hitTopPipe = bird.y - birdRadius < p.topHeight;
    const hitBottomPipe = bird.y + birdRadius > p.bottomY;

    if (inXBounds && (hitTopPipe || hitBottomPipe) && !p.shieldBypassed) {
      handlePipeCollision(p);
    }

    // Remove Offscreen Pipes
    if (p.x + p.width < 0) {
      pipes.splice(i, 1);
    }
  }
}

function handlePipeCollision(pipe) {
  if (activePowerups.shield > 0) {
    activePowerups.shield = 0;
    shieldBreakGraceTimer = 700;
    pipe.shieldBypassed = true;
    screenShakeTimer = 8;
    flashAlpha = 0.24;
    sound.playHit();
    createParticles(bird.x, bird.y, 30, '#67e8f9', 2);
    updatePowerupHud();
    return;
  }

  if (shieldBreakGraceTimer <= 0) {
    triggerGameOver();
  }
}

function updateCollectibles(dtScale) {
  const speed = worldSpeed * getWorldSpeedScale() * dtScale;

  for (let i = collectibles.length - 1; i >= 0; i--) {
    const item = collectibles[i];
    item.x -= speed;

    const pulseY = Math.sin(frameCount * 0.09 + item.wobbleSeed) * 4;
    const dx = bird.x - item.x;
    const dy = bird.y - (item.y + pulseY);
    const collisionRadius = getBirdRadius() + item.radius;

    if (dx * dx + dy * dy <= collisionRadius * collisionRadius) {
      collectItem(item);
      collectibles.splice(i, 1);
      continue;
    }

    if (item.x + item.radius < 0) {
      collectibles.splice(i, 1);
    }
  }
}

function collectItem(item) {
  const config = COLLECTIBLE_TYPES[item.type];
  sound.playScore();
  createParticles(item.x, item.y, 18, config.color, 1.5);

  if (item.type === 'coin') {
    coinCount++;
    localStorage.setItem('flappy_coin_count', coinCount);
    hudCoinCountEl.textContent = coinCount;
    return;
  }

  if (item.type === 'shield') {
    activePowerups.shield = 1;
  } else if (item.type === 'slowMo') {
    activePowerups.slowMo = POWERUP_DURATION_MS;
  } else if (item.type === 'mini') {
    activePowerups.mini = POWERUP_DURATION_MS;
  }

  flashAlpha = Math.max(flashAlpha, 0.14);
  updatePowerupHud();
}

function drawCollectibles() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 18px Outfit, system-ui, sans-serif';

  collectibles.forEach(item => {
    const config = COLLECTIBLE_TYPES[item.type];
    const y = item.y + Math.sin(frameCount * 0.09 + item.wobbleSeed) * 4;
    const spinScale = 0.82 + Math.sin(frameCount * 0.12 + item.wobbleSeed) * 0.18;

    ctx.save();
    ctx.translate(item.x, y);
    ctx.scale(spinScale, 1);
    ctx.shadowBlur = 18;
    ctx.shadowColor = config.glow;
    ctx.fillStyle = config.color;
    ctx.beginPath();
    ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.fillText(config.icon, 0, 1);
    ctx.restore();
  });

  ctx.restore();
}

function updatePowerupTimers(deltaMs) {
  let changed = false;

  ['slowMo', 'mini'].forEach(type => {
    if (activePowerups[type] > 0) {
      activePowerups[type] = Math.max(0, activePowerups[type] - deltaMs);
      changed = true;
    }
  });

  if (shieldBreakGraceTimer > 0) {
    shieldBreakGraceTimer = Math.max(0, shieldBreakGraceTimer - deltaMs);
  }

  if (changed) {
    updatePowerupHud();
  }
}

function updatePowerupHud() {
  const activeItems = [];

  if (activePowerups.shield > 0) {
    activeItems.push({ icon: COLLECTIBLE_TYPES.shield.icon, label: '1 hit' });
  }

  if (activePowerups.slowMo > 0) {
    activeItems.push({
      icon: COLLECTIBLE_TYPES.slowMo.icon,
      label: `${Math.ceil(activePowerups.slowMo / 1000)}s`
    });
  }

  if (activePowerups.mini > 0) {
    activeItems.push({
      icon: COLLECTIBLE_TYPES.mini.icon,
      label: `${Math.ceil(activePowerups.mini / 1000)}s`
    });
  }

  const signature = activeItems.map(item => `${item.icon}:${item.label}`).join('|');
  if (signature === powerupHudSignature) return;

  powerupHudSignature = signature;
  powerupTrayEl.innerHTML = activeItems.map(item => `
    <div class="powerup-timer">
      <span>${item.icon}</span>
      <strong>${item.label}</strong>
    </div>
  `).join('');
}

function clearPowerups() {
  activePowerups.shield = 0;
  activePowerups.slowMo = 0;
  activePowerups.mini = 0;
  shieldBreakGraceTimer = 0;
  updatePowerupHud();
}

function drawPipes() {
  const theme = getSelectedMap();
  pipes.forEach(p => {
    const capHeight = Math.max(16, p.width * 0.26);
    // Top Pipe
    const topGrad = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
    topGrad.addColorStop(0, theme.pipe[0]);
    topGrad.addColorStop(0.5, theme.pipe[1]);
    topGrad.addColorStop(1, theme.pipe[2]);

    ctx.shadowBlur = 16;
    ctx.shadowColor = theme.pipe[1];
    ctx.fillStyle = topGrad;
    roundRect(p.x, -8, p.width, p.topHeight + 8, 10);

    // Pipe Caps
    ctx.fillStyle = theme.pipe[3];
    roundRect(p.x - 5, p.topHeight - capHeight, p.width + 10, capHeight, 8);

    // Bottom Pipe
    const bottomHeight = viewportHeight - p.bottomY;
    ctx.fillStyle = topGrad;
    roundRect(p.x, p.bottomY, p.width, bottomHeight + 8, 10);

    ctx.fillStyle = theme.pipe[1];
    roundRect(p.x - 5, p.bottomY, p.width + 10, capHeight, 8);
    ctx.shadowBlur = 0;
  });
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

// Particle System
const particles = [];

function createParticles(x, y, count, color, force = 1) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x,
      y: y,
      vx: ((Math.random() - 0.5) * 5 - 1) * force,
      vy: (Math.random() - 0.5) * 5 * force,
      size: Math.random() * 4 + 2,
      alpha: 1,
      color: color,
      spin: Math.random() * Math.PI
    });
  }
}

function updateAndDrawParticles(dtScale) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dtScale;
    p.y += p.vy * dtScale;
    p.vy += 0.025 * dtScale;
    p.spin += 0.12 * dtScale;
    p.alpha -= 0.03 * dtScale;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin);
    ctx.beginPath();
    ctx.roundRect(-p.size / 2, -p.size / 2, p.size, p.size, 2);
    ctx.fill();
    ctx.restore();
  }
}

// Parallax Background
const stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * viewportWidth,
  y: Math.random() * viewportHeight,
  size: Math.random() * 2.2 + 0.8,
  speed: Math.random() * 0.75 + 0.15,
  alpha: Math.random() * 0.55 + 0.25
}));
const clouds = Array.from({ length: 8 }, () => ({
  x: Math.random() * viewportWidth,
  y: Math.random() * viewportHeight * 0.65,
  width: Math.random() * 130 + 90,
  speed: Math.random() * 0.18 + 0.08,
  alpha: Math.random() * 0.08 + 0.04
}));

function drawBackground(dtScale) {
  const theme = getSelectedMap();
  const sky = ctx.createLinearGradient(0, 0, 0, viewportHeight);
  sky.addColorStop(0, theme.sky[0]);
  sky.addColorStop(0.52, theme.sky[1]);
  sky.addColorStop(1, theme.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  drawMapLandmarks(theme);

  clouds.forEach(cloud => {
    if (currentState === STATE.PLAYING) {
      cloud.x -= cloud.speed * worldSpeed * dtScale;
      if (cloud.x + cloud.width < 0) {
        cloud.x = viewportWidth + cloud.width;
        cloud.y = Math.random() * viewportHeight * 0.65;
      }
    }
    ctx.save();
    ctx.globalAlpha = cloud.alpha;
    ctx.fillStyle = theme.cloud;
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.width, cloud.width * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  stars.forEach(star => {
    if (currentState === STATE.PLAYING) {
      star.x -= star.speed * dtScale;
      if (star.x < 0) {
        star.x = viewportWidth;
        star.y = Math.random() * viewportHeight;
      }
    }
    ctx.globalAlpha = star.alpha + Math.sin((frameCount + star.x) * 0.025) * 0.15;
    ctx.fillStyle = theme.star;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  const groundHeight = Math.max(78, viewportHeight * 0.12);
  const ground = ctx.createLinearGradient(0, viewportHeight - groundHeight, 0, viewportHeight);
  ground.addColorStop(0, theme.ground[0]);
  ground.addColorStop(1, theme.ground[1]);
  ctx.fillStyle = ground;
  ctx.fillRect(0, viewportHeight - groundHeight, viewportWidth, groundHeight);
}

function drawMapLandmarks(theme) {
  const horizon = viewportHeight * 0.72;
  const offset = currentState === STATE.PLAYING ? (frameCount * worldSpeed * 0.22) % 220 : 0;

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = theme.ridge;

  if (theme.id === 'canyon') {
    for (let x = -260 - offset; x < viewportWidth + 260; x += 220) {
      ctx.beginPath();
      ctx.moveTo(x, viewportHeight);
      ctx.lineTo(x + 38, horizon - 48);
      ctx.lineTo(x + 76, horizon - 72);
      ctx.lineTo(x + 128, viewportHeight);
      ctx.closePath();
      ctx.fill();
    }
  } else if (theme.id === 'glacier') {
    for (let x = -220 - offset; x < viewportWidth + 220; x += 180) {
      ctx.beginPath();
      ctx.moveTo(x, viewportHeight);
      ctx.lineTo(x + 84, horizon - 112);
      ctx.lineTo(x + 168, viewportHeight);
      ctx.closePath();
      ctx.fill();
    }
  } else if (theme.id === 'jungle') {
    for (let x = -180 - offset; x < viewportWidth + 180; x += 84) {
      ctx.beginPath();
      ctx.roundRect(x, horizon - 30, 20, viewportHeight - horizon + 40, 10);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 10, horizon - 44, 42, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (let x = -240 - offset; x < viewportWidth + 240; x += 180) {
      ctx.beginPath();
      ctx.moveTo(x, viewportHeight);
      ctx.lineTo(x + 90, horizon - 78);
      ctx.lineTo(x + 180, viewportHeight);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

function resetAtmosphere() {
  stars.forEach(star => {
    star.x = Math.random() * viewportWidth;
    star.y = Math.random() * viewportHeight;
  });
  clouds.forEach(cloud => {
    cloud.x = Math.random() * viewportWidth;
    cloud.y = Math.random() * viewportHeight * 0.65;
  });
}

// Draw Live Score HUD
function drawScore() {
  if (currentState !== STATE.PLAYING) return;
  ctx.font = '800 36px Outfit';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;
  ctx.fillText(score, viewportWidth / 2, 60);
  ctx.shadowBlur = 0;
}

function drawFlash(dtScale) {
  if (flashAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = flashAlpha;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  ctx.restore();
  flashAlpha *= Math.pow(0.86, dtScale);
}

// Game Loop
function gameLoop(timestamp = performance.now()) {
  const deltaMs = lastFrameTime ? Math.min(timestamp - lastFrameTime, MAX_DELTA_MS) : FRAME_DURATION;
  const dtScale = deltaMs / FRAME_DURATION;
  lastFrameTime = timestamp;

  ctx.save();

  // Screen Shake Effect
  if (screenShakeTimer > 0) {
    const dx = (Math.random() - 0.5) * 10;
    const dy = (Math.random() - 0.5) * 10;
    ctx.translate(dx, dy);
    screenShakeTimer -= dtScale;
  }

  drawBackground(dtScale);

  if (currentState === STATE.PLAYING) {
    pipeSpawnTimer += deltaMs * getWorldSpeedScale();
    updatePowerupTimers(deltaMs);
    bird.update(dtScale);
    updatePipes(dtScale);
    updateCollectibles(dtScale);

    // Ground & Ceiling Collisions
    const birdRadius = getBirdRadius();
    if (bird.y + birdRadius >= viewportHeight || bird.y - birdRadius <= 0) {
      triggerGameOver();
    }
  }

  drawPipes();
  drawCollectibles();
  bird.draw();
  updateAndDrawParticles(dtScale);
  drawScore();
  drawFlash(dtScale);

  ctx.restore();

  frameCount += dtScale;
  requestAnimationFrame(gameLoop);
}

// Game Control Handlers
function handleAction() {
  sound.init();
  if (currentState === STATE.MENU) {
    startGame();
  } else if (currentState === STATE.PLAYING) {
    bird.flap();
  } else if (currentState === STATE.GAMEOVER) {
    startGame();
  }
}

function startGame() {
  score = 0;
  pipes.length = 0;
  collectibles.length = 0;
  particles.length = 0;
  frameCount = 0;
  pipeSpawnTimer = PIPE_SPAWN_INTERVAL_MS;
  flashAlpha = 0;
  clearPowerups();
  bird.reset();

  currentState = STATE.PLAYING;
  startOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
  quickRetryBtn.classList.add('hidden');
}

function goHome() {
  score = 0;
  pipes.length = 0;
  collectibles.length = 0;
  particles.length = 0;
  frameCount = 0;
  pipeSpawnTimer = 0;
  flashAlpha = 0;
  screenShakeTimer = 0;
  clearPowerups();
  bird.reset();
  resetAtmosphere();
  renderChoiceButtons();

  currentState = STATE.MENU;
  startOverlay.classList.remove('hidden');
  gameOverOverlay.classList.add('hidden');
  quickRetryBtn.classList.add('hidden');
}

function triggerGameOver() {
  if (currentState === STATE.GAMEOVER) return;
  sound.playHit();
  currentState = STATE.GAMEOVER;
  screenShakeTimer = 12;
  flashAlpha = 0.35;
  createParticles(bird.x, bird.y, 36, '#fb7185', 2);

  // High Score Logic
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('flappy_best_score', highScore);
    hudBestScoreEl.textContent = highScore;
  }

  // Award Medals
  let medal = '🥉';
  if (score >= 30) medal = '💎';
  else if (score >= 20) medal = '🥇';
  else if (score >= 10) medal = '🥈';

  medalSlotEl.textContent = medal;
  finalScoreEl.textContent = score;
  bestScoreEl.textContent = highScore;

  setTimeout(() => {
    gameOverOverlay.classList.remove('hidden');
    quickRetryBtn.classList.remove('hidden');
  }, 400);
}

function renderChoiceButtons() {
  birdChoicesEl.innerHTML = '';
  mapChoicesEl.innerHTML = '';

  BIRD_SKINS.forEach(skin => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `choice-card ${skin.id === selectedBirdId ? 'active' : ''}`;
    button.setAttribute('aria-pressed', skin.id === selectedBirdId ? 'true' : 'false');
    button.innerHTML = `
      <span class="bird-token" style="--token-a:${skin.colors[0]};--token-b:${skin.colors[1]};--token-c:${skin.colors[2]};--token-glow:${skin.glow};"></span>
      <span class="choice-label">${skin.name}</span>
    `;
    button.addEventListener('click', () => {
      selectedBirdId = skin.id;
      localStorage.setItem('flappy_selected_bird', selectedBirdId);
      renderChoiceButtons();
    });
    birdChoicesEl.appendChild(button);
  });

  MAP_THEMES.forEach(theme => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `choice-card ${theme.id === selectedMapId ? 'active' : ''}`;
    button.setAttribute('aria-pressed', theme.id === selectedMapId ? 'true' : 'false');
    button.innerHTML = `
      <span class="map-token" style="--token-a:${theme.sky[0]};--token-b:${theme.sky[1]};--token-c:${theme.sky[2]};--token-glow:${theme.pipe[1]};"></span>
      <span class="choice-label">${theme.name}</span>
    `;
    button.addEventListener('click', () => {
      selectedMapId = theme.id;
      localStorage.setItem('flappy_selected_map', selectedMapId);
      resetAtmosphere();
      renderChoiceButtons();
    });
    mapChoicesEl.appendChild(button);
  });
}

// Event Listeners
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    handleAction();
  }
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleAction();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
homeBtn.addEventListener('click', goHome);
quickRetryBtn.addEventListener('click', startGame);

audioToggleBtn.addEventListener('click', () => {
  sound.init();
  sound.muted = !sound.muted;
  audioToggleBtn.textContent = sound.muted ? '🔇' : '🔊';
});

// Start Render Engine
renderChoiceButtons();
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
requestAnimationFrame(gameLoop);
