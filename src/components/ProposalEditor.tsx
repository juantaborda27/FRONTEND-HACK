"use client";

import { useState } from "react";
import {
    CheckCircle2,
    Loader2,
    XCircle,
    AlertTriangle,
    Sparkles,
} from "lucide-react";

import type { MeasureImpactResponse, ProposalPreview } from "../lib/types";

interface Props {
    preview: ProposalPreview | null;
    loading?: boolean;
    actionLoading?: boolean;
    onApprove: () => void;
    onReject: (reason: string) => void;
    impact?: MeasureImpactResponse | null;
    emptyMessage?: string;
}

const SEVERITY_LABEL: Record<string, string> = {
    high: "Alta",
    medium: "Media",
    low: "Baja",
};

const TYPE_LABEL: Record<string, string> = {
    BLOG_POST: "Artículo blog",
    META_DESCRIPTION: "Meta description",
    FAQ_SCHEMA: "FAQ Schema",
    ALT_TEXT_FIX: "Texto ALT",
    SCHEMA_MARKUP: "Schema markup",
    GEO_INSIGHT: "Insight GEO",
};

export default function ProposalEditor({
    preview,
    loading,
    actionLoading,
    onApprove,
    onReject,
    impact,
    emptyMessage = "No hay propuestas pendientes. Ejecuta la auditoría automática.",
}: Props) {
    const [showReject, setShowReject] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectError, setRejectError] = useState<string | null>(null);

    const handleReject = () => {
        const trimmed = rejectReason.trim();
        if (trimmed.length < 3) {
            setRejectError("El motivo debe tener al menos 3 caracteres.");
            return;
        }
        setRejectError(null);
        onReject(trimmed);
        setShowReject(false);
        setRejectReason("");
    };

    if (loading) {
        return <LoadingState />;
    }

    if (!preview) {
        return (
            <section className="rounded-3xl border border-[#d9dceb] bg-white p-8 text-center shadow-sm">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <h3 className="mt-4 text-lg font-bold text-[#1b1f8a]">Cola vacía</h3>
                <p className="mt-2 text-sm text-[#6f7693]">{emptyMessage}</p>
            </section>
        );
    }

    const severityCls =
        preview.severity === "high"
            ? "bg-red-500/30 text-red-100"
            : preview.severity === "medium"
              ? "bg-amber-500/30 text-amber-100"
              : "bg-white/20 text-white/90";

    return (
        <section className="overflow-hidden rounded-3xl bg-[#1b1f8a] text-white shadow-lg">
            <div className="p-6">
                <Badges preview={preview} severityCls={severityCls} />
                <h3 className="mt-4 text-xl font-bold leading-snug">{preview.title}</h3>
                <p className="mt-2 truncate text-sm text-white/70">
                    {preview.analysis_url}
                </p>
            </div>

            <EditorBody
                preview={preview}
                impact={impact}
                showReject={showReject}
                rejectReason={rejectReason}
                rejectError={rejectError}
                actionLoading={actionLoading}
                onApprove={onApprove}
                onRejectReasonChange={setRejectReason}
                onShowReject={() => setShowReject(true)}
                onCancelReject={() => {
                    setShowReject(false);
                    setRejectError(null);
                }}
                onConfirmReject={handleReject}
            />
        </section>
    );
}

function LoadingState() {
    return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-[#d9dceb] bg-white p-10 shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-[#1b1f8a]" />
            <p className="mt-4 text-sm text-[#6f7693]">Cargando propuesta...</p>
        </div>
    );
}

function Badges({
    preview,
    severityCls,
}: {
    preview: ProposalPreview;
    severityCls: string;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                {TYPE_LABEL[preview.proposal_type] ?? preview.proposal_type}
            </span>
            <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${severityCls}`}
            >
                Prioridad {SEVERITY_LABEL[preview.severity] ?? preview.severity}
            </span>
            {preview.pending_count > 0 ? (
                <span className="rounded-full bg-[#d7264f] px-3 py-1 text-xs font-semibold">
                    Quedan {preview.pending_count} por revisar
                </span>
            ) : null}
        </div>
    );
}

function EditorBody({
    preview,
    impact,
    showReject,
    rejectReason,
    rejectError,
    actionLoading,
    onApprove,
    onRejectReasonChange,
    onShowReject,
    onCancelReject,
    onConfirmReject,
}: {
    preview: ProposalPreview;
    impact?: MeasureImpactResponse | null;
    showReject: boolean;
    rejectReason: string;
    rejectError: string | null;
    actionLoading?: boolean;
    onApprove: () => void;
    onRejectReasonChange: (v: string) => void;
    onShowReject: () => void;
    onCancelReject: () => void;
    onConfirmReject: () => void;
}) {
    return (
        <div className="space-y-4 bg-white p-6 text-[#1b1f8a]">
            <p className="text-sm leading-7 text-[#5f6786]">{preview.summary}</p>

            <div className="rounded-2xl border border-[#e4e8f4] bg-[#fafbff] p-3 text-xs text-[#6f7693]">
                {preview.publish_action_label}
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#d9dceb] bg-white">
                <div className="border-b border-[#e5e8f3] bg-[#f8faff] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#7b84a3]">
                    Vista previa en WordPress
                </div>
                <PreviewPanel html={preview.content_html} />
            </div>

            {impact ? (
                <ImpactBlockInner summary={impact.improvement_summary} />
            ) : null}

            {showReject ? (
                <RejectForm
                    rejectReason={rejectReason}
                    rejectError={rejectError}
                    actionLoading={actionLoading}
                    onChange={onRejectReasonChange}
                    onCancel={onCancelReject}
                    onConfirm={onConfirmReject}
                />
            ) : preview.can_review ? (
                <ReviewActions
                    actionLoading={actionLoading}
                    onApprove={onApprove}
                    onShowReject={onShowReject}
                />
            ) : (
                <ReadOnlyNotice />
            )}
        </div>
    );
}

function PreviewPanel({ html }: { html: string }) {
    return (
        <div
            className="max-h-[320px] overflow-y-auto p-4"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

function ImpactBlockInner({ summary }: { summary: string }) {
    return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4" />
                Impacto medido
            </div>
            <p className="mt-2">{summary}</p>
        </div>
    );
}

function ReviewActions({
    actionLoading,
    onApprove,
    onShowReject,
}: {
    actionLoading?: boolean;
    onApprove: () => void;
    onShowReject: () => void;
}) {
    return (
        <div className="flex flex-wrap gap-3">
            <button
                onClick={onApprove}
                disabled={actionLoading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1b1f8a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#151970] disabled:opacity-60 sm:flex-none"
            >
                {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <CheckCircle2 className="h-4 w-4" />
                )}
                Aprobar y publicar
            </button>
            <button
                onClick={onShowReject}
                disabled={actionLoading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#d9dceb] bg-white px-5 py-3 text-sm font-semibold text-[#1b1f8a] transition hover:bg-[#f4f6ff] disabled:opacity-60 sm:flex-none"
            >
                <XCircle className="h-4 w-4" />
                Rechazar
            </button>
        </div>
    );
}

function ReadOnlyNotice() {
    return (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Esta propuesta no está disponible para revisión.
        </div>
    );
}

function RejectForm({
    rejectReason,
    rejectError,
    actionLoading,
    onChange,
    onCancel,
    onConfirm,
}: {
    rejectReason: string;
    rejectError: string | null;
    actionLoading?: boolean;
    onChange: (v: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <label className="text-sm font-medium text-red-800">
                Motivo del rechazo (la IA aprenderá de esto)
            </label>
            <textarea
                value={rejectReason}
                onChange={(e) => onChange(e.target.value)}
                rows={3}
                placeholder="Ej: El tono es muy formal, usa lenguaje más cercano"
                className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-[#1b1f8a] outline-none"
            />
            {rejectError ? (
                <p className="text-xs text-red-600">{rejectError}</p>
            ) : null}
            <div className="flex gap-2">
                <button
                    onClick={onCancel}
                    disabled={actionLoading}
                    className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700"
                >
                    Cancelar
                </button>
                <button
                    onClick={onConfirm}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                    {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <XCircle className="h-4 w-4" />
                    )}
                    Confirmar rechazo
                </button>
            </div>
        </div>
    );
}
