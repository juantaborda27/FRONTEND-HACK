"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import ProposalReviewPanel from "./ProposalReviewPanel";
import SchedulesPanel from "./SchedulesPanel";

import type {
    AnalysisItem,
    PipelineStep,
} from "../lib/types";

import {
    checkHealth,
    DEFAULT_WORDPRESS_URL,
    getTriggerStatus,
    listAnalyses,
    listPendingProposals,
    triggerCycle,
} from "../lib/api";

const WORDPRESS_URL = DEFAULT_WORDPRESS_URL.replace(/\/$/, "");

const STEP_LABELS: Record<PipelineStep, string> = {
    idle: "",
    health: "Verificando conexión con el motor GEO...",
    wordpress: "Auditando páginas WordPress...",
    recommend: "Generando propuestas con IA...",
    loading_review: "Cargando propuestas para revisar...",
    done: "¡Proceso completado!",
    error: "Error en el proceso",
};

export default function Dashboard() {
    const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [apiOnline, setApiOnline] = useState<boolean | null>(null);

    const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [loadingPipeline, setLoadingPipeline] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [auditUrl, setAuditUrl] = useState("https://www.bancoserfinanza.com/");

    // Ref para el intervalo de polling — no recrea el componente
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, []);

    const avgSeo = useMemo(() => {
        if (analyses.length === 0) return null;
        return Math.round(analyses.reduce((s, a) => s + a.seo_score, 0) / analyses.length);
    }, [analyses]);

    const avgGeo = useMemo(() => {
        if (analyses.length === 0) return null;
        return Math.round(analyses.reduce((s, a) => s + a.geo_score, 0) / analyses.length);
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

    useEffect(() => {
        async function init() {
            setLoadingInitial(true);
            try {
                const health = await checkHealth();
                setApiOnline(health.status === "ok");
            } catch {
                setApiOnline(false);
            }
            await refreshData();
            setLoadingInitial(false);
        }
        init();
        return () => stopPolling();
    }, [refreshData, stopPolling]);

    const handleRunPipeline = async () => {
        stopPolling();
        setLoadingPipeline(true);
        setError(null);
        setSuccess(null);
        setPipelineStep("health");

        try {
            // Paso 1 — health check
            await checkHealth();
            setApiOnline(true);

            // Paso 2 — disparar ciclo de UNA URL (devuelve 202 inmediato)
            setPipelineStep("wordpress");
            await triggerCycle(auditUrl);

            // Paso 3 — polling cada 5s hasta que el backend termine
            setPipelineStep("recommend");
            let polls = 0;
            const MAX = 72; // 72 × 5s = 6 minutos máx

            await new Promise<void>((resolve, reject) => {
                pollRef.current = setInterval(async () => {
                    polls++;
                    try {
                        const status = await getTriggerStatus();

                        // Actualizar tabla de análisis en cada tick
                        await refreshData().catch(() => undefined);

                        if (!status.running) {
                            stopPolling();
                            if (status.last_error) { reject(new Error(status.last_error)); return; }
                            resolve();
                        } else if (polls >= MAX) {
                            stopPolling();
                            reject(new Error("El ciclo tardó demasiado. Intenta de nuevo."));
                        }
                    } catch (e) {
                        stopPolling();
                        reject(e);
                    }
                }, 5000);
            });

            // Paso 4 — refrescar datos
            setPipelineStep("loading_review");
            const pending = await refreshData();

            setPipelineStep("done");
            setSuccess(`Auditoría completada. ${pending} propuestas listas para revisar.`);

        } catch (e) {
            stopPolling();
            setPipelineStep("error");
            const msg = e instanceof Error ? e.message : "Error en auditoría";
            await refreshData().catch(() => undefined);
            setError(/gemini|cuota|quota/i.test(msg)
                ? `Cuota de Gemini agotada. Revisa las propuestas ya generadas o espera mañana.`
                : msg,
            );
        } finally {
            setLoadingPipeline(false);
            setTimeout(() => setPipelineStep("idle"), 5000);
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
                        auditUrl={auditUrl}
                        onAuditUrlChange={setAuditUrl}
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

            {/* Tabla de análisis + Scheduler */}
            <div className="mx-auto mt-8 grid max-w-7xl gap-6 px-6 lg:grid-cols-[1fr_340px]">
                <section className="rounded-3xl border border-[#d9dceb] bg-white p-7 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <SectionTitle />
                        <span className="rounded-full bg-[#eef1ff] px-4 py-1.5 text-xs font-semibold text-[#1b1f8a]">
                            {analyses.length} páginas
                        </span>
                    </div>
                    <div className="mt-5">
                        <AnalysesTable items={analyses} loading={loadingInitial} />
                    </div>
                </section>
                <aside className="space-y-6">
                    <FlowChecklist
                        analysesCount={analyses.length}
                        pendingCount={pendingCount}
                    />
                    <SchedulesPanel />
                </aside>
            </div>

            {/* Panel de revisión de propuestas */}
            <div className="mx-auto mt-6 max-w-7xl px-6 pb-14">
                <div className="mb-5 flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-[#1b1f8a]">Revisión de propuestas</h2>
                    {pendingCount > 0 && (
                        <span className="rounded-full bg-[#0170B9] px-3 py-1 text-xs font-bold text-white">
                            {pendingCount} pendientes
                        </span>
                    )}
                </div>
                <ProposalReviewPanel onApproved={refreshData} />
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
    auditUrl,
    onAuditUrlChange,
    onRunPipeline,
}: {
    isBusy: boolean;
    pipelineStep: PipelineStep;
    error: string | null;
    success: string | null;
    auditUrl: string;
    onAuditUrlChange: (v: string) => void;
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
                Ingresa una URL, audita con IA y genera propuestas de contenido
                listas para publicar en WordPress.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <input
                    type="url"
                    value={auditUrl}
                    onChange={(e) => onAuditUrlChange(e.target.value)}
                    disabled={isBusy}
                    placeholder="https://www.bancoserfinanza.com/"
                    className="flex-1 rounded-2xl border border-[#d9dceb] px-5 py-4 text-sm text-[#1b1f8a] focus:border-[#1b1f8a] focus:outline-none disabled:opacity-60"
                />
                <button
                    onClick={onRunPipeline}
                    disabled={isBusy || !auditUrl}
                    className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#0170B9] px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-[#015a94] disabled:opacity-60"
                >
                    {isBusy ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Zap className="h-5 w-5" />
                    )}
                    {isBusy ? STEP_LABELS[pipelineStep] || "Procesando..." : "Auditar"}
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
}: {
    analysesCount: number;
    pendingCount: number;
}) {
    return (
        <section className="rounded-3xl border border-[#d9dceb] bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#1b1f8a]">Flujo GEO Copilot</h3>
            <ol className="mt-4 space-y-3 text-sm text-[#6f7693]">
                <FlowStep n={1} label="Auditar URL con IA" done={analysesCount > 0} />
                <FlowStep n={2} label="Generar propuestas" done={pendingCount > 0 || analysesCount > 0} />
                <FlowStep n={3} label="Aprobar y publicar" active={pendingCount > 0} />
                <FlowStep n={4} label="Monitoreo automático" />
            </ol>
            <p className="mt-4 text-xs text-[#9ca3bf]">
                {WORDPRESS_URL.replace(/^https?:\/\//, "")}
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
