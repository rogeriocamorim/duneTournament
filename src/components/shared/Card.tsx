import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'glow';
}

export function Card({ children, className, variant = 'default' }: CardProps) {
  const baseStyles = 'rounded-lg p-6 border backdrop-blur-sm';
  
  const variantStyles = {
    default: 'bg-dune-desert-200/80 border-dune-sand-800',
    elevated: 'bg-dune-desert-100/90 border-dune-sand-700 shadow-lg',
    glow: 'bg-dune-desert-200/80 border-dune-spice-700 shadow-spice-glow',
  };
  
  return (
    <div className={clsx(baseStyles, variantStyles[variant], className)}>
      {children}
    </div>
  );
}
