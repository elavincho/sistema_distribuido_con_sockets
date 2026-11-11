import React from 'react';
import { Download, GitBranch } from 'lucide-react';
import { exportRepositoryZip } from '../utils/zipExporter';

interface HeaderProps {
  activeTab: 'diagram' | 'simulator' | 'code' | 'docs';
  setActiveTab: (tab: 'diagram' | 'simulator' | 'code' | 'docs') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-50">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
          <GitBranch className="w-4 h-4" />
        </div>
        <span className="text-base font-semibold tracking-tight text-white whitespace-nowrap">
          Sistema Distribuido Sockets
        </span>
      </div>

      {/* Zone 2: 4 clean single-line navigation links/tabs */}
      <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-900/80 border border-slate-800 rounded-lg">
        <button
          onClick={() => setActiveTab('diagram')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'diagram'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          Diagrama de Arquitectura
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'simulator'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          Simulador en Vivo
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'code'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          Código del Repositorio
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'docs'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          Documentación & Protocolo
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => exportRepositoryZip()}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-indigo-900/30 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Descargar Repositorio (.zip)</span>
        </button>
      </div>
    </header>
  );
};
