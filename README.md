# TripAgent

**AI-Powered Park Trip Planner for National and State Parks**

TripAgent (published as **Adventure Agent** on the App Store) is a mobile app and API that helps you plan amazing park adventures. Chat naturally with our AI assistant to get real-time flight pricing, lodging options, hiking trail recommendations, campground availability, and complete budget breakdowns -- all powered by 29 AI tools and a curated database spanning 31 states.

![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-green)
![AI](https://img.shields.io/badge/AI-Claude%20AI-blue)
![NPS](https://img.shields.io/badge/Data-NPS%20API-green)
![States](https://img.shields.io/badge/State%20Parks-31%20States-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Data at a Glance

| Category | Count | Source |
|----------|-------|--------|
| National Parks | 63 | NPS API |
| State Park States | 31 | Multi-source aggregation |
| AI Tools | 29 | Claude tool system |
| Data Sources | 7+ | NPS, USFS, OSM, Recreation.gov, TrailAPI, AllTrails, state GIS |
| Background Images | 20 | High-res nature photography |

### State Park Data Coverage (31 States)

| Tier | States |
|------|--------|
| **Original 10** | WI, FL, CA, TX, CO, OR, AZ, UT, WA, MI |
| **Appalachia 6** | NC, VA, TN, WV, KY, GA |
| **Tier 1** | NY, PA, MN |
| **Tier 2** | SC, NM, ID, MT |
| **Tier 3** | NH, ME, WY, OH, IL, MA, MD, NV |

Each state includes park metadata, trail data (with coordinates, difficulty, distance), campground data (from Recreation.gov), and AllTrails search URLs.

## Features

### Mobile App (iOS and Android)
- **AI Chat Interface** - Natural conversation with Claude AI (Haiku for speed)
- **Dual Park Modes** - Switch between National Parks (green theme) and State Parks (brown theme)
- **Adventure Map** - Interactive trail/park/campground map with viewport-based rendering and background caching
- **Smart Onboarding** - Personalized profile with travel preferences, dietary needs, and activity interests
- **Photo Gallery** - Dynamic park photos from NPS, Unsplash, and Yelp/Google
- **Multi-Airport Comparison** - See 3-5 nearby airports with real-time prices
- **Budget Breakdown** - Complete trip cost estimates
- **Saved Conversations** - Return to previous trip plans with per-conversation backgrounds
- **Context-Aware** - Remembers preferences, handles overrides naturally
- **Dark Mode** - Full dark mode support with themed UI

### Adventure Map
- **Real-time map overlay** - Slides in when a park or state is detected in conversation
- **Trail markers** - Color-coded by difficulty (easy/moderate/hard/expert)
- **Park markers** - National and state parks shown as blue dots
- **Campground markers** - Tent icons for campgrounds
- **Trail Lines** - Toggle polyline trail routes (geometry fetched lazily)
- **Background caching** - Map data pre-loaded on app startup and destination detection
- **Viewport rendering** - Only renders markers visible in the current map region
- **Cross-platform** - Works on both iOS and Android with platform-specific optimizations

### Travel Tools (29 AI-Powered Tools)

**National Parks**
- **Park Search** - All 63 US National Parks with NPS data
- **Park Details** - Fees, hours, alerts, and visitor info
- **Hiking Trails** - 800+ trails with official NPS.gov URLs
- **Campgrounds** - Recreation.gov integration with reservation links
- **Wildlife** - iNaturalist observations with photos

**State Parks**
- **State Park Search** - Parks across 31 states from S3 database
- **Park Details** - Acreage, access, facilities, and official URLs
- **Campground Search** - Recreation.gov RIDB integration
- **Trail Database** - Thousands of trails with coordinates, difficulty, distance, and AllTrails links

**Travel Planning**
- **Flight Search** - Real prices from Amadeus (400+ airlines)
- **Hotel/Lodging Search** - Hotels, lodges, and nearby accommodations
- **Car Rentals** - With EV/Tesla preference support
- **Restaurant Search** - Yelp + Google Places with photos and reservation links
- **Driving Distance** - Google Maps integration with accurate times
- **EV Charging** - Tesla Supercharger + PlugShare integration
- **Weather** - Forecast for trip planning
- **Activities** - Tours and experiences near parks
- **Destination Photos** - NPS + Unsplash scenic imagery
- **Park Database Lookup** - Direct S3 data queries for instant results

### Smart Context System
- **Profile Preferences** - Budget, family size, accessibility, EV ownership, foodie preferences, coffee, books, history
- **Dynamic Overrides** - "Actually, make it 4 travelers" works naturally
- **Multi-Leg Trips** - "Fly into SFO, return from LAX" supported
- **Location-Based Suggestions** - Auto-suggests parks near user's location
- **Travel Date Integration** - Booking links prefilled with dates

### Data Pipeline (5 Sources)

| Source | Data | Coverage |
|--------|------|----------|
| **NPS API** | Official National Park Service data, trails, alerts | 63 national parks |
| **USFS ArcGIS** | US Forest Service trail network with geometry | Federal trails |
| **OpenStreetMap** | Trail paths via Overpass API with full geometry | Global |
| **Recreation.gov** | Campground availability, reservations, facilities | National |
| **TrailAPI** | State park trails by coordinates | Per-state |
| **AllTrails** | Search URL enrichment for trail discovery | All trails |
| **iNaturalist** | Wildlife observations and species photos | Per-park |

All data is aggregated, normalized to a unified schema (`data/schema/park.schema.ts`), and stored in S3 (`tripagent-park-data`).

## Architecture

- **React Native + Expo** - Cross-platform mobile app (iOS and Android)
- **Express API** - Backend with Claude AI integration (hosted on Railway)
- **AWS S3** - Park and trail data storage
- **MCP Server** - Claude Desktop compatibility
- **Stateless Design** - Real-time API queries, no user database

## Quick Start

### Prerequisites
- Node.js 20+
- Xcode (for iOS simulator) or Android Studio (for Android emulator)
- Expo CLI (`npm install -g expo-cli`)

### Installation

```bash
# Clone and install
git clone https://github.com/derickwowens/TripAgent.git
cd TripAgent
npm install

# Install mobile dependencies
cd mobile
npm install
cd ..
```

### Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Add your API credentials to `.env`:
```env
# Required: Claude AI
ANTHROPIC_API_KEY=sk-ant-api03-xxx

# Required: Flight/Hotel data
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret

# Required: Park data
NPS_API_KEY=your_nps_key

# Optional: Enhanced features
GOOGLE_MAPS_API_KEY=your_google_key
YELP_API_KEY=your_yelp_key
RECREATION_GOV_API_KEY=your_recreation_gov_key
```

### Run the App

Both platforms can run simultaneously with isolated ports:

```bash
# iOS (API: 3002, Metro: 8082)
./scripts/restart-ios.sh

# Android (API: 3001, Metro: 8081)
./scripts/restart-android.sh

# Run both in parallel (separate terminals)
./scripts/restart-android.sh   # Terminal 1
./scripts/restart-ios.sh       # Terminal 2
```

Ctrl+C in either terminal only stops that platform's processes.

## Development Scripts

### Convenience Scripts

```bash
# iOS development (starts API on :3002, Expo on :8082, and iOS simulator)
./scripts/restart-ios.sh
./scripts/restart-ios.sh "iPhone 15 Pro Max"  # Specific device
./scripts/restart-ios.sh --fresh               # Fresh install (clears app data)

# Android development (starts API on :3001, Expo on :8081, and Android emulator)
./scripts/restart-android.sh

# Take screenshots for App Store
./scripts/take-screenshots.sh

# Build for production
./scripts/build-ios.sh -i    # Increment version + build
./scripts/build-ios.sh -b    # Build only increment
./scripts/build-android.sh
```

### CLI Commands

```bash
npm run cli -- search-flights LAX JFK 2025-02-15
npm run cli -- search-hotels Paris 2025-02-15 2025-02-20
npm run cli -- search-cars LAX 2025-02-15 2025-02-20
npm run cli -- airport LAX
npm run cli -- help
```

## MCP Server (Claude Desktop Integration)

Connect TripAgent to Claude Desktop as an MCP server.

### Setup

1. Configure Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tripagent": {
      "command": "node",
      "args": ["--loader", "tsx", "/path/to/tripagent/src/mcp/server.ts"],
      "env": {
        "AMADEUS_CLIENT_ID": "your_client_id",
        "AMADEUS_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

2. Restart Claude Desktop

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `search_flights` | Search flights by route and date |
| `search_hotels` | Search hotels by city and dates |
| `search_car_rentals` | Search rental cars by location |
| `get_airport_info` | Get airport details by IATA code |

## API Setup

### Required APIs

#### Anthropic (Claude AI)
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxx
```
Sign up at [console.anthropic.com](https://console.anthropic.com)

#### National Park Service
```env
NPS_API_KEY=your_nps_key
```
Sign up at [developer.nps.gov](https://www.nps.gov/subjects/developer/get-started.htm) - **Free, 1000 calls/hour**

#### Amadeus (Flights, Hotels, Cars)
```env
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
```
Sign up at [developers.amadeus.com](https://developers.amadeus.com) - **Free tier: 2,000 calls/month**

### Optional APIs (Enhanced Features)

#### Yelp Fusion (Restaurants)
```env
YELP_API_KEY=your_yelp_key
```
Sign up at [fusion.yelp.com](https://fusion.yelp.com/) - **Free tier: 5,000 calls/day**

#### Google Maps (Driving Distance, Restaurant Fallback)
```env
GOOGLE_MAPS_API_KEY=your_google_key
```
Sign up at [console.cloud.google.com](https://console.cloud.google.com) - **$200 free credit/month**

#### Unsplash (Photos)
```env
UNSPLASH_ACCESS_KEY=your_unsplash_key
```
Sign up at [unsplash.com/developers](https://unsplash.com/developers) - **Free tier: 50 calls/hour**

#### OpenChargeMap (EV Charging)
```env
OPENCHARGEMAP_API_KEY=your_ocm_key
```
Sign up at [openchargemap.org](https://openchargemap.org/site/develop/api) - **Free**

#### Recreation.gov (Campgrounds)
```env
RECREATION_GOV_API_KEY=your_recreation_gov_key
```
Sign up at [ridb.recreation.gov](https://ridb.recreation.gov/) - **Free**

#### TrailAPI (State Park Trails)
```env
TRAILAPI_KEY=your_rapidapi_key
```
Sign up at [rapidapi.com/trailapi](https://rapidapi.com/trailapi/api/trailapi) - **Free tier available**

## Project Structure

```
TripAgent/
├── mobile/                      # React Native + Expo app
│   ├── src/
│   │   ├── screens/
│   │   │   └── HomeScreen.tsx   # Main chat UI, photo gallery, Adventure Map integration
│   │   ├── components/home/
│   │   │   ├── TrailMapPanel.tsx # Adventure Map (map overlay + trail/park/campground markers)
│   │   │   ├── WelcomeScreen.tsx # Quick Start screen with park mode selector
│   │   │   ├── OnboardingFlow.tsx # Smart onboarding with travel preferences
│   │   │   ├── ChatMessages.tsx  # Message display with loading states
│   │   │   ├── ChatInput.tsx     # Text input with speech recognition
│   │   │   ├── PhotoGallery.tsx  # Draggable photo gallery overlay
│   │   │   ├── SideMenu.tsx      # Conversation list + settings
│   │   │   └── CollapsibleBottomPanel.tsx # Trip info panel
│   │   ├── services/
│   │   │   └── api.ts           # API client (chat, trails, parks, campgrounds, geometry)
│   │   ├── hooks/
│   │   │   ├── useTrailMap.ts   # Adventure Map hook + module-level cache + preloadMapData
│   │   │   ├── useConversations.ts # Conversation persistence
│   │   │   ├── useUserProfile.ts   # Profile management
│   │   │   ├── useParkTheme.ts     # National/State park theming
│   │   │   ├── useToolSettings.ts  # Tool toggle management
│   │   │   └── useLocation.ts      # GPS + nearest airport detection
│   │   └── data/
│   │       └── nationalParks.ts # 63 national parks with gateway cities + coordinates
│   ├── assets/
│   │   └── backgrounds/         # 20 bundled nature background images
│   └── app.json                 # Expo config (version, bundle ID, API keys)
├── src/
│   ├── api/
│   │   ├── server.ts            # Express API (29 endpoints, async chat with polling)
│   │   └── chat/
│   │       ├── index.ts         # Main handler, tool dispatch (29 tools)
│   │       ├── types.ts         # ChatContext, TripLeg, TOOL_DISPLAY_NAMES
│   │       ├── systemPrompt.ts  # System prompt with NPS data injection
│   │       ├── toolDefinitions.ts # Claude tool schemas with park codes
│   │       ├── toolHandlers/    # Modular tool handlers (parks, travel, food, lodging)
│   │       └── parkFeatures.ts  # Park-specific photo keywords
│   ├── providers/
│   │   ├── parks/
│   │   │   ├── S3ParkDataService.ts  # S3 data layer (getTrailsForMap, getParksInState)
│   │   │   └── StateParkService.ts   # State park search
│   │   ├── flights/             # Amadeus + Kiwi flight adapters
│   │   ├── hotels/              # Amadeus hotel adapter
│   │   ├── recreation/          # Recreation.gov campground adapter
│   │   ├── wildlife/            # iNaturalist adapter
│   │   ├── YelpAdapter.ts       # Restaurant search + reservation links
│   │   ├── GoogleMapsAdapter.ts # Driving distance, restaurant fallback
│   │   └── OpenChargeMapAdapter.ts # EV charging stations
│   ├── domain/facade/           # TravelFacade orchestration
│   ├── mcp/                     # MCP server (Claude Desktop integration)
│   └── cli/                     # Command-line interface
├── data/
│   ├── schema/                  # park.schema.ts - unified data schema
│   ├── scripts/                 # Data pipeline scripts
│   │   ├── fetchStateTrails.ts  # TrailAPI fetcher with park coordinates
│   │   ├── fetchUSFSAndOSMTrails.ts # USFS ArcGIS + OSM Overpass fetcher
│   │   ├── fetchCampgrounds.ts  # Recreation.gov RIDB campground fetcher
│   │   └── enrichAllTrailsUrls.ts # AllTrails search URL enrichment
│   ├── sync/                    # State data sync orchestrator
│   │   └── config.ts            # PRIORITY_STATES (31 states)
│   └── sources/states/          # 31 state metadata JSON files
├── scripts/
│   ├── restart-ios.sh           # iOS dev (API:3002, Metro:8082)
│   ├── restart-android.sh       # Android dev (API:3001, Metro:8081)
│   ├── deploy-ios.sh            # iOS production build + submit
│   ├── deploy-android.sh        # Android production build + submit
│   └── deploy-all.sh            # Both platforms
├── screenshots/                 # Versioned App Store screenshots
└── .copilot-instructions.md     # AI assistant rules + architecture docs
```

## Architecture Principles

### 1. Authoritative Data Sources
- **NPS API** - Official park data, trail information with NPS.gov URLs
- **S3 Park Database** - Curated data for 550+ parks synced from multiple sources
- **Recreation.gov** - Campground availability and reservation links
- Park codes injected into system prompt and tool definitions

### 2. Context Priority System
User requests override saved preferences:
```
Leg Override > Conversation Override > Trip Context > Profile Defaults > System Defaults
```
Example: Profile says "budget traveler" but user asks "show me luxury hotels" → show luxury

### 3. Multi-Leg Trip Support
Users can plan complex trips with different settings per segment:
```typescript
tripContext.legs = [
  { type: 'flight', from: 'LAX', to: 'SFO', overrides: { ... } },
  { type: 'stay', at: 'Yosemite' },
  { type: 'flight', from: 'SFO', to: 'LAX' }
]
```

### 4. Context-Aware Tools
All tools receive full ChatContext and use `resolveContextValue()`:
```typescript
const travelers = resolveContextValue<number>('numTravelers', context, activeLeg) || 1;
```

### 5. Provider Fallback Pattern
Multiple providers per category with automatic fallback:
- Restaurants: Yelp -> Google Places
- Photos: NPS -> iNaturalist
- Trails: NPS API -> S3 Database -> Google Maps

### 6. Park Mode Architecture
The app supports two distinct modes with different tool sets:
- **National Parks Mode** - Uses NPS tools, official NPS.gov URLs
- **State Parks Mode** - Uses state park tools, Recreation.gov integration

## Deployment

### Deploy API to Railway

```bash
# Push to GitHub, then:
# 1. Go to railway.app
# 2. New Project -> Deploy from GitHub
# 3. Add environment variables (see API Setup section)
```

### Build for App Store (iOS)

```bash
./scripts/build-ios.sh -i    # Increment version and build
# Then submit via Xcode or Transporter
```

### Build for Play Store (Android)

```bash
./scripts/build-android.sh
# Or manually:
cd mobile
eas build --platform android --profile production
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete guide.

## Privacy

- **Location data** - Used only to find nearby airports and parks
- **Conversations** - Stored locally on device only
- **No tracking** - Zero analytics or data collection
- **AI processing** - Chat messages sent to Anthropic's Claude API

## API Keys Summary

| Service | Free Tier | Required |
|---------|-----------|----------|
| Anthropic | Pay per use | Yes |
| NPS API | 1,000 calls/hour | Yes |
| Amadeus | 2,000 calls/mo | Yes |
| Google Maps | $200 credit/mo | Recommended |
| Yelp | 5,000 calls/day | Optional |
| Recreation.gov | Unlimited | Optional |

## License

MIT
