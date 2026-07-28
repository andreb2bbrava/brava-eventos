import { NextResponse } from "next/server";
import { registrarAuditLog } from "@/lib/auditoria";
import { isAdminRole, isPlatformOwner, isRoleUsuario, type RoleUsuario } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function roleValida(role: string): role is RoleUsuario {
  return isRoleUsuario(role);
}

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  return token?.trim() || "";
}

async function validarAdmin(request: Request) {
  const token = obterToken(request);

  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }) };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }) };
  }

  const { data: usuarioData, error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (usuarioError || !isAdminRole(usuarioData?.role)) {
    return { ok: false as const, response: NextResponse.json({ error: "Usuario sem permissao." }, { status: 403 }) };
  }

  return {
    ok: true as const,
    solicitante: {
      id: authData.user.id,
      role: usuarioData.role as RoleUsuario,
      nome: null,
      email: authData.user.email || null,
    },
  };
}

export async function POST(request: Request) {
  try {
    const validacao = await validarAdmin(request);
    if (!validacao.ok) {
      return validacao.response;
    }

    const body = await request.json();
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");
    const role = String(body?.role || "").trim();
    const nome = String(body?.nome || "").trim();

    if (!email || !password || !roleValida(role)) {
      return NextResponse.json({ error: "Dados invalidos para criar usuario." }, { status: 400 });
    }

    if (role === "platform_owner" && !isPlatformOwner(validacao.solicitante.role)) {
      return NextResponse.json({ error: "Apenas o Proprietario da Plataforma pode criar este perfil." }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data?.user?.id) {
      return NextResponse.json({ error: error?.message || "Nao foi possivel criar usuario." }, { status: 400 });
    }

    const { error: erroUsuario } = await supabaseAdmin.from("usuarios").insert([
      {
        id: data.user.id,
        email,
        role,
        nome: nome || null,
      },
    ]);

    if (erroUsuario) {
      return NextResponse.json({ error: erroUsuario.message }, { status: 400 });
    }

    await registrarAuditLog(
      {
        acao: "usuario_criado",
        entidade: "usuario",
        entidadeId: data.user.id,
        descricao: `Criou o usuario ${email}.`,
        dadosNovos: {
          email,
          nome: nome || null,
          role,
        },
      },
      {
        request,
        actor: {
          id: validacao.solicitante.id,
          nome: validacao.solicitante.nome,
          email: validacao.solicitante.email,
          role: validacao.solicitante.role,
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ERRO GERAL AO CRIAR USUARIO:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}