export default function LayoutLogin({ children }) {
  // Layout limpo: a tela de login não mostra a sidebar
  return <div className="min-h-screen">{children}</div>;
}
