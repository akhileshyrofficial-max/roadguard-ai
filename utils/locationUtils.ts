import type { Location } from '../types';

// Promise-based wrapper for Geolocation API for robust error handling
export const requestLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Geolocation is not supported by your browser."));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error("Location permission denied. Please enable location services in your browser settings to use this feature."));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error("Location information is currently unavailable. Please check your GPS signal."));
            break;
          case error.TIMEOUT:
            reject(new Error("The request to get your location timed out. Please try again."));
            break;
          default:
            reject(new Error("An unknown error occurred while trying to get your location."));
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
};
