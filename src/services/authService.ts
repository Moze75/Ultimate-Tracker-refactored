import { supabase } from '../lib/supabase';

export const authService = {
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async signUp(email: string, password: string) {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://le-compagnon-dnd.fr'
      }
    });
  },

  async signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (!error && data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      return {
        data: null,
        error: {
          message: 'Veuillez confirmer votre adresse email avant de vous connecter. Vérifiez votre boîte de réception et le dossier spam.',
          name: 'EmailNotConfirmed'
        }
      };
    }
    
    return { data, error };
  },

  async signInWithGoogle() {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://le-compagnon-dnd.fr',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
  }, 

    // ✅ AJOUTEZ ICI - Demander la réinitialisation du mot de passe
  async resetPassword(email: string) {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://le-compagnon-dnd.fr'
    });
  },

  // ✅ AJOUTEZ ICI - Mettre à jour le mot de passe
  async updatePassword(newPassword: string) {
    return await supabase.auth.updateUser({
      password: newPassword
    });
  },

   

  async signOut() {
    return await supabase.auth.signOut();
  },

  onAuthStateChange(callback: (session: any) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  }
};