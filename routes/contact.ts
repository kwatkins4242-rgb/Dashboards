import { Router, type Request, type Response } from "express";
import { db, inquiriesTable } from "@workspace/db";
import { z } from "zod";

const contactRouter = Router();

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().min(1),
});

contactRouter.post("/contact", async (req: Request, res: Response): Promise<void> => {
  try {
    const data = contactSchema.parse(req.body);
    
    await db.insert(inquiriesTable).values({
      name: data.name,
      email: data.email,
      phone: data.phone,
      message: data.message,
    });

    res.status(200).json({ success: true, message: "Inquiry saved successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
});

export default contactRouter;
