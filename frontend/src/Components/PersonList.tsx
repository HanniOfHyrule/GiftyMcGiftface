import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Users, Search, Share2 } from 'lucide-react';
import { Birthday } from '../entities/entities';
import { birthdayApi } from '../APIService';
import { PersonAdd } from './PersonAdd';
import { formatBirthdayLabel } from '../utils/birthday';

// So viele Personen werden pro Scroll-Schritt zusätzlich angezeigt
const PAGE_SIZE = 24;

const PersonList: React.FC = () => {
  const [people, setPeople] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Birthday | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPeople = () =>
    birthdayApi
      .getAllBirthdays()
      .then(setPeople)
      .catch((error) => console.error('Error loading people:', error))
      .finally(() => setLoading(false));

  useEffect(() => {
    loadPeople();
  }, []);

  const handleAddNew = () => {
    setSelectedPerson(null);
    setIsFormOpen(true);
  };

  const handleEdit = (person: Birthday) => {
    setSelectedPerson(person);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Person wirklich löschen?')) {
      try {
        await birthdayApi.deleteBirthday(id);
        loadPeople();
      } catch (error) {
        console.error('Error deleting person:', error);
      }
    }
  };

  const handleFormSave = () => {
    loadPeople();
  };

  const filteredPeople = people.filter((person) =>
    `${person.name} ${person.lastName}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );
  const visiblePeople = filteredPeople.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPeople.length;

  // Endlos-Scrollen: Sobald das Ende der Liste im Scrollbereich sichtbar wird,
  // die nächsten Personen anzeigen.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => count + PAGE_SIZE);
        }
      },
      { root: scrollRef.current, rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setVisibleCount(PAGE_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  if (loading) {
    return (
      <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-3xl p-8">
        <div className="text-center py-10">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Lade Personen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-3xl p-8">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <Users size={32} className="text-yellow-300" />
          Alle Personen ({filteredPeople.length})
        </h2>

        <button
          onClick={handleAddNew}
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-2xl font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <Plus size={20} />
          Neue Person
        </button>
      </div>

      {/* Search */}
      <div className="mb-6 relative">
        <Search
          size={20}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Personen suchen..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white/10 border-2 border-white/20 rounded-2xl text-white placeholder-white/60 text-lg focus:border-white/40 focus:bg-white/15 focus:outline-none transition-all duration-300"
        />
      </div>

      {/* People List */}
      {filteredPeople.length === 0 ? (
        <div className="text-center py-16 bg-white/5 rounded-2xl">
          <Users size={80} className="mx-auto mb-4 text-white/40" />
          <p className="text-white/80 text-xl mb-2">
            {searchTerm
              ? 'Keine Personen gefunden'
              : 'Noch keine Personen vorhanden'}
          </p>
          <p className="text-white/60 text-sm">
            {searchTerm
              ? 'Versuche einen anderen Suchbegriff'
              : 'Füge deine erste Person hinzu!'}
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="max-h-[70vh] overflow-y-auto overscroll-contain -mx-2 px-2 py-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visiblePeople.map((person) => (
              <div
                key={person.id}
                className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 transform transition-all duration-300 hover:-translate-y-2 hover:shadow-xl cursor-pointer"
              >
                {/* Person Info */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-800 mb-1">
                    {person.name} {person.lastName}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">
                    {formatBirthdayLabel(person.dateOfBirth)}
                  </p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      person.Todo === 'WHATSAPP'
                        ? 'bg-green-100 text-green-800'
                        : person.Todo === 'NEEDCARD'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {person.Todo === 'WHATSAPP'
                      ? '📱 WhatsApp'
                      : person.Todo === 'NEEDCARD'
                        ? '💌 Karte'
                        : '🎁 Geschenk'}
                  </span>
                  {person.sharedBy && (
                    <span className="inline-flex items-center gap-1 ml-2 px-3 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
                      <Share2 size={12} />
                      geteilt von {person.sharedBy.name}{' '}
                      {person.sharedBy.lastName}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(person)}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white py-2 px-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:from-cyan-600 hover:to-cyan-700 hover:scale-105 transition-all duration-200"
                  >
                    <Edit size={14} />
                    Bearbeiten
                  </button>
                  {/* Geteilte Einträge kann nur der Besitzer löschen */}
                  {!person.sharedBy && (
                    <button
                      onClick={() => handleDelete(person.id)}
                      aria-label={`${person.name} ${person.lastName} löschen`}
                      className="bg-gradient-to-r from-red-500 to-red-600 text-white py-2 px-3 rounded-xl hover:from-red-600 hover:to-red-700 hover:scale-105 transition-all duration-200"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {hasMore ? (
            <div
              ref={sentinelRef}
              className="flex justify-center py-6"
              aria-label="Weitere Personen werden geladen"
            >
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            filteredPeople.length > PAGE_SIZE && (
              <p className="text-center text-white/60 text-sm py-6">
                Alle {filteredPeople.length} Personen geladen
              </p>
            )
          )}
        </div>
      )}

      {isFormOpen && (
        <PersonAdd
          key={selectedPerson?.id ?? 'new'}
          person={selectedPerson}
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
};

export default PersonList;
