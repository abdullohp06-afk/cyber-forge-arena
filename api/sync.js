// POST /api/sync {pid, name, trophies, power, strike, squad} — stores the player's profile and rating.
import {handler, sync} from './_lib/core.js';

export default handler({POST: (store, {body}) => sync(store, body)});
