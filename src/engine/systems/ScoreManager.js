// Scoring, rating and debrief suggestions.
import { EVAC_TIME } from './EmergencyManager.js';

export function computeResults(s) {
  const success = s.outcome === 'evacuated';
  const breakdown = [];
  const add = (label, pts) => { if (pts) breakdown.push({ label, pts: Math.round(pts) }); };

  if (success) {
    add('Safe evacuation', 1000);
    if (s.alarmTime != null) add('Time remaining on evacuation clock', Math.max(0, s.countdown) * 3);
    else add('Evacuated before the alarm sounded', 300);
    add('Health remaining', s.health * 4);
  }
  if (s.alarmSource === 'player') add('Raised the alarm yourself', 250 + Math.max(0, 30 - s.alarmDelay) * 5);
  add('Fires extinguished', s.firesExtinguished * 175);
  if (s.extinguisherUsed > 0) add('Extinguisher accuracy', s.accuracy * 150);
  if (s.doorsClosed > 0) add('Closed doors to contain fire/smoke', Math.min(3, s.doorsClosed) * 40);
  add('Fire exposure penalty', -s.exposure * 6);
  if (!success) add('Did not reach safety', -200);

  let score = Math.max(0, breakdown.reduce((a, b) => a + b.pts, 0));
  score = Math.round(score);
  let rating;
  if (!success) rating = score >= 500 ? 'D' : 'F';
  else rating = score >= 2300 ? 'S' : score >= 1950 ? 'A' : score >= 1650 ? 'B' : score >= 1350 ? 'C' : 'D';
  const label = { S: 'Outstanding', A: 'Excellent', B: 'Good', C: 'Satisfactory', D: 'Needs improvement', F: 'Unsafe' }[rating];

  const tips = [];
  if (s.alarmSource !== 'player') tips.push('Raise the alarm immediately using the nearest red Manual Call Point — every second of warning matters to everyone in the building.');
  else if (s.alarmDelay > 15) tips.push(`You took ${Math.round(s.alarmDelay)} s to raise the alarm. Learn where the call points are on your floor in advance.`);
  if (s.reason === 'health') tips.push('You were overcome by heat and smoke. Never let a fire come between you and your exit, and do not linger in smoke.');
  if (s.reason === 'time') tips.push('The building became untenable before you got out. If a fire is not out within seconds, stop fighting it and evacuate.');
  if (s.exposure > 15) tips.push('You took significant fire exposure. Keep at least 2 m from flames and crouch (C) beneath the smoke layer.');
  if (s.smokeTime > 10 && !s.crouchedInSmoke) tips.push('Smoke rises: crouching keeps your head in cleaner, cooler air.');
  if (s.extinguisherUsed > 0 && s.accuracy < 0.5) tips.push('Use the P.A.S.S. technique: Pull the pin, Aim at the BASE of the fire, Squeeze the handle, Sweep side to side.');
  if (s.extinguisherUsed === 0 && s.firesExtinguished === 0 && s.peakFires <= 2) tips.push('The fire was small for a while — a trained person with a clear escape route may tackle it with an extinguisher.');
  if (s.extinguisherUsed > 90 && s.firesExtinguished === 0) tips.push('You emptied an extinguisher without putting the fire out. If one extinguisher does not work, evacuate.');
  if (s.doorsClosed === 0) tips.push('Close doors behind you as you leave — a closed door slows the spread of fire and smoke dramatically.');
  if (success && s.evacTime > 90) tips.push('Your evacuation took a while. Follow the green EXIT signs and floor guidance by the most direct safe route.');
  if (success && !tips.length) tips.push('Textbook response. Keep refreshing your training and walk your escape routes regularly.');

  return {
    success, score, rating, label, breakdown, tips: tips.slice(0, 5),
    stats: {
      evacTime: s.evacTime, firesExtinguished: s.firesExtinguished, totalFires: s.totalFires, peakFires: s.peakFires,
      exposure: s.exposure, health: s.health, extinguisherUsed: s.extinguisherUsed, accuracy: s.accuracy,
      alarmSource: s.alarmSource, alarmDelay: s.alarmDelay, exitId: s.exitId, scenario: s.scenarioName, reason: s.reason,
      distance: s.distance, maxEvac: EVAC_TIME,
    },
    timeline: s.timeline || [],
  };
}
