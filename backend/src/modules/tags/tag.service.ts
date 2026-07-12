import { randomBytes } from "node:crypto";

import type { PostgrestError } from "@supabase/supabase-js";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { slugifyKebab } from "../../lib/slug.js";

export interface TagRecord {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

function mapTagRow(row: Record<string, unknown>): TagRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** True when migration 000053 has not been applied yet. */
function isTagsSchemaUnavailable(error: PostgrestError | null): boolean {
  if (!error) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("tags") &&
    (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("bead_tags"))
  );
}

async function allocateTagSlug(label: string): Promise<string> {
  const supabase = getSupabaseServiceRole();
  const base = slugifyKebab(label);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const { data, error } = await supabase.from("tags").select("id").eq("slug", candidate).maybeSingle();
    assertNoDbError(error);
    if (!data) return candidate;
  }
  throw new Error("Unable to allocate unique tags.slug");
}

export class TagService {
  async list(): Promise<TagRecord[]> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("tags").select("*").order("name");
    if (isTagsSchemaUnavailable(error)) return [];
    assertNoDbError(error);
    return (data ?? []).map((row) => mapTagRow(row as Record<string, unknown>));
  }

  async get(id: string): Promise<TagRecord> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("tags").select("*").eq("id", id).maybeSingle();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("Tag not found");
    return mapTagRow(data as Record<string, unknown>);
  }

  async create(name: string): Promise<TagRecord> {
    const trimmed = name.trim();
    if (!trimmed) throw new ConflictError("Tag name is required");

    const supabase = getSupabaseServiceRole();
    const { data: existing } = await supabase
      .from("tags")
      .select("*")
      .ilike("name", trimmed)
      .maybeSingle();
    if (existing) return mapTagRow(existing as Record<string, unknown>);

    const slug = await allocateTagSlug(trimmed);
    const { data, error } = await supabase
      .from("tags")
      .insert({ name: trimmed, slug })
      .select("*")
      .single();

    if (error?.code === "23505") {
      const { data: dup } = await supabase.from("tags").select("*").eq("slug", slug).maybeSingle();
      if (dup) return mapTagRow(dup as Record<string, unknown>);
    }
    assertNoDbError(error);
    return mapTagRow(data as Record<string, unknown>);
  }

  async remove(id: string): Promise<{ message: string }> {
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("tags").delete().eq("id", id);
    assertNoDbError(error);
    return { message: "Tag deleted" };
  }

  async tagsByBeadLibraryIds(libraryIds: string[]): Promise<Map<string, TagRecord[]>> {
    const map = new Map<string, TagRecord[]>();
    if (libraryIds.length === 0) return map;

    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("bead_tags")
      .select("bead_library_id, tags(id, name, slug, created_at, updated_at)")
      .in("bead_library_id", libraryIds);

    if (isTagsSchemaUnavailable(error)) return map;
    assertNoDbError(error);

    for (const row of data ?? []) {
      const libraryId = String((row as { bead_library_id: string }).bead_library_id);
      const tagRaw = (row as { tags: unknown }).tags;
      if (!tagRaw) continue;
      const tagRows = Array.isArray(tagRaw) ? tagRaw : [tagRaw];
      for (const t of tagRows) {
        const tag = mapTagRow(t as Record<string, unknown>);
        const list = map.get(libraryId) ?? [];
        list.push(tag);
        map.set(libraryId, list);
      }
    }

    for (const [key, list] of map) {
      map.set(
        key,
        [...list].sort((a, b) => a.name.localeCompare(b.name)),
      );
    }

    return map;
  }

  async resolveTagNames(names: string[]): Promise<TagRecord[]> {
    const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    const resolved: TagRecord[] = [];
    for (const name of unique) {
      resolved.push(await this.create(name));
    }
    return resolved;
  }

  async syncBeadLibraryTags(beadLibraryId: string, tagNames: string[] | undefined): Promise<TagRecord[]> {
    if (tagNames === undefined) return this.tagsByBeadLibraryIds([beadLibraryId]).then((m) => m.get(beadLibraryId) ?? []);

    const supabase = getSupabaseServiceRole();
    const tags = await this.resolveTagNames(tagNames);

    const { error: delErr } = await supabase.from("bead_tags").delete().eq("bead_library_id", beadLibraryId);
    assertNoDbError(delErr);

    if (tags.length > 0) {
      const { error: insErr } = await supabase.from("bead_tags").insert(
        tags.map((tag) => ({
          bead_library_id: beadLibraryId,
          tag_id: tag.id,
        })),
      );
      assertNoDbError(insErr);
    }

    return tags;
  }
}

export const tagService = new TagService();
