"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UsuarioLogin = {
  id: string;
  role: string | null;
  acesso_listas: boolean | null;
  acesso_tiketeira: boolean | null;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (entrando) {
      return;
    }

    setEntrando(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      if (error) {
        console.warn("Login recusado:", error.message);
        alert("Email ou senha inválidos.");
        return;
      }

      const user = data.user;

      if (!user) {
        alert("Não foi possível identificar o usuário.");
        return;
      }

      const { data: usuarioData, error: erroUsuario } = await supabase
        .from("usuarios")
        .select("id, role, acesso_listas, acesso_tiketeira")
        .eq("id", user.id)
        .single();

      if (erroUsuario || !usuarioData) {
        console.warn(
          "Não foi possível carregar as permissões do usuário:",
          erroUsuario?.message
        );

        alert("Não foi possível carregar as permissões do usuário.");
        return;
      }

      const usuario = usuarioData as UsuarioLogin;

      const acessoListas = usuario.acesso_listas === true;
      const acessoTiketeira = usuario.acesso_tiketeira === true;

      /*
       * REGRA DE ENTRADA POR MÓDULO
       *
       * LISTAS + TIKETEIRA
       * → Central de escolha
       *
       * SOMENTE LISTAS
       * → Ambiente operacional atual
       *
       * SOMENTE TIKETEIRA
       * → Dashboard da Tiketeira
       *
       * NENHUM MÓDULO
       * → Sem acesso
       */

      if (acessoListas && acessoTiketeira) {
        router.replace("/admin/modulos");
        return;
      }

      if (acessoListas) {
        router.replace("/admin");
        return;
      }

      if (acessoTiketeira) {
        router.replace("/admin/tiketeira");
        return;
      }

      await supabase.auth.signOut();

      alert("Usuário sem acesso aos módulos da plataforma.");
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Erro inesperado durante o login.";

      console.warn("Falha inesperada no login:", mensagem);

      alert("Ocorreu um erro ao entrar. Tente novamente.");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white border border-blue-100 p-5 sm:p-8 rounded-3xl w-full max-w-md shadow-sm">
        <div className="flex items-center justify-center mb-4">
          <img
            src="/logo.png"
            alt="Brava Entretenimento"
            className="h-14 w-14 rounded-2xl border border-blue-100 bg-white p-1"
          />
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-blue-900 mb-2">
          GRUPO BRAVA
        </h1>

        <p className="text-center text-slate-500 mb-8">
          Painel Administrativo
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ui-field"
            required
            autoComplete="email"
            disabled={entrando}
          />

          <input
            type="password"
            placeholder="Sua senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="ui-field"
            required
            autoComplete="current-password"
            disabled={entrando}
          />

          <button
            type="submit"
            disabled={entrando}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed text-white transition p-4 rounded-xl font-extrabold"
          >
            {entrando ? "ENTRANDO..." : "ENTRAR"}
          </button>
        </form>
      </div>
    </main>
  );
}