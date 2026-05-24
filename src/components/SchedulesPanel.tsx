"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Clock,
    Pause,
    Play,
    Plus,
    RefreshCw,
    Trash2,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    Calendar,
} from "lucide-react";
import type { ScheduleConfig } from "../lib/types";
import {
    createSchedule,
    deleteSchedule,
    listSchedules,
    pauseSchedule,
    resumeSchedule,
    runScheduleNow,
} from "../lib/api";

export default function SchedulesPanel() {
    const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [formUrl, setFormUrl] = useState("https://www.bancoserfinanza.com/");
    const [formMinutes, setFormMinutes] = useState(240);
    const [formLoading, setFormLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await listSchedules();
            setSchedules(res.items);
        } catch {
            // silencioso
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const flash = (msg: string, type: "success" | "error") => {
        if (type === "success") { setSuccess(msg); setError(null); }
        else { setError(msg); setSuccess(null); }
        setTimeout(() => { setSuccess(null); setError(null); }, 5000);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            await createSchedule(formUrl, formMinutes);
            flash(`Monitoreo creado para ${formUrl} cada ${formMinutes} min.`, "success");
            setShowForm(false);
            setFormUrl("https://www.bancoserfinanza.com/");
            setFormMinutes(60);
            await load();
        } catch (err) {
            flash(err instanceof Error ? err.message : "Error al crear schedule", "error");
        } finally {
            setFormLoading(false);
        }
    };

    const handlePause = async (id: number) => {
        setActionId(id);
        try {
            await pauseSchedule(id);
            flash("Monitoreo pausado.", "success");
            await load();
        } catch (err) {
            flash(err instanceof Error ? err.message : "Error", "error");
        } finally {
            setActionId(null);
        }
    };

    const handleResume = async (id: number) => {
        setActionId(id);
        try {
            const res = await resumeSchedule(id);
            flash(res.message, "success");
            await load();
        } catch (err) {
            flash(err instanceof Error ? err.message : "Error", "error");
        } finally {
            setActionId(null);
        }
    };

    const handleRunNow = async (id: number) => {
        setActionId(id);
        try {
            await runScheduleNow(id);
            flash("Ciclo iniciado en background. Revisa la pestaña Auditoría en ~2 minutos.", "success");
            await load();
        } catch (err) {
            flash(err instanceof Error ? err.message : "Error al ejecutar ciclo", "error");
        } finally {
            setActionId(null);
        }
    };

    const handleDelete = async (id: number, url: string) => {
        if (!confirm(`¿Eliminar el monitoreo de ${url}?`)) return;
        setActionId(id);
        try {
            await deleteSchedule(id);
            flash("Monitoreo eliminado.", "success");
            await load();
        } catch (err) {
            flash(err instanceof Error ? err.message : "Error", "error");
        } finally {
            setActionId(null);
        }
    };

    return (
        <section className="rounded-3xl border border-[#d9dceb] bg-white p-6 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-[#1b1f8a]">Monitoreo automático</h3>
                    <p className="mt-1 text-xs text-[#6f7693]">
                        El sistema audita y genera propuestas en cada intervalo
                    </p>
                </div>
                <button
                    onClick={() => setShowForm((v) => !v)}
                    className="flex items-center gap-2 rounded-xl bg-[#1b1f8a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#14177a]"
                >
                    <Plus className="h-4 w-4" />
                    Nuevo
                </button>
            </div>

            {/* Mensajes */}
            {error && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}
            {success && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {success}
                </div>
            )}

            {/* Formulario nuevo schedule */}
            {showForm && (
                <form
                    onSubmit={handleCreate}
                    className="mt-4 rounded-2xl border border-[#dce2f0] bg-[#fafbff] p-4 space-y-3"
                >
                    <p className="text-sm font-semibold text-[#1b1f8a]">Nuevo monitoreo</p>
                    <div>
                        <label className="block text-xs text-[#6f7693] mb-1">URL a monitorear</label>
                        <input
                            type="url"
                            required
                            value={formUrl}
                            onChange={(e) => setFormUrl(e.target.value)}
                            placeholder="https://www.bancoserfinanza.com/"
                            className="w-full rounded-xl border border-[#d9dceb] px-3 py-2 text-sm focus:border-[#1b1f8a] focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-[#6f7693] mb-1">
                            Intervalo (minutos)
                        </label>
                        <input
                            type="number"
                            min={30}
                            max={10080}
                            value={formMinutes}
                            onChange={(e) => setFormMinutes(Number(e.target.value))}
                            className="w-full rounded-xl border border-[#d9dceb] px-3 py-2 text-sm focus:border-[#1b1f8a] focus:outline-none"
                        />
                        <p className="mt-1 text-xs text-[#9ca3bf]">
                            Mínimo 30 min · Recomendado 240 min (4h) · Máximo 10080 min (1 semana)
                        </p>
                        {formMinutes < 120 && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Intervalos cortos agotan la cuota de Gemini (20 req/día). Recomendado: mínimo 4h.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="flex items-center gap-2 rounded-xl bg-[#1b1f8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Crear
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="rounded-xl border border-[#d9dceb] px-4 py-2 text-sm text-[#6f7693] hover:bg-[#f5f7fc]"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            )}

            {/* Lista de schedules */}
            <div className="mt-4 space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-6 text-sm text-[#9ca3bf]">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cargando...
                    </div>
                ) : schedules.length === 0 ? (
                    <div className="py-6 text-center text-sm text-[#9ca3bf]">
                        Sin monitoreos activos. Crea uno con el botón &quot;Nuevo&quot;.
                    </div>
                ) : (
                    schedules.map((s) => (
                        <ScheduleRow
                            key={s.id}
                            schedule={s}
                            busy={actionId === s.id}
                            onPause={() => handlePause(s.id)}
                            onResume={() => handleResume(s.id)}
                            onRunNow={() => handleRunNow(s.id)}
                            onDelete={() => handleDelete(s.id, s.url)}
                        />
                    ))
                )}
            </div>
        </section>
    );
}

function ScheduleRow({
    schedule,
    busy,
    onPause,
    onResume,
    onRunNow,
    onDelete,
}: {
    schedule: ScheduleConfig;
    busy: boolean;
    onPause: () => void;
    onResume: () => void;
    onRunNow: () => void;
    onDelete: () => void;
}) {
    const shortUrl = schedule.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const intervalLabel =
        schedule.interval_minutes < 60
            ? `${schedule.interval_minutes} min`
            : `${Math.round(schedule.interval_minutes / 60)}h`;

    const nextRun = schedule.next_run_at
        ? new Date(schedule.next_run_at).toLocaleTimeString("es-CO", {
              hour: "2-digit",
              minute: "2-digit",
          })
        : null;

    const statusColor =
        schedule.last_run_status === "success"
            ? "text-emerald-600"
            : schedule.last_run_status === "error"
              ? "text-red-500"
              : "text-[#9ca3bf]";

    return (
        <div className="rounded-2xl border border-[#dce2f0] bg-[#fafbff] p-4">
            {/* URL + estado */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1b1f8a]">{shortUrl}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#6f7693]">
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Cada {intervalLabel}
                        </span>
                        {nextRun && schedule.is_active && (
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Próxima: {nextRun}
                            </span>
                        )}
                        {schedule.last_run_status && (
                            <span className={`flex items-center gap-1 ${statusColor}`}>
                                {schedule.last_run_status === "success" ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                    <AlertTriangle className="h-3 w-3" />
                                )}
                                Último: {schedule.last_run_status}
                            </span>
                        )}
                    </div>
                </div>
                {/* Badge activo/pausado */}
                <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        schedule.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                    }`}
                >
                    {schedule.is_active ? "Activo" : "Pausado"}
                </span>
            </div>

            {/* Acciones */}
            <div className="mt-3 flex flex-wrap gap-2">
                {schedule.is_active ? (
                    <ActionButton
                        icon={<Pause className="h-3.5 w-3.5" />}
                        label="Pausar"
                        busy={busy}
                        onClick={onPause}
                        variant="gray"
                    />
                ) : (
                    <ActionButton
                        icon={<Play className="h-3.5 w-3.5" />}
                        label="Reanudar"
                        busy={busy}
                        onClick={onResume}
                        variant="blue"
                    />
                )}
                <ActionButton
                    icon={<RefreshCw className="h-3.5 w-3.5" />}
                    label="Ejecutar ahora"
                    busy={busy}
                    onClick={onRunNow}
                    variant="blue"
                />
                <ActionButton
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    label="Eliminar"
                    busy={busy}
                    onClick={onDelete}
                    variant="red"
                />
            </div>
        </div>
    );
}

function ActionButton({
    icon,
    label,
    busy,
    onClick,
    variant,
}: {
    icon: React.ReactNode;
    label: string;
    busy: boolean;
    onClick: () => void;
    variant: "blue" | "gray" | "red";
}) {
    const cls = {
        blue: "border-[#d0d4f5] bg-[#eef1ff] text-[#1b1f8a] hover:bg-[#e0e4ff]",
        gray: "border-[#d9dceb] bg-white text-[#6f7693] hover:bg-[#f5f7fc]",
        red: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
    }[variant];

    return (
        <button
            onClick={onClick}
            disabled={busy}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${cls}`}
        >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
            {label}
        </button>
    );
}
