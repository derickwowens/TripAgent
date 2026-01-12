# 🏔️ TripAgent

**AI-Powered National Park Trip Planner**

TripAgent is a mobile app and API that helps you plan amazing National Park adventures. Chat naturally with our AI assistant to get real-time flight pricing, lodging options, hiking trail recommendations, and complete budget breakdowns.

![Platform](https://img.shields.io/badge/Platform-Android-green)
![AI](https://img.shields.io/badge/AI-Claude%20AI-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### 📱 Mobile App
- **AI Chat Interface** - Natural conversation with Claude AI
- **Multi-Airport Comparison** - See 3-5 nearby airports with prices
- **Budget Breakdown** - Complete trip cost estimates
- **Saved Conversations** - Return to previous trip plans
- **Model Selection** - Choose Haiku, Sonnet, or Opus

### 🔍 Travel Tools
- **Flight Search** - Real prices from Amadeus (400+ airlines)
- **Hotel/Lodging Search** - Campgrounds, lodges, and hotels
- **Hiking Trails** - Curated recommendations by difficulty
- **Park Information** - Entrance fees, best times to visit

### ⚡ Architecture
- **React Native + Expo** - Cross-platform mobile app
- **Express API** - Backend with Claude AI integration
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

### Amadeus (Primary Provider)

1. Sign up at [developers.amadeus.com](https://developers.amadeus.com)
2. Create a new app in your dashboard
3. Copy your Client ID and Client Secret
4. Add to `.env`:
```env
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
```

**Free Tier Limits:**
- Flight offers: 2,000 calls/month
- Hotel search: 2,000 calls/month
- Test environment included

### Future Providers (Planned)

- **Skyscanner** - Meta-search for price comparisons
- **Duffel** - Modern flight booking API
- **Expedia Rapid** - Hotels + Vrbo vacation rentals

## 📊 Project Structure

```
tripagent/
├── mobile/                # React Native app
│   ├── src/
│   │   ├── screens/       # HomeScreen (chat UI)
│   │   └── services/      # API client
│   ├── assets/            # App icons
│   ├── app.json           # Expo config
│   └── eas.json           # EAS Build config
├── src/
│   ├── api/               # Express server + Claude chat
│   │   ├── server.ts      # API endpoints
│   │   └── chat.ts        # Claude AI integration
│   ├── cli/               # Command-line interface
│   ├── domain/            # Core business logic
│   │   ├── facade/        # TravelFacade orchestration
│   │   └── types/         # TypeScript interfaces
│   ├── mcp/               # MCP server (Claude Desktop)
│   └── providers/         # Travel API adapters
│       ├── flights/       # Amadeus flights
│       ├── hotels/        # Hotel search
│       └── cars/          # Car rentals
├── scripts/               # Dev scripts
├── Dockerfile             # Production deployment
├── railway.json           # Railway config
├── render.yaml            # Render config
└── DEPLOYMENT.md          # Deployment guide
```

## 🏗️ Architecture Principles

This project follows the same architecture patterns as the Fitness Hub MCP:

### 1. **Stateless Design**
No database, no session state. Each request:
1. Receives parameters from Claude
2. Queries external APIs
3. Returns results
4. Completes

### 2. **Context Engineering**
Connect to authoritative travel APIs rather than building proprietary data:
- Amadeus for flights, hotels, cars (GDS-level data)
- Skyscanner for meta-search comparisons
- Direct vendor APIs for real-time availability

### 3. **Provider Chain Pattern**
Multiple providers per category with automatic fallback:
```typescript
const flightProviders = [
  new AmadeusFlightAdapter(),   // Primary
  new SkyscannerAdapter(),      // Fallback
  new DuffelAdapter(),          // Additional
];
```

### 4. **Clear Tool Naming**
MCP tools are named explicitly for Claude to understand:
- ✅ `search_flights` (clear intent)
- ✅ `search_hotels` (specific category)
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
