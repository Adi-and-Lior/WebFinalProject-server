const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

/* ---------- Global in-memory storage for cities and streets data ---------- */
let allCities = [];
let allStreets = [];

/* ---------- Loads all cities and streets data from data.gov.il at server startup ---------- */
async function loadAllGeoData() {
    console.log('Server: Starting to load geo data from data.gov.il...');
    try {
        const citiesUrl = 'https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=100000'; /* ---------- Increased limit for large data ---------- */
        const citiesResponse = await fetch(citiesUrl);
        const citiesData = await citiesResponse.json();

        if (!citiesData.success) {
            console.error('Server: Failed to fetch cities data from external API.');
            return;
        }

        allCities = citiesData.result.records
            .map(r => r.שם_ישוב)
            .filter((v, i, a) => a.indexOf(v) === i) /* ---------- Removes duplicates ---------- */
            .sort();

        console.log(`Server: Loaded ${allCities.length} unique cities.`);

        const streetsResourceId = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';
        const streetsUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=${streetsResourceId}&limit=100000`; /* ---------- Increased limit for large data ---------- */
        const streetsResponse = await fetch(streetsUrl);
        const streetsData = await streetsResponse.json();

        if (!streetsData.success) {
            console.error('Server: Failed to fetch streets data from external API.');
            return;
        }

        allStreets = streetsData.result.records
            .map(r => ({
                city: r.שם_ישוב,
                street: r.שם_רחוב
            }))
            .filter(item => item.city && item.street); /* ---------- Filter out invalid records ---------- */

        console.log(`Server: Loaded ${allStreets.length} street records.`);
    } catch (err) {
        console.error('Server: Error loading geo data on startup:', err.message);
    }
}

/* ---------- Returns the cached list of unique cities ---------- */
function getCities() {
    return allCities;
}

/* ---------- Returns the cached list of all street records ---------- */
function getStreets() {
    return allStreets;
}

module.exports = {
    loadAllGeoData,
    getCities,
    getStreets
};

