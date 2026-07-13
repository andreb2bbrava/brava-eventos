"use client";

import Link from "next/link";

type AdminEventTabsProps = {
  slug: string;
  current: "visao-geral" | "listas" | "convidados" | "check-in" | "configuracoes";
};

type TabItem = {
  key: AdminEventTabsProps["current"] | "equipe" | "marketing" | "relatorios";
  label: string;
  href?: string;
};

export default function AdminEventTabs({ slug, current }: AdminEventTabsProps) {
  const tabs: TabItem[] = [
    { key: "visao-geral", label: "Visao Geral", href: `/admin/eventos/${slug}` },
    { key: "listas", label: "Listas", href: `/admin/eventos/${slug}#listas-evento` },
    { key: "convidados", label: "Convidados", href: `/admin/eventos/${slug}#convidados` },
    { key: "check-in", label: "Check-in", href: `/admin/eventos/${slug}#check-in` },
    { key: "configuracoes", label: "Configurações", href: `/admin/eventos/${slug}/editar#configuracoes-evento` },
    { key: "equipe", label: "Equipe" },
    { key: "marketing", label: "Marketing" },
    { key: "relatorios", label: "Relatorios" },
  ];

  return (
    <div className="overflow-x-auto rounded-3xl border border-blue-100 bg-white p-3 shadow-sm">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => {
          const ativo = tab.key === current;

          if (!tab.href) {
            return (
              <span
                key={tab.key}
                className="inline-flex items-center rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm font-semibold text-slate-400"
              >
                {tab.label}
                <span className="ml-2 text-xs uppercase tracking-[0.12em]">Em breve</span>
              </span>
            );
          }

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`inline-flex min-h-11 items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                ativo ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-900"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}