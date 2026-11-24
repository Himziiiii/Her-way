// src/context/AuthContext.jsx
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from './useAuth';

const DEFAULT_SAFETY_PREFS = {
  prioritize_lighting: true,
  avoid_deserted: true,
  night_mode_strict: true,
  checkin_interval_mins: 15,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(supabase));

  const loadUserProfile = useCallback(async (authUser) => {
    if (!supabase || !authUser) {
      setProfile(null);
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, emergency_contacts, safety_preferences')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error.message);
      return null;
    }

    if (data) {
      const normalized = {
        ...data,
        emergency_contacts: Array.isArray(data.emergency_contacts) ? data.emergency_contacts : [],
        safety_preferences: {
          ...DEFAULT_SAFETY_PREFS,
          ...(data.safety_preferences || {}),
        },
      };
      setProfile(normalized);
      return normalized;
    }

    const fallbackName =
      authUser.user_metadata?.display_name ||
      (authUser.email ? authUser.email.split('@')[0] : 'HerWay Traveler');

    const { data: created } = await supabase
      .from('profiles')
      .upsert({
        id: authUser.id,
        display_name: fallbackName,
        emergency_contacts: [],
        safety_preferences: DEFAULT_SAFETY_PREFS,
      })
      .select('id, display_name, emergency_contacts, safety_preferences')
      .single();

    if (created) {
      setProfile(created);
      return created;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await loadUserProfile(currentUser);
      }
      if (mounted) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        await loadUserProfile(nextUser);
      } else {
        setProfile(null);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  async function signInWithEmail(email, password) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function signUpWithEmail({ email, password, displayName }) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: (displayName || '').trim() || email.split('@')[0],
        },
      },
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function updateSafetyProfile({ displayName, emergencyContacts, safetyPreferences }) {
    if (!supabase || !user) {
      throw new Error('Sign in to save your safety preferences.');
    }

    const payload = {
      id: user.id,
      display_name:
        typeof displayName === 'string' ? displayName.trim() : profile?.display_name || '',
      emergency_contacts: Array.isArray(emergencyContacts)
        ? emergencyContacts
        : profile?.emergency_contacts || [],
      safety_preferences: {
        ...DEFAULT_SAFETY_PREFS,
        ...(profile?.safety_preferences || {}),
        ...(safetyPreferences || {}),
      },
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload)
      .select('id, display_name, emergency_contacts, safety_preferences')
      .single();

    if (error) {
      throw new Error(error.message || 'Could not update profile.');
    }

    setProfile(data);
    return data;
  }

  const value = {
    user,
    profile,
    loading,
    safetyPreferences: profile?.safety_preferences || DEFAULT_SAFETY_PREFS,
    emergencyContacts: profile?.emergency_contacts || [],
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateSafetyProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}