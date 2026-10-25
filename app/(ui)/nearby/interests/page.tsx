"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SubHeader from "@/components/SubHeader";
import { XIcon } from "@/components/Icons";
import { useCurrentUser } from "@/components/useSession";
import { MAX_TAGS, SUGGESTED_TAGS, loadInterests, saveInterests } from "@/components/nearbyPrefs";

function Editor({ userId }: { userId: string }) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(() => loadInterests(userId));
  const [draft, setDraft] = useState("");
  const full = tags.length >= MAX_TAGS;

  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!t || full || tags.includes(t)) return;
    setTags([...tags, t]);
  };
  const submit = () => {
    add(draft);
    setDraft("");
  };
  const save = () => {
    saveInterests(userId, tags);
    router.back();
  };

  return (
    <>
      <SubHeader title="Interests" onSave={save} />
      <div className="px-4 py-6">
        <p className="text-sm text-neutral-500">Add up to {MAX_TAGS} things you&apos;re into. We use them to find people who share them.</p>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm font-semibold">Your interests</p>
          <p className="text-xs text-neutral-500">
            {tags.length}/{MAX_TAGS}
          </p>
        </div>
        <div className="mt-2 flex min-h-10 flex-wrap gap-2">
          {tags.length === 0 && <p className="text-sm text-neutral-400">Nothing yet. Add one below.</p>}
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTags(tags.filter((x) => x !== t))}
              aria-label={`Remove ${t}`}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 py-1.5 pl-3 pr-2.5 text-sm font-semibold text-white"
            >
              {t}
              <XIcon />
            </button>
          ))}
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={30}
            disabled={full}
            placeholder={full ? "Remove one to add another" : "Add your own"}
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:bg-neutral-50"
          />
          <button
            type="submit"
            disabled={full || !draft.trim()}
            className="rounded-lg border border-neutral-300 px-4 text-sm font-semibold disabled:text-neutral-300"
          >
            Add
          </button>
        </form>

        <p className="mt-6 text-sm font-semibold">Suggested</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
            <button
              key={t}
              onClick={() => add(t)}
              disabled={full}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:opacity-40"
            >
              + {t}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function InterestsPage() {
  const user = useCurrentUser();
  if (!user) return null;
  return <Editor userId={user.id} />;
}
