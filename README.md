# 🏔️ TripAgent

**AI-Powered National Park Trip Planner**

TripAgent is a mobile app and API that helps you plan amazing National Park adventures. Chat naturally with our AI assistant to get real-time flight pricing, lodging options, hiking trail recommendations, restaurant reservations, and complete budget breakdowns.

![Platform](https://img.shields.io/badge/Platform-Android-green)
![AI](https://img.shields.io/badge/AI-Claude%20AI-blue)
![NPS](https://img.shields.io/badge/Data-NPS%20API-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### 📱 Mobile App
- **AI Chat Interface** - Natural conversation with Claude AI
- **Smart Onboarding** - Personalized profile with travel preferences
- **Photo Gallery** - Beautiful park, restaurant, and activity photos
- **Multi-Airport Comparison** - See 3-5 nearby airports with prices
- **Budget Breakdown** - Complete trip cost estimates
- **Saved Conversations** - Return to previous trip plans
- **Context-Aware** - Remembers preferences, handles overrides naturally

### 🔍 Travel Tools (12 AI-Powered Tools)
- **Park Search** - All 63 US National Parks with NPS data
- **Flight Search** - Real prices from Amadeus (400+ airlines)
- **Hotel/Lodging Search** - Campgrounds, lodges, and hotels
- **Car Rentals** - With EV/Tesla preference support
- **Restaurant Search** - Yelp + Google Places with photos
- **Reservation Links** - OpenTable, Resy integration
- **Hiking Trails** - Curated recommendations by difficulty
- **Driving Distance** - Google Maps integration
- **EV Charging** - Tesla Supercharger + DC fast charger search
- **Activities** - Tours and experiences near parks

### 🧠 Smart Context System
- **Profile Preferences** - Budget, family size, accessibility, EV ownership
- **Dynamic Overrides** - "Actually, make it 4 travelers" works naturally
- **Multi-Leg Trips** - "Fly into SFO, return from LAX" supported
- **State-Based Suggestions** - Auto-suggests parks near user's location

### ⚡ Architecture
- **React Native + Expo** - Cross-platform mobile app
- **Express API** - Backend with Claude AI integration
- **NPS API Integration** - Authoritative park data source
- **MCP Server** - Claude Desktop compatibility
- **Stateless Design** - No database, real-time API queries

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Android Studio (for emulator)
- Expo CLI (`npm install -g expo-cli`)

### Installation

```bash
# Clone and install
git clone https://github.com/yourusername/tripagent.git
cd tripagent
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
```

### Run the App

```bash
# Start everything (API + Mobile on Android emulator)
npm run android

# Or run separately:
npm run api          # Start API server on :3000
npm run mobile:android  # Start Expo + Android
```

## 📖 Usage

### CLI Commands

**Search for flights:**
```bash
npm run cli -- search-flights LAX JFK 2025-02-15
# ✈️  Searching flights from LAX to JFK...
#    Departure: 2025-02-15 (one-way)
#
# Found 5 flight(s):
#
# 1. $247.00
#    Airline: AA
#    Outbound: 5h 30m
#      AA123: LAX → JFK (5h 30m)
```

**Search for hotels:**
```bash
npm run cli -- search-hotels Paris 2025-02-15 2025-02-20
# 🏨 Searching hotels in Paris...
#    Check-in: 2025-02-15, Check-out: 2025-02-20
#
# Found 10 hotel(s):
#
# 1. Hotel Le Marais
#    4⭐ Paris, France
#    $189.00/night ($945.00 total)
```

**Search for rental cars:**
```bash
npm run cli -- search-cars LAX 2025-02-15 2025-02-20
# 🚗 Searching car rentals at LAX...
#
# 1. Hertz - Economy
#    5 seats, Automatic
#    $35.00/day ($175.00 total)
```

**Get airport info:**
```bash
npm run cli -- airport LAX
# ✈️  Los Angeles International (LAX)
#    City: Los Angeles
#    Country: USA
```

### Help

```bash
npm run cli -- help
```

## 🤖 MCP Server (Claude Desktop Integration)

Connect TripAgent to Claude Desktop as an MCP server!

### Quick Setup

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

3. Ask Claude to search for travel options!

### Example Prompts

> "Find me flights from San Francisco to Tokyo leaving March 15th"

> "Search for 4-star hotels in Barcelona for next weekend"

> "What rental cars are available at Denver airport for a week starting February 20th?"

> "What's the IATA code for London Heathrow?"

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `search_flights` | Search flights by route and date |
| `search_hotels` | Search hotels by city and dates |
| `search_car_rentals` | Search rental cars by location |
| `get_airport_info` | Get airport details by IATA code |

## 🔑 API Setup

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

## 📊 Project Structure

```
tripagent/
├── mobile/                    # React Native app
│   ├── src/
│   │   ├── screens/           # HomeScreen (chat UI)
│   │   ├── components/home/   # OnboardingFlow, ChatMessages, PhotoGallery
│   │   ├── services/          # API client
│   │   └── hooks/             # useUserProfile, useConversations, etc.
│   ├── assets/                # App icons
│   └── app.json               # Expo config
├── src/
│   ├── api/
│   │   ├── server.ts          # Express API endpoints
│   │   └── chat/              # Claude AI integration
│   │       ├── index.ts       # Main handler, tool dispatch
│   │       ├── types.ts       # ChatContext, TripLeg, resolveContextValue
│   │       ├── systemPrompt.ts # System prompt with NPS injection
│   │       ├── toolDefinitions.ts # 12 AI tools with park codes
│   │       ├── parkFeatures.ts # Park-specific photo keywords
│   │       └── responseProcessor.ts
│   ├── utils/
│   │   └── parkCodeLookup.ts  # NPS park data, findParkCode()
│   ├── providers/             # External API adapters
│   │   ├── NationalParksAdapter.ts
│   │   ├── YelpAdapter.ts     # Restaurant search
│   │   ├── GoogleMapsAdapter.ts
│   │   ├── UnsplashAdapter.ts
│   │   └── OpenChargeMapAdapter.ts
│   ├── domain/facade/         # TravelFacade orchestration
│   ├── mcp/                   # MCP server (Claude Desktop)
│   └── cli/                   # Command-line interface
├── scripts/                   # Dev scripts (restart-android.sh, etc.)
├── .copilot-instructions.md   # AI assistant rules & context docs
└── DEPLOYMENT.md              # Deployment guide
```

## 🏗️ Architecture Principles

### 1. **Authoritative Data Sources**
All park data comes from the NPS API - never hardcoded:
- Park names, codes, and states from `https://developer.nps.gov/api/v1/parks`
- Park codes injected into system prompt and tool definitions
- State-based park suggestions based on user location

### 2. **Context Priority System**
User requests override saved preferences:
```
Leg Override > Conversation Override > Trip Context > Profile Defaults > System Defaults
```
Example: Profile says "budget traveler" but user asks "show me luxury hotels" → show luxury

### 3. **Multi-Leg Trip Support**
Users can plan complex trips with different settings per segment:
```typescript
tripContext.legs = [
  { type: 'flight', from: 'LAX', to: 'SFO', overrides: { ... } },
  { type: 'stay', at: 'Yosemite' },
  { type: 'flight', from: 'SFO', to: 'LAX' }
]
```

### 4. **Context-Aware Tools**
All tools receive full ChatContext and use `resolveContextValue()`:
```typescript
const travelers = resolveContextValue<number>('numTravelers', context, activeLeg) || 1;
```

### 5. **Provider Fallback Pattern**
Multiple providers per category with automatic fallback:
- Restaurants: Yelp → Google Places
- Photos: NPS → Unsplash

### 6. **Clear Tool Naming**
Tools are named explicitly for Claude to understand:
- ✅ `search_national_parks` (clear intent)
- ✅ `search_restaurants` (specific category)
- ❌ `search` (ambiguous)

## 🚀 Deployment

### Deploy API to Railway

```bash
# Push to GitHub, then:
# 1. Go to railway.app
# 2. New Project → Deploy from GitHub
# 3. Add environment variables:
#    - ANTHROPIC_API_KEY
#    - AMADEUS_CLIENT_ID
#    - AMADEUS_CLIENT_SECRET
```

### Build for Play Store

```bash
cd mobile
eas login
eas build:configure
eas build --platform android --profile production
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete guide.

## 🔒 Privacy

- **Location data** - Used only to find nearby airports
- **Conversations** - Stored locally on device only
- **No tracking** - Zero analytics or data collection
- **AI processing** - Chat messages sent to Anthropic's Claude API

## 🔑 API Keys

| Service | Free Tier | Sign Up |
|---------|-----------|---------|
| Anthropic | Pay per use | [console.anthropic.com](https://console.anthropic.com) |
| Amadeus | 2,000 calls/mo | [developers.amadeus.com](https://developers.amadeus.com) |

## 📄 License

MIT
