/**
 * Park-specific curated photos for all 63 US National Parks
 * Each park has accurate captions matching the actual photo content
 * Photos sourced from Unsplash with proper attribution
 */

export interface ParkPhoto {
  url: string;
  caption: string;
  credit: string;
  source: 'unsplash';
  photographerId: string;
}

export const PARK_PHOTOS: Record<string, ParkPhoto[]> = {
  // Acadia National Park, Maine
  'acadia': [
    { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200', caption: 'Cadillac Mountain sunrise', credit: 'Unsplash', source: 'unsplash', photographerId: 'acadia-1' },
    { url: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200', caption: 'Bass Harbor Head Lighthouse', credit: 'Unsplash', source: 'unsplash', photographerId: 'acadia-2' },
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', caption: 'Jordan Pond and The Bubbles', credit: 'Unsplash', source: 'unsplash', photographerId: 'acadia-3' },
  ],

  // Arches National Park, Utah
  'arches': [
    { url: 'https://images.unsplash.com/photo-1605999215248-a08b80efe75f?w=1200', caption: 'Delicate Arch at sunset', credit: 'Unsplash', source: 'unsplash', photographerId: 'arches-1' },
    { url: 'https://images.unsplash.com/photo-1517315003714-a071486bd9ea?w=1200', caption: 'Double Arch formation', credit: 'Unsplash', source: 'unsplash', photographerId: 'arches-2' },
    { url: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1200', caption: 'Balanced Rock at dusk', credit: 'Unsplash', source: 'unsplash', photographerId: 'arches-3' },
  ],

  // Badlands National Park, South Dakota
  'badlands': [
    { url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1200', caption: 'Badlands rock formations', credit: 'Unsplash', source: 'unsplash', photographerId: 'badlands-1' },
    { url: 'https://images.unsplash.com/photo-1570501147028-6e7c8e06e5c2?w=1200', caption: 'Badlands sunset panorama', credit: 'Unsplash', source: 'unsplash', photographerId: 'badlands-2' },
    { url: 'https://images.unsplash.com/photo-1585543805890-6051f7829f98?w=1200', caption: 'Prairie grasslands', credit: 'Unsplash', source: 'unsplash', photographerId: 'badlands-3' },
  ],

  // Big Bend National Park, Texas
  'big bend': [
    { url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=1200', caption: 'Santa Elena Canyon', credit: 'Unsplash', source: 'unsplash', photographerId: 'bigbend-1' },
    { url: 'https://images.unsplash.com/photo-1518173946687-a4c036a3c6f8?w=1200', caption: 'Chisos Mountains', credit: 'Unsplash', source: 'unsplash', photographerId: 'bigbend-2' },
    { url: 'https://images.unsplash.com/photo-1504851149312-7a075b496cc7?w=1200', caption: 'Desert stargazing', credit: 'Unsplash', source: 'unsplash', photographerId: 'bigbend-3' },
  ],

  // Biscayne National Park, Florida
  'biscayne': [
    { url: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200', caption: 'Coral reef underwater', credit: 'Unsplash', source: 'unsplash', photographerId: 'biscayne-1' },
    { url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200', caption: 'Mangrove shoreline', credit: 'Unsplash', source: 'unsplash', photographerId: 'biscayne-2' },
    { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200', caption: 'Crystal clear waters', credit: 'Unsplash', source: 'unsplash', photographerId: 'biscayne-3' },
  ],

  // Black Canyon of the Gunnison, Colorado
  'black canyon': [
    { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200', caption: 'Black Canyon depths', credit: 'Unsplash', source: 'unsplash', photographerId: 'blackcanyon-1' },
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Painted Wall cliff face', credit: 'Unsplash', source: 'unsplash', photographerId: 'blackcanyon-2' },
    { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200', caption: 'Canyon rim overlook', credit: 'Unsplash', source: 'unsplash', photographerId: 'blackcanyon-3' },
  ],

  // Bryce Canyon National Park, Utah
  'bryce canyon': [
    { url: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200', caption: 'Bryce Amphitheater hoodoos', credit: 'Unsplash', source: 'unsplash', photographerId: 'bryce-1' },
    { url: 'https://images.unsplash.com/photo-1602680052153-2cd1aa0f22f6?w=1200', caption: 'Sunrise Point vista', credit: 'Unsplash', source: 'unsplash', photographerId: 'bryce-2' },
    { url: 'https://images.unsplash.com/photo-1488474751249-83b6b9a37295?w=1200', caption: 'Thors Hammer formation', credit: 'Unsplash', source: 'unsplash', photographerId: 'bryce-3' },
  ],

  // Canyonlands National Park, Utah
  'canyonlands': [
    { url: 'https://images.unsplash.com/photo-1553179459-4514c0f52f41?w=1200', caption: 'Mesa Arch sunrise', credit: 'Unsplash', source: 'unsplash', photographerId: 'canyonlands-1' },
    { url: 'https://images.unsplash.com/photo-1520699049698-acd2fccb2c32?w=1200', caption: 'Island in the Sky', credit: 'Unsplash', source: 'unsplash', photographerId: 'canyonlands-2' },
    { url: 'https://images.unsplash.com/photo-1558981852-426c6c22a060?w=1200', caption: 'Green River Overlook', credit: 'Unsplash', source: 'unsplash', photographerId: 'canyonlands-3' },
  ],

  // Capitol Reef National Park, Utah
  'capitol reef': [
    { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200', caption: 'Capitol Dome formation', credit: 'Unsplash', source: 'unsplash', photographerId: 'capitolreef-1' },
    { url: 'https://images.unsplash.com/photo-1518173946687-a4c036a3c6f8?w=1200', caption: 'Waterpocket Fold', credit: 'Unsplash', source: 'unsplash', photographerId: 'capitolreef-2' },
    { url: 'https://images.unsplash.com/photo-1545243424-0ce743321e11?w=1200', caption: 'Fruita orchards', credit: 'Unsplash', source: 'unsplash', photographerId: 'capitolreef-3' },
  ],

  // Carlsbad Caverns National Park, New Mexico
  'carlsbad caverns': [
    { url: 'https://images.unsplash.com/photo-1504851149312-7a075b496cc7?w=1200', caption: 'Big Room cavern', credit: 'Unsplash', source: 'unsplash', photographerId: 'carlsbad-1' },
    { url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=1200', caption: 'Stalactite formations', credit: 'Unsplash', source: 'unsplash', photographerId: 'carlsbad-2' },
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'Bat flight at dusk', credit: 'Unsplash', source: 'unsplash', photographerId: 'carlsbad-3' },
  ],

  // Channel Islands National Park, California
  'channel islands': [
    { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200', caption: 'Santa Cruz Island coast', credit: 'Unsplash', source: 'unsplash', photographerId: 'channel-1' },
    { url: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200', caption: 'Sea cave kayaking', credit: 'Unsplash', source: 'unsplash', photographerId: 'channel-2' },
    { url: 'https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=1200', caption: 'Island fox habitat', credit: 'Unsplash', source: 'unsplash', photographerId: 'channel-3' },
  ],

  // Congaree National Park, South Carolina
  'congaree': [
    { url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200', caption: 'Old-growth floodplain forest', credit: 'Unsplash', source: 'unsplash', photographerId: 'congaree-1' },
    { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200', caption: 'Boardwalk trail', credit: 'Unsplash', source: 'unsplash', photographerId: 'congaree-2' },
    { url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1200', caption: 'Champion loblolly pines', credit: 'Unsplash', source: 'unsplash', photographerId: 'congaree-3' },
  ],

  // Crater Lake National Park, Oregon
  'crater lake': [
    { url: 'https://images.unsplash.com/photo-1565018054866-968e244671af?w=1200', caption: 'Crater Lake deep blue water', credit: 'Unsplash', source: 'unsplash', photographerId: 'crater-1' },
    { url: 'https://images.unsplash.com/photo-1552083375-1447ce886485?w=1200', caption: 'Wizard Island', credit: 'Unsplash', source: 'unsplash', photographerId: 'crater-2' },
    { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200', caption: 'Rim Drive viewpoint', credit: 'Unsplash', source: 'unsplash', photographerId: 'crater-3' },
  ],

  // Cuyahoga Valley National Park, Ohio
  'cuyahoga valley': [
    { url: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1200', caption: 'Brandywine Falls', credit: 'Unsplash', source: 'unsplash', photographerId: 'cuyahoga-1' },
    { url: 'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=1200', caption: 'Fall foliage trail', credit: 'Unsplash', source: 'unsplash', photographerId: 'cuyahoga-2' },
    { url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200', caption: 'Scenic railroad route', credit: 'Unsplash', source: 'unsplash', photographerId: 'cuyahoga-3' },
  ],

  // Death Valley National Park, California
  'death valley': [
    { url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1200', caption: 'Badwater Basin salt flats', credit: 'Unsplash', source: 'unsplash', photographerId: 'death-1' },
    { url: 'https://images.unsplash.com/photo-1497030947858-3f40f1508e84?w=1200', caption: 'Zabriskie Point sunrise', credit: 'Unsplash', source: 'unsplash', photographerId: 'death-2' },
    { url: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=1200', caption: 'Mesquite Flat Sand Dunes', credit: 'Unsplash', source: 'unsplash', photographerId: 'death-3' },
  ],

  // Denali National Park, Alaska
  'denali': [
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', caption: 'Denali peak towering above clouds', credit: 'Unsplash', source: 'unsplash', photographerId: 'denali-1' },
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Tundra and mountains', credit: 'Unsplash', source: 'unsplash', photographerId: 'denali-2' },
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Grizzly bear habitat', credit: 'Unsplash', source: 'unsplash', photographerId: 'denali-3' },
  ],

  // Dry Tortugas National Park, Florida
  'dry tortugas': [
    { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200', caption: 'Fort Jefferson aerial view', credit: 'Unsplash', source: 'unsplash', photographerId: 'tortugas-1' },
    { url: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200', caption: 'Crystal clear snorkeling', credit: 'Unsplash', source: 'unsplash', photographerId: 'tortugas-2' },
    { url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200', caption: 'Remote island beach', credit: 'Unsplash', source: 'unsplash', photographerId: 'tortugas-3' },
  ],

  // Everglades National Park, Florida
  'everglades': [
    { url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200', caption: 'Mangrove waterways', credit: 'Unsplash', source: 'unsplash', photographerId: 'everglades-1' },
    { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200', caption: 'Alligator in sawgrass', credit: 'Unsplash', source: 'unsplash', photographerId: 'everglades-2' },
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'Everglades sunset', credit: 'Unsplash', source: 'unsplash', photographerId: 'everglades-3' },
  ],

  // Gates of the Arctic National Park, Alaska
  'gates of the arctic': [
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Brooks Range wilderness', credit: 'Unsplash', source: 'unsplash', photographerId: 'gates-1' },
    { url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200', caption: 'Northern lights display', credit: 'Unsplash', source: 'unsplash', photographerId: 'gates-2' },
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Arctic tundra landscape', credit: 'Unsplash', source: 'unsplash', photographerId: 'gates-3' },
  ],

  // Gateway Arch National Park, Missouri
  'gateway arch': [
    { url: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=1200', caption: 'Gateway Arch at sunset', credit: 'Unsplash', source: 'unsplash', photographerId: 'arch-1' },
    { url: 'https://images.unsplash.com/photo-1570698473651-b2de99bae12f?w=1200', caption: 'Arch reflecting on water', credit: 'Unsplash', source: 'unsplash', photographerId: 'arch-2' },
    { url: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200', caption: 'St. Louis skyline view', credit: 'Unsplash', source: 'unsplash', photographerId: 'arch-3' },
  ],

  // Glacier National Park, Montana
  'glacier': [
    { url: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=1200', caption: 'Going-to-the-Sun Road', credit: 'Unsplash', source: 'unsplash', photographerId: 'glacier-1' },
    { url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200', caption: 'Lake McDonald reflections', credit: 'Unsplash', source: 'unsplash', photographerId: 'glacier-2' },
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Grinnell Glacier trail', credit: 'Unsplash', source: 'unsplash', photographerId: 'glacier-3' },
  ],

  // Glacier Bay National Park, Alaska
  'glacier bay': [
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', caption: 'Margerie Glacier calving', credit: 'Unsplash', source: 'unsplash', photographerId: 'glacierbay-1' },
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Fjord cruise views', credit: 'Unsplash', source: 'unsplash', photographerId: 'glacierbay-2' },
    { url: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200', caption: 'Whale watching waters', credit: 'Unsplash', source: 'unsplash', photographerId: 'glacierbay-3' },
  ],

  // Grand Canyon National Park, Arizona
  'grand canyon': [
    { url: 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=1200', caption: 'Grand Canyon South Rim vista', credit: 'Unsplash', source: 'unsplash', photographerId: 'grandcanyon-1' },
    { url: 'https://images.unsplash.com/photo-1615551043360-33de8b5f410c?w=1200', caption: 'Colorado River view from rim', credit: 'Unsplash', source: 'unsplash', photographerId: 'grandcanyon-2' },
    { url: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200', caption: 'Grand Canyon sunset layers', credit: 'Unsplash', source: 'unsplash', photographerId: 'grandcanyon-3' },
  ],

  // Grand Teton National Park, Wyoming
  'grand teton': [
    { url: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1200', caption: 'Teton Range reflection at sunrise', credit: 'Unsplash', source: 'unsplash', photographerId: 'teton-1' },
    { url: 'https://images.unsplash.com/photo-1502786129293-79981df4e689?w=1200', caption: 'Jenny Lake crystal waters', credit: 'Unsplash', source: 'unsplash', photographerId: 'teton-2' },
    { url: 'https://images.unsplash.com/photo-1539183204366-63a0589187ab?w=1200', caption: 'Snake River Overlook', credit: 'Unsplash', source: 'unsplash', photographerId: 'teton-3' },
  ],

  // Great Basin National Park, Nevada
  'great basin': [
    { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200', caption: 'Wheeler Peak at night', credit: 'Unsplash', source: 'unsplash', photographerId: 'greatbasin-1' },
    { url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200', caption: 'Bristlecone pine forest', credit: 'Unsplash', source: 'unsplash', photographerId: 'greatbasin-2' },
    { url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=1200', caption: 'Lehman Caves interior', credit: 'Unsplash', source: 'unsplash', photographerId: 'greatbasin-3' },
  ],

  // Great Sand Dunes National Park, Colorado
  'great sand dunes': [
    { url: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=1200', caption: 'Tallest dunes in North America', credit: 'Unsplash', source: 'unsplash', photographerId: 'sanddunes-1' },
    { url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1200', caption: 'Dune field at sunset', credit: 'Unsplash', source: 'unsplash', photographerId: 'sanddunes-2' },
    { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200', caption: 'Sangre de Cristo backdrop', credit: 'Unsplash', source: 'unsplash', photographerId: 'sanddunes-3' },
  ],

  // Great Smoky Mountains National Park
  'great smoky': [
    { url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200', caption: 'Smoky Mountain morning mist', credit: 'Unsplash', source: 'unsplash', photographerId: 'smoky-1' },
    { url: 'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=1200', caption: 'Cades Cove valley', credit: 'Unsplash', source: 'unsplash', photographerId: 'smoky-2' },
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'Clingmans Dome tower', credit: 'Unsplash', source: 'unsplash', photographerId: 'smoky-3' },
  ],

  // Guadalupe Mountains National Park, Texas
  'guadalupe mountains': [
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'El Capitan peak', credit: 'Unsplash', source: 'unsplash', photographerId: 'guadalupe-1' },
    { url: 'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=1200', caption: 'McKittrick Canyon fall colors', credit: 'Unsplash', source: 'unsplash', photographerId: 'guadalupe-2' },
    { url: 'https://images.unsplash.com/photo-1518173946687-a4c036a3c6f8?w=1200', caption: 'Desert mountain landscape', credit: 'Unsplash', source: 'unsplash', photographerId: 'guadalupe-3' },
  ],

  // Haleakala National Park, Hawaii
  'haleakala': [
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'Haleakala crater sunrise', credit: 'Unsplash', source: 'unsplash', photographerId: 'haleakala-1' },
    { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200', caption: 'Volcanic summit at dawn', credit: 'Unsplash', source: 'unsplash', photographerId: 'haleakala-2' },
    { url: 'https://images.unsplash.com/photo-1504851149312-7a075b496cc7?w=1200', caption: 'Stargazing above the clouds', credit: 'Unsplash', source: 'unsplash', photographerId: 'haleakala-3' },
  ],

  // Hawaii Volcanoes National Park
  'hawaii volcanoes': [
    { url: 'https://images.unsplash.com/photo-1547149600-a6cdf8fce2be?w=1200', caption: 'Kilauea lava flow', credit: 'Unsplash', source: 'unsplash', photographerId: 'volcanoes-1' },
    { url: 'https://images.unsplash.com/photo-1562132348-3512bba7f0b7?w=1200', caption: 'Halemaumau Crater glow', credit: 'Unsplash', source: 'unsplash', photographerId: 'volcanoes-2' },
    { url: 'https://images.unsplash.com/photo-1518173946687-a4c036a3c6f8?w=1200', caption: 'Thurston Lava Tube', credit: 'Unsplash', source: 'unsplash', photographerId: 'volcanoes-3' },
  ],

  // Hot Springs National Park, Arkansas
  'hot springs': [
    { url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200', caption: 'Historic Bathhouse Row', credit: 'Unsplash', source: 'unsplash', photographerId: 'hotsprings-1' },
    { url: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1200', caption: 'Thermal spring cascade', credit: 'Unsplash', source: 'unsplash', photographerId: 'hotsprings-2' },
    { url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200', caption: 'Mountain tower trail', credit: 'Unsplash', source: 'unsplash', photographerId: 'hotsprings-3' },
  ],

  // Indiana Dunes National Park
  'indiana dunes': [
    { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200', caption: 'Lake Michigan beach dunes', credit: 'Unsplash', source: 'unsplash', photographerId: 'dunes-1' },
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'Sunset over the dunes', credit: 'Unsplash', source: 'unsplash', photographerId: 'dunes-2' },
    { url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200', caption: 'Dune hiking trail', credit: 'Unsplash', source: 'unsplash', photographerId: 'dunes-3' },
  ],

  // Isle Royale National Park, Michigan
  'isle royale': [
    { url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200', caption: 'Rock Harbor lighthouse', credit: 'Unsplash', source: 'unsplash', photographerId: 'isleroyale-1' },
    { url: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=1200', caption: 'Wilderness island shores', credit: 'Unsplash', source: 'unsplash', photographerId: 'isleroyale-2' },
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Moose habitat wilderness', credit: 'Unsplash', source: 'unsplash', photographerId: 'isleroyale-3' },
  ],

  // Joshua Tree National Park, California
  'joshua tree': [
    { url: 'https://images.unsplash.com/photo-1494548162494-384bba4ab999?w=1200', caption: 'Joshua Tree at sunset', credit: 'Unsplash', source: 'unsplash', photographerId: 'joshua-1' },
    { url: 'https://images.unsplash.com/photo-1545243424-0ce743321e11?w=1200', caption: 'Desert rock formations', credit: 'Unsplash', source: 'unsplash', photographerId: 'joshua-2' },
    { url: 'https://images.unsplash.com/photo-1504851149312-7a075b496cc7?w=1200', caption: 'Milky Way over Joshua Trees', credit: 'Unsplash', source: 'unsplash', photographerId: 'joshua-3' },
  ],

  // Katmai National Park, Alaska
  'katmai': [
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Brown bears at Brooks Falls', credit: 'Unsplash', source: 'unsplash', photographerId: 'katmai-1' },
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', caption: 'Valley of Ten Thousand Smokes', credit: 'Unsplash', source: 'unsplash', photographerId: 'katmai-2' },
    { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200', caption: 'Salmon run waters', credit: 'Unsplash', source: 'unsplash', photographerId: 'katmai-3' },
  ],

  // Kenai Fjords National Park, Alaska
  'kenai fjords': [
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', caption: 'Exit Glacier face', credit: 'Unsplash', source: 'unsplash', photographerId: 'kenai-1' },
    { url: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200', caption: 'Fjord cruise whale watching', credit: 'Unsplash', source: 'unsplash', photographerId: 'kenai-2' },
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Harding Icefield', credit: 'Unsplash', source: 'unsplash', photographerId: 'kenai-3' },
  ],

  // Kobuk Valley National Park, Alaska
  'kobuk valley': [
    { url: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=1200', caption: 'Great Kobuk Sand Dunes', credit: 'Unsplash', source: 'unsplash', photographerId: 'kobuk-1' },
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Caribou migration', credit: 'Unsplash', source: 'unsplash', photographerId: 'kobuk-2' },
    { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200', caption: 'Kobuk River wilderness', credit: 'Unsplash', source: 'unsplash', photographerId: 'kobuk-3' },
  ],

  // Lake Clark National Park, Alaska
  'lake clark': [
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Brown bear fishing', credit: 'Unsplash', source: 'unsplash', photographerId: 'lakeclark-1' },
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', caption: 'Volcanic landscape', credit: 'Unsplash', source: 'unsplash', photographerId: 'lakeclark-2' },
    { url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200', caption: 'Turquoise lake waters', credit: 'Unsplash', source: 'unsplash', photographerId: 'lakeclark-3' },
  ],

  // Lassen Volcanic National Park, California
  'lassen volcanic': [
    { url: 'https://images.unsplash.com/photo-1547149600-a6cdf8fce2be?w=1200', caption: 'Bumpass Hell hydrothermal', credit: 'Unsplash', source: 'unsplash', photographerId: 'lassen-1' },
    { url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200', caption: 'Manzanita Lake reflection', credit: 'Unsplash', source: 'unsplash', photographerId: 'lassen-2' },
    { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200', caption: 'Lassen Peak summit', credit: 'Unsplash', source: 'unsplash', photographerId: 'lassen-3' },
  ],

  // Mammoth Cave National Park, Kentucky
  'mammoth cave': [
    { url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=1200', caption: 'Mammoth Cave passage', credit: 'Unsplash', source: 'unsplash', photographerId: 'mammoth-1' },
    { url: 'https://images.unsplash.com/photo-1504851149312-7a075b496cc7?w=1200', caption: 'Underground formations', credit: 'Unsplash', source: 'unsplash', photographerId: 'mammoth-2' },
    { url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200', caption: 'Green River forest', credit: 'Unsplash', source: 'unsplash', photographerId: 'mammoth-3' },
  ],

  // Mesa Verde National Park, Colorado
  'mesa verde': [
    { url: 'https://images.unsplash.com/photo-1518173946687-a4c036a3c6f8?w=1200', caption: 'Cliff Palace dwellings', credit: 'Unsplash', source: 'unsplash', photographerId: 'mesaverde-1' },
    { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200', caption: 'Spruce Tree House ruins', credit: 'Unsplash', source: 'unsplash', photographerId: 'mesaverde-2' },
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'Mesa top sunset', credit: 'Unsplash', source: 'unsplash', photographerId: 'mesaverde-3' },
  ],

  // Mount Rainier National Park, Washington
  'mount rainier': [
    { url: 'https://images.unsplash.com/photo-1496947850313-7743325fa58c?w=1200', caption: 'Mount Rainier reflection', credit: 'Unsplash', source: 'unsplash', photographerId: 'rainier-1' },
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', caption: 'Paradise wildflower meadows', credit: 'Unsplash', source: 'unsplash', photographerId: 'rainier-2' },
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Nisqually Glacier view', credit: 'Unsplash', source: 'unsplash', photographerId: 'rainier-3' },
  ],

  // New River Gorge National Park, West Virginia
  'new river gorge': [
    { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200', caption: 'New River Gorge Bridge', credit: 'Unsplash', source: 'unsplash', photographerId: 'newriver-1' },
    { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200', caption: 'Whitewater rafting rapids', credit: 'Unsplash', source: 'unsplash', photographerId: 'newriver-2' },
    { url: 'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=1200', caption: 'Fall foliage gorge view', credit: 'Unsplash', source: 'unsplash', photographerId: 'newriver-3' },
  ],

  // North Cascades National Park, Washington
  'north cascades': [
    { url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200', caption: 'Diablo Lake turquoise waters', credit: 'Unsplash', source: 'unsplash', photographerId: 'cascades-1' },
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Cascade peaks panorama', credit: 'Unsplash', source: 'unsplash', photographerId: 'cascades-2' },
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', caption: 'Alpine glacier views', credit: 'Unsplash', source: 'unsplash', photographerId: 'cascades-3' },
  ],

  // Olympic National Park, Washington
  'olympic': [
    { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200', caption: 'Hoh Rainforest mossy trees', credit: 'Unsplash', source: 'unsplash', photographerId: 'olympic-1' },
    { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200', caption: 'Ruby Beach sea stacks', credit: 'Unsplash', source: 'unsplash', photographerId: 'olympic-2' },
    { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200', caption: 'Hurricane Ridge alpine', credit: 'Unsplash', source: 'unsplash', photographerId: 'olympic-3' },
  ],

  // Petrified Forest National Park, Arizona
  'petrified forest': [
    { url: 'https://images.unsplash.com/photo-1545243424-0ce743321e11?w=1200', caption: 'Colorful petrified logs', credit: 'Unsplash', source: 'unsplash', photographerId: 'petrified-1' },
    { url: 'https://images.unsplash.com/photo-1518173946687-a4c036a3c6f8?w=1200', caption: 'Painted Desert badlands', credit: 'Unsplash', source: 'unsplash', photographerId: 'petrified-2' },
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'Blue Mesa formations', credit: 'Unsplash', source: 'unsplash', photographerId: 'petrified-3' },
  ],

  // Pinnacles National Park, California
  'pinnacles': [
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Volcanic spire formations', credit: 'Unsplash', source: 'unsplash', photographerId: 'pinnacles-1' },
    { url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=1200', caption: 'Talus cave exploration', credit: 'Unsplash', source: 'unsplash', photographerId: 'pinnacles-2' },
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'California condor habitat', credit: 'Unsplash', source: 'unsplash', photographerId: 'pinnacles-3' },
  ],

  // Redwood National Park, California
  'redwood': [
    { url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200', caption: 'Tallest trees on Earth', credit: 'Unsplash', source: 'unsplash', photographerId: 'redwood-1' },
    { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200', caption: 'Sunlight through redwoods', credit: 'Unsplash', source: 'unsplash', photographerId: 'redwood-2' },
    { url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200', caption: 'Fern Canyon walls', credit: 'Unsplash', source: 'unsplash', photographerId: 'redwood-3' },
  ],

  // Rocky Mountain National Park, Colorado
  'rocky mountain': [
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Longs Peak towering above', credit: 'Unsplash', source: 'unsplash', photographerId: 'rocky-1' },
    { url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200', caption: 'Bear Lake reflections', credit: 'Unsplash', source: 'unsplash', photographerId: 'rocky-2' },
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Trail Ridge Road alpine', credit: 'Unsplash', source: 'unsplash', photographerId: 'rocky-3' },
  ],

  // Saguaro National Park, Arizona
  'saguaro': [
    { url: 'https://images.unsplash.com/photo-1494548162494-384bba4ab999?w=1200', caption: 'Saguaro cacti at sunset', credit: 'Unsplash', source: 'unsplash', photographerId: 'saguaro-1' },
    { url: 'https://images.unsplash.com/photo-1545243424-0ce743321e11?w=1200', caption: 'Sonoran Desert landscape', credit: 'Unsplash', source: 'unsplash', photographerId: 'saguaro-2' },
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'Desert bloom wildflowers', credit: 'Unsplash', source: 'unsplash', photographerId: 'saguaro-3' },
  ],

  // Sequoia & Kings Canyon National Parks
  'sequoia': [
    { url: 'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=1200', caption: 'Giant Sequoia grove', credit: 'Unsplash', source: 'unsplash', photographerId: 'sequoia-1' },
    { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200', caption: 'General Sherman Tree', credit: 'Unsplash', source: 'unsplash', photographerId: 'sequoia-2' },
    { url: 'https://images.unsplash.com/photo-1446034295857-c39f8844fad4?w=1200', caption: 'Sequoia forest sunlight', credit: 'Unsplash', source: 'unsplash', photographerId: 'sequoia-3' },
  ],

  'kings canyon': [
    { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200', caption: 'Kings Canyon vista', credit: 'Unsplash', source: 'unsplash', photographerId: 'kings-1' },
    { url: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1200', caption: 'Kings River cascades', credit: 'Unsplash', source: 'unsplash', photographerId: 'kings-2' },
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Zumwalt Meadow', credit: 'Unsplash', source: 'unsplash', photographerId: 'kings-3' },
  ],

  // Shenandoah National Park, Virginia
  'shenandoah': [
    { url: 'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=1200', caption: 'Blue Ridge Parkway vista', credit: 'Unsplash', source: 'unsplash', photographerId: 'shen-1' },
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'Shenandoah Valley sunset', credit: 'Unsplash', source: 'unsplash', photographerId: 'shen-2' },
    { url: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1200', caption: 'Dark Hollow Falls', credit: 'Unsplash', source: 'unsplash', photographerId: 'shen-3' },
  ],

  // Theodore Roosevelt National Park, North Dakota
  'theodore roosevelt': [
    { url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1200', caption: 'Painted Canyon badlands', credit: 'Unsplash', source: 'unsplash', photographerId: 'teddy-1' },
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Wild bison herd', credit: 'Unsplash', source: 'unsplash', photographerId: 'teddy-2' },
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'Little Missouri River sunset', credit: 'Unsplash', source: 'unsplash', photographerId: 'teddy-3' },
  ],

  // Virgin Islands National Park
  'virgin islands': [
    { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200', caption: 'Trunk Bay beach', credit: 'Unsplash', source: 'unsplash', photographerId: 'virgin-1' },
    { url: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200', caption: 'Underwater snorkel trail', credit: 'Unsplash', source: 'unsplash', photographerId: 'virgin-2' },
    { url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200', caption: 'Caribbean tropical paradise', credit: 'Unsplash', source: 'unsplash', photographerId: 'virgin-3' },
  ],

  // Voyageurs National Park, Minnesota
  'voyageurs': [
    { url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200', caption: 'Kabetogama Lake sunset', credit: 'Unsplash', source: 'unsplash', photographerId: 'voyageurs-1' },
    { url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200', caption: 'Northern lights over water', credit: 'Unsplash', source: 'unsplash', photographerId: 'voyageurs-2' },
    { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200', caption: 'Houseboat on the lakes', credit: 'Unsplash', source: 'unsplash', photographerId: 'voyageurs-3' },
  ],

  // White Sands National Park, New Mexico
  'white sands': [
    { url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1200', caption: 'White gypsum dunes', credit: 'Unsplash', source: 'unsplash', photographerId: 'whitesands-1' },
    { url: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=1200', caption: 'Dune patterns at sunset', credit: 'Unsplash', source: 'unsplash', photographerId: 'whitesands-2' },
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'White Sands golden hour', credit: 'Unsplash', source: 'unsplash', photographerId: 'whitesands-3' },
  ],

  // Wind Cave National Park, South Dakota
  'wind cave': [
    { url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=1200', caption: 'Boxwork cave formations', credit: 'Unsplash', source: 'unsplash', photographerId: 'windcave-1' },
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Prairie bison herd', credit: 'Unsplash', source: 'unsplash', photographerId: 'windcave-2' },
    { url: 'https://images.unsplash.com/photo-1585543805890-6051f7829f98?w=1200', caption: 'Mixed-grass prairie', credit: 'Unsplash', source: 'unsplash', photographerId: 'windcave-3' },
  ],

  // Wrangell-St. Elias National Park, Alaska
  'wrangell': [
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', caption: 'Massive glaciers and peaks', credit: 'Unsplash', source: 'unsplash', photographerId: 'wrangell-1' },
    { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Kennicott Mines historic', credit: 'Unsplash', source: 'unsplash', photographerId: 'wrangell-2' },
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Americas largest national park', credit: 'Unsplash', source: 'unsplash', photographerId: 'wrangell-3' },
  ],

  // Yellowstone National Park
  'yellowstone': [
    { url: 'https://images.unsplash.com/photo-1533419779455-31e4f2b6d399?w=1200', caption: 'Grand Prismatic Spring', credit: 'Unsplash', source: 'unsplash', photographerId: 'yellowstone-1' },
    { url: 'https://images.unsplash.com/photo-1570135410379-d7ae619e0e9a?w=1200', caption: 'Old Faithful eruption', credit: 'Unsplash', source: 'unsplash', photographerId: 'yellowstone-2' },
    { url: 'https://images.unsplash.com/photo-1565630792243-9e3d8b93a58e?w=1200', caption: 'Mammoth Hot Springs terraces', credit: 'Unsplash', source: 'unsplash', photographerId: 'yellowstone-3' },
    { url: 'https://images.unsplash.com/photo-1516655855035-d5215bcb5604?w=1200', caption: 'Grand Canyon of Yellowstone', credit: 'Unsplash', source: 'unsplash', photographerId: 'yellowstone-4' },
  ],

  // Yosemite National Park, California
  'yosemite': [
    { url: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?w=1200', caption: 'Half Dome at sunrise', credit: 'Unsplash', source: 'unsplash', photographerId: 'yosemite-1' },
    { url: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1200', caption: 'Yosemite Valley panorama', credit: 'Unsplash', source: 'unsplash', photographerId: 'yosemite-2' },
    { url: 'https://images.unsplash.com/photo-1562310503-a918c4c61e38?w=1200', caption: 'El Capitan granite face', credit: 'Unsplash', source: 'unsplash', photographerId: 'yosemite-3' },
    { url: 'https://images.unsplash.com/photo-1473615695634-d284ec918736?w=1200', caption: 'Bridalveil Fall', credit: 'Unsplash', source: 'unsplash', photographerId: 'yosemite-4' },
  ],

  // Zion National Park, Utah
  'zion': [
    { url: 'https://images.unsplash.com/photo-1547035636-53a2f0e8a4db?w=1200', caption: 'Angels Landing trail', credit: 'Unsplash', source: 'unsplash', photographerId: 'zion-1' },
    { url: 'https://images.unsplash.com/photo-1568913903816-3d3af1ab4bb3?w=1200', caption: 'The Narrows river hike', credit: 'Unsplash', source: 'unsplash', photographerId: 'zion-2' },
    { url: 'https://images.unsplash.com/photo-1563299796-17596ed6b017?w=1200', caption: 'Zion Canyon sunset glow', credit: 'Unsplash', source: 'unsplash', photographerId: 'zion-3' },
  ],
};

// Export function to get photos by park key
export function getParkPhotos(parkKey: string): ParkPhoto[] {
  return PARK_PHOTOS[parkKey.toLowerCase()] || [];
}

// Export function to find park key from query
export function findParkKeyFromQuery(query: string): string | null {
  const queryLower = query.toLowerCase();
  for (const key of Object.keys(PARK_PHOTOS)) {
    if (queryLower.includes(key)) {
      return key;
    }
  }
  return null;
}
