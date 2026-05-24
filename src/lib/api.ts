// src/lib/api.ts
export type ScrapeSummary = {
    title: string;
    meta_description: string;
    h1: string;
    word_count: number;
    has_faq_schema: boolean;
    has_structured_data: boolean;
    internal_links_count: number;
    images_without_alt: number;
    scrape_warning: string | null;
};

export type AuditResult = {
    analysis_id: number;
    url: string;
    seo_score: number;
    geo_score: number;
    status: string;
    scrape_summary: ScrapeSummary;
    scrape_warning: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
        cache: "no-store",
    });

    if (!res.ok) {
        const message = await res.text().catch(() => "Error desconocido");
        throw new Error(message || `Error HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
}

export const api = {
    health: () => request<{ ok: boolean }>("/health"),
    getAuditByUrl: (url: string) =>
        request<AuditResult>(`/audit?url=${encodeURIComponent(url)}`),

    // por ahora puedes dejar estos dos listos para cuando conectes acciones reales
    approveAnalysis: (analysisId: number) =>
        request<{ success: boolean }>(`/audit/${analysisId}/approve`, {
            method: "POST",
        }),

    rejectAnalysis: (analysisId: number, reason: string) =>
        request<{ success: boolean }>(`/audit/${analysisId}/reject`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        }),
};
