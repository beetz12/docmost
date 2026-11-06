import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { Divider, Select, Stack, Switch, Text, Title } from "@mantine/core";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { useGetSpacesQuery } from "@/features/space/queries/space-query.ts";
import { searchPage } from "@/features/search/services/search-service";
import { getPageById } from "@/features/page/services/page-service.ts";
import {
  useNotesSettings,
  useUpdateNotesSettings,
} from "@/notes/journal/journal-queries";
import { JOURNAL_HOTKEY_LABEL } from "@/notes/journal/journal-hotkey";

/** Searchable picker for an existing page (title search). */
function PagePicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 250);
  const { data: results } = useQuery({
    queryKey: ["notes-page-picker", debounced],
    queryFn: () => searchPage({ query: debounced, titleOnly: true, limit: 20 } as any),
    enabled: debounced.trim().length > 0,
  });
  const { data: current } = useQuery({
    queryKey: ["notes-page-picker-current", value],
    queryFn: () => getPageById({ pageId: value! }),
    enabled: !!value,
  });

  const options = useMemo(() => {
    const map = new Map<string, string>();
    if (current) map.set(current.id, current.title || "Untitled");
    for (const r of results ?? []) map.set(r.id, r.title || "Untitled");
    return [...map.entries()].map(([v, l]) => ({ value: v, label: l }));
  }, [results, current]);

  return (
    <Select
      label={label}
      description={description}
      placeholder="Search pages by title"
      searchable
      clearable
      data={options}
      value={value}
      onChange={(v) => onChange(v)}
      onSearchChange={setSearch}
      nothingFoundMessage={debounced ? "No pages found" : "Type to search"}
      maw={420}
    />
  );
}

export default function NotesSettingsPage() {
  const { data: settings } = useNotesSettings();
  const update = useUpdateNotesSettings();
  const { data: spaces } = useGetSpacesQuery({ limit: 100 } as any);

  if (!settings) return null;

  return (
    <>
      <DocumentTitle title="Journal & templates" />
      <SettingsTitle title="Journal & templates" />

      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          Open today's journal from anywhere with {JOURNAL_HOTKEY_LABEL}, the
          Journal link in the sidebar, or by typing a date ("today", "yest",
          "mar 5") in search.
        </Text>

        <Select
          label="Journal space"
          description="New journals are created under a “Journal” page in this space. Empty: the first space you can write in."
          clearable
          data={(spaces?.items ?? []).map((s) => ({ value: s.id, label: s.name }))}
          value={settings.journalSpaceId}
          onChange={(v) => update.mutate({ journalSpaceId: v })}
          maw={420}
        />

        <Divider />
        <Title order={3} size="h5">
          Templates
        </Title>
        <Text size="sm" c="dimmed">
          A template is any existing page. These placeholders are replaced with
          the journal date: {"{{date}}"}, {"{{weekday}}"}, {"{{day}}"},{" "}
          {"{{month}}"}, {"{{year}}"}, {"{{longdate}}"}.
        </Text>

        <PagePicker
          label="Journal template"
          description="Used for every new journal."
          value={settings.journalTemplatePageId}
          onChange={(v) => update.mutate({ journalTemplatePageId: v })}
        />

        <PagePicker
          label="Page template"
          description="Default page template. New journals use it when no journal template is set and it is enabled."
          value={settings.pageTemplatePageId}
          onChange={(v) => update.mutate({ pageTemplatePageId: v })}
        />

        <Switch
          label="Use the page template for new journals when no journal template is set"
          checked={settings.pageTemplateEnabled}
          onChange={(e) =>
            update.mutate({ pageTemplateEnabled: e.currentTarget.checked })
          }
        />
      </Stack>
    </>
  );
}
