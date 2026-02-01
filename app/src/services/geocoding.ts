// Cache for geocoding results
const geocodeCache = new Map<string, string>();

/**
 * Reverse geocode GPS coordinates to location name
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 * Rate limited: 1 request per second
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  // Round to ~1km precision to reduce API calls and improve caching
  const roundedLat = Math.round(latitude * 100) / 100;
  const roundedLon = Math.round(longitude * 100) / 100;
  const cacheKey = `${roundedLat},${roundedLon}`;

  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) || null;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&accept-language=ko`,
      {
        headers: {
          'User-Agent': 'Platypus Photo App',
        },
      }
    );

    if (!response.ok) {
      console.warn('Geocoding request failed:', response.status);
      return null;
    }

    const data = await response.json();
    const address = data.address;

    if (!address) {
      return null;
    }

    let location: string | null = null;

    // For Korea: Extract city + district
    if (address.country === '대한민국' || address.country === 'South Korea') {
      const parts: string[] = [];
      if (address.city || address.state) {
        parts.push(address.city || address.state);
      }
      if (address.borough || address.suburb || address.district || address.county) {
        parts.push(address.borough || address.suburb || address.district || address.county);
      }
      location = parts.length > 0 ? parts.join(', ') : null;
    } else {
      // For other countries: city + country
      const parts: string[] = [];
      if (address.city || address.town || address.village) {
        parts.push(address.city || address.town || address.village);
      }
      if (address.country) {
        parts.push(address.country);
      }
      location = parts.length > 0 ? parts.join(', ') : null;
    }

    // Cache the result
    if (location) {
      geocodeCache.set(cacheKey, location);
    }

    return location;
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return null;
  }
}

/**
 * Batch reverse geocode with rate limiting (1 request per second)
 */
export async function batchReverseGeocode(
  coordinates: Array<{ latitude: number; longitude: number; id: string }>
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  for (let i = 0; i < coordinates.length; i++) {
    const { latitude, longitude, id } = coordinates[i];

    // Check if already cached
    const roundedLat = Math.round(latitude * 100) / 100;
    const roundedLon = Math.round(longitude * 100) / 100;
    const cacheKey = `${roundedLat},${roundedLon}`;
    const wasCached = geocodeCache.has(cacheKey);

    const location = await reverseGeocode(latitude, longitude);
    results.set(id, location);

    // Rate limit: wait 1.1 seconds between non-cached requests
    if (i < coordinates.length - 1 && !wasCached) {
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }

  return results;
}
