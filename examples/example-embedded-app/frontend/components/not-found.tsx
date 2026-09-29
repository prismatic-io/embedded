import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h2 className="text-2xl font-semibold tracking-tight">Page not found</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        This route does not exist in the example app.
      </p>
      <Button asChild className="mt-2">
        <Link to="/">Back to the dashboard</Link>
      </Button>
    </div>
  );
}
