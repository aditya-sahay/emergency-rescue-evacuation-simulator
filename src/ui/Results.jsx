import React from 'react';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Results({ results: r, best, isNewBest, onRestart, onMenu }) {
  const s = r.stats;
  const reason = s.reason === 'health' ? 'You were overcome by heat and smoke.'
    : s.reason === 'time' ? 'The evacuation clock ran out — the building became untenable.' : '';
  return (
    <div className="modal-backdrop results-bg">
      <div className="panel results">
        <div className={`outcome ${r.success ? 'win' : 'lose'}`}>
          <div className="outcome-kicker">{s.scenario}</div>
          <h2>{r.success ? 'Evacuation Successful' : 'Evacuation Failed'}</h2>
          <p>{r.success ? `You reached the assembly point via Exit ${s.exitId}.` : reason}</p>
        </div>

        <div className="results-grid">
          <div className="score-block">
            <div className={`rating r-${r.rating}`}>{r.rating}</div>
            <div className="rating-label">{r.label}</div>
            <div className="score">{r.score}<span>pts</span></div>
            {isNewBest ? <div className="new-best">New personal best!</div> : best && <div className="muted">Best: {best.score} ({best.rating})</div>}
          </div>

          <div className="stats">
            <Stat k="Evacuation time" v={fmt(s.evacTime)} sub={s.alarmSource ? 'from alarm' : 'from start'} />
            <Stat k="Fires extinguished" v={`${s.firesExtinguished} / ${s.totalFires}`} />
            <Stat k="Fire exposure" v={`${Math.round(s.exposure)} HP`} sub="heat damage taken" warn={s.exposure > 15} />
            <Stat k="Health remaining" v={`${s.health}%`} warn={s.health < 50} />
            <Stat k="Extinguisher used" v={`${Math.round(s.extinguisherUsed)}%`} sub={s.extinguisherUsed > 0 ? `${Math.round(s.accuracy * 100)}% on target` : 'not used'} />
            <Stat k="Alarm raised by" v={s.alarmSource === 'player' ? 'You' : s.alarmSource === 'detector' ? 'Detectors' : 'Nobody'} sub={s.alarmDelay != null ? `${Math.round(s.alarmDelay)} s after ignition` : ''} warn={s.alarmSource !== 'player'} />
          </div>
        </div>

        <div className="results-lower">
          <div className="breakdown">
            <div className="card-title">SCORE BREAKDOWN</div>
            {r.breakdown.map((b) => (
              <div key={b.label} className="bd-row"><span>{b.label}</span><b className={b.pts < 0 ? 'neg' : ''}>{b.pts > 0 ? '+' : ''}{b.pts}</b></div>
            ))}
          </div>
          <div className="tips">
            <div className="card-title">IMPROVEMENT SUGGESTIONS</div>
            <ul>{r.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>

        {r.timeline?.length > 0 && (
          <div className="timeline">
            <div className="card-title">INCIDENT TIMELINE</div>
            <ol>
              {r.timeline.map((ev, i) => (
                <li key={i} className={ev.kind}>
                  <span className="tl-time">{fmt(ev.t)}</span>
                  <span className="tl-dot" />
                  <span className="tl-text">{ev.text}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="cta-row center">
          <button className="btn primary" onClick={onRestart}>Retry scenario</button>
          <button className="btn ghost" onClick={onMenu}>Main menu</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, sub, warn }) {
  return (
    <div className={`stat ${warn ? 'warn' : ''}`}>
      <div className="stat-k">{k}</div>
      <div className="stat-v">{v}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
