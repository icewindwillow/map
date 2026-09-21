import {serveTile} from '../../../server/tiles.mjs';
export function onRequest(context) { return serveTile(context); }
