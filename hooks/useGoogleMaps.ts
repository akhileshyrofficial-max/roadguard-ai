import { useState, useEffect } from 'react';

const API_KEY = process.env.API_KEY;
const SCRIPT_ID = 'google-maps-script';
const CALLBACK_NAME = 'initGoogleMapsCallback'; // Unique callback name

// Create a truly global state object to persist across hot-reloads and component instances.
// This prevents multiple script loads and ensures all components share the same status.
const globalState = ((window as any).__googleMapsApiState = (window as any).__googleMapsApiState || {
    status: 'idle', // 'idle' | 'loading' | 'loaded' | 'error'
    error: null as string | null,
    subscribers: [] as ((status: string, error: string | null) => void)[],
});

const notifySubscribers = () => {
    globalState.subscribers.forEach((callback) => callback(globalState.status, globalState.error));
};

export const useGoogleMaps = () => {
    const [isLoaded, setIsLoaded] = useState(globalState.status === 'loaded');
    const [error, setError] = useState<string | null>(globalState.error);

    useEffect(() => {
        // This function will be called by our subscriber system
        const handleStateChange = (status: string, err: string | null) => {
            setIsLoaded(status === 'loaded');
            setError(err);
        };

        // If the script is already loaded or has failed, set the state immediately.
        if (globalState.status === 'loaded' || globalState.status === 'error') {
            handleStateChange(globalState.status, globalState.error);
            return;
        }
        
        // Subscribe this component instance to future state changes.
        globalState.subscribers.push(handleStateChange);

        // Trigger the script loading process only if it's the very first time.
        if (globalState.status === 'idle') {
            globalState.status = 'loading';

            if (!API_KEY) {
                globalState.error = 'Google Maps API key is not configured. Please ensure the API_KEY environment variable is set.';
                globalState.status = 'error';
                notifySubscribers();
                return;
            }
            
            // Add a timeout to catch silent failures (e.g., bad API key)
            const loadingTimeout = setTimeout(() => {
                if (globalState.status === 'loading') {
                    globalState.error = 'Google Maps script timed out. This is often due to an invalid API Key, network issues, or restrictive API key settings. Please check the browser console for more details from Google.';
                    globalState.status = 'error';
                    
                    const scriptTag = document.getElementById(SCRIPT_ID);
                    if (scriptTag) scriptTag.remove();
                    if ((window as any)[CALLBACK_NAME]) delete (window as any)[CALLBACK_NAME];
                    
                    notifySubscribers();
                }
            }, 10000); // 10-second timeout

            // The callback function that Google Maps script will call upon successful load.
            (window as any)[CALLBACK_NAME] = () => {
                clearTimeout(loadingTimeout);
                globalState.status = 'loaded';
                globalState.error = null;
                notifySubscribers();
                // Clean up the global callback function
                delete (window as any)[CALLBACK_NAME];
            };
            
            const script = document.createElement('script');
            script.id = SCRIPT_ID;
            script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=${CALLBACK_NAME}`;
            script.async = true;
            script.defer = true;
            
            script.onerror = () => {
                clearTimeout(loadingTimeout);
                globalState.error = 'Failed to load Google Maps script. Check your API_KEY, network connection, and ensure the Google Maps JavaScript API is enabled in your Google Cloud console.';
                globalState.status = 'error';
                
                // Clean up the failed script and callback
                const scriptTag = document.getElementById(SCRIPT_ID);
                if (scriptTag) scriptTag.remove();
                if ((window as any)[CALLBACK_NAME]) delete (window as any)[CALLBACK_NAME];
                
                notifySubscribers();
            };

            document.body.appendChild(script);
        }

        // Cleanup function for when the component unmounts
        return () => {
            const index = globalState.subscribers.indexOf(handleStateChange);
            if (index > -1) {
                globalState.subscribers.splice(index, 1);
            }
        };
    }, []);

    return { isLoaded, error };
};
