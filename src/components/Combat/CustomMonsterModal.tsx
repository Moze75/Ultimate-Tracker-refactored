import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2 } from 'lucide-react';
import { Monster, MonsterAbilities, MonsterEntry } from '../../types/campaign';

interface CustomMonsterModalProps {
  onClose: () => void;
  onSave: (monster: Monster) => void;
  editMonster?: Monster | null;
}

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

export function CustomMonsterModal({ onClose, onSave, editMonster }: CustomMonsterModalProps) {
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

  useEffect(() => {
    if (editMonster) {
      setName(editMonster.name);
      setType(editMonster.type);
      setSize(editMonster.size);
      setAlignment(editMonster.alignment);
      setAc(editMonster.armor_class);
      setAcDesc(editMonster.armor_desc);
      setHp(editMonster.hit_points);
      setHpFormula(editMonster.hit_points_formula);
      const spd = Object.entries(editMonster.speed || {})
        .map(([k, v]) => (k === 'marche' ? v : `${k} ${v}`))
        .join(', ');
      setSpeedText(spd);
      setAbilities(editMonster.abilities);
      setSavingThrows(editMonster.saving_throws);
      setSkills(editMonster.skills);
      setVulns(editMonster.vulnerabilities);
      setResistances(editMonster.resistances);
      setDmgImmunities(editMonster.damage_immunities);
      setCondImmunities(editMonster.condition_immunities);
      setSenses(editMonster.senses);
      setLanguages(editMonster.languages);
      setCr(editMonster.challenge_rating);
      setXp(editMonster.xp);
      setTraits(editMonster.traits || []);
      setActions(editMonster.actions?.length ? editMonster.actions : [{ name: '', description: '' }]);
      setBonusActions(editMonster.bonus_actions || []);
      setReactions(editMonster.reactions || []);
      setLegendaryActions(editMonster.legendary_actions || []);
      setLegendaryDesc(editMonster.legendary_description || '');
    }
  }, [editMonster]);

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

  const handleSave = () => {
    if (!name.trim()) return;

    const monster: Monster = {
      ...(editMonster?.id ? { id: editMonster.id, campaign_id: editMonster.campaign_id } : {}),
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
    };

    onSave(monster);
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
          <h3 className="text-lg font-semibold text-white">
            {editMonster ? 'Modifier le monstre' : 'Monstre personnalise'}
          </h3>
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
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editMonster ? 'Sauvegarder' : 'Creer'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
