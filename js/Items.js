const ITEM_DEFS = {
  shield: { color: '#00ffcc', glow: 'rgba(0,255,200,0.25)', label: '🛡', desc: '방어막' },
  slow:   { color: '#aaaaff', glow: 'rgba(100,100,255,0.25)', label: '⏱', desc: '슬로우' },
  bomb:   { color: '#ffaa00', glow: 'rgba(255,160,0,0.25)',   label: '💥', desc: '폭탄' },
  life:   { color: '#ff5577', glow: 'rgba(255,50,80,0.25)',   label: '❤',  desc: '목숨' },
};

// Weighted pool
const ITEM_POOL = [
  'shield', 'shield', 'shield',
  'slow',   'slow',   'slow',
  'bomb',   'bomb',
  'life',
];

export class Item {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = 18;
    this.bobBase = Math.random() * Math.PI * 2;

    const def = ITEM_DEFS[type];
    this.color = def.color;
    this.glow = def.glow;
    this.label = def.label;
  }

  draw(ctx, time) {
    const bobY = Math.sin(time * 0.003 + this.bobBase) * 5;
    const ry = this.y + bobY;

    // Outer glow
    ctx.beginPath();
    ctx.arc(this.x, ry, this.radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = this.glow;
    ctx.fill();

    // Background circle
    ctx.beginPath();
    ctx.arc(this.x, ry, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Emoji icon
    ctx.font = `${this.radius * 1.1}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, this.x, ry);
  }

  collidesWith(player) {
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    return Math.sqrt(dx * dx + dy * dy) < this.radius + player.radius;
  }
}

export class ItemSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.items = [];
    this.timer = 0;
    this.interval = 8000; // ms between spawns
  }

  update(deltaTime, time) {
    this.timer += deltaTime;
    if (this.timer >= this.interval) {
      this.timer = 0;
      this._spawn();
    }
  }

  checkCollisions(player) {
    const collected = [];
    this.items = this.items.filter(item => {
      if (item.collidesWith(player)) {
        collected.push(item);
        return false;
      }
      return true;
    });
    return collected;
  }

  draw(ctx, time) {
    this.items.forEach(item => item.draw(ctx, time));
  }

  clear() {
    this.items = [];
  }

  _spawn() {
    const m = 60;
    const x = m + Math.random() * (this.canvas.width - m * 2);
    const y = m + Math.random() * (this.canvas.height - m * 2);
    const type = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
    this.items.push(new Item(x, y, type));
  }
}
