'use client';

import { useMemo } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { DEFAULT_SERVICES_CONFIG, SystemServicesConfig } from '@/lib/services-config';

/**
 * خطاف مخصص لجلب إعدادات الأسعار والنسب (API) المعتمدة من Firestore بشكل لحظي وموحد
 */
export function useServicesConfig() {
  const firestore = useFirestore();

  const configDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'system_settings', 'telecom_config') : null),
    [firestore]
  );

  const { data: remoteConfig, isLoading } = useDoc<SystemServicesConfig>(configDocRef);

  const config = useMemo<SystemServicesConfig>(() => {
    if (!remoteConfig) return DEFAULT_SERVICES_CONFIG;
    return {
      ...DEFAULT_SERVICES_CONFIG,
      ...remoteConfig,
      telecomApi: { ...DEFAULT_SERVICES_CONFIG.telecomApi, ...(remoteConfig.telecomApi || {}) },
      yemen_mobile: { ...DEFAULT_SERVICES_CONFIG.yemen_mobile, ...(remoteConfig.yemen_mobile || {}) },
      you: { ...DEFAULT_SERVICES_CONFIG.you, ...(remoteConfig.you || {}) },
      sabafon: { ...DEFAULT_SERVICES_CONFIG.sabafon, ...(remoteConfig.sabafon || {}) },
      why: { ...DEFAULT_SERVICES_CONFIG.why, ...(remoteConfig.why || {}) },
      yemen_4g: { ...DEFAULT_SERVICES_CONFIG.yemen_4g, ...(remoteConfig.yemen_4g || {}) },
      aden_net: { ...DEFAULT_SERVICES_CONFIG.aden_net, ...(remoteConfig.aden_net || {}) },
      landline_adsl: { ...DEFAULT_SERVICES_CONFIG.landline_adsl, ...(remoteConfig.landline_adsl || {}) },
      alwadi: {
        ...DEFAULT_SERVICES_CONFIG.alwadi,
        ...(remoteConfig.alwadi || {}),
        packages: {
          ...DEFAULT_SERVICES_CONFIG.alwadi.packages,
          ...(remoteConfig.alwadi?.packages || {})
        }
      },
      networks: { ...DEFAULT_SERVICES_CONFIG.networks, ...(remoteConfig.networks || {}) }
    } as SystemServicesConfig;
  }, [remoteConfig]);

  return { config, isLoading };
}
