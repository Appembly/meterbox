import React, { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Clock,
  GitBranch,
  Layers,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { TimelineTaskItem } from '../../types';

export interface ProjectTaskTimelineProps {
  projectName: string;
  tasks: TimelineTaskItem[];
  totalHorizonHours?: number;
  onSelectTask?: (task: TimelineTaskItem) => void;
}

const STATUS_BADGE: Record<
  TimelineTaskItem['status'],
  { label: string; bg: string; text: string; bar: string }
> = {
  completed: {
    label: 'Merged',
    bg: 'bg-[#4E8067]/15',
    text: 'text-[#4E8067]',
    bar: 'bg-[#4E8067]',
  },
  running: {
    label: 'Swarm Active',
    bg: 'bg-amber-500/15',
    text: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-[#4E8067]',
  },
  review: {
    label: 'Eval Gate Review',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-600 dark:text-indigo-400',
    bar: 'bg-indigo-500',
  },
  queued: {
    label: 'Wave Queued',
    bg: 'bg-[var(--ui-bg-subtle)]',
    text: 'text-[var(--ui-text-muted)]',
    bar: 'bg-[#A9AFAB]',
  },
};

/**
 * Interactive Valiscale Project Task Timeline + Swarmteam DAG Wave View.
 * Shows topological execution waves, Gantt bars, assigned Runctor agent personas,
 * isolated git-worktree branches, and floating hover inspection cards.
 */
export const ProjectTaskTimeline: React.FC<ProjectTaskTimelineProps> = ({
  projectName,
  tasks,
  totalHorizonHours = 16,
  onSelectTask,
}) => {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(tasks[2]?.id || null);

  const hourMarkers = Array.from({ length: 9 }, (_, i) => i * 2);

  return (
    <section className="rounded-2xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] p-6 shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold text-[var(--ui-text-primary)] leading-snug">
              Project Task Timeline &amp; Swarmteam Wave Schedule
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#4E8067]/15 text-[#4E8067]">
              {projectName}
            </span>
          </div>
          <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
            Live dependency-ordered task waves executed in parallel git worktrees by Runctor agent pods.
          </p>
        </div>

        <div className="flex items-center gap-3 text-[12px] text-[var(--ui-text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4E8067]" />
            <span>Merged / Active Wave</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#A9AFAB]" />
            <span>Queued Wave</span>
          </span>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="border border-[var(--ui-border)] rounded-xl overflow-hidden">
        {/* Top Time Axis Header */}
        <div className="grid grid-cols-12 bg-[var(--ui-bg-subtle)]/70 border-b border-[var(--ui-border)] px-4 py-2.5 text-[11.5px] font-medium text-[var(--ui-text-muted)]">
          <div className="col-span-5 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[#4E8067]" />
            <span>Task · Wave · Assigned Runctor Persona</span>
          </div>
          <div className="col-span-7 flex items-center justify-between px-2 font-mono text-[11px]">
            {hourMarkers.map((h) => (
              <span key={h}>+{h}h</span>
            ))}
          </div>
        </div>

        {/* Task Rows */}
        <div className="divide-y divide-[var(--ui-border)]">
          {tasks.map((task) => {
            const badge = STATUS_BADGE[task.status];
            const isHovered = hoveredTaskId === task.id;
            const leftPct = Math.min(92, Math.max(0, (task.startHour / totalHorizonHours) * 100));
            const widthPct = Math.min(
              100 - leftPct,
              Math.max(10, (task.durationHours / totalHorizonHours) * 100)
            );

            return (
              <div
                key={task.id}
                onMouseEnter={() => setHoveredTaskId(task.id)}
                onClick={() => onSelectTask?.(task)}
                className={`grid grid-cols-12 items-center px-4 py-3 transition-colors cursor-pointer ${
                  isHovered ? 'bg-[var(--ui-bg-hover)]/65' : 'hover:bg-[var(--ui-bg-hover)]/40'
                }`}
              >
                {/* Left Column: Task Title, Wave Pill & Agent Persona */}
                <div className="col-span-5 pr-4 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--ui-bg-subtle)] text-[var(--ui-text-secondary)] font-semibold">
                      W{task.wave}
                    </span>
                    <span className="text-[13px] font-medium text-[var(--ui-text-primary)] truncate">
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 mt-1 text-[11px] text-[var(--ui-text-muted)]">
                    <span className="inline-flex items-center gap-1 text-[#4E8067] font-medium">
                      <Bot className="w-3 h-3" />
                      <span>{task.persona}</span>
                    </span>
                    {task.worktreeBranch && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10.5px]">
                        <GitBranch className="w-3 h-3" />
                        <span>{task.worktreeBranch}</span>
                      </span>
                    )}
                    {task.dependsOn && task.dependsOn.length > 0 && (
                      <span className="font-mono text-[10px] text-[var(--ui-text-muted)]">
                        deps: {task.dependsOn.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Column: Interactive Gantt Timeline Bar */}
                <div className="col-span-7 relative h-9 flex items-center px-2">
                  {/* Vertical Grid Guides */}
                  <div className="absolute inset-0 flex justify-between pointer-events-none px-2">
                    {hourMarkers.map((h) => (
                      <div
                        key={h}
                        className="w-px h-full border-r border-dashed border-[var(--ui-border)]"
                      />
                    ))}
                  </div>

                  {/* Gantt Task Bar */}
                  <div
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    className="relative h-7 rounded-lg bg-[var(--ui-bg-subtle)] border border-[var(--ui-border-strong)] overflow-hidden flex items-center px-2.5 shadow-2xs"
                  >
                    <div
                      style={{ width: `${task.progress}%` }}
                      className={`absolute inset-y-0 left-0 ${badge.bar} opacity-20 transition-all`}
                    />
                    <div
                      style={{ width: `${task.progress}%` }}
                      className={`absolute bottom-0 left-0 h-[3px] ${badge.bar}`}
                    />
                    <div className="relative z-10 w-full flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-medium text-[var(--ui-text-primary)] truncate">
                        {task.progress}%
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium ${badge.bg} ${badge.text}`}
                      >
                        {task.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {task.status === 'running' && (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        )}
                        {task.status === 'queued' && <Clock className="w-2.5 h-2.5" />}
                        <span>{badge.label}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected / Hovered Task Inspection Footer Strip */}
      {hoveredTaskId && (
        (() => {
          const activeTask = tasks.find((t) => t.id === hoveredTaskId);
          if (!activeTask) return null;
          return (
            <div className="mt-4 px-4 py-3 rounded-xl bg-[var(--ui-bg-subtle)]/70 border border-[var(--ui-border)] flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded-md bg-[#111618] text-[#F6F7F5] font-mono text-[11px]">
                  {activeTask.id}
                </span>
                <span className="font-semibold text-[var(--ui-text-primary)]">
                  {activeTask.title}
                </span>
                <span className="text-[var(--ui-text-muted)]">·</span>
                <span className="text-[#4E8067] font-medium">
                  Persona: {activeTask.persona}
                </span>
              </div>

              <div className="flex items-center gap-4 text-[12px]">
                {activeTask.worktreeBranch && (
                  <span className="inline-flex items-center gap-1 font-mono text-[var(--ui-text-secondary)]">
                    <GitBranch className="w-3.5 h-3.5 text-[#4E8067]" />
                    <span>{activeTask.worktreeBranch}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[#4E8067] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    Runctor Gate: {activeTask.evalGateStatus || 'passed'}
                  </span>
                </span>
              </div>
            </div>
          );
        })()
      )}
    </section>
  );
};
