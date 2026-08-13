import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";

import { AdminPage } from "../../components/AdminPage";
import { ADMIN_QUERY } from "../../routing";
import { getAdminDocSections } from "./admin-doc-content";
import {
  ADMIN_DOC_TOPICS,
  parseAdminDocTopic,
  type AdminDocTopicId,
} from "./admin-doc-topics";

/**
 * In-app documentation for Admin editors — clear feature guides without leaving the app.
 */
export function AdminDocumentationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const topic = parseAdminDocTopic(searchParams.get(ADMIN_QUERY.tab));

  const activeMeta = useMemo(
    () => ADMIN_DOC_TOPICS.find((t) => t.id === topic) ?? ADMIN_DOC_TOPICS[0]!,
    [topic],
  );
  const sections = useMemo(() => getAdminDocSections(topic), [topic]);

  const setTopic = (next: AdminDocTopicId) => {
    const params = new URLSearchParams(searchParams);
    if (next === "overview") params.delete(ADMIN_QUERY.tab);
    else params.set(ADMIN_QUERY.tab, next);
    setSearchParams(params, { replace: true });
  };

  return (
    <AdminPage>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:flex-row lg:gap-8">
        <aside className="shrink-0 lg:w-56">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">Documentation</h2>
          </div>
          <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
            Guides for every Admin editor. Start with Overview, then open the topic that matches
            the screen you are editing.
          </p>
          <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Documentation topics">
            {ADMIN_DOC_TOPICS.map((item) => {
              const active = item.id === topic;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTopic(item.id)}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-left text-xs transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="block font-medium">{item.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 hidden text-[10px] leading-snug lg:block",
                      active ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {item.summary}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <article className="min-w-0 flex-1 space-y-5 pb-8">
          <header className="border-b border-border pb-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Admin editor guide
            </p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">{activeMeta.label}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{activeMeta.summary}</p>
          </header>

          {sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">{section.heading}</h2>
              <div className="text-sm leading-relaxed text-muted-foreground">{section.body}</div>
            </section>
          ))}
        </article>
      </div>
    </AdminPage>
  );
}
