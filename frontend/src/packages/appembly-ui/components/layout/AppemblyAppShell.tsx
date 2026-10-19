import React from 'react';
import { CollapsibleSidebar, CollapsibleSidebarProps } from './CollapsibleSidebar';
import { BreadcrumbBar, BreadcrumbBarProps } from './BreadcrumbBar';

export interface AppemblyAppShellProps {
  sidebarProps: CollapsibleSidebarProps;
  breadcrumbProps?: BreadcrumbBarProps;
  pageTitle?: string;
  pageIcon?: React.ReactNode;
  pageSubtitle?: string;
  tabsToolbar?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Full-Viewport Appembly Application Shell.
 * Combines the single morphing CollapsibleSidebar + BreadcrumbBar + Main Scrollable Canvas.
 */
export const AppemblyAppShell: React.FC<AppemblyAppShellProps> = ({
  sidebarProps,
  breadcrumbProps,
  pageTitle,
  pageIcon,
  pageSubtitle,
  tabsToolbar,
  children,
}) => {
  return (
    <div className="w-screen h-screen overflow-hidden flex bg-[var(--ui-bg-canvas)] text-[var(--ui-text-primary)]">
      {/* Left Single Morphing Sidebar (Expanded Tree <-> Collapsed Mini Icon Rail) */}
      <CollapsibleSidebar {...sidebarProps} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {breadcrumbProps && <BreadcrumbBar {...breadcrumbProps} />}

        <main className="flex-1 overflow-y-auto px-8 pb-10 space-y-5 appembly-scrollbar">
          {/* Page Header & Segmented Tabs Toolbar */}
          {(pageTitle || tabsToolbar) && (
            <div className="space-y-4 pt-1">
              {pageTitle && (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {pageIcon && <span className="flex-shrink-0">{pageIcon}</span>}
                    <div>
                      <h1 className="text-[26px] font-semibold tracking-tight text-[var(--ui-text-primary)] leading-tight">
                        {pageTitle}
                      </h1>
                      {pageSubtitle && (
                        <p className="text-[13px] text-[var(--ui-text-muted)] mt-0.5">
                          {pageSubtitle}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tabsToolbar && <div>{tabsToolbar}</div>}
            </div>
          )}

          {/* Main Cards / Workspace Canvas */}
          <div className="space-y-5">{children}</div>
        </main>
      </div>
    </div>
  );
};
