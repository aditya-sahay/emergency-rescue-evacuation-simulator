import React from 'react';

function Modal({ title, kicker, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`panel ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        {kicker && <div className="panel-kicker">{kicker}</div>}
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function InstructionsPanel({ onClose }) {
  return (
    <Modal title="How to play" kicker="Instructions" onClose={onClose} wide>
      <div className="two-col">
        <div>
          <h3>Controls</h3>
          <table className="keys">
            <tbody>
              <tr><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></td><td>Move</td></tr>
              <tr><td><kbd>Mouse</kbd></td><td>Look around</td></tr>
              <tr><td><kbd>Shift</kbd></td><td>Sprint</td></tr>
              <tr><td><kbd>C</kbd></td><td>Crouch / stand (stay below smoke)</td></tr>
              <tr><td><kbd>Space</kbd></td><td>Jump</td></tr>
              <tr><td><kbd>E</kbd></td><td>Interact: doors, extinguishers, alarm call points</td></tr>
              <tr><td><kbd>Left mouse</kbd></td><td>Hold to spray the extinguisher</td></tr>
              <tr><td><kbd>G</kbd></td><td>Drop extinguisher</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>Pause</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3>Your response</h3>
          <ol className="steps">
            <li><b>Raise the alarm.</b> Find a red <i>Manual Call Point</i> and press <kbd>E</kbd>. If nobody does, smoke detectors trigger after 30 s.</li>
            <li><b>Fight only if safe.</b> A small fire can be tackled with an extinguisher from 1.5–5 m, aiming at the base. Keep your exit behind you.</li>
            <li><b>Evacuate.</b> Once the alarm sounds you have 180 s. Follow the green floor arrows — the route avoids fire and heavy smoke.</li>
            <li><b>Stay low in smoke.</b> The smoke layer descends from the ceiling. Crouching keeps your head in clearer air.</li>
            <li><b>Close doors</b> behind you — they slow fire and smoke spread.</li>
            <li><b>Reach the assembly point</b> (green circle outside an exit) to finish — getting out of the door is not enough; you must be accounted for.</li>
          </ol>
        </div>
      </div>
      <div className="note-line">The HUD shows status, countdown, fire list, health, visibility, extinguisher capacity and a live floor plan.</div>
    </Modal>
  );
}

export function AboutPanel({ onClose }) {
  return (
    <Modal title="About this project" kicker="About" onClose={onClose} wide>
      <p>
        <b>Emergency Rescue &amp; Evacuation Simulator</b> is a browser-based first-person training simulation for office fire
        emergencies. It combines a procedurally built 3D office, a zone-based fire propagation model, a room-level smoke model,
        working extinguisher mechanics, an alarm system and danger-aware evacuation routing.
      </p>
      <div className="two-col">
        <div>
          <h3>Simulation model</h3>
          <ul className="plain">
            <li>Fires grow logistically, consume fuel and transfer heat to nearby combustible zones; walls and closed doors attenuate heat.</li>
            <li>Smoke accumulates per room and flows through openings; a hot layer descends from the ceiling.</li>
            <li>Routing uses Dijkstra over a navigation graph, penalising fire proximity and smoke.</li>
          </ul>
        </div>
        <div>
          <h3>Technology</h3>
          <ul className="plain">
            <li>Three.js (MIT) — rendering, PBR materials, shadows</li>
            <li>React + Vite (MIT) — interface and build</li>
            <li>Web Audio API — all sounds synthesised in code</li>
            <li>All geometry and textures are generated procedurally — no third-party art assets.</li>
          </ul>
        </div>
      </div>
      <p className="muted small">
        Educational simulation only. It is a simplified gameplay model and does not reproduce physically accurate combustion or
        computational fluid dynamics. Always follow your organisation&apos;s fire procedures and professional training.
      </p>
    </Modal>
  );
}

export function SettingsPanel({ settings, onChange, onClose }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (
    <Modal title="Settings" kicker="Preferences" onClose={onClose}>
      <div className="setting">
        <label>Graphics quality</label>
        <div className="seg">
          {['low', 'medium', 'high'].map((q) => (
            <button key={q} className={settings.quality === q ? 'on' : ''} onClick={() => set('quality', q)}>{q}</button>
          ))}
        </div>
        <div className="muted small">Low disables shadows and halves particles. Anti-aliasing changes apply after reload.</div>
      </div>
      <div className="setting">
        <label>Mouse sensitivity <span>{settings.sensitivity.toFixed(2)}×</span></label>
        <input type="range" min="0.3" max="2.5" step="0.05" value={settings.sensitivity} onChange={(e) => set('sensitivity', parseFloat(e.target.value))} />
      </div>
      <div className="setting">
        <label>Master volume <span>{Math.round(settings.volume * 100)}%</span></label>
        <input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(e) => set('volume', parseFloat(e.target.value))} />
      </div>
      <div className="cta-row"><button className="btn primary" onClick={onClose}>Done</button></div>
    </Modal>
  );
}
