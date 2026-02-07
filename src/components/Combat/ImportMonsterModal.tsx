import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileJson, Loader2, Check, AlertCircle } from 'lucide-react';
import { Monster } from '../../types/campaign';
import { monsterService } from '../../services/monsterService';
import toast from 'react-hot-toast';

interface ImportMonsterModalProps {
  campaignId: string;
  existingMonsterNames: string[];
  onClose: () => void;
  onImportComplete: (monsters: Monster[]) => void;
}

interface ParsedMonster {
  name: string;
  cr: string;
  type: string;
  hp: number;
  valid: boolean;
  error?: string;
  raw: unknown;
}

export function ImportMonsterModal({
  campaignId,
  existingMonsterNames,
  onClose,
  onImportComplete,
}: ImportMonsterModalProps) {
  const [parsedMonsters, setParsedMonsters] = useState<ParsedMonster[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback(async (file: File): Promise<ParsedMonster> => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const monster = monsterService.parseMonsterFromJSON(json);
      return {
        name: monster.name,
        cr: monster.challenge_rating,
        type: monster.type,
        hp: monster.hit_points,
        valid: true,
        raw: json,
      };
    } catch (err) {
      return {
        name: file.name,
        cr: '-',
        type: '-',
        hp: 0,
        valid: false,
        error: err instanceof Error ? err.message : 'Format invalide',
        raw: null,
      };
    }
  }, []);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const jsonFiles = Array.from(files).filter(f => f.name.endsWith('.json'));
    if (jsonFiles.length === 0) {
      toast.error('Aucun fichier JSON detecte');
      return;
    }

    const results = await Promise.all(jsonFiles.map(parseFile));
    setParsedMonsters(prev => [...prev, ...results]);
  }, [parseFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFiles]);

  const removeMonster = useCallback((index: number) => {
    setParsedMonsters(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleImport = async () => {
    const validMonsters = parsedMonsters.filter(m => m.valid);
    if (validMonsters.length === 0) {
      toast.error('Aucun monstre valide a importer');
      return;
    }

    setImporting(true);
    try {
      const jsonData = validMonsters.map(m => m.raw);
      const { imported, errors } = await monsterService.importMonstersFromJSON(
        campaignId,
        jsonData,
        [...existingMonsterNames]
      );

      if (imported.length > 0) {
        toast.success(`${imported.length} monstre${imported.length > 1 ? 's' : ''} importe${imported.length > 1 ? 's' : ''}`);
        onImportComplete(imported);
      }

      if (errors.length > 0) {
        errors.forEach(err => toast.error(err));
      }

      onClose();
    } catch (err) {
      toast.error('Erreur lors de l\'import');
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedMonsters.filter(m => m.valid).length;
  const invalidCount = parsedMonsters.filter(m => !m.valid).length;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">
            Importer des monstres
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-amber-500 bg-amber-900/20'
                : 'border-gray-600 hover:border-gray-500 bg-gray-800/30'
            }`}
          >
            <Upload size={32} className={`mx-auto mb-3 ${isDragging ? 'text-amber-400' : 'text-gray-500'}`} />
            <p className="text-sm text-gray-300 mb-1">
              Glissez-deposez vos fichiers JSON ici
            </p>
            <p className="text-xs text-gray-500">
              ou cliquez pour selectionner
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {parsedMonsters.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  {parsedMonsters.length} fichier{parsedMonsters.length > 1 ? 's' : ''} charge{parsedMonsters.length > 1 ? 's' : ''}
                </span>
                {invalidCount > 0 && (
                  <span className="text-red-400">{invalidCount} invalide{invalidCount > 1 ? 's' : ''}</span>
                )}
              </div>

              <div className="border border-gray-700 rounded-lg overflow-hidden max-h-[240px] overflow-y-auto">
                {parsedMonsters.map((monster, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 px-3 py-2 border-b border-gray-800 last:border-b-0 ${
                      monster.valid ? 'bg-gray-800/30' : 'bg-red-900/20'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      monster.valid ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                    }`}>
                      {monster.valid ? <Check size={12} /> : <AlertCircle size={12} />}
                    </div>

                    <FileJson size={16} className="text-amber-500 shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200 truncate">
                          {monster.name}
                        </span>
                        {monster.valid && (
                          <span className="text-xs bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded">
                            FP {monster.cr}
                          </span>
                        )}
                      </div>
                      {monster.valid ? (
                        <div className="text-xs text-gray-500">
                          {monster.type} - {monster.hp} PV
                        </div>
                      ) : (
                        <div className="text-xs text-red-400">{monster.error}</div>
                      )}
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); removeMonster(idx); }}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-700 bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={validCount === 0 || importing}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {importing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Import en cours...
              </>
            ) : (
              <>
                <Upload size={14} />
                Importer {validCount > 0 ? `(${validCount})` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
