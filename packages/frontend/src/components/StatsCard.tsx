interface StatsCardProps {
  label: string;
  value: string;
  subtitle?: string;
  color?: 'tfuel' | 'theta' | 'secondary' | 'white';
  className?: string;
  iconSrc?: string;
  iconAlt?: string;
}

const StatsCard = ({ label, value, subtitle, color = 'white', className = '', iconSrc, iconAlt }: StatsCardProps) => {
  const getColorClass = (color: string) => {
    switch (color) {
      case 'tfuel':
        return 'text-tfuel-color';
      case 'theta':
        return 'text-theta-color';
      case 'secondary':
        return 'text-secondary-color';
      case 'white':
      default:
        return 'text-white-color';
    }
  };

  return (
    <div className={`flex flex-col gap-2 rounded-xl bg-card-dark p-6 border border-border-dark/50 ${className}`}>
      <p className="text-text-secondary-dark text-base font-medium">{label}</p>
      <div className="flex items-center gap-3">
        {iconSrc && (
          <img 
            src={iconSrc} 
            alt={iconAlt || ''} 
            className="w-8 h-8 object-contain"
          />
        )}
        <p className={`text-3xl font-bold ${getColorClass(color)}`}>{value}</p>
      </div>
      {subtitle && (
        <p className="text-text-secondary-dark text-sm mt-1">{subtitle}</p>
      )}
    </div>
  );
};

export default StatsCard;
