/*
 * Client logos for the logo strip (/assets/clients/ticker.js).
 * name: alt text. file: a PNG in this folder, drawn at twice the display
 * height in one ink color on a transparent background. h: display height in
 * CSS pixels. group (optional): logos that share a group never show in the
 * same set, so a brokerage logo and a team logo that already carries that
 * brokerage are never side by side.
 *
 * To add a client: drop the ink PNG in this folder and add one line here.
 */
window.MS_CLIENTS = [
  { name: 'Suburban Steel Supply', file: 'suburban-steel-supply.png', h: 40 },
  { name: 'Total Services, Inc.', file: 'total-services.png', h: 64 },
  { name: 'P and L Express, Inc.', file: 'p-and-l-express.png', h: 64 },
  { name: 'Runway Services', file: 'runway-services.png', h: 56 },
  { name: 'The Dream Home Team, Keller Williams Consultants Realty', file: 'dream-home-team.png', h: 44, group: 'keller-williams' },
  { name: 'Keller Williams Consultants Realty', file: 'keller-williams.png', h: 42, group: 'keller-williams' },
  { name: 'Optiko Real Estate', file: 'optiko-real-estate.png', h: 60 },
  { name: 'Obsidian Productions', file: 'obsidian-productions.png', h: 40 },
  { name: 'The Stewards', file: 'the-stewards.png', h: 40 },
  { name: 'Julie & Company, Howard Hanna', file: 'julie-and-company.png', h: 48, group: 'howard-hanna' },
  { name: 'Howard Hanna Real Estate Services', file: 'howard-hanna.png', h: 41, group: 'howard-hanna' }
];
