import { PageHeader } from '../components/PageHeader'

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return <div className="page"><PageHeader title={title} description={description} /><div className="panel"><div className="empty-state">Estructura preparada. Este módulo se implementará en su fase correspondiente.</div></div></div>
}
