/**
 * Page title + subtitle + right-aligned actions, matching the reference
 * design's page-head style. Used inside pages that render within <Layout/>.
 */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="shell-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="shell-page-actions">{actions}</div>}
    </div>
  );
}
