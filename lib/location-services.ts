// Location services for GlobalTrials
// Uses browser geolocation API and geocoding services

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationInfo {
  coordinates: Coordinates;
  address: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
}

export interface TrialLocation {
  facility: string;
  city: string;
  state?: string;
  country: string;
  coordinates?: Coordinates;
  distance?: number; // Distance from user in km
  status?: string;
}

/**
 * Get user's current location using browser API
 */
export async function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        let message = 'Unable to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // Cache location for 1 minute
      }
    );
  });
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRad(value: number): number {
  return value * Math.PI / 180;
}

/**
 * Geocode an address to coordinates using OpenStreetMap Nominatim
 * Free API with no key required
 */
export async function geocodeAddress(address: string): Promise<LocationInfo | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'GlobalTrials/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();
    
    if (data.length === 0) {
      return null;
    }

    const result = data[0];
    
    return {
      coordinates: {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      },
      address: result.display_name,
      city: result.address?.city || result.address?.town || result.address?.village || '',
      state: result.address?.state,
      country: result.address?.country || '',
      postalCode: result.address?.postcode
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(coordinates: Coordinates): Promise<LocationInfo | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?` +
      `format=json&lat=${coordinates.lat}&lon=${coordinates.lng}`,
      {
        headers: {
          'User-Agent': 'GlobalTrials/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();
    
    return {
      coordinates,
      address: data.display_name,
      city: data.address?.city || data.address?.town || data.address?.village || '',
      state: data.address?.state,
      country: data.address?.country || '',
      postalCode: data.address?.postcode
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Get coordinates for trial locations
 * Uses cached coordinates from database or geocodes new ones
 */
export async function getTrialLocationCoordinates(
  locations: TrialLocation[]
): Promise<TrialLocation[]> {
  const locationsWithCoords: TrialLocation[] = [];
  
  for (const location of locations) {
    // Skip if already has coordinates
    if (location.coordinates) {
      locationsWithCoords.push(location);
      continue;
    }
    
    // Check cache in database
    const cacheKey = `${location.city}, ${location.state || ''}, ${location.country}`.trim();
    
    const { data: cached } = await supabase
      .from('location_coordinates_cache')
      .select('lat, lng')
      .eq('location_key', cacheKey)
      .single();
    
    if (cached) {
      locationsWithCoords.push({
        ...location,
        coordinates: { lat: cached.lat, lng: cached.lng }
      });
      continue;
    }
    
    // Geocode the location
    const address = `${location.facility}, ${location.city}, ${location.state || ''}, ${location.country}`.trim();
    const locationInfo = await geocodeAddress(address);
    
    if (locationInfo) {
      // Cache the result
      await supabase
        .from('location_coordinates_cache')
        .upsert({
          location_key: cacheKey,
          lat: locationInfo.coordinates.lat,
          lng: locationInfo.coordinates.lng,
          full_address: locationInfo.address,
          created_at: new Date().toISOString()
        });
      
      locationsWithCoords.push({
        ...location,
        coordinates: locationInfo.coordinates
      });
    } else {
      // Try with just city and country
      const fallbackAddress = `${location.city}, ${location.country}`;
      const fallbackInfo = await geocodeAddress(fallbackAddress);
      
      if (fallbackInfo) {
        await supabase
          .from('location_coordinates_cache')
          .upsert({
            location_key: cacheKey,
            lat: fallbackInfo.coordinates.lat,
            lng: fallbackInfo.coordinates.lng,
            full_address: fallbackInfo.address,
            created_at: new Date().toISOString()
          });
        
        locationsWithCoords.push({
          ...location,
          coordinates: fallbackInfo.coordinates
        });
      } else {
        locationsWithCoords.push(location);
      }
    }
    
    // Rate limit to avoid overwhelming the geocoding service
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return locationsWithCoords;
}

/**
 * Sort locations by distance from user
 */
export function sortLocationsByDistance(
  locations: TrialLocation[],
  userCoordinates: Coordinates
): TrialLocation[] {
  return locations
    .map(location => {
      if (!location.coordinates) {
        return { ...location, distance: Infinity };
      }
      
      const distance = calculateDistance(userCoordinates, location.coordinates);
      return { ...location, distance };
    })
    .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
}

/**
 * Filter locations within a certain radius
 */
export function filterLocationsByRadius(
  locations: TrialLocation[],
  userCoordinates: Coordinates,
  radiusKm: number
): TrialLocation[] {
  return locations.filter(location => {
    if (!location.coordinates) return false;
    
    const distance = calculateDistance(userCoordinates, location.coordinates);
    return distance <= radiusKm;
  });
}

/**
 * Get country coordinates for mapping
 */
export const countryCoordinates: Record<string, Coordinates> = {
  // North America
  'United States': { lat: 39.8283, lng: -98.5795 },
  'Canada': { lat: 56.1304, lng: -106.3468 },
  'Mexico': { lat: 23.6345, lng: -102.5528 },
  
  // Europe
  'United Kingdom': { lat: 55.3781, lng: -3.4360 },
  'Germany': { lat: 51.1657, lng: 10.4515 },
  'France': { lat: 46.2276, lng: 2.2137 },
  'Italy': { lat: 41.8719, lng: 12.5674 },
  'Spain': { lat: 40.4637, lng: -3.7492 },
  'Netherlands': { lat: 52.1326, lng: 5.2913 },
  'Belgium': { lat: 50.5039, lng: 4.4699 },
  'Switzerland': { lat: 46.8182, lng: 8.2275 },
  'Austria': { lat: 47.5162, lng: 14.5501 },
  'Poland': { lat: 51.9194, lng: 19.1451 },
  'Sweden': { lat: 60.1282, lng: 18.6435 },
  'Norway': { lat: 60.4720, lng: 8.4689 },
  'Denmark': { lat: 56.2639, lng: 9.5018 },
  'Finland': { lat: 61.9241, lng: 25.7482 },
  'Ireland': { lat: 53.4129, lng: -8.2439 },
  'Portugal': { lat: 39.3999, lng: -8.2245 },
  'Greece': { lat: 39.0742, lng: 21.8243 },
  'Czech Republic': { lat: 49.8175, lng: 15.4730 },
  'Hungary': { lat: 47.1625, lng: 19.5033 },
  'Romania': { lat: 45.9432, lng: 24.9668 },
  'Bulgaria': { lat: 42.7339, lng: 25.4858 },
  
  // Asia
  'China': { lat: 35.8617, lng: 104.1954 },
  'Japan': { lat: 36.2048, lng: 138.2529 },
  'India': { lat: 20.5937, lng: 78.9629 },
  'South Korea': { lat: 35.9078, lng: 127.7669 },
  'Singapore': { lat: 1.3521, lng: 103.8198 },
  'Thailand': { lat: 15.8700, lng: 100.9925 },
  'Malaysia': { lat: 4.2105, lng: 101.9758 },
  'Philippines': { lat: 12.8797, lng: 121.7740 },
  'Indonesia': { lat: -0.7893, lng: 113.9213 },
  'Vietnam': { lat: 14.0583, lng: 108.2772 },
  'Israel': { lat: 31.0461, lng: 34.8516 },
  'Turkey': { lat: 38.9637, lng: 35.2433 },
  'Saudi Arabia': { lat: 23.8859, lng: 45.0792 },
  'United Arab Emirates': { lat: 23.4241, lng: 53.8478 },
  
  // Oceania
  'Australia': { lat: -25.2744, lng: 133.7751 },
  'New Zealand': { lat: -40.9006, lng: 174.8860 },
  
  // South America
  'Brazil': { lat: -14.2350, lng: -51.9253 },
  'Argentina': { lat: -38.4161, lng: -63.6167 },
  'Chile': { lat: -35.6751, lng: -71.5430 },
  'Colombia': { lat: 4.5709, lng: -74.2973 },
  'Peru': { lat: -9.1900, lng: -75.0152 },
  'Venezuela': { lat: 6.4238, lng: -66.5897 },
  'Ecuador': { lat: -1.8312, lng: -78.1834 },
  
  // Africa
  'South Africa': { lat: -30.5595, lng: 22.9375 },
  'Egypt': { lat: 26.8206, lng: 30.8025 },
  'Nigeria': { lat: 9.0820, lng: 8.6753 },
  'Kenya': { lat: -0.0236, lng: 37.9062 },
  'Morocco': { lat: 31.7917, lng: -7.0926 },
  'Ghana': { lat: 7.9465, lng: -1.0232 },
  'Ethiopia': { lat: 9.1450, lng: 40.4897 },
  'Tanzania': { lat: -6.3690, lng: 34.8888 },
  'Uganda': { lat: 1.3733, lng: 32.2903 }
};

/**
 * Get state/province coordinates for major countries
 */
export const stateCoordinates: Record<string, Record<string, Coordinates>> = {
  'United States': {
    'Alabama': { lat: 32.3182, lng: -86.9023 },
    'Alaska': { lat: 64.2008, lng: -149.4937 },
    'Arizona': { lat: 34.0489, lng: -111.0937 },
    'Arkansas': { lat: 35.2010, lng: -91.8318 },
    'California': { lat: 36.7783, lng: -119.4179 },
    'Colorado': { lat: 39.5501, lng: -105.7821 },
    'Connecticut': { lat: 41.6032, lng: -73.0877 },
    'Delaware': { lat: 38.9108, lng: -75.5277 },
    'Florida': { lat: 27.6648, lng: -81.5158 },
    'Georgia': { lat: 32.1656, lng: -82.9001 },
    'Hawaii': { lat: 19.8968, lng: -155.5828 },
    'Idaho': { lat: 44.0682, lng: -114.7420 },
    'Illinois': { lat: 40.6331, lng: -89.3985 },
    'Indiana': { lat: 40.2672, lng: -86.1349 },
    'Iowa': { lat: 41.8780, lng: -93.0977 },
    'Kansas': { lat: 39.0119, lng: -98.4842 },
    'Kentucky': { lat: 37.8393, lng: -84.2700 },
    'Louisiana': { lat: 30.9843, lng: -91.9623 },
    'Maine': { lat: 45.2538, lng: -69.4455 },
    'Maryland': { lat: 39.0458, lng: -76.6413 },
    'Massachusetts': { lat: 42.4072, lng: -71.3824 },
    'Michigan': { lat: 44.3148, lng: -85.6024 },
    'Minnesota': { lat: 46.7296, lng: -94.6859 },
    'Mississippi': { lat: 32.3547, lng: -89.3985 },
    'Missouri': { lat: 37.9643, lng: -91.8318 },
    'Montana': { lat: 46.8797, lng: -110.3626 },
    'Nebraska': { lat: 41.4925, lng: -99.9018 },
    'Nevada': { lat: 38.8026, lng: -116.4194 },
    'New Hampshire': { lat: 43.1939, lng: -71.5724 },
    'New Jersey': { lat: 40.0583, lng: -74.4057 },
    'New Mexico': { lat: 34.5199, lng: -105.8701 },
    'New York': { lat: 43.2994, lng: -74.2179 },
    'North Carolina': { lat: 35.7596, lng: -79.0193 },
    'North Dakota': { lat: 47.5515, lng: -101.0020 },
    'Ohio': { lat: 40.4173, lng: -82.9071 },
    'Oklahoma': { lat: 35.0078, lng: -97.0929 },
    'Oregon': { lat: 43.8041, lng: -120.5542 },
    'Pennsylvania': { lat: 41.2033, lng: -77.1945 },
    'Rhode Island': { lat: 41.5801, lng: -71.4774 },
    'South Carolina': { lat: 33.8361, lng: -81.1637 },
    'South Dakota': { lat: 43.9695, lng: -99.9018 },
    'Tennessee': { lat: 35.5175, lng: -86.5804 },
    'Texas': { lat: 31.9686, lng: -99.9018 },
    'Utah': { lat: 39.3210, lng: -111.0937 },
    'Vermont': { lat: 44.5588, lng: -72.5778 },
    'Virginia': { lat: 37.4316, lng: -78.6569 },
    'Washington': { lat: 47.7511, lng: -120.7401 },
    'West Virginia': { lat: 38.5976, lng: -80.4549 },
    'Wisconsin': { lat: 43.7844, lng: -88.7879 },
    'Wyoming': { lat: 43.0760, lng: -107.2903 }
  }
};

/**
 * Create location cache table in database
 */
export const createLocationCacheTable = `
CREATE TABLE IF NOT EXISTS location_coordinates_cache (
  location_key TEXT PRIMARY KEY,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  full_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_location_cache_created ON location_coordinates_cache(created_at);
`;