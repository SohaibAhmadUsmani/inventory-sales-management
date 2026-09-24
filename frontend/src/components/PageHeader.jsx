/**
 * Page title + subtitle + right-aligned actions, matching the reference
 * design's page-head style. Used inside pages that render within <Layout/>.
 */
export default function PageHeader({ title, subtitle, actions, children }) {
  const headerActions = actions || children;
  return (
    <header className="shell-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {headerActions && <div className="shell-page-actions">{headerActions}</div>}
    </header>
  );
}
