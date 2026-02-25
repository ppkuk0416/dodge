// ── Weapon definitions (8 types, 3 levels each) ───────────────────────────
export const WEAPON_DEFS = [
  {
    id: 'basic', icon: '🔵', name: '기본탄',
    descs: ['가장 가까운 적에게 단발 발사', '2발 연사, 발사속도 증가', '3발 연사 + 관통'],
  },
  {
    id: 'spread', icon: '🔴', name: '확산탄',
    descs: ['전방 3방향 산탄 발사', '5방향으로 확산', '7방향 + 데미지 UP'],
  },
  {
    id: 'orbit', icon: '🌀', name: '회전탄',
    descs: ['주변 2개 궤도 공격', '궤도 3개 + 속도 UP', '궤도 4개 + 범위 UP'],
  },
  {
    id: 'burst', icon: '💥', name: '폭발탄',
    descs: ['폭발 범위 공격', '폭발 범위 확대', '연속 2발 발사'],
  },
  {
    id: 'pierce', icon: '🟡', name: '관통탄',
    descs: ['2마리 관통 발사', '4마리 관통 + 속도 UP', '6마리 관통 + 데미지 UP'],
  },
  {
    id: 'blade', icon: '⚔️', name: '회전검',
    descs: ['근접 회전 칼날 1개', '칼날 2개 + 속도 UP', '칼날 3개 + 범위 UP'],
  },
  {
    id: 'frost', icon: '❄️', name: '냉각탄',
    descs: ['적 빙결 1초', '2발 + 빙결 2초', '3발 + 빙결 3초'],
  },
  {
    id: 'lightning', icon: '⚡', name: '번개',
    descs: ['가장 가까운 적에게 번개', '체인 번개 2마리', '체인 3마리 + 데미지 UP'],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function nearest(enemies, px, py, count = 1) {
  return [...enemies]
    .filter(e => e.active)
    .sort((a, b) => (a.x - px) ** 2 + (a.y - py) ** 2 - ((b.x - px) ** 2 + (b.y - py) ** 2))
    .slice(0, count);
}

// ── Projectile ─────────────────────────────────────────────────────────────
class Projectile {
  constructor(x, y, vx, vy, opts = {}) {
    this.x      = x;
    this.y      = y;
    this.vx     = vx;
    this.vy     = vy;
    this.radius = opts.radius ?? 6;
    this.color  = opts.color  ?? '#64ffaa';
    this.damage = opts.damage ?? 1;
    this.pierce = opts.pierce ?? 0;
    this.aoe    = opts.aoe    ?? 0;
    this.freeze = opts.freeze ?? 0;
    this.active = true;
  }

  update(dt, w, h) {
    this.x += this.vx * (dt / 16);
    this.y += this.vy * (dt / 16);
    if (this.x < -60 || this.x > w + 60 || this.y < -60 || this.y > h + 60)
      this.active = false;
  }

  draw(ctx) {
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2.4);
    g.addColorStop(0, this.color);
    g.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

// ── WeaponSystem ───────────────────────────────────────────────────────────
export class WeaponSystem {
  constructor(canvas) {
    this.canvas     = canvas;
    this.weapons    = {};   // id -> level (1-3)
    this.projectiles    = [];
    this.fireTimers     = {};
    this.orbitAngle     = 0;
    this.bladeAngle     = 0;
    this.lightningFlashes = [];
    this._orbitHitMap = new Map();
    this._bladeHitMap = new Map();
  }

  hasWeapon(id) { return (this.weapons[id] ?? 0) > 0; }
  getLevel(id)  { return this.weapons[id] ?? 0; }

  upgrade(id) {
    this.weapons[id] = Math.min(3, (this.weapons[id] ?? 0) + 1);
    if (this.fireTimers[id] === undefined) this.fireTimers[id] = 0;
  }

  availableUpgrades() {
    return WEAPON_DEFS.filter(w => (this.weapons[w.id] ?? 0) < 3);
  }

  // Returns [{enemy, damage, freeze, aoeRadius, x, y}]
  update(dt, px, py, enemies) {
    this.orbitAngle += dt * 0.003;
    this.bladeAngle += dt * 0.006;
    const hits = [];
    const now  = Date.now();

    // Move projectiles and check collisions with enemies
    this.projectiles.forEach(p => p.update(dt, this.canvas.width, this.canvas.height));
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const dx = proj.x - enemy.x, dy = proj.y - enemy.y;
        if (Math.sqrt(dx * dx + dy * dy) < proj.radius + enemy.radius) {
          hits.push({ enemy, damage: proj.damage, freeze: proj.freeze, aoeRadius: proj.aoe, x: proj.x, y: proj.y });
          if (proj.pierce > 0) { proj.pierce--; }
          else { proj.active = false; break; }
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.active);

    // Fire timed weapons
    for (const [id, level] of Object.entries(this.weapons)) {
      if (id === 'orbit' || id === 'blade') continue;
      this.fireTimers[id] = (this.fireTimers[id] ?? 0) + dt;
      const cd = this._cooldown(id, level);
      if (this.fireTimers[id] >= cd) {
        this.fireTimers[id] = 0;
        const tgts = nearest(enemies, px, py, id === 'lightning' ? level : 1);
        if (tgts.length > 0) this._fire(id, level, px, py, tgts[0], enemies, hits);
      }
    }

    // Orbit: continuous collision with cooldown per enemy
    if (this.hasWeapon('orbit')) {
      const orbs = this._orbitPositions(this.getLevel('orbit'), px, py);
      for (const orb of orbs) {
        for (const enemy of enemies) {
          if (!enemy.active) continue;
          const dx = orb.x - enemy.x, dy = orb.y - enemy.y;
          if (Math.sqrt(dx * dx + dy * dy) < 15 + enemy.radius) {
            const last = this._orbitHitMap.get(enemy) ?? 0;
            if (now - last > 480) {
              this._orbitHitMap.set(enemy, now);
              hits.push({ enemy, damage: 1, freeze: 0, aoeRadius: 0, x: orb.x, y: orb.y });
            }
          }
        }
      }
    }

    // Blade: continuous melee collision with cooldown per enemy
    if (this.hasWeapon('blade')) {
      const blades = this._bladePositions(this.getLevel('blade'), px, py);
      for (const blade of blades) {
        for (const enemy of enemies) {
          if (!enemy.active) continue;
          const dx = blade.x - enemy.x, dy = blade.y - enemy.y;
          if (Math.sqrt(dx * dx + dy * dy) < 20 + enemy.radius) {
            const last = this._bladeHitMap.get(enemy) ?? 0;
            if (now - last > 380) {
              this._bladeHitMap.set(enemy, now);
              hits.push({ enemy, damage: 1, freeze: 0, aoeRadius: 0, x: blade.x, y: blade.y });
            }
          }
        }
      }
    }

    // Fade lightning flashes
    this.lightningFlashes = this.lightningFlashes.filter(f => { f.alpha -= dt * 0.005; return f.alpha > 0; });

    return hits;
  }

  _cooldown(id, level) {
    const base = { basic: 780, spread: 1300, burst: 2200, pierce: 920, frost: 1100, lightning: 1350 };
    return (base[id] ?? 1000) * [1, 0.78, 0.62][level - 1];
  }

  _fire(id, level, px, py, target, allEnemies, hits) {
    const SPD = 9;
    let dx = 0, dy = 1;
    if (target) {
      const dist = Math.sqrt((target.x - px) ** 2 + (target.y - py) ** 2) || 1;
      dx = (target.x - px) / dist;
      dy = (target.y - py) / dist;
    }

    switch (id) {
      case 'basic': {
        const count = level, spreadAmt = 0.12;
        for (let i = 0; i < count; i++) {
          const a = Math.atan2(dy, dx) + (i - (count - 1) / 2) * spreadAmt;
          this.projectiles.push(new Projectile(px, py, Math.cos(a) * SPD, Math.sin(a) * SPD, {
            color: '#44ffaa', radius: 6, damage: 1, pierce: level === 3 ? 1 : 0,
          }));
        }
        break;
      }
      case 'spread': {
        const count = 3 + (level - 1) * 2;
        const arc   = 0.72;
        const base  = Math.atan2(dy, dx);
        for (let i = 0; i < count; i++) {
          const a = base + (i / (count - 1) - 0.5) * arc;
          this.projectiles.push(new Projectile(px, py, Math.cos(a) * SPD, Math.sin(a) * SPD, {
            color: '#ff9944', radius: 5, damage: level === 3 ? 2 : 1,
          }));
        }
        break;
      }
      case 'burst': {
        const aoe   = 40 + level * 22;
        const shots = level === 3 ? 2 : 1;
        for (let i = 0; i < shots; i++) {
          const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.12 * i;
          this.projectiles.push(new Projectile(px, py, Math.cos(a) * SPD * 0.6, Math.sin(a) * SPD * 0.6, {
            color: '#ff5500', radius: 10, damage: 1, aoe,
          }));
        }
        break;
      }
      case 'pierce': {
        const spd = SPD * (1 + level * 0.22);
        this.projectiles.push(new Projectile(px, py, dx * spd, dy * spd, {
          color: '#ffee44', radius: 5, damage: level === 3 ? 2 : 1, pierce: level * 2,
        }));
        break;
      }
      case 'frost': {
        for (let i = 0; i < level; i++) {
          const a = Math.atan2(dy, dx) + (i - (level - 1) / 2) * 0.18;
          this.projectiles.push(new Projectile(px, py, Math.cos(a) * SPD * 0.85, Math.sin(a) * SPD * 0.85, {
            color: '#aaddff', radius: 7, damage: 1, freeze: 1000 * level,
          }));
        }
        break;
      }
      case 'lightning': {
        const targets = nearest(allEnemies, px, py, level);
        for (const t of targets) {
          hits.push({ enemy: t, damage: level === 3 ? 3 : 2, freeze: 0, aoeRadius: 0, x: t.x, y: t.y });
          this.lightningFlashes.push({ x1: px, y1: py, x2: t.x, y2: t.y, alpha: 1 });
        }
        break;
      }
    }
  }

  _orbitPositions(level, px, py) {
    const count = level + 1, radius = 55 + level * 4;
    return Array.from({ length: count }, (_, i) => {
      const a = this.orbitAngle + (i / count) * Math.PI * 2;
      return { x: px + Math.cos(a) * radius, y: py + Math.sin(a) * radius };
    });
  }

  _bladePositions(level, px, py) {
    const count = level, radius = 38 + level * 4;
    return Array.from({ length: count }, (_, i) => {
      const a = this.bladeAngle + (i / count) * Math.PI * 2;
      return { x: px + Math.cos(a) * radius, y: py + Math.sin(a) * radius };
    });
  }

  draw(ctx, px, py) {
    // Player projectiles
    this.projectiles.forEach(p => p.draw(ctx));

    // Orbit orbs
    if (this.hasWeapon('orbit')) {
      this._orbitPositions(this.getLevel('orbit'), px, py).forEach(orb => {
        const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, 14);
        g.addColorStop(0, '#cc88ff');
        g.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#bb44ff';
        ctx.fill();
      });
    }

    // Spinning blades
    if (this.hasWeapon('blade')) {
      this._bladePositions(this.getLevel('blade'), px, py).forEach(b => {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(this.bladeAngle * 2.5);
        ctx.fillStyle = '#88ffee';
        ctx.strokeStyle = '#44ccaa';
        ctx.lineWidth = 1;
        ctx.fillRect(-12, -3, 24, 6);
        ctx.strokeRect(-12, -3, 24, 6);
        ctx.restore();
      });
    }

    // Lightning flashes
    this.lightningFlashes.forEach(f => {
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.strokeStyle = '#cceeFF';
      ctx.lineWidth   = 3 * f.alpha;
      ctx.stroke();
      ctx.restore();
    });
  }
}
