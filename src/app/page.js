'use client';

import React, { useState, useEffect } from 'react';
import { Search, MapPin, Clock, Users, Star, Navigation, Filter, Coffee, ShoppingCart, Fuel, Pill, Utensils, Dumbbell, Heart, AlertTriangle, Car, Bell, MessageSquare, Send } from 'lucide-react';

const NightOwlsApp = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [favorites, setFavorites] = useState(new Set([2, 4])); // Sample favorites
  const [showReviews, setShowReviews] = useState(null);
  const [reportModal, setReportModal] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDistanceCircles, setShowDistanceCircles] = useState(true);
  const [routePlanningFor, setRoutePlanningFor] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [showPhotos, setShowPhotos] = useState(null);
  const [searchRadius, setSearchRadius] = useState(2); // miles
  const [searchLocation, setSearchLocation] = useState('Current Location');
  const [showLocationSearch, setShowLocationSearch] = useState(false);

  // Add real functionality hooks
  const [userLocation, setUserLocation] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  
  // Real places data using Foursquare Places API
  const [realBusinesses, setRealBusinesses] = useState([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);

  // Foursquare API key - users can get this free at https://foursquare.com/developers/
  const FOURSQUARE_API_KEY = process.env.NEXT_PUBLIC_FOURSQUARE_API_KEY || 'YOUR_FOURSQUARE_API_KEY';

  // Cache configuration
  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  // Helper functions for enhanced functionality
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

  // Geocoding function to convert city names/zip codes to coordinates
  const geocodeLocation = async (locationString) => {
    // Predefined major city coordinates for instant results
    const cityCoordinates = {
      'san francisco, ca': { lat: 37.7749, lng: -122.4194 },
      'los angeles, ca': { lat: 34.0522, lng: -118.2437 },
      'new york, ny': { lat: 40.7128, lng: -74.0060 },
      'chicago, il': { lat: 41.8781, lng: -87.6298 },
      'houston, tx': { lat: 29.7604, lng: -95.3698 },
      'phoenix, az': { lat: 33.4484, lng: -112.0740 },
      'philadelphia, pa': { lat: 39.9526, lng: -75.1652 },
      'san antonio, tx': { lat: 29.4241, lng: -98.4936 },
      'san diego, ca': { lat: 32.7157, lng: -117.1611 },
      'dallas, tx': { lat: 32.7767, lng: -96.7970 },
      'austin, tx': { lat: 30.2672, lng: -97.7431 },
      'seattle, wa': { lat: 47.6062, lng: -122.3321 },
      'denver, co': { lat: 39.7392, lng: -104.9903 },
      'washington, dc': { lat: 38.9072, lng: -77.0369 },
      'boston, ma': { lat: 42.3601, lng: -71.0589 },
      'las vegas, nv': { lat: 36.1699, lng: -115.1398 },
      'miami, fl': { lat: 25.7617, lng: -80.1918 },
      'atlanta, ga': { lat: 33.7490, lng: -84.3880 },
      'portland, or': { lat: 45.5152, lng: -122.6784 },
      'nashville, tn': { lat: 36.1627, lng: -86.7816 }
    };

    const normalizedLocation = locationString.toLowerCase().trim();
    
    // Check if it's a predefined city
    if (cityCoordinates[normalizedLocation]) {
      console.log(`📍 Using predefined coordinates for ${locationString}`);
      return cityCoordinates[normalizedLocation];
    }

    // For other locations (zip codes, etc.), use free OpenStreetMap geocoding
    try {
      console.log(`🔍 Geocoding: ${locationString}`);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationString)}&limit=1&countrycodes=us`
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        console.log(`✅ Geocoded ${locationString} to:`, { lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        };
      } else {
        throw new Error('Location not found');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      
      // Fallback to New York if geocoding fails
      console.log('🔄 Falling back to New York, NY');
      return { lat: 40.7128, lng: -74.0060 };
    }
  };

  // Enhanced late night detection
  const detectLateNightHours = (place) => {
    if (!place.hours) return false;
    
    const hoursDisplay = (place.hours.display || '').toLowerCase();
    const businessName = place.name.toLowerCase();
    
    // 24/7 indicators
    const twentyFourSevenIndicators = [
      '24 hours', '24/7', 'open 24 hours', 'always open', 
      'round the clock', '24 hour', 'twenty four'
    ];
    
    // Late night indicators (open until at least 2 AM)
    const lateNightIndicators = [
      '2am', '2 am', '3am', '3 am', '4am', '4 am', 
      'late night', 'open late', 'midnight', '1am', '1 am'
    ];
    
    // Business names that suggest late night
    const lateNightBusinessNames = [
      '24', 'hour', 'late', 'night', 'midnight', 'after dark',
      // Chains known for late hours
      '7-eleven', 'circle k', 'wawa', 'sheetz',
      'taco bell', 'del taco', 'jack in the box', 'white castle',
      'dennys', 'ihop', 'waffle house', 'steak n shake',
      'dunkin', 'krispy kreme', 'tim hortons'
    ];
    
    const is24Hours = twentyFourSevenIndicators.some(indicator => 
      hoursDisplay.includes(indicator)
    );
    
    const isLateNight = lateNightIndicators.some(indicator => 
      hoursDisplay.includes(indicator)
    );
    
    const hasLateNightName = lateNightBusinessNames.some(name => 
      businessName.includes(name)
    );
    
    return is24Hours || isLateNight || hasLateNightName;
  };

  const calculateNightOwlScore = (place, category, isLateNight) => {
    let score = 0;
    
    const businessName = place.name.toLowerCase();
    const hoursDisplay = (place.hours?.display || '').toLowerCase();
    
    // Base score for categories
    const categoryScores = {
      'gas': 4,        // Gas stations often 24/7
      'pharmacy': 3,   // CVS, Walgreens often late
      'grocery': 3,    // Convenience stores
      'food': 2,       // Restaurants vary
      'coffee': 2,     // Some coffee shops late
      'gym': 3,        // Many gyms 24/7
      'entertainment': 1,
      'services': 1
    };
    
    score += categoryScores[category] || 1;
    
    // Bonus for 24/7 indicators
    if (isLateNight) score += 3;
    
    // Bonus for late night chains
    const lateNightChains = [
      'mcdonald', 'taco bell', 'del taco', 'jack in the box',
      'dennys', 'ihop', 'waffle house', '7-eleven', 'circle k',
      'cvs', 'walgreens', 'rite aid', 'shell', 'chevron'
    ];
    
    if (lateNightChains.some(chain => businessName.includes(chain))) {
      score += 2;
    }
    
    // Bonus for time indicators in hours
    const lateTimeIndicators = ['2am', '3am', '4am', 'midnight', 'late'];
    if (lateTimeIndicators.some(time => hoursDisplay.includes(time))) {
      score += 2;
    }
    
    return Math.min(10, score); // Cap at 10
  };

  const getLateNightLevel = (place, isLateNight) => {
    if (!place.hours) return 'Unknown';
    
    const hoursDisplay = (place.hours.display || '').toLowerCase();
    
    if (hoursDisplay.includes('24') || hoursDisplay.includes('always')) {
      return '24/7';
    } else if (hoursDisplay.includes('2am') || hoursDisplay.includes('3am') || hoursDisplay.includes('4am')) {
      return 'Open Very Late';
    } else if (hoursDisplay.includes('midnight') || hoursDisplay.includes('1am') || isLateNight) {
      return 'Open Late';
    } else {
      return 'Check Hours';
    }
  };

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

  // Mock data for demo purposes
  const businesses = [
    {
      id: 1,
      name: "Tony's 24 Hour Diner",
      category: 'food',
      address: '142 Main St',
      distance: '0.3 miles',
      distanceValue: 0.3,
      rating: 4.2,
      crowdLevel: 'Quiet',
      verified: true,
      safetyRating: 4,
      features: ['Free WiFi', 'Parking', 'Well-lit'],
      hours: '24/7',
      x: 180,
      y: 120,
      rideShareTime: '4 min',
      rideShareCost: '$8',
      lastReported: '2 hours ago',
      reportedOpen: true,
      walkTime: '4 min',
      driveTime: '2 min',
      photos: ['diner-night.jpg', 'diner-interior.jpg', 'diner-counter.jpg'],
      lateNightLevel: '24/7'
    },
    {
      id: 2,
      name: 'Midnight Grounds Coffee',
      category: 'coffee',
      address: '87 Oak Avenue',
      distance: '0.5 miles',
      distanceValue: 0.5,
      rating: 4.7,
      crowdLevel: 'Moderate',
      verified: true,
      safetyRating: 5,
      features: ['Study Space', 'Power Outlets', 'Quiet Zone'],
      hours: '24/7',
      x: 220,
      y: 160,
      rideShareTime: '6 min',
      rideShareCost: '$9',
      lastReported: '15 min ago',
      reportedOpen: true,
      walkTime: '6 min',
      driveTime: '3 min',
      photos: ['coffee-night.jpg', 'coffee-study.jpg', 'coffee-counter.jpg', 'coffee-seating.jpg'],
      lateNightLevel: '24/7'
    },
    {
      id: 3,
      name: 'QuickMart Express',
      category: 'grocery',
      address: '201 Pine St',
      distance: '0.7 miles',
      distanceValue: 0.7,
      rating: 3.8,
      crowdLevel: 'Busy',
      verified: false,
      safetyRating: 3,
      features: ['ATM', 'Hot Food', 'Gas Station'],
      hours: '24/7',
      x: 140,
      y: 200,
      rideShareTime: '8 min',
      rideShareCost: '$11',
      lastReported: '1 hour ago',
      reportedOpen: false,
      walkTime: '9 min',
      driveTime: '4 min',
      photos: ['mart-exterior.jpg', 'mart-aisles.jpg'],
      lateNightLevel: '24/7'
    },
    {
      id: 4,
      name: 'FitNess 24/7',
      category: 'gym',
      address: '95 Cedar Blvd',
      distance: '1.2 miles',
      distanceValue: 1.2,
      rating: 4.1,
      crowdLevel: 'Quiet',
      verified: true,
      safetyRating: 4,
      features: ['Key Card Access', 'Security Cameras', 'Free Weights'],
      hours: '24/7',
      x: 280,
      y: 100,
      rideShareTime: '12 min',
      rideShareCost: '$15',
      lastReported: '30 min ago',
      reportedOpen: true,
      walkTime: '15 min',
      driveTime: '6 min',
      photos: ['gym-weights.jpg', 'gym-cardio.jpg', 'gym-entrance.jpg'],
      lateNightLevel: '24/7'
    },
    {
      id: 5,
      name: 'Shell Gas & Go',
      category: 'gas',
      address: '333 Highway 101',
      distance: '0.9 miles',
      distanceValue: 0.9,
      rating: 3.5,
      crowdLevel: 'Moderate',
      verified: true,
      safetyRating: 4,
      features: ['Convenience Store', 'Car Wash', 'Well-lit Pumps'],
      hours: '24/7',
      x: 320,
      y: 180,
      rideShareTime: '10 min',
      rideShareCost: '$13',
      lastReported: '45 min ago',
      reportedOpen: true,
      walkTime: '12 min',
      driveTime: '5 min',
      photos: ['gas-pumps.jpg', 'gas-store.jpg'],
      lateNightLevel: '24/7'
    }
  ];

  const categories = [
    { id: 'all', name: 'All', icon: MapPin },
    { id: 'food', name: 'Food', icon: Utensils },
    { id: 'coffee', name: 'Coffee', icon: Coffee },
    { id: 'gas', name: 'Gas', icon: Fuel },
    { id: 'pharmacy', name: 'Pharmacy', icon: Pill },
    { id: 'grocery', name: 'Grocery', icon: ShoppingCart },
    { id: 'gym', name: 'Gym', icon: Dumbbell },
    { id: 'entertainment', name: 'Fun', icon: Star },
    { id: 'services', name: 'Services', icon: Clock }
  ];

  const nightReviews = {
    1: [
      { user: 'NightOwl92', time: '2:30 AM', text: 'Perfect late night spot! Staff is super friendly even at 3am. Coffee stays hot and the wifi is solid.', rating: 5 },
      { user: 'StudyBuddy', time: '1:15 AM', text: 'Great for studying late. Not too crowded after midnight. Only complaint is the music can be a bit loud sometimes.', rating: 4 }
    ],
    2: [
      { user: 'CoffeeLover3000', time: '11:45 PM', text: 'This place gets busy around midnight but the baristas keep things moving. Love the quiet study area in the back!', rating: 5 },
      { user: 'InsomniacWriter', time: '3:22 AM', text: 'Been coming here for months. Consistent quality even at ungodly hours. The night shift knows my order by heart.', rating: 5 },
      { user: 'GamerGirl', time: '12:30 AM', text: 'Power outlets everywhere! Perfect for my laptop setup. Gets a bit crowded with other night owls but that\'s kinda nice.', rating: 4 }
    ],
    4: [
      { user: 'FitnessFreak', time: '2:00 AM', text: 'Love working out when it\'s empty. Equipment is always available and the place feels super safe with security cameras.', rating: 5 },
      { user: 'ShiftWorker', time: '4:30 AM', text: 'Perfect for my schedule. Clean, well-lit, and never crowded at night. Exactly what I need after a long shift.', rating: 4 }
    ]
  };

  const userPhotos = {
    1: [
      { url: 'diner-night.jpg', user: 'NightEater92', time: '2:15 AM', caption: 'Perfect late night vibes' },
      { url: 'diner-booth.jpg', user: 'StudyBuddy', time: '12:30 AM', caption: 'Cozy booth for solo dining' }
    ],
    2: [
      { url: 'coffee-study.jpg', user: 'CodingOwl', time: '1:45 AM', caption: 'My usual spot for coding' },
      { url: 'coffee-latte.jpg', user: 'LateNightReader', time: '11:30 PM', caption: 'Perfect latte art even at midnight' },
      { url: 'coffee-quiet.jpg', user: 'WriterLife', time: '3:00 AM', caption: 'So quiet you can hear yourself think' }
    ],
    4: [
      { url: 'gym-empty.jpg', user: 'FitnessNight', time: '2:30 AM', caption: 'Whole place to myself!' },
      { url: 'gym-weights.jpg', user: 'ShiftWorker', time: '4:00 AM', caption: 'Equipment always available' }
    ]
  };

  // Enhanced fetch real late-night businesses using Foursquare Places API
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
      
      // Enhanced category list for better late-night detection
      const categories = [
        // Food & Dining (lots of late night options)
        '13065', // Fast Food Restaurant
        '13025', // Restaurant  
        '13003', // Bar (great for late night)
        '13035', // Diner (classic late night)
        '13145', // Taco Place (often late night)
        '13064', // Pizza Place (pizza at 2 AM!)
        '13031', // Breakfast Spot (some 24/7)
        '13032', // Coffee Shop
        '13033', // Café
        '13034', // Tea Room
        
        // Convenience & Essentials
        '17043', // Convenience Store (7-Eleven, etc.)
        '17051', // Supermarket
        '17069', // Gas Station
        '17097', // Pharmacy
        
        // Services & Entertainment  
        '18021', // Gym (24 Hour Fitness, etc.)
        '17114', // ATM
        '17115', // Bank
        '10032', // Movie Theater (late shows)
        '10027', // Bowling Alley
        '17050', // Laundromat (often 24/7)
        
        // Specialty Late Night
        '13385', // Donut Shop (classic late night)
        '13383', // Ice Cream Shop
        '13377'  // Bagel Shop
      ].join(',');

      const url = `https://api.foursquare.com/v3/places/search?` + 
        `ll=${lat},${lng}&` +
        `radius=${radius}&` +
        `categories=${categories}&` +
        `limit=50&` +
        `fields=fsq_id,name,location,categories,hours,rating,photos,tel,website,price,popularity,hours_popular`;

      console.log('🌙 Searching for late night places:', { lat: lat.toFixed(4), lng: lng.toFixed(4), radius: radiusKm });

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
      console.log(`🔍 Found ${data.results.length} potential late night places from Foursquare`);
      
      // Enhanced business processing with night owl scoring
      const businesses = data.results
        .map((place, index) => {
          const distance = calculateDistance(lat, lng, place.location.lat, place.location.lng);
          
          // Skip if outside radius
          if (distance > radiusKm) return null;
          
          const category = getCategoryFromFoursquare(place.categories);
          
          // Check if it's a late night business
          const isLateNight = detectLateNightHours(place);
          const isLikelyLateNightCategory = ['gas', 'pharmacy', 'grocery', 'food', 'coffee'].includes(category);
          
          // For night owls app, prioritize late night places but include others too
          const nightOwlScore = calculateNightOwlScore(place, category, isLateNight);
          
          // Skip places with very low night owl scores (clearly not late night)
          if (nightOwlScore < 2) return null;

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
            hours: place.hours?.display || (isLateNight ? '24/7' : 'Check Hours'),
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
            isLateNight,
            lateNightLevel: getLateNightLevel(place, isLateNight),
            // Add Foursquare metadata
            popularity: place.popularity || 0,
            priceLevel: place.price || 2,
            nightOwlScore
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          // Sort by night owl score first, then distance
          if (b.nightOwlScore !== a.nightOwlScore) {
            return b.nightOwlScore - a.nightOwlScore;
          }
          return a.distanceValue - b.distanceValue;
        });

      // Cache the results
      setCachedPlaces(lat, lng, radiusKm, businesses);
      setRealBusinesses(businesses);
      
      if (businesses.length === 0) {
        console.log('🌙 No late night places found - try expanding search radius');
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

  // Convert Foursquare categories to our categories
  const getCategoryFromFoursquare = (categories) => {
    if (!categories || categories.length === 0) return 'services';
    
    const primaryCategory = categories[0];
    const categoryMap = {
      '13065': 'food',     // Fast Food
      '13032': 'coffee',   // Coffee Shop  
      '13003': 'food',     // Bar
      '13025': 'food',     // Restaurant
      '13035': 'food',     // Diner
      '13145': 'food',     // Taco Place
      '13064': 'food',     // Pizza Place
      '13031': 'food',     // Breakfast Spot
      '13033': 'coffee',   // Café
      '13034': 'coffee',   // Tea Room
      '13385': 'food',     // Donut Shop
      '13383': 'food',     // Ice Cream Shop
      '13377': 'food',     // Bagel Shop
      '17069': 'gas',      // Gas Station
      '17097': 'pharmacy', // Pharmacy
      '17043': 'grocery',  // Convenience Store
      '18021': 'gym',      // Gym
      '17051': 'grocery',  // Supermarket
      '17114': 'services', // ATM
      '17115': 'services', // Bank
      '10032': 'entertainment', // Movie Theater
      '10027': 'entertainment', // Bowling Alley
      '17050': 'services'  // Laundromat
    };
    
    return categoryMap[primaryCategory.id] || 'services';
  };

  // Format Foursquare address
  const formatAddress = (location) => {
    const parts = [
      location.address,
      location.locality,
      location.region
    ].filter(Boolean);
    return parts.join(', ') || 'Address not available';
  };

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Radius of Earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Get features based on business category
  const getBusinessFeatures = (category) => {
    const features = {
      food: ['Free WiFi', 'Parking', 'Well-lit', 'Late Night Menu'],
      coffee: ['Power Outlets', 'Study Space', 'Free WiFi', 'Quiet Zone'],
      gas: ['Convenience Store', 'Car Wash', 'Well-lit Pumps', 'ATM'],
      pharmacy: ['Drive-thru', '24/7 Pickup', 'Emergency Meds'],
      grocery: ['ATM', 'Hot Food', 'Self Checkout'],
      gym: ['Key Card Access', 'Security Cameras', 'Free Weights'],
      entertainment: ['Late Hours', 'Group Friendly', 'Parking'],
      services: ['WiFi', 'Parking', 'Well-lit']
    };
    return features[category] || features.services;
  };

  // Enhanced get user's real location
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

  // Real deep link functions
  const openInGoogleMaps = (business) => {
    const address = encodeURIComponent(business.address);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
    window.open(url, '_blank');
  };

  const openInAppleMaps = (business) => {
    const address = encodeURIComponent(business.address);
    const url = `http://maps.apple.com/?daddr=${address}`;
    window.open(url, '_blank');
  };

  const bookUberRide = (business) => {
    const address = encodeURIComponent(business.address);
    const url = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${address}`;
    window.open(url, '_blank');
  };

  const bookLyftRide = (business) => {
    const address = encodeURIComponent(business.address);
    const url = `https://lyft.com/ride?destination[address]=${address}`;
    window.open(url, '_blank');
  };

  // Persistent storage functions
  const saveFavorite = (businessId) => {
    if (typeof window !== 'undefined') {
      const favorites = JSON.parse(localStorage.getItem('nightowls_favorites') || '[]');
      if (!favorites.includes(businessId)) {
        favorites.push(businessId);
        localStorage.setItem('nightowls_favorites', JSON.stringify(favorites));
      }
    }
  };

  const removeFavorite = (businessId) => {
    if (typeof window !== 'undefined') {
      const favorites = JSON.parse(localStorage.getItem('nightowls_favorites') || '[]');
      const updated = favorites.filter(id => id !== businessId);
      localStorage.setItem('nightowls_favorites', JSON.stringify(updated));
    }
  };

  const saveSearchHistory = (query) => {
    if (typeof window !== 'undefined') {
      const history = JSON.parse(localStorage.getItem('nightowls_history') || '[]');
      history.unshift({ query, timestamp: Date.now() });
      localStorage.setItem('nightowls_history', JSON.stringify(history.slice(0, 50)));
    }
  };

  // Enhanced location change handler with geocoding
  const handleLocationChange = async (newLocation) => {
    setShowLocationSearch(false);
    setSearchLocation(newLocation + ' (Loading...)');
    setIsLoadingLocation(true);
    
    try {
      // Geocode the location to get coordinates
      const coordinates = await geocodeLocation(newLocation);
      
      // Update the user location state (this will trigger new search)
      setUserLocation({
        lat: coordinates.lat,
        lng: coordinates.lng
      });
      
      // Update the display location
      setSearchLocation(newLocation);
      
      console.log(`📍 Location changed to ${newLocation}:`, coordinates);
      
    } catch (error) {
      console.error('Error changing location:', error);
      setSearchLocation(newLocation + ' (Error)');
    }
    
    setIsLoadingLocation(false);
  };

  // Use real businesses when available, fallback to mock data
  const allBusinesses = realBusinesses.length > 0 ? realBusinesses : businesses;
  
  const filteredBusinesses = allBusinesses.filter(business => {
    const matchesCategory = selectedCategory === 'all' || business.category === selectedCategory;
    const matchesSearch = business.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         business.address.toLowerCase().includes(searchQuery.toLowerCase());
    const withinRadius = business.distanceValue <= searchRadius;
    return matchesCategory && matchesSearch && withinRadius;
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
      <Star 
        key={i} 
        size={12} 
        className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'} 
      />
    ));
  };

  const toggleFavorite = (businessId) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(businessId)) {
      newFavorites.delete(businessId);
      removeFavorite(businessId);
    } else {
      newFavorites.add(businessId);
      saveFavorite(businessId);
    }
    setFavorites(newFavorites);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      saveSearchHistory(query);
    }
  };

  const handleReport = (businessId, isOpen) => {
    // Save report to localStorage for persistence
    if (typeof window !== 'undefined') {
      const reports = JSON.parse(localStorage.getItem('nightowls_reports') || '{}');
      reports[businessId] = {
        isOpen,
        timestamp: Date.now(),
        reporter: 'user'
      };
      localStorage.setItem('nightowls_reports', JSON.stringify(reports));
    }
    
    setReportModal(null);
    console.log(`Reported ${businessId} as ${isOpen ? 'open' : 'closed'}`);
  };

  const showNavigationOptions = (business) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      const options = [
        { name: 'Google Maps', action: () => openInGoogleMaps(business) },
        ...(isIOS ? [{ name: 'Apple Maps', action: () => openInAppleMaps(business) }] : []),
        { name: 'Uber', action: () => bookUberRide(business) },
        { name: 'Lyft', action: () => bookLyftRide(business) }
      ];
      
      // Show native action sheet on mobile
      const choice = confirm(`Navigate to ${business.name}\n\nChoose your preferred app:\n${options.map((o, i) => `${i + 1}. ${o.name}`).join('\n')}`);
      if (choice) {
        const selection = prompt('Enter your choice (1-' + options.length + '):');
        const index = parseInt(selection) - 1;
        if (index >= 0 && index < options.length) {
          options[index].action();
        }
      }
    } else {
      openInGoogleMaps(business);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      food: '#f59e0b',
      coffee: '#8b5cf6',
      gas: '#ef4444',
      pharmacy: '#10b981',
      grocery: '#3b82f6',
      gym: '#f97316',
      entertainment: '#ec4899',
      services: '#06b6d4'
    };
    return colors[category] || '#6b7280';
  };

  // Initialize app with real location and fetch places
  useEffect(() => {
    getCurrentLocation();
    // Load favorites from storage
    if (typeof window !== 'undefined') {
      const savedFavorites = JSON.parse(localStorage.getItem('nightowls_favorites') || '[]');
      setFavorites(new Set(savedFavorites));
    }
  }, []);

  // Enhanced fetch real places when location or radius changes
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden">
      {/* Status Banner - Late Night Focus */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-3 text-center">
        <div className="text-sm font-semibold">
          🌙 Night Owls • Find Late Night & 24/7 Places • Open Until 2AM+ • Perfect for Night Shift Workers & Insomniacs
        </div>
      </div>
      
      {/* Header - Mobile Optimized */}
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
                <span className="text-yellow-400">📍 Loading Location...</span>
              ) : (
                <span className="text-gray-400">📍 Location Off</span>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar - Mobile Optimized */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search late night businesses..."
              className="w-full bg-gray-900 text-white pl-12 pr-4 py-4 rounded-xl border border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-all font-medium placeholder-gray-500 text-base"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Search Controls - Mobile Stack */}
          <div className="space-y-3">
            {/* Location Selector - Full Width on Mobile */}
            <div className="relative">
              <button
                onClick={() => setShowLocationSearch(!showLocationSearch)}
                className="w-full flex items-center justify-between bg-gray-900 text-white px-4 py-4 rounded-xl border border-gray-700 hover:border-purple-500 focus:border-purple-500 focus:outline-none transition-all font-medium touch-manipulation"
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
                        className="w-full text-left px-4 py-4 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                        disabled={isLoadingLocation}
                      >
                        📍 {isLoadingLocation ? 'Finding Your Location...' : 'Use Current Location'}
                      </button>
                      <button
                        onClick={() => handleLocationChange('San Francisco, CA')}
                        className="w-full text-left px-4 py-4 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                        disabled={isLoadingLocation}
                      >
                        🌆 San Francisco, CA
                      </button>
                      <button
                        onClick={() => handleLocationChange('Los Angeles, CA')}
                        className="w-full text-left px-4 py-4 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                        disabled={isLoadingLocation}
                      >
                        🌴 Los Angeles, CA
                      </button>
                      <button
                        onClick={() => handleLocationChange('New York, NY')}
                        className="w-full text-left px-4 py-4 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                        disabled={isLoadingLocation}
                      >
                        🗽 New York, NY
                      </button>
                      <button
                        onClick={() => handleLocationChange('Chicago, IL')}
                        className="w-full text-left px-4 py-4 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                        disabled={isLoadingLocation}
                      >
                        🏙️ Chicago, IL
                      </button>
                      <button
                        onClick={() => handleLocationChange('Miami, FL')}
                        className="w-full text-left px-4 py-4 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                        disabled={isLoadingLocation}
                      >
                        🏖️ Miami, FL
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 text-center mt-3">
                      Try: "Seattle, WA", "90210", "Austin TX", or any US city
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Radius Selector - Full Width on Mobile */}
            <div className="flex items-center justify-between bg-gray-900 px-4 py-4 rounded-xl border border-gray-700">
              <span className="text-base font-semibold text-gray-300">Search Radius</span>
              <select
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseFloat(e.target.value))}
                className="bg-transparent text-white text-base font-bold focus:outline-none cursor-pointer touch-manipulation"
              >
                <option value={0.25}>0.25 mi</option>
                <option value={0.5}>0.5 mi</option>
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

      {/* Category Filters - Mobile Optimized */}
      <div className="px-4 py-6 bg-gray-950 border-b border-gray-800">
        <div className="flex space-x-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center space-x-3 px-6 py-4 rounded-full whitespace-nowrap transition-all font-semibold min-w-max touch-manipulation ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-gray-900 text-gray-300 hover:bg-gray-800 border border-gray-700 hover:border-gray-600'
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
                {isLoadingPlaces ? 'Finding late night places...' : `${filteredBusinesses.length} late night places found`}
              </h2>
              {realBusinesses.length > 0 ? (
                <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  FOURSQUARE LIVE
                </span>
              ) : FOURSQUARE_API_KEY && FOURSQUARE_API_KEY !== 'YOUR_FOURSQUARE_API_KEY' ? (
                <span className="bg-yellow-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  NO RESULTS
                </span>
              ) : (
                <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  DEMO DATA
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 font-medium">
              Within {searchRadius} miles of {searchLocation === 'Current Location' ? 'your location' : searchLocation}
              {allBusinesses.length !== filteredBusinesses.length && 
                ` • ${allBusinesses.length - filteredBusinesses.length} filtered out`
              }
            </p>
          </div>
        </div>

        {isLoadingPlaces && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400 font-medium">Loading late night places from Foursquare...</p>
          </div>
        )}

        {!userLocation && !isLoadingLocation && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🌙</div>
            <h3 className="text-xl font-bold text-white mb-2">Find late night places near you</h3>
            <p className="text-gray-400 mb-6">We'll find restaurants, gas stations, and services open until 2AM+ using Foursquare</p>
            <button
              onClick={getCurrentLocation}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-all touch-manipulation"
            >
              📍 Get My Location
            </button>
            <p className="text-xs text-gray-500 mt-4">Add your free Foursquare API key for live data</p>
          </div>
        )}

        {!isLoadingPlaces && userLocation && realBusinesses.length === 0 && FOURSQUARE_API_KEY === 'YOUR_FOURSQUARE_API_KEY' && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔑</div>
            <h3 className="text-xl font-bold text-white mb-2">Add Foursquare API Key for Real Data</h3>
            <p className="text-gray-400 mb-6">Get 100,000 free requests/day with real late night business hours and ratings</p>
            <div className="space-y-3">
              <a
                href="https://foursquare.com/developers/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all touch-manipulation"
              >
                🚀 Get Free API Key
              </a>
              <p className="text-xs text-gray-500">
                1. Sign up at foursquare.com/developers<br/>
                2. Create new app, copy API key<br/>
                3. Replace YOUR_FOURSQUARE_API_KEY in code
              </p>
            </div>
          </div>
        )}

        {filteredBusinesses.length > 0 ? (
          filteredBusinesses.map((business) => (
            <div key={business.id} className="bg-gray-950 rounded-2xl p-6 border border-gray-800 hover:border-purple-500/50 transition-all shadow-lg hover:shadow-purple-500/10 mx-1">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1 pr-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="font-bold text-xl text-white tracking-tight leading-tight">{business.name}</h3>
                    {business.verified && (
                      <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg shadow-green-400/50" title="Verified Open"></div>
                    )}
                    {business.lateNightLevel && business.lateNightLevel !== 'Check Hours' && (
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        business.lateNightLevel === '24/7' 
                          ? 'bg-green-600 text-white' 
                          : business.lateNightLevel === 'Open Very Late'
                          ? 'bg-blue-600 text-white'
                          : 'bg-purple-600 text-white'
                      }`}>
                        {business.lateNightLevel}
                      </span>
                    )}
                  </div>
                  {!business.reportedOpen && (
                    <div className="flex items-center space-x-2 bg-red-900/50 px-3 py-2 rounded-full text-sm border border-red-800 mb-3 w-fit">
                      <AlertTriangle size={14} className="text-red-400" />
                      <span className="text-red-400 font-semibold">Reported Closed</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 text-gray-400 text-base mb-4">
                    <MapPin size={18} />
                    <span className="font-medium">{business.address} • {business.distance}</span>
                  </div>
                  
                  {/* Mobile-optimized stats row */}
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
                
                {/* Mobile-optimized favorite button */}
                <button
                  onClick={() => toggleFavorite(business.id)}
                  className={`p-3 rounded-full transition-all touch-manipulation ${
                    favorites.has(business.id) 
                      ? 'text-red-400 hover:text-red-300 bg-red-900/20' 
                      : 'text-gray-400 hover:text-red-400 hover:bg-red-900/20'
                  }`}
                >
                  <Heart size={24} className={favorites.has(business.id) ? 'fill-red-400' : ''} />
                </button>
              </div>

              {/* Ride Share Integration - Real Working Links */}
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
                      className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-gray-700 touch-manipulation"
                    >
                      Uber
                    </button>
                    <button 
                      onClick={() => bookLyftRide(business)}
                      className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all touch-manipulation"
                    >
                      Lyft
                    </button>
                  </div>
                </div>
              </div>

              {/* Features - Mobile Layout */}
              <div className="flex flex-wrap gap-2 mb-5">
                {business.features.map((feature, index) => (
                  <span key={index} className="bg-gray-900 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium border border-gray-800">
                    {feature}
                  </span>
                ))}
              </div>

              {/* Action buttons - Real Functions + Coming Soon */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => showNavigationOptions(business)}
                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-4 py-4 rounded-xl text-base font-semibold transition-all shadow-lg shadow-purple-500/25 touch-manipulation"
                >
                  <Navigation size={16} />
                  <span>Navigate</span>
                  <span className="text-purple-200 text-xs">✓</span>
                </button>
                
                <button
                  onClick={() => setReportModal(business)}
                  className="flex items-center justify-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-4 rounded-xl text-base font-semibold transition-all border border-gray-800 hover:border-gray-700 touch-manipulation"
                >
                  <AlertTriangle size={16} />
                  <span>Report</span>
                  <span className="text-green-400 text-xs">✓</span>
                </button>

                <button
                  className="flex items-center justify-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-4 rounded-xl text-base font-semibold transition-all border border-gray-800 hover:border-gray-700 touch-manipulation opacity-75"
                >
                  <MessageSquare size={16} />
                  <span>Reviews</span>
                  <span className="text-yellow-400 text-xs">Soon</span>
                </button>
                
                <button
                  className="flex items-center justify-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-4 rounded-xl text-base font-semibold transition-all border border-gray-800 hover:border-gray-700 touch-manipulation opacity-75"
                >
                  <span>📸</span>
                  <span>Photos</span>
                  <span className="text-yellow-400 text-xs">Soon</span>
                </button>
              </div>
            </div>
          ))
        ) : null}
      </div>

      {/* Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-end justify-center z-50 backdrop-blur-sm">
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
                  onClick={() => handleReport(reportModal.id, true)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-xl text-lg font-semibold transition-all shadow-lg touch-manipulation"
                >
                  ✓ Yes, it's open
                </button>
                <button
                  onClick={() => handleReport(reportModal.id, false)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-xl text-lg font-semibold transition-all shadow-lg touch-manipulation"
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
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-xl text-base font-semibold transition-all border border-gray-800 touch-manipulation"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Mobile Optimized */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 shadow-2xl safe-area-pb">
        <div className="flex justify-around items-center py-4 px-4">
          <button className="flex flex-col items-center space-y-2 text-purple-400 p-3 -m-3 touch-manipulation">
            <MapPin size={28} />
            <span className="text-xs font-semibold">Nearby</span>
          </button>
          <button 
            onClick={() => setShowNotifications(true)}
            className="flex flex-col items-center space-y-2 text-gray-400 hover:text-purple-400 relative transition-colors p-3 -m-3 touch-manipulation"
          >
            <Bell size={28} />
            <span className="text-xs font-semibold">Alerts</span>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/50">
              <span className="text-xs text-white font-bold">2</span>
            </div>
          </button>
          <button className="flex flex-col items-center space-y-2 text-gray-400 hover:text-purple-400 transition-colors p-3 -m-3 touch-manipulation">
            <Clock size={28} />
            <span className="text-xs font-semibold">History</span>
          </button>
          <button className="flex flex-col items-center space-y-2 text-gray-400 hover:text-purple-400 transition-colors p-3 -m-3 touch-manipulation">
            <Heart size={28} />
            <span className="text-xs font-semibold">Favorites</span>
          </button>
        </div>
      </div>

      {/* Add bottom padding to prevent content from being hidden behind navigation */}
      <div className="h-24"></div>
      
      {/* Feature Status Footer */}
      <div className="bg-gray-950 p-4 border-t border-gray-800 text-center">
        <div className="text-xs text-gray-500 space-y-2">
          <div>✅ <span className="text-green-400">Working Now:</span> GPS • Navigation • Rideshare • Favorites • Reports • Location Search</div>
          <div>🌙 <span className="text-purple-400">Late Night Focus:</span> Find restaurants, gas stations & services open until 2AM+</div>
          <div>🚧 <span className="text-yellow-400">Coming Soon:</span> User Reviews • Photo Upload • Push Notifications • Enhanced Filters</div>
        </div>
      </div>
    </div>
  );
};

export default NightOwlsApp;
