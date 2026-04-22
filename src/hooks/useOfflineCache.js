import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const CACHE_KEYS = {
  MEDICINAS: 'medtrack_medicinas',
  LOTES: 'medtrack_lotes',
  PENDING_SYNC: 'medtrack_pending_sync',
  LAST_SYNC: 'medtrack_last_sync',
};

export const useOfflineCache = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // ── Monitor network status ──────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPending();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Count pending on mount
  useEffect(() => {
    const pending = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_SYNC) || '[]');
    setPendingCount(pending.length);
  }, []);

  // ── Save to cache ───────────────────────────────────────
  const saveToCache = useCallback((key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(CACHE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (e) {
      console.warn('LocalStorage write failed:', e);
    }
  }, []);

  const getFromCache = useCallback((key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // ── Fetch medicinas (online → cache, offline → cache) ──
  const fetchMedicinas = useCallback(async () => {
    if (isOnline && supabase) {
      try {
        const { data, error } = await supabase
          .from('medicinas')
          .select('*, categorias(nombre)')
          .order('nombre');
        if (!error && data) {
          saveToCache(CACHE_KEYS.MEDICINAS, data);
          return data;
        }
      } catch { /* fallthrough to cache */ }
    }
    return getFromCache(CACHE_KEYS.MEDICINAS) || [];
  }, [isOnline, saveToCache, getFromCache]);

  // ── Fetch lotes (online → cache, offline → cache) ──────
  const fetchLotes = useCallback(async (productoId = null) => {
    if (isOnline && supabase) {
      try {
        let query = supabase
          .from('lotes')
          .select('*, medicinas(nombre)')
          .order('fecha_vencimiento', { ascending: true });
        if (productoId) query = query.eq('producto_id', productoId);

        const { data, error } = await query;
        if (!error && data) {
          const key = productoId ? `${CACHE_KEYS.LOTES}_${productoId}` : CACHE_KEYS.LOTES;
          saveToCache(key, data);
          return data;
        }
      } catch { /* fallthrough */ }
    }
    const key = productoId ? `${CACHE_KEYS.LOTES}_${productoId}` : CACHE_KEYS.LOTES;
    return getFromCache(key) || [];
  }, [isOnline, saveToCache, getFromCache]);

  // ── Queue offline action ────────────────────────────────
  const queueOfflineAction = useCallback((action) => {
    const pending = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_SYNC) || '[]');
    pending.push({ ...action, timestamp: new Date().toISOString() });
    localStorage.setItem(CACHE_KEYS.PENDING_SYNC, JSON.stringify(pending));
    setPendingCount(pending.length);
  }, []);

  // ── Sync pending actions when back online ───────────────
  const syncPending = useCallback(async () => {
    if (!supabase) return;
    const pending = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_SYNC) || '[]');
    if (pending.length === 0) return;

    setIsSyncing(true);
    const failed = [];

    for (const action of pending) {
      try {
        if (action.type === 'INSERT_LOTE') {
          await supabase.from('lotes').insert(action.data);
        } else if (action.type === 'MERMA') {
          await supabase.from('lotes')
            .update({ cantidad_actual: action.data.nueva_cantidad })
            .eq('id', action.data.lote_id);
        }
      } catch {
        failed.push(action);
      }
    }

    localStorage.setItem(CACHE_KEYS.PENDING_SYNC, JSON.stringify(failed));
    setPendingCount(failed.length);
    setIsSyncing(false);
  }, []);

  const lastSync = localStorage.getItem(CACHE_KEYS.LAST_SYNC);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    fetchMedicinas,
    fetchLotes,
    queueOfflineAction,
    syncPending,
    lastSync,
  };
};
