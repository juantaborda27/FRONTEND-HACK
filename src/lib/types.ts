export interface AnalyzeResponse {
    analysis_id: number;
    url: string;
    seo_score: number;
    geo_score: number;
    status: string;

    scrape_summary: {
        title: string;
        meta_description: string;
        h1: string;
        word_count: number;
        has_faq_schema: boolean;
        has_structured_data: boolean;
        internal_links_count: number;
        images_without_alt: number;
    };

    scrape_warning?: string | null;
}

export interface ProbeResult {
    query: string;
    serfinanza_mentioned: boolean;
    competitors_mentioned: string[];
    similarity_score: number;
    needs_content: boolean;
}

export interface Proposal {
    id: number;
    title: string;
    proposal_type: string;
    severity: "high" | "medium" | "low";
    status: string;
    trigger_source: string;
}