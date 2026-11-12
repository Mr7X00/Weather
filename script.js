const weatherForm = document.getElementById("weatherForm");
const cityInput = document.getElementById("cityInput");
const message = document.getElementById("message");
const weatherInfo = document.getElementById("weatherInfo");
const suggestions = document.getElementById("suggestions");

const searchBtn = weatherForm.querySelector("button");

// Selected city coordinates
let selectedLocation = null;

// Autocomplete variables
let debounceTimer;
let activeIndex = -1;
let currentSuggestions = [];
let suggestionController = null;


// Indian States and Union Territories
// State name: Capital name

const INDIAN_STATES = {
    "Andhra Pradesh": "Amaravati",
    "Arunachal Pradesh": "Itanagar",
    "Assam": "Dispur",
    "Bihar": "Patna",
    "Chhattisgarh": "Raipur",
    "Goa": "Panaji",
    "Gujarat": "Gandhinagar",
    "Haryana": "Chandigarh",
    "Himachal Pradesh": "Shimla",
    "Jharkhand": "Ranchi",
    "Karnataka": "Bengaluru",
    "Kerala": "Thiruvananthapuram",
    "Madhya Pradesh": "Bhopal",
    "Maharashtra": "Mumbai",
    "Manipur": "Imphal",
    "Meghalaya": "Shillong",
    "Mizoram": "Aizawl",
    "Nagaland": "Kohima",
    "Odisha": "Bhubaneswar",
    "Punjab": "Chandigarh",
    "Rajasthan": "Jaipur",
    "Sikkim": "Gangtok",
    "Tamil Nadu": "Chennai",
    "Telangana": "Hyderabad",
    "Tripura": "Agartala",
    "Uttar Pradesh": "Lucknow",
    "Uttarakhand": "Dehradun",
    "West Bengal": "Kolkata",
    "Andaman and Nicobar Islands": "Port Blair",
    "Chandigarh": "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu": "Daman",
    "Delhi": "New Delhi",
    "Jammu and Kashmir": "Srinagar",
    "Ladakh": "Leh",
    "Lakshadweep": "Kavaratti",
    "Puducherry": "Puducherry"
};


// ======================================
// CITY AUTOCOMPLETE
// ======================================

cityInput.addEventListener("input", () => {

    const query = cityInput.value.trim();

    selectedLocation = null;

    clearTimeout(debounceTimer);

    activeIndex = -1;

    if (query.length < 2) {
        hideSuggestions();
        return;
    }

    debounceTimer = setTimeout(() => {
        searchCities(query);
    }, 300);

});


// Search Indian Cities using Geocoding API

async function searchCities(query) {

    if (suggestionController) {
        suggestionController.abort();
    }

    suggestionController = new AbortController();

    suggestions.innerHTML = `
        <div class="suggestion-loading">
            Searching locations...
        </div>
    `;

    suggestions.classList.remove("d-none");

    try {

        const url =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json&countryCode=IN`;

        const response = await fetch(url, {
            signal: suggestionController.signal
        });

        if (!response.ok) {
            throw new Error("Unable to search locations.");
        }

        const data = await response.json();

        let cityResults = (data.results || []).filter(
            location => location.country_code === "IN"
        );

        // Remove duplicate locations
        const uniqueCities = [];

        const seen = new Set();

        cityResults.forEach(location => {

            const key =
                `${location.name}-${location.admin1}-${location.latitude}-${location.longitude}`;

            if (!seen.has(key)) {
                seen.add(key);
                uniqueCities.push(location);
            }

        });

        // Add matching Indian states and UTs
        const matchingStates = Object.entries(INDIAN_STATES)
            .filter(([state]) =>
                state.toLowerCase().includes(query.toLowerCase())
            )
            .map(([state, capital]) => ({
                name: capital,
                admin1: state,
                country: "India",
                country_code: "IN",
                isState: true
            }));

        currentSuggestions = [
            ...matchingStates,
            ...uniqueCities
        ].slice(0, 12);

        if (currentSuggestions.length === 0) {

            suggestions.innerHTML = `
                <div class="suggestion-loading">
                    No Indian city found.
                </div>
            `;

            return;
        }

        displaySuggestions(currentSuggestions);

    } catch (error) {

        if (error.name === "AbortError") return;

        suggestions.innerHTML = `
            <div class="suggestion-loading">
                Unable to load suggestions.
            </div>
        `;

    }

}


// Display City Suggestions

function displaySuggestions(locations) {

    suggestions.innerHTML = "";

    locations.forEach((location, index) => {

        const item = document.createElement("div");

        item.className = "suggestion-item";

        const cityName = document.createElement("div");
        cityName.className = "suggestion-name";

        cityName.textContent = location.isState
            ? `${location.admin1} (State / UT)`
            : location.name;

        const address = document.createElement("div");
        address.className = "suggestion-address";

        address.textContent = location.isState
            ? `Capital: ${location.name}, India`
            : [
                location.admin2,
                location.admin1,
                location.country
            ].filter(Boolean).join(", ");

        item.appendChild(cityName);
        item.appendChild(address);

        // Select suggestion
        item.addEventListener("mousedown", event => {
            event.preventDefault();
            selectLocation(location);
        });

        suggestions.appendChild(item);

    });

    suggestions.classList.remove("d-none");

}


// Select City or State

async function selectLocation(location) {

    hideSuggestions();

    try {

        let finalLocation = location;

        // If user selects a state, find its capital coordinates
        if (location.isState) {

            const url =
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.name)}&count=10&language=en&format=json&countryCode=IN`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error("Unable to find state capital.");
            }

            const data = await response.json();

            const capital = (data.results || []).find(
                item => item.country_code === "IN"
            );

            if (!capital) {
                throw new Error("State capital not found.");
            }

            finalLocation = capital;
        }

        selectedLocation = finalLocation;

        cityInput.value = location.isState
            ? `${location.admin1} - ${location.name}`
            : location.name;

    } catch (error) {

        showMessage(error.message, "danger");
        selectedLocation = null;

    }

}


// Hide Suggestions

function hideSuggestions() {
    suggestions.classList.add("d-none");
    activeIndex = -1;
}


// Keyboard Navigation

cityInput.addEventListener("keydown", event => {

    const items = suggestions.querySelectorAll(".suggestion-item");

    if (suggestions.classList.contains("d-none") || !items.length) {
        return;
    }

    if (event.key === "ArrowDown") {

        event.preventDefault();

        activeIndex = (activeIndex + 1) % items.length;

    } else if (event.key === "ArrowUp") {

        event.preventDefault();

        activeIndex = activeIndex <= 0
            ? items.length - 1
            : activeIndex - 1;

    } else if (event.key === "Escape") {

        hideSuggestions();
        return;

    } else if (event.key === "Enter" && activeIndex >= 0) {

        event.preventDefault();
        items[activeIndex].dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true })
        );

        return;

    } else {
        return;
    }

    items.forEach((item, index) => {
        item.classList.toggle("active", index === activeIndex);
    });

    items[activeIndex].scrollIntoView({
        block: "nearest"
    });

});


// Hide suggestions when clicking outside

document.addEventListener("click", event => {

    if (!event.target.closest(".search-wrapper")) {
        hideSuggestions();
    }

});


// ======================================
// WEATHER SEARCH
// ======================================

weatherForm.addEventListener("submit", async event => {

    event.preventDefault();

    const city = cityInput.value.trim();

    if (!city) {
        showMessage("Please enter a city name.", "danger");
        return;
    }

    searchBtn.disabled = true;
    searchBtn.textContent = "Loading...";

    weatherInfo.classList.add("d-none");

    hideSuggestions();

    showMessage("", "success");

    try {

        let location = selectedLocation;

        // If no autocomplete suggestion was selected,
        // search the typed city through geocoding API.

        if (!location) {

            const geoURL =
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json&countryCode=IN`;

            const geoResponse = await fetch(geoURL);

            if (!geoResponse.ok) {
                throw new Error("Unable to connect to location service.");
            }

            const geoData = await geoResponse.json();

            if (!geoData.results || geoData.results.length === 0) {
                throw new Error("Indian city not found. Try another city.");
            }

            location = geoData.results.find(
                item => item.country_code === "IN"
            );

            if (!location) {
                throw new Error("Please select a valid Indian city.");
            }

        }

        // Get Weather Information

        const weatherURL =
            `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;

        const weatherResponse = await fetch(weatherURL);

        if (!weatherResponse.ok) {
            throw new Error("Unable to retrieve weather information.");
        }

        const weatherData = await weatherResponse.json();

        if (!weatherData.current) {
            throw new Error("Weather data is currently unavailable.");
        }

        displayWeather(location, weatherData.current);

        weatherInfo.classList.remove("d-none");

        showMessage("Weather updated successfully.", "success");

    } catch (error) {

        showMessage(error.message, "danger");

    } finally {

        searchBtn.disabled = false;
        searchBtn.textContent = "Search";

    }

});


// ======================================
// DISPLAY WEATHER
// ======================================

function displayWeather(location, current) {

    document.getElementById("cityName").textContent =
        location.name;

    document.getElementById("cityAddress").textContent =
        [
            location.admin2,
            location.admin1,
            location.country
        ].filter(Boolean).join(", ");

    document.getElementById("temperature").textContent =
        `${current.temperature_2m}°C`;

    document.getElementById("humidity").textContent =
        `${current.relative_humidity_2m}%`;

    document.getElementById("wind").textContent =
        `${current.wind_speed_10m} km/h`;

    document.getElementById("feelsLike").textContent =
        `${current.apparent_temperature}°C`;

    document.getElementById("precipitation").textContent =
        `${current.precipitation} mm`;

    document.getElementById("condition").textContent =
        getWeatherCondition(current.weather_code);

    document.getElementById("weatherIcon").textContent =
        getWeatherIcon(current.weather_code);

}


// ======================================
// WEATHER CONDITIONS
// ======================================

function getWeatherCondition(code) {

    if (code === 0) return "Clear Sky";

    if ([1, 2, 3].includes(code)) return "Partly Cloudy";

    if ([45, 48].includes(code)) return "Foggy";

    if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";

    if ([61, 63, 65, 66, 67].includes(code)) return "Rain";

    if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";

    if ([80, 81, 82].includes(code)) return "Rain Showers";

    if ([95, 96, 99].includes(code)) return "Thunderstorm";

    return "Unknown Condition";

}


// ======================================
// WEATHER ICONS
// ======================================

function getWeatherIcon(code) {

    if (code === 0) return "☀";

    if ([1, 2, 3].includes(code)) return "☁";

    if ([45, 48].includes(code)) return "≋";

    if ([51, 53, 55, 56, 57].includes(code)) return "☂";

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "☂";

    if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";

    if ([95, 96, 99].includes(code)) return "⚡";

    return "☁";

}


// ======================================
// MESSAGE HANDLER
// ======================================

function showMessage(text, type) {

    message.textContent = text;

    message.className = text
        ? `alert alert-${type} text-center`
        : "";

}
