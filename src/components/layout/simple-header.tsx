
'use client';
import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

type SimpleHeaderProps = {
  title: string;
};

const SimpleHeader = ({ title }: SimpleHeaderProps) => {
  const router = useRouter();

  return (
    <header className="flex items-center p-4 bg-transparent text-foreground relative h-16">
      <button 
        onClick={() => router.push('/login')} 
        className="p-2 absolute right-4 z-10 hover:bg-muted rounded-full transition-colors"
        aria-label="رجوع"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
      <h1 className="font-bold text-lg text-center flex-1">{title}</h1>
    </header>
  );
};

export { SimpleHeader };
