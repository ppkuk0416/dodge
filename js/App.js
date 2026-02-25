import { Player }         from './Player.js';
import { BulletSystem }   from './Bullet.js';
import { ParticleSystem } from './Particles.js';
import { ItemSystem }     from './Items.js';
import { SoundManager }   from './Sound.js';

const STATE = { START: 0, PLAYING: 1, GAMEOVER: 2 };

// Patterns unlocked progressively
const PATTERN_LEVELS = [
  ['rain', 'aimed'],
  ['rain', 'aimed', 'burst'],
  ['rain', 'aimed', 'burst', 'cross'],
  ['rain', 'aimed', 'burst', 'cross', 'spiral'],
  ['rain', 'aimed', 'burst', 'cross', 'spiral', 'wall'],
  ['rain', 'aimed', 'burst', 'cross', 'spiral', 'wall', 'ring'],
];

class App {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.state   = STATE.START;
    this.lastTs  = 0;
    this.time    = 0; // ms since game start

    // Systems (created fresh each game)
    this.player   = null;
    this.bullets  = null;
    this.particles = new ParticleSystem();
    this.items    = null;
    this.sound    = new SoundManager();

    // Mouse / touch
    this.mx = this.canvas.width  / 2;
    this.my = this.canvas.height / 2;

    // Pattern spawn
    this.patternTimer    = 0;
    this.patternInterval = 1500; // ms, shrinks with difficulty

    // Score
    this.score    = 0;
    this.nickname = '';
    this.ranking  = [];

    this._setupDOM();
    this._setupEvents();
    this._loadRanking();

    requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Setup ──────────────────────────────────────

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _setupDOM() {
    this.$startScreen   = document.getElementById('start-screen');
    this.$gameoverScreen= document.getElementById('gameover-screen');
    this.$hud           = document.getElementById('hud');
    this.$score         = document.getElementById('score');
    this.$livesIcons    = document.getElementById('lives-icons');
    this.$activeItem    = document.getElementById('active-item');
    this.$finalScore    = document.getElementById('final-score');
    this.$rankMsg       = document.getElementById('rank-message');
    this.$rankingList   = document.getElementById('ranking-list');
    this.$finalRanking  = document.getElementById('final-ranking-list');
    this.$nickname      = document.getElementById('nickname-input');

    document.getElementById('start-btn').addEventListener('click',   () => this._startGame());
    document.getElementById('restart-btn').addEventListener('click', () => this._toStart());

    // Enter key on nickname input
    this.$nickname.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._startGame();
    });
  }

  _setupEvents() {
    this.canvas.addEventListener('mousemove', e => { this.mx = e.clientX; this.my = e.clientY; });
    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      this.mx = e.touches[0].clientX;
      this.my = e.touches[0].clientY;
    }, { passive: false });

    // Resume AudioContext on first gesture
    const resume = () => { this.sound.resume(); };
    document.addEventListener('click',      resume, { once: true });
    document.addEventListener('touchstart', resume, { once: true });
  }

  // ── Ranking ────────────────────────────────────

  _loadRanking() {
    try {
      this.ranking = JSON.parse(localStorage.getItem('bulletDodgeRanking') ?? '[]');
    } catch { this.ranking = []; }
    this._renderRanking(this.$rankingList);
  }

  _saveScore(name, score) {
    this.ranking.push({ name, score });
    this.ranking.sort((a, b) => b.score - a.score);
    this.ranking = this.ranking.slice(0, 10);
    localStorage.setItem('bulletDodgeRanking', JSON.stringify(this.ranking));
  }

  _renderRanking(el) {
    if (!el) return;
    const top5 = this.ranking.slice(0, 5);
    const cls  = ['gold', 'silver', 'bronze'];
    el.innerHTML = top5.length
      ? top5.map((r, i) =>
          `<li class="${cls[i] ?? ''}">${i + 1}. ${r.name} — ${r.score}초</li>`
        ).join('')
      : '<li>기록이 없습니다</li>';
  }

  // ── State transitions ──────────────────────────

  _startGame() {
    this.nickname = this.$nickname.value.trim() || '익명';
    this.state    = STATE.PLAYING;

    this.$startScreen.classList.add('hidden');
    this.$hud.classList.remove('hidden');

    this.time          = 0;
    this.patternTimer  = 0;
    this.score         = 0;

    this.player   = new Player(this.canvas);
    this.bullets  = new BulletSystem(this.canvas);
    this.items    = new ItemSystem(this.canvas);
    this.particles = new ParticleSystem();

    // Reset mouse to center so player doesn't teleport
    this.mx = this.canvas.width  / 2;
    this.my = this.canvas.height / 2;

    this._updateLives();
    this.sound.startBGM();
  }

  _toStart() {
    this.$gameoverScreen.classList.add('hidden');
    this._loadRanking();
    this.$startScreen.classList.remove('hidden');
    this.state = STATE.START;
  }

  _gameOver() {
    this.state = STATE.GAMEOVER;
    this.$hud.classList.add('hidden');
    this.sound.stopBGM();
    this.sound.playGameOver();

    this._saveScore(this.nickname, this.score);

    this.$finalScore.textContent = this.score;

    const rank = this.ranking.findIndex(r => r.name === this.nickname && r.score === this.score) + 1;
    if (rank === 1)      this.$rankMsg.textContent = '1위를 달성했습니다!';
    else if (rank <= 3)  this.$rankMsg.textContent = `${rank}위를 기록했습니다!`;
    else if (rank <= 10) this.$rankMsg.textContent = `${rank}위를 기록했습니다.`;
    else                 this.$rankMsg.textContent = '다시 도전해보세요!';

    this._renderRanking(this.$finalRanking);
    this.$gameoverScreen.classList.remove('hidden');
  }

  // ── HUD helpers ────────────────────────────────

  _updateLives() {
    this.$livesIcons.innerHTML = Array.from({ length: this.player.maxLives }, (_, i) =>
      `<span class="life-icon ${i < this.player.lives ? 'active' : 'lost'}">♥</span>`
    ).join('');
  }

  _updateActiveItem() {
    const p = this.player;
    if (p.shield) {
      this.$activeItem.textContent = `🛡 ${Math.ceil(p.shieldTime / 1000)}s`;
    } else if (p.slow) {
      this.$activeItem.textContent = `⏱ ${Math.ceil(p.slowTime / 1000)}s`;
    } else {
      this.$activeItem.textContent = '';
    }
  }

  // ── Game logic ─────────────────────────────────

  get _difficulty() {
    // 0→8 over 4 minutes
    return Math.min(this.time / 1000 / 30, 8);
  }

  _pickPatterns() {
    const idx = Math.min(Math.floor(this._difficulty / 1.4), PATTERN_LEVELS.length - 1);
    return PATTERN_LEVELS[idx];
  }

  _update(dt) {
    this.time += dt;
    this.score = Math.floor(this.time / 1000);
    this.$score.textContent = this.score;

    // Pattern spawn interval shrinks with difficulty
    this.patternInterval = Math.max(280, 1500 - this._difficulty * 140);
    this.patternTimer += dt;

    if (this.patternTimer >= this.patternInterval) {
      this.patternTimer = 0;
      const pool    = this._pickPatterns();
      const pattern = pool[Math.floor(Math.random() * pool.length)];
      const speed   = 2.2 + this._difficulty * 0.5;
      const repeats = Math.max(1, Math.floor(1 + this._difficulty * 0.25));
      for (let i = 0; i < repeats; i++) {
        this.bullets.spawnPattern(pattern, this.player.x, this.player.y, speed);
      }
    }

    const slow = this.player.slow ? 0.28 : 1;

    this.player.update(this.mx, this.my, dt);
    this.bullets.update(dt, this.player.x, this.player.y, slow);
    this.items.update(dt, this.time);
    this.particles.update();

    // Bullet collision
    if (this.bullets.checkCollisions(this.player)) {
      this.bullets.removeBulletsHittingPlayer(this.player);
      const shieldWasActive = this.player.shield;
      const lifeWasLost = this.player.hit();

      if (shieldWasActive && !lifeWasLost) {
        // shield blocked it
        this.sound.playShieldBlock();
        this.particles.emitShieldBlock(this.player.x, this.player.y);
      } else if (lifeWasLost) {
        this.sound.playHit();
        this.particles.emitHit(this.player.x, this.player.y);
        this._updateLives();
        if (this.player.lives <= 0) {
          this.particles.emitDeath(this.player.x, this.player.y);
          this.sound.playDeath();
          this._gameOver();
          return;
        }
      }
    }

    // Item collision
    const collected = this.items.checkCollisions(this.player);
    collected.forEach(item => {
      this.sound.playItemPickup(item.type);
      this.particles.emitItemPickup(this.player.x, this.player.y, item.color);
      switch (item.type) {
        case 'shield': this.player.activateShield(); break;
        case 'slow':   this.player.activateSlow();   break;
        case 'bomb':
          this.particles.emitBomb(this.canvas.width / 2, this.canvas.height / 2);
          this.bullets.clearAll();
          break;
        case 'life':
          if (this.player.lives < this.player.maxLives) {
            this.player.lives++;
            this._updateLives();
          }
          break;
      }
    });

    this._updateActiveItem();
  }

  // ── Rendering ──────────────────────────────────

  _draw(ts) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.028)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.restore();

    if (this.state === STATE.PLAYING || this.state === STATE.GAMEOVER) {
      this.bullets?.draw(ctx);
      this.items?.draw(ctx, ts);
      this.particles.draw(ctx);
      if (this.state === STATE.PLAYING) this.player?.draw(ctx);
    } else {
      this.particles.draw(ctx);
    }
  }

  // ── Main loop ──────────────────────────────────

  _loop(ts) {
    const dt = Math.min(ts - this.lastTs, 100);
    this.lastTs = ts;

    if (this.state === STATE.PLAYING) this._update(dt);
    this._draw(ts);

    requestAnimationFrame(t => this._loop(t));
  }
}

new App();
