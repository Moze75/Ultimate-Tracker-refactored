import { supabase } from '../lib/supabase';

export const welcomeEmailService = {
  async sendWelcomeEmail(userId: string, email: string): Promise<boolean> {
    try {
      console.log('🚀 [welcomeEmailService] Vérification pour', email);

      // Vérifier si l'email a déjà été envoyé
      const { data: existing, error:  checkError } = await supabase
        .from('welcome_emails_sent')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      // Ignorer l'erreur PGRST116 (aucune ligne trouvée)
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('⚠️ [welcomeEmailService] Erreur vérification:', checkError);
      }

      if (existing) {
        console.log('⏭️ [welcomeEmailService] Email déjà envoyé pour', email);
        return false;
      }

      console.log('📧 [welcomeEmailService] Envoi email à', email);

      // Appeler l'Edge Function
      const supabaseUrl = import.meta. env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization':  `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [welcomeEmailService] Réponse:', result);

      // Marquer comme envoyé
      await supabase
        .from('welcome_emails_sent')
        .insert({ user_id: userId, email });

      console.log('✅ [welcomeEmailService] Email envoyé et tracké pour', email);
      return true;

    } catch (error) {
      console.error('❌ [welcomeEmailService] Erreur:', error);
      return false;
    }
  }
};