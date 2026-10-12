import { config } from "dotenv";

// Scripts run outside Next.js, so load the local secrets file by hand.
config({ path: ".env.local", quiet: true });
