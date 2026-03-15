import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Upload, Link } from 'lucide-react';
import { Monster, MonsterAbilities, MonsterEntry } from '../../types/campaign';
import { monsterService } from '../../services/monsterService';
import { tokenLibrary, fetchTokenLibrary, saveTokenLibrary } from '../../services/tokenLibraryService';

interface VTTCustomMonsterModalProps {
  campaignId: string;
  roomId: string;
  onClose: () => void;
  onSaved: () => void;
}

const CUSTOM_MONSTERS_FOLDER = 'Monstres customs';

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function DynamicEntryList({
  label,
  entries,
  onChange,
}: {
  label: string;
  entries: MonsterEntry[];
  onChange: (entries: MonsterEntry[]) => void;
}) {
  const add = () => onChange([...entries, { name: '', description: '' }]);
  const remove = (i: number) => onChange(entries.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof MonsterEntry, value: string) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], [field]: value };
    onChange(copy);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          <Plus size={12} /> Ajouter
        </button>
      </div>
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 space-y-1">
            <input
              className="w-full px-3 py-1.5 bg-black/40 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:border-amber-600 focus:outline-none"
              placeholder="Nom"
              value={entry.name}
              onChange={(e) => update(i, 'name', e.target.value)}
            />
            <textarea
              className="w-full px-3 py-1.5 bg-black/40 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:border-amber-600 focus:outline-none resize-none"
              placeholder="Description"
              rows={2}
              value={entry.description}
              onChange={(e) => update(i, 'description', e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors mt-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function VTTCustomMonsterModal({ campaignId, roomId, onClose, onSaved }: VTTCustomMonsterModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [size, setSize] = useState('M');
  const [alignment, setAlignment] = useState('');
  const [ac, setAc] = useState(10);
  const [acDesc, setAcDesc] = useState('');
  const [hp, setHp] = useState(1);
  const [hpFormula, setHpFormula] = useState('');
  const [speedText, setSpeedText] = useState('9 m');
  const [abilities, setAbilities] = useState<MonsterAbilities>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const [savingThrows, setSavingThrows] = useState('');
  const [skills, setSkills] = useState('');
  const [vulns, setVulns] = useState('');
  const [resistances, setResistances] = useState('');
  const [dmgImmunities, setDmgImmunities] = useState('');
  const [condImmunities, setCondImmunities] = useState('');
  const [senses, setSenses] = useState('');
  const [languages, setLanguages] = useState('');
  const [cr, setCr] = useState('1');
  const [xp, setXp] = useState(200);
  const [traits, setTraits] = useState<MonsterEntry[]>([]);
  const [actions, setActions] = useState<MonsterEntry[]>([{ name: '', description: '' }]);
  const [bonusActions, setBonusActions] = useState<MonsterEntry[]>([]);
  const [reactions, setReactions] = useState<MonsterEntry[]>([]);
  const [legendaryActions, setLegendaryActions] = useState<MonsterEntry[]>([]);
  const [legendaryDesc, setLegendaryDesc] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageMode, setImageMode] = useState<'url' | 'upload' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const parseSpeed = (): Record<string, string> => {
    const speed: Record<string, string> = {};
    const parts = speedText.split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      const named = part.match(/^(nage|vol|fouissement|escalade|creusement)\s+(.+)$/i);
      if (named) {
        speed[named[1].toLowerCase()] = named[2];
      } else if (!speed['marche']) {
        speed['marche'] = part;
      }
    }
    return speed;
  };

  const ensureCustomMonstersFolder = async (): Promise<string> => {
    const lib = await fetchTokenLibrary(roomId);
    tokenLibrary.setCache(lib);

    const existing = lib.folders.find(f => f.name === CUSTOM_MONSTERS_FOLDER);
    if (existing) return existing.id;

    const folder = tokenLibrary.createFolder(CUSTOM_MONSTERS_FOLDER);
    const updated = tokenLibrary.get();
    await saveTokenLibrary(roomId, updated);
    return folder.id;
  };

  const addTokenToLibrary = async (monster: Monster, folderId: string) => {
    tokenLibrary.addToken({
      name: monster.name,
      imageUrl: monster.image_url || '',
      folderId,
      size: getSizeMultiplier(monster.size),
      color: '#ef4444',
      hp: monster.hit_points,
      maxHp: monster.hit_points,
      showLabel: true,
    });
    await saveTokenLibrary(roomId, tokenLibrary.get());
  };

  const getSizeMultiplier = (size: string): number => {
    const map: Record<string, number> = { TP: 0.5, P: 0.75, M: 1, G: 2, TG: 3, Gig: 4 };
    return map[size] ?? 1;
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const monster: Monster = {
        source: 'custom',
        slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: name.trim(),
        size,
        type: type.trim(),
        alignment: alignment.trim(),
        armor_class: ac,
        armor_desc: acDesc.trim(),
        hit_points: hp,
        hit_points_formula: hpFormula.trim(),
        speed: parseSpeed(),
        abilities,
        saving_throws: savingThrows.trim(),
        skills: skills.trim(),
        vulnerabilities: vulns.trim(),
        resistances: resistances.trim(),
        damage_immunities: dmgImmunities.trim(),
        condition_immunities: condImmunities.trim(),
        senses: senses.trim(),
        languages: languages.trim(),
        challenge_rating: cr,
        xp,
        traits: traits.filter((t) => t.name.trim()),
        actions: actions.filter((a) => a.name.trim()),
        bonus_actions: bonusActions.filter((b) => b.name.trim()),
        reactions: reactions.filter((r) => r.name.trim()),
        legendary_actions: legendaryActions.filter((l) => l.name.trim()),
        legendary_description: legendaryDesc.trim(),
        image_url: imageUrl.trim() || undefined,
      };

      const saved = await monsterService.saveToCampaign(campaignId, monster);

      const folderId = await ensureCustomMonstersFolder();
      await addTokenToLibrary(saved, folderId);

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const updateAbility = (key: keyof MonsterAbilities, value: number) => {
    setAbilities((prev) => ({ ...prev, [key]: value }));
  };

  const abilityFields: Array<{ key: keyof MonsterAbilities; label: string }> = [
    { key: 'str', label: 'FOR' },
    { key: 'dex', label: 'DEX' },
    { key: 'con', label: 'CON' },
    { key: 'int', label: 'INT' },
    { key: 'wis', label: 'SAG' },
    { key: 'cha', label: 'CHA' },
  ];

  const sizes = [
    { value: 'TP', label: 'Tres petit' },
    { value: 'P', label: 'Petit' },
    { value: 'M', label: 'Moyen' },
    { value: 'G', label: 'Grand' },
    { value: 'TG', label: 'Tres grand' },
    { value: 'Gig', label: 'Gigantesque' },
  ];

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 10000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border border-gray-800 rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <div>
            <h3 className="text-lg font-semibold text-white">Nouveau monstre custom</h3>
            <p className="text-xs text-gray-500 mt-0.5">Sera sauvegarde dans la campagne et dans le dossier "Monstres customs"</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 p-2 rounded hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nom *</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Gobelin chef"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Ex: Humanoide"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Taille</label>
              <select
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              >
                {sizes.map((s) => (
                  <option key={s.value} value={s.value}>{s.label} ({s.value})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Alignement</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={alignment}
                onChange={(e) => setAlignment(e.target.value)}
                placeholder="Ex: Chaotique Mauvais"
              />
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <label className="block text-xs text-gray-400 mb-2">Image du token</label>
            {imageMode === null && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setImageMode('url')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 hover:text-white transition-colors"
                >
                  <Link size={12} /> URL
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode('upload')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 hover:text-white transition-colors"
                >
                  <Upload size={12} /> Fichier
                </button>
                {imageUrl && (
                  <div className="flex items-center gap-2 ml-2">
                    <img src={imageUrl} alt="" className="h-7 w-7 rounded object-cover border border-gray-600" />
                    <span className="text-xs text-green-400">Image definie</span>
                    <button type="button" onClick={() => { setImageUrl(''); }} className="text-xs text-gray-500 hover:text-red-400">Supprimer</button>
                  </div>
                )}
              </div>
            )}
            {imageMode === 'url' && (
              <div className="flex gap-2 items-center">
                <input
                  autoFocus
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... (.png, .jpg, .webp)"
                  className="flex-1 px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                />
                <button type="button" onClick={() => setImageMode(null)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 transition-colors">OK</button>
              </div>
            )}
            {imageMode === 'upload' && (
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setImageUrl(ev.target!.result as string);
                      setImageMode(null);
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="flex-1 text-xs text-gray-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600"
                />
                <button type="button" onClick={() => setImageMode(null)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 transition-colors">Annuler</button>
              </div>
            )}
          </div>

          <div className="border-t border-gray-800 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">CA</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                  value={ac}
                  onChange={(e) => setAc(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">CA desc.</label>
                <input
                  className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                  value={acDesc}
                  onChange={(e) => setAcDesc(e.target.value)}
                  placeholder="armure naturelle"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">PV</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                  value={hp}
                  onChange={(e) => setHp(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Formule PV</label>
                <input
                  className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                  value={hpFormula}
                  onChange={(e) => setHpFormula(e.target.value)}
                  placeholder="Ex: 3d8+6"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Vitesse</label>
            <input
              className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
              value={speedText}
              onChange={(e) => setSpeedText(e.target.value)}
              placeholder="9 m, vol 18 m"
            />
          </div>

          <div className="border-t border-gray-800 pt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Caracteristiques</label>
            <div className="grid grid-cols-6 gap-2">
              {abilityFields.map(({ key, label }) => (
                <div key={key} className="text-center">
                  <div className="text-xs text-amber-400 font-bold mb-1">{label}</div>
                  <input
                    type="number"
                    className="w-full px-1 py-2 bg-black/40 border border-gray-700 rounded text-center text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                    value={abilities[key]}
                    onChange={(e) => updateAbility(key, parseInt(e.target.value) || 0)}
                  />
                  <div className="text-xs text-gray-500 mt-0.5">{mod(abilities[key])}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Jets de sauvegarde</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={savingThrows}
                onChange={(e) => setSavingThrows(e.target.value)}
                placeholder="Con +5, Sag +3"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Competences</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Perception +5"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Vulnerabilites</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={vulns}
                onChange={(e) => setVulns(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Resistances</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={resistances}
                onChange={(e) => setResistances(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Immun. degats</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={dmgImmunities}
                onChange={(e) => setDmgImmunities(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Immun. etats</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={condImmunities}
                onChange={(e) => setCondImmunities(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Sens</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={senses}
                onChange={(e) => setSenses(e.target.value)}
                placeholder="vision dans le noir 36 m"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Langues</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                placeholder="commun, gobelin"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">FP</label>
              <input
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={cr}
                onChange={(e) => setCr(e.target.value)}
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">XP</label>
              <input
                type="number"
                className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
                value={xp}
                onChange={(e) => setXp(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4 space-y-4">
            <DynamicEntryList label="Traits" entries={traits} onChange={setTraits} />
            <DynamicEntryList label="Actions" entries={actions} onChange={setActions} />
            <DynamicEntryList label="Actions bonus" entries={bonusActions} onChange={setBonusActions} />
            <DynamicEntryList label="Reactions" entries={reactions} onChange={setReactions} />
            <div>
              <DynamicEntryList label="Actions legendaires" entries={legendaryActions} onChange={setLegendaryActions} />
              {legendaryActions.length > 0 && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-400 mb-1">Description legendaire</label>
                  <textarea
                    className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none resize-none"
                    rows={2}
                    value={legendaryDesc}
                    onChange={(e) => setLegendaryDesc(e.target.value)}
                    placeholder="Le monstre peut effectuer 3 actions legendaires..."
                  />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-900/40 border border-red-700/60 rounded-lg text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Sauvegarde...' : 'Creer et ajouter a la bibliotheque'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
