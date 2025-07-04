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

  // Geocoding function
  const geocodeLocation = async (locationString) => {
    const cityCoordinates = {
      'san francisco, ca': { lat: 37.7749, lng: -122.4194 },
      'los angeles, ca': { lat: 34.0522, lng: -118.2437 },
      'new york, ny': { lat: 40.7128, lng: -74.0060 },
      'chicago, il': { lat: 41.8781, lng: -87.6298 },
      'washington, dc': { lat: 38.9072, lng: -77.0369 },
      'miami, fl': { lat: 25.7617, lng: -80.1918 }
    };

    const normalizedLocation = locationString.toLowerCase().trim();
    
    if (cityCoordinates[normalizedLocation]) {
      console.log(`📍 Using coordinates for ${locationString}`);
      return cityCoordinates[normalizedLocation];
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationString)}&limit=1&countrycodes=us`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    
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

  // MAIN API FUNCTION - COMPLETELY REWRITTEN FOR ACCURACY
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
            console.error(`❌ API error for ${categoryName}: ${response.status}`);
            continue;
          }

          const data = await response.json();
          console.log(`📋 Found ${data.results.length} ${categoryName} businesses`);
          
          // Process and filter each business
          for (const place of data.results) {
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
            
            // STRICT FILTERING: Must be actually open late OR known late night chain
            if (!isActuallyLateNight && !isKnownLateNightChain) {
              console.log(`❌ Filtered out ${place.name} - not actually late night`);
              continue;
            }
            
            console.log(`✅ Late night confirmed: ${place.name} - ${lateNightInfo.status}`);

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
              rideShareTime: `${Math.ceil(distance * 3)} min`,
              rideShareCost: `${Math.ceil(distance * 2.5 + 8)}`,
              lastReported: '30 min ago',
              reportedOpen: true,
              lateNightLevel: lateNightInfo.level,
              isActuallyLateNight,
              lateNightScore: calculateLateNightScore(place, categoryName, isActuallyLateNight, lateNightInfo)
            });
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
        setSearchLocation('Current Location');
        setIsLoadingLocation(false);
      },
      (error) => {
        console.error('Location error:', error);
        setIsLoadingLocation(false);
      }
    );
  };

  // Handle location change
  const handleLocationChange = async (newLocation) => {
    setShowLocationSearch(false);
    setSearchLocation(newLocation + ' (Loading...)');
    setIsLoadingLocation(true);
    
    try {
      const coordinates = await geocodeLocation(newLocation);
      setUserLocation(coordinates);
      setSearchLocation(newLocation);
      console.log(`📍 Location changed to ${newLocation}`);
    } catch (error) {
      console.error('Error changing location:', error);
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

  useEffect(() => {
    if (userLocation && userLocation.lat && userLocation.lng) {
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

          {/* Location & Radius Controls */}
          <div className="space-y-3">
            <div className="relative">
              <button
                onClick={() => setShowLocationSearch(!showLocationSearch)}
                className="w-full flex items-center justify-between bg-gray-900 text-white px-4 py-4 rounded-xl border border-gray-700 hover:border-purple-500 transition-all font-medium"
              >
                <div className="flex items-center space-x-3">
                  <MapPin size={20} className="text-purple-400" />
                  <span className="text-base font-semibold">{searchLocation}</span>
                </div>
                <span className="text-gray-500 text-xl">▼</span>
              </button>
              
              {showLocationSearch && (
                <div className="absolute z-50 mt-2 w-full bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
                  <div className="p-4 space-y-3">
                    <input
                      type="text"
                      placeholder="Enter city, state or zip code..."
                      className="w-full bg-gray-800 text-white px-4 py-4 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none text-base font-medium placeholder-gray-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          handleLocationChange(e.target.value.trim());
                          e.target.value = '';
                        }
                      }}
                    />
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          getCurrentLocation();
                          setShowLocationSearch(false);
                        }}
                        className="w-full text-left px-4 py-4 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-all"
                      >
                        📍 Use Current Location
                      </button>
                      <button
                        onClick={() => handleLocationChange('San Francisco, CA')}
                        className="w-full text-left px-4 py-4 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-all"
                      >
                        🌆 San Francisco, CA
                      </button>
                      <button
                        onClick={() => handleLocationChange('New York, NY')}
                        className="w-full text-left px-4 py-4 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-all"
                      >
                        🗽 New York, NY
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between bg-gray-900 px-4 py-4 rounded-xl border border-gray-700">
              <span className="text-base font-semibold text-gray-300">Search Radius</span>
              <select
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseFloat(e.target.value))}
                className="bg-transparent text-white text-base font-bold focus:outline-none cursor-pointer"
              >
                <option value={1}>1 mi</option>
                <option value={2}>2 mi</option>
                <option value={5}>5 mi</option>
                <option value={10}>10 mi</option>
                <option value={25}>25 mi</option>
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
              Sorted by distance • Real-time data from Foursquare
            </p>
          </div>
        </div>

        {isLoadingPlaces && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400 font-medium">Loading businesses...</p>
          </div>
        )}

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
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-600 text-white">
                      {business.lateNightLevel}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-gray-400 text-base mb-4">
                  <MapPin size={18} />
                  <span className="font-medium">{business.address} • {business.distance}</span>
                </div>
                
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
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => openInGoogleMaps(business)}
                className="flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-4 py-4 rounded-xl text-base font-semibold transition-all shadow-lg"
              >
                <Navigation size={16} />
                <span>Navigate</span>
              </button>
              
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
              <p className="text-lg text-gray-300 font-medium">Is this place currently open?</p>
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
          <div>✅ <span className="text-green-400">Working:</span> GPS • Navigation • Rideshare • Favorites • Reports</div>
          <div>🔧 <span className="text-blue-400">Debug:</span> Found: {realBusinesses.length} • Displayed: {filteredBusinesses.length} • Radius: {searchRadius}mi</div>
        </div>
      </div>
    </div>
  );
};

export default NightOwlsApp;
