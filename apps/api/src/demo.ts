import { pool } from "./db.js";
import { prepareDemo } from "./services/demo.service.js";
try {
  await prepareDemo(process.env.DEMO_PASSWORD);
} finally {
  await pool.end();
}
