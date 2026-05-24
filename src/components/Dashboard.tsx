"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Sparkles,
    Globe2,
    BadgeCheck,
    AlertTriangle,
    Loader2,
    Zap,
    Activity,
    Clock,
    CheckCircle2,
} from "lucide-react";

import AnalysesTable from "./AnalysesTable";
import ProposalEditor from "./ProposalEditor";

import type {
    AnalysisItem,
    ApproveResponse,
    MeasureImpactResponse,
    PipelineStep,
    ProposalPreview,
} from "../lib/types";

import {
    approveProposal,
    checkHealth,
    DEFAULT_WORDPRESS_URL,
    getNextProposalReview,
    listAnalyses,
    listPendingProposals,
    measureImpact,
    rejectProposal,
    runWordPressPipeline,
} from "../lib/api";

const WORDPRESS_URL = DEFAULT_WORDPRESS_URL.replace(/\/$/, "");

const STEP_LABELS: Record<PipelineStep, string> = {
    idle: "",
    health: "Verificando conexión con el motor GEO...",
    wordpress: "Auditando páginas del sitio WordPress...",
    recommend: "Generando recomendaciones con IA...",
    loading_review: "Preparando cola de revisión...",
    done: "Proceso completado",
    error: "Error en el proceso",
};

export default function Dashboard() {
    const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [apiOnline, setApiOnline] = useState<boolean | null>(null);

    const [preview, setPreview] = useState<ProposalPreview | null>(null);
    const [lastApproved, setLastApproved] = useState<ApproveResponse | null>(
        null,
    );
    const [impact, setImpact] = useState<MeasureImpactResponse | null>(null);

    const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [loadingPipeline, setLoadingPipeline] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [impactLoading, setImpactLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const avgSeo = useMemo(() => {
        if (analyses.length === 0) return null;
        return Math.round(
            analyses.reduce((s, a) => s + a.seo_score, 0) / analyses.length,
        );
    }, [analyses]);

    const avgGeo = useMemo(() => {
        if (analyses.length === 0) return null;
        return Math.round(
            analyses.reduce((s, a) => s + a.geo_score, 0) / analyses.length,
        );
    }, [analyses]);

    const refreshData = useCallback(async () => {
        const [analysesRes, pendingRes] = await Promise.all([
            listAnalyses().catch(() => ({ items: [], total: 0 })),
            listPendingProposals().catch(() => ({ items: [], total: 0 })),
        ]);
        setAnalyses(analysesRes.items);
        setPendingCount(pendingRes.total);
        return pendingRes.total;
    }, []);

    const loadNextProposal = useCallback(async () => {
        setLoadingPreview(true);
        setImpact(null);
        setLastApproved(null);
        try {
            const next = await getNextProposalReview();
            setPreview(next);
        } catch {
            setPreview(null);
        } finally {
            setLoadingPreview(false);
        }
    }, []);

    useEffect(() => {
        async function init() {
            setLoadingInitial(true);
            try {
                const health = await checkHealth();
                setApiOnline(health.status === "ok");
            } catch {
                setApiOnline(false);
            }

            const pending = await refreshData();
            if (pending > 0) {
                await loadNextProposal();
            }
            setLoadingInitial(false);
        }
        init();
    }, [refreshData, loadNextProposal]);

    const handleRunPipeline = async () => {
        setLoadingPipeline(true);
        setError(null);
        setSuccess(null);
        setPipelineStep("health");

        try {
            await checkHealth();
            setPipelineStep("wordpress");

            const { audit, recommend } = await runWordPressPipeline();

            setPipelineStep("recommend");

            if (
                recommend.total_proposals_created === 0 &&
                recommend.failed > 0
            ) {
                throw new Error(
                    "No se generaron propuestas. Verifica la cuota de IA o reintenta.",
                );
            }

            setPipelineStep("loading_review");
            await refreshData();
            await loadNextProposal();

            setPipelineStep("done");
            setSuccess(
                recommend.total_proposals_created > 0
                    ? `Auditoría completada: ${audit.analyzed} páginas analizadas, ${recommend.total_proposals_created} propuestas generadas.`
                    : `Auditoría completada: ${audit.analyzed} páginas analizadas. Sin nuevas propuestas (cuota IA agotada o ya procesadas).`,
            );
        } catch (e) {
            setPipelineStep("error");
            const msg =
                e instanceof Error
                    ? e.message
                    : "No se pudo completar la auditoría automática";

            // Si falló la IA pero el backend respondió, igual refrescamos datos existentes
            await refreshData().catch(() => undefined);

            setError(
                /gemini|cuota|quota/i.test(msg)
                    ? `${msg}\n\nEl frontend y el backend funcionan correctamente. La cuota diaria de Gemini (~20 req/día) está agotada. Puedes revisar propuestas ya generadas o reintentar mañana.`
                    : msg,
            );
        } finally {
            setLoadingPipeline(false);
            setTimeout(() => setPipelineStep("idle"), 4000);
        }
    };

    const handleApprove = async () => {
        if (!preview) return;
        setActionLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await approveProposal(preview.id);
            setLastApproved(result);
            setSuccess(
                result.wp_published_url
                    ? `Publicado en WordPress: ${result.wp_published_url}`
                    : "Propuesta aprobada correctamente.",
            );

            setImpactLoading(true);
            try {
                const impactResult = await measureImpact(preview.id);
                setImpact(impactResult);
            } catch {
                /* impacto opcional */
            } finally {
                setImpactLoading(false);
            }

            const remaining = await refreshData();
            if (remaining > 0) {
                await loadNextProposal();
            } else {
                setPreview(null);
            }
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Error al aprobar propuesta",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (reason: string) => {
        if (!preview) return;
        setActionLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await rejectProposal(preview.id, reason);
            setSuccess("Propuesta rechazada. La IA aprenderá de tu feedback.");

            const remaining = await refreshData();
            if (remaining > 0) {
                await loadNextProposal();
            } else {
                setPreview(null);
            }
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Error al rechazar propuesta",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const isBusy = loadingPipeline || loadingInitial;

    return (
        <main className="min-h-screen bg-[#f5f7fc]">
            <TopBar apiOnline={apiOnline} loadingInitial={loadingInitial} />

            <section className="border-b border-[#dce2f0] bg-white">
                <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[1.2fr_0.8fr]">
                    <HeroPanel
                        isBusy={isBusy}
                        pipelineStep={pipelineStep}
                        error={error}
                        success={success}
                        onRunPipeline={handleRunPipeline}
                    />
                    <div className="grid gap-5">
                        <StatCard
                            label="SEO Score promedio"
                            value={avgSeo !== null ? `${avgSeo}/100` : "—"}
                            hint={`${analyses.length} páginas auditadas`}
                            icon={<Globe2 className="h-5 w-5" />}
                        />
                        <StatCard
                            label="GEO Score promedio"
                            value={avgGeo !== null ? `${avgGeo}/100` : "—"}
                            hint="Visibilidad en motores de IA"
                            icon={<BadgeCheck className="h-5 w-5" />}
                        />
                        <StatCard
                            label="Propuestas pendientes"
                            value={pendingCount}
                            hint="Esperando tu revisión"
                            icon={<Clock className="h-5 w-5" />}
                        />
                    </div>
                </div>
            </section>

            <div className="mx-auto mt-10 grid max-w-7xl gap-8 px-6 pb-14 lg:grid-cols-[1.5fr_0.8fr]">
                <section className="rounded-3xl border border-[#d9dceb] bg-white p-8 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <SectionTitle />
                        <span className="rounded-full bg-[#eef1ff] px-4 py-1.5 text-xs font-semibold text-[#1b1f8a]">
                            {analyses.length} páginas
                        </span>
                    </div>
                    <div className="mt-6">
                        <AnalysesTable items={analyses} loading={loadingInitial} />
                    </div>
                </section>

                <aside className="space-y-6">
                    <ProposalEditor
                        preview={preview}
                        loading={loadingPreview}
                        actionLoading={actionLoading || impactLoading}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        impact={impact}
                        emptyMessage={
                            pendingCount === 0
                                ? "Ejecuta la auditoría automática para generar propuestas."
                                : "Cargando siguiente propuesta..."
                        }
                    />

                    {lastApproved?.wp_published_url ? (
                        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                                <CheckCircle2 className="h-4 w-4" />
                                Última publicación
                            </div>
                            <a
                                href={lastApproved.wp_published_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 block break-all text-xs text-emerald-700 underline"
                            >
                                {lastApproved.wp_published_url}
                            </a>
                        </section>
                    ) : null}

                    <FlowChecklist
                        analysesCount={analyses.length}
                        pendingCount={pendingCount}
                        hasImpact={!!impact}
                    />
                </aside>
            </div>
        </main>
    );
}

function TopBar({
    apiOnline,
    loadingInitial,
}: {
    apiOnline: boolean | null;
    loadingInitial: boolean;
}) {
    return (
        <div className="bg-[#1b1f8a] text-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white/10 px-3 py-1 text-sm font-bold tracking-wide">
                        SERFINANZA
                    </div>
                    <span className="hidden text-sm text-white/70 sm:inline">
                        GEO Copilot · Panel ejecutivo
                    </span>
                </div>
                <StatusBadge online={apiOnline} loading={loadingInitial} />
            </div>
        </div>
    );
}

function SectionTitle() {
    return (
        <div>
            <h2 className="text-2xl font-bold text-[#1b1f8a]">
                Páginas auditadas
            </h2>
            <p className="mt-2 text-sm text-[#69718f]">
                Resultados SEO/GEO del sitio WordPress
            </p>
        </div>
    );
}

function HeroPanel({
    isBusy,
    pipelineStep,
    error,
    success,
    onRunPipeline,
}: {
    isBusy: boolean;
    pipelineStep: PipelineStep;
    error: string | null;
    success: string | null;
    onRunPipeline: () => void;
}) {
    return (
        <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eef1ff] px-4 py-2 text-sm font-medium text-[#1b1f8a]">
                <Sparkles className="h-4 w-4" />
                Plataforma GEO Intelligence
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-tight text-[#1b1f8a] lg:text-5xl">
                Presencia digital en IA y buscadores
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5f6786]">
                Un solo clic audita todo el sitio WordPress, genera
                recomendaciones con IA y prepara la cola de aprobación para
                publicar en Serfinanza.
            </p>

            <div className="mt-8">
                <button
                    onClick={onRunPipeline}
                    disabled={isBusy}
                    className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#d7264f] px-8 py-5 text-lg font-semibold text-white shadow-lg transition hover:bg-[#bc1f44] disabled:opacity-60 sm:w-auto"
                >
                    {isBusy ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                        <Zap className="h-6 w-6" />
                    )}
                    {isBusy
                        ? STEP_LABELS[pipelineStep] || "Procesando..."
                        : "Auditar y optimizar sitio"}
                </button>
            </div>

            {pipelineStep !== "idle" && pipelineStep !== "error" && isBusy ? (
                <PipelineProgress step={pipelineStep} />
            ) : null}

            {error ? <AlertBox type="error" message={error} /> : null}
            {success ? <AlertBox type="success" message={success} /> : null}
        </div>
    );
}

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
                <div className="rounded-xl bg-[#f4f6ff] p-2 text-[#1b1f8a]">{icon}</div>
            </div>
            <div className="mt-4 text-4xl font-bold text-[#1b1f8a]">{value}</div>
            <p className="mt-2 text-sm text-[#6f7693]">{hint}</p>
        </div>
    );
}

function FlowChecklist({
    analysesCount,
    pendingCount,
    hasImpact,
}: {
    analysesCount: number;
    pendingCount: number;
    hasImpact: boolean;
}) {
    return (
        <section className="rounded-3xl border border-[#d9dceb] bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-[#1b1f8a]">Flujo automático</h3>
            <ol className="mt-4 space-y-3 text-sm text-[#6f7693]">
                <FlowStep
                    n={1}
                    label="Auditar sitio WordPress"
                    done={analysesCount > 0}
                />
                <FlowStep
                    n={2}
                    label="Generar recomendaciones IA"
                    done={pendingCount > 0 || analysesCount > 0}
                />
                <FlowStep
                    n={3}
                    label="Revisar y aprobar propuestas"
                    active={pendingCount > 0}
                />
                <FlowStep n={4} label="Medir impacto GEO" done={hasImpact} />
            </ol>
            <p className="mt-4 text-xs text-[#9ca3bf]">
                Sitio: {WORDPRESS_URL.replace(/^https?:\/\//, "")}
            </p>
        </section>
    );
}

function StatusBadge({
    online,
    loading,
}: {
    online: boolean | null;
    loading: boolean;
}) {
    if (loading) {
        return (
            <span className="flex items-center gap-2 text-xs text-white/70">
                <Loader2 className="h-3 w-3 animate-spin" />
                Conectando...
            </span>
        );
    }

    return (
        <span
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                online
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-red-500/20 text-red-200"
            }`}
        >
            <Activity className="h-3 w-3" />
            {online ? "API conectada" : "API desconectada"}
        </span>
    );
}

function PipelineProgress({ step }: { step: PipelineStep }) {
    const steps: PipelineStep[] = [
        "health",
        "wordpress",
        "recommend",
        "loading_review",
        "done",
    ];
    const currentIdx = steps.indexOf(step);

    return (
        <PipelineProgressInner steps={steps} step={step} currentIdx={currentIdx} />
    );
}

function PipelineProgressInner({
    steps,
    step,
    currentIdx,
}: {
    steps: PipelineStep[];
    step: PipelineStep;
    currentIdx: number;
}) {
    return (
        <div className="mt-5 space-y-2 rounded-2xl border border-[#dce2f0] bg-[#fafbff] p-4">
            {steps.map((s, i) => {
                const done = i < currentIdx || step === "done";
                const active = i === currentIdx && step !== "done";
                return (
                    <div
                        key={s}
                        className={`flex items-center gap-3 text-sm ${
                            done
                                ? "text-emerald-600"
                                : active
                                  ? "font-semibold text-[#1b1f8a]"
                                  : "text-[#9ca3bf]"
                        }`}
                    >
                        {done ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                        ) : active ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                            <PipelineDot />
                        )}
                        {STEP_LABELS[s]}
                    </div>
                );
            })}
        </div>
    );
}

function PipelineDot() {
    return (
        <div className="h-4 w-4 shrink-0 rounded-full border-2 border-[#d9dceb]" />
    );
}

function AlertBox({
    type,
    message,
}: {
    type: "error" | "success";
    message: string;
}) {
    const cls =
        type === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700";

    const Icon = type === "error" ? AlertTriangle : CheckCircle2;

    return (
        <div
            className={`mt-5 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm whitespace-pre-line ${cls}`}
        >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            {message}
        </div>
    );
}

function FlowStep({
    n,
    label,
    done,
    active,
}: {
    n: number;
    label: string;
    done?: boolean;
    active?: boolean;
}) {
    return (
        <li className="flex items-center gap-3">
            <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done
                        ? "bg-emerald-100 text-emerald-700"
                        : active
                          ? "bg-[#1b1f8a] text-white"
                          : "bg-[#eef1ff] text-[#7b84a3]"
                }`}
            >
                {done ? "✓" : n}
            </span>
            <span className={active ? "font-semibold text-[#1b1f8a]" : undefined}>
                {label}
            </span>
        </li>
    );
}
