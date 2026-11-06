import React from 'react';
import {
  Calendar,
  Gift,
  MessageCircle,
  CreditCard,
  Clock,
  Cake,
  Share2,
} from 'lucide-react';
import { UpcomingBirthday } from '../entities/entities';

interface BirthdayCardProps {
  birthday: UpcomingBirthday;
  detailed?: boolean;
}

const BirthdayCard: React.FC<BirthdayCardProps> = ({
  birthday,
  detailed = false,
}) => {
  const getTodoIcon = () => {
    switch (birthday.Todo) {
      case 'WHATSAPP':
        return <MessageCircle size={16} className="text-green-500" />;
      case 'NEEDCARD':
        return <CreditCard size={16} className="text-blue-500" />;
      case 'NEEDPRESENT':
        return <Gift size={16} className="text-purple-500" />;
      default:
        return <Gift size={16} className="text-purple-500" />;
    }
  };

  const getTodoText = () => {
    switch (birthday.Todo) {
      case 'WHATSAPP':
        return 'WhatsApp senden';
      case 'NEEDCARD':
        return 'Karte besorgen';
      case 'NEEDPRESENT':
        return 'Geschenk besorgen';
      default:
        return 'Geschenk besorgen';
    }
  };

  const getUrgencyStyles = () => {
    if (birthday.daysUntilBirthday === 0) {
      return {
        card: 'bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-l-red-500 shadow-red-100',
        badge: 'bg-red-500 text-white animate-pulse-slow',
        text: 'Heute! 🎉',
      };
    }
    if (birthday.daysUntilBirthday <= 3) {
      return {
        card: 'bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-l-orange-500 shadow-orange-100',
        badge: 'bg-orange-500 text-white',
        text: `${birthday.daysUntilBirthday} Tage`,
      };
    }
    if (birthday.daysUntilBirthday <= 7) {
      return {
        card: 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500 shadow-blue-100',
        badge: 'bg-blue-500 text-white',
        text: `${birthday.daysUntilBirthday} Tage`,
      };
    }
    return {
      card: 'bg-white border-l-4 border-l-green-500 shadow-gray-100',
      badge: 'bg-green-500 text-white',
      text: `${birthday.daysUntilBirthday} Tage`,
    };
  };

  const urgencyStyles = getUrgencyStyles();

  return (
    <div
      className={`
      ${urgencyStyles.card}
      rounded-xl p-6 shadow-lg hover:shadow-xl transform hover:-translate-y-1 
      transition-all duration-300 cursor-pointer group
      ${detailed ? 'mb-2' : ''}
    `}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
            {birthday.name} {birthday.lastName}
          </h3>
          {birthday.sharedBy && (
            <p className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <Share2 size={12} />
              geteilt von {birthday.sharedBy.name} {birthday.sharedBy.lastName}
            </p>
          )}
        </div>
        <div
          className={`
          px-3 py-1 rounded-full text-sm font-medium shrink-0 ml-3
          ${urgencyStyles.badge}
        `}
        >
          {urgencyStyles.text}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 text-gray-600">
          <Calendar size={16} className="text-gray-400" />
          <span className="text-sm">{birthday.birthdayThisYear}</span>
          {birthday.age && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              {birthday.age} Jahre
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {getTodoIcon()}
          <span className="text-sm text-gray-600">{getTodoText()}</span>
        </div>

        <div className="flex items-center gap-3 text-gray-500">
          <Clock size={16} className="text-gray-400" />
          <span className="text-sm">
            {birthday.daysUntilBirthday === 0
              ? 'Heute ist der große Tag!'
              : birthday.daysUntilBirthday === 1
                ? 'Morgen!'
                : `In ${birthday.daysUntilBirthday} Tagen`}
          </span>
        </div>
      </div>

      {detailed && (
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2">
            <Cake size={16} />
            Erledigt
          </button>
          <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors duration-200">
            Bearbeiten
          </button>
        </div>
      )}
    </div>
  );
};

export default BirthdayCard;
