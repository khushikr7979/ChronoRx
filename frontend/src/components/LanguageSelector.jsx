import React, { useState, useEffect } from 'react';
import { translationAPI } from '../services/api';

export const INDIAN_LANGUAGES_FALLBACK = [
  { code: 'en', name: 'English', native_name: 'English', script: 'Latin', direction: 'ltr' },
  { code: 'as', name: 'Assamese', native_name: 'অসমীয়া', script: 'Bengali-Assamese', direction: 'ltr' },
  { code: 'bn', name: 'Bengali', native_name: 'বাংলা', script: 'Bengali', direction: 'ltr' },
  { code: 'brx', name: 'Bodo', native_name: "बर'", script: 'Devanagari', direction: 'ltr' },
  { code: 'doi', name: 'Dogri', native_name: 'डोगरी', script: 'Devanagari', direction: 'ltr' },
  { code: 'gu', name: 'Gujarati', native_name: 'ગુજરાતી', script: 'Gujarati', direction: 'ltr' },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', script: 'Devanagari', direction: 'ltr' },
  { code: 'kn', name: 'Kannada', native_name: 'ಕನ್ನಡ', script: 'Kannada', direction: 'ltr' },
  { code: 'ks', name: 'Kashmiri', native_name: 'कॉशुर / کٲشُر', script: 'Perso-Arabic', direction: 'rtl' },
  { code: 'kok', name: 'Konkani', native_name: 'कोंकणी', script: 'Devanagari', direction: 'ltr' },
  { code: 'mai', name: 'Maithili', native_name: 'मैथिली', script: 'Devanagari', direction: 'ltr' },
  { code: 'ml', name: 'Malayalam', native_name: 'മലയാളം', script: 'Malayalam', direction: 'ltr' },
  { code: 'mni', name: 'Manipuri (Meitei)', native_name: 'মৈতৈলোন্', script: 'Meitei Mayek', direction: 'ltr' },
  { code: 'mr', name: 'Marathi', native_name: 'मराठी', script: 'Devanagari', direction: 'ltr' },
  { code: 'ne', name: 'Nepali', native_name: 'नेपाली', script: 'Devanagari', direction: 'ltr' },
  { code: 'or', name: 'Odia', native_name: 'ଓଡ଼ିଆ', script: 'Odia', direction: 'ltr' },
  { code: 'pa', name: 'Punjabi', native_name: 'ਪੰਜਾਬੀ', script: 'Gurmukhi', direction: 'ltr' },
  { code: 'sa', name: 'Sanskrit', native_name: 'संस्कृतम्', script: 'Devanagari', direction: 'ltr' },
  { code: 'sat', name: 'Santali', native_name: 'ᱥᱟᱱᱛᱟᱲᱤ', script: 'Ol Chiki', direction: 'ltr' },
  { code: 'sd', name: 'Sindhi', native_name: 'سنڌي', script: 'Perso-Arabic', direction: 'rtl' },
  { code: 'ta', name: 'Tamil', native_name: 'தமிழ்', script: 'Tamil', direction: 'ltr' },
  { code: 'te', name: 'Telugu', native_name: 'తెలుగు', script: 'Telugu', direction: 'ltr' },
  { code: 'ur', name: 'Urdu', native_name: 'اردو', script: 'Perso-Arabic', direction: 'rtl' },
];

export default function LanguageSelector({
  selectedLanguage = 'en',
  onSelectLanguage,
  className = '',
  label = 'Preferred Language / मातृभाषा',
  showLabel = true,
  disabled = false,
}) {
  const [languages, setLanguages] = useState(INDIAN_LANGUAGES_FALLBACK);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    translationAPI
      .getLanguages()
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setLanguages(data);
        }
      })
      .catch(() => {
        // Fallback already pre-loaded
      });
    return () => {
      mounted = false;
    };
  }, []);

  const activeLang =
    languages.find((l) => l.code.toLowerCase() === selectedLanguage.toLowerCase()) ||
    languages[0];

  const filteredLanguages = languages.filter((l) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      l.name.toLowerCase().includes(q) ||
      (l.native_name && l.native_name.toLowerCase().includes(q)) ||
      l.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {showLabel && (
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full inline-flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-300 hover:border-teal-500 rounded-lg shadow-sm text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-base" role="img" aria-label="Globe">
            🌐
          </span>
          <span className="font-semibold text-slate-900">{activeLang.name}</span>
          <span className="text-teal-700 font-medium">({activeLang.native_name})</span>
          {activeLang.direction === 'rtl' && (
            <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
              RTL
            </span>
          )}
        </span>
        <svg
          className={`ml-2 h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          <div className="origin-top-right absolute right-0 mt-1.5 w-72 rounded-xl shadow-2xl bg-white ring-1 ring-black ring-opacity-5 divide-y divide-slate-100 z-40 max-h-96 flex flex-col overflow-hidden animate-fadeIn">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 22 Indian languages..."
                  className="w-full text-xs px-3 py-1.5 pl-8 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  autoFocus
                />
                <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">🔍</span>
              </div>
            </div>

            <div className="py-1 overflow-y-auto divide-y divide-slate-50 flex-1">
              {filteredLanguages.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500 text-center">
                  No matching language found
                </div>
              ) : (
                filteredLanguages.map((lang) => {
                  const isSelected = lang.code.toLowerCase() === selectedLanguage.toLowerCase();
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        onSelectLanguage(lang.code);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-teal-50 text-teal-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 flex items-center gap-1.5">
                          {lang.name}
                          {lang.direction === 'rtl' && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold">
                              RTL
                            </span>
                          )}
                        </span>
                        <span className="text-teal-700 font-normal">
                          {lang.native_name} &bull; <span className="text-slate-400">{lang.script}</span>
                        </span>
                      </div>
                      {isSelected && (
                        <span className="text-teal-600 font-bold text-sm">✓</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 text-center font-medium">
              Eighth Schedule Languages of India &bull; Certified Safety
            </div>
          </div>
        </>
      )}
    </div>
  );
}
