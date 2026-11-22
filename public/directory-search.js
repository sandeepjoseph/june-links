// Scotland's council areas follow the Scottish Government's local-authority list.
// https://www.gov.scot/publications/findings-report-review-participation-requests-part-3-community-empowerment-scotland-act-2015/pages/7/
const scottishPlaces = new Set([
  'Aberdeen City', 'Aberdeenshire', 'Angus', 'Argyll and Bute', 'Clackmannanshire',
  'Dumfries and Galloway', 'Dundee City', 'East Ayrshire', 'East Dunbartonshire',
  'East Lothian', 'East Renfrewshire', 'City of Edinburgh', 'Edinburgh', 'Falkirk',
  'Fife', 'Glasgow City', 'Highland', 'Inverclyde', 'Midlothian', 'Moray',
  'Na h-Eilean an Siar', 'North Ayrshire', 'North Lanarkshire', 'Orkney Islands',
  'Perth and Kinross', 'Renfrewshire', 'Scottish Borders', 'Shetland Islands',
  'South Ayrshire', 'South Lanarkshire', 'Stirling', 'West Dunbartonshire',
  'West Lothian', 'Inverness', 'Wishaw'
]);
const aliases = {
  'United States': ['USA', 'US', 'America', 'United States of America'],
  'United Kingdom': ['UK'],
  Netherlands: ['Holland'], Switzerland: ['Swiss'],
  'United Arab Emirates': ['UAE'], 'South Korea': ['Republic of Korea'],
  Czechia: ['Czech Republic']
};
const ukNations = new Set(['England', 'Scotland', 'Wales', 'Northern Ireland']);
export const normalize = value => String(value || '').normalize('NFD')
  .replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
export const countryAliases = country => aliases[country] || [];

export function prepareVenue(venue) {
  const {country, region, state, locality, name} = venue;
  const nation = country === 'United Kingdom' ? [state, region].find(place => ukNations.has(place)) ||
    ([region, state, locality].some(place => scottishPlaces.has(place)) ? 'Scotland' :
      region === 'Monmouthshire' ? 'Wales' : '') : '';
  const places = [...new Set([locality, region, state, nation].filter(Boolean))];
  const countryKeys = [country, ...countryAliases(country)].map(normalize);
  const nameKey = normalize(name);
  const placeKeys = places.map(normalize);
  const words = [...new Set([nameKey, ...countryKeys, ...placeKeys].join(' ').split(' '))];
  return {...venue, nation, places, nameKey, countryKeys, placeKeys, words};
}

export function searchVenues(venues, {query = '', country = '', region = ''} = {}) {
  const value = normalize(query);
  const terms = value.split(' ').filter(Boolean);
  const isGeography = value && venues.some(venue => venue.countryKeys.includes(value) || venue.placeKeys.includes(value));
  const regionKey = normalize(region);
  const matches = [];
  for (const venue of venues) {
    if ((country && venue.country !== country) || (regionKey && !venue.placeKeys.includes(regionKey))) continue;
    const exactPlace = venue.countryKeys.includes(value) || venue.placeKeys.includes(value);
    const exactName = venue.nameKey === value;
    if (isGeography ? !exactPlace && !exactName : !terms.every(term => venue.words.some(word => word.startsWith(term)))) continue;
    const score = !value || exactName ? 0 : exactPlace ? 1 : venue.nameKey.startsWith(value) ? 2 : 3;
    matches.push({venue, score});
  }
  return matches.sort((a, b) => a.score - b.score).map(match => match.venue);
}
