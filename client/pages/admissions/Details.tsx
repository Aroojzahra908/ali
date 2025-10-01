import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { genStudentId } from "./types";
import type { AdmissionRecord } from "./types";
import { upsertStudent } from "@/lib/studentStore";
import type { StudentRecord } from "@/pages/students/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function Details({
  rec,
  onChange,
  onDelete,
}: {
  rec: AdmissionRecord;
  onChange: (next: AdmissionRecord) => void;
  onDelete?: (rec: AdmissionRecord) => void;
}) {
  const { toast } = useToast();
  const [batch, setBatch] = useState(rec.batch);
  const [campus] = useState(rec.campus);
  const [batchOptions, setBatchOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const set = new Set<string>();
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        if (supabase) {
          const { data } = await supabase
            .from("batches")
            .select("batch_code")
            .order("created_at", { ascending: false });
          if (Array.isArray(data)) {
            for (const r of data as any[])
              if (r.batch_code) set.add(String(r.batch_code));
          }
        }
      } catch {}
      if (set.size === 0) {
        try {
          const res = await fetch("/api/batches");
          if (res.ok) {
            const p = await res.json();
            const items = Array.isArray(p?.items) ? p.items : [];
            for (const it of items)
              if (it?.batch_code) set.add(String(it.batch_code));
          }
        } catch {}
      }
      if (set.size === 0) {
        try {
          const { studentsMock } = await import("@/pages/students/data");
          for (const s of studentsMock)
            if (s.admission?.batch) set.add(String(s.admission.batch));
        } catch {}
      }
      const list = Array.from(set).sort();
      if (!cancelled) {
        setBatchOptions(list);
        if (list.length && !list.includes(batch)) setBatch(list[0]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const approve = () => {
    if (rec.status === "Verified") return;
    const id = rec.studentId || genStudentId(rec.student.name);
    onChange({ ...rec, status: "Verified", studentId: id });
    toast({ title: `Approved. Student ID ${id}` });
  };

  const confirmAdmission = async () => {
    const id = rec.studentId || genStudentId(rec.student.name);
    const next: AdmissionRecord = {
      ...rec,
      status: "Verified",
      studentId: id,
      batch,
      campus,
    };
    onChange(next);

    const student: StudentRecord = {
      id,
      name: next.student.name,
      email: next.student.email,
      phone: next.student.phone,
      status: "Current",
      admission: {
        course: next.course,
        batch: next.batch,
        campus: next.campus,
        date: new Date(next.createdAt).toISOString(),
      },
      fee: {
        total: next.fee.total || 0,
        installments: next.fee.installments.map((i) => ({
          id: i.id,
          amount: i.amount,
          dueDate: i.dueDate,
          paidAt: i.paidAt,
        })),
      },
      attendance: [],
      documents: [],
      communications: [],
    };
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      if (supabase) {
        const { error } = await supabase
          .from("students")
          .upsert({ id: student.id, record: student }, { onConflict: "id" });
        if (error) throw error;
      } else {
        upsertStudent(student);
      }
    } catch {
      upsertStudent(student);
    }
    toast({
      title: "Enrolled",
      description: `Student added: ${student.name}`,
    });
  };

  const reject = () => {
    const reason = window.prompt("Reason for rejection?") || "";
    if (!reason) return;
    onChange({ ...rec, status: "Rejected", rejectedReason: reason });
    toast({ title: "Admission Rejected" });
  };

  const suspend = () => {
    onChange({ ...rec, status: "Suspended" });
    toast({ title: "Admission Suspended" });
  };

  const cancel = () => {
    onChange({ ...rec, status: "Cancelled" });
    toast({ title: "Admission Cancelled" });
  };

  const transfer = () => {
    onChange({ ...rec, batch, campus });
    toast({ title: "Transferred" });
  };

  const markAllPaid = () => {
    const now = new Date().toISOString();
    onChange({
      ...rec,
      fee: {
        ...rec.fee,
        installments: rec.fee.installments.map((i) =>
          i.paidAt ? i : { ...i, paidAt: now },
        ),
      },
    });
    toast({ title: "Marked as Paid" });
  };

  const notify = (kind: "sms" | "email") => {
    toast({ title: kind === "sms" ? "SMS sent" : "Email sent" });
  };

  const printForm = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const html = `<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>Admission ${rec.id}</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; padding:24px; color:#111827}
    h1{font-size:20px;margin:0 0 8px}
    .muted{color:#6b7280;font-size:12px}
    .section{border:1px solid #e5e7eb;border-radius:8px;margin-top:16px}
    .sec-h{background:#f9fafb;padding:8px 12px;font-weight:600}
    .sec-b{padding:12px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;font-size:12px}
    th{background:#f3f4f6}
  </style>
</head>
<body>
  <h1>Admission Form</h1>
  <div class=\"muted\">Application ID: ${rec.id} • Date: ${new Date(rec.createdAt).toLocaleDateString()}</div>

  <div class=\"section\">
    <div class=\"sec-h\">Student Information</div>
    <div class=\"sec-b grid\">
      <div><b>Name:</b> ${escapeHtml(rec.student.name)}</div>
      <div><b>Phone:</b> ${escapeHtml(rec.student.phone)}</div>
      <div><b>Email:</b> ${escapeHtml(rec.student.email)}</div>
      <div><b>Status:</b> ${escapeHtml(rec.status)}</div>
    </div>
  </div>

  <div class=\"section\">
    <div class=\"sec-h\">Course & Campus</div>
    <div class=\"sec-b grid\">
      <div><b>Course:</b> ${escapeHtml(rec.course)}</div>
      <div><b>Batch:</b> ${escapeHtml(rec.batch)}</div>
      <div><b>Campus:</b> ${escapeHtml(rec.campus)}</div>
      ${rec.studentId ? `<div><b>Student ID:</b> ${escapeHtml(rec.studentId)}</div>` : ``}
    </div>
  </div>

  <div class=\"section\">
    <div class=\"sec-h\">Fee Summary</div>
    <div class=\"sec-b\">
      <div class=\"muted\">Total: ₨${rec.fee.total.toLocaleString()}</div>
      <table style=\"margin-top:8px\">
        <thead><tr><th>#</th><th>Due Date</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          ${rec.fee.installments.map((i, idx) => `<tr><td>${idx + 1}</td><td>${new Date(i.dueDate).toLocaleDateString()}</td><td>₨${i.amount.toLocaleString()}</td><td>${i.paidAt ? `Paid ${new Date(i.paidAt).toLocaleDateString()}` : "Unpaid"}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>

  ${rec.notes ? `<div class=\"section\"><div class=\"sec-h\">Notes</div><div class=\"sec-b\">${escapeHtml(rec.notes)}</div></div>` : ``}

  <script>window.print()<\/script>
</body>
</html>`;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold">{rec.student.name}</div>
        <div className="text-xs text-muted-foreground">
          {rec.student.email} • {rec.student.phone}
        </div>
        <div className="pt-2">
          <Badge>{rec.status}</Badge>
        </div>
      </div>
      <Separator />

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Enroll Student</div>
        <Label>Batch</Label>
        <Select value={batch} onValueChange={setBatch}>
          <SelectTrigger>
            <SelectValue placeholder="Select batch" />
          </SelectTrigger>
          <SelectContent>
            {batchOptions.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex justify-end pt-2">
          <Button onClick={confirmAdmission}>Enroll</Button>
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap gap-2">
        <Button onClick={confirmAdmission}>Approve & Move to Students</Button>
        <Button variant="outline" onClick={markAllPaid}>
          Mark as Paid
        </Button>
        <Button variant="destructive" onClick={() => onDelete?.(rec)}>
          Delete
        </Button>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>\"]+/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}
