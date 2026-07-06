"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function roleAmigavel(role: string | null) {
  if (role === "super_admin") {
    return "Administrador Geral";
  }

  if (role === "produtor") {
    return "Produtor";
  }

  if (role === "staff") {
    return "Staff";
  }

  return "Usuario";
}

export default function AdminPage() {
  const router = useRouter();
  const [eventos, setEventos] = useState<any[]>([]);
  const [roleUsuario, setRoleUsuario] = useState<string | null>(null);
  const [excluindoEventoId, setExcluindoEventoId] = useState<number | null>(null);

  async function carregarEventos() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: usuarioData } = await supabase
      .from("usuarios")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!usuarioData) {
      setRoleUsuario(null);
      setEventos([]);
      return;
    }

    setRoleUsuario(usuarioData.role);

    if (usuarioData.role === "super_admin") {
      const { data } = await supabase.from("eventos").select("*").order("id", {
        ascending: false,
      });

      if (data) {
        setEventos(data);
      }

      return;
    }

    if (usuarioData.role === "staff") {
      const { data: vinculosData } = await supabase
        .from("evento_staff")
        .select("evento_id")
        .eq("usuario_id", user.id);

      if (!vinculosData || vinculosData.length === 0) {
        setEventos([]);
        return;
      }

      const idsEventos = vinculosData.map((item) => item.evento_id).filter(Boolean);

      if (idsEventos.length === 0) {
        setEventos([]);
        return;
      }

      const { data } = await supabase
        .from("eventos")
        .select("*")
        .in("id", idsEventos)
        .order("id", { ascending: false });

      if (data) {
        setEventos(data);
      }

      return;
    }

    const { data: vinculosData } = await supabase
      .from("evento_produtores")
      .select("evento_id")
      .eq("usuario_id", user.id);

    if (!vinculosData || vinculosData.length === 0) {
      setEventos([]);
      return;
    }

    const idsEventos = vinculosData.map((item) => item.evento_id).filter(Boolean);

    if (idsEventos.length === 0) {
      setEventos([]);
      return;
    }

    const { data } = await supabase
      .from("eventos")
      .select("*")
      .in("id", idsEventos)
      .order("id", { ascending: false });

    if (data) {
      setEventos(data);
    }
  }

  async function logout() {
    await supabase.auth.signOut();

    router.push("/login");
  }

  async function excluirEvento(eventoId: number) {
    if (roleUsuario === "staff") {
      alert("Staff não possui permissão para excluir eventos.");
      return;
    }

    const confirmar = confirm("Tem certeza que deseja excluir este evento? Esta ação não poderá ser desfeita.");

    if (!confirmar) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Sua sessão expirou. Faça login novamente.");
      router.push("/login");
      return;
    }

    setExcluindoEventoId(eventoId);

    const response = await fetch("/api/excluir-evento", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        eventoId,
      }),
    });

    const result = await response.json();

    setExcluindoEventoId(null);

    if (!response.ok || result.error) {
      alert(result.error || "Erro ao excluir evento.");
      return;
    }

    setEventos((prev) => prev.filter((evento) => evento.id !== eventoId));
    alert("Evento excluído com sucesso!");
  }

  useEffect(() => {
    carregarEventos();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
        <div>
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Brava Entretenimento"
              className="h-12 w-12 rounded-xl border border-blue-200 bg-white p-1"
            />
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-blue-900 break-words">Painel Administrativo</h1>
              <p className="text-slate-600 mt-1">{roleAmigavel(roleUsuario)}</p>
            </div>
          </div>

          {roleUsuario === "staff" && (
            <p className="text-sm text-amber-600 mt-3">
              Seu perfil permite apenas acesso de check-in.
            </p>
          )}
        </div>

        <div className="flex gap-4 flex-wrap">
          {(roleUsuario === "super_admin" || roleUsuario === "produtor") && (
            <Link
              href="/admin/criar-evento"
              className={`px-6 py-3 rounded-2xl font-bold transition ${
                roleUsuario === "super_admin"
                  ? "bg-blue-700 hover:bg-blue-600 text-white shadow-lg"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {roleUsuario === "super_admin" ? "Criar Evento (Administrador Geral)" : "Criar Evento"}
            </Link>
          )}

          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-400 text-white px-6 py-3 rounded-2xl font-bold transition"
          >
            Sair
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
        {eventos.map((evento) => (
          <div
            key={evento.id}
            className="bg-white border border-blue-100 rounded-3xl overflow-hidden shadow-sm"
          >
            <img
              src={evento.banner_url}
              alt={evento.nome}
              className={`w-full h-56 object-cover ${
                evento.banner_posicao ===
                "top"
                  ? "object-top"
                  : evento.banner_posicao ===
                    "bottom"
                  ? "object-bottom"
                  : "object-center"
              }`}
            />
            <div className="p-6">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-900 mb-4 break-words">{evento.nome}</h2>

              <div className="space-y-2 text-slate-600 mb-6">
                <p>📅 {evento.data_evento}</p>
                <p>🕙 {evento.hora_evento}</p>
                <p>📍 {evento.local_evento}</p>
              </div>
              <div className="flex flex-col gap-3">
                <Link
                  href={`/admin/eventos/${evento.slug}`}
                  className="bg-blue-600 hover:bg-blue-500 text-center text-white py-3 rounded-2xl font-bold transition min-h-11"
                >
                  Abrir Dashboard
                </Link>

                <Link
                  href={`/evento/${evento.slug}`}
                  target="_blank"
                  className="bg-blue-100 hover:bg-blue-200 text-center text-blue-900 py-3 rounded-2xl font-bold transition min-h-11"
                >
                  Abrir Página Pública
                </Link>

                {(roleUsuario === "super_admin" || roleUsuario === "produtor") && (
                  <button
                    onClick={() => excluirEvento(evento.id)}
                    disabled={excluindoEventoId === evento.id}
                    className="bg-red-500 hover:bg-red-400 disabled:bg-red-300 text-center text-white py-3 rounded-2xl font-bold transition min-h-11"
                  >
                    {excluindoEventoId === evento.id ? "Excluindo..." : "Excluir"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {eventos.length === 0 && (
        <div className="text-center mt-20">
          <h2 className="text-4xl font-bold text-slate-400">
            {roleUsuario === "staff"
              ? "Você ainda não possui eventos atribuídos para check-in."
              : "Você ainda não possui eventos compartilhados."}
          </h2>
        </div>
      )}
    </main>
  );
}