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
    WordPressPagesResponse,
} from "./types";

const RAW_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEFAULT_WORDPRESS_URL =
    "https://wordpress-production-d55e.up.railway.app/";

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

            if (res.status === 429) {
                throw new Error("Cuota IA agotada, intenta más tarde");
            }

            throw new Error(
                typeof err.detail === "string"
                    ? err.detail
                    : "Error de API",
            );
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

export async function analyzeWordPressPages(
    wordpressUrl?: string,
    includePosts = true,
): Promise<WordPressPagesResponse> {
    void includePosts;
    const url = wordpressUrl ?? DEFAULT_WORDPRESS_URL;
    const cycle = await runFullCycle(url);
    const analyses = await listAnalyses();
    return {
        source: url,
        total_found: analyses.total,
        analyzed: analyses.total,
        failed: 0,
        results: analyses.items.map((item) => ({
            analysis_id: item.id,
            url: item.url,
            wp_id: 0,
            wp_title: item.url,
            content_type: "page",
            seo_score: item.seo_score,
            geo_score: item.geo_score,
            status: item.status,
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
    const { items, total } = await listAnalyses(50);
    let totalProposals = 0;
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const results: RecommendAllResponse["results"] = [];

    for (const item of items) {
        if (skipExisting) {
            const detail = await getAnalysis(item.id);
            if (detail.proposals.length > 0) {
                skipped++;
                results.push({
                    analysis_id: item.id,
                    url: item.url,
                    proposals_created: 0,
                    proposals: [],
                    skipped: true,
                    error: null,
                });
                continue;
            }
        }

        try {
            const rec = await generateRecommendations(item.id);
            totalProposals += rec.proposals_created;
            processed++;
            results.push({
                analysis_id: item.id,
                url: item.url,
                proposals_created: rec.proposals_created,
                proposals: rec.proposals,
                skipped: false,
                error: null,
            });
        } catch (e) {
            failed++;
            results.push({
                analysis_id: item.id,
                url: item.url,
                proposals_created: 0,
                proposals: [],
                skipped: false,
                error: e instanceof Error ? e.message : "Error",
            });
        }
    }

    return {
        total_analyses: total,
        processed,
        skipped,
        failed,
        total_proposals_created: totalProposals,
        results,
    };
}

export async function runFullCycle(url: string): Promise<RunFullCycleResponse> {
    return api<RunFullCycleResponse>("/agent/run-full-cycle", {
        method: "POST",
        body: JSON.stringify({ url }),
    });
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

export async function getNextProposalReview(): Promise<ProposalPreview> {
    const pending = await listPendingProposals(50);
    if (pending.items.length === 0) {
        throw new Error("Cola vacía");
    }

    const first = pending.items[0];
    const detail = await getProposalDetail(first.id);

    let analysisUrl = "";
    if (detail.analysis_id) {
        try {
            const analysis = await getAnalysis(detail.analysis_id);
            analysisUrl = analysis.url;
        } catch {
            analysisUrl = "";
        }
    }

    return mapProposalToPreview(detail, pending.total, analysisUrl);
}

export async function getProposalPreview(
    id: number,
): Promise<ProposalPreview> {
    const detail = await getProposalDetail(id);
    const pending = await listPendingProposals(50);
    let analysisUrl = "";
    if (detail.analysis_id) {
        try {
            const analysis = await getAnalysis(detail.analysis_id);
            analysisUrl = analysis.url;
        } catch {
            analysisUrl = "";
        }
    }
    return mapProposalToPreview(detail, pending.total, analysisUrl);
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

/** Flujo compatible con backend actual: ciclo completo + recommend en análisis restantes */
export async function runWordPressPipeline() {
    const cycle = await runFullCycle(DEFAULT_WORDPRESS_URL);
    const recommend = await recommendAll(true);

    return {
        audit: {
            source: DEFAULT_WORDPRESS_URL,
            total_found: recommend.total_analyses,
            analyzed: recommend.total_analyses,
            failed: 0,
            results: [],
        },
        recommend: {
            ...recommend,
            total_proposals_created:
                recommend.total_proposals_created + cycle.proposals_count,
        },
    };
}
