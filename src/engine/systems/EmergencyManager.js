// Emergency event manager: owns the simulation state machine, timers, alarm and objectives.
//   normal → fire (ignition, alarm not yet raised) → alarm (evacuation countdown) → ended (evacuated | failed)

export const EVAC_TIME = 180;        // seconds from alarm until the building is untenable
const IGNITION_DELAY = 4;            // seconds after the session starts
const DETECTOR_DELAY = 30;           // automatic smoke-detector activation if nobody raises the alarm

export class EmergencyManager {
  constructor() { this.reset(null); }

  reset(scenario) {
    this.scenario = scenario;
    this.state = 'normal';
    this.time = 0;
    this.ignitionTime = null;
    this.alarmTime = null;
    this.alarmSource = null;
    this.outcome = null;
    this.failReason = null;
    this.evacuatedAt = null;
  }

  get countdown() {
    if (this.alarmTime == null) return null;
    return Math.max(0, EVAC_TIME - (this.time - this.alarmTime));
  }

  get alarmActive() { return this.state === 'alarm' || (this.state === 'ended' && this.alarmTime != null); }

  // Returns a list of events for the engine to react to.
  update(dt, ctx) {
    const ev = [];
    if (this.state === 'ended') return ev;
    this.time += dt;
    if (this.state === 'normal' && this.time >= IGNITION_DELAY) {
      this.state = 'fire';
      this.ignitionTime = this.time;
      ev.push({ type: 'ignite' });
    }
    if (this.state === 'fire' && this.time - this.ignitionTime >= DETECTOR_DELAY) {
      ev.push(...this.triggerAlarm('detector'));
    }
    if (this.state === 'alarm' && this.countdown <= 0) {
      ev.push(...this.end('failed', 'time'));
    }
    if (ctx.health <= 0 && this.state !== 'ended') ev.push(...this.end('failed', 'health'));
    if (ctx.safe && this.state !== 'ended' && this.state !== 'normal') ev.push(...this.end('evacuated'));
    return ev;
  }

  triggerAlarm(source) {
    if (this.alarmTime != null || this.state === 'ended') return [];
    this.alarmTime = this.time;
    this.alarmSource = source;
    if (this.state !== 'ended') this.state = 'alarm';
    return [{ type: 'alarm', source }];
  }

  end(outcome, reason = null) {
    this.state = 'ended';
    this.outcome = outcome;
    this.failReason = reason;
    this.evacuatedAt = this.time;
    return [{ type: 'end', outcome, reason }];
  }

  objective({ holding, capacity, activeFires, maxIntensity, nearestFireDist, headInSmoke, outside }) {
    if (outside && this.state !== 'ended') {
      return { title: 'Go to the assembly point', text: "You're out — move away from the building and gather at the green assembly point so you can be accounted for." };
    }
    switch (this.state) {
      case 'normal':
        return { title: 'Start of shift', text: 'A normal working day. Get your bearings — note the red fire equipment and green EXIT signs.' };
      case 'fire':
        return { title: 'Raise the alarm', text: 'You smell smoke! Find a red Manual Call Point and press E to raise the fire alarm.' };
      case 'alarm': {
        if (headInSmoke) return { title: 'Stay low', text: 'Heavy smoke at head height — press C to crouch and keep moving toward the exit.' };
        const small = activeFires > 0 && activeFires <= 2 && maxIntensity < 0.55;
        if (holding && capacity > 0 && small && nearestFireDist < 8) {
          return { title: 'Tackle the fire — safely', text: 'Aim at the BASE of the flames from 2–5 m and hold the left mouse button. Keep your exit behind you.' };
        }
        if (!holding && small) {
          return { title: 'Fight or flight', text: 'The fire is still small: grab a nearby extinguisher (E) — or evacuate now by following the green arrows.' };
        }
        return { title: 'EVACUATE', text: 'Follow the green floor arrows to the safest exit and reach the assembly point outside.' };
      }
      default:
        return { title: 'Simulation complete', text: '' };
    }
  }
}
