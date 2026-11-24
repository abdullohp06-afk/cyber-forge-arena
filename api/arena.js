// GET /api/arena?pid=…&trophies=… — a real opponent near this rating, or {opponent: null} (the game uses its bots).
import {handler, findOpponent} from './_lib/core.js';

export default handler({GET: (store, {query}) => findOpponent(store, query)});
