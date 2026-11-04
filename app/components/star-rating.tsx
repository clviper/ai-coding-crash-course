import { useState } from "react";
import { useFetcher } from "react-router";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

const STARS = [1, 2, 3, 4, 5];

/**
 * Read-only stars with partial fill, e.g. 3.6 renders 3 full stars and 60% of the 4th.
 */
export function StarDisplay({
  value,
  className,
  starClassName = "size-4",
}: {
  value: number;
  className?: string;
  starClassName?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-hidden="true"
    >
      {STARS.map((star) => {
        const fill = Math.max(0, Math.min(1, value - (star - 1)));
        return (
          <span key={star} className="relative inline-block">
            <Star className={cn(starClassName, "text-muted-foreground/40")} />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  className={cn(
                    starClassName,
                    "fill-amber-400 text-amber-400"
                  )}
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Average rating with count, e.g. "★★★★☆ 4.3 (12 ratings)".
 * Shows "No ratings yet" when there are none.
 */
export function RatingSummary({
  average,
  count,
  className,
  starClassName,
}: {
  average: number | null;
  count: number;
  className?: string;
  starClassName?: string;
}) {
  if (average === null || count === 0) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        No ratings yet
      </span>
    );
  }

  const label = `${average.toFixed(1)} out of 5 stars from ${count} ${
    count === 1 ? "rating" : "ratings"
  }`;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={label}
    >
      <span className="sr-only">{label}</span>
      <StarDisplay value={average} starClassName={starClassName} />
      <span aria-hidden="true" className="font-medium text-foreground">
        {average.toFixed(1)}
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        ({count})
      </span>
    </span>
  );
}

/**
 * Interactive picker. Submits { intent: "rate", rating } to the current route's action.
 * Shows the pending value optimistically while the request is in flight.
 */
export function StarRatingInput({ userRating }: { userRating: number | null }) {
  const fetcher = useFetcher();
  const [hovered, setHovered] = useState<number | null>(null);

  const pendingRating = fetcher.formData
    ? Number(fetcher.formData.get("rating"))
    : null;
  const current = pendingRating ?? userRating;
  const shown = hovered ?? current ?? 0;

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="rate" />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">
          {current ? "Your rating" : "Rate this course"}
        </legend>
        <div
          className="flex items-center gap-1"
          onMouseLeave={() => setHovered(null)}
        >
          {STARS.map((star) => (
            <button
              key={star}
              type="submit"
              name="rating"
              value={star}
              aria-label={`Rate ${star} out of 5 stars`}
              aria-pressed={current === star}
              onMouseEnter={() => setHovered(star)}
              onFocus={() => setHovered(star)}
              onBlur={() => setHovered(null)}
              className="rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Star
                className={cn(
                  "size-6 transition-colors",
                  star <= shown
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/40"
                )}
              />
            </button>
          ))}
        </div>
      </fieldset>
      {fetcher.data && "error" in fetcher.data && (
        <p className="mt-1 text-xs text-destructive">{fetcher.data.error}</p>
      )}
    </fetcher.Form>
  );
}
