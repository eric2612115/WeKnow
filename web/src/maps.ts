// Maps links with no API key and no account. Only the kind of pro goes into the search ("plumber near me"), never a
// name, an address or anything from the paper. Apple devices get Apple Maps; everyone else gets Google Maps.

const PRO: Record<string, string> = {
  plumbing: 'plumber',
  electrical: 'electrician',
  appliance: 'appliance repair',
  'car-service': 'auto repair shop',
  'car-body': 'auto body shop',
  device: 'phone and computer repair',
  cleaning: 'cleaning service',
  home: 'handyman',
};

export function proKind(category: string | undefined): string {
  return PRO[category ?? ''] ?? 'handyman';
}

const apple = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

export function mapsSearchUrl(query: string, isApple = apple()): string {
  const q = encodeURIComponent(query.slice(0, 80));
  return isApple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** "Find a pro nearby": the job category only; the maps app uses its own idea of where the person is. */
export function proNearbyUrl(category: string | undefined, isApple = apple()): string {
  return mapsSearchUrl(`${proKind(category)} near me`, isApple);
}
