export class Bullet {
  constructor(x, y, vx, vy, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = opts.radius ?? 6;
    this.color = opts.color ?? '#ff4444';
    this.active = true;
  }

  update(deltaTime, slowFactor = 1) {
    const dt = (deltaTime / 16) * slowFactor;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    // Soft glow
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2.5);
    grad.addColorStop(0, this.color);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
  }

  isOutOfBounds(w, h, m = 60) {
    return this.x < -m || this.x > w + m || this.y < -m || this.y > h + m;
  }

  collidesWith(player) {
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    return Math.sqrt(dx * dx + dy * dy) < this.radius + player.radius;
  }
}

// ────────────────────────────────────────────
//  Pattern spawners
// ────────────────────────────────────────────
export class BulletSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.bullets = [];
    this.elapsed = 0; // ms since game start, used for spiral angle
  }

  // Called every frame
  update(deltaTime, playerX, playerY, slowFactor = 1) {
    this.elapsed += deltaTime;
    this.bullets = this.bullets.filter(b => {
      b.update(deltaTime, slowFactor);
      return !b.isOutOfBounds(this.canvas.width, this.canvas.height);
    });
  }

  draw(ctx) {
    this.bullets.forEach(b => b.draw(ctx));
  }

  // Spawn a named pattern aimed roughly at (px, py) with given speed
  spawnPattern(name, px, py, speed) {
    switch (name) {
      case 'rain':          this._rain(speed); break;
      case 'burst':         this._burst(speed); break;
      case 'spiral':        this._spiral(speed); break;
      case 'aimed':         this._aimed(px, py, speed); break;
      case 'cross':         this._cross(speed); break;
      case 'wall':          this._wall(px, speed); break;
      case 'ring':          this._ring(px, py, speed); break;
    }
  }

  checkCollisions(player) {
    return this.bullets.some(b => b.collidesWith(player));
  }

  removeBulletsHittingPlayer(player) {
    this.bullets = this.bullets.filter(b => !b.collidesWith(player));
  }

  clearAll() {
    this.bullets = [];
  }

  // ── Individual patterns ──────────────────

  _rain(speed) {
    const x = Math.random() * this.canvas.width;
    this.bullets.push(new Bullet(x, -10, (Math.random() - 0.5) * 1.5, speed, {
      color: '#ff6644',
    }));
  }

  _burst(speed) {
    const cx = 80 + Math.random() * (this.canvas.width - 160);
    const cy = 80 + Math.random() * (this.canvas.height - 160);
    const count = 12;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.bullets.push(new Bullet(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, {
        color: '#ff44aa', radius: 6,
      }));
    }
  }

  _spiral(speed) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const angle = this.elapsed * 0.004;
    const arms = 4;
    for (let i = 0; i < arms; i++) {
      const a = angle + (i / arms) * Math.PI * 2;
      this.bullets.push(new Bullet(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, {
        color: '#aa44ff', radius: 5,
      }));
    }
  }

  _aimed(px, py, speed) {
    const { x, y } = this._edgePoint();
    const dx = px - x, dy = py - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.bullets.push(new Bullet(x, y, (dx / dist) * speed, (dy / dist) * speed, {
      color: '#ffbb00', radius: 7,
    }));
  }

  _cross(speed) {
    const cx = 80 + Math.random() * (this.canvas.width - 160);
    const cy = 80 + Math.random() * (this.canvas.height - 160);
    const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5,
                    Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4];
    angles.forEach(a => {
      this.bullets.push(new Bullet(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, {
        color: '#44ffaa', radius: 5,
      }));
    });
  }

  _wall(px, speed) {
    const gapCenter = px;
    const gapSize = 110;
    const spacing = 32;
    for (let x = 0; x <= this.canvas.width; x += spacing) {
      if (Math.abs(x - gapCenter) > gapSize / 2) {
        this.bullets.push(new Bullet(x, -10, 0, speed, {
          color: '#ff2222', radius: 8,
        }));
      }
    }
  }

  _ring(px, py, speed) {
    // Ring that expands outward from player position
    const count = 16;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.bullets.push(new Bullet(px, py, Math.cos(a) * speed, Math.sin(a) * speed, {
        color: '#ff8800', radius: 6,
      }));
    }
  }

  _edgePoint() {
    const side = Math.floor(Math.random() * 4);
    const w = this.canvas.width, h = this.canvas.height;
    switch (side) {
      case 0: return { x: Math.random() * w, y: -10 };
      case 1: return { x: w + 10,            y: Math.random() * h };
      case 2: return { x: Math.random() * w, y: h + 10 };
      default: return { x: -10,              y: Math.random() * h };
    }
  }
}
