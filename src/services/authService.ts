import { supabase } from '../lib/supabase';

export const authService = {
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async signUp(email: string, password: string) {
    const result = await supabase.auth. signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://le-compagnon-dnd.fr'
      }
    });

    // Envoyer l'email de bienvenue si l'inscription réussit
    if (result. data. user && ! result.error) {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`
          },
          body: JSON.stringify({ email:  result.data.user.email })
        });

        console.log('[authService] Email de bienvenue envoyé à', email);
      } catch (emailError) {
        console.error('[authService] Erreur envoi email bienvenue:', emailError);
        // Ne pas bloquer l'inscription si l'email échoue
      }
    }

    return result;
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