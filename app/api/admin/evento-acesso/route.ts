import { NextResponse } from "next/server";
import { isAdminRole, resolverRoleUsuario } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  return token?.trim() || "";
}

export async function GET(request: Request) {
  try {
    const token = obterToken(request);

    if (!token) {
      return NextResponse.json({ autorizado: false, evento: null, erro: "Usuário não autenticado.", role: null }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return NextResponse.json({ autorizado: false, evento: null, erro: "Usuário não autenticado.", role: null }, { status: 401 });
    }

    const { data: usuarioData, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id, role")
      .eq("id", authData.user.id)
      .single();

    const role = resolverRoleUsuario(usuarioData?.role || null);

    if (usuarioError || !usuarioData?.id || !role) {
      return NextResponse.json({ autorizado: false, evento: null, erro: "Usuário não encontrado.", role: null }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const slug = (searchParams.get("slug") || "").trim();

    if (!slug) {
      return NextResponse.json({ autorizado: false, evento: null, erro: "Evento não encontrado.", role }, { status: 400 });
    }

    const { data: evento, error: eventoError } = await supabaseAdmin
      .from("eventos")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (eventoError || !evento) {
      return NextResponse.json({ autorizado: false, evento: null, erro: "Evento não encontrado.", role }, { status: 404 });
    }

    if (isAdminRole(role)) {
      return NextResponse.json({ autorizado: true, evento, erro: null, role });
    }

    if (role === "staff") {
      const { data: vinculoStaff } = await supabaseAdmin
        .from("evento_staff")
        .select("id")
        .eq("evento_id", evento.id)
        .eq("usuario_id", usuarioData.id)
        .maybeSingle();

      if (!vinculoStaff) {
        return NextResponse.json(
          { autorizado: false, evento: null, erro: "Você não possui permissão para acessar este evento.", role },
          { status: 403 }
        );
      }

      return NextResponse.json({ autorizado: true, evento, erro: null, role });
    }

    if (role === "produtor") {
      const { data: vinculoProdutor } = await supabaseAdmin
        .from("evento_produtores")
        .select("id")
        .eq("evento_id", evento.id)
        .eq("usuario_id", usuarioData.id)
        .maybeSingle();

      if (!vinculoProdutor) {
        return NextResponse.json(
          { autorizado: false, evento: null, erro: "Você não possui permissão para acessar este evento.", role },
          { status: 403 }
        );
      }

      return NextResponse.json({ autorizado: true, evento, erro: null, role });
    }

    return NextResponse.json(
      { autorizado: false, evento: null, erro: "Você não possui permissão para acessar este evento.", role },
      { status: 403 }
    );
  } catch {
    return NextResponse.json(
      { autorizado: false, evento: null, erro: "Erro interno ao validar acesso do evento.", role: null },
      { status: 500 }
    );
  }
}
