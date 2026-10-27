import React, { useState } from 'react';
import { X, FileSpreadsheet, Loader2 } from 'lucide-react';
import type { MonthlyCohortData } from '../types';
import { API_BASE } from '../config/api';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: MonthlyCohortData) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Erro ao processar arquivo' }));
        throw new Error(errJson.error || 'Falha no processamento da planilha');
      }

      const result = await response.json();
      if (result.summary) {
        onSuccess(result.summary);
        onClose();
        setFile(null);
      } else {
        throw new Error('Formato de resposta inválido');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão com o servidor Go.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-base font-bold text-slate-900">
          Importar Planilha do RBX
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Faça o upload do relatório de bloqueados em Excel (.xlsx) ou CSV para alimentar a base.
        </p>

        {errorMsg && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* Dropzone */}
        <div className="mt-4 border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-6 text-center bg-slate-50/50 transition">
          <FileSpreadsheet className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-700">
            {file ? file.name : 'Arraste a planilha ou clique no botão abaixo'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Formatos aceitos: .xlsx, .xls ou .csv
          </p>

          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
            id="file-modal-upload"
          />
          <label
            htmlFor="file-modal-upload"
            className="mt-3 inline-block px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer transition shadow-xs"
          >
            {file ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
          </label>
        </div>

        <p className="text-[11px] text-slate-400 mt-3">
          O sistema identifica automaticamente as colunas: Código, Cliente, Plano, Valor, Data de Bloqueio, Data de Desbloqueio e Status.
        </p>

        <div className="mt-5 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
          >
            Cancelar
          </button>
          <button
            disabled={!file || uploading}
            onClick={handleUpload}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs font-medium text-white transition shadow-xs"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <span>Carregar Dados</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
