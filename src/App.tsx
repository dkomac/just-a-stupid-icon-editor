import { sampleDocument } from "./editor/sample";
import { renderDocumentSvg } from "./editor/svg";

const sampleSvg = renderDocumentSvg(sampleDocument);

export default function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>Logo Creator</h1>
        <button type="button">Export</button>
      </header>
      <section className="editor-grid">
        <nav className="toolbar" aria-label="Shape tools">
          <button type="button" aria-label="Rectangle">Rectangle</button>
          <button type="button" aria-label="Ellipse">Ellipse</button>
          <button type="button" aria-label="Text">Text</button>
        </nav>
        <section className="canvas-wrap" aria-label="Logo canvas">
          <div dangerouslySetInnerHTML={{ __html: sampleSvg }} />
        </section>
        <aside className="side-panel" aria-label="Layers" role="region">
          <h2>Layers</h2>
        </aside>
        <aside className="side-panel" aria-label="Inspector" role="region">
          <h2>Inspector</h2>
        </aside>
      </section>
    </main>
  );
}
