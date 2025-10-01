import React, { useEffect, useRef, useState } from "react";
import { Input } from "./input";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

function fmt(d: Date | undefined) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function parseDate(s?: string) {
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string; // yyyy-mm-dd
  defaultValue?: string;
  onChange?: (v: string) => void;
  className?: string;
  required?: boolean;
  min?: string; // yyyy-mm-dd
  max?: string;
  placeholder?: string;
}

export default function DatePicker({
  id,
  name,
  value,
  defaultValue,
  onChange,
  className,
  required,
  min,
  max,
  placeholder,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date | undefined>(
    parseDate(value ?? defaultValue),
  );
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (value !== undefined) setSelected(parseDate(value));
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleSelect = (d?: Date) => {
    setSelected(d);
    setOpen(false);
    const s = fmt(d);
    if (onChange) onChange(s);
  };

  const disabled: any = {};
  if (min) disabled.before = parseDate(min);
  if (max) disabled.after = parseDate(max);

  return (
    <div className={className} ref={ref} style={{ position: "relative" }}>
      <Input
        id={id}
        readOnly
        value={selected ? fmt(selected) : ""}
        placeholder={placeholder || "Select date"}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        required={required}
      />
      {/* hidden input so forms can pick up the value */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={selected ? fmt(selected) : ""}
        />
      )}
      {open && (
        <div style={{ position: "absolute", zIndex: 40, marginTop: 6 }}>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
