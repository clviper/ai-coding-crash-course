import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  setCourseRating,
  getUserRatingForCourse,
  getCourseRatingSummary,
  getRatingSummariesForCourses,
  isValidRating,
} from "./ratingService";

function createStudent(email: string) {
  return testDb
    .insert(schema.users)
    .values({ name: email, email, role: schema.UserRole.Student })
    .returning()
    .get();
}

function createCourse(slug: string) {
  return testDb
    .insert(schema.courses)
    .values({
      title: slug,
      slug,
      description: "Another course",
      instructorId: base.instructor.id,
      categoryId: base.category.id,
      status: schema.CourseStatus.Published,
    })
    .returning()
    .get();
}

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("isValidRating", () => {
    it("accepts whole numbers 1 through 5", () => {
      for (const r of [1, 2, 3, 4, 5]) expect(isValidRating(r)).toBe(true);
    });

    it("rejects out-of-range and fractional values", () => {
      for (const r of [0, 6, -1, 2.5, NaN]) expect(isValidRating(r)).toBe(false);
    });
  });

  describe("setCourseRating", () => {
    it("stores a rating", () => {
      const row = setCourseRating(base.user.id, base.course.id, 4);
      expect(row.rating).toBe(4);
      expect(getUserRatingForCourse(base.user.id, base.course.id)).toBe(4);
    });

    it("replaces an existing rating instead of adding a second one", () => {
      setCourseRating(base.user.id, base.course.id, 2);
      setCourseRating(base.user.id, base.course.id, 5);

      expect(getUserRatingForCourse(base.user.id, base.course.id)).toBe(5);
      expect(getCourseRatingSummary(base.course.id).count).toBe(1);
    });

    it("throws for invalid ratings", () => {
      expect(() => setCourseRating(base.user.id, base.course.id, 0)).toThrow();
      expect(() => setCourseRating(base.user.id, base.course.id, 6)).toThrow();
      expect(() => setCourseRating(base.user.id, base.course.id, 3.5)).toThrow();
    });
  });

  describe("getUserRatingForCourse", () => {
    it("returns null when the user has not rated", () => {
      expect(getUserRatingForCourse(base.user.id, base.course.id)).toBeNull();
    });
  });

  describe("getCourseRatingSummary", () => {
    it("returns null average and zero count with no ratings", () => {
      expect(getCourseRatingSummary(base.course.id)).toEqual({
        average: null,
        count: 0,
      });
    });

    it("averages ratings across users", () => {
      const other = createStudent("other@example.com");
      setCourseRating(base.user.id, base.course.id, 5);
      setCourseRating(other.id, base.course.id, 2);

      expect(getCourseRatingSummary(base.course.id)).toEqual({
        average: 3.5,
        count: 2,
      });
    });
  });

  describe("getRatingSummariesForCourses", () => {
    it("returns summaries per course, including unrated ones", () => {
      const second = createCourse("second");
      const third = createCourse("third");
      const other = createStudent("other@example.com");

      setCourseRating(base.user.id, base.course.id, 4);
      setCourseRating(other.id, base.course.id, 5);
      setCourseRating(base.user.id, second.id, 1);

      const summaries = getRatingSummariesForCourses([
        base.course.id,
        second.id,
        third.id,
      ]);

      expect(summaries.get(base.course.id)).toEqual({ average: 4.5, count: 2 });
      expect(summaries.get(second.id)).toEqual({ average: 1, count: 1 });
      expect(summaries.get(third.id)).toEqual({ average: null, count: 0 });
    });

    it("handles an empty list", () => {
      expect(getRatingSummariesForCourses([]).size).toBe(0);
    });
  });
});
