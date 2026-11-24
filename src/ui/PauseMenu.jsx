import React from 'react';

export default function PauseMenu({ onResume, onRestart, onMenu, onPanel }) {
  return (
    <div className="modal-backdrop">
      <div className="panel pause">
        <div className="panel-kicker">Simulation paused</div>
        <h2>Paused</h2>
        <div className="menu-col">
          <button className="btn primary" onClick={onResume}>Resume</button>
          <button className="btn" onClick={onRestart}>Restart scenario</button>
          <button className="btn" onClick={() => onPanel('instructions')}>Instructions</button>
          <button className="btn" onClick={() => onPanel('settings')}>Settings</button>
          <button className="btn ghost" onClick={onMenu}>Main menu</button>
        </div>
      </div>
    </div>
  );
}
