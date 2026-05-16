import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactRouter from "./contact";
import checkoutRouter from "./checkout";
const router: IRouter = Router();

router.use(healthRouter);
router.use(contactRouter);
router.use(checkoutRouter);

export default router;
