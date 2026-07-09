import express from "express";
import cors from "cors";

import aiRoutes from "./src/routes/ai.routes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/", aiRoutes);

export default app;