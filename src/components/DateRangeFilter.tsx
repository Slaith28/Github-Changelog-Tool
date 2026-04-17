"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateRange {
  since?: string;
  until?: string;
}

interface DateRangeFilterProps {
  onChange: (range: DateRange) => void;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export default function DateRangeFilter({ onChange }: DateRangeFilterProps) {
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const handlePresetChange = (value: string) => {
    setPreset(value);
    if (value === "all") onChange({});
    else if (value === "7d") onChange({ since: daysAgo(7) });
    else if (value === "30d") onChange({ since: daysAgo(30) });
    else if (value === "90d") onChange({ since: daysAgo(90) });
  };

  const handleCustomChange = (newFrom: string, newTo: string) => {
    onChange({
      since: newFrom ? new Date(newFrom).toISOString() : undefined,
      until: newTo ? new Date(newTo).toISOString() : undefined,
    });
  };

  return (
    <div className="space-y-3">
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                handleCustomChange(e.target.value, to);
              }}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                handleCustomChange(from, e.target.value);
              }}
              className="w-40"
            />
          </div>
        </div>
      )}
    </div>
  );
}
