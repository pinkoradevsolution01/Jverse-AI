import { BrandLogo } from "./brand-logo";

export function AiCore() {
  const telemetry = [["COGNITION", "98.4%"], ["MEMORY", "SECURED"], ["MODE", "LOCAL"]] as const;
  return <section className="jv-hud-core" aria-label="JVerse AI core status">
    <div aria-hidden className="jv-hud-noise" />
    <div aria-hidden className="jv-hud-grid" />
    <div className="jv-hud-topline"><span>JVERSE // NEURAL COMMAND</span><span>CORE-01 / SYNCHRONIZED</span></div>
    <div className="jv-hud-side jv-hud-side-left"><HudReadout label="UPLINK" value="STABLE" /><HudBars /><HudReadout label="SIGNAL" value="99.98" /></div>
    <div className="jv-hud-side jv-hud-side-right"><HudReadout label="MODEL" value="QWEN 2.5" /><HudReadout label="VOICE" value="STANDBY" /><HudBars reverse /></div>
    <div className="jv-reactor" aria-hidden="true">
      <span className="jv-reactor-orbit jv-reactor-orbit-one" />
      <span className="jv-reactor-orbit jv-reactor-orbit-two" />
      <span className="jv-reactor-ticks" />
      <span className="jv-reactor-arc jv-reactor-arc-one" />
      <span className="jv-reactor-arc jv-reactor-arc-two" />
      <span className="jv-reactor-scan" />
      <span className="jv-reactor-inner"><BrandLogo decorative className="h-12 w-16 object-contain" /><b>ACTIVE</b></span>
      <span className="jv-reactor-marker jv-reactor-marker-one" />
      <span className="jv-reactor-marker jv-reactor-marker-two" />
      <span className="jv-reactor-marker jv-reactor-marker-three" />
    </div>
    <div className="jv-hud-bottom"><span className="flex items-center gap-2"><i className="signal-dot h-1.5 w-1.5 rounded-full bg-cyan-300" /> SYSTEM OPERATIONAL</span><span>11:23 / UTC+08</span></div>
    <div className="jv-hud-telemetry">{telemetry.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
  </section>;
}

function HudReadout({ label, value }: { label: string; value: string }) {
  return <div className="jv-hud-readout"><span>{label}</span><b>{value}</b><i /></div>;
}

function HudBars({ reverse = false }: { reverse?: boolean }) {
  return <div className={`jv-hud-bars ${reverse ? "jv-hud-bars-reverse" : ""}`}><i /><i /><i /><i /><i /></div>;
}

