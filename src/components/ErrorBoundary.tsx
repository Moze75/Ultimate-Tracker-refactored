import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { authService } from '../services/authService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleEmergencyLogout = async () => {
    try {
      localStorage.removeItem('selectedCharacter');
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    } catch (error) {
      console.error('Emergency logout failed:', error);
      window.location.href = '/emergency-logout.html';
    }
  };

  handleFullCacheClear = async () => {
    try {
      await authService.clearCacheAndSignOut();
    } catch (error) {
      console.error('Cache clear failed:', error);
      window.location.href = '/clear-cache.html';
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg border border-red-500/30 shadow-xl max-w-2xl w-full p-6">
            <div className="text-center mb-6">
              <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">
                Une erreur est survenue
              </h1>
              <p className="text-sm text-gray-400">
                L'application a rencontré un problème inattendu
              </p>
            </div>

            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm font-mono text-red-300 break-words">
                {this.state.error?.message || 'Erreur inconnue'}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleEmergencyLogout}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors font-medium"
              >
                <RefreshCw size={20} />
                Déconnexion d'urgence et redémarrage
              </button>

              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
              >
                Recharger la page
              </button>

              <button
                onClick={this.handleFullCacheClear}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                Nettoyage complet du cache
              </button>
            </div>

            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-300">
                Détails techniques
              </summary>
              <div className="mt-3 p-4 bg-gray-900 rounded text-xs font-mono text-gray-400 overflow-auto max-h-64">
                <div className="mb-2">
                  <strong className="text-red-400">Message:</strong>
                  <div className="mt-1 text-gray-300">{this.state.error?.message}</div>
                </div>

                {this.state.error?.stack && (
                  <div className="mb-2">
                    <strong className="text-red-400">Stack:</strong>
                    <pre className="mt-1 text-gray-300 whitespace-pre-wrap break-words">
                      {this.state.error.stack}
                    </pre>
                  </div>
                )}

                {this.state.errorInfo?.componentStack && (
                  <div>
                    <strong className="text-red-400">Component Stack:</strong>
                    <pre className="mt-1 text-gray-300 whitespace-pre-wrap break-words">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>

            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-300 mb-2">
                💡 <strong>Si le problème persiste :</strong>
              </p>
              <ul className="text-xs text-blue-200 space-y-1 ml-4 list-disc">
                <li>Utilisez "Déconnexion d'urgence" pour désactiver la reconnexion automatique</li>
                <li>Videz complètement le cache avec "Nettoyage complet"</li>
                <li>Ou tapez directement : <code className="bg-blue-950 px-1 py-0.5 rounded">le-compagnon-dnd.fr/emergency-logout.html</code></li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
