# TripAgent

**AI-Powered Park Trip Planner for National and State Parks**

TripAgent (published as "Adventure Agent" on the App Store) is a mobile app and API that helps you plan amazing park adventures. Chat naturally with our AI assistant to get real-time flight pricing, lodging options, hiking trail recommendations, campground availability, and complete budget breakdowns.

![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-green)
![AI](https://img.shields.io/badge/AI-Claude%20AI-blue)
![NPS](https://img.shields.io/badge/Data-NPS%20API-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

### Mobile App (iOS and Android)
- **AI Chat Interface** - Natural conversation with Claude AI
- **Dual Park Modes** - Switch between National Parks and State Parks
- **Smart Onboarding** - Personalized profile with travel preferences
- **Photo Gallery** - Beautiful park and campground photos
- **Multi-Airport Comparison** - See 3-5 nearby airports with prices
- **Budget Breakdown** - Complete trip cost estimates
- **Saved Conversations** - Return to previous trip plans
- **Context-Aware** - Remembers preferences, handles overrides naturally
- **Dark Mode** - Full dark mode support with themed UI

### Travel Tools (20+ AI-Powered Tools)

**National Parks**
- **Park Search** - All 63 US National Parks with NPS data
- **Park Details** - Fees, hours, alerts, and visitor info
- **Hiking Trails** - 800+ trails with official NPS.gov URLs
- **Campgrounds** - Recreation.gov integration with reservation links
- **Wildlife** - iNaturalist observations with photos

**State Parks**
- **State Park Search** - Parks across all 50 states
- **Park Details** - Acreage, access, and facilities
- **Campground Search** - Recreation.gov and state park data
- **Trail Information** - Curated trail database for WI and FL

**Travel Planning**
- **Flight Search** - Real prices from Amadeus (400+ airlines)
- **Hotel/Lodging Search** - Hotels, lodges, and nearby accommodations
- **Car Rentals** - With EV/Tesla preference support
- **Restaurant Search** - Yelp + Google Places with photos
- **Driving Distance** - Google Maps integration with accurate times
- **EV Charging** - Tesla Supercharger + PlugShare integration
- **Weather** - Forecast for trip planning
- **Activities** - Tours and experiences near parks

### Smart Context System
- **Profile Preferences** - Budget, family size, accessibility, EV ownership
- **Dynamic Overrides** - "Actually, make it 4 travelers" works naturally
- **Multi-Leg Trips** - "Fly into SFO, return from LAX" supported
- **Location-Based Suggestions** - Auto-suggests parks near user's location
- **Travel Date Integration** - Booking links prefilled with dates

### Data Sources
- **NPS API** - Official National Park Service data and trail information
- **Recreation.gov** - Campground availability and reservations
- **S3 Park Database** - Curated data for 550+ parks (474 NPS sites + 76+ state parks)
- **iNaturalist** - Wildlife observations and photos
- **TrailAPI** - State park trail data (Wisconsin, Florida)

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

```bash
# iOS (recommended for development)
./scripts/restart-ios.sh

# Android
./scripts/restart-android.sh

# Or run separately:
npm run api              # Start API server on :3000
cd mobile && npm start   # Start Expo
```

## Development Scripts

### Convenience Scripts

```bash
# iOS development (starts API, Expo, and iOS simulator)
./scripts/restart-ios.sh
./scripts/restart-ios.sh "iPhone 15 Pro Max"  # Specific device
./scripts/restart-ios.sh --fresh               # Fresh install

# Android development
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
│   │   ├── screens/             # HomeScreen (main chat UI)
│   │   ├── components/home/     # OnboardingFlow, ChatMessages, PhotoGallery, SideMenu
│   │   ├── services/            # API client
│   │   ├── hooks/               # useUserProfile, useConversations, useParkTheme
│   │   └── data/                # nationalParks.ts, stateParks.ts
│   ├── assets/                  # App icons
│   └── app.json                 # Expo config
├── src/
│   ├── api/
│   │   ├── server.ts            # Express API endpoints
│   │   └── chat/                # Claude AI integration
│   │       ├── index.ts         # Main handler, tool dispatch (20+ tools)
│   │       ├── types.ts         # ChatContext, TripLeg, resolveContextValue
│   │       ├── systemPrompt.ts  # System prompt with park mode context
│   │       ├── toolDefinitions.ts # AI tools with park codes
│   │       └── parkFeatures.ts  # Park-specific photo keywords
│   ├── providers/
│   │   ├── parks/               # S3ParkDataService, StateParkService
│   │   ├── trails/              # NPSTrailAdapter, TrailAPIAdapter
│   │   ├── NationalParksAdapter.ts
│   │   ├── YelpAdapter.ts
│   │   ├── GoogleMapsAdapter.ts
│   │   └── OpenChargeMapAdapter.ts
│   ├── domain/facade/           # TravelFacade orchestration
│   ├── mcp/                     # MCP server (Claude Desktop)
│   └── cli/                     # Command-line interface
├── data/
│   ├── scripts/                 # Data sync and upload scripts
│   └── sources/                 # Trail and park data sources
├── scripts/                     # Dev scripts (restart-ios.sh, build-ios.sh, etc.)
├── screenshots/                 # Versioned App Store screenshots
└── .copilot-instructions.md     # AI assistant rules
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
