import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/theme.css';
import { AppemblyThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../components/primitives/Toast';
import { ValiscalePreview } from './ValiscalePreview';
import { AppemblyLandingPage } from '../components/marketing/AppemblyLandingPage';

type ShowcaseView = 'studio' | 'primitives' | 'landing';

const ShowcaseRoot: React.FC = () => {
  const [view, setView] = useState<ShowcaseView>(() => {
    if (window.location.hash === '#landing') return 'landing';
    if (window.location.hash === '#primitives') return 'primitives';
    return 'studio';
  });

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#landing') setView('landing');
      else if (window.location.hash === '#primitives') setView('primitives');
      else if (window.location.hash === '#studio') setView('studio');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="relative">
      {view === 'landing' ? (
        <AppemblyLandingPage
          onOpenStudio={() => {
            window.location.hash = '#studio';
            setView('studio');
          }}
        />
      ) : (
        <ValiscalePreview initialTabId={view === 'primitives' ? 'primitives' : 'overview'} />
      )}

      {/* Floating Showcase Switcher Pill */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 p-1 rounded-full bg-[#111618]/95 text-[#F6F7F5] border border-[#252E31] shadow-lg text-xs">
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#studio';
            setView('studio');
          }}
          className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
            view === 'studio' ? 'bg-[#4E8067] text-[#F6F7F5]' : 'text-[#A9AFAB] hover:text-[#F6F7F5]'
          }`}
        >
          Valiscale Studio
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#primitives';
            setView('primitives');
          }}
          className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
            view === 'primitives'
              ? 'bg-[#4E8067] text-[#F6F7F5]'
              : 'text-[#A9AFAB] hover:text-[#F6F7F5]'
          }`}
        >
          Primitives
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#landing';
            setView('landing');
          }}
          className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
            view === 'landing' ? 'bg-[#4E8067] text-[#F6F7F5]' : 'text-[#A9AFAB] hover:text-[#F6F7F5]'
          }`}
        >
          Company Landing
        </button>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppemblyThemeProvider defaultTheme="light">
      <ToastProvider>
        <ShowcaseRoot />
      </ToastProvider>
    </AppemblyThemeProvider>
  </React.StrictMode>
);
