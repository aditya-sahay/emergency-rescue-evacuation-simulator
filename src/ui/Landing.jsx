import React, { useState } from 'react';
import { SCENARIOS } from '../engine/environment/layout.js';

export default function Landing({ best, onStart, onPanel }) {
  const [scenario, setScenario] = useState('random');
  return (
    <div className="landing">
      <div className="landing-shade" />
      <div className="landing-content">
        <div className="brand-chip"><span className="dot pulse" /> Fire Safety Training · Browser 3D</div>
        <h1 className="title">
          Emergency Rescue <span>&amp;</span><br />Evacuation Simulator
        </h1>
        <p className="lede">
          A fire has broken out in a modern office. Raise the alarm, decide whether it is safe to fight the fire,
          and lead yourself out through smoke to the assembly point before the building becomes untenable.
        </p>

        <div className="scenario-pick">
          <label>Scenario</label>
          <div className="seg">
            <button className={scenario === 'random' ? 'on' : ''} onClick={() => setScenario('random')}>Random</button>
            {SCENARIOS.map((s) => (
              <button key={s.id} className={scenario === s.id ? 'on' : ''} onClick={() => setScenario(s.id)}>{s.name}</button>
            ))}
          </div>
        </div>

        <div className="cta-row">
          <button className="btn primary big" onClick={() => onStart(scenario === 'random' ? null : scenario)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Start Simulation
          </button>
          <button className="btn ghost" onClick={() => onPanel('instructions')}>Instructions</button>
          <button className="btn ghost" onClick={() => onPanel('settings')}>Settings</button>
          <button className="btn ghost" onClick={() => onPanel('about')}>About</button>
        </div>

        <div className="landing-meta">
          <div className="meta-item"><b>WASD</b> move · <b>Mouse</b> look · <b>E</b> interact · <b>LMB</b> spray · <b>C</b> crouch · <b>Esc</b> pause</div>
          {best && (
            <div className="meta-item best">Best score <b>{best.score}</b> · rating <b>{best.rating}</b></div>
          )}
        </div>
      </div>
      <div className="landing-footer">Three.js · React · Web Audio — 100% free & open-source, no external assets</div>
    </div>
  );
}
