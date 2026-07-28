import { NextResponse } from "next/server";
import { isPlatformOwner, isRoleUsuario, type RoleUsuario } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  return token?.trim() || "";
}

async function autenticarPlatformOwner(request: Request): Promise<
  | {
      ok: true;
      usuario: { id: string; role: RoleUsuario; nome: string | null; email: string | null };
    }
  | { ok: false; response: NextResponse }
> {
  const token = obterToken(request);

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }) };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }) };
  }

  const { data: usuarioData, error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .select("id, nome, email, role")
    .eq("id", authData.user.id)
    .single();

  if (usuarioError || !usuarioData?.id || !isRoleUsuario(usuarioData.role) || !isPlatformOwner(usuarioData.role)) {
    return { ok: false, response: NextResponse.json({ error: "Usuario sem permissao." }, { status: 403 }) };
  }

  return {
    ok: true,
    usuario: {
      id: usuarioData.id,
      role: usuarioData.role,
      nome: usuarioData.nome || null,
      email: usuarioData.email || authData.user.email || null,
    },
  };
}

function inicioPeriodo(periodo: string | null) {
  if (!periodo || periodo === "all") {
    return null;
  }

  const dias = Number(periodo);
  if (!Number.isFinite(dias) || dias <= 0) {
    return null;
  }

  const data = new Date();
  data.setDate(data.getDate() - dias);
  return data.toISOString();
}

export async function GET(request: Request) {
  try {
    const auth = await autenticarPlatformOwner(request);
    if (!auth.ok) {
      return auth.response;
    }

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") || "20")));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const search = (url.searchParams.get("search") || "").trim();
    const usuario = (url.searchParams.get("usuario") || "").trim();
    const role = (url.searchParams.get("role") || "").trim();
    const acao = (url.searchParams.get("acao") || "").trim();
    const entidade = (url.searchParams.get("entidade") || "").trim();
    const eventoId = (url.searchParams.get("eventoId") || "").trim();
    const periodo = inicioPeriodo(url.searchParams.get("periodo"));

    let query = supabaseAdmin
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (periodo) {
      query = query.gte("created_at", periodo);
    }

    if (usuario) {
      query = query.or(`usuario_nome.ilike.%${usuario}%,usuario_email.ilike.%${usuario}%`);
    }

    if (role) {
      query = query.eq("usuario_role", role);
    }

    if (acao) {
      query = query.eq("acao", acao);
    }

    if (entidade) {
      query = query.eq("entidade", entidade);
    }

    if (eventoId) {
      const eventoNumerico = Number(eventoId);
      if (Number.isFinite(eventoNumerico)) {
        query = query.eq("evento_id", eventoNumerico);
      }
    }

    if (search) {
      query = query.or(
        `descricao.ilike.%${search}%,acao.ilike.%${search}%,entidade.ilike.%${search}%,usuario_nome.ilike.%${search}%,usuario_email.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const eventoIds = Array.from(new Set((data || []).map((item) => item.evento_id).filter((value) => Number.isFinite(value))));

    let nomesEvento: Record<string, string> = {};

    if (eventoIds.length > 0) {
      const { data: eventosData } = await supabaseAdmin.from("eventos").select("id, nome").in("id", eventoIds as number[]);
      nomesEvento = Object.fromEntries((eventosData || []).map((evento) => [String(evento.id), evento.nome]));
    }

    const linhas = (data || []).map((item) => ({
      ...item,
      evento_nome: item.evento_id ? nomesEvento[String(item.evento_id)] || null : null,
    }));

    return NextResponse.json({
      success: true,
      rows: linhas,
      total: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Erro ao consultar auditoria:", error);
    return NextResponse.json({ error: "Erro interno ao consultar auditoria." }, { status: 500 });
  }
}
