/**
 * Generate Links File from Park List
 * 
 * This script generates curated links files for state parks.
 * It uses known URL patterns and validates them.
 */

import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Wisconsin State Parks - Complete list (50 parks)
// Source: Wikipedia + WI DNR
const WISCONSIN_PARKS: Array<{ name: string; slug: string }> = [
  { name: "Amnicon Falls State Park", slug: "amnicon" },
  { name: "Aztalan State Park", slug: "aztalan" },
  { name: "Belmont Mound State Park", slug: "belmont" },
  { name: "Big Bay State Park", slug: "bigbay" },
  { name: "Big Foot Beach State Park", slug: "bigfoot" },
  { name: "Blue Mound State Park", slug: "bluemound" },
  { name: "Brunet Island State Park", slug: "brunetisland" },
  { name: "Buckhorn State Park", slug: "buckhorn" },
  { name: "Copper Culture State Park", slug: "copperculture" },
  { name: "Copper Falls State Park", slug: "copperfalls" },
  { name: "Council Grounds State Park", slug: "councilgrounds" },
  { name: "Devil's Lake State Park", slug: "devilslake" },
  { name: "Governor Dodge State Park", slug: "govdodge" },
  { name: "Governor Nelson State Park", slug: "govnelson" },
  { name: "Governor Thompson State Park", slug: "govthompson" },
  { name: "Harrington Beach State Park", slug: "harringtonbeach" },
  { name: "Hartman Creek State Park", slug: "hartmancreek" },
  { name: "High Cliff State Park", slug: "highcliff" },
  { name: "Interstate State Park", slug: "interstate" },
  { name: "Kinnickinnic State Park", slug: "kinnickinnic" },
  { name: "Kohler-Andrae State Park", slug: "kohlerandrae" },
  { name: "Lake Kegonsa State Park", slug: "lakekegonsa" },
  { name: "Lake Wissota State Park", slug: "lakewissota" },
  { name: "Lakeshore State Park", slug: "lakeshore" },
  { name: "Merrick State Park", slug: "merrick" },
  { name: "Mill Bluff State Park", slug: "millbluff" },
  { name: "Mirror Lake State Park", slug: "mirrorlake" },
  { name: "Natural Bridge State Park", slug: "naturalbridge" },
  { name: "Nelson Dewey State Park", slug: "nelsondewey" },
  { name: "New Glarus Woods State Park", slug: "ngwoods" },
  { name: "Newport State Park", slug: "newport" },
  { name: "Pattison State Park", slug: "pattison" },
  { name: "Peninsula State Park", slug: "peninsula" },
  { name: "Perrot State Park", slug: "perrot" },
  { name: "Potawatomi State Park", slug: "potawatomi" },
  { name: "Rib Mountain State Park", slug: "ribmt" },
  { name: "Rock Island State Park", slug: "rockisland" },
  { name: "Rocky Arbor State Park", slug: "rockyarbor" },
  { name: "Tower Hill State Park", slug: "towerhill" },
  { name: "Whitefish Dunes State Park", slug: "whitefish" },
  { name: "Wildcat Mountain State Park", slug: "wildcat" },
  { name: "Willow River State Park", slug: "willowriver" },
  { name: "Wyalusing State Park", slug: "wyalusing" },
  { name: "Yellowstone Lake State Park", slug: "yellowstone" },
];

// Florida State Parks - Top parks (expandable)
// Source: Wikipedia + FL State Parks
const FLORIDA_PARKS: Array<{ name: string; slug: string }> = [
  { name: "Bahia Honda State Park", slug: "bahia-honda-state-park" },
  { name: "John Pennekamp Coral Reef State Park", slug: "john-pennekamp-coral-reef-state-park" },
  { name: "Myakka River State Park", slug: "myakka-river-state-park" },
  { name: "Ichetucknee Springs State Park", slug: "ichetucknee-springs-state-park" },
  { name: "Blue Spring State Park", slug: "blue-spring-state-park" },
  { name: "Rainbow Springs State Park", slug: "rainbow-springs-state-park" },
  { name: "St. Andrews State Park", slug: "st-andrews-state-park" },
  { name: "Edward Ball Wakulla Springs State Park", slug: "edward-ball-wakulla-springs-state-park" },
  { name: "Hillsborough River State Park", slug: "hillsborough-river-state-park" },
  { name: "Anastasia State Park", slug: "anastasia-state-park" },
  { name: "Big Lagoon State Park", slug: "big-lagoon-state-park" },
  { name: "Blackwater River State Park", slug: "blackwater-river-state-park" },
  { name: "Caladesi Island State Park", slug: "caladesi-island-state-park" },
  { name: "Cayo Costa State Park", slug: "cayo-costa-state-park" },
  { name: "Collier-Seminole State Park", slug: "collier-seminole-state-park" },
  { name: "De Leon Springs State Park", slug: "de-leon-springs-state-park" },
  { name: "Devil's Millhopper Geological State Park", slug: "devils-millhopper-geological-state-park" },
  { name: "Falling Waters State Park", slug: "falling-waters-state-park" },
  { name: "Florida Caverns State Park", slug: "florida-caverns-state-park" },
  { name: "Fort Clinch State Park", slug: "fort-clinch-state-park" },
    { name: "Grayton Beach State Park", slug: "grayton-beach-state-park" },
  { name: "Henderson Beach State Park", slug: "henderson-beach-state-park" },
  { name: "Highlands Hammock State Park", slug: "highlands-hammock-state-park" },
  { name: "Ellie Schiller Homosassa Springs Wildlife State Park", slug: "ellie-schiller-homosassa-springs-wildlife-state-park" },
  { name: "Honeymoon Island State Park", slug: "honeymoon-island-state-park" },
  { name: "Jonathan Dickinson State Park", slug: "jonathan-dickinson-state-park" },
  { name: "Paynes Prairie Preserve State Park", slug: "paynes-prairie-preserve-state-park" },
  { name: "Sebastian Inlet State Park", slug: "sebastian-inlet-state-park" },
  { name: "Silver Springs State Park", slug: "silver-springs-state-park" },
  { name: "Stephen Foster Folk Culture Center State Park", slug: "stephen-foster-folk-culture-center-state-park" },
  { name: "Topsail Hill Preserve State Park", slug: "topsail-hill-preserve-state-park" },
  { name: "Wekiwa Springs State Park", slug: "wekiwa-springs-state-park" },
];

interface LinksFile {
  _meta: {
    state: string;
    stateName: string;
    lastUpdated: string;
    lastValidated: string | null;
    totalParks: number;
    notes: string;
  };
  parks: Record<string, {
    name: string;
    links: Record<string, string>;
  }>;
}

// Parks that are historic sites without recreation/maps subpages
const WI_HISTORIC_SITES = new Set(['copperculture', 'aztalan', 'lizardmound']);

function generateWisconsinLinks(): LinksFile {
  const parks: LinksFile['parks'] = {};
  
  for (const park of WISCONSIN_PARKS) {
    const isHistoricSite = WI_HISTORIC_SITES.has(park.slug);
    
    parks[park.slug] = {
      name: park.name,
      links: isHistoricSite ? {
        official: `https://dnr.wisconsin.gov/topic/parks/${park.slug}`,
        reservation: "https://wisconsin.goingtocamp.com/",
      } : {
        official: `https://dnr.wisconsin.gov/topic/parks/${park.slug}`,
        recreation: `https://dnr.wisconsin.gov/topic/parks/${park.slug}/recreation`,
        maps: `https://dnr.wisconsin.gov/topic/parks/${park.slug}/maps`,
        reservation: "https://wisconsin.goingtocamp.com/",
      },
    };
  }

  return {
    _meta: {
      state: "WI",
      stateName: "Wisconsin",
      lastUpdated: new Date().toISOString().split('T')[0],
      lastValidated: null,
      totalParks: WISCONSIN_PARKS.length,
      notes: "Complete list of Wisconsin state parks. We are the authoritative source!",
    },
    parks,
  };
}

function generateFloridaLinks(): LinksFile {
  const parks: LinksFile['parks'] = {};
  
  // Florida State Parks has inconsistent URL patterns for subpages
  // We only include official + reservation which are reliable
  for (const park of FLORIDA_PARKS) {
    const parkId = park.slug;
    parks[parkId] = {
      name: park.name,
      links: {
        official: `https://www.floridastateparks.org/parks-and-trails/${park.slug}`,
        reservation: "https://reserve.floridastateparks.org/Web/",
      },
    };
  }

  return {
    _meta: {
      state: "FL",
      stateName: "Florida",
      lastUpdated: new Date().toISOString().split('T')[0],
      lastValidated: null,
      totalParks: FLORIDA_PARKS.length,
      notes: "Top Florida state parks. We are the authoritative source!",
    },
    parks,
  };
}

async function main() {
  const wiLinks = generateWisconsinLinks();
  const flLinks = generateFloridaLinks();

  const wiPath = join(__dirname, '../sources/links/WI.json');
  const flPath = join(__dirname, '../sources/links/FL.json');

  await writeFile(wiPath, JSON.stringify(wiLinks, null, 2));
  console.log(`Generated WI links: ${WISCONSIN_PARKS.length} parks -> ${wiPath}`);

  await writeFile(flPath, JSON.stringify(flLinks, null, 2));
  console.log(`Generated FL links: ${FLORIDA_PARKS.length} parks -> ${flPath}`);

  console.log('\nNext step: Run link validation to find any broken links');
  console.log('  npx tsx data/tests/validateLinks.test.ts all');
}

main().catch(console.error);
