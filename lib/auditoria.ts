import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRoleUsuario, type RoleUsuario } from "@/lib/roles";

type AuditActor = {
  id: string;
  nome: string | null;
  email: string | null;
  role: RoleUsuario;
};

type RegistrarAuditLogInput = {
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  eventoId?: number | null;
  listaId?: number | null;
  participanteId?: number | null;
  descricao?: string | null;
  dadosAnteriores?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
};

type RegistrarAuditLogContext = {
  request?: Request;
  actor?: AuditActor | null;
};

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  return token?.trim() || "";
}

function extrairIp(request?: Request) {
  if (!request) {
    return null;
  }

  const forwarded = request.headers.get("x-forwarded-for") || "";
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip") || null;
}

async function carregarActorDoRequest(request?: Request): Promise<AuditActor | null> {
  if (!request) {
    return null;
  }

  const token = obterToken(request);
  if (!token) {
    return null;
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return null;
  }

  const { data: usuarioData, error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .select("id, nome, email, role")
    .eq("id", authData.user.id)
    .single();

  if (usuarioError || !usuarioData?.id || !isRoleUsuario(usuarioData.role)) {
    return null;
  }

  return {
    id: usuarioData.id,
    nome: usuarioData.nome || null,
    email: usuarioData.email || authData.user.email || null,
    role: usuarioData.role,
  };
}

export async function registrarAuditLog(input: RegistrarAuditLogInput, context: RegistrarAuditLogContext = {}) {
  try {
    if (!input.acao || !input.entidade) {
      return;
    }

    const actor = context.actor || (await carregarActorDoRequest(context.request));

    const { error } = await supabaseAdmin.from("audit_logs").insert([
      {
        usuario_id: actor?.id || null,
        usuario_nome: actor?.nome || null,
        usuario_email: actor?.email || null,
        usuario_role: actor?.role || null,
        acao: input.acao,
        entidade: input.entidade,
        entidade_id: input.entidadeId || null,
        evento_id: input.eventoId || null,
        lista_id: input.listaId || null,
        participante_id: input.participanteId || null,
        descricao: input.descricao || null,
        dados_anteriores: input.dadosAnteriores || null,
        dados_novos: input.dadosNovos || null,
        ip: extrairIp(context.request),
        user_agent: context.request?.headers.get("user-agent") || null,
      },
    ]);

    if (error) {
      console.error("Falha ao registrar audit log:", error);
    }
  } catch (error) {
    console.error("Erro inesperado ao registrar audit log:", error);
  }
}
