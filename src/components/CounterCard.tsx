import { LucideIcon } from 'lucide-react';

interface CounterCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  subtitle?: string;
  animate?: boolean;
}

export function CounterCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  borderColor,
  subtitle,
  animate = false,
}: CounterCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${borderColor} ${bgColor} p-4 transition-all duration-300 hover:scale-[1.02]`}
    >
      {/* Glow effect */}
      <div
        className={`absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-10 blur-2xl ${color.replace('text-', 'bg-')}`}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className={`text-3xl font-bold font-mono ${color} ${animate ? 'animate-pulse' : ''}`}>
            {value.toLocaleString('fr-FR')}
          </p>
          {subtitle && (
            <p className="text-slate-500 text-xs mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${bgColor} border ${borderColor}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}
