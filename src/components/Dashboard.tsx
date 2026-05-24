"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
    Search,
    Sparkles,
    Globe2,
    BadgeCheck,
    AlertTriangle,
    Loader2,
    ShieldCheck,
    FileText,
} from "lucide-react";

import type { AnalyzeResponse } from "../lib/types";

import {
    analyzeUrl,
    runProbe,
    generateRecommendations,
} from "../lib/api";

type Props = {
    initialData?: AnalyzeResponse | null;
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
        <div className="rounded-3xl border border-[#d9dceb] bg-white p-6 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#5b6280]">{label}</p>

                <div className="rounded-xl bg-[#f4f6ff] p-2 text-[#1b1f8a]">
                    {icon}
                </div>
            </div>

            <div className="mt-4 text-4xl font-bold text-[#1b1f8a]">
                {value}
            </div>

            <p className="mt-2 text-sm text-[#6f7693]">
                {hint}
            </p>
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const s = status.toLowerCase();

    const cls =
        s === "completed"
            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
            : s === "pending"
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-slate-100 text-slate-700 border border-slate-200";

    return (
        <span
            className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold ${cls}`}
        >
            {status}
        </span>
    );
}

export default function Dashboard({ initialData }: Props) {
    const [url, setUrl] = useState(initialData?.url ?? "");

    const [data, setData] = useState<AnalyzeResponse | null>(
        initialData ?? null
    );

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

    const handleAnalyze = async () => {
        if (!url) return;

        setLoading(true);
        setError(null);

        try {
            // 1. ANALYZE
            const analysis = await analyzeUrl(url);

            console.log("ANALYSIS:", analysis);

            setData(analysis);

            // 2. PROBE
            const probeResults = await runProbe(
                analysis.analysis_id,
                "¿qué tarjeta de crédito me conviene en Colombia?"
            );

            console.log("PROBE:", probeResults);

            // 3. RECOMMEND
            const recommendations =
                await generateRecommendations(
                    analysis.analysis_id
                );

            console.log(
                "RECOMMENDATIONS:",
                recommendations
            );
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : "No se pudo completar la auditoría"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#f5f7fc]">
            {/* TOP BAR */}
            <div className="bg-[#1b1f8a] text-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                        <Image
                            src="https://colombiafintech.co/wp-content/uploads/2025/06/serfinanza.png"
                            alt="Serfinanza"
                            width={180}
                            height={60}
                            priority
                        />
                    </div>
                </div>
            </div>

            {/* HERO */}
            <section className="border-b border-[#dce2f0] bg-white">
                <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[1.2fr_0.8fr]">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-[#eef1ff] px-4 py-2 text-sm font-medium text-[#1b1f8a]">
                            <Sparkles className="h-4 w-4" />
                            Plataforma GEO Intelligence
                        </div>

                        <h1 className="mt-6 text-4xl font-bold leading-tight text-[#1b1f8a] lg:text-6xl">
                            Auditoría SEO y GEO para presencia en IA
                        </h1>

                        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5f6786]">
                            Analiza sitios web, detecta oportunidades SEO/GEO y genera
                            recomendaciones inteligentes para mejorar la citabilidad
                            de Serfinanza en motores de IA y buscadores.
                        </p>

                        {/* SEARCH */}
                        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                            <div className="flex flex-1 items-center rounded-2xl border border-[#d9dceb] bg-white px-4 shadow-sm">
                                <Search className="h-5 w-5 text-[#7a819f]" />

                                <input
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://ejemplo.com"
                                    className="w-full bg-transparent px-3 py-4 text-[#1b1f8a] outline-none placeholder:text-[#9ca3bf]"
                                />
                            </div>

                            <button
                                onClick={handleAnalyze}
                                disabled={loading}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7264f] px-7 py-4 font-semibold text-white transition hover:bg-[#bc1f44] disabled:opacity-60"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <ShieldCheck className="h-5 w-5" />
                                )}

                                {loading ? "Analizando..." : "Auditar sitio"}
                            </button>
                        </div>

                        {error ? (
                            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <AlertTriangle className="h-4 w-4" />
                                {error}
                            </div>
                        ) : null}
                    </div>

                    {/* SCORE CARDS */}
                    <div className="grid gap-5">
                        <StatCard
                            label="SEO Score"
                            value={scoreLabel}
                            hint="Optimización técnica del sitio"
                            icon={<Globe2 className="h-5 w-5" />}
                        />

                        <StatCard
                            label="GEO Score"
                            value={geoLabel}
                            hint="Visibilidad en motores de IA"
                            icon={<BadgeCheck className="h-5 w-5" />}
                        />
                    </div>
                </div>
            </section>

            {/* CONTENT */}
            <div className="mx-auto mt-10 grid max-w-7xl gap-8 px-6 pb-14 lg:grid-cols-[1.5fr_0.8fr]">
                {/* MAIN */}
                <section className="rounded-3xl border border-[#d9dceb] bg-white p-8 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-[#1b1f8a]">
                                Resultado de auditoría
                            </h2>

                            <p className="mt-2 text-sm text-[#69718f]">
                                Información obtenida desde el motor de análisis GEO.
                            </p>
                        </div>

                        {data ? (
                            <StatusPill status={data.status} />
                        ) : (
                            <StatusPill status="idle" />
                        )}
                    </div>

                    {data ? (
                        <div className="mt-8 space-y-6">
                            {/* URL */}
                            <div className="rounded-2xl border border-[#e4e8f4] bg-[#f9faff] p-5">
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7b84a3]">
                                    URL auditada
                                </p>

                                <p className="mt-3 break-all text-sm text-[#1b1f8a]">
                                    {data.url}
                                </p>
                            </div>

                            

                            {/* GRID */}
                            <div className="grid gap-5 md:grid-cols-2">
                                <InfoBlock
                                    title="Título"
                                    value={
                                        data.scrape_summary.title || "No encontrado"
                                    }
                                />

                                <InfoBlock
                                    title="H1"
                                    value={
                                        data.scrape_summary.h1 ||
                                        "No encontrado"
                                    }
                                />

                                <InfoBlock
                                    title="Meta description"
                                    value={
                                        data.scrape_summary.meta_description ||
                                        "No encontrada"
                                    }
                                />

                                <InfoBlock
                                    title="Cantidad de palabras"
                                    value={data.scrape_summary.word_count}
                                />

                                <InfoBlock
                                    title="FAQ Schema"
                                    value={
                                        data.scrape_summary.has_faq_schema
                                            ? "Sí"
                                            : "No"
                                    }
                                />

                                <InfoBlock
                                    title="Structured Data"
                                    value={
                                        data.scrape_summary.has_structured_data
                                            ? "Sí"
                                            : "No"
                                    }
                                />
                            </div>

                            {/* WARNING */}
                            {data.scrape_warning ? (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                    ⚠ {data.scrape_warning}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="mt-10 rounded-3xl border border-dashed border-[#d5daeb] bg-[#fafbff] px-8 py-20 text-center">
                            <FileText className="mx-auto h-14 w-14 text-[#1b1f8a]" />

                            <h3 className="mt-5 text-2xl font-bold text-[#1b1f8a]">
                                Listo para comenzar
                            </h3>

                            <p className="mx-auto mt-3 max-w-md text-[#6b7392]">
                                Ingresa una URL y ejecuta una auditoría GEO
                                para visualizar métricas SEO, citabilidad y
                                recomendaciones inteligentes.
                            </p>
                        </div>
                    )}

                    {
                        url && (
                            <div className="mt-6 overflow-hidden rounded-3xl border border-[#d9dceb] bg-white shadow-sm">
                                <div className="border-b border-[#e5e8f3] bg-[#f8faff] px-4 py-3">
                                    <p className="text-sm font-semibold text-[#1b1f8a]">
                                        Previsualización del sitio
                                    </p>
                                </div>

                                <iframe
                                    src={url}
                                    className="h-[500px] w-full"
                                />
                            </div>
                        )
                    }
                </section>

                {/* SIDEBAR */}
                <aside className="space-y-6">
                    <section className="rounded-3xl border border-[#d9dceb] bg-white p-6 shadow-sm">
                        <h3 className="text-xl font-bold text-[#1b1f8a]">
                            Estado visual
                        </h3>

                        <div className="mt-5 space-y-4">
                            <Row
                                label="Imágenes sin ALT"
                                value={
                                    data?.scrape_summary.images_without_alt ??
                                    "—"
                                }
                            />

                            <Row
                                label="Links internos"
                                value={
                                    data?.scrape_summary
                                        .internal_links_count ?? "—"
                                }
                            />

                            <Row
                                label="Estado GEO"
                                value={
                                    data
                                        ? data.geo_score > 50
                                            ? "Bueno"
                                            : "Mejorable"
                                        : "—"
                                }
                            />
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-3xl bg-[#1b1f8a] p-6 text-white shadow-lg">
                        <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                            IA + SEO
                        </div>

                        <h3 className="mt-4 text-2xl font-bold">
                            Próximo paso
                        </h3>

                        <p className="mt-3 text-sm leading-7 text-white/75">
                            Integra aquí el flujo de aprobación,
                            publicación y seguimiento de propuestas GEO.
                        </p>

                        <div className="mt-6 flex gap-3">
                            <button className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#1b1f8a] transition hover:bg-[#f1f3ff]">
                                Aprobar
                            </button>

                            <button className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20">
                                Rechazar
                            </button>
                        </div>
                    </section>
                </aside>
            </div>
        </main>
    );
}

function InfoBlock({
    title,
    value,
}: {
    title: string;
    value: string | number;
}) {
    return (
        <div className="rounded-2xl border border-[#e3e7f2] bg-[#fafbff] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7b84a3]">
                {title}
            </p>

            <p className="mt-3 text-sm leading-7 text-[#1b1f8a]">
                {value}
            </p>
        </div>
    );
}

function Row({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) {
    return (
        <div className="flex items-center justify-between rounded-2xl border border-[#e5e8f3] bg-[#fafbff] px-4 py-4">
            <span className="text-sm font-medium text-[#6d7594]">
                {label}
            </span>

            <span className="text-sm font-bold text-[#1b1f8a]">
                {value}
            </span>
        </div>
    );
}