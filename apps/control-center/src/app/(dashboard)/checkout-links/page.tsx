import { Metadata } from "next";
import { CheckoutLinksClient } from "./client";

export const metadata: Metadata = {
    title: "Experimental Checkout Links | Vintrack",
    description:
        "View saved checkout and payment links from the experimental buy flow.",
};

export default function CheckoutLinksPage() {
    return <CheckoutLinksClient />;
}
