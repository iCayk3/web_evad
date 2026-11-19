import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  UserCheck,
  FileSpreadsheet,
  Layers,
  Filter,
  X,
  Headphones,
  CheckCircle2,
} from 'lucide-react';
import { DashboardTab } from './tabs/DashboardTab.tsx';
import { ReviewQueueTab } from './tabs/ReviewQueueTab.tsx';
import { ImportBatchesTab } from './tabs/ImportBatchesTab.tsx';
import { DetailsTab } from './tabs/DetailsTab.tsx';
import { ImportModal } from './components/ImportModal.tsx';
import { ImportBatch } from './types/omnichannel.types.ts';
import { omnichannelApi } from './api/omnichannel.api.ts';
import { CustomerHealthWorkspace } from './CustomerHealthWorkspace.tsx';

type ActiveTab = 'dashboard' | 'reviews' | 'batches' | 'details';

const OperationalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch batches list to provide friendly file names in filter badge
  useEffect(() => {
    omnichannelApi.listBatches().then((res) => {
      if (res && res.batches) {
        setBatches(res.batches);
      }
    }).catch(() => {});
  }, [refreshKey]);

  const handleImportCompleted = (batch: ImportBatch) => {
    setSelectedBatchIds((prev) => [...new Set([...prev, batch.id])]);
    setActiveTab('dashboard');
    setRefreshKey((prev) => prev + 1);
  };

  // Generate friendly label for selected batches
  const getSelectedBatchesLabel = () => {
    if (selectedBatchIds.length === 0) return null;
    if (selectedBatchIds.length === 1) {
      const match = batches.find((b) => b.id === selectedBatchIds[0]);
      const name = match?.file_name || `#${selectedBatchIds[0].slice(0, 8)}`;
      return `Relatório: ${name}`;
    }
    return `${selectedBatchIds.length} relatórios selecionados`;
  };

  const selectedBatchesTitle = selectedBatchIds
    .map((id) => batches.find((b) => b.id === id)?.file_name || id.slice(0, 8))
    .join(', ');

  const [initialClassificationFilter, setInitialClassificationFilter] = useState<string>('');

  const handleGoToDetailsWithClassification = (classification: string) => {
    setInitialClassificationFilter(classification);
    setActiveTab('details');
  };

  const compositeBatchId = selectedBatchIds.length > 0 ? selectedBatchIds.join(',') : undefined;

  return (
    <div className="min-h-full p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Container */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                Análises de Atendimento (Omnichannel)
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Inteligência operacional ISPCHAT × RBXSoft ISP · Eficiência, TMA/TME/TMR e Protocolos
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls - Friendly Active Batch Badge */}
        <div className="flex items-center gap-3">
          {selectedBatchIds.length > 0 && (
            <div
              className="px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-2 shadow-2xs animate-fadeIn"
              title={selectedBatchesTitle}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate max-w-[280px] sm:max-w-xs">{getSelectedBatchesLabel()}</span>
              <button
                onClick={() => setSelectedBatchIds([])}
                className="hover:bg-blue-200/60 rounded-full p-0.5 text-blue-600 cursor-pointer transition ml-1"
                title="Limpar seleção de relatórios"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modern Segmented Tab Switcher */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/80 w-fit shadow-xs">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Dashboard & Métricas</span>
        </button>

        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'details'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Detalhamento de Atendimentos</span>
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'reviews'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Fila de Revisão</span>
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'batches'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Cargas & Relatórios</span>
        </button>
      </div>

      {/* Main Viewport */}
      {activeTab === 'dashboard' && (
        <DashboardTab
          key={refreshKey}
          selectedBatchId={compositeBatchId}
          selectedBatchFileName={selectedBatchesTitle || undefined}
          onOpenImport={() => setIsImportModalOpen(true)}
          onGoToReviews={() => setActiveTab('reviews')}
          onGoToDetailsWithClassification={handleGoToDetailsWithClassification}
        />
      )}

      {activeTab === 'details' && (
        <DetailsTab
          key={`details-${refreshKey}-${initialClassificationFilter}`}
          selectedBatchId={compositeBatchId}
          initialClassification={initialClassificationFilter}
          onClearInitialClassification={() => setInitialClassificationFilter('')}
        />
      )}

      {activeTab === 'reviews' && (
        <ReviewQueueTab
          selectedBatchId={compositeBatchId}
          onRefreshStats={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {activeTab === 'batches' && (
        <ImportBatchesTab
          selectedBatchId={compositeBatchId}
          selectedBatchIds={selectedBatchIds}
          onOpenImport={() => setIsImportModalOpen(true)}
          onSelectBatches={(ids) => setSelectedBatchIds(ids)}
          onSelectBatch={(id) => {
            if (id) {
              setSelectedBatchIds([id]);
              setActiveTab('dashboard');
            } else {
              setSelectedBatchIds([]);
            }
          }}
          onApplyAndGoToDashboard={() => setActiveTab('dashboard')}
          onBatchDeleted={(deletedId) => {
            setSelectedBatchIds((prev) => prev.filter((id) => id !== deletedId));
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportCompleted={handleImportCompleted}
      />
    </div>
  );
};

export const OmnichannelPage: React.FC = () => <CustomerHealthWorkspace operations={<OperationalPage />}/>;
