import React from 'react';

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  /** CSS-Hintergrund der Icon-Box, z.B. ein linear-gradient(...) */
  color: string;
  onAdd?: () => void;
  onEdit?: () => void;
  showActions?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  color,
  onAdd,
  onEdit,
  showActions = false,
}) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
      <div className="flex  gap-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0"
          style={{ background: color }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-3xl font-bold text-gray-800 mb-1">
            {value.toLocaleString()}
          </h3>
          <p className="text-gray-500 font-medium text-sm">{title}</p>
        </div>
        {showActions && (
          <div className="flex items-center gap-2">
            {onAdd && (
              <button
                type="button"
                onClick={onAdd}
                aria-label="Add person"
                className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-green-500 hover:bg-green-600 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-300"
              >
                + Add
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label="Edit"
                className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                ✎ Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default StatsCard;
