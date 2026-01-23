import { BaseAdapter } from '../base/BaseAdapter.js';

// iNaturalist API Response Types
interface INatObservationsResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: INatObservation[];
}

interface INatObservation {
  id: number;
  species_guess: string;
  observed_on_string: string;
  place_guess: string;
  quality_grade: string;
  taxon: INatTaxon | null;
  photos: INatPhoto[];
  location: string;
  uri: string;
}

interface INatTaxon {
  id: number;
  name: string;
  preferred_common_name: string;
  iconic_taxon_name: string;
  wikipedia_url: string;
  default_photo: INatPhoto | null;
  observations_count: number;
  rank: string;
}

interface INatPhoto {
  id: number;
  url: string;
  medium_url: string;
  square_url: string;
  attribution: string;
}

interface INatSpeciesCountResponse {
  total_results: number;
  results: {
    count: number;
    taxon: INatTaxon;
  }[];
}

interface INatPlacesResponse {
  total_results: number;
  results: INatPlace[];
}

interface INatPlace {
  id: number;
  name: string;
  display_name: string;
  place_type: number;
  bounding_box_geojson: any;
}

// Output Types
export interface WildlifeObservation {
  id: string;
  species: string;
  commonName: string;
  scientificName: string;
  category: string;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  observedAt: string;
  location: string;
  qualityGrade: string;
  wikipediaUrl: string | null;
  observationUrl: string;
}

export interface SpeciesCount {
  species: string;
  commonName: string;
  scientificName: string;
  category: string;
  count: number;
  photoUrl: string | null;
  wikipediaUrl: string | null;
}

export interface WildlifeSummary {
  totalSpecies: number;
  mammals: SpeciesCount[];
  birds: SpeciesCount[];
  reptiles: SpeciesCount[];
  amphibians: SpeciesCount[];
  fish: SpeciesCount[];
  insects: SpeciesCount[];
  plants: SpeciesCount[];
  fungi: SpeciesCount[];
}

// National Park place IDs in iNaturalist (verified via API)
const PARK_PLACE_IDS: Record<string, number> = {
  'yose': 68542,    // Yosemite
  'grca': 69216,    // Grand Canyon
  'zion': 50634,    // Zion
  'yell': 10211,    // Yellowstone
  'glac': 69113,    // Glacier
  'grte': 69140,    // Grand Teton
  'romo': 49676,    // Rocky Mountain
  'acad': 49610,    // Acadia
  'arch': 69185,    // Arches
  'brca': 69179,    // Bryce Canyon
  'jotr': 3680,     // Joshua Tree
  'seki': 69082,    // Sequoia & Kings Canyon
  'deva': 4504,     // Death Valley
  'olym': 69094,    // Olympic
  'havo': 69226,    // Hawaii Volcanoes
  'ever': 53957,    // Everglades
  'grsm': 72645,    // Great Smoky Mountains
  'bibe': 69256,    // Big Bend
  'cany': 69182,    // Canyonlands
  'crla': 69107,    // Crater Lake
  'dena': 69291,    // Denali
  'glba': 69295,    // Glacier Bay
  'grba': 69155,    // Great Basin
  'gumo': 69259,    // Guadalupe Mountains
  'hale': 69229,    // Haleakala
  'indu': 126712,   // Indiana Dunes
  'isro': 69063,    // Isle Royale
  'kefj': 69300,    // Kenai Fjords
  'lavo': 69120,    // Lassen Volcanic
  'maca': 69038,    // Mammoth Cave
  'meve': 69197,    // Mesa Verde
  'mora': 69099,    // Mount Rainier
  'noca': 69103,    // North Cascades
  'pefo': 69204,    // Petrified Forest
  'pinn': 69132,    // Pinnacles
  'redw': 69125,    // Redwood
  'sagu': 69211,    // Saguaro
  'shen': 69010,    // Shenandoah
  'thro': 69078,    // Theodore Roosevelt
  'voya': 69066,    // Voyageurs
  'wica': 69072,    // Wind Cave
  'badl': 69075,    // Badlands
  'bisc': 53956,    // Biscayne
  'blca': 69192,    // Black Canyon of the Gunnison
  'care': 69171,    // Capitol Reef
  'cave': 69262,    // Carlsbad Caverns
  'chis': 69136,    // Channel Islands
  'cong': 69025,    // Congaree
  'cuva': 69054,    // Cuyahoga Valley
  'drto': 53958,    // Dry Tortugas
  'gaar': 69284,    // Gates of the Arctic
  'jeff': 126709,   // Gateway Arch
  'grsa': 69200,    // Great Sand Dunes
  'hosp': 69247,    // Hot Springs
  'katm': 69303,    // Katmai
  'kova': 69287,    // Kobuk Valley
  'lacl': 69306,    // Lake Clark
  'viis': 53960,    // Virgin Islands
  'whsa': 126710,   // White Sands
  'npsa': 126711,   // National Park of American Samoa
  'wrst': 69309,    // Wrangell-St. Elias
};

// Iconic taxon categories
const ICONIC_TAXON_MAP: Record<string, string> = {
  'Mammalia': 'mammals',
  'Aves': 'birds',
  'Reptilia': 'reptiles',
  'Amphibia': 'amphibians',
  'Insecta': 'insects',
  'Arachnida': 'insects',
  'Plantae': 'plants',
  'Fungi': 'fungi',
  'Actinopterygii': 'fish',
  'Mollusca': 'invertebrates',
};

export class INaturalistAdapter extends BaseAdapter {
  name = 'inaturalist';
  private baseUrl = 'https://api.inaturalist.org/v1';

  constructor() {
    super();
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24 hour cache - wildlife data is stable
  }

  async getWildlifeForPark(parkCode: string, limit = 30): Promise<WildlifeObservation[]> {
    const placeId = PARK_PLACE_IDS[parkCode.toLowerCase()];
    
    if (!placeId) {
      // Fallback to search by park name
      return this.searchObservations(`${parkCode} national park`, limit);
    }

    const cacheKey = this.generateCacheKey('inat-park-wildlife', { placeId, limit });

    return this.fetchWithCache(cacheKey, async () => {
      const response = await fetch(
        `${this.baseUrl}/observations?place_id=${placeId}&quality_grade=research&per_page=${limit}&order_by=votes&photos=true`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.status}`);
      }

      const data = await response.json() as INatObservationsResponse;
      return data.results.map(obs => this.transformObservation(obs));
    });
  }

  async getSpeciesCountsForPark(parkCode: string): Promise<WildlifeSummary> {
    const placeId = PARK_PLACE_IDS[parkCode.toLowerCase()];
    
    if (!placeId) {
      return this.getEmptySummary();
    }

    const cacheKey = this.generateCacheKey('inat-park-species', { placeId });

    return this.fetchWithCache(cacheKey, async () => {
      const response = await fetch(
        `${this.baseUrl}/observations/species_counts?place_id=${placeId}&quality_grade=research&per_page=200`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.status}`);
      }

      const data = await response.json() as INatSpeciesCountResponse;
      return this.categorizeSpecies(data.results, data.total_results);
    });
  }

  async getCommonWildlife(parkCode: string, category?: string): Promise<SpeciesCount[]> {
    const summary = await this.getSpeciesCountsForPark(parkCode);
    
    if (category) {
      const catLower = category.toLowerCase();
      if (catLower === 'mammals' || catLower === 'mammal') return summary.mammals;
      if (catLower === 'birds' || catLower === 'bird') return summary.birds;
      if (catLower === 'reptiles' || catLower === 'reptile') return summary.reptiles;
      if (catLower === 'amphibians' || catLower === 'amphibian') return summary.amphibians;
      if (catLower === 'fish' || catLower === 'fishes') return summary.fish;
      if (catLower === 'insects' || catLower === 'insect' || catLower === 'bugs') return summary.insects;
      if (catLower === 'plants' || catLower === 'plant' || catLower === 'flowers') return summary.plants;
      if (catLower === 'fungi' || catLower === 'mushrooms') return summary.fungi;
    }

    // Return top species from all animal categories
    const all = [
      ...summary.mammals.slice(0, 5),
      ...summary.birds.slice(0, 5),
      ...summary.reptiles.slice(0, 3),
      ...summary.amphibians.slice(0, 2),
      ...summary.fish.slice(0, 2),
    ];

    return all.sort((a, b) => b.count - a.count).slice(0, 15);
  }

  async searchObservations(query: string, limit = 20): Promise<WildlifeObservation[]> {
    const cacheKey = this.generateCacheKey('inat-search', { query, limit });

    return this.fetchWithCache(cacheKey, async () => {
      const response = await fetch(
        `${this.baseUrl}/observations?q=${encodeURIComponent(query)}&quality_grade=research&per_page=${limit}&photos=true`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.status}`);
      }

      const data = await response.json() as INatObservationsResponse;
      return data.results.map(obs => this.transformObservation(obs));
    });
  }

  getPlaceIdForPark(parkCode: string): number | null {
    return PARK_PLACE_IDS[parkCode.toLowerCase()] || null;
  }

  private transformObservation(obs: INatObservation): WildlifeObservation {
    const photo = obs.photos?.[0];
    const taxon = obs.taxon;

    return {
      id: obs.id.toString(),
      species: taxon?.preferred_common_name || obs.species_guess || 'Unknown',
      commonName: taxon?.preferred_common_name || obs.species_guess || 'Unknown',
      scientificName: taxon?.name || '',
      category: this.getCategory(taxon?.iconic_taxon_name),
      photoUrl: photo?.medium_url?.replace('square', 'medium') || photo?.url || null,
      thumbnailUrl: photo?.square_url || null,
      observedAt: obs.observed_on_string || '',
      location: obs.place_guess || '',
      qualityGrade: obs.quality_grade,
      wikipediaUrl: taxon?.wikipedia_url || null,
      observationUrl: obs.uri,
    };
  }

  private categorizeSpecies(
    results: { count: number; taxon: INatTaxon }[],
    totalSpecies: number
  ): WildlifeSummary {
    const summary: WildlifeSummary = {
      totalSpecies,
      mammals: [],
      birds: [],
      reptiles: [],
      amphibians: [],
      fish: [],
      insects: [],
      plants: [],
      fungi: [],
    };

    for (const result of results) {
      const taxon = result.taxon;
      if (!taxon) continue;

      const species: SpeciesCount = {
        species: taxon.preferred_common_name || taxon.name,
        commonName: taxon.preferred_common_name || taxon.name,
        scientificName: taxon.name,
        category: this.getCategory(taxon.iconic_taxon_name),
        count: result.count,
        photoUrl: taxon.default_photo?.medium_url || null,
        wikipediaUrl: taxon.wikipedia_url || null,
      };

      const category = ICONIC_TAXON_MAP[taxon.iconic_taxon_name];
      if (category === 'mammals') summary.mammals.push(species);
      else if (category === 'birds') summary.birds.push(species);
      else if (category === 'reptiles') summary.reptiles.push(species);
      else if (category === 'amphibians') summary.amphibians.push(species);
      else if (category === 'fish') summary.fish.push(species);
      else if (category === 'insects') summary.insects.push(species);
      else if (category === 'plants') summary.plants.push(species);
      else if (category === 'fungi') summary.fungi.push(species);
    }

    // Sort each category by observation count
    summary.mammals.sort((a, b) => b.count - a.count);
    summary.birds.sort((a, b) => b.count - a.count);
    summary.reptiles.sort((a, b) => b.count - a.count);
    summary.amphibians.sort((a, b) => b.count - a.count);
    summary.fish.sort((a, b) => b.count - a.count);
    summary.insects.sort((a, b) => b.count - a.count);
    summary.plants.sort((a, b) => b.count - a.count);
    summary.fungi.sort((a, b) => b.count - a.count);

    // Limit each category
    summary.mammals = summary.mammals.slice(0, 20);
    summary.birds = summary.birds.slice(0, 30);
    summary.reptiles = summary.reptiles.slice(0, 15);
    summary.amphibians = summary.amphibians.slice(0, 10);
    summary.fish = summary.fish.slice(0, 15);
    summary.insects = summary.insects.slice(0, 15);
    summary.plants = summary.plants.slice(0, 20);
    summary.fungi = summary.fungi.slice(0, 10);

    return summary;
  }

  private getCategory(iconicTaxon: string | undefined): string {
    if (!iconicTaxon) return 'Other';
    return ICONIC_TAXON_MAP[iconicTaxon] || 'Other';
  }

  private getEmptySummary(): WildlifeSummary {
    return {
      totalSpecies: 0,
      mammals: [],
      birds: [],
      reptiles: [],
      amphibians: [],
      fish: [],
      insects: [],
      plants: [],
      fungi: [],
    };
  }
}
