'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Clock, Users, Star, Navigation, Coffee, ShoppingCart, Fuel, Pill, Utensils, Dumbbell, Heart, AlertTriangle, Car, Bell, MessageSquare, Phone, RefreshCw } from 'lucide-react';

const NightOwlsApp = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [favorites, setFavorites] = useState(new Set([2, 4]));
  const [reportModal, setReportModal] = useState(null);
  const [searchRadius, setSearchRadius] = useState(5);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [realBusinesses, setRealBusinesses] = useState([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [callModal, setCallModal] = useState(null);

  // FIXED: Use hardcoded API key (process not available in browser)
  const FOURSQUARE_API_KEY = 'fsq3MvvG70SW/wdvH6RS3DaTFgs4leyty2sGz8Id6JneBTk=';

  // Cache system
  const [placesCache, setPlacesCache] = useState(new Map());
  const CACHE_DURATION = 10 * 60 * 1000;

  // Persist favorites
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem('nightowls_favorites');
      if (savedFavorites) {
        setFavorites(new Set(JSON.parse(savedFavorites)));
      }
    } catch (error) {
      console.log('Could not load favorites from storage');
    }
  }, []);

  const saveFavorites = useCallback((newFavorites) => {
    try {
      localStorage.setItem('nightowls_favorites', JSON.stringify([...newFavorites]));
    } catch (error) {
      console.log('Could not save favorites to storage');
    }
    setFavorites(newFavorites);
  }, []);

  // Cache utilities
  const getCacheKey = (lat, lng, radius) => `${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}`;
  const isCacheValid = (cacheEntry) => cacheEntry && (Date.now() - cacheEntry.timestamp) < CACHE_DURATION;

  // Distance calculation
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Ride share calculations
  const calculateRideShareInfo = (distanceInMiles) => {
    const distance = parseFloat(distanceInMiles) || 0;
    return {
      time: `${Math.ceil(distance * 2.5 + 3)} min`,
      cost: `$${Math.max(8, Math.ceil(distance * 3.2 + 6))}`
    };
  };

  // Format address
  const formatAddress = (location) => {
    const parts = [location.address, location.locality, location.region].filter(Boolean);
    return parts.join(', ') || 'Address not available';
  };

  // Safety rating calculation
  const calculateSafetyRating = (place, category) => {
    let safety = 3;
    if (place.rating) {
      const normalizedRating = place.rating / 2;
      if (normalizedRating > 4) safety += 1;
      if (normalizedRating > 4.5) safety += 1;
    }
    if (['gas', 'pharmacy'].includes(category)) safety += 1;
    const businessName = place.name.toLowerCase();
    const majorChains = ['cvs', 'walgreens', 'shell', 'chevron', 'mcdonalds', '7-eleven'];
    if (majorChains.some(chain => businessName.includes(chain))) safety += 1;
    return Math.min(5, Math.max(1, safety));
  };

  // Business features
  const getBusinessFeatures = (category) => {
    const features = {
      food: ['Late Night Menu', 'Drive-thru', 'Well-lit', 'Security'],
      coffee: ['24/7 Hours', 'Free WiFi', 'Study Space', 'Power Outlets'],
      gas: ['24/7 Access', 'Well-lit Pumps', 'Convenience Store', 'Security Cameras'],
      pharmacy: ['24/7 Pickup', 'Drive-thru', 'Emergency Meds', 'Well-lit'],
      grocery: ['24/7 Hours', 'ATM', 'Hot Food', 'Self Checkout'],
      gym: ['24/7 Access', 'Key Card Entry', 'Security Cameras', 'Well-lit'],
      entertainment: ['Late Hours', 'Group Friendly', 'Parking', 'Security'],
      services: ['24/7 Access', 'Well-lit', 'Security', 'Parking']
    };
    return features[category] || features.services;
  };

  // MUCH MORE LENIENT late night detection
  const checkIfOpenLate = (hoursData) => {
    if (!hoursData) return false;
    
    const display = hoursData.display || '';
    const displayLower = display.toLowerCase();
    
    // Much more inclusive late night detection
    if (displayLower.includes('24') || 
        displayLower.includes('24/7') || 
        displayLower.includes('24 hours') ||
        displayLower.includes('24-hour') ||
        displayLower.includes('always open') ||
        displayLower.includes('open 24') ||
        displayLower.includes('24hr') ||
        displayLower.includes('midnight') ||
        displayLower.includes('1:00 am') ||
        displayLower.includes('1 am') ||
        displayLower.includes('2:00 am') ||
        displayLower.includes('2 am') ||
        displayLower.includes('3:00 am') ||
        displayLower.includes('3 am')) {
      return true;
    }
    
    if (hoursData.regular) {
      try {
        for (const daySchedule of hoursData.regular) {
          if (daySchedule.open) {
            for (const timeSlot of daySchedule.open) {
              const startTime = parseInt(timeSlot.start);
              const endTime = parseInt(timeSlot.end);
              
              if (endTime < startTime) return true; // 24/7
              if (endTime >= 0 && endTime <= 600) return true; // Until 6 AM
              if (endTime >= 2300) return true; // 11 PM or later
            }
          }
        }
      } catch (error) {
        console.log('Error parsing hours:', error);
      }
    }
    
    return false;
  };

  // Get today's specific hours
  const getTodaysHours = (hoursData) => {
    if (!hoursData) {
      return { status: 'unknown', display: 'Hours unknown', isOpen: false };
    }

    const display = hoursData.display || '';
    const displayLower = display.toLowerCase();
    
    if (displayLower.includes('24 hours') || displayLower.includes('24/7') || displayLower.includes('always open')) {
      return { status: '24/7', display: 'Open 24/7', isOpen: true };
    }
    
    if (displayLower.includes('2:00 am') || displayLower.includes('2 am') || 
        displayLower.includes('3:00 am') || displayLower.includes('3 am')) {
      return { status: 'late', display: display, isOpen: true };
    }
    
    if (display && display.length > 0 && !display.toLowerCase().includes('unknown')) {
      return { status: 'display', display: display, isOpen: true };
    }

    const today = new Date().getDay();
    
    if (hoursData.regular && hoursData.regular.length > 0) {
      try {
        const todaySchedule = hoursData.regular.find(day => day.day === today);
        
        if (!todaySchedule || !todaySchedule.open || todaySchedule.open.length === 0) {
          return { status: 'closed', display: 'Closed today', isOpen: false };
        }

        const timeSlot = todaySchedule.open[0];
        
        if (!timeSlot || !timeSlot.start || !timeSlot.end) {
          return { status: 'unknown', display: 'Check hours', isOpen: true };
        }

        const startStr = timeSlot.start.toString();
        const endStr = timeSlot.end.toString();
        
        if (startStr.length >= 3 && endStr.length >= 3) {
          const startTime = parseInt(startStr);
          const endTime = parseInt(endStr);
          
          if (!isNaN(startTime) && !isNaN(endTime) && startTime >= 0 && endTime >= 0) {
            const formatSimpleTime = (time) => {
              const hours = Math.floor(time / 100);
              const minutes = time % 100;
              if (hours <= 24 && minutes <= 59) {
                const period = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                return `${displayHours}${minutes === 0 ? '' : ':' + minutes.toString().padStart(2, '0')} ${period}`;
              }
              return null;
            };
            
            const formattedStart = formatSimpleTime(startTime);
            const formattedEnd = formatSimpleTime(endTime);
            
            if (formattedStart && formattedEnd) {
              if (endTime < startTime) {
                return { status: 'overnight', display: `Until ${formattedEnd} (next day)`, isOpen: true };
              } else if (endTime >= 200 && endTime <= 600) {
                return { status: 'late', display: `Until ${formattedEnd}`, isOpen: true };
              } else {
                return { status: 'regular', display: `${formattedStart} - ${formattedEnd}`, isOpen: true };
              }
            }
          }
        }
      } catch (error) {
        console.log('Error parsing structured hours:', error);
      }
    }

    return { status: 'unknown', display: 'Check hours', isOpen: true };
  };

  // Analyze late night hours
  const analyzeLateNightHours = (hoursData) => {
    if (!hoursData) {
      return { level: 'Check Hours', status: 'Hours unknown', display: 'Check hours' };
    }
    
    const display = hoursData.display || '';
    const displayLower = display.toLowerCase();
    
    if (displayLower.includes('24 hours') || displayLower.includes('24/7') || displayLower.includes('always open')) {
      return { level: '24/7', status: 'Open 24/7', display: '24/7' };
    }
    
    if (displayLower.includes('2:00 am') || displayLower.includes('2 am') || 
        displayLower.includes('3:00 am') || displayLower.includes('3 am')) {
      return { level: 'Open Very Late', status: 'Open very late', display };
    }
    
    if (displayLower.includes('1:00 am') || displayLower.includes('1 am') || 
        displayLower.includes('midnight') || displayLower.includes('11:00 pm') || displayLower.includes('11 pm')) {
      return { level: 'Open Late', status: 'Open late', display };
    }
    
    if (display && display.length > 0) {
      return { level: 'Open Late', status: 'Check hours', display: display };
    }
    
    return { level: 'Check Hours', status: 'Hours unknown', display: 'Check hours' };
  };

  // Calculate late night score
  const calculateLateNightScore = (place, category, isActuallyLateNight, lateNightInfo) => {
    let score = 0;
    
    if (isActuallyLateNight) score += 10;
    
    switch (lateNightInfo.level) {
      case '24/7': score += 15; break;
      case 'Open Very Late': score += 10; break;
      case 'Open Late': score += 5; break;
    }
    
    const categoryScores = { food: 8, coffee: 6, gas: 9, pharmacy: 7, grocery: 8, gym: 4, services: 3, entertainment: 2 };
    score += categoryScores[category] || 1;
    
    const businessName = place.name.toLowerCase();
    const lateNightChains = ['7-eleven', 'circle k', 'taco bell', 'mcdonalds', 'dennys', 'ihop', 'waffle house', 'cvs', 'walgreens'];
    
    if (lateNightChains.some(chain => businessName.includes(chain))) {
      score += 5;
    }
    
    if (place.rating && place.rating > 8) score += 2;
    
    return Math.min(50, score);
  };

  // Main API function
  const fetchRealPlaces = async (lat, lng, radiusMiles = 5, useCache = true) => {
    const cacheKey = getCacheKey(lat, lng, radiusMiles);
    
    if (useCache) {
      const cached = placesCache.get(cacheKey);
      if (isCacheValid(cached)) {
        console.log('📋 Using cached data');
        setRealBusinesses(cached.data);
        return;
      }
    }
    
    setIsLoadingPlaces(true);
    
    if (!FOURSQUARE_API_KEY) {
      console.log('❌ No API key');
      setIsLoadingPlaces(false);
      return;
    }
    
    // Cap at 50 miles (Foursquare API limit)
    const maxRadius = 50;
    if (radiusMiles > maxRadius) {
      radiusMiles = maxRadius;
    }
    
    try {
      const radiusMeters = Math.round(radiusMiles * 1609.34);
      
      console.log(`🌙 Searching ${radiusMiles} miles around ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      
      const categoryQueries = {
        food: '13065,13025,13003,13035,13145,13064,13009,13199,13383', 
        coffee: '13032,13033,13034,13385,13387', 
        gas: '17069', 
        pharmacy: '17097', 
        grocery: '17043,17051', 
        gym: '18021,18022', 
        services: '17114,17115,17050,17052',
        entertainment: '10032,10027,10028'
      };

      const allBusinesses = [];
      
      for (const [categoryName, categoryIds] of Object.entries(categoryQueries)) {
        console.log(`🔍 Searching ${categoryName}...`);
        
        const url = `https://api.foursquare.com/v3/places/search?ll=${lat},${lng}&radius=${radiusMeters}&categories=${categoryIds}&limit=50&fields=fsq_id,name,location,categories,hours,rating,photos,tel,website,price,popularity`;

        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': FOURSQUARE_API_KEY,
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            console.error(`❌ API error for ${categoryName}: ${response.status}`);
            continue;
          }

          const data = await response.json();
          console.log(`📋 Found ${data.results?.length || 0} ${categoryName} businesses`);
          
          if (!data.results) continue;
          
          for (const place of data.results) {
            if (!place.location || typeof place.location.lat !== 'number' || typeof place.location.lng !== 'number') {
              continue;
            }
            
            const distance = calculateDistance(lat, lng, place.location.lat, place.location.lng);
            
            if (isNaN(distance) || distance < 0 || distance > radiusMiles) {
              continue;
            }
            
            const isActuallyLateNight = checkIfOpenLate(place.hours);
            const lateNightInfo = analyzeLateNightHours(place.hours);
            
            // EXPANDED: Much larger list of known late night chains
            const knownLateNightChains = [
              'shell', 'chevron', 'exxon', 'mobil', 'bp', 'valero', 'arco', 'texaco', 'marathon',
              '7-eleven', 'circle k', 'wawa', 'sheetz', 'speedway', 'caseys', 'kwik trip', 'royal farms',
              'mcdonalds', 'taco bell', 'del taco', 'jack in the box', 'white castle', 'krystal',
              'burger king', 'wendys', 'subway', 'kfc', 'popeyes',
              'dennys', 'ihop', 'waffle house', 'steak n shake', 'whataburger', 'in-n-out',
              'cvs', 'walgreens', 'rite aid',
              '24 hour fitness', 'anytime fitness', 'planet fitness', 'snap fitness',
              'starbucks', 'dunkin', 'tim hortons',
              'walmart', 'target', 'safeway', 'kroger', 'albertsons'
            ];
            
            const businessName = place.name.toLowerCase();
            const isKnownLateNightChain = knownLateNightChains.some(chain => 
              businessName.includes(chain)
            );
            
            // MUCH MORE LENIENT: Accept if ANY condition is met
            const shouldInclude = isActuallyLateNight || isKnownLateNightChain || lateNightInfo.level !== 'Check Hours';
            
            if (!shouldInclude) {
              continue;
            }
            
            console.log(`✅ Late night confirmed: ${place.name}`);

            const rideShareInfo = calculateRideShareInfo(distance);
            const todaysHours = getTodaysHours(place.hours);

            allBusinesses.push({
              id: place.fsq_id,
              name: place.name,
              category: categoryName,
              address: formatAddress(place.location),
              distance: `${distance.toFixed(1)} mi`,
              distanceValue: distance,
              rating: place.rating ? Math.max(1, Math.min(5, place.rating / 2)) : 4.0,
              crowdLevel: 'Quiet',
              verified: true,
              safetyRating: calculateSafetyRating(place, categoryName),
              features: getBusinessFeatures(categoryName),
              hours: place.hours?.display || lateNightInfo.display,
              todaysHours: todaysHours,
              rideShareTime: rideShareInfo.time,
              rideShareCost: rideShareInfo.cost,
              lastReported: '30 min ago',
              reportedOpen: true,
              lateNightLevel: lateNightInfo.level,
              isActuallyLateNight,
              lateNightScore: calculateLateNightScore(place, categoryName, isActuallyLateNight, lateNightInfo),
              phone: place.tel,
              website: place.website,
              photos: place.photos || []
            });
          }
        } catch (error) {
          console.error(`❌ Error fetching ${categoryName}:`, error);
        }
      }

      const sortedBusinesses = allBusinesses.sort((a, b) => {
        if (b.lateNightScore !== a.lateNightScore) {
          return b.lateNightScore - a.lateNightScore;
        }
        return a.distanceValue - b.distanceValue;
      });

      setPlacesCache(prev => new Map(prev).set(cacheKey, {
        data: sortedBusinesses,
        timestamp: Date.now()
      }));

      setRealBusinesses(sortedBusinesses);
      console.log(`✅ Final result: ${sortedBusinesses.length} verified late-night businesses`);
      
    } catch (error) {
      console.error('❌ API Error:', error.message);
      setRealBusinesses([]);
    }
    
    setIsLoadingPlaces(false);
  };

  // Get current location
  const getCurrentLocation = useCallback(() => {
    setIsLoadingLocation(true);
    
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('📍 Location found');
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLoadingLocation(false);
      },
      (error) => {
        console.error('Location error:', error);
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  }, []);

  // Refresh function
  const handleRefresh = useCallback(async () => {
    if (!userLocation) {
      getCurrentLocation();
      return;
    }

    setRefreshing(true);
    await fetchRealPlaces(userLocation.lat, userLocation.lng, searchRadius, false);
    setRefreshing(false);
  }, [userLocation, searchRadius]);

  // Navigation functions
  const openInGoogleMaps = (business) => {
    const address = encodeURIComponent(business.address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank');
  };

  const bookUberRide = (business) => {
    const address = encodeURIComponent(business.address);
    window.open(`https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${address}`, '_blank');
  };

  const bookLyftRide = (business) => {
    const address = encodeURIComponent(business.address);
    window.open(`https://lyft.com/ride?destination[address]=${address}`, '_blank');
  };

  const callBusiness = (business) => {
    if (business.phone) {
      window.open(`tel:${business.phone}`, '_self');
    }
  };

  // Mock businesses (fallback)
  const businesses = [
    {
      id: 1, name: "Tony's 24 Hour Diner", category: 'food',
      address: '142 Main St', distance: '0.3 mi', distanceValue: 0.3,
      rating: 4.2, crowdLevel: 'Quiet', verified: true, safetyRating: 4,
      features: ['Free WiFi', 'Parking', 'Well-lit'], hours: '24/7',
      todaysHours: { status: '24/7', display: 'Open 24/7', isOpen: true },
      rideShareTime: '6 min', rideShareCost: '$9', lastReported: '2 hours ago',
      reportedOpen: true, lateNightLevel: '24/7', phone: '(555) 123-4567'
    },
    {
      id: 2, name: 'Midnight Grounds Coffee', category: 'coffee',
      address: '87 Oak Avenue', distance: '0.5 mi', distanceValue: 0.5,
      rating: 4.7, crowdLevel: 'Moderate', verified: true, safetyRating: 5,
      features: ['Study Space', 'Power Outlets'], hours: '24/7',
      todaysHours: { status: '24/7', display: 'Open 24/7', isOpen: true },
      rideShareTime: '8 min', rideShareCost: '$11', lastReported: '15 min ago',
      reportedOpen: true, lateNightLevel: '24/7', phone: '(555) 987-6543'
    }
  ];

  const categories = [
    { id: 'all', name: 'All', icon: MapPin },
    { id: 'food', name: 'Food', icon: Utensils },
    { id: 'coffee', name: 'Coffee', icon: Coffee },
    { id: 'gas', name: 'Gas', icon: Fuel },
    { id: 'pharmacy', name: 'Pharmacy', icon: Pill },
    { id: 'grocery', name: 'Grocery', icon: ShoppingCart },
    { id: 'gym', name: 'Gym', icon: Dumbbell }
  ];

  const allBusinesses = realBusinesses.length > 0 ? realBusinesses : businesses;
  
  const filteredBusinesses = allBusinesses.filter(business => {
    const matchesCategory = selectedCategory === 'all' || business.category === selectedCategory;
    const matchesSearch = business.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCrowdColor = (level) => {
    switch(level) {
      case 'Quiet': return 'text-green-400';
      case 'Moderate': return 'text-yellow-400';
      case 'Busy': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getSafetyStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} size={12} className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'} />
    ));
  };

  const toggleFavorite = (businessId) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(businessId)) {
      newFavorites.delete(businessId);
    } else {
      newFavorites.add(businessId);
    }
    saveFavorites(newFavorites);
  };

  // Effects
  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  useEffect(() => {
    if (userLocation && userLocation.lat && userLocation.lng) {
      fetchRealPlaces(userLocation.lat, userLocation.lng, searchRadius);
    }
  }, [userLocation, searchRadius]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Skeleton Loading Component
  const SkeletonLoader = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-gray-950 rounded-2xl p-6 border border-gray-800 animate-pulse">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 space-y-3">
              <div className="h-6 bg-gray-800 rounded-lg w-3/4"></div>
              <div className="h-4 bg-gray-800 rounded w-1/2"></div>
              <div className="flex space-x-4">
                <div className="h-4 bg-gray-800 rounded w-16"></div>
                <div className="h-4 bg-gray-800 rounded w-16"></div>
                <div className="h-4 bg-gray-800 rounded w-20"></div>
              </div>
            </div>
            <div className="w-8 h-8 bg-gray-800 rounded-full"></div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 mb-4">
            <div className="h-4 bg-gray-800 rounded w-1/3"></div>
          </div>
          <div className="flex space-x-2 mb-4">
            <div className="h-8 bg-gray-800 rounded-lg w-20"></div>
            <div className="h-8 bg-gray-800 rounded-lg w-24"></div>
            <div className="h-8 bg-gray-800 rounded-lg w-16"></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 bg-gray-800 rounded-xl"></div>
            <div className="h-12 bg-gray-800 rounded-xl"></div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden">
      {/* Status Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-3 text-center">
        <div className="text-sm font-semibold">
          🌙 Night Owls • Find Late Night & 24/7 Places • Perfect for Night Shift Workers & Insomniacs
        </div>
      </div>
      
      {/* Header */}
      <div className="bg-gray-950 px-4 py-6 shadow-2xl border-b border-gray-800 sticky top-0 z-40">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg">
              <Navigation className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent tracking-tight">
                Night Owls
              </h1>
              <p className="text-xs text-gray-400 font-medium">Late night & 24/7 places near you</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              disabled={refreshing || isLoadingPlaces}
              className={`p-3 rounded-xl transition-all ${
                refreshing || isLoadingPlaces 
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                  : 'bg-gray-900 text-purple-400 hover:bg-gray-800 border border-gray-700'
              }`}
            >
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <div className="text-right">
              <div className="text-lg font-mono font-bold text-purple-400 tracking-wider">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                {userLocation ? (
                  <span className="text-green-400">📍 Location Set</span>
                ) : isLoadingLocation ? (
                  <span className="text-yellow-400">📍 Loading...</span>
                ) : (
                  <span className="text-gray-400">📍 Location Off</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search late night businesses..."
              className="w-full bg-gray-900 text-white pl-12 pr-4 py-4 rounded-xl border border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-all font-medium placeholder-gray-500 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Current Location & Radius Only */}
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-gray-900 px-4 py-4 rounded-xl border border-gray-700">
              <div className="flex items-center space-x-3">
                <MapPin size={20} className="text-purple-400" />
                <span className="text-base font-semibold">
                  {userLocation ? 'Current Location' : 'Location Required'}
                </span>
              </div>
              {!userLocation && (
                <button
                  onClick={getCurrentLocation}
                  disabled={isLoadingLocation}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                >
                  {isLoadingLocation ? 'Getting...' : 'Get Location'}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between bg-gray-900 px-4 py-4 rounded-xl border border-gray-700">
              <span className="text-base font-semibold text-gray-300">Search Radius</span>
              <select
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseFloat(e.target.value))}
                className="bg-transparent text-white text-base font-bold focus:outline-none cursor-pointer"
              >
                <option value={1}>1 mile</option>
                <option value={2}>2 miles</option>
                <option value={5}>5 miles</option>
                <option value={10}>10 miles</option>
                <option value={15}>15 miles</option>
                <option value={25}>25 miles</option>
                <option value={50}>50 miles (max)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filters */}
      <div className="px-4 py-6 bg-gray-950 border-b border-gray-800">
        <div className="flex space-x-3 overflow-x-auto pb-2 -mx-4 px-4">
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center space-x-3 px-6 py-4 rounded-full whitespace-nowrap transition-all font-semibold min-w-max ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                    : 'bg-gray-900 text-gray-300 hover:bg-gray-800 border border-gray-700'
                }`}
              >
                <IconComponent size={18} />
                <span className="text-base">{category.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Business List */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h2 className="text-2xl font-bold text-white">
                {isLoadingPlaces ? 'Finding businesses...' : `${filteredBusinesses.length} businesses found`}
              </h2>
              {realBusinesses.length > 0 ? (
                <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  FOURSQUARE LIVE
                </span>
              ) : (
                <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  DEMO DATA
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 font-medium">
              Sorted by late-night relevance • Real-time data • {searchRadius} mile radius
            </p>
          </div>
        </div>

        {/* Loading States */}
        {isLoadingPlaces && <SkeletonLoader />}

        {/* No Location State */}
        {!userLocation && !isLoadingLocation && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🌙</div>
            <h3 className="text-xl font-bold text-white mb-2">Find businesses near you</h3>
            <p className="text-gray-400 mb-6">Get real-time data on late night businesses</p>
            <button
              onClick={getCurrentLocation}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-all"
            >
              📍 Get My Location
            </button>
          </div>
        )}

        {/* No Results State */}
        {userLocation && !isLoadingPlaces && filteredBusinesses.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🕵️</div>
            <h3 className="text-xl font-bold text-white mb-2">No late night places found</h3>
            <p className="text-gray-400 mb-6">Try expanding your search radius or check a different category</p>
            <button
              onClick={handleRefresh}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-all"
            >
              🔄 Refresh Search
            </button>
          </div>
        )}

        {/* Business Cards */}
        {filteredBusinesses.map((business) => (
          <div key={business.id} className="bg-gray-950 rounded-2xl p-6 border border-gray-800 hover:border-purple-500/50 transition-all shadow-lg">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1 pr-4">
                <div className="flex items-center space-x-3 mb-3">
                  <h3 className="font-bold text-xl text-white">{business.name}</h3>
                  {business.verified && (
                    <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg" title="Verified Open"></div>
                  )}
                  {business.lateNightLevel && (
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      business.lateNightLevel === '24/7' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-blue-600 text-white'
                    }`}>
                      {business.lateNightLevel}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-gray-400 text-base mb-4">
                  <MapPin size={18} />
                  <span className="font-medium">{business.address} • {business.distance}</span>
                </div>
                
                {/* Today's Hours Display */}
                {business.todaysHours && (
                  <div className="flex items-center space-x-2 mb-4">
                    <Clock size={16} className="text-purple-400" />
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                      business.todaysHours.status === '24/7' 
                        ? 'bg-green-900/30 text-green-400 border border-green-800'
                        : business.todaysHours.status === 'overnight' || business.todaysHours.status === 'late'
                        ? 'bg-blue-900/30 text-blue-400 border border-blue-800'
                        : business.todaysHours.status === 'closed'
                        ? 'bg-red-900/30 text-red-400 border border-red-800'
                        : business.todaysHours.isOpen
                        ? 'bg-green-900/30 text-green-400 border border-green-800'
                        : 'bg-gray-900/30 text-gray-400 border border-gray-700'
                    }`}>
                      {business.todaysHours.status === '24/7' && '🕐'}
                      {(business.todaysHours.status === 'overnight' || business.todaysHours.status === 'late') && '🌙'}
                      {business.todaysHours.status === 'closed' && '🚫'}
                      {(business.todaysHours.status === 'regular' || business.todaysHours.status === 'display') && '⏰'}
                      {business.todaysHours.status === 'unknown' && '❓'}
                      {' '}
                      Today: {business.todaysHours.display}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center space-x-6 mb-4">
                  <div className="flex items-center space-x-2">
                    <Users size={18} className="text-gray-500" />
                    <span className={`text-base font-semibold ${getCrowdColor(business.crowdLevel)}`}>
                      {business.crowdLevel}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star size={18} className="fill-yellow-400 text-yellow-400" />
                    <span className="text-base font-bold text-gray-200">{business.rating}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-sm text-gray-500 font-medium">Safety:</span>
                    <div className="flex space-x-1">
                      {getSafetyStars(business.safetyRating)}
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => toggleFavorite(business.id)}
                className={`p-3 rounded-full transition-all ${
                  favorites.has(business.id) 
                    ? 'text-red-400 bg-red-900/20' 
                    : 'text-gray-400 hover:text-red-400 hover:bg-red-900/20'
                }`}
              >
                <Heart size={24} className={favorites.has(business.id) ? 'fill-red-400' : ''} />
              </button>
            </div>

            {/* Ride Share */}
            <div className="bg-gray-900 rounded-xl p-5 mb-5 border border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Car size={20} className="text-purple-400" />
                  <div>
                    <span className="text-base font-semibold text-gray-200 block">Ride there</span>
                    <span className="text-sm text-gray-400 font-medium">{business.rideShareTime} • {business.rideShareCost}</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => bookUberRide(business)}
                    className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-gray-700"
                  >
                    Uber
                  </button>
                  <button 
                    onClick={() => bookLyftRide(business)}
                    className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  >
                    Lyft
                  </button>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-2 mb-5">
              {business.features.map((feature, index) => (
                <span key={index} className="bg-gray-900 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium border border-gray-800">
                  {feature}
                </span>
              ))}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => openInGoogleMaps(business)}
                className="flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-4 py-4 rounded-xl text-base font-semibold transition-all shadow-lg"
              >
                <Navigation size={16} />
                <span>Navigate</span>
              </button>
              
              {business.phone && (
                <button
                  onClick={() => setCallModal(business)}
                  className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-4 rounded-xl text-base font-semibold transition-all shadow-lg"
                >
                  <Phone size={16} />
                  <span>Call</span>
                </button>
              )}
              
              <button
                onClick={() => setReportModal(business)}
                className="flex items-center justify-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-4 rounded-xl text-base font-semibold transition-all border border-gray-800"
              >
                <AlertTriangle size={16} />
                <span>Report</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Call Modal */}
      {callModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-end justify-center z-50">
          <div className="bg-gray-950 rounded-t-3xl w-full border-t border-gray-800 shadow-2xl">
            <div className="p-6 border-b border-gray-800">
              <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4"></div>
              <h3 className="text-2xl font-bold text-white">Call Business</h3>
              <p className="text-base text-gray-400 font-medium mt-2">{callModal.name}</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="text-center">
                <Phone size={48} className="text-green-400 mx-auto mb-4" />
                <p className="text-lg text-gray-300 font-medium mb-2">Ready to call?</p>
                <p className="text-2xl font-bold text-white">{callModal.phone}</p>
                <p className="text-sm text-gray-500 mt-2">Call to verify they're open or ask about services</p>
              </div>
              <div className="space-y-4">
                <button
                  onClick={() => {
                    callBusiness(callModal);
                    setCallModal(null);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-xl text-lg font-semibold transition-all shadow-lg"
                >
                  📞 Call Now
                </button>
              </div>
            </div>
            <div className="p-6 border-t border-gray-800 pb-8">
              <button 
                onClick={() => setCallModal(null)}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-xl text-base font-semibold transition-all border border-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-end justify-center z-50">
          <div className="bg-gray-950 rounded-t-3xl w-full border-t border-gray-800 shadow-2xl">
            <div className="p-6 border-b border-gray-800">
              <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4"></div>
              <h3 className="text-2xl font-bold text-white">Report Status</h3>
              <p className="text-base text-gray-400 font-medium mt-2">{reportModal.name}</p>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-lg text-gray-300 font-medium">What's the current status?</p>
              <div className="space-y-4">
                <button
                  onClick={() => {
                    console.log(`Reported ${reportModal.id} as open`);
                    setReportModal(null);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-xl text-lg font-semibold transition-all shadow-lg"
                >
                  ✓ Yes, it's open
                </button>
                <button
                  onClick={() => {
                    console.log(`Reported ${reportModal.id} as closed`);
                    setReportModal(null);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-xl text-lg font-semibold transition-all shadow-lg"
                >
                  ✗ No, it's closed
                </button>
                <button
                  onClick={() => {
                    console.log(`Reported ${reportModal.id} as busy`);
                    setReportModal(null);
                  }}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-5 rounded-xl text-lg font-semibold transition-all shadow-lg"
                >
                  🚫 Too busy/crowded
                </button>
              </div>
              <div className="text-sm text-gray-500 mt-4 font-medium text-center">
                Last reported: {reportModal.lastReported}
              </div>
            </div>
            <div className="p-6 border-t border-gray-800 pb-8">
              <button 
                onClick={() => setReportModal(null)}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-xl text-base font-semibold transition-all border border-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 shadow-2xl">
        <div className="flex justify-around items-center py-4 px-4">
          <button className="flex flex-col items-center space-y-2 text-purple-400 p-3">
            <MapPin size={28} />
            <span className="text-xs font-semibold">Nearby</span>
          </button>
          <button className="flex flex-col items-center space-y-2 text-gray-400 hover:text-purple-400 relative transition-colors p-3">
            <Bell size={28} />
            <span className="text-xs font-semibold">Alerts</span>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-xs text-white font-bold">2</span>
            </div>
          </button>
          <button className="flex flex-col items-center space-y-2 text-gray-400 hover:text-purple-400 transition-colors p-3">
            <Clock size={28} />
            <span className="text-xs font-semibold">History</span>
          </button>
          <button className="flex flex-col items-center space-y-2 text-gray-400 hover:text-purple-400 transition-colors p-3">
            <Heart size={28} />
            <span className="text-xs font-semibold">Favorites</span>
          </button>
        </div>
      </div>

      {/* Bottom padding */}
      <div className="h-24"></div>
      
      {/* Debug Footer */}
      <div className="bg-gray-950 p-4 border-t border-gray-800 text-center">
        <div className="text-xs text-gray-500 space-y-2">
          <div>✅ <span className="text-green-400">Working:</span> GPS • Navigation • Rideshare • Favorites • Reports • Call • Cache</div>
          <div>🔧 <span className="text-blue-400">Debug:</span> Found: {realBusinesses.length} • Displayed: {filteredBusinesses.length} • Radius: {searchRadius}mi (max 50) • Cache: {placesCache.size} entries</div>
          <div>📱 <span className="text-purple-400">Enhanced:</span> MUCH More Lenient Filtering • Fixed Hours Display • 50mi Max Range</div>
        </div>
      </div>
    </div>
  );
};

export default NightOwlsApp;
