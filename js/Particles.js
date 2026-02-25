class Particle {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const spd = opts.speed ?? (Math.random() * 5 + 2);
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd;
    this.radius = opts.radius ?? (Math.random() * 4 + 1.5);
    this.color = opts.color ?? '#ffffff';
    this.alpha = 1;
    this.decay = opts.decay ?? (Math.random() * 0.025 + 0.018);
    this.gravity = opts.gravity ?? 0.08;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.97;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }

  isDead() { return this.alpha <= 0; }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, opts));
    }
  }

  emitHit(x, y) {
    this.emit(x, y, 14, {
      speed: Math.random() * 4 + 2,
      color: `hsl(${Math.random() * 40}, 100%, 60%)`,
      decay: 0.04,
      radius: Math.random() * 3 + 1,
    });
  }

  emitShieldBlock(x, y) {
    this.emit(x, y, 18, {
      speed: Math.random() * 5 + 3,
      color: '#00ffcc',
      decay: 0.035,
      gravity: -0.05,
    });
  }

  emitDeath(x, y) {
    this.emit(x, y, 45, {
      speed: Math.random() * 8 + 3,
      color: '#64c8ff',
      decay: 0.018,
      radius: Math.random() * 5 + 2,
    });
    this.emit(x, y, 25, {
      speed: Math.random() * 6 + 2,
      color: '#ffffff',
      decay: 0.022,
    });
  }

  emitItemPickup(x, y, color) {
    this.emit(x, y, 22, {
      speed: Math.random() * 5 + 2,
      color,
      decay: 0.025,
      gravity: -0.06,
    });
  }

  emitBomb(cx, cy) {
    // Big explosion across the whole screen area
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2;
      const r = Math.random() * 200;
      this.emit(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 1, {
        speed: Math.random() * 7 + 3,
        color: `hsl(${Math.random() * 60 + 10}, 100%, 60%)`,
        decay: 0.018,
        radius: Math.random() * 4 + 1,
      });
    }
  }

  update() {
    this.particles = this.particles.filter(p => { p.update(); return !p.isDead(); });
  }

  draw(ctx) {
    this.particles.forEach(p => p.draw(ctx));
  }
}
