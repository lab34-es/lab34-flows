// THIS HELPER GENERATES RANDOM DATA FOR USE IN REQUESTS AND TESTS USING
// HANDLEBARS TEMPLATES.

const handlebars = require('handlebars');
const { faker } = require('@faker-js/faker');

const belgianCitiesEn = [
  "Brussels",
  "Antwerp",
  "Ghent",
  "Bruges",
  "Liège",
  "Namur",
  "Leuven",
  "Mons",
  "Aalst",
  "Mechelen",
  "La Louvière",
  "Kortrijk",
  "Hasselt",
  "Ostend",
  "Sint-Niklaas",
  "Tournai",
  "Genk",
  "Seraing",
  "Roeselare",
  "Verviers",
  "Mouscron",
  "Beveren",
  "Dendermonde",
  "Beringen",
  "Turnhout",
  "Dilbeek",
  "Heist-op-den-Berg",
  "Sint-Truiden",
  "Lokeren",
  "Herstal",
  "Maasmechelen",
  "Châtelet",
  "Halle",
  "Hoboken",
  "Schoten",
  "Harelbeke",
  "Knokke-Heist",
  "Grimbergen",
  "Geel",
  "Mol",
  "Brasschaat",
  "Temse",
  "Oudenaarde",
  "Geraardsbergen",
  "Vilvoorde",
  "Lommel",
  "Tienen",
  "Diest",
  "Izegem",
  "Evergem",
  "Ronse",
  "Binche",
  "Menen",
  "Ath",
  "Waregem",
  "Tongeren",
  "Aarschot",
  "Bastogne",
  "Ninove",
  "Zottegem",
  "Huy",
  "Courcelles",
  "Bilzen",
  "Zwevegem",
  "Herentals",
  "Borgloon",
  "Eeklo",
  "Zaventem",
  "Wavre",
  "Lier",
  "Deinze",
  "Ypres",
  "Leuven",
  "Mechelen",
  "Aarschot",
  "Tienen",
  "Diest",
  "Hasselt",
  "Genk",
  "Tongeren",
  "Sint-Truiden",
  "Beringen",
  "Lommel",
  "Maaseik",
  "Bilzen"
];

/**
 * Generates a barcode by combining static and random parts
 * 
 * @param {Array} parts - Array of strings and numbers, where numbers will be replaced with random digits
 * @returns {string} - Generated barcode string
 */
const barcode = (parts) => {
  return parts.map(part => {
    if (typeof part === 'number') return Array.from({length: part}, () => Math.floor(Math.random() * 10)).join('');
    if (typeof part === 'string') return part;
    return part;
  }).join('');
}

/**
 * Generates an object with default values including timestamps, random integers, and other random data.
 * 
 * @returns {Object} An object containing the following properties:
 * - `timestamp` {number}: Current timestamp in milliseconds.
 * - `datetime` {string}: Current date and time in ISO format.
 * - `randomInt` {number}: Random integer between 0 and 999.
 * - `randomInt0_5` {number}: Random integer between 0 and 4.
 * - `randomInt0_10` {number}: Random integer between 0 and 9.
 * - `randomInt0_100` {number}: Random integer between 0 and 99.
 * - `randomInt0_200` {number}: Random integer between 0 and 199.
 * - `randomInt0_300` {number}: Random integer between 0 and 299.
 * - `randomInt0_500` {number}: Random integer between 0 and 499.
 * - `randomInt0_1000` {number}: Random integer between 0 and 999.
 * - `randomInt0_9999` {number}: Random integer between 0 and 9998.
 * - `randomInt0_2000` {number}: Random integer between 0 and 1999.
 * - `randomInt0_3000` {number}: Random integer between 0 and 2999.
 * - `randomInt0_4000` {number}: Random integer between 0 and 3999.
 * - `randomInt0_5000` {number}: Random integer between 0 and 4999.
 * - `uuid` {string}: Random UUID.
 * - `randomPostmanId` {string}: Random 6-digits integer.
 * - `randomEmail` {string}: Random email address.
 * - `randomName` {string}: Random person full name.
 * - `randomCompanyName` {string}: Random company name.
 * - `randomStreet` {string}: Random street name.
 * - `randomStreetNumber` {number}: Random street number between 0 and 199.
 * - `randomPostalCode` {string}: Random 4-digit postal code.
 * - `belgianCityEn` {string}: Random Belgian city name in English.
 * - `randomPersonName` {string}: Random person first name.
 * - `randomPersonSurname` {string}: Random person last name.
 * - `randomPersonPrefix` {string}: Random person name prefix.
 * - `phoneIntl` {string}: Random phone number in international format.
 */
const values = () => {
  return {
    // Current timestamp in milliseconds
    timestamp: new Date().getTime(),
    // Current date and time in ISO format
    datetime: new Date().toISOString(),
    // Random integers within specified ranges
    randomInt: Math.floor(Math.random() * 1000),
    randomInt0_5: Math.floor(Math.random() * 5),
    randomInt0_10: Math.floor(Math.random() * 10),
    randomInt0_100: Math.floor(Math.random() * 100),
    randomInt0_200: Math.floor(Math.random() * 200),
    randomInt0_300: Math.floor(Math.random() * 300),
    randomInt0_500: Math.floor(Math.random() * 500),
    randomInt0_1000: Math.floor(Math.random() * 1000),
    randomInt0_9999: Math.floor(Math.random() * 9999),
    randomInt0_2000: Math.floor(Math.random() * 2000),
    randomInt0_3000: Math.floor(Math.random() * 3000),
    randomInt0_4000: Math.floor(Math.random() * 4000),
    randomInt0_5000: Math.floor(Math.random() * 5000),

    uuid: faker.string.uuid(),

    // Random 6-digits integer
    randomPostmanId: Math.floor(Math.random() * 900000) + 100000,

    randomEmail: faker.internet.email(),
    randomName: `${faker.person.firstName()} ${faker.person.lastName()}`,

    randomBarcode: barcode(['ABC', 10]),

    // Companies
    randomCompanyName: faker.company.name(),

    // Addresses
    randomStreet: faker.location.street(),
    randomStreetNumber: Math.floor(Math.random() * 200),
    randomPostalCode: faker.location.zipCode('####'),
    belgianCityEn: belgianCitiesEn[Math.floor(Math.random() * belgianCitiesEn.length)],

    // Person
    randomPersonName: faker.person.firstName(),
    randomPersonSurname: faker.person.lastName(),
    randomPersonPrefix: faker.person.prefix(),

    // Number
    phoneIntl: faker.phone.number({ style: 'international' })
  }
}

module.exports.values = values;

/**
 * Processes a JSON input string or object with Handlebars templating
 * 
 * @param {string|Object} input - JSON template string or object to process
 * @param {Object} data - Additional data to merge with the default values for template processing
 * @returns {Object} - Processed JSON object after template rendering
 * @throws {Error} - If the resulting template cannot be parsed as JSON
 */
module.exports.json = (input, data) => {
  // Convert object to string if needed
  if (typeof input === 'object') {
    input = JSON.stringify(input);
  }
  
  // Initialize data object if not provided
  if (!data) data = {}
  data = Object.assign({}, data);
  
  // Compile and process the Handlebars template
  const template = handlebars.compile(input);
  const finalValue = template(Object.assign({}, data, values()));
  
  try {
    return JSON.parse(finalValue);
  }
  catch (e) {
    throw e
  }
}

/**
 * Processes a string with Handlebars templating
 * 
 * @param {string} input - String template to process
 * @param {Object} data - Additional data to merge with the default values for template processing
 * @returns {string} - Processed string after template rendering
 */
module.exports.string = (input, data) => {
  if (!data) data = {}
  const template = handlebars.compile(input);
  return template(Object.assign({}, data, values()));
}

/**
 * Attempts to process input as either JSON or string with Handlebars templating
 * 
 * @param {string} input - Template string to process (can be JSON or plain string)
 * @param {Object} values - Additional data to merge with the default values for template processing
 * @returns {Object|string} - Processed result, either as JSON object or string
 */
module.exports.any = (input, values) => {
  if (!values) values = {}
  
  // Skip empty input
  input = input && input.trim();
  if (!input) return input;
  let result = null;

  // Try JSON first, fallback to string if that fails
  try {
    result = this.json(input, values);
  }
  catch (e) {
    result = this.string(input, values);
  }

  return result ? result : input;
}
