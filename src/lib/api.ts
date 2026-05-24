import type {
    AnalyzeResponse,
    AnalysisDetail,
    ApproveResponse,
    HealthResponse,
    MeasureImpactResponse,
    PaginatedAnalyses,
    PaginatedProposals,
    ProbeResult,
    ProposalDetail,
    ProposalPreview,
    RecommendAllResponse,
    RecommendResponse,
    RunFullCycleResponse,
    RunSiteCycleRequest,
    RunSiteCycleResponse,
    ScheduleConfig,
    ScheduleListResponse,
    ScheduleRunNowResponse,
    ScheduleToggleResponse,
    WordPressPagesResponse,
    WordPressPipelineResult,
} from "./types";

export const DEFAULT_WORDPRESS_URL =
    "https://wordpress-production-d55e.up.railway.app/";

const RAW_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Normaliza base URL: trim, sin slash final, puerto numérico válido */
function normalizeApiBase(raw: string): string {
    const trimmed = raw.trim().replace(/\/+$/, "");
    try {
        const url = new URL(trimmed);
        const portDigits = url.port.match(/^(\d+)/)?.[1];
        if (url.port && portDigits !== url.port) {
            url.port = portDigits ?? "";
        }
        if (url.port && !/^\d+$/.test(url.port)) {
            url.port = "8000";
        }
        return `${url.protocol}//${url.host}`;
    } catch {
        const match = trimmed.match(/^(https?:\/\/[^/\s]+)/i);
        return match?.[1] ?? "http://localhost:8000";
    }
}

const API = normalizeApiBase(RAW_API);

function buildApiUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${API}${normalizedPath}`;
}

const AI_TIMEOUT_MS = 120_000;

function parseApiError(status: number, err: { detail?: unknown }): Error {
    const detail =
        typeof err.detail === "string"
            ? err.detail
            : Array.isArray(err.detail)
              ? err.detail.map((d) => String(d)).join(", ")
              : "Error de API";

    if (
        status === 429 ||
        /gemini|cuota|quota|rate limit/i.test(detail)
    ) {
        return new Error(detail);
    }

    return new Error(detail);
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
        const res = await fetch(buildApiUrl(path), {
            ...options,
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                ...options?.headers,
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw parseApiError(res.status, err);
        }

        return res.json();
    } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
            throw new Error("La operación tardó demasiado. Intenta de nuevo.");
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

export function getApiBaseUrl() {
    return API;
}

export async function checkHealth(): Promise<HealthResponse> {
    return api<HealthResponse>("/health");
}

export async function analyzeUrl(url: string): Promise<AnalyzeResponse> {
    return api<AnalyzeResponse>("/analyze", {
        method: "POST",
        body: JSON.stringify({ url }),
    });
}

/** Una URL → scrape + score + probe + propuestas */
export async function runFullCycle(
    url: string = DEFAULT_WORDPRESS_URL,
): Promise<RunFullCycleResponse> {
    return api<RunFullCycleResponse>("/agent/run-full-cycle", {
        method: "POST",
        body: JSON.stringify({ url }),
    });
}

/** Todo el WordPress → audita páginas/posts y genera propuestas */
export async function runSiteCycle(
    options: RunSiteCycleRequest = {},
): Promise<RunSiteCycleResponse> {
    return api<RunSiteCycleResponse>("/agent/run-site-cycle", {
        method: "POST",
        body: JSON.stringify({
            wordpress_url: options.wordpress_url ?? null,
            include_posts: options.include_posts ?? true,
            status: options.status ?? "publish",
            skip_existing: options.skip_existing ?? true,
        }),
    });
}

/** Dispara el ciclo en background y hace polling hasta que termine */
export async function runWordPressPipeline(): Promise<WordPressPipelineResult> {
    // 1. Disparar ciclo async (devuelve 202 inmediatamente)
    await api("/agent/trigger", { method: "POST", body: JSON.stringify({}) });

    // 2. Polling cada 5s hasta que running=false (máx 4 min)
    const MAX_POLLS = 48;
    for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const status = await api<{
            running: boolean;
            last_result: { analyzed: number; total_proposals_created: number } | null;
            last_error: string | null;
        }>("/agent/trigger/status");

        if (!status.running) {
            if (status.last_error) throw new Error(status.last_error);
            const r = status.last_result ?? { analyzed: 0, total_proposals_created: 0 };
            return {
                audit: { source: "", total_found: r.analyzed, analyzed: r.analyzed, failed: 0 },
                recommend: {
                    total_analyses: r.analyzed,
                    processed: r.analyzed,
                    skipped: 0,
                    failed: 0,
                    total_proposals_created: r.total_proposals_created,
                },
            };
        }
    }
    throw new Error("El ciclo tardó demasiado. Revisa el estado en el servidor.");
}

export async function analyzeWordPressPages(
    wordpressUrl?: string,
    includePosts = true,
): Promise<WordPressPagesResponse> {
    const site = await runSiteCycle({
        wordpress_url: wordpressUrl ?? null,
        include_posts: includePosts,
        status: "publish",
        skip_existing: true,
    });

    return {
        source: site.source,
        total_found: site.total_found,
        analyzed: site.analyzed,
        failed: site.audit_failed,
        results: site.audit_results.map((r) => ({
            analysis_id: r.analysis_id,
            url: r.url,
            wp_id: 0,
            wp_title: r.url,
            content_type: "page",
            seo_score: r.seo_score,
            geo_score: r.geo_score,
            status: r.status,
        })),
    };
}

export async function listAnalyses(
    limit = 50,
    offset = 0,
): Promise<PaginatedAnalyses> {
    return api<PaginatedAnalyses>(
        `/analyses?status=completed&limit=${limit}&offset=${offset}`,
    );
}

export async function getAnalysis(id: number): Promise<AnalysisDetail> {
    return api<AnalysisDetail>(`/analyses/${id}`);
}

export async function runProbe(
    analysisId: number,
    query: string,
): Promise<ProbeResult[]> {
    return api<ProbeResult[]>("/probe/run", {
        method: "POST",
        body: JSON.stringify({
            analysis_id: analysisId,
            queries: [query],
        }),
    });
}

export async function generateRecommendations(
    analysisId: number,
): Promise<RecommendResponse> {
    return api<RecommendResponse>("/agent/recommend", {
        method: "POST",
        body: JSON.stringify({ analysis_id: analysisId }),
    });
}

export async function recommendAll(
    skipExisting = true,
): Promise<RecommendAllResponse> {
    const site = await runSiteCycle({
        wordpress_url: null,
        include_posts: true,
        status: "publish",
        skip_existing: skipExisting,
    });

    return {
        total_analyses: site.total_found,
        processed: site.processed,
        skipped: site.skipped,
        failed: site.recommend_failed,
        total_proposals_created: site.total_proposals_created,
        results: site.recommend_results.map((r) => ({
            analysis_id: r.analysis_id,
            url: r.url,
            proposals_created: r.proposals_created,
            proposals: r.proposals,
            skipped: r.skipped,
            error: r.error,
        })),
    };
}

export async function listPendingProposals(
    limit = 50,
): Promise<PaginatedProposals> {
    return api<PaginatedProposals>(
        `/proposals?status=pending&limit=${limit}&offset=0`,
    );
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function contentToHtml(content: string | null | undefined): string {
    if (!content) {
        return "<p style='color:#6f7693'>Sin contenido de vista previa.</p>";
    }
    const trimmed = content.trim();
    if (trimmed.startsWith("<")) return trimmed;
    return `<pre style="white-space:pre-wrap;font-family:inherit;line-height:1.6;margin:0">${escapeHtml(trimmed)}</pre>`;
}

async function mapProposalToPreview(
    detail: ProposalDetail,
    pendingCount: number,
    analysisUrl: string,
): Promise<ProposalPreview> {
    return {
        id: detail.id,
        analysis_id: detail.analysis_id ?? 0,
        analysis_url: analysisUrl,
        proposal_type: detail.proposal_type,
        title: detail.title,
        summary: detail.summary ?? "",
        severity: detail.severity,
        status: detail.status,
        content_raw: detail.content ?? "",
        content_html: contentToHtml(detail.content),
        publish_action: "append_to_post",
        publish_action_label: "Se publicará en WordPress al aprobar",
        target_post_id: null,
        wordpress_url: DEFAULT_WORDPRESS_URL,
        can_review: detail.status === "pending",
        pending_count: pendingCount,
        approve_url: `/proposals/${detail.id}/approve`,
        reject_url: `/proposals/${detail.id}/reject`,
    };
}

export async function getProposalDetail(id: number): Promise<ProposalDetail> {
    return api<ProposalDetail>(`/proposals/${id}`);
}

/** Llama al endpoint real del backend que devuelve HTML con estilos Serfinanza */
export async function getProposalPreview(id: number): Promise<ProposalPreview> {
    return api<ProposalPreview>(`/proposals/${id}/preview`);
}

export async function getNextProposalReview(): Promise<ProposalPreview> {
    const pending = await listPendingProposals(50);
    if (pending.items.length === 0) {
        throw new Error("Cola vacía");
    }
    // Usa el endpoint de preview real para obtener HTML estilizado
    return getProposalPreview(pending.items[0].id);
}

export async function approveProposal(id: number): Promise<ApproveResponse> {
    return api<ApproveResponse>(`/proposals/${id}/approve`, {
        method: "POST",
    });
}

export async function rejectProposal(
    id: number,
    reason: string,
): Promise<{ id: number; status: string }> {
    return api(`/proposals/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
    });
}

export async function measureImpact(
    id: number,
): Promise<MeasureImpactResponse> {
    return api<MeasureImpactResponse>(`/proposals/${id}/measure-impact`, {
        method: "POST",
    });
}

export async function getGscOpportunities() {
    return api("/gsc/opportunities");
}

// ── Schedules ────────────────────────────────────────────────────────────────

export async function listSchedules(): Promise<ScheduleListResponse> {
    return api<ScheduleListResponse>("/agent/schedules");
}

export async function createSchedule(
    url: string,
    interval_minutes: number,
): Promise<ScheduleConfig> {
    return api<ScheduleConfig>("/agent/schedules", {
        method: "POST",
        body: JSON.stringify({ url, interval_minutes }),
    });
}

export async function pauseSchedule(id: number): Promise<ScheduleToggleResponse> {
    return api<ScheduleToggleResponse>(`/agent/schedules/${id}/pause`, {
        method: "POST",
    });
}

export async function resumeSchedule(id: number): Promise<ScheduleToggleResponse> {
    return api<ScheduleToggleResponse>(`/agent/schedules/${id}/resume`, {
        method: "POST",
    });
}

export async function deleteSchedule(id: number): Promise<void> {
    await api(`/agent/schedules/${id}`, { method: "DELETE" });
}

export async function runScheduleNow(id: number): Promise<ScheduleRunNowResponse> {
    return api<ScheduleRunNowResponse>(`/agent/schedules/${id}/run-now`, {
        method: "POST",
    });
}
