import { Metadata } from "next";
import { OneClickBuyTestClient } from "./client";

export const metadata: Metadata = {
  title: "Experimental Buy Lab | Vintrack",
  description: "Test the experimental Vinted PayPal checkout flow.",
};

export default function OneClickBuyTestPage() {
  return <OneClickBuyTestClient />;
}
