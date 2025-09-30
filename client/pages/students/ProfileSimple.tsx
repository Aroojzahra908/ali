import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { StudentRecord } from "./types";

export function ProfileSimple({
  student,
}: {
  student: StudentRecord;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold">{student.name}</div>
        <div className="text-xs text-muted-foreground">
          {student.email} • {student.phone}
        </div>
        <div className="pt-2 flex items-center gap-2">
          <Badge>{student.status}</Badge>
          <Badge variant="secondary">{student.admission.campus}</Badge>
          <Badge variant="secondary">{student.admission.batch}</Badge>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Attendance History</div>
        <div className="rounded border p-2 text-xs space-y-1 max-h-64 overflow-auto">
          {student.attendance.length === 0 ? (
            <div className="text-muted-foreground">No attendance yet</div>
          ) : (
            student.attendance
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((a) => (
                <div key={a.date} className="flex justify-between">
                  <span>{new Date(a.date).toLocaleDateString()}</span>
                  <span className={a.present ? "text-green-600" : "text-red-600"}>
                    {a.present ? "Present" : "Absent"}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Communications</div>
        <div className="rounded border p-2 text-xs space-y-1 max-h-64 overflow-auto">
          {student.communications.length === 0 ? (
            <div className="text-muted-foreground">No communications yet</div>
          ) : (
            student.communications.map((c) => (
              <div key={c.id} className="flex justify-between">
                <span>
                  {c.channel} • {new Date(c.at).toLocaleString()}
                </span>
                <span className="text-muted-foreground">{c.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Documents</div>
        <div className="space-y-1 text-sm">
          {student.documents.length === 0 ? (
            <div className="text-muted-foreground text-xs">No documents uploaded</div>
          ) : (
            student.documents.map((d, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <a href={d.url} className="underline" target="_blank" rel="noreferrer">
                  {d.name}
                </a>
                <Badge variant={d.verified ? "default" : "secondary"}>
                  {d.verified ? "Verified" : "Pending"}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
