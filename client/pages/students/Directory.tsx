import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Phone, Mail, MessageCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEffect, useMemo, useState } from "react";
import { useCampuses } from "@/lib/campusStore";
import type { StudentRecord, StudentStatus } from "./types";
import { paymentStatus } from "./types";
import { useToast } from "@/hooks/use-toast";
import { ProfileSimple } from "./ProfileSimple";
import { getAllCourseNames } from "@/lib/courseStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const statuses: StudentStatus[] = [
  "Current",
  "Freeze",
  "Concluded",
  "Not Completed",
  "Suspended",
  "Alumni",
];

export function Directory({
  data,
  onChange,
  initialStatus,
  lockedStatus,
}: {
  data: StudentRecord[];
  onChange: (rec: StudentRecord) => void;
  initialStatus?: StudentStatus;
  lockedStatus?: StudentStatus;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>(initialStatus ?? "");
  const [course, setCourse] = useState<string>("");
  const [batch, setBatch] = useState<string>("");
  const [campus, setCampus] = useState<string>("");
  const campusOptions = useCampuses();
  const [version, setVersion] = useState(0);
  const [batchesDb, setBatchesDb] = useState<string[]>([]);
  const [coursesDb, setCoursesDb] = useState<string[]>([]);

  useEffect(() => {
    setStatus(lockedStatus ?? initialStatus ?? "");
  }, [initialStatus, lockedStatus]);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener("courses:changed", bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener("courses:changed", bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    (async () => {
      const { data, error } = await supabase!
        .from("batches")
        .select("batch_code, course_name")
        .order("created_at", { ascending: false });
      if (!error && data) {
        const bset = new Set<string>();
        const cset = new Set<string>();
        for (const r of data as any[]) {
          if (r.batch_code) bset.add(r.batch_code);
          if (r.course_name) cset.add(r.course_name);
        }
        setBatchesDb(Array.from(bset));
        setCoursesDb(Array.from(cset));
      }
    })();

    const ch = supabase!
      .channel("students-dir-batches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "batches" },
        (payload) => {
          const r: any = payload.new ?? payload.old;
          if (!r) return;
          setBatchesDb((prev) => {
            const set = new Set(prev);
            if (payload.eventType === "DELETE") {
              set.delete(r.batch_code);
            } else if (r.batch_code) set.add(r.batch_code);
            return Array.from(set);
          });
          setCoursesDb((prev) => {
            const set = new Set(prev);
            if (r.course_name) set.add(r.course_name);
            return Array.from(set);
          });
        },
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(ch);
    };
  }, []);

  const courses = useMemo(() => {
    const fromData = data.map((d) => d.admission.course).filter(Boolean);
    const stored = getAllCourseNames(); // only admin-added/store-synced names
    const merged = new Set<string>([
      ...coursesDb,
      ...(stored || []),
      ...fromData,
    ]);
    return Array.from(merged).sort();
  }, [data, version, coursesDb]);
  const batches = useMemo(() => {
    const fromData = data.map((d) => d.admission.batch).filter(Boolean);
    const merged = new Set<string>([...batchesDb, ...fromData]);
    return Array.from(merged).sort();
  }, [data, batchesDb]);
  const campuses = campusOptions.slice().sort();

  const effectiveStatus = lockedStatus ?? status;

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return data.filter(
      (d) =>
        (!s ||
          d.name.toLowerCase().includes(s) ||
          d.id.toLowerCase().includes(s) ||
          d.admission.course.toLowerCase().includes(s)) &&
        (!effectiveStatus || d.status === effectiveStatus) &&
        (!course || d.admission.course === course) &&
        (!batch || d.admission.batch === batch) &&
        (!campus || d.admission.campus === campus),
    );
  }, [data, q, effectiveStatus, course, batch, campus]);


  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <Input
          placeholder="Search by name, ID, course…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {lockedStatus ? (
          <div className="rounded-md border px-3 py-2 text-sm font-medium">
            {lockedStatus} students
          </div>
        ) : (
          <Select
            value={status || "__all"}
            onValueChange={(v) => setStatus(v === "__all" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All Status</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={course}
          onValueChange={(v) => setCourse(v === "__all" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All Courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={batch}
          onValueChange={(v) => setBatch(v === "__all" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All Batches</SelectItem>
            {batches.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={campus}
          onValueChange={(v) => setCampus(v === "__all" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Campus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All Campuses</SelectItem>
            {campuses.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => {
            setQ("");
            setStatus(lockedStatus ?? "");
            setCourse("");
            setBatch("");
            setCampus("");
          }}
        >
          Reset
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Course / Batch</TableHead>
            <TableHead>Campus</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.id}</div>
              </TableCell>
              <TableCell>
                <div>{s.admission.course}</div>
                <div className="text-xs text-muted-foreground">
                  {s.admission.batch}
                </div>
              </TableCell>
              <TableCell>{s.admission.campus}</TableCell>
              <TableCell>
                <Badge>{s.status}</Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    paymentStatus(s) === "Overdue"
                      ? "destructive"
                      : paymentStatus(s) === "Paid"
                        ? "default"
                        : "secondary"
                  }
                >
                  {paymentStatus(s)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  {/* View button removed per request */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" aria-label="Actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                      <DropdownMenuGroup>
                        {/* View Profile removed */}
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            Communicate
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onClick={() => {
                                onChange({
                                  ...s,
                                  communications: [
                                    {
                                      id: `call-${Date.now()}`,
                                      channel: "Call",
                                      message: "Admin initiated voice call",
                                      at: new Date().toISOString(),
                                    },
                                    ...s.communications,
                                  ],
                                });
                                toast({ title: "Voice call logged" });
                              }}
                            >
                              <Phone className="mr-2 h-4 w-4" /> Voice Call
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                onChange({
                                  ...s,
                                  communications: [
                                    {
                                      id: `email-${Date.now()}`,
                                      channel: "Email",
                                      message: "Admin email sent",
                                      at: new Date().toISOString(),
                                    },
                                    ...s.communications,
                                  ],
                                });
                                toast({ title: "Email sent" });
                              }}
                            >
                              <Mail className="mr-2 h-4 w-4" /> Email
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                onChange({
                                  ...s,
                                  communications: [
                                    {
                                      id: `wa-${Date.now()}`,
                                      channel: "WhatsApp",
                                      message: "Admin WhatsApp message",
                                      at: new Date().toISOString(),
                                    },
                                    ...s.communications,
                                  ],
                                });
                                toast({ title: "WhatsApp sent" });
                              }}
                            >
                              <MessageCircle className="mr-2 h-4 w-4" />{" "}
                              WhatsApp
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            Transfers
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                Batch Transfer
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {batches.map((b) => (
                                  <DropdownMenuItem
                                    key={b}
                                    onClick={() => {
                                      onChange({
                                        ...s,
                                        admission: { ...s.admission, batch: b },
                                      });
                                      toast({
                                        title: `Batch transferred to ${b}`,
                                      });
                                    }}
                                  >
                                    {b}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                Campus Transfer
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {[
                                  "Main Campus",
                                  "Sub Campus",
                                  "FSD",
                                  "Other",
                                ].map((c) => (
                                  <DropdownMenuItem
                                    key={c}
                                    onClick={() => {
                                      onChange({
                                        ...s,
                                        admission: {
                                          ...s.admission,
                                          campus: c,
                                        },
                                      });
                                      toast({
                                        title: `Campus transferred to ${c}`,
                                      });
                                    }}
                                  >
                                    {c}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            Attendance
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onClick={() => {
                                const today = new Date()
                                  .toISOString()
                                  .slice(0, 10);
                                onChange({
                                  ...s,
                                  attendance: (() => {
                                    const idx = s.attendance.findIndex(
                                      (a) => a.date === today,
                                    );
                                    if (idx >= 0) {
                                      const copy = [...s.attendance];
                                      copy[idx] = {
                                        date: today,
                                        present: true,
                                      };
                                      return copy;
                                    }
                                    return [
                                      ...s.attendance,
                                      { date: today, present: true },
                                    ];
                                  })(),
                                });
                                toast({ title: "Marked Present (today)" });
                              }}
                            >
                              Mark Present (Today)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const today = new Date()
                                  .toISOString()
                                  .slice(0, 10);
                                onChange({
                                  ...s,
                                  attendance: (() => {
                                    const idx = s.attendance.findIndex(
                                      (a) => a.date === today,
                                    );
                                    if (idx >= 0) {
                                      const copy = [...s.attendance];
                                      copy[idx] = {
                                        date: today,
                                        present: false,
                                      };
                                      return copy;
                                    }
                                    return [
                                      ...s.attendance,
                                      { date: today, present: false },
                                    ];
                                  })(),
                                });
                                toast({ title: "Marked Absent (today)" });
                              }}
                            >
                              Mark Absent (Today)
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            onChange({ ...s, status: "Alumni" });
                            toast({ title: "Course concluded" });
                          }}
                        >
                          Conclude Course
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            onChange({ ...s, status: "Not Completed" });
                            toast({ title: "Marked as Not Completed" });
                          }}
                        >
                          Not Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            onChange({ ...s, status: "Suspended" });
                            toast({ title: "Course suspended" });
                          }}
                        >
                          Suspend Course
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            onChange({ ...s, status: "Freeze" });
                            toast({ title: "Course frozen" });
                          }}
                        >
                          Freeze
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            toast({ title: "Certificate request submitted" });
                          }}
                        >
                          Request Certificate
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

    </div>
  );
}
