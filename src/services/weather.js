/**
 * Open-Meteo Weather Service for Shrishti AI
 * 100% free, no API key required, reliable worldwide.
 */

// WMO Weather interpretation codes (WW)
export const WMO_CODES = {
  0: { label: 'Clear sky', icon: 'sun' },
  1: { label: 'Mainly clear', icon: 'sun' },
  2: { label: 'Partly cloudy', icon: 'cloud-sun' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'cloud-fog' },
  48: { label: 'Depositing rime fog', icon: 'cloud-fog' },
  51: { label: 'Light drizzle', icon: 'cloud-drizzle' },
  53: { label: 'Moderate drizzle', icon: 'cloud-drizzle' },
  55: { label: 'Dense drizzle', icon: 'cloud-drizzle' },
  61: { label: 'Slight rain', icon: 'cloud-rain' },
  63: { label: 'Moderate rain', icon: 'cloud-rain' },
  65: { label: 'Heavy rain', icon: 'cloud-rain' },
  71: { label: 'Slight snowfall', icon: 'snowflake' },
  73: { label: 'Moderate snowfall', icon: 'snowflake' },
  75: { label: 'Heavy snowfall', icon: 'snowflake' },
  77: { label: 'Snow grains', icon: 'snowflake' },
  80: { label: 'Slight rain showers', icon: 'cloud-rain' },
  81: { label: 'Moderate rain showers', icon: 'cloud-rain' },
  82: { label: 'Violent rain showers', icon: 'cloud-rain-wind' },
  85: { label: 'Slight snow showers', icon: 'snowflake' },
  86: { label: 'Heavy snow showers', icon: 'snowflake' },
  95: { label: 'Thunderstorm', icon: 'cloud-lightning' },
  96: { label: 'Thunderstorm with slight hail', icon: 'cloud-lightning' },
  99: { label: 'Thunderstorm with heavy hail', icon: 'cloud-lightning' }
};

export function getWeatherMeta(code) {
  return WMO_CODES[code] || { label: 'Unknown weather', icon: 'cloud' };
}

/**
 * Geocode a location to get coordinates
 */
export async function geocodeLocation(location) {
  if (!location || location.trim() === '') {
    throw new Error('Location query is required');
  }

  // Primary: Open-Meteo Geocoding
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.trim())}&count=1&language=en&format=json`);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        return {
          name: item.name,
          country: item.country,
          admin1: item.admin1,
          latitude: item.latitude,
          longitude: item.longitude,
          elevation: item.elevation,
          timezone: item.timezone
        };
      }
    }
  } catch (err) {
    console.warn('Open-Meteo geocoding error:', err);
  }

  // Fallback: Nominatim OpenStreetMap
  const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location.trim())}&limit=1`;
  const nomRes = await fetch(nomUrl, {
    headers: { 'Accept': 'application/json' }
  });
  if (nomRes.ok) {
    const nomData = await nomRes.json();
    if (nomData.length > 0) {
      const first = nomData[0];
      return {
        name: first.name || location,
        country: first.display_name.split(',').pop().trim(),
        admin1: '',
        latitude: parseFloat(first.lat),
        longitude: parseFloat(first.lon),
        elevation: 0,
        timezone: 'auto'
      };
    }
  }

  throw new Error(`Could not find coordinates for location: "${location}"`);
}

/**
 * Fetch detailed weather for a city or coordinates
 */
export async function getWeather({ location, latitude, longitude }) {
  let lat = latitude;
  let lon = longitude;
  let locMeta = { name: location || 'Current Location', country: '', admin1: '' };

  if (lat === undefined || lon === undefined) {
    if (!location) {
      throw new Error('Either location name or latitude/longitude is required.');
    }
    const geocoded = await geocodeLocation(location);
    lat = geocoded.latitude;
    lon = geocoded.longitude;
    locMeta = geocoded;
  }

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&timezone=auto`;

  const response = await fetch(weatherUrl);
  if (!response.ok) {
    throw new Error(`Open-Meteo API returned HTTP status ${response.status}`);
  }

  const data = await response.json();
  const current = data.current;
  const currentMeta = getWeatherMeta(current.weather_code);

  // Parse Hourly (next 24 entries)
  const hourly = [];
  if (data.hourly && data.hourly.time) {
    const currentHourIndex = Math.max(0, data.hourly.time.findIndex(t => new Date(t) >= new Date()));
    const sliceEnd = Math.min(data.hourly.time.length, currentHourIndex + 24);

    for (let i = currentHourIndex; i < sliceEnd; i++) {
      const code = data.hourly.weather_code[i];
      hourly.push({
        time: data.hourly.time[i],
        hourFormatted: new Date(data.hourly.time[i]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        temperature: Math.round(data.hourly.temperature_2m[i]),
        precipitationProb: data.hourly.precipitation_probability ? data.hourly.precipitation_probability[i] : 0,
        weatherCode: code,
        condition: getWeatherMeta(code).label,
        icon: getWeatherMeta(code).icon
      });
    }
  }

  // Parse 7-day Daily Forecast
  const daily = [];
  if (data.daily && data.daily.time) {
    for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
      const code = data.daily.weather_code[i];
      const date = new Date(data.daily.time[i]);
      const dayName = i === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' });

      daily.push({
        date: data.daily.time[i],
        dayName,
        maxTemp: Math.round(data.daily.temperature_2m_max[i]),
        minTemp: Math.round(data.daily.temperature_2m_min[i]),
        precipitationProbMax: data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[i] : 0,
        sunrise: data.daily.sunrise ? new Date(data.daily.sunrise[i]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        sunset: data.daily.sunset ? new Date(data.daily.sunset[i]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        weatherCode: code,
        condition: getWeatherMeta(code).label,
        icon: getWeatherMeta(code).icon
      });
    }
  }

  return {
    location: locMeta.name,
    country: locMeta.country,
    admin1: locMeta.admin1,
    coordinates: { latitude: lat, longitude: lon },
    timezone: data.timezone,
    elevation: data.elevation,
    current: {
      temperature: Math.round(current.temperature_2m),
      apparentTemperature: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      precipitation: current.precipitation,
      isDay: current.is_day === 1,
      weatherCode: current.weather_code,
      condition: currentMeta.label,
      icon: currentMeta.icon
    },
    todaySunrise: daily[0]?.sunrise || '',
    todaySunset: daily[0]?.sunset || '',
    hourly,
    daily
  };
}

