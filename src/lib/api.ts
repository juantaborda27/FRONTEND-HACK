import { AnalyzeResponse, ProbeResult, Proposal } from "./types";

const API = "http://localhost:8000";

export async function analyzeUrl(url: string): Promise<AnalyzeResponse> {
    const res = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
    });

    console.log("Response status:", res.status);
    console.log("Response body:", await res.json());

    if (!res.ok) {
        throw new Error("Error analizando URL");
    }

    return res.json();
}

export async function getAnalysis(id: number) {
    const res = await fetch(`${API}/analyses/${id}`);

    if (!res.ok) {
        throw new Error("Error obteniendo análisis");
    }

    return res.json();
}

export async function runProbe(
    analysisId: number,
    query: string,
): Promise<ProbeResult[]> {
    const res = await fetch(`${API}/probe/run`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },

        body: JSON.stringify({
            analysis_id: analysisId,
            queries: [query],
        }),
    });

    if (!res.ok) {
        throw new Error("Error ejecutando probe");
    }

    return res.json();
}

export async function generateRecommendations(analysisId: number): Promise<{
    proposals_created: number;
    proposals: Proposal[];
}> {
    const res = await fetch(`${API}/agent/recommend`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },

        body: JSON.stringify({
            analysis_id: analysisId,
        }),
    });

    if (!res.ok) {
        throw new Error("Error generando recomendaciones");
    }

    return res.json();
}
