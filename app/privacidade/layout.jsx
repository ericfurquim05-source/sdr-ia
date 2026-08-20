export default function LayoutPrivacidade({ children }) {
  // Página pública: sem sidebar, acessível ao robô da Meta
  return <div className="min-h-screen">{children}</div>;
}
