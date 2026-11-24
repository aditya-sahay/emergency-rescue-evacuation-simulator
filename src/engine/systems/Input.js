// Keyboard / mouse / Pointer Lock input.
export class Input {
  constructor(element) {
    this.el = element;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered this frame
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.firing = false;
    this.locked = false;
    this.enabled = false;
    this.onLockChange = null;

    this.onEscape = null;
    this._kd = (e) => {
      if (!this.enabled) return;
      if (e.code === 'Escape') { this.onEscape?.(); return; }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._ku = (e) => this.keys.delete(e.code);
    this._mm = (e) => {
      if (!this.locked) return;
      const dx = e.movementX || 0, dy = e.movementY || 0;
      // Chrome occasionally reports a huge spurious movement right after locking / on some
      // mice; ignoring implausible single-event jumps prevents the camera from snapping.
      if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;
      this.mouseDX += dx;
      this.mouseDY += dy;
    };
    this._md = (e) => { if (e.button === 0 && this.locked) this.firing = true; };
    this._mu = (e) => { if (e.button === 0) this.firing = false; };
    this._plc = () => {
      this.locked = document.pointerLockElement === this.el;
      if (!this.locked) { this.firing = false; this.keys.clear(); }
      this.onLockChange?.(this.locked);
    };
    this._blur = () => { this.keys.clear(); this.firing = false; };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    document.addEventListener('mousemove', this._mm);
    document.addEventListener('mousedown', this._md);
    document.addEventListener('mouseup', this._mu);
    document.addEventListener('pointerlockchange', this._plc);
    window.addEventListener('blur', this._blur);
  }

  requestLock() {
    try {
      const p = this.el.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch { /* browser refused (e.g. too soon after exiting) — UI shows click-to-resume */ }
  }

  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  // Drop any held/edge-triggered state (used when resuming so paused key presses don't leak in).
  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.mouseDX = this.mouseDY = 0;
    this.firing = false;
  }

  consumeMouse() {
    const d = [this.mouseDX, this.mouseDY];
    this.mouseDX = this.mouseDY = 0;
    return d;
  }

  endFrame() { this.pressed.clear(); }

  dispose() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    document.removeEventListener('mousemove', this._mm);
    document.removeEventListener('mousedown', this._md);
    document.removeEventListener('mouseup', this._mu);
    document.removeEventListener('pointerlockchange', this._plc);
    window.removeEventListener('blur', this._blur);
  }
}
