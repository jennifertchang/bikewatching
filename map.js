// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
// Import D3 as an ES Module
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoianRjMDA2IiwiYSI6ImNtYXI4a2ozYzAzcjkyanE0bHd3NmR2dTEifQ.fkwpK1h4RZIvx2e6FPHT0w';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});

// GLOBAL Helper function to convert lon/lat to pixel coordinates
function getCoords(station) {
  try {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point); // Project to pixel coordinates
    return { cx: x, cy: y }; // Return as object for use in SVG attributes
  } catch (error) {
    console.error('Error in getCoords:', error);
    return { cx: 0, cy: 0 }; // Return default values in case of error
  }
}

// GLOBAL Helper function to format time properly
function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes); // Set hours & minutes
  return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

// GLOBAL helper function to convert Date to minutes since midnight
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Helper function to filter trips by time - using the approach from code #1 and #2
function filterTripsbyTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips // If no filter is applied (-1), return all trips
    : trips.filter((trip) => {
        // Convert trip start and end times to minutes since midnight
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);

        // Include trips that started or ended within 60 minutes of the selected time
        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
      });
}

// GLOBAL function to compute station traffic - using short_name like codes #1 and #2
function computeStationTraffic(stations, trips) {
  // Compute departures
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );

  // Compute arrivals
  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );

  // Update each station with traffic data
  return stations.map((station) => {
    let id = station.short_name; // Use short_name to match working codes
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = (station.arrivals + station.departures) ?? 0;
    return station;
  });
}

// Import the data
map.on('load', async () => { // Ensures JSON data is only fetched after map is fully loaded and ready
  // Define bike lane style like in code #2
  const bikeLaneStyle = {
    'line-color': '#32D400', // Bright green
    'line-width': 5, // Thicker lines
    'line-opacity': 0.6, // 60% opacity
  };

  // BOSTON
  // Adding the Data Source with addSource
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  // Visualizing Data with addLayer
  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: bikeLaneStyle,
  });

  console.log('Boston route data loaded');

  // CAMBRIDGE
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: bikeLaneStyle,
  });

  // Create/select SVG overlay using d3.select like in codes #1 and #2
  let svg = d3.select('#map').select('svg');
  if (svg.empty()) {
    svg = d3.select('#map').append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('position', 'absolute')
      .style('top', 0)
      .style('left', 0);
  }

  try {
    // Load station data
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    const jsonData = await d3.json(jsonurl);
    console.log('Loaded JSON Data:', jsonData);
    
    let stations = jsonData.data.stations;
    console.log('Stations Array:', stations);

    // Load trips data with parsing dates
    const tripsUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
    let trips = await d3.csv(tripsUrl, (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      return trip;
    });
    console.log('Loaded Trips Data:', trips);
    
    // Compute station traffic
    stations = computeStationTraffic(stations, trips);
    console.log('Stations with traffic data:', stations);
    
    // Create radius scale
    const radiusScale = d3
      .scaleSqrt()
      .domain([0, d3.max(stations, d => d.totalTraffic)])
      .range([0, 25]);
      
    // Create flow scale like in codes #1 and #2
    let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
    
    // Append circles to the SVG for each station
    const circles = svg
      .selectAll('circle')
      .data(stations, (d) => d.short_name) // Use short_name as key to match other codes
      .enter()
      .append('circle')
      .attr('r', d => radiusScale(d.totalTraffic)) // Set the radius based on traffic
      .attr('fill-opacity', 0.6)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .style('--departure-ratio', (d) => {
        // Handle division by zero
        if (d.totalTraffic === 0) return 0.5;
        return stationFlow(d.departures / d.totalTraffic);
      })
      .each(function (d) {
        // Add <title> for browser tooltips
        d3.select(this)
          .append('title')
          .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      });
    
    // Add custom tooltip functionality if you prefer it over browser tooltips
    // This is optional since we're now using SVG title elements
    const tooltip = d3.select('#tooltip');
    if (!tooltip.empty()) {
      circles
        .on('mouseover', function (event, d) {
          tooltip
            .style('display', 'block')
            .html(`
              <strong>${d.name}</strong><br>
              ${d.totalTraffic} trips<br>
              ${d.departures} departures<br>
              ${d.arrivals} arrivals
            `);
          d3.select(this).attr('stroke-width', 2);
        })
        .on('mousemove', function (event) {
          tooltip
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 20) + 'px');
        })
        .on('mouseout', function () {
          tooltip.style('display', 'none');
          d3.select(this).attr('stroke-width', 1);
        });
    }
    
    // Function to update circle positions when the map moves/zooms
    function updatePositions() {
      try {
        circles
          .attr('cx', (d) => getCoords(d).cx)
          .attr('cy', (d) => getCoords(d).cy);
      } catch (error) {
        console.error('Error in updatePositions:', error);
      }
    }
    
    // Initial position update
    updatePositions();   

    // Reposition markers on map interactions
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);
    
    // Dynamically update scatterplot based on selected time-filter
    function updateScatterPlot(timeFilter) {
      // Filter trips based on time
      const filteredTrips = filterTripsbyTime(trips, timeFilter);
      
      // Recompute station traffic based on the filtered trips
      const filteredStations = computeStationTraffic(stations, filteredTrips);
      
      // Adjust the radius scale based on time filter
      timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);
      
      // Update the scatterplot by adjusting the radius of circles
      circles
        .data(filteredStations, (d) => d.short_name)
        .join('circle')
        .attr('r', d => radiusScale(d.totalTraffic))
        .style('--departure-ratio', (d) => {
          // Handle division by zero
          if (d.totalTraffic === 0) return 0.5;
          return stationFlow(d.departures / d.totalTraffic);
        })
        .each(function (d) {
          // Update tooltip text
          d3.select(this)
            .select('title')
            .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        });
      
      // Update positions after changing the data
      updatePositions();
    }

    // Time slider setup - using the correct element IDs as in codes #1 and #2
    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('selected-time');
    const anyTimeLabel = document.getElementById('any-time');
    
    // Function to update time display and filter data
    function updateTimeDisplay() {
      let timeFilter = Number(timeSlider.value); // Get slider value
      
      if (timeFilter === -1) {
        selectedTime.textContent = ''; // Clear time display
        anyTimeLabel.style.display = 'block'; // Show "(any time)"
      } else {
        selectedTime.textContent = formatTime(timeFilter); // Display formatted time
        anyTimeLabel.style.display = 'none'; // Hide "(any time)"
      }
      
      // Call updateScatterPlot to reflect the changes on the map
      updateScatterPlot(timeFilter);
    }
    
    // Add event listener and initialize
    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();

  } catch (error) {
    console.error('Error loading or processing data:', error);
  }
});