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
    Trash2,
    LayoutDashboard,
    SearchCheck,
    FileText,
    CalendarClock,
    Link2,
    Globe,
} from "lucide-react";

import AnalysesTable from "./AnalysesTable";
import ProposalReviewPanel from "./ProposalReviewPanel";
import SchedulesPanel from "./SchedulesPanel";

import type { AnalysisItem, PipelineStep } from "../lib/types";

import {
    checkHealth,
    DEFAULT_WORDPRESS_URL,
    getTriggerStatus,
    listAnalyses,
    listPendingProposals,
    resetDatabase,
    runSiteCycle,
    triggerCycle,
} from "../lib/api";

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = "inicio" | "auditoria" | "propuestas" | "automatizacion";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "inicio",         label: "Inicio",         icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "auditoria",      label: "Auditoría",      icon: <SearchCheck className="h-4 w-4" /> },
    { id: "propuestas",     label: "Propuestas",     icon: <FileText className="h-4 w-4" /> },
    { id: "automatizacion", label: "Automatización", icon: <CalendarClock className="h-4 w-4" /> },
];

// ─── Pipeline labels ──────────────────────────────────────────────────────────

const STEP_LABELS: Record<PipelineStep, string> = {
    idle:         "",
    health:       "Verificando conexión con el motor GEO...",
    wordpress:    "Auditando páginas WordPress...",
    recommend:    "Generando propuestas con IA...",
    loading_review: "Cargando propuestas para revisar...",
    done:         "¡Proceso completado!",
    error:        "Error en el proceso",
};

const WORDPRESS_URL = DEFAULT_WORDPRESS_URL.replace(/\/$/, "");

// ─── Root component ───────────────────────────────────────────────────────────

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState<TabId>("inicio");
    const [analyses, setAnalyses]   = useState<AnalysisItem[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [apiOnline, setApiOnline]   = useState<boolean | null>(null);

    const [pipelineStep, setPipelineStep]     = useState<PipelineStep>("idle");
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [loadingPipeline, setLoadingPipeline] = useState(false);

    const [error,   setError]   = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [resetting, setResetting] = useState(false);

    // Audit settings
    const [auditMode, setAuditMode] = useState<"url" | "site">("url");
    const [auditUrl,  setAuditUrl]  = useState("https://www.bancoserfinanza.com/");

    const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, []);

    // ── Derived stats ──────────────────────────────────────────────────────────
    const avgSeo = useMemo(() => {
        const valid = analyses.filter(a => a.seo_score != null);
        if (!valid.length) return null;
        return Math.round(valid.reduce((s, a) => s + (a.seo_score ?? 0), 0) / valid.length);
    }, [analyses]);

    const avgGeo = useMemo(() => {
        const valid = analyses.filter(a => a.geo_score != null);
        if (!valid.length) return null;
        return Math.round(valid.reduce((s, a) => s + (a.geo_score ?? 0), 0) / valid.length);
    }, [analyses]);

    // ── Data refresh ───────────────────────────────────────────────────────────
    const refreshData = useCallback(async () => {
        const [ar, pr] = await Promise.all([
            listAnalyses().catch(() => ({ items: [], total: 0 })),
            listPendingProposals().catch(() => ({ items: [], total: 0 })),
        ]);
        setAnalyses(ar.items);
        setPendingCount(pr.total);
        return pr.total;
    }, []);

    useEffect(() => {
        async function init() {
            setLoadingInitial(true);
            try {
                const h = await checkHealth();
                setApiOnline(h.status === "ok");
            } catch { setApiOnline(false); }
            await refreshData();
            setLoadingInitial(false);
        }
        init();
        return () => stopPolling();
    }, [refreshData, stopPolling]);

    // ── Reset DB ───────────────────────────────────────────────────────────────
    const handleReset = async () => {
        if (!window.confirm("¿Limpiar TODA la base de datos? Se eliminarán análisis y propuestas.")) return;
        setResetting(true);
        setError(null); setSuccess(null);
        try {
            const res = await resetDatabase();
            await refreshData();
            setSuccess(res.message);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al limpiar la base de datos");
        } finally { setResetting(false); }
    };

    // ── Run pipeline ───────────────────────────────────────────────────────────
    const handleRunPipeline = async () => {
        stopPolling();
        setLoadingPipeline(true);
        setError(null); setSuccess(null);
        setPipelineStep("health");

        try {
            await checkHealth();
            setApiOnline(true);

            if (auditMode === "site") {
                // ── Modo: Sitio completo (síncrono) ───────────────────────────
                setPipelineStep("wordpress");
                const result = await runSiteCycle({
                    wordpress_url: auditUrl || null,
                    include_posts: true,
                    status: "publish",
                    skip_existing: false,
                });
                setPipelineStep("loading_review");
                const pending = await refreshData();
                setPipelineStep("done");
                setSuccess(
                    `Sitio completo: ${result.analyzed} páginas auditadas · ${result.total_proposals_created} propuestas generadas · ${pending} pendientes de revisión.`
                );
            } else {
                // ── Modo: URL específica (asíncrono + polling) ────────────────
                setPipelineStep("wordpress");
                await triggerCycle(auditUrl);

                setPipelineStep("recommend");
                let polls = 0;
                const MAX = 72; // 72 × 5 s = 6 min máx

                await new Promise<void>((resolve, reject) => {
                    pollRef.current = setInterval(async () => {
                        polls++;
                        try {
                            const st = await getTriggerStatus();
                            await refreshData().catch(() => undefined);
                            if (!st.running) {
                                stopPolling();
                                if (st.last_error) { reject(new Error(st.last_error)); return; }
                                resolve();
                            } else if (polls >= MAX) {
                                stopPolling();
                                reject(new Error("El ciclo tardó demasiado. Intenta de nuevo."));
                            }
                        } catch (e) { stopPolling(); reject(e); }
                    }, 5000);
                });

                setPipelineStep("loading_review");
                const pending = await refreshData();
                setPipelineStep("done");
                setSuccess(`Auditoría completada. ${pending} propuestas listas para revisar.`);
            }
        } catch (e) {
            stopPolling();
            setPipelineStep("error");
            const msg = e instanceof Error ? e.message : "Error en auditoría";
            await refreshData().catch(() => undefined);
            setError(/gemini|cuota|quota/i.test(msg)
                ? "Cuota de Gemini agotada. Revisa las propuestas ya generadas o espera mañana."
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
            {/* ── Top bar ── */}
            <TopBar apiOnline={apiOnline} loadingInitial={loadingInitial} />

            {/* ── Tab navigation ── */}
            <TabNav
                active={activeTab}
                onChange={setActiveTab}
                pendingCount={pendingCount}
            />

            {/* ══════════════════════════ INICIO ══════════════════════════ */}
            {activeTab === "inicio" && (
                <section className="mx-auto max-w-7xl px-6 py-10">
                    {/* Hero intro */}
                    <div className="mb-8 flex flex-col gap-2">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#eef1ff] px-4 py-2 text-sm font-medium text-[#1b1f8a]">
                            <Sparkles className="h-4 w-4" />
                            Plataforma GEO Intelligence · Banco Serfinanza
                        </div>
                        <h1 className="text-3xl font-bold text-[#1b1f8a] lg:text-4xl">
                            Presencia digital en motores de IA y buscadores
                        </h1>
                        <p className="max-w-2xl text-base leading-7 text-[#5f6786]">
                            Audita cualquier URL, genera propuestas de contenido con IA y publícalas directamente en WordPress. Monitorea tu visibilidad en ChatGPT, Gemini y Perplexity.
                        </p>
                    </div>

                    {/* Stat cards */}
                    <div className="grid gap-5 sm:grid-cols-3">
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

                    {/* Flow checklist */}
                    <div className="mt-8 max-w-sm">
                        <FlowChecklist analysesCount={analyses.length} pendingCount={pendingCount} />
                    </div>

                    {/* Quick-action cards */}
                    <div className="mt-8 grid gap-4 sm:grid-cols-3">
                        <QuickAction
                            title="Auditar URL"
                            desc="Analiza una página específica y genera propuestas de contenido."
                            icon={<SearchCheck className="h-5 w-5" />}
                            onClick={() => setActiveTab("auditoria")}
                        />
                        <QuickAction
                            title="Revisar propuestas"
                            desc={`${pendingCount} propuesta${pendingCount !== 1 ? "s" : ""} esperando aprobación.`}
                            icon={<FileText className="h-5 w-5" />}
                            badge={pendingCount > 0 ? String(pendingCount) : undefined}
                            onClick={() => setActiveTab("propuestas")}
                        />
                        <QuickAction
                            title="Automatización"
                            desc="Configura monitoreo continuo del sitio con schedules automáticos."
                            icon={<CalendarClock className="h-5 w-5" />}
                            onClick={() => setActiveTab("automatizacion")}
                        />
                    </div>
                </section>
            )}

            {/* ══════════════════════════ AUDITORÍA ══════════════════════════ */}
            {activeTab === "auditoria" && (
                <section className="mx-auto max-w-7xl px-6 py-10">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-[#1b1f8a]">Auditoría SEO / GEO</h2>
                        <p className="mt-1 text-sm text-[#69718f]">Elige el alcance y lanza la auditoría.</p>
                    </div>

                    {/* Audit card */}
                    <div className="rounded-3xl border border-[#d9dceb] bg-white p-8 shadow-sm">
                        {/* Mode selector */}
                        <div className="mb-6">
                            <p className="mb-3 text-sm font-semibold text-[#1b1f8a]">Alcance de la auditoría</p>
                            <div className="inline-flex rounded-2xl border border-[#d9dceb] p-1">
                                <ModeBtn
                                    active={auditMode === "url"}
                                    icon={<Link2 className="h-4 w-4" />}
                                    label="URL específica"
                                    desc="Audita una sola página"
                                    onClick={() => setAuditMode("url")}
                                />
                                <ModeBtn
                                    active={auditMode === "site"}
                                    icon={<Globe className="h-4 w-4" />}
                                    label="Sitio completo"
                                    desc="Todas las páginas WordPress"
                                    onClick={() => setAuditMode("site")}
                                />
                            </div>
                            {auditMode === "site" && (
                                <p className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 w-fit">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    Puede tardar 2-5 min. En Render free tier puede agotar el tiempo.
                                    Recomendado usar en local o con la Automatización.
                                </p>
                            )}
                        </div>

                        {/* URL input */}
                        <div className="mb-6">
                            <label className="mb-2 block text-sm font-semibold text-[#1b1f8a]">
                                {auditMode === "url" ? "URL a auditar" : "URL base del sitio WordPress"}
                            </label>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <input
                                    type="url"
                                    value={auditUrl}
                                    onChange={(e) => setAuditUrl(e.target.value)}
                                    disabled={isBusy}
                                    placeholder={auditMode === "url"
                                        ? "https://www.bancoserfinanza.com/"
                                        : "https://wordpress-production-d55e.up.railway.app/"}
                                    className="flex-1 rounded-2xl border border-[#d9dceb] px-5 py-4 text-sm text-[#1b1f8a] focus:border-[#1b1f8a] focus:outline-none disabled:opacity-60"
                                />
                                <button
                                    onClick={handleRunPipeline}
                                    disabled={isBusy || !auditUrl}
                                    className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#0170B9] px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-[#015a94] disabled:opacity-60"
                                >
                                    {isBusy
                                        ? <Loader2 className="h-5 w-5 animate-spin" />
                                        : <Zap className="h-5 w-5" />}
                                    {isBusy
                                        ? (STEP_LABELS[pipelineStep] || "Procesando...")
                                        : (auditMode === "site" ? "Auditar sitio" : "Auditar URL")}
                                </button>
                                <button
                                    onClick={handleReset}
                                    disabled={isBusy || resetting}
                                    title="Limpiar base de datos"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 py-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                                >
                                    {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    Limpiar BD
                                </button>
                            </div>
                        </div>

                        {/* Pipeline progress */}
                        {pipelineStep !== "idle" && pipelineStep !== "error" && isBusy && (
                            <PipelineProgress step={pipelineStep} />
                        )}

                        {error   && <AlertBox type="error"   message={error} />}
                        {success && <AlertBox type="success" message={success} />}
                    </div>

                    {/* Results table */}
                    <div className="mt-8 rounded-3xl border border-[#d9dceb] bg-white p-7 shadow-sm">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-[#1b1f8a]">Páginas auditadas</h3>
                                <p className="mt-1 text-sm text-[#69718f]">Resultados SEO/GEO del sitio WordPress</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {avgSeo !== null && (
                                    <span className="rounded-full bg-[#e6f4ff] px-3 py-1 text-xs font-semibold text-[#0170B9]">
                                        SEO prom. {avgSeo}/100
                                    </span>
                                )}
                                {avgGeo !== null && (
                                    <span className="rounded-full bg-[#eef1ff] px-3 py-1 text-xs font-semibold text-[#1b1f8a]">
                                        GEO prom. {avgGeo}/100
                                    </span>
                                )}
                                <span className="rounded-full bg-[#eef1ff] px-4 py-1.5 text-xs font-semibold text-[#1b1f8a]">
                                    {analyses.length} páginas
                                </span>
                            </div>
                        </div>
                        <AnalysesTable items={analyses} loading={loadingInitial} />
                    </div>
                </section>
            )}

            {/* ══════════════════════════ PROPUESTAS ══════════════════════════ */}
            {activeTab === "propuestas" && (
                <section className="mx-auto max-w-7xl px-6 py-10">
                    <div className="mb-6 flex items-center gap-3">
                        <div>
                            <h2 className="text-2xl font-bold text-[#1b1f8a]">Revisión de propuestas</h2>
                            <p className="mt-1 text-sm text-[#69718f]">
                                Aprueba o rechaza el contenido generado por la IA antes de publicarlo en WordPress.
                            </p>
                        </div>
                        {pendingCount > 0 && (
                            <span className="rounded-full bg-[#0170B9] px-3 py-1 text-xs font-bold text-white">
                                {pendingCount} pendientes
                            </span>
                        )}
                    </div>
                    <ProposalReviewPanel onApproved={refreshData} />
                </section>
            )}

            {/* ══════════════════════════ AUTOMATIZACIÓN ══════════════════════════ */}
            {activeTab === "automatizacion" && (
                <section className="mx-auto max-w-7xl px-6 py-10">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-[#1b1f8a]">Automatización</h2>
                        <p className="mt-1 text-sm text-[#69718f]">
                            Configura monitoreos automáticos. El sistema auditará las URLs y generará propuestas periódicamente.
                        </p>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                        <SchedulesPanel />
                        <div className="space-y-5">
                            <FlowChecklist analysesCount={analyses.length} pendingCount={pendingCount} />
                            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                                <p className="font-semibold mb-1">⚠️ Consejo para el demo</p>
                                <p>Pausa todos los schedules antes de hacer una auditoría manual para evitar conflictos de cuota en Gemini. Reactívalos después.</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </main>
    );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

function TopBar({ apiOnline, loadingInitial }: { apiOnline: boolean | null; loadingInitial: boolean }) {
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

// ─── Tab navigation ───────────────────────────────────────────────────────────

function TabNav({
    active,
    onChange,
    pendingCount,
}: {
    active: TabId;
    onChange: (t: TabId) => void;
    pendingCount: number;
}) {
    return (
        <div className="sticky top-0 z-30 border-b border-[#dce2f0] bg-white shadow-sm">
            <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-6">
                {TABS.map((tab) => {
                    const isActive = active === tab.id;
                    const badge = tab.id === "propuestas" && pendingCount > 0 ? pendingCount : null;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onChange(tab.id)}
                            className={`relative flex shrink-0 items-center gap-2 px-4 py-4 text-sm font-medium transition-colors ${
                                isActive
                                    ? "text-[#0170B9] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#0170B9]"
                                    : "text-[#6b7280] hover:text-[#1b1f8a]"
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                            {badge !== null && (
                                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0170B9] text-[10px] font-bold text-white">
                                    {badge > 9 ? "9+" : badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Mode button ──────────────────────────────────────────────────────────────

function ModeBtn({
    active,
    icon,
    label,
    desc,
    onClick,
}: {
    active: boolean;
    icon: React.ReactNode;
    label: string;
    desc: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 rounded-xl px-5 py-3 text-left transition ${
                active
                    ? "bg-[#0170B9] text-white shadow-sm"
                    : "text-[#6b7280] hover:text-[#1b1f8a]"
            }`}
        >
            {icon}
            <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className={`block text-xs ${active ? "text-white/70" : "text-[#9ca3af]"}`}>{desc}</span>
            </span>
        </button>
    );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, hint, icon }: {
    label: string; value: string | number; hint: string; icon: React.ReactNode;
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

// ─── QuickAction ──────────────────────────────────────────────────────────────

function QuickAction({
    title, desc, icon, badge, onClick,
}: {
    title: string; desc: string; icon: React.ReactNode; badge?: string; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="group relative flex w-full flex-col items-start gap-3 rounded-3xl border border-[#d9dceb] bg-white p-6 text-left shadow-sm transition hover:border-[#0170B9] hover:shadow-md"
        >
            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#e6f4ff] p-2 text-[#0170B9]">{icon}</div>
                {badge && (
                    <span className="rounded-full bg-[#0170B9] px-2.5 py-0.5 text-xs font-bold text-white">
                        {badge}
                    </span>
                )}
            </div>
            <div>
                <p className="font-semibold text-[#1b1f8a] group-hover:text-[#0170B9] transition-colors">{title}</p>
                <p className="mt-1 text-sm text-[#6f7693]">{desc}</p>
            </div>
        </button>
    );
}

// ─── FlowChecklist ────────────────────────────────────────────────────────────

function FlowChecklist({ analysesCount, pendingCount }: { analysesCount: number; pendingCount: number }) {
    return (
        <section className="rounded-3xl border border-[#d9dceb] bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#1b1f8a]">Flujo GEO Copilot</h3>
            <ol className="mt-4 space-y-3 text-sm text-[#6f7693]">
                <FlowStep n={1} label="Auditar URL con IA"    done={analysesCount > 0} />
                <FlowStep n={2} label="Generar propuestas"    done={pendingCount > 0 || analysesCount > 0} />
                <FlowStep n={3} label="Aprobar y publicar"    active={pendingCount > 0} />
                <FlowStep n={4} label="Monitoreo automático" />
            </ol>
            <p className="mt-4 text-xs text-[#9ca3bf]">
                {WORDPRESS_URL.replace(/^https?:\/\//, "")}
            </p>
        </section>
    );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ online, loading }: { online: boolean | null; loading: boolean }) {
    if (loading) {
        return (
            <span className="flex items-center gap-2 text-xs text-white/70">
                <Loader2 className="h-3 w-3 animate-spin" />
                Conectando...
            </span>
        );
    }
    return (
        <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            online ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"
        }`}>
            <Activity className="h-3 w-3" />
            {online ? "API conectada" : "API desconectada"}
        </span>
    );
}

// ─── PipelineProgress ─────────────────────────────────────────────────────────

function PipelineProgress({ step }: { step: PipelineStep }) {
    const steps: PipelineStep[] = ["health", "wordpress", "recommend", "loading_review", "done"];
    const idx = steps.indexOf(step);
    return (
        <div className="mt-5 space-y-2 rounded-2xl border border-[#dce2f0] bg-[#fafbff] p-4">
            {steps.map((s, i) => {
                const done   = i < idx || step === "done";
                const active = i === idx && step !== "done";
                return (
                    <div key={s} className={`flex items-center gap-3 text-sm ${
                        done ? "text-emerald-600" : active ? "font-semibold text-[#1b1f8a]" : "text-[#9ca3bf]"
                    }`}>
                        {done   ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                         : active ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                         : <div className="h-4 w-4 shrink-0 rounded-full border-2 border-[#d9dceb]" />}
                        {STEP_LABELS[s]}
                    </div>
                );
            })}
        </div>
    );
}

// ─── AlertBox ─────────────────────────────────────────────────────────────────

function AlertBox({ type, message }: { type: "error" | "success"; message: string }) {
    const cls = type === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
    const Icon = type === "error" ? AlertTriangle : CheckCircle2;
    return (
        <div className={`mt-5 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm whitespace-pre-line ${cls}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            {message}
        </div>
    );
}

// ─── FlowStep ─────────────────────────────────────────────────────────────────

function FlowStep({ n, label, done, active }: { n: number; label: string; done?: boolean; active?: boolean }) {
    return (
        <li className="flex items-center gap-3">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done   ? "bg-emerald-100 text-emerald-700"
                : active ? "bg-[#1b1f8a] text-white"
                : "bg-[#eef1ff] text-[#7b84a3]"
            }`}>
                {done ? "✓" : n}
            </span>
            <span className={active ? "font-semibold text-[#1b1f8a]" : undefined}>{label}</span>
        </li>
    );
}
