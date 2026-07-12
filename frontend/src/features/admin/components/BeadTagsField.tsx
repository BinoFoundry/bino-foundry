import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BeadTagEntry } from "@/types/tags";

import { adminFieldClass } from "./admin-styles";

interface BeadTagsFieldProps {
  allTags: BeadTagEntry[];
  value: string[];
  onChange: (tags: string[]) => void;
}

export function BeadTagsField({ allTags, value, onChange }: BeadTagsFieldProps) {
  const [input, setInput] = useState("");

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return allTags
      .filter((t) => t.name.toLowerCase().includes(q) && !value.some((v) => v.toLowerCase() === t.name.toLowerCase()))
      .slice(0, 8);
  }, [allTags, input, value]);

  const addTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...value, trimmed]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">Tags</label>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px]"
            >
              {tag}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(input);
            }
          }}
          placeholder="Add tags…"
          className={adminFieldClass()}
        />
        {suggestions.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-background shadow-md">
            {suggestions.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                  onClick={() => addTag(tag.name)}
                >
                  {tag.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => addTag(input)} disabled={!input.trim()}>
        Add tag
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Tags are reusable across beads and power catalogue search.
      </p>
    </div>
  );
}
