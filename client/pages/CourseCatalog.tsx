import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { mergeSupabaseCourses, getStoredCourses } from "@/lib/courseStore";
import { COURSES } from "@/data/courses";

type Course = {
  id: string;
  name: string;
  category?: string;
  duration: string;
  fees: number;
  description?: string;
  status?: "live" | "upcoming" | string;
  featured?: boolean;
  start_date?: string | null;
  created_at?: string;
};

export default function CourseCatalog() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCourses = async () => {
    setLoading(true);
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase!
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        setCourses(data as any);
        try {
          mergeSupabaseCourses(
            (data || []).map((c: any) => ({
              id: c.id,
              name: c.name,
              duration: c.duration,
              fees: Number(c.fees) || 0,
              description: c.description || "",
            })),
          );
        } catch {}
      } else {
        fallbackToLocal();
      }
    } else {
      fallbackToLocal();
    }
    setLoading(false);
  };

  function fallbackToLocal() {
    try {
      const local = getStoredCourses();
      if (local.length) {
        setCourses(local as any);
        return;
      }
      setCourses(COURSES as any);
    } catch {
      setCourses(COURSES as any);
    }
  }

  useEffect(() => {
    fetchCourses();
  }, []);

  const featured = useMemo(
    () => courses.filter((c) => !!c.featured),
    [courses],
  );
  const upcoming = useMemo(
    () =>
      courses
        .filter((c) => (c.status || "").toLowerCase() === "upcoming")
        .sort((a, b) =>
          String(a.start_date || "") > String(b.start_date || "") ? 1 : -1,
        ),
    [courses],
  );
  const latest = useMemo(
    () =>
      [...courses].sort((a, b) =>
        String(a.created_at || "") < String(b.created_at || "") ? 1 : -1,
      ),
    [courses],
  );
  const byCategory = useMemo(() => {
    const groups = new Map<string, Course[]>();
    for (const c of courses) {
      const key = (c.category || "Uncategorized").toString();
      const list = groups.get(key) || [];
      list.push(c);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [courses]);

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-bold">Courses</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upcoming • Featured • Latest • Category-wise
        </p>
      </header>

      {loading ? <p>Loading…</p> : null}

      {featured.length > 0 && (
        <section>
          <h3 className="mb-3 text-xl font-semibold">Featured Courses</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h3 className="mb-3 text-xl font-semibold">Upcoming Courses</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <section>
          <h3 className="mb-3 text-xl font-semibold">Latest Courses</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}

      {byCategory.length > 0 && (
        <section>
          <h3 className="mb-3 text-xl font-semibold">All Courses (Category Wise)</h3>
          <div className="space-y-6">
            {byCategory.map(([cat, list]) => (
              <div key={cat} className="space-y-3">
                <h4 className="text-lg font-medium">{cat}</h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((c) => (
                    <CourseCard key={`${cat}-${c.id}`} course={c} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CourseCard({ course: c }: { course: Course }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{c.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm">
          Duration: <span className="text-muted-foreground">{c.duration}</span>
        </div>
        <div className="text-sm">
          Fees: <span className="text-muted-foreground">₨ {Number(c.fees || 0).toLocaleString()}</span>
        </div>
        {c.description ? (
          <p className="text-sm text-muted-foreground">{c.description}</p>
        ) : null}
        <Button asChild className="mt-2 w-full">
          <Link to={`/admission-form?course=${encodeURIComponent(c.name)}`}>
            Apply Now
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
