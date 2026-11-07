// src/census.js — live 2020 Census population for every Michigan county, straight from the U.S. Census Bureau API.
// Cached in the database for 30 days so the site makes at most one Census call a month.
// Source: U.S. Census Bureau, 2020 Census Redistricting Data (P.L. 94-171), table P1, total population.

import db from './db.js';
import { COUNTY_TO_REGION, REGIONS } from './regions.js';

const URL_BASE = () => process.env.CENSUS_URL || 'https://api.census.gov/data/2020/dec/pl';
const TTL = 30 * 864e5;
let mem = null;

export const CENSUS_SOURCE = { label: 'U.S. Census Bureau, 2020 Census (P.L. 94-171), table P1', url: 'https://data.census.gov/table/DECENNIALPL2020.P1?g=040XX00US26$0500000' };

function shape(rows) {
  // rows: [["NAME","P1_001N","state","county"], ["Alcona County, Michigan","10167","26","001"], ...]
  const [header, ...data] = rows;
  const iN = header.indexOf('NAME'), iP = header.indexOf('P1_001N'), iS = header.indexOf('state'), iC = header.indexOf('county');
  const counties = {}, regions = Object.fromEntries(REGIONS.map((r) => [r.id, 0]));
  let total = 0;
  for (const r of data) {
    const name = String(r[iN]).replace(/ County, Michigan$/, ''), pop = Number(r[iP]);
    if (!Number.isFinite(pop)) continue;
    counties[`${r[iS]}${r[iC]}`] = { name, pop };
    if (COUNTY_TO_REGION[name]) regions[COUNTY_TO_REGION[name]] += pop;
    total += pop;
  }
  if (Object.keys(counties).length !== 83) throw new Error(`expected 83 counties, got ${Object.keys(counties).length}`);
  return { counties, regions, total, source: CENSUS_SOURCE, fetched_at: new Date().toISOString() };
}

export async function getCensus() {
  if (mem && Date.now() - mem.at < TTL) return mem.data;
  const cached = await db.kvGet('census_2020').catch(() => null);
  if (cached && Date.now() - new Date(cached.fetched_at) < TTL) { mem = { at: Date.now(), data: cached }; return cached; }
  try {
    const key = process.env.CENSUS_API_KEY ? `&key=${encodeURIComponent(process.env.CENSUS_API_KEY)}` : '';
    const r = await fetch(`${URL_BASE()}?get=NAME,P1_001N&for=county:*&in=state:26${key}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`Census API ${r.status}`);
    const data = shape(await r.json());
    await db.kvSet('census_2020', data).catch(() => {});
    mem = { at: Date.now(), data };
    return data;
  } catch (e) {
    if (cached) return cached; // stale is better than nothing; 2020 counts don't change
    throw e;
  }
}
