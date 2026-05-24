export type AnalysisStatus = "pending" | "completed" | "failed";
export type ProposalStatus = "pending" | "approved" | "rejected";
export type ProposalType =
    | "BLOG_POST"
    | "META_DESCRIPTION"
    | "FAQ_SCHEMA"
    | "ALT_TEXT_FIX"
    | "SCHEMA_MARKUP"
    | "GEO_INSIGHT";
export type Severity = "high" | "medium" | "low";
export type TriggerSource = "scrape" | "llm_probe" | "gsc";
export type PublishAction =
    | "create_post"
    | "patch_meta"
    | "append_to_post"
    | "update_alt";

export interface ScrapeSummary {
    title: string;
    meta_description: string;
    h1: string;
    word_count: number;
    has_faq_schema: boolean;
    has_structured_data: boolean;
    internal_links_count: number;
    images_without_alt: number;
    scrape_warning: string | null;
}

export interface AnalyzeResponse {
    analysis_id: number;
    url: string;
    seo_score: number;
    geo_score: number;
    status: AnalysisStatus;
    scrape_warning?: string | null;
    scrape_summary: ScrapeSummary;
}

export interface AnalysisItem {
    id: number;
    url: string;
    seo_score: number;
    geo_score: number;
    status: AnalysisStatus;
    created_at: string;
}

export interface PaginatedAnalyses {
    items: AnalysisItem[];
    total: number;
    limit: number;
    offset: number;
}

export interface ProposalDetail {
    id: number;
    analysis_id: number | null;
    proposal_type: ProposalType | string;
    title: string;
    summary: string | null;
    content: string | null;
    severity: Severity;
    trigger_source: TriggerSource | string;
    trigger_query: string | null;
    status: ProposalStatus;
    wp_published_url: string | null;
    wp_published_id: number | null;
    created_at: string;
    reviewed_at: string | null;
}

export interface AnalysisDetail extends AnalysisItem {
    scrape_warning: string | null;
    proposals: Proposal[];
}

export interface RunFullCycleResponse {
    analysis_id: number;
    url: string;
    seo_score?: number | null;
    geo_score?: number | null;
    probe_results_count: number;
    proposals_count: number;
    scrape_summary?: ScrapeSummary | null;
    scrape_warning?: string | null;
    proposals: Proposal[];
}

export interface WordPressPageResult {
    analysis_id: number;
    url: string;
    wp_id: number;
    wp_title: string;
    content_type: string;
    seo_score: number;
    geo_score: number;
    status: AnalysisStatus;
}

export interface WordPressPagesResponse {
    source: string;
    total_found: number;
    analyzed: number;
    failed: number;
    results: WordPressPageResult[];
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
    analysis_id?: number;
    title: string;
    proposal_type: ProposalType | string;
    severity: Severity;
    status: ProposalStatus | string;
    trigger_source: TriggerSource | string;
    summary?: string;
}

export interface RecommendResponse {
    analysis_id: number;
    proposals_created: number;
    proposals: Proposal[];
}

export interface RecommendAllResult {
    analysis_id: number;
    url: string;
    proposals_created: number;
    proposals: Proposal[];
    skipped: boolean;
    error: string | null;
}

export interface RecommendAllResponse {
    total_analyses: number;
    processed: number;
    skipped: number;
    failed: number;
    total_proposals_created: number;
    results: RecommendAllResult[];
}

export interface PaginatedProposals {
    items: Proposal[];
    total: number;
    limit: number;
    offset: number;
}

export interface ProposalPreview {
    id: number;
    analysis_id: number;
    analysis_url: string;
    proposal_type: ProposalType | string;
    title: string;
    summary: string;
    severity: Severity;
    status: ProposalStatus;
    content_raw: string;
    content_html: string;
    publish_action: PublishAction;
    publish_action_label: string;
    target_post_id: number | null;
    wordpress_url: string;
    can_review: boolean;
    pending_count: number;
    approve_url: string;
    reject_url: string;
}

export interface ApproveResponse {
    id: number;
    status: "approved";
    wp_published_url: string | null;
    wp_published_id: number | null;
    reviewed_at: string;
}

export interface MeasureImpactResponse {
    proposal_id: number;
    measurement: {
        llm_mentioned_after: boolean;
        similarity_score_after: number;
        google_position_after: number;
        measured_at: string;
    };
    improvement_summary: string;
}

export interface HealthResponse {
    status: string;
}

export type PipelineStep =
    | "idle"
    | "health"
    | "wordpress"
    | "recommend"
    | "loading_review"
    | "done"
    | "error";
