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
  ArrowUpToLine,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export interface MermaidDiagramProps {
  code: string;
  className?: string;
  isStreaming?: boolean;
  defaultExpanded?: boolean;
}

function extractDiagramSummary(cleanCode: string): {
  kindLabel: string;
  nodeCount: number;
  previewLabel: string;
} {
  if (!cleanCode) {
    return { kindLabel: 'Diagram', nodeCount: 0, previewLabel: '' };
  }
  const lines = cleanCode
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'));
  const firstLine = (lines[0] || '').toLowerCase();

  let kindLabel = 'Flowchart';
  if (firstLine.startsWith('sequencediagram')) kindLabel = 'Sequence';
  else if (firstLine.startsWith('statediagram')) kindLabel = 'State';
  else if (firstLine.startsWith('erdiagram')) kindLabel = 'ER Model';
  else if (firstLine.startsWith('classdiagram')) kindLabel = 'Class';
  else if (firstLine.startsWith('gantt')) kindLabel = 'Timeline';
  else if (firstLine.startsWith('mindmap')) kindLabel = 'Mindmap';
  else if (firstLine.startsWith('pie')) kindLabel = 'Breakdown';

  // Extract human-readable labels inside ["..."], ("..."), {"..."}, or participant/actor lines
  const labels: string[] = [];
  const labelRegex = /(?:\["([^"]+)"\]|\("([^"]+)"\)|\{"([^"]+)"\}|\[([^\][\n]+)\]|\{([^{}\n]+)\})/g;
  for (const line of lines.slice(1)) {
    if (line.startsWith('style ') || line.startsWith('classDef ') || line.startsWith('subgraph ')) {
      continue;
    }
    let m: RegExpExecArray | null;
    while ((m = labelRegex.exec(line)) !== null) {
      const candidate = (m[1] || m[2] || m[3] || m[4] || m[5] || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/^"+|"+$/g, '')
        .trim();
      if (candidate && candidate.length >= 2 && !labels.includes(candidate)) {
        labels.push(candidate);
      }
    }
    const partMatch = line.match(/^(?:participant|actor)\s+(?:[A-Za-z0-9_]+\s+as\s+)?(.+)$/i);
    if (partMatch && partMatch[1]) {
      const cleanPart = partMatch[1].replace(/^"+|"+$/g, '').trim();
      if (cleanPart && !labels.includes(cleanPart)) labels.push(cleanPart);
    }
  }

  const nodeCount = Math.max(labels.length, Math.max(0, lines.length - 1));
  const previewLabel = labels.slice(0, 2).join(' → ');
  return { kindLabel, nodeCount, previewLabel };
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
  defaultExpanded = true,
}) => {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isFullWidth, setIsFullWidth] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showSource, setShowSource] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalCanvasRef = useRef<HTMLDivElement>(null);

  // Inline 260px interactive canvas state
  const [inlineZoom, setInlineZoom] = useState<number>(1.0);
  const [inlinePan, setInlinePan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isInlineDragging, setIsInlineDragging] = useState<boolean>(false);
  const inlineDragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  // Full-screen modal interactive canvas state
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
  const summary = useMemo(() => extractDiagramSummary(cleanCode), [cleanCode]);

  // Calculate initial view focusing on the first part (entry layer) of the diagram
  const calculateInlineInitialView = useCallback(() => {
    if (!containerRef.current || !svgDims) return { zoom: 1.0, panX: 0, panY: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { zoom: 1.0, panX: 0, panY: 0 };

    const padX = 36;
    const padY = 24;
    const fitWidth = (rect.width - padX) / svgDims.width;
    const fitHeight = (rect.height - padY) / svgDims.height;
    const fullFit = Math.min(fitWidth, fitHeight);

    // If the entire diagram naturally fits vertically and horizontally at >= 0.85 scale, use centered full fit
    if (fullFit >= 0.85) {
      const zoom = Number(Math.min(fullFit, 1.05).toFixed(2));
      return { zoom, panX: 0, panY: 0 };
    }

    // For large/multi-tier flowcharts: focus on the first part (entry layer)
    // Maintain a legibility floor (0.85 - 1.0), adapting to canvas width
    const zoom = Number(Math.min(Math.max(fitWidth, 0.85), 1.0).toFixed(2));
    const scaledHeight = svgDims.height * zoom;

    // Anchor top of the diagram 20px below top edge of canvas
    let panY = 0;
    if (scaledHeight > rect.height - 40) {
      panY = Math.round((scaledHeight - rect.height) / 2 + 20);
    }

    return { zoom, panX: 0, panY };
  }, [svgDims]);

  // Full diagram bounding-box fit (bird's-eye view)
  const calculateInlineFullFit = useCallback(() => {
    if (!containerRef.current || !svgDims) return { zoom: 1.0, panX: 0, panY: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { zoom: 1.0, panX: 0, panY: 0 };
    const padX = 36;
    const padY = 28;
    const scaleX = (rect.width - padX) / svgDims.width;
    const scaleY = (rect.height - padY) / svgDims.height;
    const zoom = Number(Math.min(Math.max(Math.min(scaleX, scaleY), 0.15), 1.15).toFixed(2));
    return { zoom, panX: 0, panY: 0 };
  }, [svgDims]);

  const handleInlineFocusTop = useCallback(() => {
    const { zoom, panX, panY } = calculateInlineInitialView();
    setInlineZoom(zoom);
    setInlinePan({ x: panX, y: panY });
  }, [calculateInlineInitialView]);

  const handleInlineFitEntire = useCallback(() => {
    const { zoom, panX, panY } = calculateInlineFullFit();
    setInlineZoom(zoom);
    setInlinePan({ x: panX, y: panY });
  }, [calculateInlineFullFit]);

  const handleInlineResetZoom = useCallback(() => {
    setInlineZoom(1.0);
    if (!containerRef.current || !svgDims) {
      setInlinePan({ x: 0, y: 0 });
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const scaledHeight = svgDims.height * 1.0;
    const panY = scaledHeight > rect.height - 40
      ? Math.round((scaledHeight - rect.height) / 2 + 20)
      : 0;
    setInlinePan({ x: 0, y: panY });
  }, [svgDims]);

  const handleInlineDoubleClick = useCallback(() => {
    const fullFit = calculateInlineFullFit();
    if (Math.abs(inlineZoom - fullFit.zoom) <= 0.05 && Math.abs(inlinePan.y - fullFit.panY) <= 10) {
      handleInlineFocusTop();
    } else {
      handleInlineFitEntire();
    }
  }, [calculateInlineFullFit, inlineZoom, inlinePan.y, handleInlineFocusTop, handleInlineFitEntire]);

  // Auto-focus diagram on the entry layer at readable scale whenever SVG dimensions or layout change
  useEffect(() => {
    if (!isExpanded || showSource || !svgDims) return;
    const rafId = requestAnimationFrame(() => {
      const { zoom, panX, panY } = calculateInlineInitialView();
      setInlineZoom(zoom);
      setInlinePan({ x: panX, y: panY });
    });
    return () => cancelAnimationFrame(rafId);
  }, [svgDims, isExpanded, isFullWidth, showSource, calculateInlineInitialView]);

  // Non-passive cursor-centered wheel zoom on the inline 260px canvas
  useEffect(() => {
    if (!isExpanded || showSource || !containerRef.current) return;
    const canvasEl = containerRef.current;

    const handleInlineWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = canvasEl.getBoundingClientRect();
      const delta = -e.deltaY;
      const factor = Math.exp(delta * 0.002);

      setInlineZoom((prevZoom) => {
        const newZoom = Math.min(Math.max(0.15, Number((prevZoom * factor).toFixed(3))), 4.0);
        if (newZoom === prevZoom) return prevZoom;

        const cursorX = e.clientX - (rect.left + rect.width / 2);
        const cursorY = e.clientY - (rect.top + rect.height / 2);

        setInlinePan((prevPan) => ({
          x: Math.round(cursorX - (cursorX - prevPan.x) * (newZoom / prevZoom)),
          y: Math.round(cursorY - (cursorY - prevPan.y) * (newZoom / prevZoom)),
        }));

        return newZoom;
      });
    };

    canvasEl.addEventListener('wheel', handleInlineWheel, { passive: false });
    return () => {
      canvasEl.removeEventListener('wheel', handleInlineWheel);
    };
  }, [isExpanded, showSource, svgHtml]);

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

  const handleModalDoubleClick = useCallback(() => {
    const fit = calculateFitZoom();
    if (Math.abs(zoom - fit) > 0.05) {
      handleFitView();
    } else {
      handleResetZoom();
    }
  }, [calculateFitZoom, zoom, handleFitView, handleResetZoom]);

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

  // Non-passive cursor-centered wheel zoom in full-screen modal (Cyclode parity)
  useEffect(() => {
    if (!isModalOpen || !modalCanvasRef.current) return;
    const canvasEl = modalCanvasRef.current;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvasEl.getBoundingClientRect();
      const delta = -e.deltaY;
      const factor = Math.exp(delta * 0.002);

      setZoom((prevZoom) => {
        const newZoom = Math.min(Math.max(0.15, Number((prevZoom * factor).toFixed(3))), 5.0);
        if (newZoom === prevZoom) return prevZoom;

        const cursorX = e.clientX - (rect.left + rect.width / 2);
        const cursorY = e.clientY - (rect.top + rect.height / 2);

        setPan((prevPan) => ({
          x: Math.round(cursorX - (cursorX - prevPan.x) * (newZoom / prevZoom)),
          y: Math.round(cursorY - (cursorY - prevPan.y) * (newZoom / prevZoom)),
        }));

        return newZoom;
      });
    };

    canvasEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvasEl.removeEventListener('wheel', handleWheel);
    };
  }, [isModalOpen]);

  // Keyboard navigation when modal is open (Cyclode parity)
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => Math.min(5.0, Number((z + 0.25).toFixed(2))));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((z) => Math.max(0.15, Number((z - 0.25).toFixed(2))));
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      } else if (e.key === 'ArrowLeft') {
        setPan((p) => ({ ...p, x: p.x + 50 }));
      } else if (e.key === 'ArrowRight') {
        setPan((p) => ({ ...p, x: p.x - 50 }));
      } else if (e.key === 'ArrowUp') {
        setPan((p) => ({ ...p, y: p.y + 50 }));
      } else if (e.key === 'ArrowDown') {
        setPan((p) => ({ ...p, y: p.y - 50 }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, handleResetZoom]);

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
        className={`my-3 rounded-xl bg-[var(--ui-bg-subtle)] border border-[var(--ui-border)] overflow-hidden text-xs ${className}`}
      >
        <div className="flex items-center justify-between px-3.5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="font-semibold">Architecture Diagram (Source View)</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 hover:text-[var(--ui-text-primary)] transition-colors text-[11px] font-mono cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy Source'}</span>
          </button>
        </div>
        <div className="p-3 font-mono text-[11px] text-[color-mix(in_srgb,var(--ui-text-secondary)_80%,transparent)] whitespace-pre-wrap overflow-x-auto leading-relaxed bg-[color-mix(in_srgb,var(--ui-bg-sidebar)_40%,transparent)]">
          {cleanCode || code}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`my-2.5 rounded-lg bg-[color-mix(in_srgb,var(--ui-bg-subtle)_60%,transparent)] border border-[var(--ui-border)] overflow-hidden shadow-xs group/mermaid transition-colors ${
          isFullWidth ? 'w-full !max-w-none' : 'w-full'
        } ${className}`}
      >
        <div
          onClick={() => setIsExpanded((prev) => !prev)}
          className={`flex items-center justify-between gap-2 px-3 py-1.5 bg-[color-mix(in_srgb,var(--ui-bg-surface)_60%,transparent)] hover:bg-[color-mix(in_srgb,var(--ui-bg-surface)_85%,transparent)] ${
            isExpanded ? 'border-b border-[color-mix(in_srgb,var(--ui-border)_60%,transparent)]' : ''
          } text-[11px] text-[var(--ui-text-muted)] font-mono select-none cursor-pointer transition-colors`}
        >
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-[var(--ui-text-muted)] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[var(--ui-text-muted)] shrink-0" />
            )}
            <Sparkles className="w-3.5 h-3.5 text-[var(--ui-accent)] shrink-0" />
            <span className="text-[var(--ui-text-primary)] font-semibold text-[11.5px] truncate">
              Architecture Diagram
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)] border border-[var(--ui-border)] shrink-0 hidden sm:inline-flex">
              {summary.kindLabel}
              {summary.nodeCount > 0 ? ` · ${summary.nodeCount} nodes` : ''}
            </span>
            {!isExpanded && summary.previewLabel && (
              <span className="text-[11.5px] font-sans text-[var(--ui-text-muted)] truncate hidden md:inline">
                — {summary.previewLabel}
              </span>
            )}
          </div>

          <div
            className="flex items-center space-x-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {isExpanded && (
              <>
                <button
                  type="button"
                  onClick={() => setShowSource((s) => !s)}
                  className={`flex items-center space-x-1 transition-colors px-2 py-0.5 rounded text-[10.5px] cursor-pointer ${
                    showSource
                      ? 'bg-[color-mix(in_srgb,var(--ui-accent)_20%,transparent)] text-[var(--ui-accent)] font-semibold'
                      : 'hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)]'
                  }`}
                >
                  <span>{showSource ? 'Diagram' : 'Source'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFullWidth(!isFullWidth)}
                  className={`flex items-center space-x-1 transition-colors px-2 py-0.5 rounded text-[10.5px] cursor-pointer ${
                    isFullWidth
                      ? 'bg-[color-mix(in_srgb,var(--ui-accent)_20%,transparent)] text-[var(--ui-accent)] font-semibold'
                      : 'hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)]'
                  }`}
                  title={isFullWidth ? 'Standard Width' : 'Full Width'}
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span className="hidden sm:inline">{isFullWidth ? 'Standard' : 'Full Width'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  disabled={!svgHtml}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10.5px] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)] transition-colors cursor-pointer disabled:opacity-40"
                  title="Download SVG"
                >
                  <Download className="w-3 h-3" />
                  <span className="hidden sm:inline">SVG</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10.5px] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)] transition-colors cursor-pointer"
              title="Open full-screen pan & zoom diagram viewer"
            >
              <Maximize2 className="w-3 h-3" />
              <span className="hidden sm:inline">Expand</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10.5px] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)] transition-colors cursor-pointer"
              title="Copy Diagram Code"
            >
              {copied ? <Check className="w-3 h-3 text-[var(--ui-ok)]" /> : <Copy className="w-3 h-3" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {isExpanded &&
          (showSource ? (
            <pre className="p-3.5 text-[12px] font-mono leading-[1.55] text-[var(--ui-text-primary)] overflow-x-auto max-h-[290px] overflow-y-auto">
              <code>{cleanCode}</code>
            </pre>
          ) : (
            <div
              ref={containerRef}
              onDoubleClick={handleInlineDoubleClick}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                setIsInlineDragging(true);
                inlineDragStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  panX: inlinePan.x,
                  panY: inlinePan.y,
                };
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!isInlineDragging) return;
                setInlinePan({
                  x: Math.round(inlineDragStartRef.current.panX + (e.clientX - inlineDragStartRef.current.x)),
                  y: Math.round(inlineDragStartRef.current.panY + (e.clientY - inlineDragStartRef.current.y)),
                });
              }}
              onPointerUp={(e) => {
                if (!isInlineDragging) return;
                setIsInlineDragging(false);
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                } catch {}
              }}
              onPointerCancel={(e) => {
                if (!isInlineDragging) return;
                setIsInlineDragging(false);
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                } catch {}
              }}
              className={`relative h-[290px] overflow-hidden flex items-center justify-center select-none bg-[color-mix(in_srgb,var(--ui-bg-canvas)_35%,transparent)] ${
                isInlineDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {svgHtml ? (
                <>
                  <div
                    style={{
                      transform: `translate3d(${inlinePan.x}px, ${inlinePan.y}px, 0) scale(${inlineZoom})`,
                      transformOrigin: 'center center',
                      transition: isInlineDragging ? 'none' : 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
                      width: svgDims ? `${svgDims.width}px` : 'auto',
                      height: svgDims ? `${svgDims.height}px` : 'auto',
                    }}
                    className="flex items-center justify-center pointer-events-none [&>svg]:!w-full [&>svg]:!h-full [&>svg]:!max-w-none [&>svg]:pointer-events-auto"
                    dangerouslySetInnerHTML={{ __html: svgHtml }}
                  />

                  {/* Floating Calm UI Canvas Viewport Dock */}
                  <div
                    className="absolute bottom-3 right-3 z-10 flex items-center bg-[color-mix(in_srgb,var(--ui-bg-surface)_85%,transparent)] backdrop-blur-md border border-[var(--ui-border)] rounded-lg p-0.5 shadow-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setInlineZoom((z) => Math.max(0.15, Number((z - 0.2).toFixed(2))))}
                      className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] cursor-pointer transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleInlineResetZoom}
                      className="px-1.5 py-0.5 text-[10.5px] font-mono font-medium text-[var(--ui-text-primary)] hover:text-[var(--ui-accent)] min-w-[42px] text-center cursor-pointer transition-colors"
                      title="Reset to 100% Zoom"
                    >
                      {Math.round(inlineZoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setInlineZoom((z) => Math.min(4.0, Number((z + 0.2).toFixed(2))))}
                      className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] cursor-pointer transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-[1px] h-3.5 bg-[var(--ui-border)] mx-0.5" />
                    <button
                      type="button"
                      onClick={handleInlineFocusTop}
                      className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] cursor-pointer transition-colors"
                      title="Focus First Part (Entry Nodes)"
                    >
                      <ArrowUpToLine className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleInlineFitEntire}
                      className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] cursor-pointer transition-colors"
                      title="Fit Entire Diagram in View"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--ui-bg-surface)_90%,transparent)] backdrop-blur-xs border border-[var(--ui-border)] text-[10px] font-mono text-[var(--ui-text-muted)] pointer-events-none flex items-center space-x-1.5 select-none opacity-0 group-hover/mermaid:opacity-100 transition-opacity shadow-xs">
                    <span>Drag to pan</span>
                    <span className="opacity-40">·</span>
                    <span>Scroll to zoom</span>
                    <span className="opacity-40">·</span>
                    <span>Double-click to fit</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs font-mono text-[var(--ui-text-muted)] py-6">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--ui-accent)] border-t-transparent" />
                  <span>Rendering architecture diagram...</span>
                </div>
              )}
            </div>
          ))}
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
              className="relative w-full max-w-6xl h-[85vh] flex flex-col bg-[var(--ui-bg-subtle)] border border-[var(--ui-border)] rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-bg-surface)_40%,transparent)] select-none flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[var(--ui-accent)]" />
                  <span className="font-semibold text-xs text-[var(--ui-text-primary)]">
                    Architecture Diagram Inspection
                  </span>
                  <span className="text-[10px] text-[var(--ui-text-muted)] font-mono hidden sm:inline px-1.5 py-0.5 rounded bg-[var(--ui-bg-surface)] border border-[var(--ui-border)]">
                    Interactive Canvas
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-[color-mix(in_srgb,var(--ui-bg-subtle)_90%,transparent)] border border-[var(--ui-border)] rounded-lg p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.15, Number((z - 0.25).toFixed(2))))}
                      className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] cursor-pointer"
                      title="Zoom Out (-)"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      className="px-2 py-0.5 text-[11px] font-mono font-medium text-[var(--ui-text-primary)] hover:text-[var(--ui-accent)] min-w-[50px] text-center cursor-pointer"
                      title="Reset to 100% (0)"
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(5.0, Number((z + 0.25).toFixed(2))))}
                      className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] cursor-pointer"
                      title="Zoom In (+)"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleFitView}
                      className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-surface)] ml-0.5 border-l border-[color-mix(in_srgb,var(--ui-border)_60%,transparent)] cursor-pointer"
                      title="Fit to Screen"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSvg}
                    className="px-2.5 py-1 text-xs rounded-lg bg-[var(--ui-bg-surface)] hover:bg-[color-mix(in_srgb,var(--ui-bg-surface)_80%,transparent)] text-[var(--ui-text-secondary)] font-medium flex items-center space-x-1.5 border border-[var(--ui-border)] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download SVG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-[var(--ui-bg-surface)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] cursor-pointer"
                    title="Close (Esc)"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                ref={modalCanvasRef}
                className={`flex-1 relative overflow-hidden flex items-center justify-center select-none bg-[color-mix(in_srgb,var(--ui-bg-canvas)_40%,transparent)] ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                onDoubleClick={handleModalDoubleClick}
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
                onPointerCancel={(e) => {
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

                {/* Navigation Hint Pill */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[color-mix(in_srgb,var(--ui-bg-surface)_90%,transparent)] backdrop-blur-md border border-[var(--ui-border)] text-[10px] font-mono text-[var(--ui-text-muted)] pointer-events-none flex items-center space-x-2 select-none shadow-md">
                  <span>Drag to pan</span>
                  <span className="opacity-40">·</span>
                  <span>Scroll to zoom</span>
                  <span className="opacity-40">·</span>
                  <span>Double-click to toggle fit</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default MermaidDiagram;
