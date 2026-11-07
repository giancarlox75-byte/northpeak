// src/regions.js — Michigan's 10 official Prosperity Regions (State of Michigan Regional Prosperity Initiative).
// Single source of truth: used by the server, the admin dashboard, and scripts/build-map.js (which generates
// public/data/michigan-map.js for the website). Every one of Michigan's 83 counties appears exactly once;
// the build script fails if that ever stops being true.

export const REGIONS = [
  { id: 'up', num: 1, name: 'Upper Peninsula', cities: ['Marquette', 'Sault Ste. Marie', 'Escanaba', 'Houghton'],
    counties: ['Alger', 'Baraga', 'Chippewa', 'Delta', 'Dickinson', 'Gogebic', 'Houghton', 'Iron', 'Keweenaw', 'Luce', 'Mackinac', 'Marquette', 'Menominee', 'Ontonagon', 'Schoolcraft'],
    focus: 'Broadband that actually reaches, mining and timber jobs with a future, rural health care close to home, and making sure Lansing never forgets the U.P.',
    issues: ['rural', 'jobs', 'energy'] },
  { id: 'northwest', num: 2, name: 'Northwest', cities: ['Traverse City', 'Petoskey', 'Cadillac', 'Manistee'],
    counties: ['Antrim', 'Benzie', 'Charlevoix', 'Emmet', 'Grand Traverse', 'Kalkaska', 'Leelanau', 'Manistee', 'Missaukee', 'Wexford'],
    focus: 'Housing that workers can afford in tourism towns, clean lakes, and year-round jobs, not just summer ones.',
    issues: ['housing', 'water', 'jobs'] },
  { id: 'northeast', num: 3, name: 'Northeast', cities: ['Alpena', 'Gaylord', 'Cheboygan', 'Grayling'],
    counties: ['Alcona', 'Alpena', 'Cheboygan', 'Crawford', 'Iosco', 'Montmorency', 'Ogemaw', 'Oscoda', 'Otsego', 'Presque Isle', 'Roscommon'],
    focus: 'Keeping hospitals and schools open in small towns, reliable power through every winter storm, and roads that hold up.',
    issues: ['rural', 'energy', 'roads'] },
  { id: 'west', num: 4, name: 'West Michigan', cities: ['Grand Rapids', 'Muskegon', 'Holland', 'Big Rapids'],
    counties: ['Allegan', 'Barry', 'Ionia', 'Kent', 'Lake', 'Mason', 'Mecosta', 'Montcalm', 'Muskegon', 'Newaygo', 'Oceana', 'Osceola', 'Ottawa'],
    focus: 'Keeping a growing region affordable, backing manufacturers and skilled trades, and protecting the Lake Michigan shoreline.',
    issues: ['housing', 'jobs', 'pathways'] },
  { id: 'eastcentral', num: 5, name: 'East Central', cities: ['Saginaw', 'Bay City', 'Midland', 'Mount Pleasant'],
    counties: ['Arenac', 'Bay', 'Clare', 'Gladwin', 'Gratiot', 'Isabella', 'Midland', 'Saginaw'],
    focus: 'The next generation of manufacturing jobs, revitalized downtowns, and clean water from the Saginaw Bay to every tap.',
    issues: ['jobs', 'water', 'costs'] },
  { id: 'east', num: 6, name: 'East Michigan', cities: ['Flint', 'Port Huron', 'Lapeer', 'Owosso'], home: 'Kevin was born and raised in Flint and graduated from Carman-Ainsworth High School.',
    counties: ['Genesee', 'Huron', 'Lapeer', 'Sanilac', 'Shiawassee', 'St. Clair', 'Tuscola'],
    focus: 'Clean, safe water in every home, strong public schools, family farms in the Thumb, and good-paying jobs that keep young people here.',
    issues: ['water', 'schools', 'jobs'] },
  { id: 'southcentral', num: 7, name: 'South Central', cities: ['Lansing', 'East Lansing', 'Charlotte', 'St. Johns'], connection: 'Kevin worked in the Capitol as a legislative and policy intern.',
    counties: ['Clinton', 'Eaton', 'Ingham'],
    focus: 'Opening up state government to the public, supporting students and young workers, and growing good jobs in the capital region.',
    issues: ['open', 'ai', 'schools'] },
  { id: 'southwest', num: 8, name: 'Southwest', cities: ['Kalamazoo', 'Battle Creek', 'Benton Harbor', 'St. Joseph'], connection: 'Kevin graduated from Western Michigan University in Kalamazoo and interned with Legal Aid of Western Michigan.',
    counties: ['Berrien', 'Branch', 'Calhoun', 'Cass', 'Kalamazoo', 'St. Joseph', 'Van Buren'],
    focus: 'Investing in workers, students, and small towns, and connecting graduates with great Michigan careers.',
    issues: ['pathways', 'jobs', 'mental'] },
  { id: 'southeast', num: 9, name: 'Southeast', cities: ['Ann Arbor', 'Jackson', 'Monroe', 'Adrian'], connection: 'Kevin spent part of his childhood in Ann Arbor.',
    counties: ['Hillsdale', 'Jackson', 'Lenawee', 'Livingston', 'Monroe', 'Washtenaw'],
    focus: 'Turning university research into Michigan jobs, keeping housing within reach, and AI that creates opportunity instead of replacing it.',
    issues: ['ai', 'housing', 'jobs'] },
  { id: 'detroit', num: 10, name: 'Detroit Metro', cities: ['Detroit', 'Warren', 'Troy', 'Dearborn'], connection: 'Kevin spent part of his childhood in Troy.',
    counties: ['Macomb', 'Oakland', 'Wayne'],
    focus: 'Lower car insurance and living costs, great public schools, safe neighborhoods, and a comeback that reaches every block.',
    issues: ['costs', 'schools', 'ai'] },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export const COUNTY_TO_REGION = Object.fromEntries(REGIONS.flatMap((r) => r.counties.map((c) => [c, r.id])));
