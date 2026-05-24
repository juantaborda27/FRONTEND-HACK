interface Props {
    text: string;
}

export default function WarningBanner({ text }: Props) {
    return (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-yellow-300">
            ⚠ {text}
        </div>
    );
}