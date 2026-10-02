export default function SettingsPage() {
  return <div className="page-container"><header className="page-header"><div><p className="eyebrow">Administration</p><h1>Settings</h1><p className="page-subtitle">Workspace configuration and account controls.</p></div></header><section className="panel empty-state feature-unavailable"><span className="empty-icon">⚙</span><strong>Settings are managed by the deployment</strong><p>No editable settings are exposed by the current admin API.</p></section></div>;
}
