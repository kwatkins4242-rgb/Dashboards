import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { db, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const checkoutRouter = Router();

// We will initialize Stripe when the keys are available in environment variables
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
}) : null;

const checkoutSchema = z.object({
  productName: z.string(),
  amount: z.number(), // in cents
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

checkoutRouter.post("/checkout", async (req: Request, res: Response): Promise<void> => {
  if (!stripe) {
    res.status(500).json({ success: false, message: "Stripe is not configured" });
    return;
  }

  try {
    const data = checkoutSchema.parse(req.body);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: data.productName,
            },
            unit_amount: data.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
    });

    if (session.url) {
      res.status(200).json({ url: session.url });
    } else {
      res.status(500).json({ success: false, message: "Failed to create Stripe session" });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
});

// Webhook to fulfill orders
checkoutRouter.post("/webhook/stripe", async (req: Request, res: Response): Promise<void> => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(500).send("Webhook Secret is missing");
    return;
  }

  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;

  try {
    // Note: In production, express.raw() middleware should be used for this route to get the raw body.
    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Save order to db
    await db.insert(ordersTable).values({
      stripeSessionId: session.id,
      customerEmail: session.customer_details?.email || "unknown",
      productName: "Dashboard", // Could be retrieved from metadata
      amountTotal: session.amount_total || 0,
      status: "paid",
    });
  }

  res.json({ received: true });
});

export default checkoutRouter;
