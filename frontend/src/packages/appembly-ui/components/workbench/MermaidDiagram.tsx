import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  Check,
  Download,
  AlertCircle,
  Maximize2,
  Minimize2,
  ArrowLeftRight,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';

export interface MermaidDiagramProps {
  code: string;
  className?: string;
  isStreaming?: boolean;
}

function readCurrentThemeFromDOM(): { isLight: boolean; accentColor: string } {
  if (typeof document === 'undefined') {
    return { isLight: false, accentColor: '#4E8067' };
  }
  const isLight =
    document.documentElement.classList.contains('light-theme') ||
    document.documentElement.getAttribute('data-theme') === 'light';
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-accent')
    .trim();
  return {
    isLight,
    accentColor: accent || (isLight ? '#22543B' : '#4E8067'),
  };
}

function useThemeObserver(): { isLight: boolean; accentColor: string } {
  const [themeState, setThemeState] = useState(readCurrentThemeFromDOM);

  useEffect(() => {
    setThemeState(readCurrentThemeFromDOM());
    let debounceTimer: any = null;
    const observer = new MutationObserver((mutations) => {
      const isClassChange = mutations.some(
        (m) => m.attributeName === 'class' || m.attributeName === 'data-theme'
      );
      if (isClassChange) {
        if (debounceTimer) clearTimeout(debounceTimer);
        setThemeState(readCurrentThemeFromDOM());
        return;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setThemeState(readCurrentThemeFromDOM());
      }, 150);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, []);

  return themeState;
}

/**
 * Sanitizes and normalizes raw Mermaid diagram text:
 * - Strips leading/trailing markdown code fences (```mermaid ... ```)
 * - Strips standalone 'mermaid' header keywords
 * - Injects missing diagram declarations (e.g. flowchart TD)
 * - Auto-quotes unquoted node labels containing special chars, pipes (|), HTML breaks (<br/>), etc.
 */
export function sanitizeMermaidCode(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let code = raw.trim();

  code = code.replace(/^`{3,}(?:mermaid)?\s*\n?/i, '');
  code = code.replace(/\n?`{3,}\s*$/i, '');
  code = code.trim();

  const firstLine = code.split('\n')[0].trim();
  if (/^mermaid\s*$/i.test(firstLine)) {
    code = code.replace(/^mermaid\s*\n?/i, '').trim();
  }

  const diagramKeywords = [
    'flowchart',
    'graph',
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'stateDiagram-v2',
    'erDiagram',
    'gantt',
    'pie',
    'gitGraph',
    'journey',
    'mindmap',
    'quadrantChart',
    'timeline',
    'xychart-beta',
    'c4context',
    'c4container',
    'c4component',
    'c4dynamic',
    'c4deployment',
    'sankey-beta',
    'packet-beta',
    'kanban',
    'architecture-beta',
    'block-beta',
    'requirementDiagram',
  ];

  const firstNonEmptyLine =
    code
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('%%')) || '';
  const firstWord = firstNonEmptyLine.split(/[\s\t\n({[]/)[0];

  const hasDiagramType = diagramKeywords.some(
    (kw) =>
      firstWord.toLowerCase() === kw.toLowerCase() ||
      firstNonEmptyLine.toLowerCase().startsWith(kw.toLowerCase())
  );

  if (!hasDiagramType) {
    if (/-->|---|==>|-\.->|\[.*\]|\(.*\)/.test(code)) {
      code = 'flowchart TD\n' + code;
    }
  }

  const lines = code.split('\n');
  const sanitizedLines = lines.map((line) => {
    if (
      line.trim().startsWith('%%') ||
      line.trim().startsWith('style ') ||
      line.trim().startsWith('classDef ')
    ) {
      return line;
    }

    let l = line;

    l = l.replace(/([a-zA-Z0-9_.-]+)\(\[\s*([^\n\r]*?)\s*\]\)/g, (_, id, content) => {
      const clean = content.trim().replace(/^"+|"+$/g, '').replace(/"/g, "'");
      return `${id}(["${clean}"])`;
    });

    l = l.replace(/([a-zA-Z0-9_.-]+)\[\(\s*([^\n\r]*?)\s*\)\]/g, (_, id, content) => {
      const clean = content.trim().replace(/^"+|"+$/g, '').replace(/"/g, "'");
      return `${id}[("${clean}")]`;
    });

    l = l.replace(/([a-zA-Z0-9_.-]+)\(\(\s*([^\n\r]*?)\s*\)\)/g, (_, id, content) => {
      const clean = content.trim().replace(/^"+|"+$/g, '').replace(/"/g, "'");
      return `${id}(("${clean}"))`;
    });

    l = l.replace(
      /([a-zA-Z0-9_.-]+)\((?![\(\[])\s*([^\n\r)]*?)\s*(?<![\)\]])\)/g,
      (match, id, content) => {
        let clean = content.trim();
        if (clean.startsWith('"') && clean.endsWith('"') && (clean.match(/"/g) || []).length === 2)
          return match;
        clean = clean.replace(/^"+|"+$/g, '').replace(/"/g, "'");
        return `${id}("${clean}")`;
      }
    );

    l = l.replace(/([a-zA-Z0-9_.-]+)\{\s*([^\n\r{}]+?)\s*\}/g, (match, id, content) => {
      let clean = content.trim();
      if (clean.startsWith('"') && clean.endsWith('"') && (clean.match(/"/g) || []).length === 2)
        return match;
      clean = clean.replace(/^"+|"+$/g, '').replace(/"/g, "'");
      return `${id}{"${clean}"}`;
    });

    l = l.replace(
      /([a-zA-Z0-9_.-]+)\[(?!\()\s*([^\n\r\]]*?)\s*(?<!\))\]/g,
      (match, id, content) => {
        let clean = content.trim();
        if (clean.startsWith('"') && clean.endsWith('"') && (clean.match(/"/g) || []).length === 2) {
          return match;
        }
        clean = clean.replace(/^"+|"+$/g, '').replace(/"/g, "'");
        return `${id}["${clean}"]`;
      }
    );

    return l;
  });

  return sanitizedLines.join('\n');
}

export function repairMermaidAggressive(code: string): string {
  const lines = code.split('\n');
  const cleaned: string[] = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    line = line.replace(/(?:-->|---|==>|-\.->)\s*$/, '').trim();
    if (!line) continue;
    cleaned.push(line);
  }

  return cleaned.join('\n');
}

function extractSvgDimensions(svgString: string): { width: number; height: number } | null {
  if (!svgString) return null;
  const match = svgString.match(
    /viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i
  );
  if (match) {
    const width = parseFloat(match[3]);
    const height = parseFloat(match[4]);
    if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }
  return null;
}

let mermaidInstance: any = null;
async function getMermaidInstance() {
  if (!mermaidInstance) {
    const cdnUrl = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    const mod = await import(/* @vite-ignore */ cdnUrl);
    mermaidInstance = mod.default || mod;
  }
  return mermaidInstance;
}

async function configureMermaid(isLight: boolean, accentColor: string) {
  const mermaid = await getMermaidInstance();
  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: 'base',
    themeVariables: isLight
      ? {
          darkMode: false,
          background: 'transparent',
          mainBkg: '#FFFFFF',
          primaryColor: '#FFFFFF',
          primaryTextColor: '#0F172A',
          primaryBorderColor: accentColor || '#22543B',
          lineColor: accentColor || '#475569',
          secondaryColor: '#F8FAFC',
          secondaryTextColor: '#0F172A',
          secondaryBorderColor: '#CBD5E1',
          tertiaryColor: '#FFFFFF',
          tertiaryTextColor: '#0F172A',
          tertiaryBorderColor: '#E2E8F0',
          edgeLabelBackground: '#FFFFFF',
          nodeBorder: '#CBD5E1',
          nodeTextColor: '#0F172A',
          clusterBkg: '#F8FAFC',
          clusterBorder: '#CBD5E1',
          defaultLinkColor: accentColor || '#475569',
          titleColor: '#0F172A',
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontSize: '12px',
          actorBkg: '#FFFFFF',
          actorBorder: accentColor || '#22543B',
          actorTextColor: '#0F172A',
          actorLineColor: '#64748B',
          signalColor: accentColor || '#475569',
          signalTextColor: '#0F172A',
          labelBoxBkgColor: '#FFFFFF',
          labelBoxBorderColor: '#CBD5E1',
          labelTextColor: '#0F172A',
          loopTextColor: '#0F172A',
          noteBorderColor: '#E2E8F0',
          noteBkgColor: '#FEF3C7',
          noteTextColor: '#92400E',
        }
      : {
          darkMode: true,
          background: 'transparent',
          mainBkg: '#2C313A',
          primaryColor: '#2C313A',
          primaryTextColor: '#F1F5F9',
          primaryBorderColor: accentColor || '#4E8067',
          lineColor: accentColor || '#4E8067',
          secondaryColor: '#282C34',
          secondaryTextColor: '#F1F5F9',
          secondaryBorderColor: '#3E4451',
          tertiaryColor: '#21252B',
          tertiaryTextColor: '#F1F5F9',
          tertiaryBorderColor: '#3E4451',
          edgeLabelBackground: '#21252B',
          nodeBorder: '#3E4451',
          nodeTextColor: '#F1F5F9',
          clusterBkg: '#21252B',
          clusterBorder: '#3E4451',
          defaultLinkColor: accentColor || '#4E8067',
          titleColor: '#F1F5F9',
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontSize: '12px',
          actorBkg: '#2C313A',
          actorBorder: accentColor || '#4E8067',
          actorTextColor: '#F1F5F9',
          actorLineColor: '#5C6370',
          signalColor: accentColor || '#4E8067',
          signalTextColor: '#F1F5F9',
          labelBoxBkgColor: '#21252B',
          labelBoxBorderColor: '#3E4451',
          labelTextColor: '#F1F5F9',
          loopTextColor: '#F1F5F9',
          noteBorderColor: '#4B5263',
          noteBkgColor: '#3E4451',
          noteTextColor: '#E5C07B',
        },
    securityLevel: 'strict',
    fontFamily: 'Inter, -apple-system, sans-serif',
  });
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  code,
  className = '',
  isStreaming = false,
}) => {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullWidth, setIsFullWidth] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showSource, setShowSource] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalCanvasRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const svgDims = useMemo(() => extractSvgDimensions(svgHtml), [svgHtml]);
  const { isLight, accentColor } = useThemeObserver();
  const cleanCode = useMemo(() => sanitizeMermaidCode(code), [code]);

  const calculateFitZoom = useCallback(() => {
    if (!modalCanvasRef.current || !svgDims) return 1.0;
    const rect = modalCanvasRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return 1.0;
    const padding = 64;
    const scaleX = (rect.width - padding) / svgDims.width;
    const scaleY = (rect.height - padding) / svgDims.height;
    const fit = Math.min(Math.max(Math.min(scaleX, scaleY), 0.15), 2.0);
    return Number(fit.toFixed(2));
  }, [svgDims]);

  const handleFitView = useCallback(() => {
    const fit = calculateFitZoom();
    setZoom(fit);
    setPan({ x: 0, y: 0 });
  }, [calculateFitZoom]);

  const handleResetZoom = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      setPan({ x: 0, y: 0 });
      const rafId = requestAnimationFrame(() => {
        const fit = calculateFitZoom();
        setZoom(fit);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isModalOpen, calculateFitZoom]);

  useEffect(() => {
    let isMounted = true;
    if (!cleanCode || cleanCode.trim().length < 5) {
      setSvgHtml('');
      setError(null);
      return;
    }
    if (
      isStreaming &&
      (cleanCode.endsWith('-->') ||
        cleanCode.endsWith('---') ||
        cleanCode.endsWith('==>') ||
        cleanCode.endsWith('['))
    ) {
      return;
    }

    const renderId = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;

    async function renderChart() {
      try {
        setError(null);
        await configureMermaid(isLight, accentColor);
        const mermaid = await getMermaidInstance();
        const { svg } = await mermaid.render(renderId, cleanCode);
        if (isMounted) {
          setSvgHtml(svg);
        }
      } catch (primaryErr: any) {
        const repaired = repairMermaidAggressive(cleanCode);
        if (repaired && repaired !== cleanCode) {
          try {
            const retryId = `${renderId}-r`;
            const mermaid = await getMermaidInstance();
            const { svg } = await mermaid.render(retryId, repaired);
            if (isMounted) {
              setSvgHtml(svg);
              setError(null);
              return;
            }
          } catch {}
        }
        if (isMounted) {
          if (!isStreaming) {
            setError(primaryErr?.message || 'Invalid Mermaid syntax');
          }
          setSvgHtml('');
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
      for (const id of [renderId, `d${renderId}`, `${renderId}-r`, `d${renderId}-r`]) {
        const el = document.getElementById(id);
        if (el) el.remove();
      }
    };
  }, [cleanCode, isLight, accentColor, isStreaming]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!svgHtml) return;
    const blob = new Blob([svgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `appembly-diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div
        className={`my-3 rounded-xl bg-onedark-darker border border-onedark-borderSubtle overflow-hidden text-xs ${className}`}
      >
        <div className="flex items-center justify-between px-3.5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="font-semibold">Architecture Diagram (Source View)</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 hover:text-onedark-fgBright transition-colors text-[11px] font-mono cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy Source'}</span>
          </button>
        </div>
        <div className="p-3 font-mono text-[11px] text-onedark-fg/80 whitespace-pre-wrap overflow-x-auto leading-relaxed bg-onedark-darkest/40">
          {cleanCode || code}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`my-3 rounded-xl bg-onedark-darker/60 border border-onedark-borderSubtle overflow-hidden shadow-xs group/mermaid transition-all ${
          isFullWidth ? 'w-full !max-w-none' : 'w-full'
        } ${className}`}
      >
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-onedark-surface/60 border-b border-onedark-borderSubtle/60 text-[11px] text-onedark-muted font-mono select-none">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-onedark-accent" />
            <span className="text-onedark-accent font-semibold uppercase tracking-wider text-[10.5px]">
              Architecture Diagram
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setShowSource((s) => !s)}
              className={`flex items-center space-x-1 transition-colors px-2 py-0.5 rounded text-[10.5px] cursor-pointer ${
                showSource
                  ? 'bg-onedark-accent/20 text-onedark-accent font-semibold'
                  : 'hover:text-onedark-fgBright hover:bg-onedark-surface text-onedark-muted'
              }`}
            >
              <span>{showSource ? 'Diagram' : 'Source'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullWidth(!isFullWidth)}
              className={`flex items-center space-x-1 transition-colors px-2 py-0.5 rounded text-[10.5px] cursor-pointer ${
                isFullWidth
                  ? 'bg-onedark-accent/20 text-onedark-accent font-semibold'
                  : 'hover:text-onedark-fgBright hover:bg-onedark-surface text-onedark-muted'
              }`}
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>{isFullWidth ? 'Standard' : 'Full Width'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10.5px] hover:text-onedark-fgBright hover:bg-onedark-surface text-onedark-muted transition-colors cursor-pointer"
              title="Expand in full-screen modal"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Expand</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSvg}
              disabled={!svgHtml}
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10.5px] hover:text-onedark-fgBright hover:bg-onedark-surface text-onedark-muted transition-colors cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3 h-3" />
              <span>SVG</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10.5px] hover:text-onedark-fgBright hover:bg-onedark-surface text-onedark-muted transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-onedark-green" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {showSource ? (
          <pre className="p-3.5 text-[12px] font-mono leading-[1.55] text-onedark-fgBright overflow-x-auto">
            <code>{cleanCode}</code>
          </pre>
        ) : (
          <div
            ref={containerRef}
            onDoubleClick={() => setIsModalOpen(true)}
            title="Double-click to expand and inspect"
            className="p-5 overflow-x-auto flex items-center justify-center min-h-[140px] [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:transition-all cursor-pointer"
          >
            {svgHtml ? (
              <div
                className="w-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto"
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            ) : (
              <div className="flex items-center gap-2 text-xs font-mono text-onedark-muted py-6">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-onedark-accent border-t-transparent" />
                <span>Rendering architecture diagram...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-xs"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="relative w-full max-w-6xl h-[85vh] flex flex-col bg-onedark-darker border border-onedark-border rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-onedark-borderSubtle bg-onedark-surface/40 select-none flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-onedark-accent" />
                  <span className="font-semibold text-xs text-onedark-fgBright">
                    Architecture Diagram Inspection
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-onedark-darker/90 border border-onedark-border rounded-lg p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.15, Number((z - 0.25).toFixed(2))))}
                      className="p-1 rounded text-onedark-muted hover:text-onedark-fgBright hover:bg-onedark-surface"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      className="px-2 py-0.5 text-[11px] font-mono font-medium text-onedark-fgBright hover:text-onedark-accent min-w-[50px] text-center"
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(5.0, Number((z + 0.25).toFixed(2))))}
                      className="p-1 rounded text-onedark-muted hover:text-onedark-fgBright hover:bg-onedark-surface"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleFitView}
                      className="p-1 rounded text-onedark-muted hover:text-onedark-fgBright hover:bg-onedark-surface ml-0.5 border-l border-onedark-borderSubtle/60"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSvg}
                    className="px-2.5 py-1 text-xs rounded-lg bg-onedark-surface hover:bg-onedark-surface/80 text-onedark-fg font-medium flex items-center space-x-1.5 border border-onedark-borderSubtle"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download SVG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-onedark-surface text-onedark-muted hover:text-onedark-fgBright"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                ref={modalCanvasRef}
                className={`flex-1 relative overflow-hidden flex items-center justify-center select-none bg-onedark-bg/40 ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  setIsDragging(true);
                  dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!isDragging) return;
                  setPan({
                    x: Math.round(dragStartRef.current.panX + (e.clientX - dragStartRef.current.x)),
                    y: Math.round(dragStartRef.current.panY + (e.clientY - dragStartRef.current.y)),
                  });
                }}
                onPointerUp={(e) => {
                  if (!isDragging) return;
                  setIsDragging(false);
                  try {
                    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                  } catch {}
                }}
              >
                <div
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
                    width: svgDims ? `${svgDims.width}px` : 'auto',
                    height: svgDims ? `${svgDims.height}px` : 'auto',
                  }}
                  className="flex items-center justify-center pointer-events-none [&>svg]:!w-full [&>svg]:!h-full [&>svg]:!max-w-none [&>svg]:pointer-events-auto"
                  dangerouslySetInnerHTML={{ __html: svgHtml }}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default MermaidDiagram;
