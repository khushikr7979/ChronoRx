import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, X, Check, Stethoscope, Building2 } from 'lucide-react';
import { departmentAPI } from '../services/api';

export const CATEGORIES_ORDER = [
  'Primary & General Care',
  'Core Specialties',
  'Super Specialties',
  'Emergency & Critical Care',
  'Allied & Diagnostic Departments',
];

export const DEPARTMENTS_DATA = [
  // Primary & General Care
  {
    id: 'general-medicine',
    name: 'General Medicine (Internal Medicine)',
    category: 'Primary & General Care',
    category_id: 'primary-general',
    description: 'First-contact adult care, acute fevers, multi-system chronic disease management, and internal medicine',
    keywords: ['general', 'medicine', 'internal', 'physician', 'fever', 'diabetes', 'hypertension', 'primary', 'adult'],
  },
  {
    id: 'general-surgery',
    name: 'General Surgery',
    category: 'Primary & General Care',
    category_id: 'primary-general',
    description: 'Comprehensive pre-operative, operative, and post-operative management for common surgical conditions',
    keywords: ['surgery', 'surgeon', 'operation', 'appendix', 'hernia', 'wound', 'operative', 'trauma'],
  },
  {
    id: 'family-medicine',
    name: 'Family Medicine',
    category: 'Primary & General Care',
    category_id: 'primary-general',
    description: 'Continuous, comprehensive primary healthcare for individuals and families across all ages and genders',
    keywords: ['family', 'community', 'general practitioner', 'gp', 'holistic', 'preventive', 'wellness'],
  },

  // Core Specialties
  {
    id: 'pediatrics',
    name: 'Pediatrics (Child Care)',
    category: 'Core Specialties',
    category_id: 'core-specialties',
    description: 'Medical care, growth monitoring, developmental assessments, and disease treatment for infants, children, and adolescents',
    keywords: ['pediatrics', 'child', 'children', 'baby', 'infant', 'neonatal', 'adolescent', 'pediatrician', 'kid', 'kids'],
  },
  {
    id: 'obstetrics-gynecology',
    name: 'Obstetrics & Gynecology (OB/GYN)',
    category: 'Core Specialties',
    category_id: 'core-specialties',
    description: 'Female reproductive health, prenatal care, maternal-fetal medicine, childbirth, and gynecologic surgeries',
    keywords: ['obgyn', 'gynecology', 'obstetrics', 'pregnancy', 'pregnant', 'women', 'maternity', 'delivery', 'female', 'uterus', 'ovary'],
  },
  {
    id: 'orthopedics',
    name: 'Orthopedics (Bones & Joints)',
    category: 'Core Specialties',
    category_id: 'core-specialties',
    description: 'Prevention, diagnosis, and treatment of musculoskeletal disorders, fractures, joint replacements, and sports injuries',
    keywords: ['bones', 'joints', 'fracture', 'orthopedic', 'ortho', 'spine', 'arthritis', 'knee', 'shoulder', 'ligament', 'bone'],
  },
  {
    id: 'cardiology',
    name: 'Cardiology (Heart)',
    category: 'Core Specialties',
    category_id: 'core-specialties',
    description: 'Diagnosis and medical treatment of cardiovascular disease, heart attacks, hypertension, and arrhythmia',
    keywords: ['heart', 'cardio', 'cardiac', 'chest pain', 'ecg', 'hypertension', 'angina', 'coronary', 'cholesterol', 'artery'],
  },
  {
    id: 'neurology',
    name: 'Neurology (Brain & Nervous System)',
    category: 'Core Specialties',
    category_id: 'core-specialties',
    description: 'Disorders of the central, peripheral, and autonomic nervous systems, stroke management, and epilepsy',
    keywords: ['brain', 'nerves', 'nervous system', 'stroke', 'epilepsy', 'headache', 'migraine', 'paralysis', 'seizure', 'neuro'],
  },
  {
    id: 'oncology',
    name: 'Oncology (Cancer Care)',
    category: 'Core Specialties',
    category_id: 'core-specialties',
    description: 'Medical, surgical, and radiation therapies for malignant neoplasms, tumors, and cancer survivorship',
    keywords: ['cancer', 'tumor', 'chemotherapy', 'radiation', 'malignancy', 'oncologist', 'biopsy', 'carcinoma', 'onco'],
  },
  {
    id: 'ophthalmology',
    name: 'Ophthalmology (Eye Care)',
    category: 'Core Specialties',
    category_id: 'core-specialties',
    description: 'Comprehensive medical and surgical eye care, refractive errors, cataracts, glaucoma, and retina disorders',
    keywords: ['eye', 'eyes', 'vision', 'cataract', 'glaucoma', 'retina', 'spectacles', 'sight', 'cornea', 'blindness', 'optics'],
  },
  {
    id: 'ent',
    name: 'ENT (Otorhinolaryngology)',
    category: 'Core Specialties',
    category_id: 'core-specialties',
    description: 'Medical and surgical management of disorders affecting the ears, nose, throat, sinuses, and larynx',
    keywords: ['ent', 'ear', 'ears', 'nose', 'throat', 'sinus', 'hearing', 'tonsils', 'vertigo', 'voice', 'nasal'],
  },
  {
    id: 'dermatology',
    name: 'Dermatology (Skin & Hair)',
    category: 'Core Specialties',
    category_id: 'core-specialties',
    description: 'Diagnosis and therapeutics for skin diseases, hair loss, nail disorders, eczema, psoriasis, and cosmetic dermatology',
    keywords: ['skin', 'hair', 'dermatologist', 'acne', 'allergy', 'rash', 'psoriasis', 'eczema', 'scalp', 'derma'],
  },
  {
    id: 'psychiatry',
    name: 'Psychiatry & Psychology',
    category: 'Core Specialties',
    category_id: 'core-specialties',
    description: 'Behavioral medicine, psychiatric assessment, mood disorders, anxiety management, counseling, and mental health',
    keywords: ['mental health', 'psychiatry', 'psychology', 'depression', 'anxiety', 'stress', 'mood', 'bipolar', 'sleep', 'therapy'],
  },

  // Super Specialties
  {
    id: 'endocrinology',
    name: 'Endocrinology (Diabetes & Hormones)',
    category: 'Super Specialties',
    category_id: 'super-specialties',
    description: 'Hormonal disorders, type 1 and 2 diabetes mellitus, thyroid pathologies, pituitary and metabolic diseases',
    keywords: ['diabetes', 'thyroid', 'hormones', 'endocrine', 'metabolism', 'pcos', 'insulin', 'sugar', 'adrenal', 'gland'],
  },
  {
    id: 'gastroenterology',
    name: 'Gastroenterology (Digestive System)',
    category: 'Super Specialties',
    category_id: 'super-specialties',
    description: 'Disorders of the digestive tract, esophagus, stomach, intestines, liver, gallbladder, and pancreas',
    keywords: ['stomach', 'liver', 'digestive', 'gut', 'colon', 'acidity', 'endoscopy', 'hepatology', 'gastric', 'gerd', 'pancreas'],
  },
  {
    id: 'nephrology',
    name: 'Nephrology (Kidneys)',
    category: 'Super Specialties',
    category_id: 'super-specialties',
    description: 'Diagnosis and medical management of acute and chronic kidney disease, dialysis, and renal failure',
    keywords: ['kidney', 'kidneys', 'renal', 'dialysis', 'creatinine', 'nephrologist', 'kidney failure', 'proteinuria', 'electrolytes'],
  },
  {
    id: 'urology',
    name: 'Urology (Urinary Tract)',
    category: 'Super Specialties',
    category_id: 'super-specialties',
    description: 'Surgical and medical diseases of male and female urinary tracts and the male reproductive system',
    keywords: ['urine', 'urinary', 'bladder', 'prostate', 'kidney stones', 'urologist', 'incontinence', 'urethra'],
  },
  {
    id: 'pulmonology',
    name: 'Pulmonology (Lungs & Respiratory)',
    category: 'Super Specialties',
    category_id: 'super-specialties',
    description: 'Respiratory diseases, bronchial asthma, chronic obstructive pulmonary disease (COPD), and lung infections',
    keywords: ['lungs', 'lung', 'chest', 'asthma', 'copd', 'cough', 'breathing', 'respiratory', 'bronchitis', 'pneumonia'],
  },
  {
    id: 'rheumatology',
    name: 'Rheumatology (Autoimmune & Joints)',
    category: 'Super Specialties',
    category_id: 'super-specialties',
    description: 'Systemic autoimmune and inflammatory musculoskeletal diseases including rheumatoid arthritis and lupus',
    keywords: ['rheumatoid', 'autoimmune', 'lupus', 'joint pain', 'arthritis', 'inflammation', 'uric acid', 'gout', 'sle'],
  },
  {
    id: 'hematology',
    name: 'Hematology (Blood Disorders)',
    category: 'Super Specialties',
    category_id: 'super-specialties',
    description: 'Disorders of blood, bone marrow, coagulation abnormalities, anemias, and hematological malignancies',
    keywords: ['blood', 'anemia', 'platelets', 'leukemia', 'bleeding', 'hemoglobin', 'thrombosis', 'lymphoma', 'rbc', 'wbc'],
  },

  // Emergency & Critical Care
  {
    id: 'emergency-medicine',
    name: 'Emergency Medicine (Casualty & Trauma)',
    category: 'Emergency & Critical Care',
    category_id: 'emergency-critical',
    description: 'Immediate clinical care and triage for acute trauma, cardiovascular emergencies, and life-threatening conditions',
    keywords: ['emergency', 'er', 'trauma', 'casualty', 'urgent', 'accident', 'acute', 'resuscitation', 'triage'],
  },
  {
    id: 'icu-critical-care',
    name: 'ICU / Critical Care',
    category: 'Emergency & Critical Care',
    category_id: 'emergency-critical',
    description: 'Intensive medical care, advanced mechanical ventilation, invasive monitoring, and organ support for critical patients',
    keywords: ['icu', 'intensive care', 'ventilator', 'critical', 'monitoring', 'life support', 'organ support', 'sepsis'],
  },
  {
    id: 'anesthesiology',
    name: 'Anesthesiology',
    category: 'Emergency & Critical Care',
    category_id: 'emergency-critical',
    description: 'Perioperative patient care, regional and general anesthesia administration, and acute/chronic pain management',
    keywords: ['anesthesia', 'sedation', 'pain management', 'perioperative', 'nerve block', 'analgesia', 'preop'],
  },

  // Allied & Diagnostic Departments
  {
    id: 'radiology',
    name: 'Radiology & Imaging (X-Ray, MRI, CT Scan)',
    category: 'Allied & Diagnostic Departments',
    category_id: 'allied-diagnostic',
    description: 'Diagnostic imaging modalities including digital radiography, computed tomography, MRI, and ultrasonography',
    keywords: ['radiology', 'imaging', 'x-ray', 'mri', 'ct scan', 'ultrasound', 'scan', 'sonography', 'xray'],
  },
  {
    id: 'pathology',
    name: 'Pathology & Laboratory (Blood Tests)',
    category: 'Allied & Diagnostic Departments',
    category_id: 'allied-diagnostic',
    description: 'Clinical laboratory testing, hematology panels, clinical biochemistry, microbiological assays, and histopathology',
    keywords: ['pathology', 'lab', 'laboratory', 'blood test', 'biopsy', 'diagnostics', 'urine test', 'culture', 'histology'],
  },
  {
    id: 'clinical-pharmacy',
    name: 'Clinical Pharmacy',
    category: 'Allied & Diagnostic Departments',
    category_id: 'allied-diagnostic',
    description: 'Medication dispensation, drug therapy management, pharmacokinetics, and clinical posology reviews',
    keywords: ['pharmacy', 'pharmacist', 'medication', 'drugs', 'dispensary', 'posology', 'formulation', 'pharmacotherapy'],
  },
  {
    id: 'physiotherapy',
    name: 'Physiotherapy & Rehabilitation',
    category: 'Allied & Diagnostic Departments',
    category_id: 'allied-diagnostic',
    description: 'Physical therapy, post-surgical rehabilitation, mobility restoration, and functional exercise therapy',
    keywords: ['physiotherapy', 'rehab', 'exercise', 'physical therapy', 'mobility', 'posture', 'stroke rehab', 'physio'],
  },
  {
    id: 'dentistry',
    name: 'Dentistry / Dental Surgery',
    category: 'Allied & Diagnostic Departments',
    category_id: 'allied-diagnostic',
    description: 'Oral healthcare, periodontal treatments, endodontics, dental restorations, and maxillofacial surgery',
    keywords: ['dental', 'dentist', 'teeth', 'tooth', 'oral', 'gums', 'cavity', 'root canal', 'dentistry', 'orthodontics'],
  },
  {
    id: 'dietetics-nutrition',
    name: 'Dietetics & Nutrition',
    category: 'Allied & Diagnostic Departments',
    category_id: 'allied-diagnostic',
    description: 'Clinical dietary assessment, therapeutic meal planning, metabolic nutrition counseling, and lifestyle management',
    keywords: ['diet', 'nutrition', 'dietitian', 'nutritionist', 'weight', 'food', 'lifestyle', 'calorie', 'therapeutic diet'],
  },
];

export default function DepartmentSelect({
  value = '',
  onChange,
  onClear,
  allowClear = true,
  placeholder = 'Search hospital department...',
  label = 'Department / Specialty',
  showLabel = true,
  disabled = false,
  required = false,
  className = '',
  compact = false,
  id = 'hospital-department-select',
}) {
  const [departments, setDepartments] = useState(DEPARTMENTS_DATA);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxRef = useRef(null);

  // Fetch from backend API to ensure sync with server definitions
  useEffect(() => {
    let mounted = true;
    departmentAPI
      .getAll()
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setDepartments(data);
        }
      })
      .catch(() => {
        // Fallback data is already loaded in state
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Current selected department object
  const selectedDept = useMemo(() => {
    if (!value) return null;
    const valStr = typeof value === 'object' ? value.name || value.id : String(value);
    const valLower = valStr.trim().toLowerCase();
    return (
      departments.find(
        (d) =>
          d.name.toLowerCase() === valLower ||
          d.id.toLowerCase() === valLower ||
          (d.aliases && d.aliases.some((a) => a.toLowerCase() === valLower))
      ) || null
    );
  }, [value, departments]);

  // Filtered departments based on search query
  const filteredDepartments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return departments;

    return departments.filter((dept) => {
      const name = dept.name.toLowerCase();
      const cat = dept.category.toLowerCase();
      const keywords = (dept.keywords || []).map((k) => k.toLowerCase());

      // Length-aware word boundary matching for short queries like "ear", "eye", "ent"
      if (q.length <= 3) {
        if (name.startsWith(q) || name.includes(` ${q}`) || name.includes(`(${q}`)) return true;
        if (keywords.some((k) => k === q || k.startsWith(q))) return true;
        return false;
      }

      if (name.includes(q)) return true;
      if (cat.includes(q)) return true;
      if (keywords.some((k) => k.includes(q))) return true;
      return false;
    });
  }, [departments, searchQuery]);

  // Group filtered departments by category
  const groupedDepartments = useMemo(() => {
    const map = new Map();
    CATEGORIES_ORDER.forEach((cat) => map.set(cat, []));

    filteredDepartments.forEach((dept) => {
      const cat = dept.category || 'Primary & General Care';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat).push(dept);
    });

    const result = [];
    map.forEach((items, category) => {
      if (items.length > 0) {
        result.push({ category, items });
      }
    });
    return result;
  }, [filteredDepartments]);

  // Flat list for keyboard navigation
  const flatFilteredList = useMemo(() => {
    return filteredDepartments;
  }, [filteredDepartments]);

  const handleSelect = (dept) => {
    if (onChange) {
      onChange(dept.name, dept);
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange('', null);
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < flatFilteredList.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : flatFilteredList.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatFilteredList[highlightedIndex]) {
        handleSelect(flatFilteredList[highlightedIndex]);
      }
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {showLabel && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Main trigger button */}
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between text-left transition-all ${
          compact ? 'px-2.5 py-1.5 text-xs rounded-md' : 'px-3.5 py-2.5 text-sm rounded-lg'
        } bg-white border ${
          isOpen
            ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
            : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer shadow-xs'}`}
      >
        <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
          <Stethoscope className="w-4 h-4 text-teal-600 flex-shrink-0" />
          {selectedDept ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-900 truncate">{selectedDept.name}</span>
              {!compact && (
                <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/60 font-medium">
                  {selectedDept.category}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {allowClear && selectedDept && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  handleClear(e);
                }
              }}
              title="Clear selection"
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-teal-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in-50 duration-150">
          {/* Search Box Header */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search hospital department (e.g. Heart, Bones, ER)..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-slate-800 placeholder-slate-400 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1 text-[11px] text-slate-500">
              <span>Showing 29 Accredited Clinical Specialties</span>
              <span>{filteredDepartments.length} matched</span>
            </div>
          </div>

          {/* Listbox */}
          <div
            ref={listboxRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1"
          >
            {groupedDepartments.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <Building2 className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-1" />
                <p className="text-sm font-medium text-slate-700">No hospital departments found</p>
                <p className="text-xs text-slate-400 mt-1">
                  No matching specialties found for &ldquo;{searchQuery}&rdquo;. Try another term.
                </p>
              </div>
            ) : (
              groupedDepartments.map((group) => (
                <div key={group.category} className="py-1">
                  {/* Category Header */}
                  <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50/60 rounded-md flex items-center justify-between my-0.5">
                    <span>{group.category}</span>
                    <span className="text-[10px] bg-teal-200/70 text-teal-900 px-1.5 py-0.2 rounded-full font-semibold">
                      {group.items.length}
                    </span>
                  </div>

                  {/* Department Items */}
                  <div className="space-y-0.5 mt-0.5">
                    {group.items.map((dept) => {
                      const isSelected = selectedDept && selectedDept.name === dept.name;
                      const flatIndex = flatFilteredList.findIndex((item) => item.id === dept.id);
                      const isHighlighted = flatIndex === highlightedIndex;

                      return (
                        <div
                          key={dept.id}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelect(dept)}
                          onMouseEnter={() => setHighlightedIndex(flatIndex)}
                          className={`flex items-start justify-between px-3 py-2 rounded-lg cursor-pointer text-xs sm:text-sm transition-colors ${
                            isSelected
                              ? 'bg-teal-50 text-teal-900 font-semibold'
                              : isHighlighted
                              ? 'bg-slate-100/80 text-slate-900'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex-1 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{dept.name}</span>
                            </div>
                            {dept.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal">
                                {dept.description}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
