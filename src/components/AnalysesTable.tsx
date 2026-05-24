"use client";

import type { AnalysisItem } from "../lib/types";

interface Props {
    items: AnalysisItem[];
    loading?: boolean;
}

function scoreColor(score: number) {
    if (score >= 70) return "text-emerald-600";
    if (score >= 40) return "text-amber-600";
    return "text-red-600";
}

const MONTHS_ES = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
] as const;

/** Formato estable SSR/cliente (evita mismatch de locale) */
function formatAnalysisDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = MONTHS_ES[d.getUTCMonth()] ?? "???";
    return `${day} ${month}`;
}

function TableShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-[#e4e8f4]">
            {children}
        </div>
    );
}

export default function AnalysesTable({ items, loading }: Props) {
    if (loading) {
        return (
            <TableShell>
                <p className="px-4 py-10 text-center text-sm text-[#6f7693]">
                    Cargando análisis...
                </p>
            </TableShell>
        );
    }

    if (items.length === 0) {
        return (
            <TableShell>
                <p className="px-4 py-10 text-center text-sm text-[#6f7693]">
                    Sin análisis aún. Ejecuta la auditoría automática.
                </p>
            </TableShell>
        );
    }

    return (
        <TableShell>
            <MotionTable items={items} />
        </TableShell>
    );
}

function MotionTable({ items }: { items: AnalysisItem[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-[#e4e8f4] text-left text-xs font-bold uppercase tracking-wider text-[#7b84a3]">
                        <th className="px-4 py-3">Página</th>
                        <th className="px-4 py-3">SEO</th>
                        <th className="px-4 py-3">GEO</th>
                        <th className="hidden px-4 py-3 md:table-cell">Fecha</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item.id}
                            className="border-b border-[#eef1f8] transition hover:bg-[#fafbff]"
                        >
                            <td className="max-w-[220px] truncate px-4 py-3 font-medium text-[#1b1f8a]">
                                {item.url.replace(/^https?:\/\//, "")}
                            </td>
                            <td
                                className={`px-4 py-3 font-bold ${scoreColor(item.seo_score)}`}
                            >
                                {item.seo_score}
                            </td>
                            <td
                                className={`px-4 py-3 font-bold ${scoreColor(item.geo_score)}`}
                            >
                                {item.geo_score}
                            </td>
                            <td className="hidden px-4 py-3 text-[#6f7693] md:table-cell">
                                {formatAnalysisDate(item.created_at)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
