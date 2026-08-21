import { NextResponse } from "next/server";

/*
 * Porta de entrada: sem cookie de sessão, manda para /login.
 * Aqui só checamos a PRESENÇA do cookie (o middleware roda no Edge).
 * A validação real da assinatura acontece no servidor, em lib/auth.js,
 * a cada rota de API e a cada carregamento de página.
 */
export function middleware(request) {
  const temSessao = request.cookies.has("sdr_sessao");
  const { pathname } = request.nextUrl;

  const rotaPublica =
    pathname.startsWith("/login") ||
    pathname.startsWith("/privacidade") ||
    pathname.startsWith("/redefinir") ||                 // link de nova senha              // exigência da Meta: precisa ser pública
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/retell") ||          // webhook da Retell vem de fora
    pathname.startsWith("/api/campanhas/processar") || // cron da Vercel vem sem cookie
    pathname.startsWith("/api/whatsapp/webhook") ||     // webhook da Meta vem de fora
    pathname.startsWith("/api/agenda");                  // custom functions da Retell

  if (!temSessao && !rotaPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    return NextResponse.redirect(destino);
  }

  // Já logado tentando abrir o login? Vai para o painel.
  if (temSessao && pathname.startsWith("/login")) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    return NextResponse.redirect(destino);
  }

  // Informa o caminho ao layout: o console usa cabeçalho próprio,
  // sem a barra lateral do cliente.
  const cabecalhos = new Headers(request.headers);
  cabecalhos.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: cabecalhos } });
}

export const config = {
  // Ignora arquivos estáticos e imagens
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
