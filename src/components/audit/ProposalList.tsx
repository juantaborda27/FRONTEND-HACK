import { Proposal } from "../../lib/types";

interface Props {
    proposals: Proposal[];
}

export default function ProposalList({ proposals }: Props) {
    return (
        <div className="grid gap-4">
            {proposals.map((p) => (
                <div
                    key={p.id}
                    className="bg-[#111827] border border-slate-800 rounded-2xl p-5"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-semibold text-white">
                                {p.title}
                            </h3>

                            <p className="text-slate-400 text-sm mt-1">
                                {p.trigger_source}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <span className="bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-full text-xs">
                                {p.proposal_type}
                            </span>

                            <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-xs">
                                {p.severity}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}