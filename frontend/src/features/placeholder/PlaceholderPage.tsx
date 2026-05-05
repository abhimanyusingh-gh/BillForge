interface PlaceholderPageProps {
  label: string;
}

export function PlaceholderPage({ label }: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <h1 className="placeholder-page-title">{label}</h1>
      <p className="placeholder-page-body">Coming soon</p>
    </section>
  );
}
