"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Copy } from "lucide-react";
import { useConsole } from "../../ConsoleProvider";
import { DOC_CHAPTERS } from "../../../types/meterbox";
import { Button, Card, CardHeader, Input, Notice, PageHeader, Pill } from "../../ui/primitives";

export const DocsView: React.FC = () => {
  const { org, env } = useConsole();
  const [selectedId, setSelectedId] = useState(DOC_CHAPTERS[0]?.id || "doc-tenancy");
  const [search, setSearch] = useState("");
  const [codeTabIdx, setCodeTabIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const filteredChapters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DOC_CHAPTERS.filter(
      (c) =>
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.tag.toLowerCase().includes(q),
    );
  }, [search]);

  const chapter = DOC_CHAPTERS.find((c) => c.id === selectedId) || DOC_CHAPTERS[0];
  const activeCode = chapter?.codeTabs?.[codeTabIdx] || chapter?.codeTabs?.[0];

  const handleSelectChapter = (id: string) => {
    setSelectedId(id);
    setCodeTabIdx(0);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        orgName={org?.name}
        envType={env?.type}
        envName={env?.name}
        title="System Architecture & Specifications"
        subtitle="Technical reference for Meterbox's Go control plane, 48h SETNX idempotency, ClickHouse rollups, and sub-5ms edge quota evaluation."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Chapter Navigation (Single Surface) */}
        <Card className="lg:col-span-4 flex flex-col self-start">
          <CardHeader
            title="Architecture chapters"
            subtitle={`${DOC_CHAPTERS.length} specification modules`}
          />
          <div className="px-4 pb-3">
            <Input
              placeholder="Filter chapters…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {filteredChapters.map((ch) => {
              const active = ch.id === chapter?.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  data-active={active}
                  onClick={() => handleSelectChapter(ch.id)}
                  className="mbx-list-item px-4 py-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold mbx-mono text-[var(--primary)]">
                      CHAPTER {ch.num}
                    </span>
                    <Pill tone={active ? "ok" : "neutral"} mono>
                      {ch.tag}
                    </Pill>
                  </div>
                  <div
                    className={`mt-1 text-[14px] font-semibold ${
                      active ? "text-[var(--primary)]" : "text-[var(--foreground)]"
                    }`}
                  >
                    {ch.title}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-[var(--muted-foreground)] line-clamp-2">{ch.summary}</p>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Right: Chapter Content */}
        {chapter && (
          <div className="lg:col-span-8 space-y-4">
            <Card className="p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 text-[12px] mbx-mono text-[var(--primary)] font-semibold">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>SPECIFICATION {chapter.num}</span>
                  <span>·</span>
                  <span>{chapter.tag.toUpperCase()}</span>
                </div>
                <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em]">{chapter.title}</h2>
                <p className="mt-1.5 text-[13.5px] text-[var(--muted-foreground)] leading-relaxed">
                  {chapter.summary}
                </p>
              </div>

              {/* Execution Flow Pipeline */}
              {chapter.flow && chapter.flow.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                    Execution Pipeline Flow
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {chapter.flow.map((step, i) => (
                      <React.Fragment key={step}>
                        <span className="px-2.5 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px] font-medium mbx-mono">
                          {step}
                        </span>
                        {i < chapter.flow.length - 1 && (
                          <ArrowRight className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Formula if present */}
              {chapter.formula && (
                <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                  <div className="mbx-mono text-[13px] font-semibold text-[var(--primary)]">
                    {chapter.formula.math}
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">{chapter.formula.caption}</div>
                </div>
              )}

              {/* Sections (Single Surface Dividers) */}
              <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {chapter.sections.map((sec) => (
                  <div
                    key={sec.num}
                    className="py-4 space-y-1"
                  >
                    <div className="text-[11px] font-semibold mbx-mono text-[var(--primary)]">SECTION {sec.num}</div>
                    <h3 className="text-[14.5px] font-semibold text-[var(--foreground)]">{sec.heading}</h3>
                    <p className="text-[13px] text-[var(--muted-foreground)] leading-relaxed">{sec.body}</p>
                  </div>
                ))}
              </div>

              {/* Callout */}
              {chapter.callout && (
                <Notice
                  tone={chapter.callout.kind === "warn" ? "warn" : "ok"}
                  title={chapter.callout.kind === "warn" ? "Operational Safeguard" : "Architectural Guarantee"}
                  detail={chapter.callout.text}
                />
              )}

              {/* Specification Table */}
              {chapter.table && (
                <div className="rounded-xl border border-[var(--border)] overflow-x-auto mbx-scroll">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border)] text-[11.5px] font-medium text-[var(--muted-foreground)]">
                        {chapter.table.headers.map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chapter.table.rows.map((row, idx) => (
                        <tr key={idx} className="border-b border-[var(--border)] last:border-0">
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className={`px-4 py-2.5 ${cIdx === 0 ? "mbx-mono font-medium" : ""}`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Code Tabs */}
              {chapter.codeTabs && chapter.codeTabs.length > 0 && activeCode && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {chapter.codeTabs.map((ct, idx) => (
                        <button
                          key={ct.label}
                          type="button"
                          onClick={() => setCodeTabIdx(idx)}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                            codeTabIdx === idx
                              ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)]"
                              : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]"
                          }`}
                        >
                          <span className="mbx-mono uppercase text-[10.5px] mr-1.5 text-[var(--primary)]">
                            [{ct.badge}]
                          </span>
                          {ct.label}
                        </button>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard?.writeText(activeCode.code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1400);
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? "Copied" : activeCode.file}
                    </Button>
                  </div>
                  <pre className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] mbx-mono text-[12px] overflow-x-auto leading-relaxed">
                    {activeCode.code}
                  </pre>
                  <p className="text-[12px] text-[var(--muted-foreground)]">{activeCode.caption}</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
