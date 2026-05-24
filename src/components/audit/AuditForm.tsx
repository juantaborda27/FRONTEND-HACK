"use client";

interface Props {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    loading: boolean;
}

export default function AuditForm({
    value,
    onChange,
    onSubmit,
    loading,
}: Props) {
    return (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
                Auditar sitio web
            </h2>

            <div className="flex gap-4">
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="https://ejemplo.com"
                    className="flex-1 bg-[#1f2937] border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                />

                <button
                    disabled={loading}
                    onClick={onSubmit}
                    className="bg-cyan-500 hover:bg-cyan-400 transition px-6 py-3 rounded-xl font-medium text-black"
                >
                    {loading ? "Analizando..." : "Analizar"}
                </button>
            </div>
        </div>
    );
}