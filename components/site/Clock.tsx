"use client";
import { useEffect, useState } from "react";

export default function Clock() {
  // Render a fixed placeholder on the server so the markup is stable; the
  // real time appears after hydration. Prevents any layout shift.
  const [time, setTime] = useState<string>("--:--:--");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      const tz =
        Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
          .formatToParts(d)
          .find((p) => p.type === "timeZoneName")?.value ?? "";
      setTime(`${hh}:${mm}:${ss} ${tz}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="font-tabular tracking-tight text-text" aria-label="local time" suppressHydrationWarning>
      {time}
    </span>
  );
}
