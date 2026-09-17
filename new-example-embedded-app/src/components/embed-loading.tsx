import { Skeleton } from "@/components/ui/skeleton";

const CARDS = ["a", "b", "c", "d", "e", "f"];

/** Placeholder shown until the embedded iframe takes over its container. */
export function EmbedLoading({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col gap-6 overflow-hidden p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <div key={card} className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-md" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
