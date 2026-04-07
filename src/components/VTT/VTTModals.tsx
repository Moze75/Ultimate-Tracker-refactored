import React from 'react';
import { AddTokenModal } from './AddTokenModal';
import { VTTTokenEditModal } from './VTTTokenEditModal';
import { VTTContextMenu } from './VTTContextMenu';
import { VTTTokenBindingModal } from './VTTTokenBindingModal';
import { VTTVisionConfigModal } from './VTTVisionConfigModal';
import { VTTSceneConfigModal } from './VTTSceneConfigModal';
import { VTTCharacterSheetPanel } from './VTTCharacterSheetPanel';
import { VTTMonsterStatBlockPanel } from './VTTMonsterStatBlockPanel';
import { DiceBox3D } from '../DiceBox3D';
import { vttService } from '../../services/vttService';
import type { DiceRollResult } from '../DiceBox3D';
import type {
  VTTToken,
  VTTRoomConfig,
  VTTConnectedUser,
  VTTRole,
} from '../../types/vtt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SceneContextMenu {
  sceneId: string;
  sceneName: string;
  config: VTTRoomConfig;
  x: number;
  y: number;
}

interface SceneConfigEdit {
  sceneId: string;
  config: VTTRoomConfig;
}

interface ContextMenu {
  token: VTTToken;
  x: number;
  y: number;
}

interface DiceRollData {
  type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
  attackName: string;
  diceFormula: string;
  modifier: number;
}

export interface VTTModalsProps {
  // Rôle et identité
  role: VTTRole;
  userId: string;

  // Refs
  tokensRef: React.MutableRefObject<VTTToken[]>;

  // State modales tokens
  showAddToken: boolean;
  onCloseAddToken: () => void;
  onConfirmAddToken: (token: Omit<VTTToken, 'id'>) => void;

  editingToken: VTTToken | null;
  onCloseEditToken: () => void;
  onSaveEditToken: (changes: Partial<VTTToken>) => void;
  onRemoveEditToken: (id: string) => void;

  contextMenu: ContextMenu | null;
  onCloseContextMenu: () => void;
  selectedTokenIds: string[];
  onEditFromContext: (token: VTTToken) => void;
  onDeleteFromContext: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleTorch: (token: VTTToken) => void;
  onManageBinding: (token: VTTToken) => void;
  onConfigureVision: (token: VTTToken) => void;
  onLaunchCombat: (tokens: VTTToken[]) => void;
  onToggleTarget: (token: VTTToken) => void;

  bindingToken: VTTToken | null;
  connectedUsers: VTTConnectedUser[];
  onCloseBinding: () => void;
  onSaveBinding: (controlledByUserIds: string[]) => void;

  visionToken: VTTToken | null;
  onCloseVision: () => void;
  onSaveVision: (changes: Partial<VTTToken>) => void;

  // State modales scènes
  sceneContextMenu: SceneContextMenu | null;
  onCloseSceneContextMenu: () => void;
  scenes: { id: string; name: string }[];
  onDeleteScene: (id: string) => void;
  onOpenSceneConfig: (edit: SceneConfigEdit) => void;

  sceneConfigEdit: SceneConfigEdit | null;
  onCloseSceneConfig: () => void;
  onSaveSceneConfig: (sceneId: string, changes: Partial<VTTRoomConfig>) => void;
  onResetImageSize?: (sceneId: string) => void;

  // State modales personnages
  characterSheetToken: VTTToken | null;
  onCloseCharacterSheet: () => void;
  onSyncTokenHpFromCharacter: (tokenId: string, hp: number | null, maxHp: number | null) => void;
  characterSheetForcedHp?: number | null;

  monsterStatBlockToken: VTTToken | null;
  onCloseMonsterStatBlock: () => void;

  // Dés
  diceRollData: DiceRollData | null;
  onCloseDiceRoll: () => void;
  onDiceRollResult: (result: DiceRollResult) => void;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function VTTModals({
  role,
  userId,
  tokensRef,

  showAddToken,
  onCloseAddToken,
  onConfirmAddToken,

  editingToken,
  onCloseEditToken,
  onSaveEditToken,
  onRemoveEditToken,

  contextMenu,
  onCloseContextMenu,
  selectedTokenIds,
  onEditFromContext,
  onDeleteFromContext,
  onToggleVisibility,
  onToggleTorch,
  onManageBinding,
  onConfigureVision,
  onLaunchCombat,
  onToggleTarget,

  bindingToken,
  connectedUsers,
  onCloseBinding,
  onSaveBinding,

  visionToken,
  onCloseVision,
  onSaveVision,

  sceneContextMenu,
  onCloseSceneContextMenu,
  scenes,
  onDeleteScene,
  onOpenSceneConfig,

  sceneConfigEdit,
  onCloseSceneConfig,
  onSaveSceneConfig,
  onResetImageSize,

  characterSheetToken,
  onCloseCharacterSheet,
  onSyncTokenHpFromCharacter,
  characterSheetForcedHp,

  monsterStatBlockToken,
  onCloseMonsterStatBlock,

  diceRollData,
  onCloseDiceRoll,
  onDiceRollResult,
}: VTTModalsProps) {
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Ajout de token                                                       */}
      {/* ------------------------------------------------------------------ */}
      {showAddToken && (
        <AddTokenModal
          userId={userId}
          onConfirm={onConfirmAddToken}
          onClose={onCloseAddToken}
          onCharDragStart={onCloseAddToken}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Édition de token                                                     */}
      {/* ------------------------------------------------------------------ */}
      {editingToken && (
        <VTTTokenEditModal
          token={editingToken}
          role={role}
          onSave={onSaveEditToken}
          onRemove={() => onRemoveEditToken(editingToken.id)}
          onClose={onCloseEditToken}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Menu contextuel token (clic droit)                                  */}
      {/* ------------------------------------------------------------------ */}
      {contextMenu && (
        <VTTContextMenu
          token={contextMenu.token}
          x={contextMenu.x}
          y={contextMenu.y}
          role={role}
          userId={userId}
          selectedTokens={(() => {
            const sel = selectedTokenIds.length > 0
              ? tokensRef.current.filter(t => selectedTokenIds.includes(t.id))
              : [];
            const token = tokensRef.current.find(t => t.id === contextMenu.token.id) || contextMenu.token;
            const hasToken = sel.some(t => t.id === token.id);
            return sel.length > 0 ? (hasToken ? sel : [token, ...sel]) : [token];
          })()}
          onEdit={() => { onEditFromContext(contextMenu.token); onCloseContextMenu(); }}
          onDelete={() => { onDeleteFromContext(contextMenu.token.id); onCloseContextMenu(); }}
          onToggleVisibility={() => { onToggleVisibility(contextMenu.token.id); onCloseContextMenu(); }}
          onToggleTorch={() => { onToggleTorch(contextMenu.token); onCloseContextMenu(); }}
          onManageBinding={() => { onManageBinding(contextMenu.token); onCloseContextMenu(); }}
          onConfigureVision={() => { onConfigureVision(contextMenu.token); onCloseContextMenu(); }}
          onLaunchCombat={(tokens) => { onLaunchCombat(tokens); onCloseContextMenu(); }}
          onToggleTarget={() => { onToggleTarget(contextMenu.token); onCloseContextMenu(); }}
          onClose={onCloseContextMenu}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Liaison token ↔ joueur                                              */}
      {/* ------------------------------------------------------------------ */}
      {bindingToken && (
        <VTTTokenBindingModal
          token={bindingToken}
          connectedUsers={connectedUsers}
          onSave={onSaveBinding}
          onClose={onCloseBinding}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Configuration de la vision du token                                 */}
      {/* ------------------------------------------------------------------ */}
      {visionToken && (
        <VTTVisionConfigModal
          token={visionToken}
          onSave={onSaveVision}
          onClose={onCloseVision}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Menu contextuel scène (clic droit sur onglet scène)                 */}
      {/* ------------------------------------------------------------------ */}
      {sceneContextMenu && (
        <div
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ top: sceneContextMenu.y, left: sceneContextMenu.x }}
          onMouseLeave={onCloseSceneContextMenu}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700"
            onClick={onCloseSceneContextMenu}
          >
            ✏️ Renommer (double-clic)
          </button>
          {scenes.length > 1 && (
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700"
              onClick={() => {
                if (window.confirm(`Supprimer "${sceneContextMenu.sceneName}" ?`)) {
                  onDeleteScene(sceneContextMenu.sceneId);
                }
                onCloseSceneContextMenu();
              }}
            >
              🗑️ Supprimer
            </button>
          )}
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700"
            onClick={() => {
              onOpenSceneConfig({ sceneId: sceneContextMenu.sceneId, config: sceneContextMenu.config });
              onCloseSceneContextMenu();
            }}
          >
            ⚙️ Configurer la scène
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Configuration de la scène                                           */}
      {/* ------------------------------------------------------------------ */}
      {sceneConfigEdit && (
        <VTTSceneConfigModal
          sceneName={scenes.find(s => s.id === sceneConfigEdit.sceneId)?.name ?? ''}
          config={sceneConfigEdit.config}
          onSave={changes => onSaveSceneConfig(sceneConfigEdit.sceneId, changes)}
          onClose={onCloseSceneConfig}
          onResetImageSize={onResetImageSize ? () => onResetImageSize(sceneConfigEdit.sceneId) : undefined}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Fiche de personnage                                                  */}
      {/* ------------------------------------------------------------------ */}
      {characterSheetToken && (
        <VTTCharacterSheetPanel
          token={characterSheetToken}
          role={role}
          userId={userId}
          onClose={onCloseCharacterSheet}
          onSyncTokenHp={onSyncTokenHpFromCharacter}
          forcedHp={characterSheetForcedHp}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Bloc de stats monstre                                                */}
      {/* ------------------------------------------------------------------ */}
      {monsterStatBlockToken && (
        <VTTMonsterStatBlockPanel
          token={monsterStatBlockToken}
          onClose={onCloseMonsterStatBlock}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Boîte à dés 3D                                                       */}
      {/* ------------------------------------------------------------------ */}
      <DiceBox3D
        isOpen={!!diceRollData}
        onClose={onCloseDiceRoll}
        rollData={diceRollData}
        onRollResult={onDiceRollResult}
      />
    </>
  );
}
