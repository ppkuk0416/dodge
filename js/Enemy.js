export class XpGem {
  constructor(x, y, value) {
    this.x        = x;
    this.y        = y;
    this.value    = value;
    this.radius   = 8;
    this.bobBase  = Math.random() * Math.PI * 2;
  }

  draw(ctx, time) {
    const bob = Math.sin(time * 0.004 + this.bobBase) * 3;
    const ry  = this.y + bob;
    // Glow
    ctx.beginPath();
    ctx.arc(this.x, ry, this.radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 220, 0, 0.18)';
    ctx.fill();
    // Body
    ctx.beginPath();
    ctx.arc(this.x, ry, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffee44';
    ctx.fill();
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Label
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#553300';
    ctx.fillText('XP', this.x, ry);
  }

  collidesWith(player) {
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    return Math.sqrt(dx * dx + dy * dy) < this.radius + player.radius + 18;
  }
}

export class Enemy {
  constructor(x, y, opts = {}) {
    this.x        = x;
    this.y        = y;
    this.hp       = opts.hp       ?? 1;
    this.maxHp    = this.hp;
    this.speed    = opts.speed    ?? 55;
    this.radius   = opts.radius   ?? 13;
    this.color    = opts.color    ?? '#ff6600';
    this.xpValue  = opts.xpValue  ?? 15;
    this.active   = true;
    this.flashTimer  = 0;
    this.frozen      = false;
    this.frozenTimer = 0;
  }

  update(dt, px, py) {
    if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - dt);
    if (this.frozen) {
      this.frozenTimer -= dt;
      if (this.frozenTimer <= 0) { this.frozen = false; this.frozenTimer = 0; }
    }
    const dx   = px - this.x, dy = py - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd  = this.frozen ? this.speed * 0.2 : this.speed;
    this.x += (dx / dist) * spd * dt / 1000;
    this.y += (dy / dist) * spd * dt / 1000;
  }

  hit(damage = 1) {
    this.hp -= damage;
    this.flashTimer = 160;
    if (this.hp <= 0) this.active = false;
  }

  freeze(duration) {
    this.frozen      = true;
    this.frozenTimer = Math.max(this.frozenTimer, duration);
  }

  draw(ctx) {
    const fl = this.flashTimer > 0;
    // HP bar (multi-HP enemies only)
    if (this.maxHp > 1) {
      const bw = this.radius * 2.4;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(this.x - bw / 2, this.y - this.radius - 9, bw, 4);
      ctx.fillStyle = '#55ff55';
      ctx.fillRect(this.x - bw / 2, this.y - this.radius - 9, bw * Math.max(0, this.hp / this.maxHp), 4);
    }
    // Body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = fl ? '#ffffff' : (this.frozen ? '#88ccff' : this.color);
    ctx.fill();
    ctx.strokeStyle = fl ? '#ffff00' : (this.frozen ? '#4488ff' : '#000000');
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Freeze aura
    if (this.frozen) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,200,255,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  collidesWith(player) {
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    return Math.sqrt(dx * dx + dy * dy) < this.radius + player.radius;
  }
}

export class EnemySystem {
  constructor(canvas) {
    this.canvas        = canvas;
    this.enemies       = [];
    this.gems          = [];
    this.spawnTimer    = 0;
    this.spawnInterval = 2000;
  }

  update(dt, difficulty, px, py) {
    this.spawnInterval = Math.max(600, 2000 - difficulty * 110);
    this.spawnTimer   += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer -= this.spawnInterval;
      this._spawn(difficulty);
    }
    this.enemies.forEach(e => e.update(dt, px, py));
    this.enemies = this.enemies.filter(e => e.active);
  }

  collectGems(player) {
    let xp = 0;
    this.gems = this.gems.filter(g => {
      if (g.collidesWith(player)) { xp += g.value; return false; }
      return true;
    });
    return xp;
  }

  dropGem(enemy) {
    this.gems.push(new XpGem(enemy.x, enemy.y, enemy.xpValue));
  }

  draw(ctx, time) {
    this.gems.forEach(g => g.draw(ctx, time));
    this.enemies.forEach(e => e.draw(ctx));
  }

  killAll() {
    for (const e of this.enemies) {
      this.dropGem(e);
    }
    this.enemies = [];
  }

  clear() {
    this.enemies = [];
    this.gems    = [];
  }

  _spawn(difficulty) {
    const { x, y } = this._edgePoint();
    let hp;
    if (difficulty < 2)      hp = 1;
    else if (difficulty < 5) hp = Math.random() < 0.25 ? 2 : 1;
    else                     hp = Math.random() < 0.15 ? 3 : Math.random() < 0.45 ? 2 : 1;
    const speed   = 48 + difficulty * 8;
    const color   = hp === 1 ? '#ff6600' : hp === 2 ? '#cc2200' : '#990000';
    const xpValue = hp * 15;
    this.enemies.push(new Enemy(x, y, { hp, speed, color, xpValue }));
  }

  _edgePoint() {
    const side = Math.floor(Math.random() * 4);
    const w = this.canvas.width, h = this.canvas.height;
    switch (side) {
      case 0: return { x: Math.random() * w, y: -20 };
      case 1: return { x: w + 20,            y: Math.random() * h };
      case 2: return { x: Math.random() * w, y: h + 20 };
      default: return { x: -20,              y: Math.random() * h };
    }
  }
}
