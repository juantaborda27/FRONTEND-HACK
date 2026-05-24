import { ProbeResult } from "../../lib/types";

interface Props {
    data: ProbeResult[];
}

export default function ProbeTable({ data }: Props) {
    return (
        <div className="bg-[#111827] rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full">
                <thead className="bg-[#1f2937]">
                    <tr>
                        <th className="text-left p-4">Query</th>
                        <th className="text-left p-4">Mentioned</th>
                        <th className="text-left p-4">Competitors</th>
                        <th className="text-left p-4">Similarity</th>
                        <th className="text-left p-4">Needs content</th>
                    </tr>
                </thead>

                <tbody>
                    {data.map((item, i) => (
                        <tr key={i} className="border-t border-slate-800">
                            <td className="p-4">{item.query}</td>

                            <td className="p-4">
                                {item.serfinanza_mentioned ? "✅" : "❌"}
                            </td>

                            <td className="p-4">
                                {item.competitors_mentioned.join(", ")}
                            </td>

                            <td className="p-4">
                                {item.similarity_score}
                            </td>

                            <td className="p-4">
                                {item.needs_content ? "YES" : "NO"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}