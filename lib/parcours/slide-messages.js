function isTocItem(item) {
  const valid = item !== null && typeof item === 'object' &&
    typeof item.id === 'string' && item.id.length > 0 &&
    typeof item.label === 'string' && item.label.length > 0;
  if (!valid) { console.warn('slide:toc - item invalide (id et label requis)', item); }
  return valid;
}

/** Valide les données non fiables sans modifier le message de l'iframe. */
export function normalizeToc(items) {
  if (!Array.isArray(items)) {
    console.warn('slide:toc - items doit être un tableau');
    return null;
  }
  return items.slice(0, 15).filter(isTocItem).map(item => ({
    id: item.id,
    label: item.label,
    icon: typeof item.icon === 'string' ? item.icon : undefined,
    level: Number.isFinite(item.level) ? Math.min(2, Math.max(1, Math.trunc(item.level))) : 1,
  }));
}
