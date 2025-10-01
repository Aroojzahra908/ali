import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { genStudentId, paymentStatus } from "./types";
import type { AdmissionRecord } from "./types";
import { upsertStudent } from "@/lib/studentStore";
import type { StudentRecord } from "@/pages/students/types";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COURSES } from "@/data/courses";
import { printVoucher as printVoucherUI, buildVoucherId } from "@/components/admissions/printVoucher";

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
  const [campus, setCampus] = useState(rec.campus);
  const navigate = useNavigate();

  // Quick Enroll (no form) state
  const [qCourseId, setQCourseId] = useState<string>(COURSES[0]?.id || "");
  const [qCourseName, setQCourseName] = useState<string>(
    COURSES[0]?.name || rec.course,
  );
  const [qAmount, setQAmount] = useState<number>(
    Number(COURSES[0]?.fees || rec.fee.total || 0),
  );
  const [qBatch, setQBatch] = useState<string>(rec.batch);
  const [qCampus, setQCampus] = useState<string>(rec.campus);

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
    navigate("/dashboard/students");
    toast({
      title: "Admission confirmed",
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

  async function quickEnrollAndVoucher() {
    const id = rec.studentId || genStudentId(rec.student.name);

    let base: StudentRecord | null = null;
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      if (supabase) {
        const { data } = await supabase
          .from("students")
          .select("record")
          .eq("id", id)
          .limit(1)
          .maybeSingle();
        if (data && (data as any).record)
          base = (data as any).record as StudentRecord;
      }
    } catch {}

    const student: StudentRecord = base ?? {
      id,
      name: rec.student.name,
      email: rec.student.email,
      phone: rec.student.phone,
      status: "Current",
      admission: {
        course: qCourseName,
        batch: qBatch,
        campus: qCampus,
        date: new Date().toISOString(),
      },
      fee: {
        total: Number(qAmount) || 0,
        installments: [
          {
            id: "FULL",
            amount: Number(qAmount) || 0,
            dueDate: new Date().toISOString(),
          },
        ],
      },
      attendance: [],
      documents: [],
      communications: [],
      enrolledCourses: [],
    };

    const merged: StudentRecord = {
      ...student,
      enrolledCourses: Array.from(
        new Set([...(student.enrolledCourses || []), qCourseName]),
      ),
    };

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      if (supabase) {
        const { error } = await supabase
          .from("students")
          .upsert({ id: merged.id, record: merged }, { onConflict: "id" });
        if (error) throw error;
      } else {
        upsertStudent(merged);
      }
    } catch {
      upsertStudent(merged);
    }

    printVoucher({
      studentName: merged.name,
      studentEmail: merged.email,
      studentPhone: merged.phone,
      studentId: merged.id,
      course: qCourseName,
      campus: qCampus,
      batch: qBatch,
      amount: Number(qAmount) || 0,
    });
  }

  function printVoucher(opts: {
    studentName: string;
    studentEmail: string;
    studentPhone: string;
    studentId: string;
    course: string;
    campus: string;
    batch: string;
    amount: number;
  }) {
    const w = window.open("", "_blank");
    if (!w) return;
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Fee Voucher - ${escapeHtml(opts.studentName)}</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; padding:24px; color:#111827}
    h1{font-size:20px;margin:0 0 8px}
    .muted{color:#6b7280;font-size:12px}
    .section{border:1px solid #e5e7eb;border-radius:8px;margin-top:16px}
    .sec-h{background:#f9fafb;padding:8px 12px;font-weight:600}
    .sec-b{padding:12px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;font-size:12px}
    th{background:#f3f4f6}
  </style>
</head>
<body>
  <h1>Fee Voucher</h1>
  <div class="muted">Student ID: ${escapeHtml(opts.studentId)} • Date: ${new Date().toLocaleDateString()}</div>

  <div class="section">
    <div class="sec-h">Student</div>
    <div class="sec-b">
      <div><b>Name:</b> ${escapeHtml(opts.studentName)}</div>
      <div><b>Email:</b> ${escapeHtml(opts.studentEmail)}</div>
      <div><b>Phone:</b> ${escapeHtml(opts.studentPhone)}</div>
    </div>
  </div>

  <div class="section">
    <div class="sec-h">Enrollment</div>
    <div class="sec-b">
      <div><b>Course:</b> ${escapeHtml(opts.course)}</div>
      <div><b>Batch:</b> ${escapeHtml(opts.batch)}</div>
      <div><b>Campus:</b> ${escapeHtml(opts.campus)}</div>
    </div>
  </div>

  <div class="section">
    <div class="sec-h">Payment</div>
    <div class="sec-b">
      <table>
        <thead><tr><th>#</th><th>Description</th><th>Amount</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Course Fee (Full)</td><td>₨${opts.amount.toLocaleString()}</td></tr>
          <tr><td colspan="2" style="text-align:right"><b>Total</b></td><td><b>₨${opts.amount.toLocaleString()}</b></td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>window.print()<\/script>
</body>
</html>`;
    w.document.write(html);
    w.document.close();
  }

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


      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Transfer</div>
          <Label>Batch</Label>
          <Input value={batch} onChange={(e) => setBatch(e.target.value)} />
          <Label>Campus</Label>
          <Input value={campus} onChange={(e) => setCampus(e.target.value)} />
          <Button variant="outline" onClick={transfer}>
            Transfer
          </Button>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Payment Status</div>
          <div className="font-medium">{paymentStatus(rec)}</div>
          <div className="text-xs text-muted-foreground">
            Total: ₨{rec.fee.total.toLocaleString()}
          </div>
          <div className="text-xs">Installments:</div>
          <div className="rounded border p-2 text-xs space-y-1">
            {rec.fee.installments.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span>
                  {i.id} • ₨{i.amount.toLocaleString()} • Due{" "}
                  {new Date(i.dueDate).toLocaleDateString()}
                </span>
                <span className="text-muted-foreground">
                  {i.paidAt
                    ? `Paid ${new Date(i.paidAt).toLocaleDateString()}`
                    : "Unpaid"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Quick Enroll (No Admission Form)
        </div>
        <Label>Course</Label>
        <Select
          value={qCourseId}
          onValueChange={(v) => {
            setQCourseId(v);
            const c = COURSES.find((x) => x.id === v);
            setQCourseName(c?.name || v);
            setQAmount(Number(c?.fees || 0));
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select course" />
          </SelectTrigger>
          <SelectContent>
            {COURSES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Amount (₨)</Label>
            <Input
              type="number"
              value={Number.isFinite(qAmount) ? String(qAmount) : "0"}
              onChange={(e) => setQAmount(Number(e.target.value || 0))}
            />
          </div>
          <div>
            <Label>Batch</Label>
            <Input value={qBatch} onChange={(e) => setQBatch(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Campus</Label>
            <Input
              value={qCampus}
              onChange={(e) => setQCampus(e.target.value)}
            />
          </div>
          <div className="flex items-end justify-end">
            <Button onClick={quickEnrollAndVoucher}>
              Enroll & Print Voucher
            </Button>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs text-muted-foreground pb-1">
          Uploaded Documents
        </div>
        <div className="space-y-1 text-sm">
          {rec.documents.map((d, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <a
                href={d.url}
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                {d.name}
              </a>
              <div className="space-x-2">
                <Badge variant={d.verified ? "default" : "secondary"}>
                  {d.verified ? "Verified" : "Pending"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onChange({
                      ...rec,
                      documents: rec.documents.map((x, i) =>
                        i === idx ? { ...x, verified: !x.verified } : x,
                      ),
                    })
                  }
                >
                  Toggle Verify
                </Button>
              </div>
            </div>
          ))}
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
        <Button variant="outline" onClick={printForm}>
          Print Admission Form
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
