import React, { useState } from 'react';
import { Header } from './components/Header';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { SystemSimulator } from './components/SystemSimulator';
import { CodeExplorer } from './components/CodeExplorer';
import { DocumentationView } from './components/DocumentationView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'diagram' | 'simulator' | 'code' | 'docs'>('diagram');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600/30 selection:text-indigo-200">
      {/* Universal Top Navigation Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'diagram' && <ArchitectureDiagram />}
        {activeTab === 'simulator' && <SystemSimulator />}
        {activeTab === 'code' && <CodeExplorer />}
        {activeTab === 'docs' && <DocumentationView />}
      </div>
    </div>
  );
}
