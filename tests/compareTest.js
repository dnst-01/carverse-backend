/* Simple manual test runner for the compare endpoint.
   Usage:
   1) Start the backend locally: npm run dev:backend
   2) Run: node backend/tests/compareTest.js
*/

import assert from 'assert';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const getJson = async (url, options = {}) => {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Request failed ${res.status}: ${body.message || res.statusText}`);
  }
  return res.json();
};

const run = async () => {
  console.log('Fetching sample cars...');
  const list = await getJson(`${BASE_URL}/api/cars?limit=4`);
  const cars = list.data || [];
  assert(cars.length >= 2, 'Need at least 2 cars to test comparison');

  const ids = cars.slice(0, 2).map((c) => c._id);
  console.log('Testing compare with ids:', ids);
  const result = await getJson(`${BASE_URL}/api/cars/compare`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });

  assert(Array.isArray(result.comparison), 'comparison should be an array');
  assert(result.comparison.length > 0, 'comparison has spec rows');
  assert(result.cars.length === ids.length, 'returns the same number of cars');

  const firstRow = result.comparison[0];
  assert(firstRow.values.length === ids.length, 'each row has values per car');
  console.log('✅ Compare endpoint returned aligned specs');

  // Negative test: missing id
  try {
    await getJson(`${BASE_URL}/api/cars/compare`, {
      method: 'POST',
      body: JSON.stringify({ ids: ['invalid-id'] }),
    });
    console.error('❌ Expected failure for invalid id but succeeded');
  } catch (err) {
    console.log('✅ Invalid id correctly rejected');
  }
};

run().catch((err) => {
  console.error('Compare test failed:', err.message);
  process.exit(1);
});





