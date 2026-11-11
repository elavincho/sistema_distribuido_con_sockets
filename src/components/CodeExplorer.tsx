import React, { useState } from 'react';
import { REPO_FILES } from '../data/repoFiles';
import { RepoFile } from '../types';
import { 
  FileCode, 
  FileText, 
  Settings, 
  Copy, 
  Check, 
  Download, 
  FolderGit2, 
  Search,
  ExternalLink
} from 'lucide-react';
import { exportRepositoryZip } from '../utils/zipExporter';

export const CodeExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<RepoFile>(REPO_FILES[1]); // Default: server.py or protocol.py
  const [filterCategory, setFilterCategory] = useState<'all' | 'code' | 'config' | 'doc'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const filteredFiles = REPO_FILES.filter((file) => {
    const matchesCategory = filterCategory === 'all' || file.category === filterCategory;
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          file.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingleFile = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (category: string, lang: string) => {
    if (category === 'code') return <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />;
    if (category === 'config') return <Settings className="w-4 h-4 text-amber-400 shrink-0" />;
    return <FileText className="w-4 h-4 text-emerald-400 shrink-0" />;
  };

  // Split lines for line numbers
  const lines = selectedFile.content.split('\n');

  return (
    <div className="flex h-[calc(100vh-61px)] bg-slate-950 overflow-hidden">
      {/* Left Sidebar: Repository File Tree */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900/40 flex flex-col shrink-0">
        {/* Repo Header */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-white tracking-wide">
                Archivos del Repositorio
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">{REPO_FILES.length} archivos</span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar archivo o módulo..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px]">
            <button
              onClick={() => setFilterCategory('all')}
              className={`flex-1 py-1 text-center rounded font-medium transition-colors ${
                filterCategory === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterCategory('code')}
              className={`flex-1 py-1 text-center rounded font-medium transition-colors ${
                filterCategory === 'code' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Código
            </button>
            <button
              onClick={() => setFilterCategory('config')}
              className={`flex-1 py-1 text-center rounded font-medium transition-colors ${
                filterCategory === 'config' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Infra
            </button>
            <button
              onClick={() => setFilterCategory('doc')}
              className={`flex-1 py-1 text-center rounded font-medium transition-colors ${
                filterCategory === 'doc' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Docs
            </button>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredFiles.map((file) => {
            const isSelected = selectedFile.name === file.name;
            return (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file)}
                className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-950/60 border border-indigo-500/40 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                {getFileIcon(file.category, file.language)}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono font-medium truncate">{file.name}</div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{file.description}</div>
                </div>
              </button>
            );
          })}
          {filteredFiles.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500">
              No se encontraron archivos con ese término.
            </div>
          )}
        </div>

        {/* Bottom Download All action */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={() => exportRepositoryZip()}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-sm shadow-indigo-900/30"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Todo (.zip)</span>
          </button>
        </div>
      </aside>

      {/* Right Content Area: Code Viewer */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* File Details Top Bar */}
        <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
          <div className="flex items-center gap-3">
            {getFileIcon(selectedFile.category, selectedFile.language)}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold font-mono text-white">{selectedFile.path}</h2>
                <span className="text-[10px] font-mono text-slate-500 uppercase px-1.5 py-0.5 bg-slate-800 rounded">
                  {selectedFile.language}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{selectedFile.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-700/50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado al portapapeles' : 'Copiar Archivo'}</span>
            </button>

            <button
              onClick={handleDownloadSingleFile}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-700/50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Guardar</span>
            </button>
          </div>
        </div>

        {/* Code Content with Line Numbers */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 bg-slate-950 leading-relaxed">
          <div className="table w-full">
            {lines.map((line, idx) => (
              <div key={idx} className="table-row hover:bg-slate-900/50 transition-colors">
                <span className="table-cell pr-4 text-right text-slate-600 select-none w-12 font-mono text-[11px] tabular-nums">
                  {idx + 1}
                </span>
                <span className="table-cell whitespace-pre font-mono text-slate-200">
                  {line || ' '}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
