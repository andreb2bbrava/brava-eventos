import { supabase } from "@/lib/supabase";
import { canCheckinRole, canEditEventRole, resolverRoleUsuario, type RoleUsuario } from "@/lib/roles";

type ResultadoAcessoEvento = {
  autorizado: boolean;
  evento: any | null;
  erro: string | null;
  role: RoleUsuario | null;
};

export async function podeAcessarEvento(slug: string): Promise<ResultadoAcessoEvento> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    return { autorizado: false, evento: null, erro: "Usuário não autenticado.", role: null };
  }

  const response = await fetch(`/api/admin/evento-acesso?slug=${encodeURIComponent(slug)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const result = (await response.json()) as {
    autorizado?: boolean;
    evento?: unknown;
    erro?: string | null;
    role?: string | null;
  };

  const role = resolverRoleUsuario(result?.role || null);

  if (!response.ok || !result?.autorizado || !result?.evento) {
    return {
      autorizado: false,
      evento: null,
      erro: result?.erro || "Você não possui permissão para acessar este evento.",
      role,
    };
  }

  return {
    autorizado: true,
    evento: result.evento as any,
    erro: null,
    role,
  };
}

export async function podeEditarEvento(slug: string) {
  const resultado = await podeAcessarEvento(slug);

  if (!resultado.autorizado) {
    return resultado;
  }

  const podeEditar = canEditEventRole(resultado.role as RoleUsuario | null);

  return {
    ...resultado,
    autorizado: podeEditar,
    erro: podeEditar ? null : "Seu perfil permite apenas acesso de check-in para este evento.",
  };
}

export async function podeFazerCheckin(slug: string) {
  const resultado = await podeAcessarEvento(slug);

  if (!resultado.autorizado) {
    return resultado;
  }

  const podeCheckin = canCheckinRole(resultado.role as RoleUsuario | null);

  return { ...resultado, autorizado: podeCheckin };
}

export async function validarAcessoEvento(slug: string) {
  return podeAcessarEvento(slug);
}
