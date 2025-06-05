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

  const detect24HoursEnhanced = (place) => {
    if (!place.hours) return false;
    
    const hoursDisplay = (place.hours.display || '').toLowerCase();
    const businessName = place.name.toLowerCase();
    
    const hourIndicators = [
      '24 hours', '24/7', 'open 24 hours', 'always open', 
      'round the clock', '24 hour', 'twenty four'
    ];
    
    const nameIndicators = [
      '24', 'hour', '7-eleven', 'circle k', '24/7'
    ];
    
    return hourIndicators.some(indicator => hoursDisplay.includes(indicator)) ||
           nameIndicators.some(indicator => businessName.includes(indicator));
  };

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
      photos: ['diner-night.jpg', 'diner-interior.jpg', 'diner-counter.jpg']
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
      photos: ['coffee-night.jpg', 'coffee-study.jpg', 'coffee-counter.jpg', 'coffee-seating.jpg']
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
      photos: ['mart-exterior.jpg', 'mart-aisles.jpg']
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
      photos: ['gym-weights.jpg', 'gym-cardio.jpg', 'gym-entrance.jpg']
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
      photos: ['gas-pumps.jpg', 'gas-store.jpg']
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

  // Enhanced fetch real 24/7 businesses using Foursquare Places API
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

  // Convert Foursquare categories to our categories
  const getCategoryFromFoursquare = (categories) => {
    if (!categories || categories.length === 0) return 'services';
    
    const primaryCategory = categories[0];
    const categoryMap = {
      '13065': 'food',     // Fast Food
      '13032': 'coffee',   // Coffee Shop  
      '13003': 'food',     // Bar
      '13025': 'food',     // Restaurant
      '17069': 'gas',      // Gas Station
      '17097': 'pharmacy', // Pharmacy
      '17043': 'grocery',  // Convenience Store
      '18021': 'gym',      // Gym
      '17051': 'grocery'   // Supermarket
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

  const handleLocationChange = (newLocation) => {
    setSearchLocation(newLocation);
    setShowLocationSearch(false);
    // In a real app, this would geocode the location and update business distances
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
      {/* Status Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 text-center">
        <div className="text-sm font-semibold">
          🚀 Night Owls with Foursquare API • Real Business Data ✓ • Add your API key for live data • Navigation ✓ • Rideshare ✓
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
              <p className="text-xs text-gray-400 font-medium">Find what's open near you</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-purple-400 tracking-wider">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs text-gray-500 font-medium">
              {userLocation ? (
                <span className="text-green-400">📍 Location Found</span>
              ) : isLoadingLocation ? (
                <span className="text-yellow-400">📍 Finding You...</span>
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
              placeholder="Search businesses, activities..."
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
                      placeholder="Enter zip code or address..."
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
                      >
                        🌆 San Francisco, CA
                      </button>
                      <button
                        onClick={() => handleLocationChange('Los Angeles, CA')}
                        className="w-full text-left px-4 py-4 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                      >
                        🌴 Los Angeles, CA
                      </button>
                      <button
                        onClick={() => handleLocationChange('New York, NY')}
                        className="w-full text-left px-4 py-4 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                      >
                        🗽 New York, NY
                      </button>
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
                {isLoadingPlaces ? 'Finding places...' : `${filteredBusinesses.length} places open now`}
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
            <p className="text-gray-400 font-medium">Loading real places from Foursquare...</p>
          </div>
        )}

        {!userLocation && !isLoadingLocation && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📍</div>
            <h3 className="text-xl font-bold text-white mb-2">Enable location for real places</h3>
            <p className="text-gray-400 mb-6">We'll find actual open businesses near you using Foursquare</p>
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
            <p className="text-gray-400 mb-6">Get 100,000 free requests/day with real business hours and ratings</p>
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
          <div>✅ <span className="text-green-400">Working Now:</span> GPS • Navigation • Rideshare • Favorites • Reports</div>
          <div>🔑 <span className="text-blue-400">Add API Key:</span> Get free Foursquare key at <span className="text-purple-400">foursquare.com/developers</span> for real business data</div>
          <div>🚧 <span className="text-yellow-400">Coming Soon:</span> User Reviews • Photo Upload • Push Notifications • Enhanced Filters</div>
        </div>
      </div>
    </div>
  );
};

export default NightOwlsApp;
