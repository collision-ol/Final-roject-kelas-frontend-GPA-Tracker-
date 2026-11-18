import { useState, useEffect, useRef, useCallback } from 'react';
import { cleanPlan, planFingerprint } from '../engine/gpaEngine';
import { ACTIVE_SESSION_KEY } from './useGradPathStore';

const SUPABASE_URL = 'https://sroorunyhpldcatfkfan.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a1GwbG53bOxtkXPGRULprQ_Ddr3VlUi';

function readActiveSession() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(ACTIVE_SESSION_KEY));
    if (raw?.accountContext?.userId && raw?.state) return raw;
  } catch {
    // Ignore malformed session storage.
  }
  return null;
}

function accountError(error) {
  if (['PGRST205', '42P01', '42501'].includes(error?.code)) {
    return 'Penyimpanan akun belum siap. Periksa tabel dan aturan akses Supabase.';
  }
  if (error?.status === 401) {
    return 'Sesi berakhir. Silakan masuk kembali.';
  }
  if (
    error?.message?.startsWith('Data kelas') ||
    error?.message?.startsWith('Rencana sudah')
  ) {
    return error.message;
  }
  return 'Belum berhasil. Periksa koneksi lalu coba lagi. Input Anda tetap tersedia.';
}

export function useAccount({
  state,
  setState,
  toast,
  persistGuest,
  clearPrivateDrafts,
  loadGuestState,
}) {
  const initialSessionRef = useRef(readActiveSession());
  const [cloudUser, setCloudUser] = useState(null);
  const [accountContext, setAccountContext] = useState(
    () => initialSessionRef.current?.accountContext || null
  );
  const [cloudLast, setCloudLast] = useState(
    () => initialSessionRef.current?.cloudLast || ''
  );
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountPlans, setAccountPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [accountErrorText, setAccountErrorText] = useState('');
  const [saveIntentFlag, setSaveIntentFlag] = useState(false);
  const [accountRevision, setAccountRevision] = useState(0);
  const [profileName, setProfileName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [needsProfileName, setNeedsProfileName] = useState(false);
  const [userRole, setUserRole] = useState('student');
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const cloudClientRef = useRef(null);
  const cloudGenerationRef = useRef(0);
  const cloudUserRef = useRef(null);
  const accountContextRef = useRef(null);
  const stateRef = useRef(state);
  const cloudLastRef = useRef(cloudLast);
  const authValidatingRef = useRef(false);

  stateRef.current = state;
  cloudLastRef.current = cloudLast;
  cloudUserRef.current = cloudUser;
  accountContextRef.current = accountContext;

  const applyContext = useCallback((ctx, last) => {
    setAccountContext(ctx);
    setCloudLast(last);
  }, []);

  const resetAccountView = useCallback(() => {
    try {
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {
      // Ignore storage errors.
    }
    setAccountContext(null);
    setCloudLast('');
    setState(loadGuestState());
  }, [loadGuestState, setState]);

  const handleSetCloudUser = useCallback(
    (user) => {
      if (cloudUserRef.current?.id !== user?.id) {
        cloudGenerationRef.current += 1;
        clearPrivateDrafts();
        setAccountRevision((r) => r + 1);
        if (!user) {
          setUserRole('student');
          setNotifications([]);
          setNotificationsOpen(false);
        }
        if (accountContextRef.current && accountContextRef.current.userId !== user?.id) {
          resetAccountView();
        }
      }
      cloudUserRef.current = user;
      setCloudUser(user);
    },
    [clearPrivateDrafts, resetAccountView]
  );

  const fetchPlans = useCallback(async (user) => {
    const client = cloudClientRef.current;
    if (!client || !user) return;
    const generation = cloudGenerationRef.current;
    setLoadingPlans(true);
    setAccountErrorText('');
    try {
      const { data, error } = await client
        .from('gradpath_plans')
        .select('id,name,revision,updated_at,data->>curriculum')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (generation !== cloudGenerationRef.current) return;
      setAccountPlans(data || []);
    } catch (e) {
      if (generation === cloudGenerationRef.current) {
        setAccountPlans([]);
        setAccountErrorText(accountError(e));
      }
    } finally {
      if (generation === cloudGenerationRef.current) {
        setLoadingPlans(false);
      }
    }
  }, []);

  const fetchNotifications = useCallback(async (user) => {
    const client = cloudClientRef.current;
    if (!client || !user) {
      setNotifications([]);
      return;
    }
    const generation = cloudGenerationRef.current;
    setLoadingNotifications(true);
    try {
      const { data, error } = await client
        .from('gradpath_feedback')
        .select('id,kaprodi_name,plan_id,plan_name,message,is_read,created_at')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (generation !== cloudGenerationRef.current) return;
      if (error) {
        if (['PGRST205', '42P01'].includes(error.code)) {
          setNotifications([]);
          return;
        }
        throw error;
      }
      setNotifications(data || []);
    } catch {
      if (generation === cloudGenerationRef.current) {
        setNotifications([]);
      }
    } finally {
      if (generation === cloudGenerationRef.current) {
        setLoadingNotifications(false);
      }
    }
  }, []);

  const openNotifications = useCallback(async () => {
    setNotificationsOpen(true);
    if (cloudUserRef.current) {
      await fetchNotifications(cloudUserRef.current);
    }
  }, [fetchNotifications]);

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false);
  }, []);

  const markNotificationRead = useCallback(async (id) => {
    const client = cloudClientRef.current;
    const user = cloudUserRef.current;
    if (!client || !user || !id) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await client
        .from('gradpath_feedback')
        .update({ is_read: true })
        .eq('id', id)
        .eq('student_id', user.id);
    } catch {
      // Ignore transient errors.
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const client = cloudClientRef.current;
    const user = cloudUserRef.current;
    if (!client || !user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await client
        .from('gradpath_feedback')
        .update({ is_read: true })
        .eq('student_id', user.id)
        .eq('is_read', false);
    } catch {
      // Ignore transient errors.
    }
  }, []);

  const loadProfile = useCallback(async (user) => {
    const client = cloudClientRef.current;
    if (!client || !user) {
      setProfileName('');
      setNeedsProfileName(false);
      setUserRole('student');
      setNotifications([]);
      return { fullName: '', needsName: false };
    }
    const generation = cloudGenerationRef.current;
    setLoadingProfile(true);
    try {
      const [profileRes, roleRes] = await Promise.all([
        client
          .from('gradpath_profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle(),
        client
          .from('gradpath_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      if (generation !== cloudGenerationRef.current) return null;

      fetchNotifications(user);

      const isKaprodi = !roleRes.error && roleRes.data?.role === 'kaprodi';
      setUserRole(isKaprodi ? 'kaprodi' : 'student');

      if (profileRes.error) {
        if (['PGRST205', '42P01'].includes(profileRes.error.code)) {
          const metaName = String(user.user_metadata?.gradpath_full_name || '').trim();
          setProfileName(metaName);
          setNeedsProfileName(!metaName);
          return { fullName: metaName, needsName: !metaName, role: isKaprodi ? 'kaprodi' : 'student' };
        }
        throw profileRes.error;
      }
      const savedName = String(
        profileRes.data?.full_name || (isKaprodi ? user.user_metadata?.gradpath_full_name : '') || ''
      ).trim();
      setProfileName(savedName);
      setNeedsProfileName(!savedName);
      return { fullName: savedName, needsName: !savedName, role: isKaprodi ? 'kaprodi' : 'student' };
    } catch {
      const metaName = String(user.user_metadata?.gradpath_full_name || '').trim();
      if (generation === cloudGenerationRef.current) {
        setProfileName(metaName);
        setNeedsProfileName(!metaName);
        setUserRole('student');
      }
      return { fullName: metaName, needsName: !metaName, role: 'student' };
    } finally {
      if (generation === cloudGenerationRef.current) {
        setLoadingProfile(false);
      }
    }
  }, [fetchNotifications]);

  const saveProfile = useCallback(
    async (rawName) => {
      const client = cloudClientRef.current;
      const user = cloudUserRef.current;
      if (cloudBusy || !user || !client) return;
      const trimmed = String(rawName || '').trim();
      if (trimmed.length < 2 || trimmed.length > 120) {
        setAccountErrorText('Masukkan nama lengkap (2–120 karakter).');
        return;
      }

      setCloudBusy(true);
      setAccountErrorText('');
      const generation = cloudGenerationRef.current;

      try {
        const { error: authError } = await client.auth.updateUser({
          data: { full_name: trimmed, gradpath_full_name: trimmed },
        });
        if (authError) throw authError;

        const { error: tableError } = await client
          .from('gradpath_profiles')
          .upsert(
            {
              user_id: user.id,
              full_name: trimmed,
              email: user.email || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (tableError && !['PGRST205', '42P01'].includes(tableError.code)) {
          throw tableError;
        }
        if (generation !== cloudGenerationRef.current) return;

        setProfileName(trimmed);
        setNeedsProfileName(false);
        toast('Nama lengkap tersimpan.');
      } catch (e) {
        if (generation === cloudGenerationRef.current) {
          setAccountErrorText(accountError(e));
        }
      } finally {
        setCloudBusy(false);
      }
    },
    [cloudBusy, toast]
  );

  const openAccount = useCallback(
    async (saveIntent = false) => {
      setSaveIntentFlag(Boolean(saveIntent));
      setAccountErrorText('');
      setAccountDialogOpen(true);
      if (!cloudReady) {
        setAccountErrorText('Layanan akun sedang dimuat. Coba lagi sebentar.');
        return;
      }
      if (!cloudUserRef.current) return;
      await Promise.all([loadProfile(cloudUserRef.current), fetchPlans(cloudUserRef.current)]);
    },
    [cloudReady, fetchPlans, loadProfile]
  );

  const openAccountWithReadyCheck = useCallback(
    async (readyFlag, user, saveIntent = false) => {
      setSaveIntentFlag(Boolean(saveIntent));
      setAccountErrorText('');
      setAccountDialogOpen(true);
      if (!readyFlag) {
        setAccountErrorText('Layanan akun sedang dimuat. Coba lagi sebentar.');
        return;
      }
      if (!user) return;
      await Promise.all([loadProfile(user), fetchPlans(user)]);
    },
    [fetchPlans, loadProfile]
  );

  const closeAccount = useCallback(() => {
    if (cloudBusy) return;
    setAccountDialogOpen(false);
  }, [cloudBusy]);

  const signIn = useCallback(async (selectedRole = 'student') => {
    const client = cloudClientRef.current;
    if (!client) {
      setAccountErrorText('Layanan login belum tersedia. Muat ulang halaman lalu coba lagi.');
      return;
    }
    if (window.location.protocol === 'file:') {
      setAccountErrorText('Buka website online untuk masuk dengan Google.');
      return;
    }
    try {
      const roleChoice = selectedRole === 'kaprodi' ? 'kaprodi' : 'student';
      persistGuest(stateRef.current, Boolean(accountContextRef.current));
      sessionStorage.setItem('gradpath-login-step', stateRef.current.step);
      sessionStorage.setItem('gradpath-login-role', roleChoice);
      setAccountErrorText('');
      setCloudBusy(true);
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/',
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error || !data?.url) throw error || Error('Login failed');
      window.location.assign(data.url);
    } catch (e) {
      setAccountErrorText(accountError(e));
      setCloudBusy(false);
    }
  }, [persistGuest]);

  const saveCloud = useCallback(
    async (asNew, planName) => {
      const client = cloudClientRef.current;
      const user = cloudUserRef.current;
      if (cloudBusy || !user || !client) return;
      const name = String(planName || '').trim();
      if (!name) {
        setAccountErrorText('Isi nama rencana terlebih dahulu.');
        return;
      }

      setCloudBusy(true);
      const uid = user.id;
      const generation = cloudGenerationRef.current;
      setAccountErrorText('Menyimpan…');

      try {
        const current = stateRef.current;
        const payload = cleanPlan(current);
        const fingerprint = planFingerprint(current);
        const ctx = accountContextRef.current;
        const query = asNew
          ? client
              .from('gradpath_plans')
              .insert({
                id: crypto.randomUUID(),
                user_id: uid,
                name,
                data: payload,
                schema_version: 1,
              })
          : client
              .from('gradpath_plans')
              .update({ name, data: payload })
              .eq('id', ctx.id)
              .eq('user_id', uid)
              .eq('revision', ctx.revision);

        const { data, error } = await query.select('id,name,revision').maybeSingle();
        if (error) throw error;
        if (!data) {
          throw Error(
            'Rencana sudah diperbarui di perangkat lain. Simpan sebagai rencana baru agar perubahan Anda tidak hilang.'
          );
        }
        if (generation !== cloudGenerationRef.current) return;
        setAccountContext({ ...data, userId: uid });
        setCloudLast(fingerprint);
        setAccountDialogOpen(false);
        setAccountErrorText('');
        toast('Rencana tersimpan di akun.');
      } catch (e) {
        if (generation === cloudGenerationRef.current) {
          setAccountErrorText(accountError(e));
        }
      } finally {
        setCloudBusy(false);
      }
    },
    [cloudBusy, toast]
  );

  const loadCloud = useCallback(
    async (id) => {
      const client = cloudClientRef.current;
      const user = cloudUserRef.current;
      if (cloudBusy || !user || !client) return;

      const current = stateRef.current;
      if (
        accountContextRef.current &&
        cloudLastRef.current !== planFingerprint(current) &&
        !window.confirm('Ada perubahan belum disimpan. Buka rencana lain dan abaikan perubahan tersebut?')
      ) {
        return;
      }

      setCloudBusy(true);
      const uid = user.id;
      const generation = cloudGenerationRef.current;
      try {
        const { data, error } = await client
          .from('gradpath_plans')
          .select('id,name,revision,data,schema_version')
          .eq('id', id)
          .eq('user_id', uid)
          .single();
        if (error) throw error;
        if (generation !== cloudGenerationRef.current) return;
        if (data.schema_version !== 1) throw Error('Unsupported plan version');

        const restored = cleanPlan(data.data);
        if (!accountContextRef.current) {
          persistGuest(current, false);
        }
        restored.step = restored.setupComplete
          ? restored.confirmed
            ? 'result'
            : 'grades'
          : 'english';

        setAccountContext({ id: data.id, name: data.name, revision: data.revision, userId: uid });
        setState(restored);
        setCloudLast(planFingerprint(restored));
        setAccountDialogOpen(false);
        window.history.pushState({ step: restored.step }, '', `#${restored.step}`);
        window.scrollTo(0, 0);
        toast('Rencana akun dibuka.');
      } catch (e) {
        setAccountErrorText(accountError(e));
      } finally {
        setCloudBusy(false);
      }
    },
    [cloudBusy, persistGuest, setState, toast]
  );

  const deleteCloud = useCallback(
    async (plan) => {
      const client = cloudClientRef.current;
      const user = cloudUserRef.current;
      if (cloudBusy || !user || !client || !plan?.id) return;
      if (!window.confirm(`Hapus rencana "${plan.name}" dari akun?`)) return;

      setCloudBusy(true);
      const uid = user.id;
      const generation = cloudGenerationRef.current;
      setAccountErrorText('');

      try {
        const { data, error } = await client
          .from('gradpath_plans')
          .delete()
          .eq('id', plan.id)
          .eq('user_id', uid)
          .select('id');
        if (error) throw error;
        if (generation !== cloudGenerationRef.current) return;
        if (!data?.length) {
          throw Error(
            'Rencana tidak dapat dihapus. Periksa izin hapus (RLS DELETE) pada tabel gradpath_plans di Supabase.'
          );
        }
        setAccountPlans((prev) => prev.filter((p) => p.id !== plan.id));
        if (accountContextRef.current?.id === plan.id) {
          setAccountContext(null);
          setCloudLast('');
        }
        toast('Rencana dihapus dari akun.');
      } catch (e) {
        if (generation === cloudGenerationRef.current) {
          setAccountErrorText(
            e?.message?.startsWith('Rencana tidak dapat') ? e.message : accountError(e)
          );
        }
      } finally {
        setCloudBusy(false);
      }
    },
    [cloudBusy, toast]
  );

  const signOut = useCallback(async () => {
    const client = cloudClientRef.current;
    if (cloudBusy || !client) return;
    if (
      accountContextRef.current &&
      cloudLastRef.current !== planFingerprint(stateRef.current) &&
      !window.confirm('Perubahan akun belum disimpan. Tetap keluar?')
    ) {
      return;
    }
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) {
      setAccountErrorText(accountError(error));
      return;
    }
    handleSetCloudUser(null);
    resetAccountView();
    setAccountDialogOpen(false);
    toast('Sudah keluar. Draft tamu tetap tersedia.');
  }, [cloudBusy, handleSetCloudUser, resetAccountView, toast]);

  useEffect(() => {
    try {
      if (accountContext?.userId) {
        sessionStorage.setItem(
          ACTIVE_SESSION_KEY,
          JSON.stringify({ accountContext, cloudLast, state })
        );
      } else {
        sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    } catch {
      // Ignore sessionStorage errors.
    }
  }, [accountContext, cloudLast, state]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (accountContextRef.current && cloudLastRef.current !== planFingerprint(stateRef.current)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    let active = true;
    let subscription = null;

    (async () => {
      try {
        if (!window.supabase) throw Error('SDK missing');
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            flowType: 'pkce',
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
          global: {
            fetch: (url, options = {}) =>
              fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(20000) }),
          },
        });
        cloudClientRef.current = client;

        const params = new URLSearchParams(window.location.search);
        const authReturn = params.has('code');
        if (authReturn) authValidatingRef.current = true;
        const { error } = await client.auth.getSession();
        if (error) throw error;
        const { data } = await client.auth.getUser();
        if (!active) return;

        const user = data?.user || null;

        if (authReturn || params.has('error')) {
          window.history.replaceState(null, '', window.location.pathname);
          const expectedRole = sessionStorage.getItem('gradpath-login-role');
          sessionStorage.removeItem('gradpath-login-role');

          if (user) {
            const { data: roleRow, error: roleErr } = await client
              .from('gradpath_roles')
              .select('role')
              .eq('user_id', user.id)
              .maybeSingle();
            if (!active) return;
            const actualRole = !roleErr && roleRow?.role === 'kaprodi' ? 'kaprodi' : 'student';

            if (expectedRole === 'kaprodi' && actualRole !== 'kaprodi') {
              sessionStorage.removeItem('gradpath-login-step');
              await client.auth.signOut({ scope: 'local' });
              authValidatingRef.current = false;
              handleSetCloudUser(null);
              setCloudReady(true);
              setAccountDialogOpen(true);
              setAccountErrorText(
                'Akun Google ini tidak terdaftar sebagai Kaprodi. Silakan pilih masuk sebagai Mahasiswa atau gunakan akun Kaprodi.'
              );
            } else if (expectedRole === 'student' && actualRole === 'kaprodi') {
              sessionStorage.removeItem('gradpath-login-step');
              await client.auth.signOut({ scope: 'local' });
              authValidatingRef.current = false;
              handleSetCloudUser(null);
              setCloudReady(true);
              setAccountDialogOpen(true);
              setAccountErrorText(
                'Akun ini terdaftar sebagai Kaprodi. Silakan pilih masuk sebagai Kaprodi.'
              );
            } else {
              authValidatingRef.current = false;
              handleSetCloudUser(user);
              setCloudReady(true);
              const profileInfo = await loadProfile(user);
              if (profileInfo?.role === 'kaprodi') {
                sessionStorage.removeItem('gradpath-login-step');
              } else {
                const step = sessionStorage.getItem('gradpath-login-step');
                sessionStorage.removeItem('gradpath-login-step');
                if (['english', 'grades', 'review', 'target', 'result'].includes(step)) {
                  setState((prev) => ({ ...prev, step }));
                  window.history.replaceState({ step }, '', `#${step}`);
                } else {
                  window.history.replaceState(
                    { step: stateRef.current.step },
                    '',
                    window.location.pathname
                  );
                }
                await openAccountWithReadyCheck(true, user, true);
              }
            }
          } else {
            authValidatingRef.current = false;
            handleSetCloudUser(null);
            setCloudReady(true);
            await openAccountWithReadyCheck(true, null, false);
            setAccountErrorText('Login belum berhasil atau dibatalkan. Coba masuk kembali.');
          }
        } else {
          authValidatingRef.current = false;
          handleSetCloudUser(user);
          setCloudReady(true);
          if (user) {
            await loadProfile(user);
          }
        }

        const { data: listener } = client.auth.onAuthStateChange((event, session) => {
          if (authValidatingRef.current) return;
          if (event === 'SIGNED_OUT') {
            handleSetCloudUser(null);
            setAccountDialogOpen(false);
          } else if (event === 'SIGNED_IN' && session?.user?.id !== cloudUserRef.current?.id) {
            handleSetCloudUser(session.user);
            loadProfile(session.user);
          }
        });
        subscription = listener?.subscription || null;
      } catch {
        authValidatingRef.current = false;
        if (active) {
          setCloudReady(true);
          toast('Koneksi akun belum tersedia. Anda tetap bisa menggunakan mode tamu.');
        }
      }
    })();

    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, [handleSetCloudUser, loadProfile, openAccountWithReadyCheck, setState, toast]);

  return {
    cloudClientRef,
    cloudUser,
    accountContext,
    cloudLast,
    cloudBusy,
    cloudReady,
    accountDialogOpen,
    accountPlans,
    loadingPlans,
    accountErrorText,
    saveIntentFlag,
    accountRevision,
    profileName,
    loadingProfile,
    needsProfileName,
    userRole,
    notifications,
    unreadCount: notifications.filter((n) => !n.is_read).length,
    loadingNotifications,
    notificationsOpen,
    applyContext,
    openAccount,
    closeAccount,
    openNotifications,
    closeNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    signIn,
    saveCloud,
    loadCloud,
    deleteCloud,
    saveProfile,
    signOut,
  };
}
