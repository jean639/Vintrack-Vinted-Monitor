function LoadingBlock({ className = "" }: { className?: string }) {
    return <div className={`bg-muted/60 animate-pulse rounded-md ${className}`} />;
}

export default function AdminLoading() {
    return (
        <div className="mx-auto w-full max-w-[1680px] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                    <LoadingBlock className="h-5 w-36" />
                    <LoadingBlock className="h-3 w-64 max-w-[70vw]" />
                </div>
                <LoadingBlock className="h-7 w-32" />
            </div>

            <div className="border-border/60 flex gap-1 overflow-hidden rounded-lg border p-1">
                {Array.from({ length: 5 }).map((_, index) => (
                    <LoadingBlock key={index} className="h-9 min-w-24 flex-1" />
                ))}
            </div>

            <div className="border-border/60 grid overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-5">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="border-border/60 space-y-3 border-b p-4 last:border-b-0 sm:border-r xl:border-b-0"
                    >
                        <LoadingBlock className="h-3 w-20" />
                        <LoadingBlock className="h-7 w-14" />
                        <LoadingBlock className="h-3 w-28" />
                    </div>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="border-border/60 space-y-5 rounded-lg border p-5">
                    <div className="space-y-2">
                        <LoadingBlock className="h-4 w-32" />
                        <LoadingBlock className="h-3 w-56" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <LoadingBlock key={index} className="h-20" />
                        ))}
                    </div>
                    <LoadingBlock className="h-32" />
                </div>
                <div className="border-border/60 space-y-4 rounded-lg border p-5">
                    <LoadingBlock className="h-4 w-28" />
                    {Array.from({ length: 4 }).map((_, index) => (
                        <LoadingBlock key={index} className="h-12" />
                    ))}
                </div>
            </div>
        </div>
    );
}
