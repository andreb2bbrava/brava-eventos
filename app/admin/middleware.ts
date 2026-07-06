import { NextResponse } from "next/server";

import type { NextRequest }
from "next/server";

export async function middleware(
  request: NextRequest
) {

  const token =
    request.cookies.get(
      "sb-access-token"
    );

  const isLoginPage =
    request.nextUrl.pathname ===
    "/login";

  // NÃO LOGADO

  if (
    !token &&
    !isLoginPage
  ) {

    return NextResponse.redirect(
      new URL(
        "/login",
        request.url
      )
    );
  }

  // LOGADO TENTANDO VOLTAR LOGIN

  if (
    token &&
    isLoginPage
  ) {

    return NextResponse.redirect(
      new URL(
        "/admin",
        request.url
      )
    );
  }

  return NextResponse.next();
}

export const config = {

  matcher: [

    "/admin/:path*",

    "/login",

  ],

};