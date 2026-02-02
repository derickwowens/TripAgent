# Trail Coverage Report
Generated: 2026-02-02T14:10:13.013Z

## Summary

| Metric | Current | Target | Coverage |
|--------|---------|--------|----------|
| Total Parks | 94 | 288 | 33% |
| Total Trails | 995 | 3800 | 26% |

---

## National Parks

| Metric | Value |
|--------|-------|
| Parks with Data | 55 / 63 |
| Total Trails | 800 |
| Coverage | 87% |

### Data Quality
- Trails with NPS URL: 100%
- Trails with Description: 100%
- Trails with Duration: 76%

---

## State Parks

### Wisconsin
| Metric | Current | Phase 1 Goal | Phase 2 Goal | Phase 3 Goal |
|--------|---------|--------------|--------------|--------------|
| Parks | 18 | 25 | 40 | 50 |
| Trails | 96 | 150 | 300 | 400 |
| Coverage | 36% | 50% | 80% | 100% |

**Data Quality:**
- With Description: 100%
- With Distance: 97%
- With Difficulty: 58%
- With Official URL: 16%
- With Coordinates: 100%

### Florida
| Metric | Current | Phase 1 Goal | Phase 2 Goal | Phase 3 Goal |
|--------|---------|--------------|--------------|--------------|
| Parks | 21 | 50 | 100 | 150 |
| Trails | 99 | 400 | 800 | 1000 |
| Coverage | 12% | 29% | 57% | 86% |

**Data Quality:**
- With Description: 100%
- With Distance: 98%
- With Difficulty: 94%
- With Official URL: 18%
- With Coordinates: 100%

---

## Next Steps

1. Run `fetchWisconsinTrails.ts` to expand WI coverage
2. Run `fetchFloridaTrails.ts` to expand FL coverage
3. Run `fetchAndUploadTrails.ts` to refresh NPS data
4. Manual curation for high-priority parks
