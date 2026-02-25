export class Player {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.radius = 7;          // actual hitbox
    this.displayRadius = 14; // visual size

    this.lives = 3;
    this.maxLives = 3;

    this.invincible = false;
    this.invincibleTime = 0;
    this.invincibleDuration = 2000;

    this.shield = false;
    this.shieldTime = 0;
    this.shieldDuration = 5000;

    this.slow = false;
    this.slowTime = 0;
    this.slowDuration = 5000;

    this.trail = [];
  }

  update(mouseX, mouseY, deltaTime) {
    // Smooth follow
    const lerp = Math.min(1, 0.18 * (deltaTime / 16));
    this.x += (mouseX - this.x) * lerp;
    this.y += (mouseY - this.y) * lerp;

    // Trail
    this.trail.push({ x: this.x, y: this.y, alpha: 0.6 });
    if (this.trail.length > 12) this.trail.shift();
    this.trail.forEach(t => { t.alpha -= 0.055; });

    if (this.invincible) {
      this.invincibleTime -= deltaTime;
      if (this.invincibleTime <= 0) this.invincible = false;
    }
    if (this.shield) {
      this.shieldTime -= deltaTime;
      if (this.shieldTime <= 0) this.shield = false;
    }
    if (this.slow) {
      this.slowTime -= deltaTime;
      if (this.slowTime <= 0) this.slow = false;
    }
  }

  draw(ctx) {
    // Trail
    this.trail.forEach((t, i) => {
      const ratio = i / this.trail.length;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.displayRadius * ratio * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 200, 255, ${Math.max(0, t.alpha * ratio)})`;
      ctx.fill();
    });

    // Shield ring
    if (this.shield) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.displayRadius + 14, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 255, 200, ${0.4 + pulse * 0.5})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Blink during invincibility
    if (this.invincible && Math.floor(Date.now() / 90) % 2 === 0) return;

    // Glow
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.displayRadius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, '#64c8ff');
    grad.addColorStop(1, 'rgba(100, 200, 255, 0)');

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.displayRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  // Returns true if a life was lost
  hit() {
    if (this.invincible) return false;
    if (this.shield) {
      this.shield = false;
      this.invincible = true;
      this.invincibleTime = 1000;
      return false;
    }
    this.lives--;
    this.invincible = true;
    this.invincibleTime = this.invincibleDuration;
    return true;
  }

  activateShield() {
    this.shield = true;
    this.shieldTime = this.shieldDuration;
  }

  activateSlow() {
    this.slow = true;
    this.slowTime = this.slowDuration;
  }
}
