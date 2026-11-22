import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareVenue,searchVenues} from '../public/directory-search.js';

const {venues}=JSON.parse(await readFile(new URL('../public/assets/courses.json',import.meta.url)));
const directory=venues.map(prepareVenue);
const ids=criteria=>searchVenues(directory,criteria).map(venue=>venue.id);

test('typed Scotland and the UK region filter include Fife, excluding England and Northern Ireland',()=>{
 const typed=ids({query:'Scotland'});
 const filtered=ids({country:'United Kingdom',region:'Scotland'});
 assert.deepEqual(typed,filtered);
 for(const id of ['Q167245','Q5430606','cabot-old-petty'])assert.ok(typed.includes(id));
 for(const id of ['Q1881861','Q1636565'])assert.ok(!typed.includes(id));
});
test('course, locality, region and country searches maintain their separate scopes',()=>{
 assert.equal(ids({query:'Old Course at St Andrews'})[0],'Q167245');
 assert.ok(ids({query:'St Andrews'}).includes('Q167245'));
 assert.ok(ids({query:'Fife'}).includes('Q167245'));
 assert.ok(ids({query:'Northern Ireland'}).includes('Q1881861'));
 assert.ok(!ids({query:'Ireland'}).includes('Q1881861'));
 assert.ok(ids({query:'UK'}).includes('Q1881861'));
 assert.ok(ids({query:'USA'}).includes('Q534974'));
 assert.deepEqual(ids({query:'Scotland',country:'Ireland'}),[]);
});
