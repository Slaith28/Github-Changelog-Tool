"use client";

import { useState } from "react";

type Preset = "all" | "7d" | "30d" | "90d" | "custom";

interface DateRange {
  since?: string;
  until?: string;
}

interface DateRangeFilterProps {
  onChange: (range: DateRange) => void;
}

const presets: { key: Preset; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "custom", label: "Custom range" },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export default function DateRangeFilter({ onChange }: DateRangeFilterProps) {
  const [active, setActive] = useState<Preset>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const handlePreset = (p: Preset) => {
    setActive(p);
    if (p === "all") onChange({});
    else if (p === "7d") onChange({ since: daysAgo(7) });
    else if (p === "30d") onChange({ since: daysAgo(30) });
    else if (p === "90d") onChange({ since: daysAgo(90) });
    // custom range is updated via the date inputs below
  };

  const handleCustomChange = (newFrom: string, newTo: string) => {
    onChange({
      since: newFrom ? new Date(newFrom).toISOString() : undefined,
      until: newTo ? new Date(newTo).toISOString() : undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => handlePreset(p.key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              active === p.key
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {active === "custom" && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              handleCustomChange(e.target.value, to);
            }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-500 text-sm">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              handleCustomChange(from, e.target.value);
            }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
