import { useMemo } from "react";
import type { Reminder, UserSettings } from "@office-reminder/shared";
import { nextOccurrence } from "@/lib/scheduler";

export default function HomeTab({
  reminders, settings,
}: { reminders: Reminder[]; settings: UserSettings | null }) {
  const upcoming = useMemo(() => {
    const now = new Date();
    return reminders
      .map((r) => ({ r, when: nextOccurrence(r, now) }))
      .filter((x) => x.when)
      .sort((a, b) => a.when!.getTime() - b.when!.getTime())
      .slice(0, 8);
  }, [reminders]);

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="h1">Today</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          The next {Math.min(8, upcoming.length || 8)} reminders across all your teams.
        </p>
      </header>

      {upcoming.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <p style={{ fontWeight: 500, margin: 0 }}>You're all clear</p>
          <p className="muted" style={{ marginTop: 4 }}>
            Add reminders in the web dashboard — they'll show up here automatically.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: "4px 18px" }}>
          {upcoming.map(({ r, when }) => (
            <div key={r.id} className="upcoming-item">
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.title}
                </p>
                {r.description && (
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.description}
                  </p>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                  {when!.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                </p>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 11 }}>
                  {humanizeUntil(when!)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {settings && (
        <p className="muted" style={{ marginTop: 24, fontSize: 12 }}>
          Pop-up appears <strong>{settings.advance_minutes_override ?? "per reminder"}{settings.advance_minutes_override !== null ? "m" : ""}</strong> before each event.
          Sound is <strong>{settings.sound_enabled ? `on (${settings.sound_name})` : "off"}</strong>.
          Position: <strong>{settings.overlay_position.replace("-", " ")}</strong>.
        </p>
      )}
    </div>
  );
}

function humanizeUntil(d: Date): string {
  const ms = d.getTime() - Date.now();
  if (ms < 0) return "just passed";
  const hours = ms / 3_600_000;
  if (hours < 1) return `in ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 24) return `in ${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}
