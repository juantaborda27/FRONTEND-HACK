"use client";

import { useCallback, useEffect, useState } from "react";
import {
    CheckCircle2,
    XCircle,
    Loader2,
    FileText,
    MessageSquare,
    HelpCircle,
    Image,
    Code2,
    Lightbulb,
    ChevronRight,
    Globe,
    Sparkles,
    AlertTriangle,
} from "lucide-react";
import type { MeasureImpactResponse, ProposalPreview } from "../lib/types";
import {
    approveProposal,
    getProposalPreview,
    listPendingProposals,
    measureImpact,
    rejectProposal,
} from "../lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
    BLOG_POST: "Artículo blog",
    META_DESCRIPTION: "Meta description",
    FAQ_SCHEMA: "FAQ Schema",
    ALT_TEXT_FIX: "Texto ALT",
    SCHEMA_MARKUP: "Schema markup",
    GEO_INSIGHT: "Insight GEO",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
    BLOG_POST: <FileText className="h-4 w-4" />,
    META_DESCRIPTION: <MessageSquare className="h-4 w-4" />,
    FAQ_SCHEMA: <HelpCircle className="h-4 w-4" />,
    ALT_TEXT_FIX: <Image className="h-4 w-4" />,
    SCHEMA_MARKUP: <Code2 className="h-4 w-4" />,
    GEO_INSIGHT: <Lightbulb className="h-4 w-4" />,
};

const SEV_CLS: Record<string, string> = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-emerald-100 text-emerald-700 border-emerald-200",
    HIGH: "bg-red-100 text-red-700 border-red-200",
    MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
    LOW: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const SEV_LABEL: Record<string, string> = {
    high: "Alta", medium: "Media", low: "Baja",
    HIGH: "Alta", MEDIUM: "Media", LOW: "Baja",
};

interface PendingItem {
    id: number;
    title: string;
    proposal_type: string;
    severity: string;
    summary?: string;
}

interface Props {
    onApproved?: () => void;
}

export default function ProposalReviewPanel({ onApproved }: Props) {
    const [items, setItems] = useState<PendingItem[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [preview, setPreview] = useState<ProposalPreview | null>(null);
    const [impact, setImpact] = useState<MeasureImpactResponse | null>(null);

    const [loadingList, setLoadingList] = useState(true);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    const loadList = useCallback(async () => {
        try {
            const res = await listPendingProposals(50);
            setItems(res.items as PendingItem[]);
            return res.items as PendingItem[];
        } catch {
            return [];
        } finally {
            setLoadingList(false);
        }
    }, []);

    useEffect(() => {
        loadList().then((list) => {
            if (list.length > 0 && !selectedId) selectProposal(list[0].id);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectProposal = async (id: number) => {
        setSelectedId(id);
        setPreview(null);
        setImpact(null);
        setShowReject(false);
        setRejectReason("");
        setMsg(null);
        setLoadingPreview(true);
        try {
            const p = await getProposalPreview(id);
            setPreview(p);
        } catch {
            setPreview(null);
        } finally {
            setLoadingPreview(false);
        }
    };

    const flash = (type: "ok" | "err", text: string) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 5000);
    };

    const handleApprove = async () => {
        if (!preview) return;
        setActionLoading(true);
        try {
            const res = await approveProposal(preview.id);
            flash("ok", res.wp_published_url
                ? `Publicado en WordPress: ${res.wp_published_url}`
                : "Propuesta aprobada."
            );
            try { setImpact(await measureImpact(preview.id)); } catch { /* opcional */ }
            const list = await loadList();
            const next = list.find((i) => i.id !== preview.id);
            if (next) selectProposal(next.id);
            else { setSelectedId(null); setPreview(null); }
            onApproved?.();
        } catch (e) {
            flash("err", e instanceof Error ? e.message : "Error al aprobar");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!preview || rejectReason.trim().length < 3) return;
        setActionLoading(true);
        try {
            await rejectProposal(preview.id, rejectReason.trim());
            flash("ok", "Propuesta rechazada. La IA aprenderá de tu feedback.");
            setShowReject(false);
            setRejectReason("");
            const list = await loadList();
            const next = list.find((i) => i.id !== preview.id);
            if (next) selectProposal(next.id);
            else { setSelectedId(null); setPreview(null); }
        } catch (e) {
            flash("err", e instanceof Error ? e.message : "Error al rechazar");
        } finally {
            setActionLoading(false);
        }
    };

    if (!loadingList && items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-[#d9dceb] bg-white p-16 text-center shadow-sm">
                <CheckCircle2 className="h-14 w-14 text-emerald-400" />
                <h3 className="mt-5 text-xl font-bold text-[#1b1f8a]">Cola vacía</h3>
                <p className="mt-2 text-sm text-[#6f7693]">
                    Ejecuta una auditoría para generar nuevas propuestas.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">

            {/* ── Panel izquierdo: preview del contenido ── */}
            <div className="flex flex-col overflow-hidden rounded-3xl border border-[#d9dceb] bg-white shadow-sm">

                {/* Header */}
                <div className="border-b border-[#eef1ff] bg-[#f8faff] px-7 py-5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-widest text-[#0170B9]">
                                Vista previa del contenido
                            </p>
                            {preview && (
                                <h2 className="mt-1 truncate text-xl font-bold text-[#1b1f8a]">
                                    {preview.title}
                                </h2>
                            )}
                        </div>
                        {preview && (
                            <div className="flex shrink-0 flex-wrap gap-2">
                                <span className="flex items-center gap-1.5 rounded-full bg-[#eef1ff] px-3 py-1 text-xs font-semibold text-[#1b1f8a]">
                                    {TYPE_ICON[preview.proposal_type] ?? <FileText className="h-3.5 w-3.5" />}
                                    {TYPE_LABEL[preview.proposal_type] ?? preview.proposal_type}
                                </span>
                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${SEV_CLS[preview.severity] ?? "bg-gray-100 text-gray-600"}`}>
                                    {SEV_LABEL[preview.severity] ?? preview.severity}
                                </span>
                            </div>
                        )}
                    </div>

                    {preview?.analysis_url && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-[#6f7693]">
                            <Globe className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{preview.analysis_url}</span>
                        </div>
                    )}
                </div>

                {/* Contenido HTML */}
                <div className="flex-1 overflow-y-auto p-7">
                    {loadingPreview ? (
                        <div className="flex h-60 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-[#0170B9]" />
                        </div>
                    ) : preview ? (
                        <>
                            {preview.summary && (
                                <div className="mb-5 rounded-2xl border border-[#dce2f0] bg-[#f8faff] px-5 py-4">
                                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0170B9]">
                                        <Sparkles className="h-3.5 w-3.5" /> Resumen IA
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed text-[#4B4F58]">{preview.summary}</p>
                                </div>
                            )}
                            <div
                                className="prose prose-sm max-w-none text-sm leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: preview.content_html }}
                            />
                            {impact && (
                                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                                        <Sparkles className="h-4 w-4" /> Impacto medido
                                    </p>
                                    <p className="mt-2 text-sm text-emerald-700">{impact.improvement_summary}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex h-60 items-center justify-center text-sm text-[#9ca3bf]">
                            Selecciona una propuesta de la lista para ver su contenido.
                        </div>
                    )}
                </div>

                {/* Footer: acciones */}
                {preview?.can_review && (
                    <div className="border-t border-[#eef1ff] bg-white px-7 py-5">
                        {msg && (
                            <div className={`mb-4 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                {msg.type === "ok"
                                    ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    : <AlertTriangle className="h-4 w-4 shrink-0" />}
                                {msg.text}
                            </div>
                        )}

                        {showReject ? (
                            <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                                <p className="text-sm font-medium text-red-800">
                                    Motivo del rechazo (la IA aprenderá)
                                </p>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    rows={3}
                                    placeholder="Ej: El tono es muy formal, usa lenguaje más cercano al cliente"
                                    className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-[#1b1f8a] outline-none"
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => setShowReject(false)}
                                        className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700">
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleReject}
                                        disabled={actionLoading || rejectReason.trim().length < 3}
                                        className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                    >
                                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                        Confirmar rechazo
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={handleApprove}
                                    disabled={actionLoading}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0170B9] px-6 py-3.5 text-sm font-semibold text-white shadow transition hover:bg-[#015a94] disabled:opacity-60 sm:flex-none"
                                >
                                    {actionLoading
                                        ? <Loader2 className="h-5 w-5 animate-spin" />
                                        : <CheckCircle2 className="h-5 w-5" />}
                                    Aprobar y publicar en WordPress
                                </button>
                                <button
                                    onClick={() => setShowReject(true)}
                                    disabled={actionLoading}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#d9dceb] bg-white px-6 py-3.5 text-sm font-semibold text-[#4B4F58] transition hover:bg-[#f5f7fc] disabled:opacity-60 sm:flex-none"
                                >
                                    <XCircle className="h-5 w-5" />
                                    Rechazar
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Panel derecho: lista de tarjetas ── */}
            <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "75vh" }}>
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold text-[#1b1f8a]">Propuestas pendientes</h3>
                    <span className="rounded-full bg-[#0170B9] px-2.5 py-0.5 text-xs font-bold text-white">
                        {items.length}
                    </span>
                </div>

                {loadingList ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-[#0170B9]" />
                    </div>
                ) : (
                    items.map((item) => (
                        <ProposalCard
                            key={item.id}
                            item={item}
                            selected={item.id === selectedId}
                            onClick={() => selectProposal(item.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function ProposalCard({
    item,
    selected,
    onClick,
}: {
    item: PendingItem;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full rounded-2xl border p-4 text-left transition ${
                selected
                    ? "border-[#0170B9] bg-[#eef6fd] shadow-md"
                    : "border-[#d9dceb] bg-white hover:border-[#0170B9] hover:bg-[#f8faff] hover:shadow-sm"
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-[#0170B9] text-white" : "bg-[#eef1ff] text-[#0170B9]"}`}>
                        {TYPE_ICON[item.proposal_type] ?? <FileText className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1b1f8a]">
                            {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6f7693]">
                            {TYPE_LABEL[item.proposal_type] ?? item.proposal_type}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${SEV_CLS[item.severity] ?? "bg-gray-100 text-gray-600"}`}>
                        {SEV_LABEL[item.severity] ?? item.severity}
                    </span>
                    <ChevronRight className={`h-4 w-4 transition ${selected ? "text-[#0170B9]" : "text-[#9ca3bf]"}`} />
                </div>
            </div>
            {item.summary && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#6f7693]">
                    {item.summary}
                </p>
            )}
        </button>
    );
}
