'use client';

/**
 * المصدر المركزي للـ Firebase داخل التطبيق.
 * يعتمد على config.ts لضمان استقرار جلسات المستخدمين.
 */
import { app, auth, firestore, firebaseConfig } from './config';

export { app, auth, firestore, firebaseConfig };

export * from './provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
