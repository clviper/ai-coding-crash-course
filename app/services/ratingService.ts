import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

// ─── Rating Service ───
// Handles 1–5 star course ratings. One rating per user per course;
// rating again replaces the previous value.
// Uses positional parameters (project convention).

export const MIN_RATING = 1;
export const MAX_RATING = 5;

export type RatingSummary = {
  average: number | null;
  count: number;
};

export function isValidRating(rating: number) {
  return (
    Number.isInteger(rating) && rating >= MIN_RATING && rating <= MAX_RATING
  );
}

export function getUserRatingForCourse(userId: number, courseId: number) {
  const row = db
    .select({ rating: courseRatings.rating })
    .from(courseRatings)
    .where(
      and(eq(courseRatings.userId, userId), eq(courseRatings.courseId, courseId))
    )
    .get();

  return row?.rating ?? null;
}

export function setCourseRating(
  userId: number,
  courseId: number,
  rating: number
) {
  if (!isValidRating(rating)) {
    throw new Error(
      `Rating must be a whole number between ${MIN_RATING} and ${MAX_RATING}`
    );
  }

  const now = new Date().toISOString();

  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [courseRatings.userId, courseRatings.courseId],
      set: { rating, updatedAt: now },
    })
    .returning()
    .get();
}

export function getCourseRatingSummary(courseId: number): RatingSummary {
  const row = db
    .select({
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  return { average: row?.average ?? null, count: row?.count ?? 0 };
}

/**
 * Batched version of getCourseRatingSummary for list pages.
 * Courses with no ratings are included with { average: null, count: 0 }.
 */
export function getRatingSummariesForCourses(courseIds: number[]) {
  const summaries = new Map<number, RatingSummary>();
  for (const id of courseIds) {
    summaries.set(id, { average: null, count: 0 });
  }
  if (courseIds.length === 0) return summaries;

  const rows = db
    .select({
      courseId: courseRatings.courseId,
      average: sql<number>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .groupBy(courseRatings.courseId)
    .all();

  for (const row of rows) {
    summaries.set(row.courseId, { average: row.average, count: row.count });
  }

  return summaries;
}
