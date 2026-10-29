import { makeProxy } from "../lib/core.mjs";
export default makeProxy({ upstream: "https://australia.adagasolutions.com/WMLS", skipHost: "australia.adagasolutions.com", perMin: 60 });
export const config = { path: "/witsml-proxy", rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] } };
