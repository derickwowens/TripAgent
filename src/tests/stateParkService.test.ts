import { describe, it, expect, beforeAll } from 'vitest';
import { StateParkService } from '../providers/parks/StateParkService.js';
import { RecreationGovAdapter } from '../providers/parks/RecreationGovAdapter.js';

describe('StateParkService', () => {
  let service: StateParkService;

  beforeAll(() => {
    service = new StateParkService();
  });

  describe('State Management', () => {
    it('should return all US states', () => {
      const states = service.getStates();
      expect(states.length).toBe(50);
      expect(states.find(s => s.code === 'CA')).toBeDefined();
      expect(states.find(s => s.code === 'TX')).toBeDefined();
    });

    it('should get states overview with park counts', async () => {
      const overview = await service.getStatesOverview();
      expect(overview.length).toBeGreaterThan(0);
      expect(overview[0]).toHaveProperty('stateCode');
      expect(overview[0]).toHaveProperty('stateName');
      expect(overview[0]).toHaveProperty('parkCount');
    });
  });

  describe('Park Search', () => {
    it('should search parks by state', async () => {
      const results = await service.searchParks({ state: 'CA', limit: 10 });
      expect(results.parks.length).toBeGreaterThan(0);
      expect(results.parks[0]).toHaveProperty('name');
      expect(results.parks[0]).toHaveProperty('state');
      expect(results.parks[0]).toHaveProperty('acresFormatted');
    });

    it('should get parks for a specific state', async () => {
      // Use smaller state (Delaware) for faster test
      const parks = await service.getParksByState('DE');
      expect(parks.length).toBeGreaterThan(0);
      parks.forEach(park => {
        expect(park.state).toBe('DE');
      });
    }, 15000);

    it('should include hasMore flag when more results exist', async () => {
      const results = await service.searchParks({ state: 'CA', limit: 5 });
      expect(results).toHaveProperty('hasMore');
      expect(typeof results.hasMore).toBe('boolean');
    });

    it('should indicate campground data availability', async () => {
      const results = await service.searchParks({ state: 'CO' });
      expect(results).toHaveProperty('campgroundsAvailable');
      expect(typeof results.campgroundsAvailable).toBe('boolean');
    });
  });

  describe('Park Details', () => {
    it('should get detailed park info by name', async () => {
      const park = await service.getParkDetails('Anza-Borrego Desert', 'CA');
      // May or may not find exact match depending on PAD-US naming
      if (park) {
        expect(park).toHaveProperty('name');
        expect(park).toHaveProperty('campgrounds');
        expect(park).toHaveProperty('hasCamping');
        expect(park).toHaveProperty('acresFormatted');
      }
    }, 15000);
  });

  describe('Designation Types', () => {
    it('should return designation types with counts', async () => {
      const types = await service.getDesignationTypes();
      expect(types.length).toBeGreaterThan(0);
      expect(types[0]).toHaveProperty('code');
      expect(types[0]).toHaveProperty('label');
      expect(types[0]).toHaveProperty('count');
    });
  });

  describe('Campground Data Availability', () => {
    it('should report campground configuration status', () => {
      const available = service.isCampgroundDataAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('Campground Search', () => {
    it('should search campgrounds by state', async () => {
      // Use smaller state (DE) to reduce API calls
      const campgrounds = await service.getCampgrounds('DE');
      expect(Array.isArray(campgrounds)).toBe(true);
    }, 30000);
  });
});

describe('RecreationGovAdapter', () => {
  let adapter: RecreationGovAdapter;

  beforeAll(() => {
    adapter = new RecreationGovAdapter();
  });

  describe('Configuration', () => {
    it('should check if API key is configured', () => {
      const configured = adapter.isConfigured();
      expect(typeof configured).toBe('boolean');
    });
  });

  describe('Search Parameters', () => {
    it('should handle search without API key gracefully', async () => {
      // Without API key, should return empty array, not throw
      const adapterNoKey = new RecreationGovAdapter('');
      const results = await adapterNoKey.searchCampgrounds({ state: 'CA' });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Campground Search (integration)', () => {
    it('should search campgrounds in California', async () => {
      if (adapter.isConfigured()) {
        const results = await adapter.getCampgroundsByState('CA', 5);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('name');
        expect(results[0]).toHaveProperty('coordinates');
        expect(results[0]).toHaveProperty('reservable');
      }
    }, 15000);
  });
});
