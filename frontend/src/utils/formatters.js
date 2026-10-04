/**
 * Clinical formatters and sig code translations
 */

export const formatSigCode = (sig) => {
  if (!sig) return 'As directed';
  const s = sig.toLowerCase().trim();
  const sigMap = {
    'qd': 'Once daily',
    'q.d.': 'Once daily',
    'daily': 'Once daily',
    'bid': 'Twice daily (every 12 hours)',
    'b.i.d.': 'Twice daily (every 12 hours)',
    'tid': 'Three times daily (every 8 hours)',
    't.i.d.': 'Three times daily (every 8 hours)',
    'qid': 'Four times daily (every 6 hours)',
    'q.i.d.': 'Four times daily (every 6 hours)',
    'qhs': 'At bedtime',
    'q.h.s.': 'At bedtime',
    'hs': 'At bedtime',
    'prn': 'As needed for symptoms',
    'p.r.n.': 'As needed for symptoms',
    'stat': 'Immediately / single dose',
    'po': 'Oral',
    'p.o.': 'Oral'
  };

  return sigMap[s] || sig;
};

export const formatConfidence = (score) => {
  if (score === undefined || score === null) return 'N/A';
  return `${Math.round(score * 100)}%`;
};

export const formatBSA = (val) => {
  if (!val) return 'N/A';
  return `${parseFloat(val).toFixed(2)} m²`;
};

export const formatBMI = (val) => {
  if (!val) return 'N/A';
  const num = parseFloat(val);
  let category = 'Normal';
  if (num < 18.5) category = 'Underweight';
  else if (num >= 25 && num < 30) category = 'Overweight';
  else if (num >= 30) category = 'Obese';
  return `${num.toFixed(1)} kg/m² (${category})`;
};
