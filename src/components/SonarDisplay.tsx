import type { Command, SimulationState } from '../types';

export function SonarDisplay({ state, command }: { state: SimulationState; command: (command: Command) => void }) {
  return (
    <div className="sonar-layout">
      <div className="sonar-scope" aria-label="Interactive sonar scope">
        <div className="sonar-grid" />
        <div className="sonar-sweep" />
        <div className="sonar-pulse p1" /><div className="sonar-pulse p2" />
        {state.contacts.map((contact) => {
          const radius = contact.range / state.telemetry.sonarRange * 43;
          const angle = (contact.bearing - 90) * Math.PI / 180;
          return <button
            key={contact.id}
            className={`sonar-contact ${contact.classification.toLowerCase()} ${state.focusedContact === contact.id ? 'focused' : ''}`}
            style={{ left: `${50 + Math.cos(angle) * radius}%`, top: `${50 + Math.sin(angle) * radius}%`, opacity: 0.45 + contact.strength * 0.55 }}
            aria-label={`Focus ${contact.id}, ${contact.label}`}
            onClick={() => command({ type: 'FOCUS_CONTACT', contactId: contact.id })}
          ><span /></button>;
        })}
        <div className="sonar-center">N7</div>
        <div className="sonar-bearing">000<br /><span>N</span></div>
      </div>
      <div className="contact-list">
        <div className="section-cap">Acoustic contacts <span>{state.contacts.length}</span></div>
        {state.contacts.map((contact) => (
          <button className={state.focusedContact === contact.id ? 'selected' : ''} key={contact.id} onClick={() => command({ type: 'FOCUS_CONTACT', contactId: contact.id })}>
            <span><b>{contact.id}</b><em>{contact.label}</em></span>
            <span className="contact-data">{contact.bearing.toFixed(0).padStart(3, '0')}°<br />{contact.range} m</span>
            <i><span style={{ width: `${contact.confidence}%` }} /></i>
            <small>Classification {contact.confidence.toFixed(0)}%</small>
          </button>
        ))}
      </div>
    </div>
  );
}
