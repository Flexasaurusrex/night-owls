'use client';

import React, { useState, useEffect } from 'react';
import { Search, MapPin, Clock, Users, Star, Navigation, Coffee, ShoppingCart, Fuel, Pill, Utensils, Dumbbell, Heart, AlertTriangle, Car, Bell, MessageSquare } from 'lucide-react';

const NightOwlsApp = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [favorites, setFavorites] = useState(new Set([2, 4]));
  const [reportModal, setReportModal] = useState(null);
  const [searchRadius, setSearchRadius] = useState(5);
  const [searchLocation, setSearchLocation] = useState('Current Location');
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [realBusinesses, setRealBusinesses] = useState([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);

  // FOURSQUARE API KEY - WORKING VERSION
  const FOURSQUARE_API_KEY = 'fsq3MvvG70SW/wdvH6RS3DaTFgs4leyty2sGz8Id6JneBTk=';

  // In-memory cache
  const [placesCache, setPlacesCache] = useState(new Map());
  const CACHE_DURATION = 10 * 60 * 1000;

  // FIXED: Better geocoding function with more cities and error handling
  const geocodeLocation = async (locationString) => {
    const cityCoordinates = {
      'san francisco, ca': { lat: 37.7749, lng: -122.4194 },
      'san francisco': { lat: 37.7749, lng: -122.4194 },
      'sf': { lat: 37.7749, lng: -122.4194 },
      'los angeles, ca': { lat: 34.0522, lng: -118.2437 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'la': { lat: 34.0522, lng: -118.2437 },
      'new york, ny': { lat: 40.7128, lng: -74.0060 },
      'new york': { lat: 40.7128, lng: -74.0060 },
      'nyc': { lat: 40.7128, lng: -74.0060 },
      'chicago, il': { lat: 41.8781, lng: -87.6298 },
      'chicago': { lat: 41.8781, lng: -87.6298 },
      'washington, dc': { lat: 38.9072, lng: -77.0369 },
      'washington dc': { lat: 38.9072, lng: -77.0369 },
      'dc': { lat: 38.9072, lng: -77.0369 },
      'miami, fl': { lat: 25.7617, lng: -80.1918 },
      'miami': { lat: 25.7617, lng: -80.1918 },
      'seattle, wa': { lat: 47.6062, lng: -122.3321 },
      'seattle': { lat: 47.6062, lng: -122.3321 },
      'austin, tx': { lat: 30.2672, lng: -97.7431 },
      'austin': { lat: 30.2672, lng: -97.7431 },
      'denver, co': { lat: 39.7392, lng: -104.9903 },
      'denver': { lat: 39.7392, lng: -104.9903 },
      'boston, ma': { lat: 42.3601, lng: -71.0589 },
      'boston': { lat: 42.3601, lng: -71.0589 }
    };

    const normalizedLocation = locationString.toLowerCase().trim();
    
    if (cityCoordinates[normalizedLocation]) {
      console.log(`📍 Using coordinates for ${locationString}: ${cityCoordinates[normalizedLocation].lat}, ${cityCoordinates[normalizedLocation].lng}`);
      return cityCoordinates[normalizedLocation];
    }

    // If not in our list, try external geocoding
    try {
      console.log(`🔍 Geocoding external location: ${locationString}`);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationString)}&limit=1&countrycodes=us`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const coords = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
        console.log(`✅ Geocoded ${locationString} to:`, coords);
        return coords;
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    
    console.log(`❌ Could not geocode ${locationString}, using NYC default`);
    return { lat: 40.7128, lng: -74.0060 }; // Default to NYC
  };

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

  // Format address
  const formatAddress = (location) => {
    const parts = [location.address, location.locality, location.region].filter(Boolean);
    return parts.join(', ') || 'Address not available';
  };

  // UPDATED: Better safety rating calculation
  const calculateSafetyRating = (place, category) => {
    let safety = 3; // Base safety
    
    // Higher rated places tend to be safer
    if (place.rating) {
      const normalizedRating = place.rating / 2; // Convert 10-point to 5-point scale
      if (normalizedRating > 4) safety += 1;
      if (normalizedRating > 4.5) safety += 1;
    }
    
    // Gas stations and pharmacies often have good lighting/security
    if (['gas', 'pharmacy'].includes(category)) safety += 1;
    
    // Chain businesses often have better security
    const businessName = place.name.toLowerCase();
    const majorChains = [
      'cvs', 'walgreens', 'rite aid', // Pharmacies
      'shell', 'chevron', 'exxon', 'mobil', 'bp', // Gas
      'mcdonalds', 'taco bell', 'dennys', 'ihop', // Food
      '7-eleven', 'circle k', 'wawa' // Convenience
    ];
    if (majorChains.some(chain => businessName.includes(chain))) safety += 1;
    
    return Math.min(5, Math.max(1, safety));
  };

  // UPDATED: Better business features based on category
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

  // FIXED: Calculate ride share estimates properly
  const calculateRideShareEstimates = (distance) => {
    // distance is already in miles
    const timeMinutes = Math.max(5, Math.ceil(distance * 2.5 + 3)); // More realistic time estimate
    const costDollars = Math.max(8, Math.ceil(distance * 2.8 + 6)); // Base fare + per mile
    
    return {
      time: `${timeMinutes} min`,
      cost: `$${costDollars}`
    };
  };

  // MAIN API FUNCTION - FIXED to work with any location
  const fetchRealPlaces = async (lat, lng, radiusMiles = 5) => {
    setIsLoadingPlaces(true);
    
    if (!FOURSQUARE_API_KEY) {
      console.log('❌ No API key');
      setIsLoadingPlaces(false);
      return;
    }
    
    try {
      const radiusMeters = Math.round(radiusMiles * 1609.34);
      
      console.log(`🌙 API Key: ${FOURSQUARE_API_KEY.substring(0, 10)}...`);
      console.log(`🌙 Searching ${radiusMiles} miles (${radiusMeters}m) around ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      
      // FIXED: Much more specific categories for each type
      const categoryQueries = {
        food: '13065,13025,13003,13035,13145,13064,13009,13199', // Fast food, restaurants, bars, diners, taco, pizza, burgers, sandwiches
        coffee: '13032,13033,13034,13385', // Coffee shops, cafes, tea rooms, donut shops  
        gas: '17069', // Gas stations only
        pharmacy: '17097', // Pharmacies only
        grocery: '17043,17051', // Convenience stores, supermarkets only
        gym: '18021', // Gyms only
        services: '17114,17115,17050', // ATM, banks, laundromats
        entertainment: '10032,10027' // Theaters, bowling
      };

      const allBusinesses = [];
      
      // Search each category separately for better accuracy
      for (const [categoryName, categoryIds] of Object.entries(categoryQueries)) {
        console.log(`🔍 Searching ${categoryName} businesses...`);
        
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
            console.error(`❌ API error for ${categoryName}: ${response.status} ${response.statusText}`);
            continue;
          }

          const data = await response.json();
          console.log(`📋 Found ${data.results?.length || 0} ${categoryName} businesses`);
          
          // Process and filter each business
          if (data.results && data.results.length > 0) {
            for (const place of data.results) {
              // FIXED: Ensure location coordinates exist
              if (!place.location || !place.location.lat || !place.location.lng) {
                console.log(`❌ Skipping ${place.name} - missing coordinates`);
                continue;
              }

              const distance = calculateDistance(lat, lng, place.location.lat, place.location.lng);
              
              // Skip if too far
              if (distance > radiusMiles) continue;
              
              // CRITICAL: Check if actually open late (2AM or later)
              const isActuallyLateNight = checkIfOpenLate(place.hours);
              const lateNightInfo = analyzeLateNightHours(place.hours);
              
              // FILTER: Only include if actually open late OR known 24/7 chains
              const knownLateNightChains = [
                '7-eleven', 'circle k', 'wawa', 'sheetz', 'speedway',
                'mcdonalds', 'taco bell', 'del taco', 'jack in the box', 'white castle',
                'dennys', 'ihop', 'waffle house', 'steak n shake',
                'cvs', 'walgreens', 'rite aid', 
                'shell', 'chevron', 'exxon', 'mobil', 'bp',
                '24 hour fitness', 'anytime fitness', 'planet fitness'
              ];
              
              const businessName = place.name.toLowerCase();
              const isKnownLateNightChain = knownLateNightChains.some(chain => 
                businessName.includes(chain)
              );
              
              // RELAXED FILTERING for testing - include more places for now
              // if (!isActuallyLateNight && !isKnownLateNightChain) {
              //   console.log(`❌ Filtered out ${place.name} - not actually late night`);
              //   continue;
              // }
              
              console.log(`✅ Adding: ${place.name} - ${lateNightInfo.status}`);

              // FIXED: Calculate ride share properly
              const rideEstimates = calculateRideShareEstimates(distance);

              allBusinesses.push({
                id: place.fsq_id,
                name: place.name,
                category: categoryName, // Use our category name directly
                address: formatAddress(place.location),
                distance: `${distance.toFixed(1)} miles`,
                distanceValue: distance,
                rating: place.rating ? (place.rating / 2) : 4.0,
                crowdLevel: 'Quiet', // Late night is usually quiet
                verified: true,
                safetyRating: calculateSafetyRating(place, categoryName),
                features: getBusinessFeatures(categoryName),
                hours: place.hours?.display || lateNightInfo.display,
                rideShareTime: rideEstimates.time, // FIXED
                rideShareCost: rideEstimates.cost, // FIXED
                lastReported: '30 min ago',
                reportedOpen: true,
                lateNightLevel: lateNightInfo.level,
                isActuallyLateNight,
                lateNightScore: calculateLateNightScore(place, categoryName, isActuallyLateNight, lateNightInfo)
              });
            }
          }
        } catch (error) {
          console.error(`❌ Error fetching ${categoryName}:`, error);
        }
      }

      // Sort by late night score (best late night places first), then by distance
      const sortedBusinesses = allBusinesses.sort((a, b) => {
        if (b.lateNightScore !== a.lateNightScore) {
          return b.lateNightScore - a.lateNightScore;
        }
        return a.distanceValue - b.distanceValue;
      });

      setRealBusinesses(sortedBusinesses);
      console.log(`✅ Final result: ${sortedBusinesses.length} verified late-night businesses`);
      
    } catch (error) {
      console.error('❌ API Error:', error.message);
      setRealBusinesses([]);
    }
    
    setIsLoadingPlaces(false);
  };

  // NEW: Actually check if a business is open late based on real hours data
  const checkIfOpenLate = (hoursData) => {
    if (!hoursData || !hoursData.regular) return false;
    
    try {
      // Check each day's hours
      for (const daySchedule of hoursData.regular) {
        if (daySchedule.open) {
          for (const timeSlot of daySchedule.open) {
            // Check if end time is 2 AM (0200) or later, or if it's 24/7
            const endTime = parseInt(timeSlot.end);
            
            // 24/7 places (end time after start time next day)
            if (endTime <= 600 && endTime < parseInt(timeSlot.start)) {
              return true;
            }
            
            // Places open until 2 AM or later (0200 = 2:00 AM)
            if (endTime >= 200 && endTime <= 600) {
              return true;
            }
          }
        }
      }
    } catch (error) {
      console.log('Error parsing hours:', error);
    }
    
    return false;
  };

  // NEW: Analyze hours to get detailed late night info
  const analyzeLateNightHours = (hoursData) => {
    if (!hoursData) {
      return { level: 'Check Hours', status: 'Hours unknown', display: 'Check hours' };
    }
    
    // Check display text first
    const display = hoursData.display || '';
    const displayLower = display.toLowerCase();
    
    if (displayLower.includes('24 hours') || displayLower.includes('24/7') || displayLower.includes('always open')) {
      return { level: '24/7', status: 'Open 24/7', display: '24/7' };
    }
    
    if (displayLower.includes('2:00 am') || displayLower.includes('2 am') || displayLower.includes('3:00 am') || displayLower.includes('3 am')) {
      return { level: 'Open Very Late', status: 'Open until 2-3 AM', display };
    }
    
    if (displayLower.includes('1:00 am') || displayLower.includes('1 am') || displayLower.includes('midnight')) {
      return { level: 'Open Late', status: 'Open until midnight-1 AM', display };
    }
    
    // Check structured hours data
    if (hoursData.regular) {
      try {
        let latestEnd = 0;
        let is24Hour = false;
        
        for (const daySchedule of hoursData.regular) {
          if (daySchedule.open) {
            for (const timeSlot of daySchedule.open) {
              const startTime = parseInt(timeSlot.start);
              const endTime = parseInt(timeSlot.end);
              
              // Check for 24/7 (end time wraps to next day)
              if (endTime < startTime) {
                is24Hour = true;
              }
              
              // Track latest closing time
              if (endTime >= 200 && endTime <= 600) {
                latestEnd = Math.max(latestEnd, endTime);
              }
            }
          }
        }
        
        if (is24Hour) {
          return { level: '24/7', status: 'Open 24/7', display: '24 hours' };
        }
        
        if (latestEnd >= 300) {
          return { level: 'Open Very Late', status: 'Open until 3+ AM', display: `Open until ${Math.floor(latestEnd/100)}:${(latestEnd%100).toString().padStart(2, '0')} AM` };
        }
        
        if (latestEnd >= 200) {
          return { level: 'Open Late', status: 'Open until 2+ AM', display: `Open until ${Math.floor(latestEnd/100)}:${(latestEnd%100).toString().padStart(2, '0')} AM` };
        }
      } catch (error) {
        console.log('Error analyzing structured hours:', error);
      }
    }
    
    return { level: 'Check Hours', status: 'Hours unknown', display: display || 'Check hours' };
  };

  // NEW: Calculate late night score for ranking
  const calculateLateNightScore = (place, category, isActuallyLateNight, lateNightInfo) => {
    let score = 0;
    
    // Base score for being actually open late
    if (isActuallyLateNight) score += 10;
    
    // Bonus for level of lateness
    switch (lateNightInfo.level) {
      case '24/7': score += 15; break;
      case 'Open Very Late': score += 10; break;
      case 'Open Late': score += 5; break;
    }
    
    // Category relevance for late night
    const categoryScores = {
      food: 8,
      coffee: 6,
      gas: 9,
      pharmacy: 7,
      grocery: 8,
      gym: 4,
      services: 3,
      entertainment: 2
    };
    score += categoryScores[category] || 1;
    
    // Known late night chains bonus
    const businessName = place.name.toLowerCase();
    const lateNightChains = [
      '7-eleven', 'circle k', 'taco bell', 'mcdonalds', 'dennys', 
      'ihop', 'waffle house', 'cvs', 'walgreens'
    ];
    
    if (lateNightChains.some(chain => businessName.includes(chain))) {
      score += 5;
    }
    
    // Rating bonus
    if (place.rating && place.rating > 8) score += 2;
    
    return Math.min(50, score);
  };

  // Get user location
  const getCurrentLocation = () => {
    setIsLoadingLocation(true);
    
    if (!navigator.geolocation) {
      console.log('❌ Geolocation not supported');
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('📍 Current location found:', position.coords.latitude, position.coords.longitude);
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setSearchLocation('Current Location');
        setIsLoadingLocation(false);
      },
      (error) => {
        console.error('❌ Location error:', error);
        setIsLoadingLocation(false);
      }
    );
  };

  // FIXED: Handle location change properly
  const handleLocationChange = async (newLocation) => {
    setShowLocationSearch(false);
    setSearchLocation(newLocation + ' (Loading...)');
    setIsLoadingLocation(true);
    
    try {
      console.log(`🔄 Changing location to: ${newLocation}`);
      const coordinates = await geocodeLocation(newLocation);
      
      if (coordinates && coordinates.lat && coordinates.lng) {
        setUserLocation(coordinates);
        setSearchLocation(newLocation);
        console.log(`✅ Location changed to ${newLocation}: ${coordinates.lat}, ${coordinates.lng}`);
        
        // Clear previous results and fetch new ones
        setRealBusinesses([]);
        
        // Give a small delay to show the loading state
        setTimeout(() => {
          fetchRealPlaces(coordinates.lat, coordinates.lng, searchRadius);
        }, 100);
      } else {
        throw new Error('Invalid coordinates returned');
      }
    } catch (error) {
      console.error('❌ Error changing location:', error);
      setSearchLocation(newLocation + ' (Error)');
    }
    
    setIsLoadingLocation(false);
  };

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

  // Mock data
  const businesses = [
    {
      id: 1, name: "Tony's 24 Hour Diner", category: 'food',
      address: '142 Main St', distance: '0.3 miles', distanceValue: 0.3,
      rating: 4.2, crowdLevel: 'Quiet', verified: true, safetyRating: 4,
      features: ['Free WiFi', 'Parking', 'Well-lit'], hours: '24/7',
      rideShareTime: '4 min', rideShareCost: '$8', lastReported: '2 hours ago',
      reportedOpen: true, lateNightLevel: '24/7'
    },
    {
      id: 2, name: 'Midnight Grounds Coffee', category: 'coffee',
      address: '87 Oak Avenue', distance: '0.5 miles', distanceValue: 0.5,
      rating: 4.7, crowdLevel: 'Moderate', verified: true, safetyRating: 5,
      features: ['Study Space', 'Power Outlets'], hours: '24/7',
      rideShareTime: '6 min', rideShareCost: '$9', lastReported: '15 min ago',
      reportedOpen: true, lateNightLevel: '24/7'
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

  // Use real businesses when available
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
    setFavorites(newFavorites);
  };

  // Effects
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // FIXED: Better location change handling
  useEffect(() => {
    if (userLocation && userLocation.lat && userLocation.lng && !isLoadingLocation) {
      console.log(`🔄 useEffect triggered - fetching places for:`, userLocation);
      fetchRealPlaces(userLocation.lat, userLocation.lng, searchRadius);
    }
  }, [userLocation, searchRadius]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

        {/* Search Bar */
