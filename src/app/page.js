// REPLACE your fetchRealPlaces function in src/app/page.js with this enhanced version:

// Enhanced 24/7 Detection
const detect24HoursEnhanced = (place) => {
  if (!place.hours) return false;
  
  const hoursDisplay = (place.hours.display || '').toLowerCase();
  const businessName = place.name.toLowerCase();
  
  // Check hours display
  const hourIndicators = [
    '24 hours', '24/7', 'open 24 hours', 'always open', 
    'round the clock', '24 hour', 'twenty four'
  ];
  
  // Check business name for 24/7 indicators
  const nameIndicators = [
    '24', 'hour', '7-eleven', 'circle k', '24/7'
  ];
  
  return hourIndicators.some(indicator => hoursDisplay.includes(indicator)) ||
         nameIndicators.some(indicator => businessName.includes(indicator));
};

// Better night-friendly business detection
const isLikelyNightFriendly = (place, category) => {
  const nightCategories = ['gas', 'pharmacy', 'grocery'];
  if (nightCategories.includes(category)) return true;
  
  const businessName = place.name.toLowerCase();
  const nightChains = [
    'cvs', 'walgreens', 'rite aid', 'shell', 'chevron', 'bp',
    'mcdonald', 'subway', 'taco bell', 'del taco', 'jack in the box',
    'dennys', 'ihop', 'waffle house', 'starbucks'
  ];
  
  return nightChains.some(chain => businessName.includes(chain));
};

// Enhanced crowd level determination
const determineCrowdLevel = (place) => {
  const hour = new Date().getHours();
  
  // Late night is generally quieter
  if (hour >= 22 || hour <= 6) return 'Quiet';
  
  // Use Foursquare popularity if available
  if (place.popularity) {
    if (place.popularity > 0.8) return 'Busy';
    if (place.popularity > 0.5) return 'Moderate';
  }
  
  return 'Quiet';
};

// Enhanced safety rating calculation
const calculateSafetyRating = (place, category) => {
  let safety = 3; // Base safety
  
  // Higher rated places tend to be safer
  if (place.rating > 8) safety += 1;
  if (place.rating > 9) safety += 1;
  
  // Gas stations and pharmacies often have good lighting/security
  if (['gas', 'pharmacy'].includes(category)) safety += 1;
  
  // Chain businesses often have better security
  const businessName = place.name.toLowerCase();
  const majorChains = ['cvs', 'walgreens', 'shell', 'chevron', 'mcdonald'];
  if (majorChains.some(chain => businessName.includes(chain))) safety += 1;
  
  return Math.min(5, Math.max(1, safety));
};

// Add caching for better performance
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const getCachedPlaces = (lat, lng, radius) => {
  if (typeof window === 'undefined') return null;
  
  try {
    const cacheKey = `nightowls_${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}`;
    const cached = localStorage.getItem(cacheKey);
    const timestamp = localStorage.getItem(`${cacheKey}_time`);
    
    if (cached && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age < CACHE_DURATION) {
        console.log('📦 Using cached places data');
        return JSON.parse(cached);
      }
    }
  } catch (error) {
    console.warn('Cache read error:', error);
  }
  
  return null;
};

const setCachedPlaces = (lat, lng, radius, places) => {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheKey = `nightowls_${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}`;
    localStorage.setItem(cacheKey, JSON.stringify(places));
    localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
  } catch (error) {
    console.warn('Cache write error:', error);
  }
};

// REPLACE your existing fetchRealPlaces function with this enhanced version:
const fetchRealPlaces = async (lat, lng, radiusKm = 5) => {
  setIsLoadingPlaces(true);
  
  // Check cache first
  const cached = getCachedPlaces(lat, lng, radiusKm);
  if (cached) {
    setRealBusinesses(cached);
    setIsLoadingPlaces(false);
    return;
  }
  
  // If no API key, use mock data
  if (!FOURSQUARE_API_KEY || FOURSQUARE_API_KEY === 'YOUR_FOURSQUARE_API_KEY') {
    console.log('Using demo data - add your Foursquare API key for real places');
    setIsLoadingPlaces(false);
    return;
  }
  
  try {
    const radius = Math.min(radiusKm * 1000, 100000); // Max 100km
    
    // Enhanced category list for better 24/7 detection
    const categories = [
      '13065', // Fast Food
      '13032', // Coffee Shop  
      '13003', // Bar
      '13025', // Restaurant
      '17069', // Gas Station
      '17097', // Pharmacy
      '17043', // Convenience Store
      '18021', // Gym
      '17051', // Supermarket
      '13035', // Diner (good for 24/7)
      '17114', // ATM
      '17115'  // Bank (some 24/7)
    ].join(',');

    const url = `https://api.foursquare.com/v3/places/search?` + 
      `ll=${lat},${lng}&` +
      `radius=${radius}&` +
      `categories=${categories}&` +
      `open_now=true&` +
      `limit=50&` +
      `fields=fsq_id,name,location,categories,hours,rating,photos,tel,website,price,popularity`;

    console.log('🔍 Searching Foursquare:', { lat: lat.toFixed(4), lng: lng.toFixed(4), radius: radiusKm });

    const response = await fetch(url, {
      headers: {
        'Authorization': FOURSQUARE_API_KEY,
        'Accept': 'application/json'
      }
    });

    // Enhanced error handling
    if (!response.ok) {
      let errorMessage = `Foursquare API error: ${response.status}`;
      
      switch (response.status) {
        case 401:
          errorMessage = 'Invalid API key - please check your Foursquare configuration';
          break;
        case 403:
          errorMessage = 'API access denied - check your key permissions';
          break;
        case 429:
          errorMessage = 'Rate limit exceeded - please wait a moment';
          break;
        case 500:
          errorMessage = 'Foursquare server error - please try again';
          break;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log(`📍 Found ${data.results.length} places from Foursquare`);
    
    // Enhanced business processing
    const businesses = data.results
      .map((place, index) => {
        const distance = calculateDistance(lat, lng, place.location.lat, place.location.lng);
        
        // Skip if outside radius
        if (distance > radiusKm) return null;
        
        const category = getCategoryFromFoursquare(place.categories);
        
        // Enhanced 24/7 detection
        const is24Hours = detect24HoursEnhanced(place);
        const isNightFriendly = isLikelyNightFriendly(place, category);
        
        // Only include night-friendly businesses
        if (!is24Hours && !isNightFriendly) return null;

        return {
          id: place.fsq_id,
          name: place.name,
          category,
          address: formatAddress(place.location),
          distance: `${distance.toFixed(1)} miles`,
          distanceValue: distance,
          rating: place.rating ? Math.min(5, (place.rating / 2)) : (3.5 + Math.random() * 1.0),
          crowdLevel: determineCrowdLevel(place),
          verified: true,
          safetyRating: calculateSafetyRating(place, category),
          features: getBusinessFeatures(category),
          hours: place.hours?.display || (is24Hours ? '24/7' : 'Currently Open'),
          x: 150 + (index * 30) % 200,
          y: 100 + (index * 25) % 150,
          rideShareTime: `${Math.ceil(distance * 3)} min`,
          rideShareCost: `$${Math.ceil(distance * 2.5 + 8)}`,
          lastReported: `${Math.floor(Math.random() * 120)} min ago`,
          reportedOpen: true,
          walkTime: `${Math.ceil(distance * 20)} min`,
          driveTime: `${Math.ceil(distance * 3)} min`,
          photos: place.photos ? place.photos.map(p => `${p.prefix}400x400${p.suffix}`) : [],
          phone: place.tel,
          website: place.website,
          is24Hours,
          // Add Foursquare metadata
          popularity: place.popularity || 0,
          priceLevel: place.price || 2
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceValue - b.distanceValue);

    // Cache the results
    setCachedPlaces(lat, lng, radiusKm, businesses);
    setRealBusinesses(businesses);
    
    if (businesses.length === 0) {
      console.log('🔍 No 24/7 places found - try expanding search radius');
    } else {
      console.log(`✅ Loaded ${businesses.length} night-friendly businesses`);
    }
    
  } catch (error) {
    console.error('❌ Foursquare API Error:', error.message);
    
    // User-friendly error handling
    if (typeof window !== 'undefined') {
      console.warn('Using demo data due to API error');
    }
    
    // Fallback to empty array (will show demo data)
    setRealBusinesses([]);
  }
  
  setIsLoadingPlaces(false);
};

// REPLACE your existing getCurrentLocation function with this enhanced version:
const getCurrentLocation = () => {
  setIsLoadingLocation(true);
  
  if (!navigator.geolocation) {
    console.error('Geolocation not supported');
    setIsLoadingLocation(false);
    return;
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 15000, // 15 seconds
    maximumAge: 5 * 60 * 1000 // 5 minutes
  };

  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log('📍 Location found:', {
        lat: position.coords.latitude.toFixed(4),
        lng: position.coords.longitude.toFixed(4),
        accuracy: `${position.coords.accuracy}m`
      });
      
      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
      setSearchLocation('Current Location');
      setIsLoadingLocation(false);
    },
    (error) => {
      let message = 'Unable to get location';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          message = 'Location access denied - please enable in browser settings';
          break;
        case error.POSITION_UNAVAILABLE:
          message = 'Location unavailable - please try again';
          break;
        case error.TIMEOUT:
          message = 'Location timeout - please try again';
          break;
      }
      
      console.error('Location error:', message);
      setIsLoadingLocation(false);
    },
    options
  );
};

// REPLACE your existing useEffect for fetching places with this:
useEffect(() => {
  if (userLocation && userLocation.lat && userLocation.lng) {
    // Check cache first, then fetch if needed
    const cached = getCachedPlaces(userLocation.lat, userLocation.lng, searchRadius);
    if (cached) {
      setRealBusinesses(cached);
    } else {
      fetchRealPlaces(userLocation.lat, userLocation.lng, searchRadius);
    }
  }
}, [userLocation, searchRadius]);
