// ===================================
// VTTChatPanel — Chat live VTT
// ===================================
// Panneau de chat en temps réel partagé entre tous les participants d'une salle.
// Deux types de cartes :
//   - kind='text'  : message libre tapé dans le champ en bas
//   - kind='roll'  : jet de dés auto-publié depuis DiceBox3D
//
// Transport : Supabase Realtime broadcast (event 'vtt-chat')
// Pas de persistance DB — 20 messages max en mémoire, effacés à la déconnexion.
// L'avatar du joueur est résolu à l'envoi et embarqué dans le message.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Dices } from 'lucide-react';
import { vttService } from '../../services/vttService';
import type { VTTChatMessage } from '../../types/vtt';
import type { VTTToken } from '../../types/vtt';

// -------------------
// Constantes
// -------------------
const MAX_MESSAGES = 20;

// -------------------
// Props du panel
// -------------------
interface VTTChatPanelProps {
  roomId: string;
  userId: string;
  userName: string;
  role: 'gm' | 'player';
  tokens: VTTToken[];
  // Message de jet de dés injecté depuis VTTPage après chaque lancer DiceBox3D
  externalMessage?: VTTChatMessage | null;
  // Appelé après consommation du externalMessage (pour le remettre à null)
  onConsumed?: () => void;
  // Remonte le nombre de messages non lus (pour badge sur l'onglet)
  onUnreadChange?: (count: number) => void;
  // Si l'onglet chat est actif (pour reset les non-lus)
  isActive: boolean;
  // Appelé quand un jet de dégats (damage) vient d'être publié par cet utilisateur
  onDamageRoll?: (total: number) => void;
}

// ===================================
// Sous-composant : avatar token
// ===================================
// Affiche l'image du token si disponible, sinon les 2 premières lettres
// du label sur fond coloré.
function TokenAvatar({
  imageUrl,
  label,
  color,
  size = 32,
}: {
  imageUrl?: string | null;
  label: string;
  color?: string;
  size?: number;
}) {
  return (
    <div
      className="rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: imageUrl ? 'transparent' : (color || '#6b7280'),
        fontSize: size * 0.35,
        border: '2px solid rgba(255,255,255,0.15)',
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={label}
          draggable={false}
          className="w-full h-full object-cover"
        />
      ) : (
        label.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

// ===================================
// Sous-composant : carte de message texte
// ===================================
function ChatTextCard({ msg, isSelf }: { msg: VTTChatMessage; isSelf: boolean }) {
  // -------------------
  // Formatage du timestamp relatif
  // -------------------
  const timeLabel = formatRelativeTime(msg.timestamp);

  return (
    <div className={`flex gap-2 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
      <TokenAvatar
        imageUrl={msg.tokenImageUrl}
        label={msg.tokenLabel || msg.userName}
        color={msg.tokenColor}
        size={34}
      />
      <div className={`flex-1 min-w-0 ${isSelf ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* En-tête : nom + rôle + timestamp */}
        <div className={`flex items-center gap-1.5 mb-0.5 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[11px] font-semibold text-gray-200 truncate max-w-[100px]">
            {msg.tokenLabel || msg.userName}
          </span>
          {msg.role === 'gm' && (
            <span className="text-[9px] text-amber-400 uppercase tracking-wide shrink-0">MJ</span>
          )}
          <span className="text-[9px] text-gray-500 shrink-0">{timeLabel}</span>
        </div>
        {/* Corps du message */}
        <div
          className={`px-2.5 py-1.5 rounded-lg text-xs text-gray-100 max-w-full break-words ${
            isSelf
              ? 'bg-amber-600/30 border border-amber-500/30 rounded-tr-sm'
              : 'bg-gray-700/60 border border-gray-600/40 rounded-tl-sm'
          }`}
        >
          {msg.text}
        </div>
      </div>
    </div>
  );
} 

// ===================================
// Sous-composant : carte de jet de dés
// ===================================
// Inspirée de l'affichage DiceBox3D : formule + détail + résultat total.
function ChatRollCard({ msg }: { msg: VTTChatMessage }) {
  const timeLabel = formatRelativeTime(msg.timestamp);
  const isCritSuccess = msg.rolls?.length === 1 && msg.diceFormula === '1d20' && msg.rolls[0] === 20;
  const isCritFail = msg.rolls?.length === 1 && msg.diceFormula === '1d20' && msg.rolls[0] === 1;

  return (
    <div className="flex gap-2">
      {/* Avatar */}
      <TokenAvatar
        imageUrl={msg.tokenImageUrl}
        label={msg.tokenLabel || msg.userName}
        color={msg.tokenColor}
        size={34}
      />

      {/* Carte roll */}
      <div className="flex-1 min-w-0 bg-gray-800/70 border border-gray-600/50 rounded-lg overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-semibold text-gray-200 truncate max-w-[90px]">
              {msg.tokenLabel || msg.userName}
            </span>
            {msg.role === 'gm' && (
              <span className="text-[9px] text-amber-400 uppercase tracking-wide shrink-0">MJ</span>
            )}
          </div>
          <span className="text-[9px] text-gray-500 shrink-0 ml-1">{timeLabel}</span>
        </div>

        {/* Nom du jet (attackName) en italique */}
        {msg.attackName && (
          <div className="px-2.5 pb-1">
            <span className="text-[10px] text-gray-400 italic">{msg.attackName}</span>
          </div>
        )}

        {/* Formule */}
        <div className="mx-2.5 mb-1 px-2 py-1 bg-gray-700/60 border border-gray-600/40 rounded text-center">
          <span className="text-[11px] text-gray-300 font-mono">
            {msg.diceFormula}
            {msg.modifier !== undefined && msg.modifier !== 0
              ? (msg.modifier > 0 ? ` + ${msg.modifier}` : ` − ${Math.abs(msg.modifier)}`)
              : ''}
          </span>
        </div>

        {/* Détail des dés */}
        {msg.rolls && msg.rolls.length > 0 && (
          <div className="mx-2.5 mb-1 text-center">
            <span className="text-[9px] text-gray-500">
              [{msg.rolls.join(' • ')}]{msg.diceTotal !== undefined ? ` = ${msg.diceTotal}` : ''}
              {msg.modifier !== undefined && msg.modifier !== 0
                ? (msg.modifier > 0 ? ` + ${msg.modifier}` : ` − ${Math.abs(msg.modifier)}`)
                : ''}
            </span>
          </div>
        )}

        {/* Total — ligne principale */}
        <div className="mx-2.5 mb-2 px-2 py-1.5 bg-gray-900/60 border border-gray-600/30 rounded flex items-center justify-between">
          <span
            className={`text-lg font-black tracking-tight ${
              isCritSuccess
                ? 'text-yellow-400'
                : isCritFail
                ? 'text-red-500'
                : 'text-white'
            }`}
          >
            {msg.total}
          </span>
          {/* Badge critique */}
          {isCritSuccess && (
            <span className="text-[9px] text-yellow-400 font-bold uppercase tracking-wide">
              ✨ Critique
            </span>
          )}
          {isCritFail && (
            <span className="text-[9px] text-red-500 font-bold uppercase tracking-wide">
              ⚠️ Échec
            </span>
          )}
          {/* Icône dé décorative */}
          {!isCritSuccess && !isCritFail && (
            <Dices size={12} className="text-gray-500" />
          )}
        </div>
      </div>
    </div>
  );
}

// ===================================
// Utilitaire : temps relatif
// ===================================
// Affiche "à l'instant", "2m", "1h" selon l'écart avec Date.now()
function formatRelativeTime(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp);
  if (diff < 60_000) return 'à l\'instant';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  return `${Math.floor(diff / 3_600_000)}h`;
}

// ===================================
// Composant principal : VTTChatPanel
// ===================================
export function VTTChatPanel({
  userId,
  userName,
  role,
  tokens,
  externalMessage,
  onConsumed,
  onUnreadChange,
  isActive,
  onDamageRoll,
}: VTTChatPanelProps) {
  // -------------------
  // État local des messages (max 20)
  // -------------------
  const [messages, setMessages] = useState<VTTChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const listEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Ref pour suivre les IDs de messages déjà traités (anti-doublon)
  const processedIdsRef = useRef<Set<string>>(new Set());

  // -------------------
  // Résolution de l'avatar du joueur courant
  // -------------------
  // Cherche le token contrôlé par l'userId pour en extraire image/couleur/label
  const resolveMyAvatar = useCallback(() => {
    if (role === 'gm') {
      return { tokenLabel: 'MJ', tokenImageUrl: null, tokenColor: '#f59e0b' };
    }
    const myToken = tokens.find(t => t.controlledByUserIds?.includes(userId));
    return {
      tokenLabel: myToken?.label ?? userName,
      tokenImageUrl: myToken?.imageUrl ?? null,
      tokenColor: myToken?.color ?? '#6b7280',
    };
  }, [role, tokens, userId, userName]);

  // -------------------
  // Ajout d'un message dans le state local
  // Applique la limite MAX_MESSAGES (les plus anciens sont supprimés)
  // -------------------
  const appendMessage = useCallback((msg: VTTChatMessage) => {
    if (processedIdsRef.current.has(msg.id)) return;
    processedIdsRef.current.add(msg.id);

    setMessages(prev => {
      const next = [...prev, msg];
      // Limite à MAX_MESSAGES — suppression des plus anciens
      return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
    });

    // -------------------
    // Incrémentation des non-lus si l'onglet n'est pas actif
    // -------------------
    if (!isActive && msg.userId !== userId) {
      setUnreadCount(c => {
        const next = c + 1;
        onUnreadChange?.(next);
        return next;
      });
    }
  }, [isActive, userId, onUnreadChange]);

  // -------------------
  // Abonnement au service vttService pour les messages entrants
  // -------------------
  useEffect(() => {
    const unsub = vttService.onChat(appendMessage);
    return unsub;
  }, [appendMessage]);

  // -------------------
  // Consommation du externalMessage (jet de dés depuis DiceBox3D)
  // -------------------
  // À chaque nouveau externalMessage (différent de null et non encore traité),
  // on le publie via vttService.sendChat() ET on l'ajoute localement.
  useEffect(() => {
    if (!externalMessage) return;
    if (processedIdsRef.current.has(externalMessage.id)) {
      onConsumed?.();
      return;
    }
    // Envoi au canal Realtime (les autres clients le recevront via onChat)
    vttService.sendChat(externalMessage);
    // Ajout local immédiat (l'expéditeur ne reçoit pas son propre broadcast)
    appendMessage(externalMessage);

    if (
      externalMessage.kind === 'roll' &&
      externalMessage.rollType === 'damage' &&
      typeof externalMessage.total === 'number'
    ) {
      onDamageRoll?.(externalMessage.total);
    }

    onConsumed?.();
  }, [externalMessage, appendMessage, onConsumed, onDamageRoll]);

  // -------------------
  // Reset des non-lus quand l'onglet devient actif
  // -------------------
  useEffect(() => {
    if (isActive && unreadCount > 0) {
      setUnreadCount(0);
      onUnreadChange?.(0);
    }
  }, [isActive, unreadCount, onUnreadChange]);

  // -------------------
  // Scroll automatique vers le bas à chaque nouveau message
  // -------------------
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // -------------------
  // Envoi d'un message texte libre
  // -------------------
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;

    const avatar = resolveMyAvatar();
    const msg: VTTChatMessage = {
      id: crypto.randomUUID(),
      userId,
      userName,
      role,
      timestamp: Date.now(),
      kind: 'text',
      text,
      ...avatar,
    };

    vttService.sendChat(msg);
    appendMessage(msg);
    setInputText('');
    inputRef.current?.focus();
  }, [inputText, userId, userName, role, resolveMyAvatar, appendMessage]);

  // -------------------
  // Envoi au clavier : Enter (sans Shift) = envoyer
  // -------------------
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ===================================
  // Rendu
  // ===================================
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* -------------------
          Fil de messages
          -------------------
          Liste scrollable des cartes (texte et jets de dés)
      */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40 py-8">
            <Dices size={28} className="text-gray-500" />
            <p className="text-xs text-gray-500 text-center">
              Aucun message.<br />Lancez vos dés ou écrivez ici !
            </p>
          </div>
        )}

        {messages.map(msg => {
          const isSelf = msg.userId === userId;
          return (
            <div key={msg.id}>
              {msg.kind === 'roll' ? (
                <ChatRollCard msg={msg} />
              ) : (
                <ChatTextCard msg={msg} isSelf={isSelf} />
              )}
            </div>
          );
        })}

        {/* Ancre de scroll automatique */}
        <div ref={listEndRef} />
      </div>

      {/* -------------------
          Champ de saisie + bouton d'envoi
          -------------------
          Enter = envoyer, Shift+Enter = saut de ligne
      */}
      <div className="shrink-0 border-t border-gray-700/60 p-2 flex gap-2 items-end bg-gray-900/40">
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message... (Entrée pour envoyer)"
          rows={2}
          className="flex-1 resize-none bg-gray-800/70 border border-gray-700/60 rounded px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-500 outline-none focus:ring-1 focus:ring-amber-500/60 leading-relaxed"
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim()}
          className="shrink-0 p-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
          title="Envoyer (Entrée)"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}