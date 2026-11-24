import {handleAPI} from '../../lib/tmdb.mjs';

export default {
  fetch(request) { return handleAPI(request, process.env); }
};
