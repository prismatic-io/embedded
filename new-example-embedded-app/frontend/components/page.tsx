import { cn } from "@/lib/utils";

export function Page({
  title,
  description,
  actions,
  fullHeight,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Fit the content to the space below the header instead of scrolling. */
  fullHeight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1",
        fullHeight ? "overflow-hidden" : "overflow-y-auto",
      )}
    >
      <div
        className={cn(
          "mx-auto w-full px-20 py-8",
          fullHeight && "flex h-full flex-col",
        )}
      >
        <div className="mb-6 flex shrink-0 items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions}
        </div>
        {fullHeight ? (
          <div className="min-h-0 flex-1">{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
