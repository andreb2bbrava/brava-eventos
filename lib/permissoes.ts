import { supabase } from "@/lib/supabase";
import { canCheckinRole, canEditEventRole, isAdminRole, isRoleUsuario, type RoleUsuario } from "@/lib/roles";

export async function podeAcessarEvento(slug: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { autorizado: false, evento: null, erro: "Usuário não autenticado.", role: null };
  }

  const { data: usuarioData, error: usuarioError } = await supabase
    .from("usuarios")
    .select("role")
    .eq("id", user.id)
    .single();

  if (usuarioError || !usuarioData) {
    return { autorizado: false, evento: null, erro: "Usuário não encontrado.", role: null };
  }

  const role = isRoleUsuario(usuarioData.role) ? usuarioData.role : null;

  const { data: evento, error: eventoError } = await supabase
    .from("eventos")
    .select("*")
    .eq("slug", slug)
    .single();

  if (eventoError || !evento) {
    return { autorizado: false, evento: null, erro: "Evento não encontrado.", role };
  }

  if (isAdminRole(role)) {
    return { autorizado: true, evento, erro: null, role };
  }

  if (role === "staff") {
    const { data: vinculacao, error: vinculacaoError } = await supabase
      .from("evento_staff")
      .select("id")
      .eq("evento_id", evento.id)
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (vinculacaoError || !vinculacao) {
      return { autorizado: false, evento: null, erro: "Você não possui permissão para acessar este evento.", role };
    }

    return { autorizado: true, evento, erro: null, role };
  }

  if (role !== "produtor") {
    return { autorizado: false, evento: null, erro: "Você não possui permissão para acessar este evento.", role };
  }

  const { data: vinculacao, error: vinculacaoError } = await supabase
    .from("evento_produtores")
    .select("id")
    .eq("evento_id", evento.id)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (vinculacaoError || !vinculacao) {
    return { autorizado: false, evento: null, erro: "Você não possui permissão para acessar este evento.", role };
  }

  return { autorizado: true, evento, erro: null, role };
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
