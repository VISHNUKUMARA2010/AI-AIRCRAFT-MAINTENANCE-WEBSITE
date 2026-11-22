export default function PanelCard({ title, subtitle, children, accent = 'cyan', badge = null, className = '' }) {
  return (
    <section className={`panel-card panel-${accent} ${className}`}>
      <div className="panel-card-head panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {badge || null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
