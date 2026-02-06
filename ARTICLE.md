# I'm Paying Infra Costs for AI to Plan Our (And Your) Park Trips. Here's Why It's Worth It (And Smarter Than Me)

*Building Adventure Agent: An AI-powered park trip planner that aggregates 10+ APIs, 550+ parks, and 800+ trails into a single conversation*

---

My girlfriend Kandice and I love to travel, camp, and explore the outdoors together. We've spent countless weekends loading up the car, picking a park, and figuring out the logistics on the fly. We have to decide where to hike, where to camp, where to eat, how far the drive is. Every trip started the same way: bouncing between six different apps trying to piece together a plan.

![Of course, I'm always the photographer](kandice.jpg)

After one too many trips where we showed up to a full campground we didn't know required reservations, or drove an extra hour because we picked the wrong campground, I decided to build the tool we kept wishing existed.

That's how Adventure Agent started, as a personal frustration.

---

## The Problem Nobody Solved

There are thousands of travel apps. Kayak for flights. AllTrails for hiking. Recreation.gov for campgrounds. Yelp for restaurants. Google Maps for driving. The NPS app for park info. Don't get me started on the state park apps. 

Planning a trip to Yellowstone means opening six apps, cross-referencing data between them, and manually assembling an itinerary in your Notes app like it's 2009.

![These jeans still ain't it](jeans.jpeg)

**The problem isn't a lack of travel tools. It's that none of them talk to each other.**

I wanted to build something different: a single conversational interface where you say "Plan me a 4-day trip to Zion" and get back flights, lodging, trails, campgrounds, restaurants, driving times, and a complete budget breakdown all from authoritative sources, all in one place.

That's Adventure Agent. And the hard part wasn't the AI. It was the data.

---

## The Architecture Nobody Sees

Users see a chat interface. What they don't see is 10+ API integrations, a multi-source data aggregation layer, and 20+ AI-powered tools orchestrating behind every message.

Here's what actually happens when someone asks "What are the best hikes in Yosemite?":

1. **Claude AI** parses the intent and selects the `get_park_hikes` tool
2. The tool queries **S3** for curated trail data aggregated from multiple sources
3. If S3 has no data, it falls back to **NPS API** for official trail information
4. Each trail gets enriched with **Google Maps** navigation links
5. **NPS.gov** URLs are attached for official trail pages
6. Results are formatted and returned to the conversation

Six systems. One question. Sub-second response.

### The Full Integration Stack

| Provider | What It Does | Data Type |
|----------|-------------|-----------|
| **NPS API** | Official park data for all 63 National Parks | Parks, trails, campgrounds, alerts |
| **Recreation.gov** | Federal campground reservations | Campground availability, fees, booking links |
| **Amadeus** | Flight, hotel, car rental pricing from 400+ airlines | Real-time travel pricing |
| **Yelp Fusion** | Restaurant search with ratings and photos | Dining near parks |
| **Google Maps** | Driving distance, directions, restaurant fallback | Navigation, drive times |
| **TrailAPI** | State park trail data by coordinates | Trail discovery for state parks |
| **iNaturalist** | Wildlife observations with photos | Species near parks |
| **OpenChargeMap** | EV charging stations and Tesla Superchargers | EV road trip planning |
| **Kiwi** | Secondary flight search for price comparison | Flight pricing backup |
| **Claude AI** | Conversation, intent parsing, tool orchestration | The brain |
| **AWS S3** | Curated park and trail database | 550+ parks, 800+ trails |

That's 11 services behind a single text input.

---

## The Data Aggregation Problem

Here's the dirty secret of outdoor recreation data: **there is no single source of truth.**

![Where da data?](confused-travolta.jpeg)

The NPS API has official data for 63 National Parks. But it doesn't cover state parks. Recreation.gov has campground data, but not trail data. TrailAPI has trails, but not campgrounds. State park websites vary wildly — Wisconsin has excellent data, Arizona has almost none online.

The traditional approach is to pick one API and build around it. The problem? Every API has gaps. Every source has blind spots. No single provider covers the full picture.

So I built an aggregation layer.

### S3 as the Aggregation Layer

The S3 bucket isn't a mirror of any single API. It's a **normalized aggregation** of data collected from multiple disparate sources:

```
tripagent-park-data/
  state-parks/{STATE}/index.json     # Park metadata per state
  trails/state-parks/{STATE}/trails.json  # Trail data per state
  national/{parkCode}/data.json      # National park data
  trails/all-parks-trails.json       # Combined trail index
```

Every record conforms to a unified schema regardless of where it came from. A trail from the NPS API looks identical to a trail from TrailAPI looks identical to a trail curated from a state park website. The app doesn't know or care about the source. It just queries normalized data.

### The Enrichment Pipeline

Raw API data isn't enough. When we sync data, every record gets enriched with:

- **Coordinates** for mapping and distance calculations
- **Official website URLs** for authoritative information
- **Google Maps links** for one-tap navigation
- **Cross-references** to related data in other sources

The philosophy is simple: **every record should contain everything the app needs to serve the user, without making additional API calls at runtime.**

This means a trail record doesn't just have a name and difficulty. It has a navigable link, an official source URL, coordinates for distance calculation, and enough metadata to render a complete UI card.

---

## 20+ AI Tools: The Orchestration Layer

Claude doesn't just chat. It has access to 20+ specialized tools that it selects based on conversation context:

### Tool Categories

**Park Discovery**
- `search_national_parks` — All 63 US National Parks via NPS
- `get_park_details` — Fees, hours, alerts, weather
- `get_park_hikes` — 800+ trails with difficulty and distance
- `search_campgrounds` — Recreation.gov integration
- `get_park_wildlife` — iNaturalist species observations

**Travel Logistics**
- `search_flights` — Real pricing from 400+ airlines
- `search_hotels` — Hotels and lodges near parks
- `search_car_rentals` — With EV preference detection
- `get_driving_distance` — Accurate drive times via Google Maps
- `search_ev_charging_stations` — Tesla Supercharger routing

**Local Discovery**
- `search_restaurants` — Yelp + Google Places with photos
- `search_activities` — Tours and experiences via Amadeus

**State Parks**
- `search_state_parks` — Parks across all 50 states
- `get_state_park_details` — Acreage, facilities, access
- `get_state_park_hikes` — Curated trail database
- `search_state_campgrounds` — Recreation.gov + state data

The key insight: **Claude selects the right tools based on conversational context, not explicit commands.** Say "I need somewhere to eat near Zion" and it calls `search_restaurants` with the gateway city of Springdale, UT — because the system prompt includes gateway city mappings for every park.

---

## Context: The Feature Nobody Talks About

Most travel apps treat every interaction as stateless. You search, you get results, you start over.

Adventure Agent maintains a full context hierarchy:

```
Leg-Specific Override > Conversation Override > Trip Context > Profile Defaults > System Defaults
```

In practice, this means:

**Profile says:** "Budget traveler, family of 4, Tesla owner"

**User asks:** "Show me luxury hotels near Yellowstone for just me and my wife"

**System resolves:**
- Budget: luxury (conversation override wins)
- Travelers: 2 (conversation override wins)
- EV preference: Tesla (profile default, no override)

Every tool receives this resolved context. The hotel search returns luxury options for 2 adults. The EV charging tool suggests Tesla Superchargers on the route. The restaurant search skips the $ spots.

One sentence from the user. Three context resolutions. Zero friction.

### Multi-Leg Trips

"Fly into SFO, spend 3 days in Yosemite, then drive to Sequoia, then fly out of LAX."

Most travel apps can't handle this. Adventure Agent models it as a multi-leg trip where each segment can have its own overrides:

```typescript
tripContext.legs = [
  { type: 'flight', from: 'MSN', to: 'SFO' },
  { type: 'stay', at: 'Yosemite', days: 3 },
  { type: 'drive', from: 'Yosemite', to: 'Sequoia' },
  { type: 'stay', at: 'Sequoia', days: 2 },
  { type: 'flight', from: 'LAX', to: 'MSN' }
]
```

Different airports, different parks, different durations — all in one conversation.

---

## The Distance Problem: Making Data Spatial

Having 550+ parks in a database is useless if you can't answer: "What's near me?"

This required solving the spatial problem at the client level. When a user opens the State Parks menu, the app:

1. Gets the user's GPS coordinates
2. Calculates Haversine distance to every park in the active state
3. Computes cardinal direction (N, NE, E, SE, S, SW, W, NW) using bearing math
4. Sorts by proximity
5. Renders each park with a distance badge: `Devil's Lake (12mi NW)`

```typescript
const getCardinalDirection = (
  lat1: number, lon1: number,
  lat2: number, lon2: number
): string => {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(bearing / 45) % 8];
};
```

All computed client-side. No additional API calls. The user sees `Mirror Lake (3mi E)` and `Devil's Lake (47mi NW)` and immediately knows what's close and which direction to drive.

---

## The Provider Fallback Pattern

APIs fail. Rate limits hit. Keys expire. A production travel app can't show users "Error: 429 Too Many Requests."

Every data category has a fallback chain:

```
Restaurants: Yelp -> Google Places -> Google Maps search link
Photos: NPS API -> iNaturalist -> park keyword search
Trails: S3 curated data -> NPS API -> TrailAPI -> Google Maps link
Flights: Amadeus -> Kiwi
Campgrounds: Recreation.gov -> NPS API -> Google Maps link
```

If Yelp is down, users still get restaurant results from Google Places. If the trail database has no data for a park, the NPS API fills in. If that fails too, users get a Google Maps link that searches for the trail by name.

**The user never sees a failure. They see results.** The source might change, but the experience doesn't.

---

## What I Actually Built: By The Numbers

| Metric | Value |
|--------|-------|
| API integrations | 11 |
| AI-powered tools | 20+ |
| National Parks covered | 63 (all of them) |
| State parks in database | 76+ (and growing) |
| Trails in database | 800+ |
| Platforms | iOS + Android |
| User database | None (stateless, privacy-first) |
| Lines of provider code | ~4,000 |
| Lines of tool handler code | ~2,500 |
| Deploy scripts | 5 (iOS, Android, both, restart-ios, restart-android) |
| Time from push to App Store | ~15 minutes |

---

## The Philosophy: Aggregation Over Integration

The fundamental design decision behind Adventure Agent is that **the value is in aggregation, not integration.**

Integration means connecting to one API and building a UI around it. That gives you exactly what one provider offers — nothing more.

Aggregation means collecting data from many sources, normalizing it into a unified schema, enriching it with cross-references, and presenting it through a single interface. That gives you something no individual provider can offer: the complete picture.

The NPS API knows about National Parks. Recreation.gov knows about campgrounds. TrailAPI knows about trails. Yelp knows about restaurants. Amadeus knows about flights.

Adventure Agent knows about all of them. And it connects them in ways none of them can individually.

"What's the cheapest way to get to Glacier, where should I camp, what should I hike, and where should I eat afterward?"

One question. Five data sources. One answer.

---

## The Bigger Picture

We're in an era where the barrier to building software has collapsed. But the barrier to building *useful* software hasn't changed: you still need to deeply understand a problem domain.

Adventure Agent isn't impressive because it uses AI. Every app uses AI now. It's useful because it understands that planning an outdoor trip is fundamentally a **data aggregation problem** — and it solves that problem by treating its database as a place where information is collected from many sources and normalized into one schema.

The AI is the interface. The data is the product.

Every park, every trail, every campground, every flight price — collected from disparate sources, normalized into a unified schema, enriched with navigation links and cross-references, and served through a conversation that feels like talking to a friend who's been to every park in the country.

That's not an AI trick. That's an architecture decision.

---

## Try It

Adventure Agent is available on [iOS](https://apps.apple.com/app/adventure-agent/id6757965908) and [Android](https://play.google.com/store/apps/details?id=com.tripagent.app).

Tell it where you want to go. It'll handle the rest.

---

*Derick Owens is a software developer who believes the best apps don't show you data — they connect it. Find more of his work at [medium.com/@derickwowens](https://medium.com/@derickwowens).*
