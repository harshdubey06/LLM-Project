export default function LivePreview({ code }) {
  return (
    <section className="preview-panel" aria-label="Live preview">
      <div className="preview-header">
        <h2>Live preview</h2>
      </div>
      <iframe sandbox="allow-forms allow-scripts" title="Generated form preview" srcDoc={code} />
    </section>
  );
}
