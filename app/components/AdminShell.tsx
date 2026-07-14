"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type RoleUsuario = "super_admin" | "produtor" | "staff";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type AsideInfo = {
  title: string;
  description: string;
};

type BackLink = {
  href: string;
  label: string;
};

type MenuItem = {
  label: string;
  href?: string;
  disabled?: boolean;
  roles: RoleUsuario[];
};

type AdminShellProps = {
  role?: RoleUsuario | null;
  userName?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  backLink?: BackLink;
  aside?: AsideInfo;
  children: ReactNode;
};

const MENU_ITEMS: MenuItem[] = [
  {
    label: "Inicio",
    href: "/admin",
    roles: ["super_admin", "produtor", "staff"],
  },
  {
    label: "Meus Eventos",
    href: "/admin#todos-eventos",
    roles: ["super_admin", "produtor", "staff"],
  },
  {
    label: "Minha Equipe",
    href: "/super-admin",
    roles: ["super_admin"],
  },
  {
    label: "Relatorios",
    disabled: true,
    roles: ["super_admin", "produtor"],
  },
  {
    label: "Configuracoes",
    disabled: true,
    roles: ["super_admin", "produtor"],
  },
];

function itemAtivo(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  if (href === "/admin") {
    return pathname === "/admin";
  }

  if (href.startsWith("/admin#todos-eventos")) {
    return pathname.startsWith("/admin/eventos") || pathname === "/admin" || pathname === "/admin/criar-evento";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function obterNomeExibicao(email: string | null, metadata: Record<string, unknown> | undefined) {
  const firstName = typeof metadata?.first_name === "string" ? metadata.first_name.trim() : "";
  const fullName = typeof metadata?.full_name === "string" ? metadata.full_name.trim() : "";

  if (firstName) {
    return firstName;
  }

  if (fullName) {
    return fullName.split(" ")[0];
  }

  if (email && email.includes("@")) {
    const parte = email.split("@")[0].trim();
    if (parte) {
      return parte.charAt(0).toUpperCase() + parte.slice(1);
    }
  }

  return "Usuario Brava";
}

export default function AdminShell({
  role,
  userName,
  title,
  subtitle,
  breadcrumbs = [],
  actions,
  backLink,
  aside,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [nomeResolvido, setNomeResolvido] = useState(userName || "Usuario Brava");

  const menuItems = useMemo(() => {
    if (!role) {
      return MENU_ITEMS.filter((item) => item.roles.includes("super_admin"));
    }

    return MENU_ITEMS.filter((item) => item.roles.includes(role));
  }, [role]);

  const roleLabel = useMemo(() => {
    if (role === "super_admin") {
      return "Administrador Geral";
    }

    if (role === "produtor") {
      return "Produtor";
    }

    if (role === "staff") {
      return "Staff";
    }

    return "Operacao";
  }, [role]);

  useEffect(() => {
    if (userName) {
      setNomeResolvido(userName);
      return;
    }

    async function carregarNome() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      setNomeResolvido(obterNomeExibicao(user.email ?? null, user.user_metadata));
    }

    carregarNome();
  }, [userName]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1700px] gap-0 xl:px-4 2xl:px-6">
        <aside className="hidden w-72 shrink-0 xl:flex xl:flex-col xl:sticky xl:top-0 xl:h-screen">
          <div className="flex h-full flex-col overflow-hidden rounded-r-[2rem] bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] xl:rounded-[2rem] xl:my-4">
            <div className="border-b border-white/10 px-6 py-6">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Brava Entretenimento"
                className="h-12 w-12 rounded-2xl border border-white/10 bg-white p-1"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Brava Eventos</p>
                <h2 className="text-lg font-extrabold text-white">Painel Premium</h2>
              </div>
            </div>
            </div>

            <nav className="flex-1 space-y-2 px-4 py-6">
              {menuItems.map((item) =>
                item.disabled ? (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-400"
                  >
                    {item.label}
                    <span className="ml-2 text-xs uppercase tracking-[0.12em] text-slate-500">Em breve</span>
                  </div>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href || "/admin"}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      itemAtivo(pathname, item.href)
                        ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)]"
                        : "text-slate-300 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <span>{item.label}</span>
                    {itemAtivo(pathname, item.href) ? <span className="text-[10px] uppercase tracking-[0.16em] text-blue-100">Atual</span> : null}
                  </Link>
                )
              )}
            </nav>

            <div className="border-t border-white/10 px-4 py-4">
              {aside ? (
                <button
                  type="button"
                  onClick={() => setAjudaAberta(true)}
                  className="mb-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
                >
                  <span>Ajuda</span>
                  <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-xs font-bold">
                    ?
                  </span>
                </button>
              ) : null}

              <div className="rounded-2xl bg-white/5 px-4 py-4">
                <p className="text-sm font-bold text-white break-words">{nomeResolvido}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-blue-200">{roleLabel}</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b border-blue-100 bg-white/95 backdrop-blur xl:hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Brava Entretenimento"
                  className="h-10 w-10 rounded-xl border border-blue-100 bg-white p-1"
                />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Brava Eventos</p>
                  <p className="text-sm font-bold text-blue-900">Painel Premium</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMenuAberto((prev) => !prev)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 font-semibold text-blue-900 shadow-sm"
              >
                Menu
              </button>
            </div>

            {menuAberto ? (
              <div className="space-y-2 border-t border-blue-100 bg-slate-950 px-4 py-4 sm:px-6">
                {menuItems.map((item) =>
                  item.disabled ? (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-400"
                    >
                      {item.label}
                      <span className="ml-2 text-xs uppercase tracking-[0.12em] text-slate-500">Em breve</span>
                    </div>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href || "/admin"}
                      onClick={() => setMenuAberto(false)}
                      className={`block rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        itemAtivo(pathname, item.href)
                          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                          : "bg-white/5 text-slate-200"
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                )}

                {aside ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAjudaAberta(true);
                      setMenuAberto(false);
                    }}
                    className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200"
                  >
                    <span>Ajuda</span>
                    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-xs font-bold">
                      ?
                    </span>
                  </button>
                ) : null}

                <div className="rounded-2xl bg-white/5 px-4 py-4">
                  <p className="text-sm font-bold text-white break-words">{nomeResolvido}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-blue-200">{roleLabel}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-4 py-6 sm:px-6 xl:px-8 2xl:px-10">
            <div className="min-w-0 space-y-6">
              <header className="rounded-3xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(148,163,184,0.16)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    {breadcrumbs.length > 0 ? (
                      <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        {breadcrumbs.map((item, index) => (
                          <span key={`${item.label}-${index}`} className="flex items-center gap-2">
                            {item.href ? (
                              <Link href={item.href} className="hover:text-blue-700">
                                {item.label}
                              </Link>
                            ) : (
                              <span className="font-semibold text-slate-700">{item.label}</span>
                            )}
                            {index < breadcrumbs.length - 1 ? <span>/</span> : null}
                          </span>
                        ))}
                      </nav>
                    ) : null}

                    {backLink ? (
                      <Link
                        href={backLink.href}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
                      >
                        <span aria-hidden="true">←</span>
                        <span>{backLink.label}</span>
                      </Link>
                    ) : null}

                    <div>
                      <h1 className="text-3xl font-extrabold text-blue-900 sm:text-4xl break-words">{title}</h1>
                      {subtitle ? <p className="mt-2 max-w-4xl text-slate-600">{subtitle}</p> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {actions}
                    {aside ? (
                      <button
                        type="button"
                        onClick={() => setAjudaAberta(true)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900 transition hover:bg-blue-100"
                      >
                        <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-300 text-xs font-bold">
                          ?
                        </span>
                        <span>Guia Rapido</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </header>

              {children}
            </div>
          </div>
        </div>
      </div>

      {aside && ajudaAberta ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Fechar guia rapido"
            onClick={() => setAjudaAberta(false)}
            className="h-full flex-1 bg-slate-900/50"
          />

          <aside className="h-full w-full max-w-md border-l border-blue-100 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.32)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Guia rapido</p>
            <h2 className="mt-3 text-2xl font-extrabold text-blue-900">{aside.title}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">{aside.description}</p>

            <button
              type="button"
              onClick={() => setAjudaAberta(false)}
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500"
            >
              Fechar
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  );
}