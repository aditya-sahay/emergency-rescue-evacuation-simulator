import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Engine } from './engine/Engine.js';
import { loadSettings, saveSettings, loadBest, saveBestIfHigher } from './engine/Settings.js';
import Landing from './ui/Landing.jsx';
import HUD from './ui/HUD.jsx';
import PauseMenu from './ui/PauseMenu.jsx';
import Results from './ui/Results.jsx';
import { InstructionsPanel, AboutPanel, SettingsPanel } from './ui/Panels.jsx';

let noteId = 0;

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [screen, setScreen] = useState('loading'); // loading | landing | playing | results
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState(null); // instructions | about | settings
  const [hud, setHud] = useState(null);
  const [notes, setNotes] = useState([]);
  const [results, setResults] = useState(null);
  const [best, setBest] = useState(loadBest());
  const [newBest, setNewBest] = useState(false);
  const [settings, setSettings] = useState(loadSettings());
  const [error, setError] = useState(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const pushNote = useCallback((text, kind) => {
    const id = ++noteId;
    setNotes((n) => [...n.slice(-3), { id, text, kind }]);
    setTimeout(() => setNotes((n) => n.filter((x) => x.id !== id)), kind === 'danger' ? 5500 : 4500);
  }, []);

  useEffect(() => {
    let engine;
    // let the loading screen paint before the (synchronous) level build
    const t = setTimeout(() => {
      try {
        engine = new Engine(canvasRef.current, {
          settings,
          onState: (s) => { if (screenRef.current === 'playing') setHud(s); },
          onEvent: (e) => {
            if (e.type === 'notify') pushNote(e.text, e.kind);
            else if (e.type === 'paused') setPaused(true);
            else if (e.type === 'resumed') setPaused(false);
            else if (e.type === 'ended') {
              const r = saveBestIfHigher(e.results);
              setBest(r.best);
              setNewBest(r.isNew);
              setResults(e.results);
              setPaused(false);
              setScreen('results');
            }
          },
        });
        engineRef.current = engine;
        window.__ers = engine; // exposed for automated tests / debugging
        setScreen('landing');
      } catch (err) {
        console.error(err);
        setError(String(err?.message || err));
      }
    }, 50);
    return () => { clearTimeout(t); engine?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (scenarioId) => {
    setResults(null);
    setNotes([]);
    setPanel(null);
    setPaused(false);
    setHud(null);
    setScreen('playing');
    engineRef.current?.startSession(scenarioId);
  };
  const restart = () => {
    setResults(null);
    setNotes([]);
    setPaused(false);
    setPanel(null);
    setScreen('playing');
    engineRef.current?.restart();
  };
  const toMenu = () => {
    setPanel(null);
    setPaused(false);
    setHud(null);
    setScreen('landing');
    engineRef.current?.toMenu();
  };
  const resume = () => { setPanel(null); engineRef.current?.resume(); };
  const updateSettings = (s) => {
    setSettings(s);
    saveSettings(s);
    engineRef.current?.applySettings(s);
  };

  return (
    <div className="app">
      <canvas ref={canvasRef} className="scene" onClick={() => {
        const e = engineRef.current;
        if (screen === 'playing' && e && !e.input.locked && !paused) e.input.requestLock();
      }} />

      {screen === 'loading' && (
        <div className="loading">
          {error ? (
            <div className="panel error">
              <h2>WebGL could not start</h2>
              <p>{error}</p>
              <p>Please use an up-to-date desktop Chrome, Edge or Firefox with hardware acceleration enabled.</p>
            </div>
          ) : (
            <>
              <div className="spinner" />
              <div className="loading-text">Building office environment…</div>
            </>
          )}
        </div>
      )}

      {screen === 'landing' && (
        <Landing best={best} onStart={start} onPanel={setPanel} />
      )}

      {screen === 'playing' && (
        <>
          <HUD state={hud} notes={notes} engine={engineRef.current} />
          {!paused && hud && !hud.locked && (
            <div className="click-overlay" onClick={() => engineRef.current?.input.requestLock()}>
              <div className="click-card">
                <div className="click-title">Click to {hud.elapsed > 0.5 ? 'continue' : 'begin'}</div>
                <div className="click-sub">Mouse look is captured while you play — press <kbd>Esc</kbd> to pause.</div>
              </div>
            </div>
          )}
          {paused && !panel && (
            <PauseMenu onResume={resume} onRestart={restart} onMenu={toMenu} onPanel={setPanel} />
          )}
        </>
      )}

      {screen === 'results' && results && (
        <Results results={results} best={best} isNewBest={newBest} onRestart={restart} onMenu={toMenu} />
      )}

      {panel === 'instructions' && <InstructionsPanel onClose={() => setPanel(null)} />}
      {panel === 'about' && <AboutPanel onClose={() => setPanel(null)} />}
      {panel === 'settings' && <SettingsPanel settings={settings} onChange={updateSettings} onClose={() => setPanel(null)} />}
    </div>
  );
}
