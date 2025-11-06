import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';

export function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const BG_URL =
    (import.meta as any)?.env?.VITE_LOGIN_BG_URL ||
    'https://yumzqyyogwzrmlcpvnky.supabase.co/storage/v1/object/public/static/tmpoofee5sh.png';

  const bgStyle: React.CSSProperties = {
    backgroundImage: `url(${BG_URL})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    backgroundColor: 'transparent',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await authService.updatePassword(newPassword);
      
      if (error) throw error;

      toast.success('Mot de passe mis à jour avec succès !');
      setTimeout(() => navigate('/'), 2000);
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour du mot de passe');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={bgStyle}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-6" style={{
            textShadow: `
              0 0 15px rgba(255, 255, 255, 0.9),
              0 0 20px rgba(255, 255, 255, 0.6),
              0 0 30px rgba(255, 255, 255, 0.4),
              0 0 40px rgba(255, 255, 255, 0.2)
            `
          }}>
            Nouveau mot de passe
          </h1>
          <p className="text-gray-200" style={{
            textShadow: '0 0 10px rgba(255, 255, 255, 0.3)'
          }}>
            Choisissez un nouveau mot de passe pour votre compte
          </p>
        </div>

        <div className="stat-card">
          <div className="p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-dark w-full pl-10 pr-3 py-2 rounded-lg"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-dark w-full pl-10 pr-3 py-2 rounded-lg"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}