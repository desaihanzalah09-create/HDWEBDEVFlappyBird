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

// DOM Overlays
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const quickRetryBtn = document.getElementById('quickRetryBtn');
const audioToggleBtn = document.getElementById('audioToggleBtn');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const hudBestScoreEl = document.getElementById('hudBestScore');
const medalSlotEl = document.getElementById('medalSlot');

// Game State Constants
const STATE = { MENU: 0, PLAYING: 1, GAMEOVER: 2 };
let currentState = STATE.MENU;

let score = 0;
let highScore = parseInt(localStorage.getItem('flappy_best_score')) || 0;
let frameCount = 0;
let screenShakeTimer = 0;
let flashAlpha = 0;
let worldSpeed = 2.5;
let pipeGap = 150;

hudBestScoreEl.textContent = highScore;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  bird.x = Math.max(84, Math.min(150, canvas.width * 0.18));
  bird.radius = Math.max(13, Math.min(20, canvas.width * 0.026));
  pipeGap = Math.max(150, Math.min(230, canvas.height * 0.26));
  worldSpeed = Math.max(2.5, Math.min(4.2, canvas.width * 0.003));
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
    this.y = canvas.height * 0.45;
    this.velocity = 0;
    this.rotation = 0;
  },
  flap() {
    this.velocity = this.jump;
    sound.playJump();
    createParticles(this.x - this.radius, this.y + 4, 10, '#38bdf8', 1.2);
  },
  update() {
    this.velocity += this.gravity;
    this.y += this.velocity;

    // Smooth Rotation
    if (this.velocity < 0) {
      this.rotation = Math.max(-0.4, this.rotation - 0.08);
    } else {
      this.rotation = Math.min(0.6, this.rotation + 0.04);
    }
  },
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Glow Effect
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#38bdf8';

    ctx.globalAlpha = 0.26;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(-10, 2, this.radius * 1.9, this.radius * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Body Gradient
    const grad = ctx.createLinearGradient(-this.radius, -this.radius, this.radius, this.radius);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.5, '#22d3ee');
    grad.addColorStop(1, '#f59e0b');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.radius * 0.42, -this.radius * 0.3, this.radius * 0.27, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(this.radius * 0.48, -this.radius * 0.3, this.radius * 0.13, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(this.radius * 0.72, this.radius * 0.15);
    ctx.lineTo(this.radius * 1.45, this.radius * 0.32);
    ctx.lineTo(this.radius * 0.72, this.radius * 0.52);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
};

// Pipe Array & Settings
const pipes = [];
const pipeWidth = 52;

function spawnPipes() {
  const minTop = Math.max(70, canvas.height * 0.1);
  const maxTop = canvas.height - pipeGap - Math.max(130, canvas.height * 0.18);
  const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;

  pipes.push({
    x: canvas.width,
    width: Math.max(58, Math.min(86, canvas.width * 0.075)),
    topHeight: topHeight,
    bottomY: topHeight + pipeGap,
    passed: false
  });
}

function updatePipes() {
  if (frameCount % 90 === 0) {
    spawnPipes();
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= worldSpeed;

    // Score Tracking
    if (!p.passed && p.x + p.width < bird.x) {
      p.passed = true;
      score++;
      sound.playScore();
      createParticles(bird.x, bird.y, 22, '#f59e0b', 1.6);
      flashAlpha = 0.18;
    }

    // Collision Detection
    const inXBounds = bird.x + bird.radius > p.x && bird.x - bird.radius < p.x + p.width;
    const hitTopPipe = bird.y - bird.radius < p.topHeight;
    const hitBottomPipe = bird.y + bird.radius > p.bottomY;

    if (inXBounds && (hitTopPipe || hitBottomPipe)) {
      triggerGameOver();
    }

    // Remove Offscreen Pipes
    if (p.x + p.width < 0) {
      pipes.splice(i, 1);
    }
  }
}

function drawPipes() {
  pipes.forEach(p => {
    const capHeight = Math.max(16, p.width * 0.26);
    // Top Pipe
    const topGrad = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
    topGrad.addColorStop(0, '#059669');
    topGrad.addColorStop(0.5, '#34d399');
    topGrad.addColorStop(1, '#047857');

    ctx.shadowBlur = 16;
    ctx.shadowColor = 'rgba(16, 185, 129, 0.38)';
    ctx.fillStyle = topGrad;
    roundRect(p.x, -8, p.width, p.topHeight + 8, 10);

    // Pipe Caps
    ctx.fillStyle = '#6ee7b7';
    roundRect(p.x - 5, p.topHeight - capHeight, p.width + 10, capHeight, 8);

    // Bottom Pipe
    const bottomHeight = canvas.height - p.bottomY;
    ctx.fillStyle = topGrad;
    roundRect(p.x, p.bottomY, p.width, bottomHeight + 8, 10);

    ctx.fillStyle = '#34d399';
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

function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.025;
    p.spin += 0.12;
    p.alpha -= 0.03;

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
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  size: Math.random() * 2.2 + 0.8,
  speed: Math.random() * 0.75 + 0.15,
  alpha: Math.random() * 0.55 + 0.25
}));
const clouds = Array.from({ length: 8 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height * 0.65,
  width: Math.random() * 130 + 90,
  speed: Math.random() * 0.18 + 0.08,
  alpha: Math.random() * 0.08 + 0.04
}));

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#07111f');
  sky.addColorStop(0.52, '#12304b');
  sky.addColorStop(1, '#0b1724');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  clouds.forEach(cloud => {
    if (currentState === STATE.PLAYING) {
      cloud.x -= cloud.speed * worldSpeed;
      if (cloud.x + cloud.width < 0) {
        cloud.x = canvas.width + cloud.width;
        cloud.y = Math.random() * canvas.height * 0.65;
      }
    }
    ctx.save();
    ctx.globalAlpha = cloud.alpha;
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.width, cloud.width * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  stars.forEach(star => {
    if (currentState === STATE.PLAYING) {
      star.x -= star.speed;
      if (star.x < 0) {
        star.x = canvas.width;
        star.y = Math.random() * canvas.height;
      }
    }
    ctx.globalAlpha = star.alpha + Math.sin((frameCount + star.x) * 0.025) * 0.15;
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  const groundHeight = Math.max(78, canvas.height * 0.12);
  const ground = ctx.createLinearGradient(0, canvas.height - groundHeight, 0, canvas.height);
  ground.addColorStop(0, 'rgba(20, 184, 166, 0.08)');
  ground.addColorStop(1, 'rgba(245, 158, 11, 0.28)');
  ctx.fillStyle = ground;
  ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);
}

function resetAtmosphere() {
  stars.forEach(star => {
    star.x = Math.random() * canvas.width;
    star.y = Math.random() * canvas.height;
  });
  clouds.forEach(cloud => {
    cloud.x = Math.random() * canvas.width;
    cloud.y = Math.random() * canvas.height * 0.65;
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
  ctx.fillText(score, canvas.width / 2, 60);
  ctx.shadowBlur = 0;
}

function drawFlash() {
  if (flashAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = flashAlpha;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  flashAlpha *= 0.86;
}

// Game Loop
function gameLoop() {
  ctx.save();

  // Screen Shake Effect
  if (screenShakeTimer > 0) {
    const dx = (Math.random() - 0.5) * 10;
    const dy = (Math.random() - 0.5) * 10;
    ctx.translate(dx, dy);
    screenShakeTimer--;
  }

  drawBackground();

  if (currentState === STATE.PLAYING) {
    bird.update();
    updatePipes();

    // Ground & Ceiling Collisions
    if (bird.y + bird.radius >= canvas.height || bird.y - bird.radius <= 0) {
      triggerGameOver();
    }
  }

  drawPipes();
  bird.draw();
  updateAndDrawParticles();
  drawScore();
  drawFlash();

  ctx.restore();

  frameCount++;
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
  particles.length = 0;
  frameCount = 0;
  flashAlpha = 0;
  bird.reset();

  currentState = STATE.PLAYING;
  startOverlay.classList.add('hidden');
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
quickRetryBtn.addEventListener('click', startGame);

audioToggleBtn.addEventListener('click', () => {
  sound.init();
  sound.muted = !sound.muted;
  audioToggleBtn.textContent = sound.muted ? '🔇' : '🔊';
});

// Start Render Engine
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
requestAnimationFrame(gameLoop);
