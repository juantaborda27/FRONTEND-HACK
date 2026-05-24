interface Props {
    seo: number;
    geo: number;
}

export default function ScoreCards({ seo, geo }: Props) {
    return (
        <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#111827] rounded-2xl p-6 border border-slate-800">
                <p className="text-slate-400">SEO Score</p>

                <h2 className="text-5xl font-bold text-cyan-400 mt-2">
                    {seo}
                </h2>
            </div>

            <div className="bg-[#111827] rounded-2xl p-6 border border-slate-800">
                <p className="text-slate-400">GEO Score</p>

                <h2 className="text-5xl font-bold text-purple-400 mt-2">
                    {geo}
                </h2>
            </div>
        </div>
    );
}