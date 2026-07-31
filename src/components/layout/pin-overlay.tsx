'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Delete, Lock, Unlock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * مكون شاشة القفل بالرمز السري.
 * تظهر فوق المحتوى بالكامل حتى يتم إدخال الرمز الصحيح.
 */
export function PinOverlay({ 
    userPin, 
    onVerified 
}: { 
    userPin: string; 
    onVerified: () => void;
}) {
    const [pin, setPin] = useState('');
    const [isError, setIsError] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleNumberClick = (num: string) => {
        if (pin.length < 6) {
            const newPin = pin + num;
            setPin(newPin);
            setIsError(false);

            if (newPin.length === 6) {
                if (newPin === userPin) {
                    setIsSuccess(true);
                    setTimeout(() => {
                        onVerified();
                    }, 500);
                } else {
                    setIsError(true);
                    setTimeout(() => {
                        setPin('');
                        setIsError(false);
                    }, 800);
                }
            }
        }
    };

    const handleDelete = () => {
        setPin(pin.slice(0, -1));
        setIsError(false);
    };

    const dots = [1, 2, 3, 4, 5, 6];

    return (
        <div className="fixed inset-0 z-[10001] bg-mesh-gradient flex flex-col items-center justify-between py-12 px-6 overflow-hidden">
            {/* الخلفية الزخرفية */}
            <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-[-5%] left-[-10%] w-[250px] h-[250px] bg-white/5 rounded-full blur-3xl animate-pulse" />

            {/* الشعار والرسالة */}
            <div className="relative flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="relative w-24 h-24">
                    <div className="absolute inset-0 bg-white/20 rounded-[36px] blur-xl animate-pulse" />
                    <div className="relative w-full h-full overflow-hidden rounded-[32px] border-4 border-white/30 shadow-2xl bg-white p-1">
                        <Image 
                            src="https://i.postimg.cc/2551nF1s/20260308-183624.jpg" 
                            alt="Star Mobile" 
                            fill
                            className="object-cover"
                            priority
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-black text-white drop-shadow-md">أدخل الرمز السري</h1>
                    <p className="text-white/70 text-xs font-bold">تطبيقك محمي بالرمز السري</p>
                </div>
            </div>

            {/* عرض الرمز (النقاط) */}
            <div className={cn(
                "relative flex justify-center gap-4 py-8",
                isError && "animate-shake"
            )}>
                {dots.map((_, i) => (
                    <div 
                        key={i}
                        className={cn(
                            "w-4 h-4 rounded-full border-2 transition-all duration-300",
                            pin.length > i 
                                ? (isSuccess ? "bg-green-400 border-green-400 scale-125" : "bg-white border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]") 
                                : "bg-transparent border-white/30"
                        )}
                    />
                ))}
            </div>

            {/* لوحة المفاتيح الرقمية */}
            <div className="relative w-full max-w-[320px] grid grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        onClick={() => handleNumberClick(num.toString())}
                        className="h-16 w-16 mx-auto rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/10 flex items-center justify-center text-2xl font-black text-white transition-all active:scale-90"
                    >
                        {num}
                    </button>
                ))}
                <div className="flex items-center justify-center">
                    {/* مكان فارغ أو أيقونة بصمة */}
                    <ShieldCheck className="text-white/20 w-8 h-8" />
                </div>
                <button
                    onClick={() => handleNumberClick('0')}
                    className="h-16 w-16 mx-auto rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/10 flex items-center justify-center text-2xl font-black text-white transition-all active:scale-90"
                >
                    0
                </button>
                <button
                    onClick={handleDelete}
                    className="h-16 w-16 mx-auto rounded-full bg-white/5 hover:bg-white/15 active:bg-white/25 flex items-center justify-center text-white transition-all active:scale-90"
                >
                    <Delete className="w-6 h-6" />
                </button>
            </div>

            <p className="relative text-[9px] font-bold text-white/40 uppercase tracking-widest mt-4">Star Mobile Security</p>

            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-8px); }
                    75% { transform: translateX(8px); }
                }
                .animate-shake {
                    animation: shake 0.2s ease-in-out 0s 2;
                }
            `}</style>
        </div>
    );
}
