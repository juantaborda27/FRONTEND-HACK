"use client";

import { useMemo, useState } from "react";
import { Search, Sparkles, Globe2, BadgeCheck, AlertTriangle, Loader2 } from "lucide-react";
import type { AuditResult } from "../lib/api";

type Props = {
    initialData?: AuditResult | null;
};

function StatCard({
    label,
    value,
    hint,
    icon,
}: {
    label: string;
    value: string | number;
    hint: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
                <p className="text-sm text-white/60">{label}</p>
                <div className="text-white/70">{icon}</div>
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</div>
            <p className="mt-1 text-sm text-white/50">{hint}</p>
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const s = status.toLowerCase();
    const cls =
        s === "completed"
            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
            : s === "pending"
                ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
                : "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30";

    return (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
            {status}
        </span>
    );
}

export default function Dashboard({ initialData }: Props) {
    const [url, setUrl] = useState(initialData?.url ?? "");
    const [data, setData] = useState<AuditResult | null>(initialData ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scoreLabel = useMemo(() => {
        if (!data) return "—";
        return `${data.seo_score}/100`;
    }, [data]);

    const geoLabel = useMemo(() => {
        if (!data) return "—";
        return `${data.geo_score}/100`;
    }, [data]);

    const handleDemoLoad = async () => {
        setLoading(true);
        setError(null);

        try {
            // modo demo: no mostrar resultados reales todavía
            await new Promise((r) => setTimeout(r, 1200));

            const mocked: AuditResult = {
                analysis_id: 9,
                url: url || "https://bancoserfinanzas.kesug.com/wp/",
                seo_score: 20,
                geo_score: 0,
                status: "completed",
                scrape_summary: {
                    title: "",
                    meta_description: "",
                    h1: "",
                    word_count: 19,
                    has_faq_schema: false,
                    has_structured_data: false,
                    internal_links_count: 0,
                    images_without_alt: 0,
                    scrape_warning: null,
                },
                scrape_warning: null,
            };

            setData(mocked);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo cargar");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#07111f] text-white">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 shadow-2xl">
                    <div className="grid gap-8 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-10">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                                <Sparkles className="h-3.5 w-3.5" />
                                Serfinanza GEO Dashboard
                            </div>

                            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
                                Auditoría SEO/GEO con una interfaz limpia y lista para demo
                            </h1>

                            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
                                Panel para revisar una URL, ver su estado de análisis y dejar preparado el flujo
                                de aprobación sin publicar nada todavía.
                            </p>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <div className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur">
                                    <Search className="ml-2 h-4 w-4 text-white/40" />
                                    <input
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="Pega aquí la URL a auditar"
                                        className="w-full bg-transparent px-2 py-2 text-sm outline-none placeholder:text-white/35"
                                    />
                                    <button
                                        onClick={handleDemoLoad}
                                        disabled={loading}
                                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                        {loading ? "Cargando" : "Vista demo"}
                                    </button>
                                </div>
                            </div>

                            {error ? (
                                <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                    <AlertTriangle className="h-4 w-4" />
                                    {error}
                                </div>
                            ) : null}
                        </div>

                        <div className="grid gap-4">
                            <StatCard
                                label="SEO Score"
                                value={scoreLabel}
                                hint="Puntuación de visibilidad técnica"
                                icon={<Globe2 className="h-5 w-5" />}
                            />
                            <StatCard
                                label="GEO Score"
                                value={geoLabel}
                                hint="Presencia / citabilidad en LLMs"
                                icon={<BadgeCheck className="h-5 w-5" />}
                            />
                        </div>
                    </div>
                </section>

                <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
                    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-semibold">Detalle del análisis</h2>
                                <p className="mt-1 text-sm text-white/50">
                                    Aquí luego conectas la respuesta real del backend.
                                </p>
                            </div>
                            {data ? <StatusPill status={data.status} /> : <StatusPill status="idle" />}
                        </div>

                        {data ? (
                            <div className="mt-6 space-y-5">
                                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">URL</p>
                                    <p className="mt-2 break-all text-sm text-white/90">{data.url}</p>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <InfoBlock title="Analysis ID" value={data.analysis_id} />
                                    <InfoBlock title="Word count" value={data.scrape_summary.word_count} />
                                    <InfoBlock
                                        title="H1"
                                        value={data.scrape_summary.h1 || "Sin H1 detectado"}
                                    />
                                    <InfoBlock
                                        title="Meta description"
                                        value={data.scrape_summary.meta_description || "No encontrada"}
                                    />
                                    <InfoBlock
                                        title="FAQ schema"
                                        value={data.scrape_summary.has_faq_schema ? "Sí" : "No"}
                                    />
                                    <InfoBlock
                                        title="Structured data"
                                        value={data.scrape_summary.has_structured_data ? "Sí" : "No"}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="mt-10 grid place-items-center rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-6 py-16 text-center">
                                <div className="max-w-md">
                                    <Sparkles className="mx-auto h-10 w-10 text-cyan-300/80" />
                                    <p className="mt-4 text-lg font-medium">Vista vacía lista para integrar</p>
                                    <p className="mt-2 text-sm text-white/50">
                                        Pulsa “Vista demo” para renderizar un ejemplo visual sin mostrar todavía el
                                        resultado real de tu API.
                                    </p>
                                </div>
                            </div>
                        )}
                    </section>

                    <aside className="space-y-6">
                        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
                            <h3 className="text-lg font-semibold">Estado visual</h3>
                            <div className="mt-4 space-y-3 text-sm text-white/70">
                                <Row label="Imágenes sin alt" value={data?.scrape_summary.images_without_alt ?? "—"} />
                                <Row label="Enlaces internos" value={data?.scrape_summary.internal_links_count ?? "—"} />
                                <Row
                                    label="Disclaimers"
                                    value="Preparado para incluir mensajes regulatorios"
                                />
                            </div>
                        </section>

                        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/15 to-indigo-500/10 p-6 shadow-xl backdrop-blur">
                            <h3 className="text-lg font-semibold">Próximo paso</h3>
                            <p className="mt-2 text-sm text-white/70">
                                Luego puedes enchufar botones de aprobar / rechazar para cumplir el flujo del
                                reto.
                            </p>
                            <div className="mt-5 flex gap-3">
                                <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950">
                                    Aprobar
                                </button>
                                <button className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white">
                                    Rechazar
                                </button>
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        </main>
    );
}

function InfoBlock({ title, value }: { title: string; value: string | number }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/35">{title}</p>
            <p className="mt-2 text-sm leading-6 text-white/90">{value}</p>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <span className="text-white/55">{label}</span>
            <span className="font-medium text-white">{value}</span>
        </div>
    );
}