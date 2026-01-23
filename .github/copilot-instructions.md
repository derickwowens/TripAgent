# TripAgent Copilot Instructions

## Project Overview
TripAgent (branded as "Adventure Agent" on iOS App Store) is a mobile app that helps users plan trips to US National Parks. It uses Claude AI for conversation, NPS API for park data, and various travel APIs.

## Critical Requirement: Support All 63 National Parks

**All functionality must support the complete list of 63 US National Parks.** This includes but is not limited to:

- Park detection and recognition in user messages
- Photo galleries with park-specific curated images
- Gateway city lookups for restaurants/lodging
- Trip context extraction and metadata
- Combined park handling (e.g., "Sequoia & Kings Canyon")

### Reference Files
- **Park list**: `/mobile/src/data/nationalParks.ts` - Complete list of 63 parks with activities
- **Park photos**: `/src/data/parkPhotos.ts` - Curated photos for each park
- **Park detection patterns**: `PARK_DETECTION_PATTERNS` in nationalParks.ts
- **Gateway cities**: `PARK_GATEWAYS` in nationalParks.ts

### When Adding New Features
1. Check if the feature involves park-specific data
2. Ensure it works for ALL 63 parks, not just popular ones
3. Use the reference files above as the source of truth
4. Test with less common parks (e.g., Kobuk Valley, Congaree, not just Yellowstone)

## Combined Parks
Some parks are managed together and should be handled as combined destinations:
- Sequoia & Kings Canyon National Parks (code: `seki`)
- Yellowstone & Grand Teton (nearby, often visited together)

## Architecture Notes
- **Backend**: Node.js/Express with TypeScript (`/src`)
- **Mobile**: React Native/Expo (`/mobile`)
- **AI**: Claude API via Anthropic SDK
- **Photos**: NPS API (primary) + Unsplash curated fallbacks

## Code Style
- TypeScript strict mode
- Functional components with hooks
- No inline comments unless explaining complex logic
- Use existing patterns from codebase
