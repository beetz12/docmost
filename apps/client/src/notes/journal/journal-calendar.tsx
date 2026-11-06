import { useState } from "react";
import { Calendar } from "@mantine/dates";
import { Box, Indicator, Tooltip } from "@mantine/core";
import { useJournalMonth, useOpenJournal } from "./journal-queries";
import { toIsoDate } from "./journal-date-query";

interface JournalCalendarProps {
  /** Highlighted date (YYYY-MM-DD), e.g. the journal being viewed. */
  selectedDate?: string | null;
  size?: "xs" | "sm" | "md";
}

/**
 * Month calendar with a dot on each day that has a journal (orange when the
 * date has more than one journal page). Clicking a day opens that journal and
 * creates it only then.
 */
export function JournalCalendar({ selectedDate, size = "sm" }: JournalCalendarProps) {
  const [displayed, setDisplayed] = useState<string>(
    selectedDate ?? toIsoDate(new Date()),
  );
  const month = displayed.slice(0, 7);
  const { data } = useJournalMonth(month);
  const openJournal = useOpenJournal();
  const today = toIsoDate(new Date());

  const days = new Map((data?.days ?? []).map((d) => [d.date, d]));

  return (
    <Calendar
      size={size}
      date={displayed}
      onDateChange={(d) => setDisplayed(String(d).slice(0, 10))}
      highlightToday
      getDayProps={(date) => ({
        selected: date === selectedDate,
        onClick: () => openJournal.mutate(String(date).slice(0, 10)),
        "aria-label": days.has(String(date).slice(0, 10))
          ? `Journal ${date}`
          : `Open journal for ${date}`,
      })}
      renderDay={(date) => {
        const iso = String(date).slice(0, 10);
        const info = days.get(iso);
        const day = Number(iso.slice(8, 10));
        if (!info) return <div>{day}</div>;
        const dot = (
          <Indicator
            size={6}
            offset={-3}
            position="bottom-center"
            color={info.conflict ? "orange" : info.empty ? "gray" : "blue"}
            data-journal-day={iso}
          >
            <div style={{ fontWeight: iso === today ? 700 : undefined }}>{day}</div>
          </Indicator>
        );
        return info.conflict ? (
          <Tooltip label="More than one journal for this date" withArrow>
            <Box>{dot}</Box>
          </Tooltip>
        ) : (
          dot
        );
      }}
    />
  );
}
