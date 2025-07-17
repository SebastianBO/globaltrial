'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { TrialLocation, Coordinates } from '@/lib/location-services';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';

// Note: You'll need to set up a Google Maps API key in your environment variables
// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

interface TrialMapProps {
  locations: TrialLocation[];
  userLocation?: Coordinates;
  selectedLocation?: TrialLocation;
  onLocationSelect?: (location: TrialLocation) => void;
  height?: string;
  showControls?: boolean;
  showFullscreenButton?: boolean;
}

export default function TrialMap({
  locations,
  userLocation,
  selectedLocation,
  onLocationSelect,
  height = '400px',
  showControls = true,
  showFullscreenButton = true
}: TrialMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [userMarker, setUserMarker] = useState<google.maps.Marker | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<google.maps.Marker | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key not configured. Map functionality will be limited.');
      return;
    }

    const loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places']
    });

    loader.load().then(() => {
      const mapInstance = new google.maps.Map(mapRef.current!, {
        center: userLocation || { lat: 39.8283, lng: -98.5795 }, // Center on USA if no user location
        zoom: userLocation ? 10 : 4,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      setMap(mapInstance);

      // Create info window
      infoWindowRef.current = new google.maps.InfoWindow();
    });

    return () => {
      // Cleanup
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
    };
  }, [userLocation]);

  // Add location markers
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));

    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();

    // Add trial location markers
    locations.forEach((location, index) => {
      if (!location.coordinates) return;

      const marker = new google.maps.Marker({
        position: location.coordinates,
        map: map,
        title: location.facility,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="8" fill="${location.status === 'RECRUITING' ? '#10b981' : '#6b7280'}" stroke="white" stroke-width="2"/>
              <path d="M20 28 L12 36 L20 32 L28 36 Z" fill="${location.status === 'RECRUITING' ? '#10b981' : '#6b7280'}"/>
              <text x="20" y="24" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${index + 1}</text>
            </svg>
          `),
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 40)
        },
        animation: google.maps.Animation.DROP
      });

      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(`
            <div style="padding: 10px; max-width: 250px;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                ${location.facility}
              </h3>
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">
                ${location.city}${location.state ? `, ${location.state}` : ''}, ${location.country}
              </p>
              ${location.distance ? `
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
                  ${location.distance.toFixed(1)} km away
                </p>
              ` : ''}
              <p style="margin: 0; font-size: 14px;">
                Status: <span style="color: ${location.status === 'RECRUITING' ? '#10b981' : '#6b7280'}; font-weight: 500;">
                  ${location.status || 'Unknown'}
                </span>
              </p>
            </div>
          `);
          infoWindowRef.current.open(map, marker);
        }

        setSelectedMarker(marker);
        if (onLocationSelect) {
          onLocationSelect(location);
        }
      });

      newMarkers.push(marker);
      bounds.extend(location.coordinates);
    });

    setMarkers(newMarkers);

    // Add user location marker if available
    if (userLocation) {
      const userMarkerInstance = new google.maps.Marker({
        position: userLocation,
        map: map,
        title: 'Your Location',
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="10" fill="#3b82f6" stroke="white" stroke-width="3" opacity="0.8"/>
              <circle cx="20" cy="20" r="4" fill="white"/>
              <circle cx="20" cy="20" r="18" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.3"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 20)
        },
        zIndex: 1000
      });

      setUserMarker(userMarkerInstance);
      bounds.extend(userLocation);
    }

    // Fit map to show all markers
    if (locations.length > 0) {
      map.fitBounds(bounds);
      
      // Don't zoom in too much for single location
      const listener = google.maps.event.addListener(map, 'idle', () => {
        if (map.getZoom()! > 15) map.setZoom(15);
        google.maps.event.removeListener(listener);
      });
    }

  }, [map, locations, userLocation, onLocationSelect]);

  // Handle selected location change
  useEffect(() => {
    if (!map || !selectedLocation || !selectedLocation.coordinates) return;

    // Find the corresponding marker
    const markerIndex = locations.findIndex(loc => 
      loc.facility === selectedLocation.facility && 
      loc.city === selectedLocation.city
    );

    if (markerIndex >= 0 && markers[markerIndex]) {
      const marker = markers[markerIndex];
      
      // Center map on selected location
      map.panTo(selectedLocation.coordinates);
      map.setZoom(12);

      // Trigger marker click to show info window
      google.maps.event.trigger(marker, 'click');
    }
  }, [map, selectedLocation, locations, markers]);

  // Map controls
  const handleZoomIn = () => {
    if (map) {
      map.setZoom(map.getZoom()! + 1);
    }
  };

  const handleZoomOut = () => {
    if (map) {
      map.setZoom(map.getZoom()! - 1);
    }
  };

  const handleCenterOnUser = () => {
    if (map && userLocation) {
      map.panTo(userLocation);
      map.setZoom(12);
    }
  };

  const handleFitAll = () => {
    if (map && markers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      
      markers.forEach(marker => {
        bounds.extend(marker.getPosition()!);
      });
      
      if (userMarker) {
        bounds.extend(userMarker.getPosition()!);
      }
      
      map.fitBounds(bounds);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
        <div 
          className="w-full rounded-lg bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300"
          style={{ height: isFullscreen ? '100vh' : height }}
        >
          <div className="text-center p-8">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Map View Unavailable</h3>
            <p className="text-gray-500 text-sm">
              Google Maps API key not configured.<br />
              Showing {locations.filter(l => l.coordinates).length} locations in list format.
            </p>
            <div className="mt-4 space-y-2 text-sm text-left">
              {locations.slice(0, 5).map((location, index) => (
                <div key={index} className="p-2 bg-white rounded border">
                  <div className="font-medium">{location.facility}</div>
                  <div className="text-gray-600">
                    {location.city}{location.state ? `, ${location.state}` : ''}, {location.country}
                  </div>
                  {location.distance && (
                    <div className="text-blue-600 text-xs">
                      {location.distance.toFixed(1)} km away
                    </div>
                  )}
                </div>
              ))}
              {locations.length > 5 && (
                <div className="text-center text-gray-500">
                  +{locations.length - 5} more locations
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      <div 
        ref={mapRef} 
        className="w-full rounded-lg"
        style={{ height: isFullscreen ? '100vh' : height }}
      />
      
      {/* Map Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <Card className="p-1">
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleZoomIn}
                className="h-8 w-8 p-0"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleZoomOut}
                className="h-8 w-8 p-0"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>
          </Card>
          
          {userLocation && (
            <Card className="p-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCenterOnUser}
                className="h-8 w-8 p-0"
                title="Center on your location"
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </Card>
          )}
          
          <Card className="p-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleFitAll}
              className="h-8 w-8 p-0"
              title="Fit all locations"
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </Card>
          
          {showFullscreenButton && (
            <Card className="p-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleFullscreen}
                className="h-8 w-8 p-0"
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </Card>
          )}
        </div>
      )}
      
      {/* Location count */}
      <div className="absolute bottom-4 left-4">
        <Card className="px-3 py-1.5 bg-white/90 backdrop-blur-sm">
          <p className="text-sm font-medium">
            {locations.filter(l => l.coordinates).length} locations shown
          </p>
        </Card>
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4">
        <Card className="p-3 bg-white/90 backdrop-blur-sm">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span>Recruiting</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full" />
              <span>Not recruiting</span>
            </div>
            {userLocation && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span>Your location</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}