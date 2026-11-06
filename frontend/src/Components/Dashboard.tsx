import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Gift,
  Users,
  TrendingUp,
  Sparkles,
  Settings,
  Share2,
} from 'lucide-react';
import BirthdayCard from './BirthdayCard';
import StatsCard from './StatsCard';
import { Share, Statistics, UpcomingBirthday } from '../entities/entities';
import { birthdayApi, sharingApi } from '../APIService';
import PersonList from './PersonList';
import CalendarSubscription from './CalendarSubscription';
import TodoistIntegration from './TodoistIntegration';
import BirthdaySharing from './BirthdaySharing';
import { useAuth } from '../AuthContext';

const Dashboard: React.FC = () => {
  const { name, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<
    UpcomingBirthday[]
  >([]);
  const [loading, setLoading] = useState(true);
  // Nach der Rückkehr von Todoist (?todoist=...) direkt die Verwaltung zeigen
  const [activeTab, setActiveTab] = useState<
    'overview' | 'upcoming' | 'manage'
  >(() =>
    new URLSearchParams(window.location.search).has('todoist')
      ? 'manage'
      : 'overview',
  );

  const loadData = () =>
    Promise.all([
      birthdayApi.getStatistics(),
      birthdayApi.getUpcomingBirthdays(30),
    ])
      .then(([stats, upcoming]) => {
        setStatistics(stats);
        setUpcomingBirthdays(upcoming);
      })
      .catch((error) => console.error('Error loading data:', error))
      .finally(() => setLoading(false));

  // Offene Freigabe-Anfragen an mich - es gibt keine Mails, also Hinweis im Dashboard
  const [pendingShares, setPendingShares] = useState<Share[]>([]);
  // Erhöhen lädt die Personenliste neu (z.B. nach Annehmen einer Freigabe)
  const [listVersion, setListVersion] = useState(0);

  const loadPendingShares = () =>
    sharingApi
      .list()
      .then(({ incoming }) =>
        setPendingShares(incoming.filter((s) => s.status === 'PENDING')),
      )
      .catch((error) => console.error('Error loading shares:', error));

  const handleSharesChanged = () => {
    loadData();
    loadPendingShares();
    setListVersion((v) => v + 1);
  };

  useEffect(() => {
    loadData();
    loadPendingShares();
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{
          background:
            'linear-gradient(135deg, #14b8a6 0%, #06b6d4 25%, #0891b2 50%, #0e7490 75%, #155e75 100%)',
        }}
      >
        <div className="relative mb-8">
          <div className="w-20 h-20 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-yellow-300 animate-pulse" />
        </div>
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl px-12 py-6 text-center">
          <p className="text-white text-xl font-semibold mb-2">
            ✨ Lade Geburtstage...
          </p>
          <p className="text-white/80">Einen Moment bitte</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-8"
      style={{
        background:
          'linear-gradient(135deg, #14b8a6 0%, #06b6d4 25%, #0891b2 50%, #0e7490 75%, #155e75 100%)',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-12">
          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-3xl p-12">
            <div className="flex justify-between items-center mb-4">
              <span className="text-white text-xl font-semibold mr-4">
                Willkommen {name}
              </span>
              <h1
                className="text-4xl lg:text-6xl font-bold text-white flex items-center gap-5"
                style={{ textShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}
              >
                🎉 Gifty McGiftface
                <Sparkles
                  className="w-12 h-12 lg:w-16 lg:h-16 text-yellow-300 animate-pulse"
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                  }}
                />
              </h1>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-xl shadow transition ml-4"
              >
                Logout
              </button>
            </div>
            <p
              className="text-2xl text-white/90 font-medium"
              style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
            >
              Nie wieder einen Geburtstag vergessen! 🎂
            </p>
          </div>
        </header>
        <nav className="mb-8">
          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-3xl p-3">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {(
                [
                  { key: 'overview', label: 'Übersicht', icon: TrendingUp },
                  { key: 'upcoming', label: 'Kommende', icon: Calendar },
                  { key: 'manage', label: 'Verwalten', icon: Settings },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-semibold text-lg transition-all duration-300 ${
                    activeTab === key
                      ? 'bg-white/95 text-cyan-700 shadow-lg scale-105'
                      : 'bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 hover:-translate-y-1'
                  }`}
                >
                  <Icon size={22} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
        {pendingShares.length > 0 && activeTab !== 'manage' && (
          <div className="mb-8 bg-yellow-400/20 border border-yellow-200/40 rounded-3xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-white">
            <span className="flex items-center gap-3">
              <Share2 size={22} className="text-yellow-300 shrink-0" />
              {pendingShares.length === 1
                ? `${pendingShares[0].user.name} ${pendingShares[0].user.lastName} möchte Geburtstage mit dir teilen.`
                : `${pendingShares.length} Personen möchten Geburtstage mit dir teilen.`}
            </span>
            <button
              onClick={() => setActiveTab('manage')}
              className="bg-white/95 text-cyan-700 font-semibold py-2 px-5 rounded-xl shadow"
            >
              Anzeigen
            </button>
          </div>
        )}
        <main className="bg-white/15 backdrop-blur-md border border-white/25 rounded-3xl p-10">
          {activeTab === 'overview' && statistics && (
            <div className="space-y-10">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                  title="Gesamt Personen"
                  value={statistics.total}
                  icon={<Users size={24} />}
                  color="linear-gradient(135deg, #0891b2, #0e7490)"
                />
                <StatsCard
                  title="Kommende Geburtstage"
                  value={statistics.upcomingCount}
                  icon={<Calendar size={24} />}
                  color="linear-gradient(135deg, #059669, #047857)"
                />
                <StatsCard
                  title="Geschenke benötigt"
                  value={
                    statistics.upcoming.filter((b) => b.Todo === 'NEEDPRESENT')
                      .length
                  }
                  icon={<Gift size={24} />}
                  color="linear-gradient(135deg, #d97706, #b45309)"
                />
              </div>
              <div>
                <h2
                  className="text-3xl font-bold text-white mb-7 flex items-center gap-4"
                  style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
                >
                  <Calendar size={32} className="text-yellow-300" />
                  Nächste Geburtstage
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {statistics.upcoming.slice(0, 4).map((birthday) => (
                    <BirthdayCard key={birthday.id} birthday={birthday} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'upcoming' && (
            <div>
              <h2
                className="text-3xl font-bold text-white mb-7 flex items-center gap-4"
                style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
              >
                <Calendar size={32} className="text-yellow-300" />
                Kommende Geburtstage (nächste 30 Tage)
              </h2>
              {upcomingBirthdays.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-2xl">
                  <Calendar size={96} className="mx-auto mb-5 text-white/40" />
                  <p className="text-white/80 text-2xl font-medium mb-2">
                    🌊 Keine Geburtstage in den nächsten 30 Tagen
                  </p>
                  <p className="text-white/60 text-lg">
                    Zeit zum Entspannen! 😌
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingBirthdays.map((birthday) => (
                    <BirthdayCard
                      key={birthday.id}
                      birthday={birthday}
                      detailed
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="flex flex-col gap-3">
              <CalendarSubscription />
              <TodoistIntegration />
              <BirthdaySharing onChange={handleSharesChanged} />
              <PersonList key={listVersion} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
