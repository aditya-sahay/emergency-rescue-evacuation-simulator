import React, { useEffect, useRef } from 'react';

const fmt = (s) => {
  if (s == null) return '--:--';
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

const STATUS = {
  normal: { label: 'NORMAL OPERATIONS', cls: 'ok' },
  fire: { label: 'SMOKE DETECTED', cls: 'warn' },
  alarm: { label: 'FIRE ALARM — EVACUATE', cls: 'danger' },
  ended: { label: 'SIMULATION ENDED', cls: 'ok' },
};

function Bar({ value, cls, label, right }) {
  return (
    <div className="bar-row">
      <div className="bar-label"><span>{label}</span><span>{right}</span></div>
      <div className={`bar ${cls}`}><div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

export default function HUD({ state: s, notes, engine }) {
  const mapRef = useRef(null);
  useEffect(() => {
    if (engine && mapRef.current) engine.attachMinimap(mapRef.current);
    return () => engine?.attachMinimap(null);
  }, [engine]);

  const st = s ? STATUS[s.state] || STATUS.normal : STATUS.normal;
  const danger = s && (s.inFlames || s.radiant > 0.2);
  const lowVis = s ? 1 - s.visibility : 0;
  const urgent = s?.countdown != null && s.countdown < 30;

  return (
    <div className={`hud ${s?.alarmActive ? 'alarm' : ''}`}>
      {/* screen effects */}
      <div className="fx smoke" style={{ opacity: Math.min(0.85, lowVis * 1.1) }} />
      <div className="fx heat" style={{ opacity: s ? Math.min(0.9, (s.inFlames ? 0.6 : 0) + s.radiant * 0.9) : 0 }} />
      <div className="fx hurt" style={{ opacity: s ? Math.max(0, (60 - s.health) / 80) : 0 }} />
      {s?.alarmActive && <div className="fx strobe" />}

      {/* top-left: emergency status + objective */}
      <div className="card status-card">
        <div className={`status ${st.cls}`}><span className="dot pulse" />{st.label}</div>
        <div className="timer-row">
          <div>
            <div className="tiny">{s?.countdown != null ? 'TIME TO EVACUATE' : 'ELAPSED'}</div>
            <div className={`timer ${urgent ? 'urgent' : ''}`}>{s?.countdown != null ? fmt(s.countdown) : fmt(s?.elapsed ?? 0)}</div>
          </div>
          <div className="loc">
            <div className="tiny">LOCATION</div>
            <div className="loc-name">{s?.room ?? '—'}</div>
            {s?.alarmActive && (
              <div className={`evac-chip ${s.evacStatus}`}>
                {s.evacStatus === 'inside' ? 'INSIDE BUILDING' : s.evacStatus === 'outside' ? 'OUTSIDE — GO TO ASSEMBLY' : s.evacStatus === 'safe' ? 'ACCOUNTED FOR' : ''}
              </div>
            )}
          </div>
        </div>
        {s?.countdown != null && (
          <div className="bar countdown"><div style={{ width: `${(s.countdown / s.evacTotal) * 100}%` }} /></div>
        )}
        {s?.objective && (
          <div className="objective">
            <div className="obj-title">{s.objective.title}</div>
            <div className="obj-text">{s.objective.text}</div>
          </div>
        )}
      </div>

      {/* top-centre: route guidance compass */}
      {s?.route && s.dirAngle != null && (
        <div className={`compass ${s.route.hazardous ? 'hazard' : ''}`}>
          <div className="compass-arrow" style={{ transform: `rotate(${(s.dirAngle * 180) / Math.PI}deg)` }}>
            <svg viewBox="0 0 40 40" width="40" height="40"><path d="M20 3 L33 30 L20 23 L7 30 Z" fill="currentColor" /></svg>
          </div>
          <div>
            <div className="tiny">SAFEST ROUTE</div>
            <div className="compass-exit">Exit {s.route.exitId} · {Math.round(s.route.distance)} m</div>
            <div className="compass-sub">{s.route.hazardous ? 'All routes affected by fire — move fast & stay low' : s.route.exitName}</div>
          </div>
        </div>
      )}

      {/* top-right: minimap */}
      <div className="card map-card">
        <div className="card-title">FLOOR PLAN <span className="legend"><i className="lg-fire" />fire <i className="lg-ext" />extinguisher <i className="lg-mcp" />alarm <i className="lg-exit" />exit</span></div>
        <canvas ref={mapRef} className="minimap" />
      </div>

      {/* centre: crosshair + prompt */}
      <div className={`crosshair ${s?.prompt ? 'target' : ''} ${s?.spraying ? 'spray' : ''} ${s?.spray?.onTarget ? 'hit' : ''}`} />
      {s?.spray && (
        <div className={`spray-hint ${s.spray.onTarget ? 'hit' : 'miss'}`}>{s.spray.text}</div>
      )}
      {s?.prompt && !s?.spray && (
        <div className="prompt"><kbd>E</kbd>{s.prompt}</div>
      )}
      {danger && <div className="danger-banner">⚠ DANGER ZONE — EXTREME HEAT</div>}
      {s?.headInSmoke && !s?.crouching && <div className="smoke-banner">Heavy smoke — press <kbd>C</kbd> to stay low</div>}

      {/* bottom-left: vitals */}
      <div className="card vitals">
        <Bar label="HEALTH" right={`${Math.round(s?.health ?? 100)}%`} value={s?.health ?? 100} cls={(s?.health ?? 100) < 35 ? 'red' : (s?.health ?? 100) < 65 ? 'amber' : 'green'} />
        <Bar label="VISIBILITY" right={`${Math.round((s?.visibility ?? 1) * 100)}%`} value={(s?.visibility ?? 1) * 100} cls={(s?.visibility ?? 1) < 0.4 ? 'red' : (s?.visibility ?? 1) < 0.7 ? 'amber' : 'blue'} />
        <div className="vital-tags">
          <span className={`tag ${s?.crouching ? 'on' : ''}`}>{s?.crouching ? 'CROUCHING' : s?.sprinting ? 'SPRINTING' : 'STANDING'}</span>
          <span className="tag">SMOKE {Math.round((s?.roomSmoke ?? 0) * 100)}%</span>
          <span className="tag">{s?.fps ?? 0} FPS</span>
        </div>
      </div>

      {/* bottom-right: fire status + extinguisher */}
      <div className="br-stack">
        <div className="card fire-card">
          <div className="card-title">FIRE STATUS</div>
          <div className="fire-counts">
            <div><b className={s?.fires.active ? 'hot' : ''}>{s?.fires.active ?? 0}</b><span>active</span></div>
            <div><b className="cool">{s?.fires.extinguished ?? 0}</b><span>extinguished</span></div>
            <div><b>{s?.fires.nearest != null ? `${s.fires.nearest.toFixed(1)}m` : '—'}</b><span>nearest</span></div>
          </div>
          {s?.fires.list.map((f) => (
            <div key={f.id} className="fire-row">
              <span className="fid">{f.id}</span>
              <span className="froom">{f.room}</span>
              <span className={`fdanger ${f.danger}`}>{f.danger}</span>
              <div className="fbar"><div style={{ width: `${f.intensity * 100}%` }} /></div>
            </div>
          ))}
          {s && s.fires.active === 0 && s.state !== 'normal' && <div className="muted">No active fires detected.</div>}
          {s && s.state === 'normal' && <div className="muted">All zones normal.</div>}
        </div>
        {s?.holding && (
          <div className={`card ext-card ${s.capacity <= 0 ? 'empty' : ''}`}>
            <div className="card-title">EXTINGUISHER <span>{s.capacity <= 0 ? 'EMPTY' : s.spraying ? 'DISCHARGING' : 'READY'}</span></div>
            <div className="ext-gauge">
              <div className="ext-fill" style={{ width: `${s.capacity}%` }} />
              <span>{Math.round(s.capacity)}%</span>
            </div>
            <div className="pass">
              <b>P</b>ull pin · <b>A</b>im at base · <b>S</b>queeze <kbd>LMB</kbd> · <b>S</b>weep
            </div>
            <div className="muted small">Effective range 1.5–5 m · <kbd>G</kbd> drop</div>
          </div>
        )}
      </div>

      <div className="controls-hint">
        <kbd>WASD</kbd> move <kbd>Shift</kbd> sprint <kbd>C</kbd> crouch <kbd>Space</kbd> jump <kbd>E</kbd> interact <kbd>LMB</kbd> spray <kbd>Esc</kbd> pause
      </div>

      {/* notifications */}
      <div className="notes">
        {notes.map((n) => <div key={n.id} className={`note ${n.kind}`}>{n.text}</div>)}
      </div>
    </div>
  );
}
