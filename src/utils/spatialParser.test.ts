import test from 'node:test';
import assert from 'node:assert/strict';
import {
  determineGroundingStrategy,
  extractGroundingSources,
  derivePlaceSearchQuery,
  calculateHaversineDistanceKm,
  formatCoordinate,
  buildSystemInstruction,
  resolveMapStyleConfig,
  MAP_STYLE_OPTIONS,
  calculateMultiStopMetrics,
} from './spatialParser';

test('resolveMapStyleConfig resolves standard, roadmap, satellite, and hybrid styles', () => {
  assert.equal(MAP_STYLE_OPTIONS.length, 4);
  assert.equal(resolveMapStyleConfig('standard').mapTypeId, 'roadmap');
  assert.equal(resolveMapStyleConfig('roadmap').mapTypeId, 'roadmap');
  assert.equal(resolveMapStyleConfig('satellite').mapTypeId, 'satellite');
  assert.equal(resolveMapStyleConfig('hybrid').mapTypeId, 'hybrid');
  assert.equal(resolveMapStyleConfig('unknown').id, 'standard');
});

test('determineGroundingStrategy honors explicit modes and auto-detects hybrid queries', () => {
  assert.equal(determineGroundingStrategy('best coffee nearby', 'maps'), 'maps');
  assert.equal(determineGroundingStrategy('best coffee nearby', 'search'), 'search');
  assert.equal(determineGroundingStrategy('what events are happening today', 'auto'), 'search');
  assert.equal(
    determineGroundingStrategy('best coffee shops open today near Ferry Building', 'auto'),
    'both'
  );
});

test('extractGroundingSources extracts and deduplicates both maps and web chunks with review snippets', () => {
  const mockMetadata = {
    groundingChunks: [
      {
        maps: {
          title: 'Tartine Bakery',
          uri: 'https://maps.google.com/?cid=111',
          placeAnswerSources: {
            reviewSnippets: [
              { text: 'Incredible morning buns and country bread.' },
              'Expect a short line on weekends.',
            ],
          },
        },
      },
      {
        maps: {
          title: 'Duplicate Tartine',
          uri: 'https://maps.google.com/?cid=111',
        },
      },
      {
        web: {
          title: 'SF Eater Guide 2026',
          uri: 'https://sf.eater.com/essential-bakeries',
        },
      },
    ],
  };

  const sources = extractGroundingSources(mockMetadata);
  assert.equal(sources.length, 2);
  assert.equal(sources[0].kind, 'maps');
  assert.equal(sources[0].title, 'Tartine Bakery');
  assert.deepEqual(sources[0].reviewSnippets, [
    'Incredible morning buns and country bread.',
    'Expect a short line on weekends.',
  ]);
  assert.equal(sources[1].kind, 'web');
  assert.equal(sources[1].title, 'SF Eater Guide 2026');
});

test('derivePlaceSearchQuery prioritizes grounded map titles or cleans user prompt', () => {
  const withMaps = derivePlaceSearchQuery(
    'Where can I get pastries?',
    [{ id: '1', kind: 'maps', title: 'b. patisserie', uri: 'https://maps.google.com/1' }],
    'San Francisco, CA'
  );
  assert.equal(withMaps, 'b. patisserie San Francisco, CA');

  const fromPrompt = derivePlaceSearchQuery(
    'What are the best ramen spots?',
    [],
    'Tokyo, Japan'
  );
  assert.equal(fromPrompt, 'best ramen spots in Tokyo, Japan');
});

test('calculateHaversineDistanceKm and formatCoordinate return accurate values', () => {
  const ferryBuilding = { lat: 37.7955, lng: -122.3937 };
  const unionSquare = { lat: 37.7879, lng: -122.4075 };
  const dist = calculateHaversineDistanceKm(ferryBuilding, unionSquare);
  assert.ok(dist > 1.3 && dist < 1.6, `Expected distance around 1.48km, got ${dist}`);
  assert.equal(formatCoordinate(37.7955, -122.3937), '37.7955°N, 122.3937°W');
});

test('buildSystemInstruction includes active role, city, and coordinates', () => {
  const instruction = buildSystemInstruction('urbanist', 'London, UK', {
    lat: 51.5074,
    lng: -0.1278,
  });
  assert.ok(instruction.includes('Urban Historian'));
  assert.ok(instruction.includes('London, UK'));
  assert.ok(instruction.includes('51.5074'));
});

test('calculateMultiStopMetrics handles zero, single, and multiple coordinates', () => {
  const empty = calculateMultiStopMetrics([]);
  assert.equal(empty.totalDistanceKm, 0);
  assert.equal(empty.totalDurationMinutes, 0);

  const ferryBuilding = { lat: 37.7955, lng: -122.3937 };
  const unionSquare = { lat: 37.7879, lng: -122.4075 };
  const coitTower = { lat: 37.8024, lng: -122.4058 };

  const walk = calculateMultiStopMetrics([ferryBuilding, unionSquare, coitTower], 'WALKING');
  assert.ok(walk.totalDistanceKm > 2.5 && walk.totalDistanceKm < 4.0);
  assert.ok(walk.totalDurationMinutes > 20);
  assert.ok(walk.formattedDistance.includes('km'));
  assert.ok(walk.formattedDuration.includes('min'));

  const drive = calculateMultiStopMetrics([ferryBuilding, unionSquare, coitTower], 'DRIVING');
  assert.ok(drive.totalDurationMinutes < walk.totalDurationMinutes);
});

