import { Player }         from './Player.js';
import { BulletSystem }   from './Bullet.js';
import { ParticleSystem } from './Particles.js';
import { ItemSystem }     from './Items.js';
import { SoundManager }   from './Sound.js';
import { EnemySystem }    from './Enemy.js';
import { WeaponSystem, WEAPON_DEFS } from './Weapon.js';

const STATE = { START: 0, PLAYING: 1, GAMEOVER: 2, LEVELUP: 3 };

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

    this.state  = STATE.START;
    this.lastTs = 0;
    this.time   = 0;

    this.player    = null;
    this.bullets   = null;
    this.particles = new ParticleSystem();
    this.items     = null;
    this.enemies   = null;
    this.weapons   = null;
    this.sound     = new SoundManager();

    this.mx = this.canvas.width  / 2;
    this.my = this.canvas.height / 2;

    this.patternTimer    = 0;
    this.patternInterval = 1500;

    this.score    = 0;
    this.nickname = '';
    this.ranking  = [];

    // XP-based leveling
    this.level    = 1;
    this.xp       = 0;
    this.xpNeeded = 50;

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
    this.$startScreen    = document.getElementById('start-screen');
    this.$gameoverScreen = document.getElementById('gameover-screen');
    this.$hud            = document.getElementById('hud');
    this.$score          = document.getElementById('score');
    this.$livesIcons     = document.getElementById('lives-icons');
    this.$activeItem     = document.getElementById('active-item');
    this.$finalScore     = document.getElementById('final-score');
    this.$rankMsg        = document.getElementById('rank-message');
    this.$rankingList    = document.getElementById('ranking-list');
    this.$finalRanking   = document.getElementById('final-ranking-list');
    this.$nickname       = document.getElementById('nickname-input');
    this.$levelDisplay   = document.getElementById('level-display');
    this.$xpBar          = document.getElementById('xp-bar');

    document.getElementById('start-btn').addEventListener('click',   () => this._startGame());
    document.getElementById('restart-btn').addEventListener('click', () => this._toStart());

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

    this.keys = {};
    document.addEventListener('keydown', e => { this.keys[e.key.toLowerCase()] = true; });
    document.addEventListener('keyup',   e => { this.keys[e.key.toLowerCase()] = false; });

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
    document.getElementById('xp-bar-container').classList.remove('hidden');

    this.time         = 0;
    this.patternTimer = 0;
    this.score        = 0;
    this.level        = 1;
    this.xp           = 0;
    this.xpNeeded     = 50;

    if (this.$levelDisplay) this.$levelDisplay.textContent = 'Lv.1';
    if (this.$xpBar) this.$xpBar.style.width = '0%';

    this.player    = new Player(this.canvas);
    this.bullets   = new BulletSystem(this.canvas);
    this.items     = new ItemSystem(this.canvas);
    this.particles = new ParticleSystem();
    this.enemies   = new EnemySystem(this.canvas);
    this.weapons   = new WeaponSystem(this.canvas);
    this.weapons.upgrade('basic'); // start with Basic Lv.1

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
    document.getElementById('xp-bar-container').classList.add('hidden');
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
    if (p.shield)     this.$activeItem.textContent = `🛡 ${Math.ceil(p.shieldTime / 1000)}s`;
    else if (p.slow)  this.$activeItem.textContent = `⏱ ${Math.ceil(p.slowTime / 1000)}s`;
    else              this.$activeItem.textContent = '';
  }

  // ── Level-up system ────────────────────────────

  _pickWeaponCards() {
    const available = this.weapons.availableUpgrades();
    if (available.length === 0) return [];
    return [...available].sort(() => Math.random() - 0.5).slice(0, Math.min(3, available.length));
  }

  _triggerLevelUp() {
    this.state = STATE.LEVELUP;
    this.level++;
    if (this.$levelDisplay) this.$levelDisplay.textContent = `Lv.${this.level}`;

    const picks = this._pickWeaponCards();
    const container = document.getElementById('ability-cards');
    document.getElementById('levelup-new-level').textContent = this.level;

    container.innerHTML = picks.map(w => {
      const currentLevel = this.weapons.getLevel(w.id);
      const nextLevel    = currentLevel + 1;
      const tag          = currentLevel === 0 ? '신규' : `Lv.${currentLevel}→${nextLevel}`;
      const tagClass     = currentLevel === 0 ? 'tag-new' : 'tag-up';
      const desc         = w.descs[currentLevel];
      return `
        <div class="ability-card" data-id="${w.id}">
          <div class="ability-card-tag ${tagClass}">${tag}</div>
          <div class="ability-icon">${w.icon}</div>
          <div class="ability-name">${w.name}</div>
          <div class="ability-desc">${desc}</div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.ability-card').forEach(card => {
      card.addEventListener('click', () => {
        this.weapons.upgrade(card.dataset.id);
        this._resumeFromLevelUp();
      }, { once: true });
    });

    document.getElementById('levelup-screen').classList.remove('hidden');
  }

  _resumeFromLevelUp() {
    document.getElementById('levelup-screen').classList.add('hidden');
    this.state = STATE.PLAYING;
  }

  // ── Game logic ─────────────────────────────────

  get _difficulty() {
    return Math.min(this.time / 1000 / 15, 8);
  }

  _pickPatterns() {
    const idx = Math.min(Math.floor(this._difficulty / 1.4), PATTERN_LEVELS.length - 1);
    return PATTERN_LEVELS[idx];
  }

  _applyKeyboard(dt) {
    const spd = 400 * (this.player?.speedMult ?? 1) * dt / 1000;
    if (this.keys['w'] || this.keys['arrowup'])    this.my -= spd;
    if (this.keys['s'] || this.keys['arrowdown'])  this.my += spd;
    if (this.keys['a'] || this.keys['arrowleft'])  this.mx -= spd;
    if (this.keys['d'] || this.keys['arrowright']) this.mx += spd;
    this.mx = Math.max(0, Math.min(this.canvas.width,  this.mx));
    this.my = Math.max(0, Math.min(this.canvas.height, this.my));
  }

  _update(dt) {
    this._applyKeyboard(dt);
    this.time += dt;
    this.score = Math.floor(this.time / 1000);
    this.$score.textContent = this.score;

    // Bullet patterns (enemy fire)
    this.patternInterval = Math.max(250, 950 - this._difficulty * 130);
    this.patternTimer += dt;
    if (this.patternTimer >= this.patternInterval) {
      this.patternTimer = 0;
      const pool    = this._pickPatterns();
      const pattern = pool[Math.floor(Math.random() * pool.length)];
      const speed   = 3.5 + this._difficulty * 0.5;
      const repeats = Math.max(1, Math.floor(1 + this._difficulty * 0.22));
      for (let i = 0; i < repeats; i++) {
        this.bullets.spawnPattern(pattern, this.player.x, this.player.y, speed);
      }
    }

    const slowFactor = this.player.slow ? 0.28 : 1;

    this.player.update(this.mx, this.my, dt);
    this.bullets.update(dt, this.player.x, this.player.y, slowFactor);
    this.items.update(dt, this.time);
    this.particles.update();

    // Enemy system
    this.enemies.update(dt, this._difficulty, this.player.x, this.player.y);

    // Weapon auto-attack → process hits
    const weaponHits = this.weapons.update(dt, this.player.x, this.player.y, this.enemies.enemies);
    for (const hit of weaponHits) {
      if (!hit.enemy.active) continue;

      if (hit.aoeRadius > 0) {
        // Burst/AOE: damage all enemies in radius
        for (const e of this.enemies.enemies) {
          if (!e.active) continue;
          const dx = e.x - hit.x, dy = e.y - hit.y;
          if (Math.sqrt(dx * dx + dy * dy) < hit.aoeRadius) {
            e.hit(hit.damage);
            if (!e.active) {
              this.enemies.dropGem(e);
              this.particles.emitHit(e.x, e.y);
            }
          }
        }
        this.particles.emitBomb(hit.x, hit.y);
      } else {
        hit.enemy.hit(hit.damage);
        if (hit.freeze > 0) hit.enemy.freeze(hit.freeze);
        if (!hit.enemy.active) {
          this.enemies.dropGem(hit.enemy);
          this.particles.emitHit(hit.enemy.x, hit.enemy.y);
          this.sound.playHit();
        }
      }
    }

    // Enemy body contact → player takes damage
    for (const e of this.enemies.enemies) {
      if (!e.active) continue;
      if (e.collidesWith(this.player)) {
        const shieldWasActive = this.player.shield;
        const lifeWasLost = this.player.hit();
        if (shieldWasActive && !lifeWasLost) {
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
        break;
      }
    }

    // Bullet collision
    if (this.bullets.checkCollisions(this.player)) {
      this.bullets.removeBulletsHittingPlayer(this.player);
      const shieldWasActive = this.player.shield;
      const lifeWasLost = this.player.hit();
      if (shieldWasActive && !lifeWasLost) {
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

    // XP gem collection
    const xpGained = this.enemies.collectGems(this.player);
    if (xpGained > 0) {
      this.xp += xpGained;
      if (this.xp >= this.xpNeeded) {
        this.xp      -= this.xpNeeded;
        this.xpNeeded = Math.floor(this.xpNeeded * 1.4);
        // Check if any weapon upgrades are available
        if (this.weapons.availableUpgrades().length > 0) {
          this._triggerLevelUp();
          return;
        }
      }
    }

    // Update XP bar
    if (this.$xpBar) this.$xpBar.style.width = Math.min(100, this.xp / this.xpNeeded * 100) + '%';

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
          this.enemies.killAll(); // also clears all enemies (drop gems)
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

  // ── Excel spreadsheet background ───────────────

  _colLabel(n) {
    let label = '';
    while (n > 0) {
      n--;
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26);
    }
    return label;
  }

  _drawExcelBackground() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const COL_W = 65, ROW_H = 20, HDR_H = 18, ROW_NUM_W = 32;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#F2F2F2';
    ctx.fillRect(0, 0, w, HDR_H);
    ctx.fillRect(0, 0, ROW_NUM_W, h);

    ctx.fillStyle = '#E9E9E9';
    ctx.fillRect(0, 0, ROW_NUM_W, HDR_H);

    ctx.save();
    ctx.strokeStyle = '#D0D0D0';
    ctx.lineWidth   = 1;

    ctx.fillStyle = '#555';
    ctx.font = '11px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let col = 1;
    for (let x = ROW_NUM_W; x <= w; x += COL_W) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
      if (x + COL_W / 2 < w) ctx.fillText(this._colLabel(col), x + COL_W / 2, HDR_H / 2);
      col++;
    }

    let row = 1;
    for (let y = HDR_H; y <= h; y += ROW_H) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
      if (y + ROW_H / 2 < h) ctx.fillText(row, ROW_NUM_W / 2, y + ROW_H / 2);
      row++;
    }

    ctx.strokeStyle = '#A8A8A8';
    ctx.beginPath(); ctx.moveTo(0, HDR_H + 0.5); ctx.lineTo(w, HDR_H + 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ROW_NUM_W + 0.5, 0); ctx.lineTo(ROW_NUM_W + 0.5, h); ctx.stroke();
    ctx.restore();

    if (this.player) {
      const c  = Math.max(1, Math.floor((this.player.x - ROW_NUM_W) / COL_W) + 1);
      const r  = Math.max(1, Math.floor((this.player.y - HDR_H) / ROW_H) + 1);
      const nb = document.getElementById('excel-namebox');
      if (nb) nb.textContent = this._colLabel(c) + r;
    }
  }

  // ── Rendering ──────────────────────────────────

  _draw(ts) {
    const ctx = this.ctx;

    this._drawExcelBackground();

    if (this.state === STATE.PLAYING || this.state === STATE.GAMEOVER || this.state === STATE.LEVELUP) {
      this.bullets?.draw(ctx);
      this.enemies?.draw(ctx, ts);
      this.items?.draw(ctx, ts);
      this.particles.draw(ctx);
      if (this.state !== STATE.GAMEOVER) {
        this.weapons?.draw(ctx, this.player?.x ?? 0, this.player?.y ?? 0);
        this.player?.draw(ctx);
      }
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
