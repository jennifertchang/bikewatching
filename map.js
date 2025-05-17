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

// Helper function to convert lon/lat to pixel coordinates
function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point); // Project to pixel coordinates
    return { cx: x, cy: y }; // Return as object for use in SVG attributes
}

// Import the data
map.on('load', async () => { // Ensures JSON data is only fetched after map is fully laoded and ready
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
        paint: {
        'line-color': 'green', // can be a hex color code or a named color
        'line-width': 2, // width of the line in pixels
        'line-opacity': 0.4, // opacity of the line
        },
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
        paint: {
        'line-color': 'blue', // can be a hex color code or a named color
        'line-width': 2, // width of the line in pixels
        'line-opacity': 0.4, // opacity of the line
        },
    });

    // Create an SVG overlay on the map for the D3 circles
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none'; // Allow map interaction to pass through
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.zIndex = '1';
    
    overlay.appendChild(svg);
    map.getContainer().appendChild(overlay);
    
    // Convert DOM element to D3 selection
    const svgSelection = d3.select(svg);

    // Fetching and parsing the CSV
    let jsonData;

    try {
      const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  
      // Await JSON fetch
      jsonData = await d3.json(jsonurl);
  
      console.log('Loaded JSON Data:', jsonData); // Log to verify structure
    } catch (error) {
      console.error('Error loading JSON:', error); // Handle errors
    }

    let stations = jsonData.data.stations;
    console.log('Stations Array:', stations); 
    
    // Move the visualization code inside the map.on('load') event
    try {
        // Load station data
        const stationsUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
        const stationsResponse = await d3.json(stationsUrl);
        let stations = stationsResponse.data.stations;
        console.log('Loaded Stations Data:', stations);

        // Load trips data
        const tripsUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv'
        const trips = await d3.csv(tripsUrl);
        console.log('Loaded JSON Data:', trips); // Log to verify structure
        
        // Calculating traffic at each station
        const departures = d3.rollup(
            trips,
            (v) => v.length,
            (d) => d.start_station_id,
        );

        const arrivals = d3.rollup(
            trips,
            (v) => v.length,
            (d) => d.end_station_id,
        );

        stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures;
            return station;
        });

        console.log('Stations with traffic data:', stations); // Log to verify structure

        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range([0, 25]);
        
        // Takes data object d (representing a single station) and passes its totalTraffic value into the radiusScale
        d => radiusScale(d.totalTraffic);

        // Get svg selection that was created in the map's load callback
        const svg = d3.select('#map').select('svg');

        // Append circles to the SVG for each station
        const circles = svg
            .selectAll('circle')
            .data(stations)
            .enter()
            .append('circle')
            .attr('r', d => radiusScale(d.totalTraffic)) // Radius of the circle
            .attr('fill', 'steelblue') // Circle fill color
            .attr('stroke', 'white') // Circle border color
            .attr('stroke-width', 1) // Circle border thickness
            .attr('opacity', 0.8) // Circle opacity
            .each(function (d) {
                // Add <title> for browser tooltips
                d3.select(this)
                    .append('title')
                    .text(
                        `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`,
                    );
            });

        
        // Function to update circle positions when the map moves/zooms
        function updatePositions() {
            circles
            .attr('cx', (d) => getCoords(d).cx) // Set the x-position using projected coordinates
            .attr('cy', (d) => getCoords(d).cy); // Set the y-position using projected coordinates
        }
        
        // Initial position update when map loads
        updatePositions();    

        // Reposition markers on map interactions
        map.on('move', updatePositions); // Update during map movement
        map.on('zoom', updatePositions); // Update during zooming
        map.on('resize', updatePositions); // Update on window resize
        map.on('moveend', updatePositions); // Final adjustment after movement ends

    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }
});