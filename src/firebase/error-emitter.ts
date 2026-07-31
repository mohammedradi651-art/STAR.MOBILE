'use client';

import { FirestorePermissionError } from '@/firebase/errors';

/**
 * مصادر الطلبات المدعومة:
 * - local: من داخل التطبيق
 * - api: من التطبيقات الخارجية
 */
export type RequestSource = 'local' | 'api';

/**
 * شكل بيانات الخطأ
 */
export interface AppErrorPayload {
  message: string;
  source?: RequestSource;
  code?: string;
  details?: any;
}

/**
 * جميع أحداث التطبيق
 */
export interface AppEvents {
  'permission-error': FirestorePermissionError | AppErrorPayload;
  'custom-error': AppErrorPayload;
}


// Callback
type Callback<T> = (data: T) => void;


/**
 * Event emitter عام
 */
function createEventEmitter<T extends Record<string, any>>() {

  const events: {
    [K in keyof T]?: Array<Callback<T[K]>>
  } = {};


  return {

    on<K extends keyof T>(
      eventName: K,
      callback: Callback<T[K]>
    ) {

      if (!events[eventName]) {
        events[eventName] = [];
      }

      events[eventName]?.push(callback);
    },


    off<K extends keyof T>(
      eventName: K,
      callback: Callback<T[K]>
    ) {

      if (!events[eventName]) return;

      events[eventName] =
        events[eventName]?.filter(
          cb => cb !== callback
        );

    },


    emit<K extends keyof T>(
      eventName: K,
      data: T[K]
    ) {

      if (!events[eventName]) return;

      events[eventName]?.forEach(
        callback => callback(data)
      );

    },

  };

}


/**
 * Event واحد للتطبيق كامل
 * يدعم Local + API
 */
export const errorEmitter =
  createEventEmitter<AppEvents>();



/**
 * إرسال خطأ من أي مصدر
 */
export function emitError(
  message: string,
  source: RequestSource = 'local',
  code?: string,
  details?: any
) {

  errorEmitter.emit(
    'custom-error',
    {
      message,
      source,
      code,
      details
    }
  );

}