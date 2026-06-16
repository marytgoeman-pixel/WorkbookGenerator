// Approximate location of a request, from the CDN/edge geo headers (Vercel sets these).
// Returns "City, REGION, COUNTRY" (omitting any missing part), or '' when unavailable
// (e.g. local dev). City values are percent-encoded by the platform, so decode them.
export function geoFromHeaders(headers: Headers): string {
  const dec = (v: string | null) => {
    if (!v) return '';
    try { return decodeURIComponent(v); } catch { return v; }
  };
  const city = dec(headers.get('x-vercel-ip-city'));
  const region = headers.get('x-vercel-ip-country-region') || '';
  const country = headers.get('x-vercel-ip-country') || '';
  return [city, region, country].filter(Boolean).join(', ');
}
