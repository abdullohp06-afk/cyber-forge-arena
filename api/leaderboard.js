// GET /api/leaderboard — global Top-50.  POST /api/leaderboard {pid, name} — change the nickname.
import {handler, top, rename} from './_lib/core.js';

export default handler({GET: store => top(store), POST: (store, {body}) => rename(store, body)});
