"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      console.log("ERRO LOGIN:", error);
      alert("Email ou senha inválidos.");
      return;
    }

    const user = data.user;

    const {
      data: usuario,
      error: erroUsuario,
    } = await supabase.from("usuarios").select("*").eq("id", user.id).single();

    console.log("USUARIO:", usuario);
    console.log("ERRO USUARIO:", erroUsuario);

    if (usuario?.role === "platform_owner") {
      router.push("/super-admin");
      return;
    }

    if (usuario?.role === "super_admin") {
      router.push("/super-admin");
      return;
    }

    if (usuario?.role === "produtor") {
      router.push("/admin");
      return;
    }

    if (usuario?.role === "staff") {
      router.push("/staff");
      return;
    }

    alert("Usuário sem permissão.");
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

        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-blue-900 mb-2">GRUPO BRAVA</h1>

        <p className="text-center text-slate-500 mb-8">Painel Administrativo</p>

        <form onSubmit={handleLogin} className="space-y-5">
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ui-field"
          />

          <input
            type="password"
            placeholder="Sua senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="ui-field"
          />

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white transition p-4 rounded-xl font-extrabold"
          >
            ENTRAR
          </button>
        </form>
      </div>
    </main>
  );
}